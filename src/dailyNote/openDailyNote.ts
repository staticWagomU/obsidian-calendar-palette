import { App, normalizePath, Notice, TFile, TFolder, moment } from "obsidian";
import { DEFAULT_TIME_FORMAT, getDailyNoteConfig, type DailyNoteConfig } from "./coreSettings";
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
export function dailyNotePath(date: Date, config: DailyNoteConfig): string {
	const formatted = moment(date).format(config.format);
	return normalizePath(resolveDailyNotePath(config.folder, formatted).path);
}

/** The existing daily note for `date`, or null when it has not been created yet. */
export function findDailyNote(app: App, date: Date, config: DailyNoteConfig): TFile | null {
	const file = app.vault.getAbstractFileByPath(dailyNotePath(date, config));
	return file instanceof TFile ? file : null;
}

/**
 * Opens the daily note for `date`, creating it first when it does not exist.
 *
 * Returns false when the user declined to create a missing note, so the caller
 * can keep the calendar open instead of dismissing it on a no-op.
 */
export async function openDailyNote(
	app: App,
	date: Date,
	options: OpenDailyNoteOptions,
): Promise<boolean> {
	const config = getDailyNoteConfig(app);
	const formatted = moment(date).format(config.format);
	const { path, ancestorFolders } = resolveDailyNotePath(config.folder, formatted);
	const notePath = normalizePath(path);

	const existing = app.vault.getAbstractFileByPath(notePath);
	if (existing && !(existing instanceof TFile)) {
		new Notice(`A folder already exists at ${notePath}.`);
		return false;
	}

	let file = existing;
	if (!file) {
		if (options.confirmBeforeCreate && !(await options.confirm(notePath))) return false;
		try {
			file = await createDailyNote(app, date, notePath, ancestorFolders, config);
		} catch (error) {
			console.error("Calendar palette: failed to create daily note", error);
			new Notice(`Could not create ${notePath}.`);
			return false;
		}
	}

	const leaf = app.workspace.getLeaf(options.newTab ? "tab" : false);
	await leaf.openFile(file);
	return true;
}

async function createDailyNote(
	app: App,
	date: Date,
	notePath: string,
	ancestorFolders: string[],
	config: DailyNoteConfig,
): Promise<TFile> {
	for (const folder of ancestorFolders) {
		const normalized = normalizePath(folder);
		const existing = app.vault.getAbstractFileByPath(normalized);
		// Vault.create does not create missing parents, so walk them outermost first.
		if (!existing) await app.vault.createFolder(normalized);
		else if (!(existing instanceof TFolder)) {
			throw new Error(`${normalized} exists but is not a folder`);
		}
	}

	const content = await renderTemplate(app, date, notePath, config);
	return app.vault.create(notePath, content);
}

async function renderTemplate(
	app: App,
	date: Date,
	notePath: string,
	config: DailyNoteConfig,
): Promise<string> {
	if (!config.template) return "";

	// getFirstLinkpathDest resolves the template the way a wikilink would, so a
	// setting stored without the ".md" extension still finds the file.
	const templateFile = app.metadataCache.getFirstLinkpathDest(normalizePath(config.template), "");
	if (!templateFile) {
		new Notice(`Daily note template not found: ${config.template}`);
		return "";
	}

	const raw = await app.vault.cachedRead(templateFile);
	const basename = notePath.split("/").pop()?.replace(/\.md$/, "") ?? "";
	const now = moment();
	return applyTemplate(raw, {
		formatDate: (pattern) => moment(date).format(pattern),
		formatTime: (pattern) => now.format(pattern),
		dateFormat: config.format,
		timeFormat: DEFAULT_TIME_FORMAT,
		title: basename,
	});
}
