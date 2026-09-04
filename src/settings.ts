import { PluginSettingTab, type SettingDefinitionItem } from "obsidian";
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
	mutedWeekdays: boolean;
	dimNoteDotOutsideMonth: boolean;
}

export const DEFAULT_SETTINGS: CalendarPaletteSettings = {
	weekStart: "locale",
	confirmBeforeCreate: true,
	titleMode: "title-left",
	monthTransition: "slide",
	keymap: "default",
	// Both default to on because both defaults they replace are defects, not
	// tastes: --text-faint puts the weekday headers at about 2.3:1, under the
	// 4.5:1 WCAG AA floor, and an adjacent-month day drawing its dot brighter
	// than its own number inverts the emphasis the greying was for.
	mutedWeekdays: true,
	dimNoteDotOutsideMonth: true,
};

/** Every control binds to one of these, which is what the base class stores. */
type SettingKey = keyof CalendarPaletteSettings;

/**
 * Declared rather than built in `display()`, because from Obsidian 1.13 the
 * settings search indexes these definitions: a tab that only creates its rows
 * imperatively is unreachable from the search box. Reading and persisting each
 * `key` against `plugin.settings` is the base class's job, so there is no
 * onChange to write here and no way for a control to drift from its storage.
 */
export class CalendarPaletteSettingTab extends PluginSettingTab {
	override getSettingDefinitions(): SettingDefinitionItem<SettingKey>[] {
		return [
			{
				name: "First day of the week",
				desc: "Which column the calendar starts on.",
				control: {
					type: "dropdown",
					key: "weekStart",
					options: {
						locale: "Follow locale",
						sunday: "Sunday",
						monday: "Monday",
					},
				},
			},
			{
				name: "Confirm before creating a note",
				desc: "Ask before creating a daily note that does not exist yet.",
				control: { type: "toggle", key: "confirmBeforeCreate" },
			},
			{
				type: "group",
				heading: "Keyboard",
				items: [
					{
						name: "Key bindings",
						desc:
							"Extra keys layered on top of the arrows, which always work. " +
							"Vim: h j k l, Ctrl+B/Ctrl+F by month, add Shift for a year. " +
							"Emacs: Ctrl+B/F/P/N, Ctrl+V and Alt+V by month, add Shift for a year, . for today.",
						// The names a user searching the settings would type; none of
						// them appear in the name or the description above.
						aliases: ["vim", "emacs", "hjkl", "shortcut"],
						control: {
							type: "dropdown",
							key: "keymap",
							options: {
								default: "Arrows only",
								vim: "Vim",
								emacs: "Emacs",
							},
						},
					},
				],
			},
			{
				type: "group",
				heading: "Appearance",
				items: [
					{
						name: "Modal title",
						desc: "Where the month is written, and what the modal's title says.",
						control: {
							type: "dropdown",
							key: "titleMode",
							options: {
								"title-left": "Month as title, left",
								"title-center": "Month as title, centred",
								"month-only": "No title, centred month line",
								calendar: "Fixed title plus a month line",
							},
						},
					},
					{
						name: "Month transition",
						desc: "How the grid moves when you page from one month to the next.",
						aliases: ["animation", "motion"],
						control: {
							type: "dropdown",
							key: "monthTransition",
							options: {
								slide: "Slide — full height, directional",
								soft: "Slide — short throw, heavier fade",
								none: "None",
							},
						},
					},
					{
						name: "Higher contrast weekday headers",
						desc:
							"Draw the weekday abbreviations and the hint line at the muted text " +
							"colour, which clears the WCAG AA contrast threshold. Turn off for the fainter look.",
						aliases: ["accessibility", "contrast"],
						control: { type: "toggle", key: "mutedWeekdays" },
					},
					{
						name: "Dim the note dot on adjacent-month days",
						desc:
							"Match the dot to the greyed-out date it belongs to, so a neighbouring " +
							"month does not draw the eye more than the month you are in.",
						control: { type: "toggle", key: "dimNoteDotOutsideMonth" },
					},
				],
			},
		];
	}
}
