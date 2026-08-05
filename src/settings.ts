import { App, PluginSettingTab, Setting } from "obsidian";
import type GoodnotesWorkflowPlugin from "./main";
import type { WorkflowSettings } from "./types";

export const DEFAULT_SETTINGS: WorkflowSettings = {
  inboxFolder: "6. Inbox/Handwriting/Goodnotes",
  projectsFolder: "1. Projects",
  areasFolder: "2. Areas",
  resourcesFolder: "3. Resources",
  archivesFolder: "4. Archives",
  startShortcutName: "Start Goodnotes Handwriting"
};

export class WorkflowSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: GoodnotesWorkflowPlugin) {
    super(app, plugin);
  }

  display(): void {
    this.containerEl.empty();
    this.containerEl.createEl("h2", { text: "Goodnotes Handwriting Workflow" });
    this.addTextSetting("Папка Inbox", "Сюда поступают PDF и изображения до review.", "inboxFolder");
    this.addTextSetting("Папка проектов", "Корневая PARA-папка проектов.", "projectsFolder");
    this.addTextSetting("Папка областей", "Корневая PARA-папка областей.", "areasFolder");
    this.addTextSetting("Папка ресурсов", "Корневая PARA-папка ресурсов.", "resourcesFolder");
    this.addTextSetting("Папка архива", "Корневая PARA-папка архива.", "archivesFolder");
    this.addTextSetting(
      "Имя стартового Shortcut",
      "Apple Shortcut, который запускается при начале рукописной сессии.",
      "startShortcutName"
    );
  }

  private addTextSetting(
    name: string,
    description: string,
    key: keyof WorkflowSettings
  ): void {
    new Setting(this.containerEl)
      .setName(name)
      .setDesc(description)
      .addText((text) =>
        text.setValue(this.plugin.settings[key]).onChange(async (value) => {
          this.plugin.settings[key] = value.trim();
          await this.plugin.persistState();
        })
      );
  }
}
