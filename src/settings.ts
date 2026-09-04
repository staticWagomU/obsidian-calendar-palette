import { App, PluginSettingTab, Setting } from "obsidian";
import type CalendarPalettePlugin from "./main";

/** Which column the calendar grid starts on. */
export type WeekStart = "locale" | "sunday" | "monday";

export interface CalendarPaletteSettings {
	weekStart: WeekStart;
	confirmBeforeCreate: boolean;
}

export const DEFAULT_SETTINGS: CalendarPaletteSettings = {
	weekStart: "locale",
	confirmBeforeCreate: true,
};

export class CalendarPaletteSettingTab extends PluginSettingTab {
	plugin: CalendarPalettePlugin;

	constructor(app: App, plugin: CalendarPalettePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("First day of the week")
			.setDesc("Which column the calendar starts on.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("locale", "Follow locale")
					.addOption("sunday", "Sunday")
					.addOption("monday", "Monday")
					.setValue(this.plugin.settings.weekStart)
					.onChange(async (value) => {
						this.plugin.settings.weekStart = value as WeekStart;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Confirm before creating a note")
			.setDesc("Ask before creating a daily note that does not exist yet.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.confirmBeforeCreate)
					.onChange(async (value) => {
						this.plugin.settings.confirmBeforeCreate = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
