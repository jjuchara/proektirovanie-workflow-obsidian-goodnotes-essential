import {
  App,
  ButtonComponent,
  FuzzySuggestModal,
  Modal,
  Setting,
  TFile
} from "obsidian";
import { t } from "../i18n";
import type { CaptureFormat, InsertionMode, PendingCapture, PendingEdit } from "../types";

export interface StartCaptureInput {
  title: string;
  preferredFormat: CaptureFormat;
}

export class StartCaptureModal extends Modal {
  private settled = false;

  constructor(
    app: App,
    private readonly sourcePath: string,
    private readonly initialTitle: string,
    private readonly resolve: (value: StartCaptureInput | null) => void
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(t.startTitle);
    let title = this.initialTitle;
    let preferredFormat: CaptureFormat = "png";

    this.contentEl.createEl("p", { text: t.sourceNote(this.sourcePath) });
    new Setting(this.contentEl).setName(t.title).addText((text) =>
      text.setValue(title).onChange((value) => {
        title = value;
      })
    );
    new Setting(this.contentEl).setName(t.preferredExport).addDropdown((dropdown) =>
      dropdown
        .addOption("png", t.formatPng)
        .addOption("pdf", t.formatPdf)
        .addOption("jpeg", t.formatJpeg)
        .setValue(preferredFormat)
        .onChange((value) => {
          preferredFormat = value as CaptureFormat;
        })
    );

    const actions = this.contentEl.createDiv({ cls: "goodnotes-workflow-actions" });
    new ButtonComponent(actions).setButtonText(t.cancel).onClick(() => this.finish(null));
    new ButtonComponent(actions)
      .setButtonText(t.start)
      .setCta()
      .onClick(() => this.finish({ title: title.trim() || this.initialTitle, preferredFormat }));
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.settled) this.resolve(null);
  }

  private finish(value: StartCaptureInput | null): void {
    this.settled = true;
    this.resolve(value);
    this.close();
  }
}

export type ExistingCaptureAction = "resume" | "finish" | "abandon";

export class ExistingCaptureModal extends Modal {
  private settled = false;

  constructor(
    app: App,
    private readonly capture: PendingCapture,
    private readonly resolve: (value: ExistingCaptureAction | null) => void
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(t.existingTitle);
    this.contentEl.createEl("p", { text: this.capture.title });
    this.contentEl.createEl("small", { text: this.capture.sourcePath });
    const actions = this.contentEl.createDiv({ cls: "goodnotes-workflow-actions" });
    new ButtonComponent(actions).setButtonText(t.close).onClick(() => this.finish(null));
    warningButton(actions, t.abandonSessionEllipsis).onClick(() => this.finish("abandon"));
    new ButtonComponent(actions).setButtonText(t.finish).onClick(() => this.finish("finish"));
    new ButtonComponent(actions).setButtonText(t.returnToGoodnotes).setCta().onClick(() => this.finish("resume"));
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.settled) this.resolve(null);
  }

  private finish(value: ExistingCaptureAction | null): void {
    this.settled = true;
    this.resolve(value);
    this.close();
  }
}

export class ConfirmAbandonModal extends Modal {
  private settled = false;

  constructor(
    app: App,
    private readonly capture: PendingCapture,
    private readonly resolve: (value: boolean) => void
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(t.abandonCaptureTitle);
    this.contentEl.createEl("p", {
      text: t.abandonCaptureBody
    });
    this.contentEl.createEl("small", { text: this.capture.sourcePath });
    const actions = this.contentEl.createDiv({ cls: "goodnotes-workflow-actions" });
    new ButtonComponent(actions).setButtonText(t.keepSession).onClick(() => this.finish(false));
    warningButton(actions, t.abandonSession).onClick(() => this.finish(true));
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.settled) this.resolve(false);
  }

  private finish(value: boolean): void {
    this.settled = true;
    this.resolve(value);
    this.close();
  }
}

export class ExportPickerModal extends FuzzySuggestModal<TFile> {
  private settled = false;

  constructor(
    app: App,
    private readonly files: TFile[],
    private readonly resolve: (value: TFile | null) => void,
    placeholder = t.pickExport
  ) {
    super(app);
    this.setPlaceholder(placeholder);
  }

  getItems(): TFile[] {
    return this.files;
  }

  getItemText(item: TFile): string {
    return item.path;
  }

  onChooseItem(item: TFile): void {
    this.settled = true;
    this.resolve(item);
  }

  onClose(): void {
    super.onClose();
    if (!this.settled) this.resolve(null);
  }
}

export interface FinishReviewInput {
  artifact: string;
  context: string;
  insertionMode: InsertionMode;
  sourceLink: string;
}

export class FinishReviewModal extends Modal {
  private settled = false;

  constructor(
    app: App,
    private readonly sourcePath: string,
    private readonly exportPath: string,
    private readonly suggestedContext: string,
    private readonly noteChanged: boolean,
    private readonly canUseCurrentCursor: boolean,
    private readonly previewPath: (artifact: string, context: string) => string,
    private readonly resolve: (value: FinishReviewInput | null) => void
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(t.finishTitle);
    let artifact = "Handwriting";
    let context = this.suggestedContext;
    let sourceLink = "";
    let insertionMode: InsertionMode = this.noteChanged
      ? this.canUseCurrentCursor
        ? "current-cursor"
        : "end"
      : "saved-cursor";

    this.contentEl.createEl("p", { text: t.sourceNote(this.sourcePath) });
    this.contentEl.createEl("p", { text: t.exportPath(this.exportPath) });
    if (this.noteChanged) {
      this.contentEl.createEl("p", {
        cls: "goodnotes-workflow-warning",
        text: t.noteChangedWarning
      });
    }

    const preview = this.contentEl.createDiv({ cls: "goodnotes-workflow-preview" });
    const refreshPreview = (): void => {
      preview.setText(this.previewPath(artifact, context));
    };

    new Setting(this.contentEl).setName(t.artifactType).addText((text) =>
      text.setValue(artifact).onChange((value) => {
        artifact = value;
        refreshPreview();
      })
    );
    new Setting(this.contentEl).setName(t.context).addText((text) =>
      text.setValue(context).onChange((value) => {
        context = value;
        refreshPreview();
      })
    );
    new Setting(this.contentEl)
      .setName(t.sourceLink)
      .setDesc(t.sourceLinkDesc)
      .addText((text) =>
        text.setPlaceholder(t.shareLinkPlaceholder).onChange((value) => {
          sourceLink = value;
        })
      );
    new Setting(this.contentEl).setName(t.insertion).addDropdown((dropdown) => {
      if (!this.noteChanged) dropdown.addOption("saved-cursor", t.insertionSavedCursor);
      if (this.canUseCurrentCursor) dropdown.addOption("current-cursor", t.insertionCurrentCursor);
      dropdown.addOption("end", t.insertionEnd).addOption("sidecar-only", t.insertionSidecarOnly);
      dropdown.setValue(insertionMode).onChange((value) => {
        insertionMode = value as InsertionMode;
      });
    });

    refreshPreview();
    const actions = this.contentEl.createDiv({ cls: "goodnotes-workflow-actions" });
    new ButtonComponent(actions).setButtonText(t.cancel).onClick(() => this.finish(null));
    new ButtonComponent(actions)
      .setButtonText(t.confirm)
      .setCta()
      .onClick(() =>
        this.finish({
          artifact: artifact.trim() || "Handwriting",
          context: context.trim() || this.suggestedContext,
          insertionMode,
          sourceLink: sourceLink.trim()
        })
      );
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.settled) this.resolve(null);
  }

  private finish(value: FinishReviewInput | null): void {
    this.settled = true;
    this.resolve(value);
    this.close();
  }
}

export class GoodnotesSourceLinkModal extends Modal {
  private settled = false;

  constructor(
    app: App,
    private readonly initialValue: string,
    private readonly resolve: (value: string | null) => void
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(t.linkTitle);
    let sourceLink = this.initialValue;
    this.contentEl.createEl("p", {
      cls: "goodnotes-workflow-warning",
      text: t.linkWarning
    });
    new Setting(this.contentEl).setName(t.shareLink).addText((text) =>
      text
        .setPlaceholder(t.shareLinkPlaceholder)
        .setValue(sourceLink)
        .onChange((value) => {
          sourceLink = value;
        })
    );
    const actions = this.contentEl.createDiv({ cls: "goodnotes-workflow-actions" });
    new ButtonComponent(actions).setButtonText(t.cancel).onClick(() => this.finish(null));
    new ButtonComponent(actions)
      .setButtonText(t.openOriginal)
      .setCta()
      .onClick(() => this.finish(sourceLink.trim()));
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.settled) this.resolve(null);
  }

  private finish(value: string | null): void {
    this.settled = true;
    this.resolve(value);
    this.close();
  }
}

export class ConfirmEditReplacementModal extends Modal {
  private settled = false;

  constructor(
    app: App,
    private readonly targetPath: string,
    private readonly replacementPath: string,
    private readonly resolve: (value: boolean) => void
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(t.replaceTitle);
    this.contentEl.createEl("p", { text: t.currentFile(this.targetPath) });
    this.contentEl.createEl("p", { text: t.newExport(this.replacementPath) });
    this.contentEl.createEl("p", {
      cls: "goodnotes-workflow-warning",
      text: t.replaceWarning
    });
    const actions = this.contentEl.createDiv({ cls: "goodnotes-workflow-actions" });
    new ButtonComponent(actions).setButtonText(t.cancel).onClick(() => this.finish(false));
    warningButton(actions, t.replace).onClick(() => this.finish(true));
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.settled) this.resolve(false);
  }

  private finish(value: boolean): void {
    this.settled = true;
    this.resolve(value);
    this.close();
  }
}

export class ConfirmAbandonEditModal extends Modal {
  private settled = false;

  constructor(
    app: App,
    private readonly edit: PendingEdit,
    private readonly resolve: (value: boolean) => void
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(t.abandonEditTitle);
    this.contentEl.createEl("p", {
      text: t.abandonEditBody
    });
    this.contentEl.createEl("small", { text: this.edit.targetPath });
    const actions = this.contentEl.createDiv({ cls: "goodnotes-workflow-actions" });
    new ButtonComponent(actions).setButtonText(t.keepSession).onClick(() => this.finish(false));
    warningButton(actions, t.abandonSession).onClick(() => this.finish(true));
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.settled) this.resolve(false);
  }

  private finish(value: boolean): void {
    this.settled = true;
    this.resolve(value);
    this.close();
  }
}

// ButtonComponent.setWarning() is deprecated, and its replacement setDestructive() needs Obsidian 1.13.
function warningButton(container: HTMLElement, text: string): ButtonComponent {
  const button = new ButtonComponent(container).setButtonText(text);
  button.buttonEl.addClass("mod-warning");
  return button;
}
