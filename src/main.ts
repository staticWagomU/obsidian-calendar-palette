import { Plugin } from "obsidian";
import { registerCommands } from "./commands";
import {
	CalendarPaletteSettingTab,
	DEFAULT_SETTINGS,
	type CalendarPaletteSettings,
} from "./settings";

export default class CalendarPalettePlugin extends Plugin {
	// Assigned in loadSettings() during onload(), which Obsidian always runs
	// before anything can reach this field.
	settings!: CalendarPaletteSettings;

	async onload() {
		await this.loadSettings();
		registerCommands(this);
		this.addSettingTab(new CalendarPaletteSettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<CalendarPaletteSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
