import {
  App,
  ButtonComponent,
  FuzzySuggestModal,
  Modal,
  Setting,
  TFile
} from "obsidian";
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
    this.setTitle("Начать рукописный ввод");
    let title = this.initialTitle;
    let preferredFormat: CaptureFormat = "png";

    this.contentEl.createEl("p", { text: `Исходная заметка: ${this.sourcePath}` });
    new Setting(this.contentEl).setName("Название").addText((text) =>
      text.setValue(title).onChange((value) => {
        title = value;
      })
    );
    new Setting(this.contentEl).setName("Предпочтительный экспорт").addDropdown((dropdown) =>
      dropdown
        .addOption("png", "PNG — одна визуальная мысль")
        .addOption("pdf", "PDF — полный контекст")
        .addOption("jpeg", "JPEG — фотографический материал")
        .setValue(preferredFormat)
        .onChange((value) => {
          preferredFormat = value as CaptureFormat;
        })
    );

    const actions = this.contentEl.createDiv({ cls: "goodnotes-workflow-actions" });
    new ButtonComponent(actions).setButtonText("Отмена").onClick(() => this.finish(null));
    new ButtonComponent(actions)
      .setButtonText("Начать")
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
    this.setTitle("Рукописная сессия уже активна");
    this.contentEl.createEl("p", { text: this.capture.title });
    this.contentEl.createEl("small", { text: this.capture.sourcePath });
    const actions = this.contentEl.createDiv({ cls: "goodnotes-workflow-actions" });
    new ButtonComponent(actions).setButtonText("Закрыть").onClick(() => this.finish(null));
    new ButtonComponent(actions).setButtonText("Отменить сессию…").setWarning().onClick(() => this.finish("abandon"));
    new ButtonComponent(actions).setButtonText("Завершить").onClick(() => this.finish("finish"));
    new ButtonComponent(actions).setButtonText("Вернуться в Goodnotes").setCta().onClick(() => this.finish("resume"));
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
    this.setTitle("Отменить рукописную сессию?");
    this.contentEl.createEl("p", {
      text: "Удалится только pending-запись. Экспортированные файлы останутся в Inbox."
    });
    this.contentEl.createEl("small", { text: this.capture.sourcePath });
    const actions = this.contentEl.createDiv({ cls: "goodnotes-workflow-actions" });
    new ButtonComponent(actions).setButtonText("Сохранить сессию").onClick(() => this.finish(false));
    new ButtonComponent(actions).setButtonText("Отменить сессию").setWarning().onClick(() => this.finish(true));
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
    placeholder = "Выберите экспорт Goodnotes для review"
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
    this.setTitle("Завершить рукописный ввод");
    let artifact = "Handwriting";
    let context = this.suggestedContext;
    let sourceLink = "";
    let insertionMode: InsertionMode = this.noteChanged
      ? this.canUseCurrentCursor
        ? "current-cursor"
        : "end"
      : "saved-cursor";

    this.contentEl.createEl("p", { text: `Исходная заметка: ${this.sourcePath}` });
    this.contentEl.createEl("p", { text: `Экспорт: ${this.exportPath}` });
    if (this.noteChanged) {
      this.contentEl.createEl("p", {
        cls: "goodnotes-workflow-warning",
        text: "Исходная заметка изменилась, пока Goodnotes был открыт. Явно выберите место вставки."
      });
    }

    const preview = this.contentEl.createDiv({ cls: "goodnotes-workflow-preview" });
    const refreshPreview = (): void => {
      preview.setText(this.previewPath(artifact, context));
    };

    new Setting(this.contentEl).setName("Тип артефакта").addText((text) =>
      text.setValue(artifact).onChange((value) => {
        artifact = value;
        refreshPreview();
      })
    );
    new Setting(this.contentEl).setName("Контекст").addText((text) =>
      text.setValue(context).onChange((value) => {
        context = value;
        refreshPreview();
      })
    );
    new Setting(this.contentEl)
      .setName("Ссылка на исходник Goodnotes")
      .setDesc("Необязательно. На Essential share link доступен любому, у кого есть ссылка.")
      .addText((text) =>
        text.setPlaceholder("https://share.goodnotes.com/...").onChange((value) => {
          sourceLink = value;
        })
      );
    new Setting(this.contentEl).setName("Вставка в исходную заметку").addDropdown((dropdown) => {
      if (!this.noteChanged) dropdown.addOption("saved-cursor", "Сохранённая позиция курсора");
      if (this.canUseCurrentCursor) dropdown.addOption("current-cursor", "Текущая позиция курсора");
      dropdown.addOption("end", "Конец заметки").addOption("sidecar-only", "Только sidecar");
      dropdown.setValue(insertionMode).onChange((value) => {
        insertionMode = value as InsertionMode;
      });
    });

    refreshPreview();
    const actions = this.contentEl.createDiv({ cls: "goodnotes-workflow-actions" });
    new ButtonComponent(actions).setButtonText("Отмена").onClick(() => this.finish(null));
    new ButtonComponent(actions)
      .setButtonText("Подтвердить")
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
    this.setTitle("Связать с исходником Goodnotes");
    let sourceLink = this.initialValue;
    this.contentEl.createEl("p", {
      cls: "goodnotes-workflow-warning",
      text: "Goodnotes Essential создаёт публичную share link: документ доступен любому, у кого есть ссылка."
    });
    new Setting(this.contentEl).setName("Goodnotes share link").addText((text) =>
      text
        .setPlaceholder("https://share.goodnotes.com/...")
        .setValue(sourceLink)
        .onChange((value) => {
          sourceLink = value;
        })
    );
    const actions = this.contentEl.createDiv({ cls: "goodnotes-workflow-actions" });
    new ButtonComponent(actions).setButtonText("Отмена").onClick(() => this.finish(null));
    new ButtonComponent(actions)
      .setButtonText("Открыть исходник")
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
    this.setTitle("Заменить экспорт Goodnotes?");
    this.contentEl.createEl("p", { text: `Текущий файл: ${this.targetPath}` });
    this.contentEl.createEl("p", { text: `Новый экспорт: ${this.replacementPath}` });
    this.contentEl.createEl("p", {
      cls: "goodnotes-workflow-warning",
      text: "После подтверждения текущий файл будет полностью заменён. Постоянная копия предыдущей версии не сохраняется."
    });
    const actions = this.contentEl.createDiv({ cls: "goodnotes-workflow-actions" });
    new ButtonComponent(actions).setButtonText("Отмена").onClick(() => this.finish(false));
    new ButtonComponent(actions).setButtonText("Заменить").setWarning().onClick(() => this.finish(true));
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
    this.setTitle("Отменить редактирование в Goodnotes?");
    this.contentEl.createEl("p", {
      text: "Удалится только pending-запись. Текущий артефакт и файлы в Inbox останутся без изменений."
    });
    this.contentEl.createEl("small", { text: this.edit.targetPath });
    const actions = this.contentEl.createDiv({ cls: "goodnotes-workflow-actions" });
    new ButtonComponent(actions).setButtonText("Сохранить сессию").onClick(() => this.finish(false));
    new ButtonComponent(actions).setButtonText("Отменить сессию").setWarning().onClick(() => this.finish(true));
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
