import { Notice } from "obsidian";
import { getDailyNoteConfig, isDailyNotesPluginEnabled } from "../dailyNote/coreSettings";
import { findDailyNote, openDailyNote } from "../dailyNote/openDailyNote";
import type CalendarPalettePlugin from "../main";
import { CalendarModal } from "../ui/CalendarModal";
import { confirmCreateNote } from "../ui/ConfirmModal";

export function registerCommands(plugin: CalendarPalettePlugin): void {
	plugin.addCommand({
		// Stable ID: renaming it would break every user's custom hotkey.
		id: "open-calendar",
		name: "Open calendar",
		callback: () => openCalendar(plugin),
	});
}

function openCalendar(plugin: CalendarPalettePlugin): void {
	const { app } = plugin;

	if (!isDailyNotesPluginEnabled(app)) {
		new Notice(
			"Daily notes is turned off, so the default folder and date format will be used.",
		);
	}

	// Read once per open: the grid consults it for all 42 cells, and settings
	// cannot change while the modal is up.
	const config = getDailyNoteConfig(app);

	new CalendarModal(app, {
		weekStart: plugin.settings.weekStart,
		titleMode: plugin.settings.titleMode,
		monthTransition: plugin.settings.monthTransition,
		keymap: plugin.settings.keymap,
		mutedWeekdays: plugin.settings.mutedWeekdays,
		dimNoteDotOutsideMonth: plugin.settings.dimNoteDotOutsideMonth,
		hasNote: (date) => findDailyNote(app, date, config) !== null,
		onPick: (date, newTab) => {
			void openDailyNote(app, date, {
				newTab,
				confirmBeforeCreate: plugin.settings.confirmBeforeCreate,
				confirm: (path) => confirmCreateNote(app, path),
			});
		},
	}).open();
}
