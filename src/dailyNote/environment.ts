/**
 * Everything opening a daily note needs from Obsidian, stated as one interface.
 *
 * The point is that `openDailyNote.ts` decides *what* to do — create or open,
 * ask or not, which message to show — while an adapter decides *how*. That
 * split is what makes the decisions testable: `obsidian` ships types with no
 * runtime, so a module importing a value from it is unreachable from the test
 * runner. The same reason `template.ts` takes its formatters as arguments.
 *
 * `TNote` is whatever the environment uses to identify a note — a `TFile` for
 * the real one, a string for a fake. It is threaded through rather than looked
 * up again by path so that creating a note and opening it stay one continuous
 * handle, exactly as the direct `Vault` calls did.
 */

export type VaultEntry<TNote> = { kind: "note"; note: TNote } | { kind: "folder" };

export interface DailyNoteEnvironment<TNote = unknown> {
	/** Renders `date` with a moment pattern. */
	formatDate(date: Date, pattern: string): string;
	/**
	 * The current instant. Read once per note and then formatted, so a template
	 * with two `{{time}}` placeholders cannot straddle a minute boundary.
	 */
	now(): Date;
	/** Cleans a constructed path to the vault's conventions. */
	normalizePath(path: string): string;
	/** What occupies `path` right now, or null when nothing does. */
	entryAt(path: string): VaultEntry<TNote> | null;
	/** Creates one folder. Parents are the caller's problem, as in `Vault`. */
	createFolder(path: string): Promise<void>;
	createNote(path: string, content: string): Promise<TNote>;
	openNote(note: TNote, newTab: boolean): Promise<void>;
	/** Raw template text, or null when the configured template cannot be found. */
	readTemplate(linkPath: string): Promise<string | null>;
	/** Shows a transient message to the user. */
	notify(message: string): void;
}
