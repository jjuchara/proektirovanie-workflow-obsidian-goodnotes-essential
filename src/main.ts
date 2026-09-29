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
import {
  binaryHash,
  normalizeGoodnotesSourceLink,
  readSidecarProvenance,
  updateSidecarAfterEdit
} from "./core/edit";
import { buildSidecar } from "./core/sidecar";
import { buildShortcutUrl } from "./core/shortcut";
import { contentHash } from "./core/text";
import { t } from "./i18n";
import { DEFAULT_SETTINGS, WorkflowSettingTab } from "./settings";
import { executeEditReplacementTransaction, executeReviewTransaction } from "./transaction";
import type { PendingCapture, PendingEdit, StoredData, WorkflowSettings } from "./types";
import {
  ConfirmAbandonModal,
  ConfirmAbandonEditModal,
  ConfirmEditReplacementModal,
  ExistingCaptureModal,
  ExportPickerModal,
  FinishReviewModal,
  GoodnotesSourceLinkModal,
  StartCaptureModal,
  type ExistingCaptureAction,
  type FinishReviewInput,
  type StartCaptureInput
} from "./ui/modals";

export default class GoodnotesWorkflowPlugin extends Plugin {
  settings: WorkflowSettings = DEFAULT_SETTINGS;
  private pendingCapture: PendingCapture | null = null;
  private pendingEdit: PendingEdit | null = null;
  private detectedExportPath: string | null = null;
  private finishInProgress = false;
  private previewTimer: number | undefined;

  async onload(): Promise<void> {
    await this.loadState();
    this.register(() => window.clearTimeout(this.previewTimer));
    this.addSettingTab(new WorkflowSettingTab(this.app, this));
    this.addRibbonIcon("pen-tool", t.ribbonStart, () => void this.startCapture());

    this.addCommand({
      id: "start-handwriting-capture",
      name: t.commandStart,
      editorCallback: () => void this.startCapture()
    });
    this.addCommand({
      id: "resume-handwriting-capture",
      name: t.commandResume,
      checkCallback: (checking) => {
        if (this.pendingCapture === null) return false;
        if (!checking) this.openGoodnotes(this.pendingCapture);
        return true;
      }
    });
    this.addCommand({
      id: "finish-handwriting-capture",
      name: t.commandFinish,
      checkCallback: (checking) => {
        if (this.pendingCapture === null) return false;
        if (!checking) void this.finishCapture();
        return true;
      }
    });
    this.addCommand({
      id: "abandon-handwriting-capture",
      name: t.commandAbandon,
      checkCallback: (checking) => {
        if (this.pendingCapture === null) return false;
        if (!checking) void this.abandonCapture();
        return true;
      }
    });
    this.addCommand({
      id: "edit-goodnotes-artifact",
      name: t.commandEdit,
      callback: () => void this.startEdit()
    });
    this.addCommand({
      id: "resume-goodnotes-edit",
      name: t.commandResumeEdit,
      checkCallback: (checking) => {
        if (this.pendingEdit === null) return false;
        if (!checking) this.openGoodnotesSource(this.pendingEdit.sourceLink);
        return true;
      }
    });
    this.addCommand({
      id: "finish-goodnotes-edit",
      name: t.commandFinishEdit,
      checkCallback: (checking) => {
        if (this.pendingEdit === null) return false;
        if (!checking) void this.finishEdit();
        return true;
      }
    });
    this.addCommand({
      id: "abandon-goodnotes-edit",
      name: t.commandAbandonEdit,
      checkCallback: (checking) => {
        if (this.pendingEdit === null) return false;
        if (!checking) void this.abandonEdit();
        return true;
      }
    });

    this.app.workspace.onLayoutReady(() => this.watchInbox());
  }

  private watchInbox(): void {
    // Obsidian emits "create" for every file while the vault loads. Subscribe after layout
    // ready and look once for an export that arrived while the app was closed.
    const arrived = this.app.vault
      .getFiles()
      .filter((file) => this.isCandidateForPendingCapture(file) || this.isCandidateForPendingEdit(file))
      .sort((left, right) => right.stat.ctime - left.stat.ctime)[0];
    if (arrived !== undefined) this.scheduleDetectedExport(arrived);

    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (file instanceof TFile) this.scheduleDetectedExport(file);
      })
    );
  }

  private scheduleDetectedExport(file: TFile): void {
    const captureCandidate = this.isCandidateForPendingCapture(file);
    const editCandidate = this.isCandidateForPendingEdit(file);
    if (!captureCandidate && !editCandidate) return;
    this.detectedExportPath = file.path;
    new Notice(t.noticeExportDetected);
    window.clearTimeout(this.previewTimer);
    this.previewTimer = window.setTimeout(() => {
      if (captureCandidate && this.pendingCapture !== null && this.detectedExportPath === file.path) {
        void this.finishCapture();
      } else if (editCandidate && this.pendingEdit !== null && this.detectedExportPath === file.path) {
        void this.finishEdit();
      }
    }, 500);
  }

  async persistState(): Promise<void> {
    const data: StoredData = {
      settings: this.settings,
      pendingCapture: this.pendingCapture,
      pendingEdit: this.pendingEdit
    };
    await this.saveData(data);
  }

  private async loadState(): Promise<void> {
    const loaded = (await this.loadData()) as Partial<StoredData> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...(loaded?.settings ?? {}) };
    this.pendingCapture = loaded?.pendingCapture ?? null;
    this.pendingEdit = loaded?.pendingEdit ?? null;
  }

  private async startCapture(): Promise<void> {
    if (this.pendingEdit !== null) {
      new Notice(t.noticeFinishEditFirst);
      return;
    }
    if (this.pendingCapture !== null) {
      const action = await this.openExistingCaptureModal(this.pendingCapture);
      await this.handleExistingCaptureAction(action);
      return;
    }

    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const sourceNote = view?.file;
    if (view === null || !(sourceNote instanceof TFile)) {
      new Notice(t.noticeOpenMarkdown);
      return;
    }

    const sourceContent = await this.app.vault.read(sourceNote);
    const input = await this.openStartModal(sourceNote.path, sourceNote.basename);
    if (input === null) return;

    try {
      await this.ensureInboxFolder();
    } catch (error) {
      new Notice(t.noticeInboxFailed(errorMessage(error)));
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
      new Notice(t.noticeSessionSaveFailed(errorMessage(error)));
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
      new Notice(t.noticeShortcutMissing);
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
    new Notice(t.noticeCaptureAbandoned);
  }

  private async startEdit(): Promise<void> {
    if (this.pendingCapture !== null) {
      new Notice(t.noticeFinishCaptureFirst);
      return;
    }
    if (this.pendingEdit !== null) {
      new Notice(t.noticeEditActive);
      return;
    }

    const target = await this.resolveEditTarget();
    if (target === null) return;
    const sidecarContent = await this.app.vault.read(target.sidecar);
    const provenance = readSidecarProvenance(sidecarContent);
    let sourceLink =
      provenance.sourceLink === null ? null : normalizeGoodnotesSourceLink(provenance.sourceLink);
    if (sourceLink === null) {
      const entered = await this.openSourceLinkModal(provenance.sourceLink ?? "");
      if (entered === null) return;
      sourceLink = normalizeGoodnotesSourceLink(entered);
      if (sourceLink === null) {
        new Notice(t.noticeInvalidLink);
        return;
      }
    }

    const targetHash = binaryHash(await this.app.vault.readBinary(target.artifact));
    this.pendingEdit = {
      id: createCaptureId(),
      targetPath: target.artifact.path,
      targetHash,
      sidecarPath: target.sidecar.path,
      sidecarHash: contentHash(sidecarContent),
      startedAt: Date.now(),
      sourceLink
    };
    this.detectedExportPath = null;
    try {
      await this.persistState();
    } catch (error) {
      this.pendingEdit = null;
      new Notice(t.noticeEditSaveFailed(errorMessage(error)));
      return;
    }
    this.openGoodnotesSource(sourceLink);
  }

  private openGoodnotesSource(sourceLink: string): void {
    window.open(sourceLink, "_blank");
  }

  private async abandonEdit(): Promise<void> {
    const edit = this.pendingEdit;
    if (edit === null) return;
    const confirmed = await this.openConfirmAbandonEditModal(edit);
    if (!confirmed) return;
    this.pendingEdit = null;
    this.detectedExportPath = null;
    await this.persistState();
    new Notice(t.noticeEditAbandoned);
  }

  private async finishEdit(): Promise<void> {
    if (this.finishInProgress) return;
    this.finishInProgress = true;
    try {
      await this.finishEditInternal();
    } finally {
      this.finishInProgress = false;
    }
  }

  private async finishEditInternal(): Promise<void> {
    const edit = this.pendingEdit;
    if (edit === null) {
      new Notice(t.noticeNoEdit);
      return;
    }
    const target = this.app.vault.getAbstractFileByPath(edit.targetPath);
    const sidecar = this.app.vault.getAbstractFileByPath(edit.sidecarPath);
    if (!(target instanceof TFile) || !(sidecar instanceof TFile)) {
      new Notice(t.noticeEditTargetMissing);
      return;
    }

    const candidates = this.findEditExportCandidates(edit, target.extension);
    const replacement = await this.selectExport(candidates, t.pickReplacement);
    if (replacement === null) {
      if (candidates.length === 0) new Notice(t.noticeNoReplacement);
      return;
    }
    if (!extensionsCompatible(target.extension, replacement.extension)) {
      new Notice(t.noticeFormatMismatch);
      return;
    }

    const confirmed = await this.openConfirmEditReplacementModal(target.path, replacement.path);
    if (!confirmed) return;
    const sidecarContent = await this.app.vault.read(sidecar);
    if (contentHash(sidecarContent) !== edit.sidecarHash) {
      new Notice(t.noticeSidecarChanged);
      return;
    }
    const replacementHash = binaryHash(await this.app.vault.readBinary(replacement));
    let updatedSidecar: string;
    try {
      updatedSidecar = updateSidecarAfterEdit(sidecarContent, {
        sourceLink: edit.sourceLink,
        artifactPath: target.path,
        artifactHash: replacementHash,
        editedAt: new Date().toISOString()
      });
      await executeEditReplacementTransaction(this.app, {
        replacement,
        expectedReplacementHash: replacementHash,
        target,
        expectedTargetHash: edit.targetHash,
        sidecar,
        expectedSidecarContent: sidecarContent,
        updatedSidecarContent: updatedSidecar
      });
    } catch (error) {
      new Notice(t.noticeReplaceFailed(errorMessage(error)), 10_000);
      return;
    }

    this.pendingEdit = null;
    this.detectedExportPath = null;
    try {
      await this.persistState();
      new Notice(t.noticeReplaced(target.path));
    } catch (error) {
      new Notice(t.noticeReplacedStateFailed(errorMessage(error)), 10_000);
    }
  }

  private async resolveEditTarget(): Promise<{ artifact: TFile; sidecar: TFile } | null> {
    const active = this.app.workspace.getActiveFile();
    if (!(active instanceof TFile)) {
      new Notice(t.noticeOpenArtifact);
      return null;
    }

    if (isSupportedExport(active.path)) {
      const sidecar = await this.sidecarForArtifact(active);
      if (sidecar !== null) return { artifact: active, sidecar };
    }
    if (active.extension !== "md") {
      new Notice(t.noticeNoSidecar);
      return null;
    }

    const candidates = new Map<string, TFile>();
    const content = await this.app.vault.read(active);
    const provenance = readSidecarProvenance(content);
    if (provenance.artifactPath !== null) {
      const artifact = this.app.vault.getAbstractFileByPath(normalizePath(provenance.artifactPath));
      if (artifact instanceof TFile && isSupportedExport(artifact.path)) candidates.set(artifact.path, artifact);
    }
    for (const extension of ["pdf", "png", "jpg", "jpeg"]) {
      const sibling = this.app.vault.getAbstractFileByPath(`${active.path.slice(0, -3)}.${extension}`);
      if (sibling instanceof TFile) candidates.set(sibling.path, sibling);
    }
    const embeds = this.app.metadataCache.getFileCache(active)?.embeds ?? [];
    for (const embed of embeds) {
      const artifact = this.app.metadataCache.getFirstLinkpathDest(embed.link, active.path);
      if (
        artifact instanceof TFile &&
        isSupportedExport(artifact.path) &&
        (await this.sidecarForArtifact(artifact)) !== null
      ) {
        candidates.set(artifact.path, artifact);
      }
    }

    const files: TFile[] = [];
    for (const candidate of candidates.values()) {
      if ((await this.sidecarForArtifact(candidate)) !== null) files.push(candidate);
    }
    const artifact = await this.selectExport(files, t.pickArtifact);
    if (artifact === null) {
      if (files.length === 0) new Notice(t.noticeNoArtifact);
      return null;
    }
    const sidecar = await this.sidecarForArtifact(artifact);
    return sidecar === null ? null : { artifact, sidecar };
  }

  private async sidecarForArtifact(artifact: TFile): Promise<TFile | null> {
    const sidecarPath = `${artifact.path.slice(0, -(artifact.extension.length + 1))}.md`;
    const sidecar = this.app.vault.getAbstractFileByPath(sidecarPath);
    if (!(sidecar instanceof TFile) || sidecar.extension !== "md") return null;
    const sourceApp: unknown = this.app.metadataCache.getFileCache(sidecar)?.frontmatter?.source_app;
    if (sourceApp === "Goodnotes") return sidecar;
    const content = await this.app.vault.read(sidecar);
    return /^source_app:\s*Goodnotes\s*$/m.test(content) ? sidecar : null;
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
      new Notice(t.noticeNoCapture);
      return;
    }
    const sourceNote = this.app.vault.getAbstractFileByPath(capture.sourcePath);
    if (!(sourceNote instanceof TFile) || sourceNote.extension !== "md") {
      new Notice(t.noticeSourceMissing);
      return;
    }

    const candidates = this.findExportCandidates(capture);
    const attachment = await this.selectExport(candidates);
    if (attachment === null) {
      if (candidates.length === 0) new Notice(t.noticeNoExport);
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
    const sourceLink =
      review.sourceLink.length === 0 ? null : normalizeGoodnotesSourceLink(review.sourceLink);
    if (review.sourceLink.length > 0 && sourceLink === null) {
      new Notice(t.noticeInvalidLink);
      return;
    }

    const currentSourceContent = await this.app.vault.read(sourceNote);
    if (currentSourceContent !== sourceContent) {
      new Notice(t.noticeSourceChanged);
      return;
    }

    const insertionOffset = this.resolveInsertionOffset(
      review,
      capture,
      currentSourceContent,
      activeSourceView
    );
    if (review.insertionMode === "current-cursor" && insertionOffset === null) {
      new Notice(t.noticeSourceInactive);
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
    const attachmentHash = binaryHash(await this.app.vault.readBinary(attachment));
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
            attachmentLink,
            attachmentPath: unique.attachmentPath,
            attachmentHash,
            sourceLink
          })
      });
    } catch (error) {
      new Notice(t.noticeCaptureFailed(errorMessage(error)), 10_000);
      return;
    }

    this.pendingCapture = null;
    this.detectedExportPath = null;
    try {
      await this.persistState();
      new Notice(t.noticeCaptureSaved(unique.attachmentPath));
    } catch (error) {
      new Notice(t.noticeCaptureStateFailed(errorMessage(error)), 10_000);
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

  private findEditExportCandidates(edit: PendingEdit, targetExtension: string): TFile[] {
    const inbox = normalizePath(this.settings.inboxFolder);
    const all = this.app.vault
      .getFiles()
      .filter((file) => file.path.startsWith(`${inbox}/`) && isSupportedExport(file.path))
      .filter((file) => file.path !== edit.targetPath && extensionsCompatible(targetExtension, file.extension))
      .sort((left, right) => right.stat.ctime - left.stat.ctime);

    if (this.detectedExportPath !== null) {
      const detected = all.find((file) => file.path === this.detectedExportPath);
      if (detected !== undefined) return [detected];
    }
    const recent = all.filter((file) => file.stat.ctime >= edit.startedAt - 60_000);
    return recent.length > 0 ? recent : all;
  }

  private isCandidateForPendingEdit(file: TFile): boolean {
    if (this.pendingEdit === null || !isSupportedExport(file.path)) return false;
    const targetExtension = extensionOf(this.pendingEdit.targetPath);
    const inbox = normalizePath(this.settings.inboxFolder);
    return (
      file.path.startsWith(`${inbox}/`) &&
      extensionsCompatible(targetExtension, file.extension) &&
      file.stat.ctime >= this.pendingEdit.startedAt - 60_000
    );
  }

  private async selectExport(
    files: TFile[],
    placeholder = t.pickExport
  ): Promise<TFile | null> {
    if (files.length === 0) return null;
    if (files.length === 1) return files[0] ?? null;
    return await new Promise((resolve) =>
      new ExportPickerModal(this.app, files, resolve, placeholder).open()
    );
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

  private async openSourceLinkModal(initialValue: string): Promise<string | null> {
    return await new Promise((resolve) =>
      new GoodnotesSourceLinkModal(this.app, initialValue, resolve).open()
    );
  }

  private async openConfirmEditReplacementModal(
    targetPath: string,
    replacementPath: string
  ): Promise<boolean> {
    return await new Promise((resolve) =>
      new ConfirmEditReplacementModal(this.app, targetPath, replacementPath, resolve).open()
    );
  }

  private async openConfirmAbandonEditModal(edit: PendingEdit): Promise<boolean> {
    return await new Promise((resolve) =>
      new ConfirmAbandonEditModal(this.app, edit, resolve).open()
    );
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
  return window.crypto?.randomUUID?.() ?? `capture-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function extensionsCompatible(left: string, right: string): boolean {
  const normalize = (value: string): string => {
    const extension = value.toLowerCase();
    return extension === "jpg" || extension === "jpeg" ? "jpeg" : extension;
  };
  return normalize(left) === normalize(right);
}
