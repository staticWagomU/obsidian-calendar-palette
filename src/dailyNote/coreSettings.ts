import type { App } from "obsidian";

export interface DailyNoteConfig {
	/** Vault-relative folder new daily notes go into. Empty means the vault root. */
	folder: string;
	/** Moment pattern for the note's filename. */
	format: string;
	/** Link path of the template file. Empty means no template. */
	template: string;
}

export const DEFAULT_DATE_FORMAT = "YYYY-MM-DD";
export const DEFAULT_TIME_FORMAT = "HH:mm";

const FALLBACK: DailyNoteConfig = { folder: "", format: DEFAULT_DATE_FORMAT, template: "" };

/**
 * Shape of the core "Daily notes" internal plugin.
 *
 * Why not a public API: `obsidian.d.ts` exposes no way to read another plugin's
 * settings, and the daily note folder/format/template live nowhere else. Reading
 * `internalPlugins` is what Calendar and Periodic Notes do too. Keeping the cast
 * in this one file means a future change to Obsidian's internals only lands here.
 */
interface InternalPluginInstance {
	options?: Partial<DailyNoteConfig>;
}

interface InternalPlugin {
	enabled?: boolean;
	instance?: InternalPluginInstance;
}

interface AppWithInternalPlugins extends App {
	internalPlugins?: {
		getPluginById?(id: string): InternalPlugin | null | undefined;
	};
}

/** True when the core "Daily notes" plugin is turned on. */
export function isDailyNotesPluginEnabled(app: App): boolean {
	return readInternalPlugin(app)?.enabled === true;
}

/**
 * Reads the core daily note settings, falling back to Obsidian's own defaults
 * when the plugin is disabled or its internals have moved.
 */
export function getDailyNoteConfig(app: App): DailyNoteConfig {
	const options = readInternalPlugin(app)?.instance?.options;
	if (!options) return { ...FALLBACK };

	return {
		folder: options.folder?.trim() ?? FALLBACK.folder,
		// An empty format means "use the default", matching core behaviour.
		format: options.format?.trim() || FALLBACK.format,
		template: options.template?.trim() ?? FALLBACK.template,
	};
}

function readInternalPlugin(app: App): InternalPlugin | undefined {
	const internalPlugins = (app as AppWithInternalPlugins).internalPlugins;
	return internalPlugins?.getPluginById?.("daily-notes") ?? undefined;
}
