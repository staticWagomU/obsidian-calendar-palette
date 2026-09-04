import { App, moment, normalizePath, Notice, TFile } from "obsidian";
import type { DailyNoteEnvironment, VaultEntry } from "./environment";

/**
 * The real environment, wired to a live `App`.
 *
 * Kept to one-line delegations on purpose: this is the only file in the daily
 * note path the test runner cannot reach, so nothing that can branch belongs
 * here. Anything with a decision in it goes in `openDailyNote.ts`.
 */
export function obsidianEnvironment(app: App): DailyNoteEnvironment<TFile> {
	return {
		formatDate: (date, pattern) => moment(date).format(pattern),
		now: () => new Date(),
		normalizePath,

		entryAt(path: string): VaultEntry<TFile> | null {
			// The kind is genuinely unknown here — a folder sitting where the note
			// should go is one of the cases we have to report — so this is the
			// getAbstractFileByPath case rather than the getFileByPath one.
			const entry = app.vault.getAbstractFileByPath(path);
			if (entry instanceof TFile) return { kind: "note", note: entry };
			// Anything else present is an obstruction, so the caller reports it
			// rather than creating over it.
			return entry ? { kind: "folder" } : null;
		},

		async createFolder(path: string): Promise<void> {
			await app.vault.createFolder(path);
		},

		createNote: (path, content) => app.vault.create(path, content),

		async openNote(note: TFile, newTab: boolean): Promise<void> {
			await app.workspace.getLeaf(newTab ? "tab" : false).openFile(note);
		},

		async readTemplate(linkPath: string): Promise<string | null> {
			// getFirstLinkpathDest resolves the template the way a wikilink would,
			// so a setting stored without the ".md" extension still finds the file.
			const file = app.metadataCache.getFirstLinkpathDest(normalizePath(linkPath), "");
			return file ? app.vault.cachedRead(file) : null;
		},

		notify: (message) => {
			new Notice(message);
		},
	};
}
