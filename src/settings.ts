import { App, PluginSettingTab, Setting } from "obsidian";
import type CalendarPalettePlugin from "./main";
import type { KeymapMode } from "./ui/keymap";

/** Which column the calendar grid starts on. */
export type WeekStart = "locale" | "sunday" | "monday";

/** Where the month is written, and what the modal's own title says. */
export type TitleMode = "title-left" | "title-center" | "month-only" | "calendar";

/** How one month gives way to the next. */
export type MonthTransition = "slide" | "soft" | "none";

export interface CalendarPaletteSettings {
	weekStart: WeekStart;
	confirmBeforeCreate: boolean;
	titleMode: TitleMode;
	monthTransition: MonthTransition;
	keymap: KeymapMode;
}

export const DEFAULT_SETTINGS: CalendarPaletteSettings = {
	weekStart: "locale",
	confirmBeforeCreate: true,
	titleMode: "title-left",
	monthTransition: "slide",
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

		new Setting(containerEl).setName("Appearance").setHeading();

		new Setting(containerEl)
			.setName("Modal title")
			.setDesc("Where the month is written, and what the modal's title says.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("title-left", "Month as title, left")
					.addOption("title-center", "Month as title, centred")
					.addOption("month-only", "No title, centred month line")
					.addOption("calendar", "Fixed title plus a month line")
					.setValue(this.plugin.settings.titleMode)
					.onChange(async (value) => {
						this.plugin.settings.titleMode = value as TitleMode;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Month transition")
			.setDesc("How the grid moves when you page from one month to the next.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("slide", "Slide — full height, directional")
					.addOption("soft", "Slide — short throw, heavier fade")
					.addOption("none", "None")
					.setValue(this.plugin.settings.monthTransition)
					.onChange(async (value) => {
						this.plugin.settings.monthTransition = value as MonthTransition;
						await this.plugin.saveSettings();
					}),
			);
	}
}
