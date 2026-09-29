import { App, PluginSettingTab, Setting } from "obsidian";
import { t } from "./i18n";
import type GoodnotesWorkflowPlugin from "./main";
import type { WorkflowSettings } from "./types";

export const DEFAULT_SETTINGS: WorkflowSettings = {
  inboxFolder: "Inbox/Goodnotes",
  projectsFolder: "Projects",
  areasFolder: "Areas",
  resourcesFolder: "Resources",
  archivesFolder: "Archives",
  startShortcutName: "Start Goodnotes Handwriting"
};

export class WorkflowSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: GoodnotesWorkflowPlugin) {
    super(app, plugin);
  }

  display(): void {
    this.containerEl.empty();
    this.addTextSetting(t.settingInbox, t.settingInboxDesc, "inboxFolder");
    this.addTextSetting(t.settingProjects, t.settingProjectsDesc, "projectsFolder");
    this.addTextSetting(t.settingAreas, t.settingAreasDesc, "areasFolder");
    this.addTextSetting(t.settingResources, t.settingResourcesDesc, "resourcesFolder");
    this.addTextSetting(t.settingArchives, t.settingArchivesDesc, "archivesFolder");
    this.addTextSetting(t.settingShortcut, t.settingShortcutDesc, "startShortcutName");
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
