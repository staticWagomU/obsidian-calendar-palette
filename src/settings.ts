import { App, PluginSettingTab, Setting } from "obsidian";
import type CalendarPalettePlugin from "./main";
import type { KeymapMode } from "./ui/keymap";

/** Which column the calendar grid starts on. */
export type WeekStart = "locale" | "sunday" | "monday";

export interface CalendarPaletteSettings {
	weekStart: WeekStart;
	confirmBeforeCreate: boolean;
	keymap: KeymapMode;
}

export const DEFAULT_SETTINGS: CalendarPaletteSettings = {
	weekStart: "locale",
	confirmBeforeCreate: true,
	keymap: "default",
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

		new Setting(containerEl).setName("Keyboard").setHeading();

		new Setting(containerEl)
			.setName("Key bindings")
			.setDesc(
				"Extra keys layered on top of the arrows, which always work. " +
					"Vim: h j k l, Ctrl+B/Ctrl+F by month, add Shift for a year. " +
					"Emacs: Ctrl+B/F/P/N, Ctrl+V and Alt+V by month, add Shift for a year, . for today.",
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption("default", "Arrows only")
					.addOption("vim", "Vim")
					.addOption("emacs", "Emacs")
					.setValue(this.plugin.settings.keymap)
					.onChange(async (value) => {
						this.plugin.settings.keymap = value as KeymapMode;
						await this.plugin.saveSettings();
					}),
			);
	}
}
