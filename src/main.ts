import {
  MarkdownView,
  Notice,
  Plugin,
  TFile,
  normalizePath
} from "obsidian";
import {
  basenameWithoutExtension,
  buildBaseName,
  chooseUniquePaths,
  extensionOf,
  formatLocalDate,
  inferDestination,
  isSupportedExport
} from "./core/paths";
import { buildSidecar } from "./core/sidecar";
import { buildShortcutUrl } from "./core/shortcut";
import { contentHash } from "./core/text";
import { DEFAULT_SETTINGS, WorkflowSettingTab } from "./settings";
import { executeReviewTransaction } from "./transaction";
import type { PendingCapture, StoredData, WorkflowSettings } from "./types";
import {
  ConfirmAbandonModal,
  ExistingCaptureModal,
  ExportPickerModal,
  FinishReviewModal,
  StartCaptureModal,
  type ExistingCaptureAction,
  type FinishReviewInput,
  type StartCaptureInput
} from "./ui/modals";

export default class GoodnotesWorkflowPlugin extends Plugin {
  settings: WorkflowSettings = DEFAULT_SETTINGS;
  private pendingCapture: PendingCapture | null = null;
  private detectedExportPath: string | null = null;
  private finishInProgress = false;

  async onload(): Promise<void> {
    await this.loadState();
    this.addSettingTab(new WorkflowSettingTab(this.app, this));
    this.addRibbonIcon("pen-tool", "Рукописный ввод", () => void this.startCapture());

    this.addCommand({
      id: "start-handwriting-capture",
      name: "Рукописный ввод: начать",
      editorCallback: () => void this.startCapture()
    });
    this.addCommand({
      id: "resume-handwriting-capture",
      name: "Рукописный ввод: вернуться в Goodnotes",
      checkCallback: (checking) => {
        if (this.pendingCapture === null) return false;
        if (!checking) this.openGoodnotes(this.pendingCapture);
        return true;
      }
    });
    this.addCommand({
      id: "finish-handwriting-capture",
      name: "Рукописный ввод: завершить",
      checkCallback: (checking) => {
        if (this.pendingCapture === null) return false;
        if (!checking) void this.finishCapture();
        return true;
      }
    });
    this.addCommand({
      id: "abandon-handwriting-capture",
      name: "Рукописный ввод: отменить сессию",
      checkCallback: (checking) => {
        if (this.pendingCapture === null) return false;
        if (!checking) void this.abandonCapture();
        return true;
      }
    });

    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (!(file instanceof TFile) || !this.isCandidateForPendingCapture(file)) return;
        this.detectedExportPath = file.path;
        new Notice("Обнаружен экспорт Goodnotes. Открываю preview…");
        window.setTimeout(() => {
          if (this.pendingCapture !== null && this.detectedExportPath === file.path) {
            void this.finishCapture();
          }
        }, 500);
      })
    );
  }

  async persistState(): Promise<void> {
    const data: StoredData = { settings: this.settings, pendingCapture: this.pendingCapture };
    await this.saveData(data);
  }

  private async loadState(): Promise<void> {
    const loaded = (await this.loadData()) as Partial<StoredData> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...(loaded?.settings ?? {}) };
    this.pendingCapture = loaded?.pendingCapture ?? null;
  }

  private async startCapture(): Promise<void> {
    if (this.pendingCapture !== null) {
      const action = await this.openExistingCaptureModal(this.pendingCapture);
      await this.handleExistingCaptureAction(action);
      return;
    }

    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const sourceNote = view?.file;
    if (view === null || !(sourceNote instanceof TFile)) {
      new Notice("Откройте Markdown-заметку перед запуском рукописного ввода.");
      return;
    }

    const sourceContent = await this.app.vault.read(sourceNote);
    const input = await this.openStartModal(sourceNote.path, sourceNote.basename);
    if (input === null) return;

    try {
      await this.ensureInboxFolder();
    } catch (error) {
      new Notice(`Не удалось подготовить Inbox: ${errorMessage(error)}`);
      return;
    }

    this.pendingCapture = {
      id: createCaptureId(),
      sourcePath: sourceNote.path,
      sourceHash: contentHash(sourceContent),
      cursorOffset: view.editor.posToOffset(view.editor.getCursor()),
      startedAt: Date.now(),
      title: input.title,
      preferredFormat: input.preferredFormat
    };
    this.detectedExportPath = null;
    try {
      await this.persistState();
    } catch (error) {
      this.pendingCapture = null;
      new Notice(`Не удалось сохранить рукописную сессию: ${errorMessage(error)}`);
      return;
    }
    this.openGoodnotes(this.pendingCapture);
  }

  private async handleExistingCaptureAction(action: ExistingCaptureAction | null): Promise<void> {
    if (action === "resume" && this.pendingCapture !== null) this.openGoodnotes(this.pendingCapture);
    else if (action === "finish") await this.finishCapture();
    else if (action === "abandon") await this.abandonCapture();
  }

  private openGoodnotes(capture: PendingCapture): void {
    const name = this.settings.startShortcutName.trim();
    if (name.length === 0) {
      new Notice("Укажите имя Apple Shortcut в настройках плагина.");
      return;
    }
    window.open(buildShortcutUrl(name, capture), "_blank");
  }

  private async abandonCapture(): Promise<void> {
    const capture = this.pendingCapture;
    if (capture === null) return;
    const confirmed = await this.openConfirmAbandonModal(capture);
    if (!confirmed) return;
    this.pendingCapture = null;
    this.detectedExportPath = null;
    await this.persistState();
    new Notice("Рукописная сессия отменена. Файлы в Inbox сохранены.");
  }

  private async finishCapture(): Promise<void> {
    if (this.finishInProgress) return;
    this.finishInProgress = true;
    try {
      await this.finishCaptureInternal();
    } finally {
      this.finishInProgress = false;
    }
  }

  private async finishCaptureInternal(): Promise<void> {
    const capture = this.pendingCapture;
    if (capture === null) {
      new Notice("Нет активной рукописной сессии.");
      return;
    }
    const sourceNote = this.app.vault.getAbstractFileByPath(capture.sourcePath);
    if (!(sourceNote instanceof TFile) || sourceNote.extension !== "md") {
      new Notice("Исходная заметка не найдена. Сессия сохранена для ручного восстановления.");
      return;
    }

    const candidates = this.findExportCandidates(capture);
    const attachment = await this.selectExport(candidates);
    if (attachment === null) {
      if (candidates.length === 0) new Notice("В Inbox не найден экспорт PDF/PNG/JPEG.");
      return;
    }

    const sourceContent = await this.app.vault.read(sourceNote);
    const noteChanged = contentHash(sourceContent) !== capture.sourceHash;
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const activeSourceView = activeView?.file?.path === sourceNote.path ? activeView : null;
    const destination = inferDestination(sourceNote.path, attachment.path, this.settings);
    const captured = formatLocalDate(new Date());
    const extension = extensionOf(attachment.path);
    const review = await this.openFinishModal({
      sourcePath: sourceNote.path,
      exportPath: attachment.path,
      context: destination.context,
      noteChanged,
      canUseCurrentCursor: activeSourceView !== null,
      previewPath: (artifact, context) =>
        `${destination.directory}/${buildBaseName(captured, artifact, context)}.${extension}`
    });
    if (review === null) return;

    const currentSourceContent = await this.app.vault.read(sourceNote);
    if (currentSourceContent !== sourceContent) {
      new Notice("Исходная заметка изменилась после preview. Запустите завершение ещё раз.");
      return;
    }

    const insertionOffset = this.resolveInsertionOffset(
      review,
      capture,
      currentSourceContent,
      activeSourceView
    );
    if (review.insertionMode === "current-cursor" && insertionOffset === null) {
      new Notice("Исходная заметка больше не активна. Выберите другое место вставки.");
      return;
    }

    const occupied = new Set(this.app.vault.getFiles().map((file) => file.path));
    const unique = chooseUniquePaths(
      normalizePath(destination.directory),
      buildBaseName(captured, review.artifact, review.context),
      extension,
      occupied
    );
    const projectNote =
      destination.projectNote !== null &&
      this.app.vault.getAbstractFileByPath(destination.projectNote) instanceof TFile
        ? destination.projectNote
        : destination.para === "project"
          ? sourceNote.path
          : null;

    const title = basenameWithoutExtension(unique.attachmentPath);
    try {
      await executeReviewTransaction(this.app, {
        attachment,
        finalAttachmentPath: unique.attachmentPath,
        sidecarPath: unique.sidecarPath,
        sourceNote,
        expectedSourceContent: currentSourceContent,
        insertionMode: review.insertionMode,
        insertionOffset,
        buildSidecar: (attachmentLink) =>
          buildSidecar({
            title,
            artifact: review.artifact,
            para: destination.para,
            projectNote,
            captured,
            sourceNote: sourceNote.path,
            attachmentLink
          })
      });
    } catch (error) {
      new Notice(`Не удалось завершить рукописную сессию: ${errorMessage(error)}`, 10_000);
      return;
    }

    this.pendingCapture = null;
    this.detectedExportPath = null;
    try {
      await this.persistState();
      new Notice(`Рукописный экспорт сохранён: ${unique.attachmentPath}`);
    } catch (error) {
      new Notice(
        `Экспорт сохранён, но служебное состояние не записано: ${errorMessage(error)}. Проверьте Inbox перед повтором.`,
        10_000
      );
    }
  }

  private async ensureInboxFolder(): Promise<void> {
    const inbox = normalizePath(this.settings.inboxFolder);
    if (inbox.length === 0 || inbox.split("/").includes("..")) {
      throw new Error("Inbox folder is empty or unsafe");
    }
    const parts = inbox.split("/");
    let current = "";
    for (const part of parts) {
      current = current.length === 0 ? part : `${current}/${part}`;
      if (this.app.vault.getAbstractFileByPath(current) === null) {
        await this.app.vault.createFolder(current);
      }
    }
  }

  private resolveInsertionOffset(
    review: FinishReviewInput,
    capture: PendingCapture,
    sourceContent: string,
    activeSourceView: MarkdownView | null
  ): number | null {
    if (review.insertionMode === "sidecar-only") return null;
    if (review.insertionMode === "end") return sourceContent.length;
    if (review.insertionMode === "saved-cursor") return capture.cursorOffset;
    return activeSourceView?.editor.posToOffset(activeSourceView.editor.getCursor()) ?? null;
  }

  private findExportCandidates(capture: PendingCapture): TFile[] {
    const inbox = normalizePath(this.settings.inboxFolder);
    const all = this.app.vault
      .getFiles()
      .filter((file) => file.path.startsWith(`${inbox}/`) && isSupportedExport(file.path))
      .filter((file) => {
        const sidecar = `${file.path.slice(0, -(file.extension.length + 1))}.md`;
        return this.app.vault.getAbstractFileByPath(sidecar) === null;
      })
      .sort((left, right) => right.stat.ctime - left.stat.ctime);

    if (this.detectedExportPath !== null) {
      const detected = all.find((file) => file.path === this.detectedExportPath);
      if (detected !== undefined) return [detected];
    }
    const recent = all.filter((file) => file.stat.ctime >= capture.startedAt - 60_000);
    return recent.length > 0 ? recent : all;
  }

  private isCandidateForPendingCapture(file: TFile): boolean {
    if (this.pendingCapture === null || !isSupportedExport(file.path)) return false;
    const inbox = normalizePath(this.settings.inboxFolder);
    return file.path.startsWith(`${inbox}/`) && file.stat.ctime >= this.pendingCapture.startedAt - 60_000;
  }

  private async selectExport(files: TFile[]): Promise<TFile | null> {
    if (files.length === 0) return null;
    if (files.length === 1) return files[0] ?? null;
    return await new Promise((resolve) => new ExportPickerModal(this.app, files, resolve).open());
  }

  private async openStartModal(sourcePath: string, title: string): Promise<StartCaptureInput | null> {
    return await new Promise((resolve) => new StartCaptureModal(this.app, sourcePath, title, resolve).open());
  }

  private async openExistingCaptureModal(capture: PendingCapture): Promise<ExistingCaptureAction | null> {
    return await new Promise((resolve) => new ExistingCaptureModal(this.app, capture, resolve).open());
  }

  private async openConfirmAbandonModal(capture: PendingCapture): Promise<boolean> {
    return await new Promise((resolve) => new ConfirmAbandonModal(this.app, capture, resolve).open());
  }

  private async openFinishModal(input: {
    sourcePath: string;
    exportPath: string;
    context: string;
    noteChanged: boolean;
    canUseCurrentCursor: boolean;
    previewPath: (artifact: string, context: string) => string;
  }): Promise<FinishReviewInput | null> {
    return await new Promise((resolve) =>
      new FinishReviewModal(
        this.app,
        input.sourcePath,
        input.exportPath,
        input.context,
        input.noteChanged,
        input.canUseCurrentCursor,
        input.previewPath,
        resolve
      ).open()
    );
  }
}

function createCaptureId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `capture-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
