export interface DailyNotePath {
	/** Vault-relative path to the note, including the `.md` extension. */
	path: string;
	/**
	 * Folders that must exist before the note can be created, outermost first.
	 * Obsidian's `Vault.create` does not create missing parents.
	 */
	ancestorFolders: string[];
}

/**
 * Combines the daily note folder with an already-formatted date to produce the
 * note's path.
 *
 * `formattedDate` may contain slashes: the core daily note format is a moment
 * pattern, and users commonly write `YYYY/MM/YYYY-MM-DD` to shard by month.
 * Those slashes are real folders, so they contribute to `ancestorFolders` too.
 */
export function resolveDailyNotePath(folder: string, formattedDate: string): DailyNotePath {
	const segments = [...splitPath(folder), ...splitPath(formattedDate)];
	const folderSegments = segments.slice(0, -1);

	const ancestorFolders: string[] = [];
	let accumulated = "";
	for (const segment of folderSegments) {
		accumulated = accumulated ? `${accumulated}/${segment}` : segment;
		ancestorFolders.push(accumulated);
	}

	return { path: `${segments.join("/")}.md`, ancestorFolders };
}

/** Splits on `/`, dropping empty segments so stray or doubled slashes are harmless. */
function splitPath(value: string): string[] {
	return value
		.trim()
		.split("/")
		.map((segment) => segment.trim())
		.filter((segment) => segment.length > 0);
}
