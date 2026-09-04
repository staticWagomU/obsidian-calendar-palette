import { DEFAULT_TIME_FORMAT, type DailyNoteConfig } from "./coreSettings";
import type { DailyNoteEnvironment } from "./environment";
import { resolveDailyNotePath } from "./notePath";
import { applyTemplate } from "./template";

export interface OpenDailyNoteOptions {
	/** Open in a new tab instead of reusing the active leaf. */
	newTab: boolean;
	/** Ask before creating a note that does not exist yet. */
	confirmBeforeCreate: boolean;
	/** Presents the confirmation and resolves to the user's answer. */
	confirm: (path: string) => Promise<boolean>;
}

/** Normalised vault path the daily note for `date` would live at. */
export function dailyNotePath(
	date: Date,
	config: DailyNoteConfig,
	env: DailyNoteEnvironment,
): string {
	const formatted = env.formatDate(date, config.format);
	return env.normalizePath(resolveDailyNotePath(config.folder, formatted).path);
}

/** Whether a daily note for `date` has been created yet. */
export function hasDailyNote(
	date: Date,
	config: DailyNoteConfig,
	env: DailyNoteEnvironment,
): boolean {
	return env.entryAt(dailyNotePath(date, config, env))?.kind === "note";
}

/**
 * Opens the daily note for `date`, creating it first when it does not exist.
 *
 * Returns false when the user declined to create a missing note, so the caller
 * can keep the calendar open instead of dismissing it on a no-op.
 */
export async function openDailyNote<TNote>(
	date: Date,
	config: DailyNoteConfig,
	env: DailyNoteEnvironment<TNote>,
	options: OpenDailyNoteOptions,
): Promise<boolean> {
	const formatted = env.formatDate(date, config.format);
	const { path, ancestorFolders } = resolveDailyNotePath(config.folder, formatted);
	const notePath = env.normalizePath(path);

	const existing = env.entryAt(notePath);
	if (existing && existing.kind !== "note") {
		env.notify(`A folder already exists at ${notePath}.`);
		return false;
	}

	let note = existing?.note;
	if (note === undefined) {
		if (options.confirmBeforeCreate && !(await options.confirm(notePath))) return false;
		try {
			note = await createDailyNote(date, config, env, notePath, ancestorFolders);
		} catch (error) {
			console.error("Calendar palette: failed to create daily note", error);
			env.notify(`Could not create ${notePath}.`);
			return false;
		}
	}

	await env.openNote(note, options.newTab);
	return true;
}

async function createDailyNote<TNote>(
	date: Date,
	config: DailyNoteConfig,
	env: DailyNoteEnvironment<TNote>,
	notePath: string,
	ancestorFolders: string[],
): Promise<TNote> {
	for (const folder of ancestorFolders) {
		const normalized = env.normalizePath(folder);
		const existing = env.entryAt(normalized);
		// Vault.create does not create missing parents, so walk them outermost first.
		if (!existing) await env.createFolder(normalized);
		else if (existing.kind !== "folder") {
			throw new Error(`${normalized} exists but is not a folder`);
		}
	}

	return env.createNote(notePath, await renderTemplate(date, config, env, notePath));
}

async function renderTemplate(
	date: Date,
	config: DailyNoteConfig,
	env: DailyNoteEnvironment,
	notePath: string,
): Promise<string> {
	if (!config.template) return "";

	const raw = await env.readTemplate(config.template);
	if (raw === null) {
		env.notify(`Daily note template not found: ${config.template}`);
		return "";
	}

	const now = env.now();
	return applyTemplate(raw, {
		formatDate: (pattern) => env.formatDate(date, pattern),
		formatTime: (pattern) => env.formatDate(now, pattern),
		dateFormat: config.format,
		timeFormat: DEFAULT_TIME_FORMAT,
		title: basenameOf(notePath),
	});
}

/** The note's filename without its folders or its `.md` extension. */
function basenameOf(notePath: string): string {
	return notePath.split("/").pop()?.replace(/\.md$/, "") ?? "";
}
