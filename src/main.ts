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
		// loadData() は data.json の中身をそのまま `any` で返す。それを
		// Partial<CalendarPaletteSettings> と主張すると、壊れた data.json を
		// 型検査を素通りさせてしまう。unknown で受けて既定値の上に重ねるだけに
		// すれば、実行時の挙動は変えずに嘘の型注釈だけを消せる。
		const stored: unknown = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, stored);
	}
}
