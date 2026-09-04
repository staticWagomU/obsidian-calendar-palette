import type { App } from "obsidian";
import { describe, expect, it } from "vite-plus/test";
import { getDailyNoteConfig, isDailyNotesPluginEnabled } from "./coreSettings";

/**
 * The shape this module reaches into is Obsidian's, not ours, and it is
 * undocumented — so these tests exist mainly to pin down what happens when it
 * is not the shape we expect. Only the type of `App` is imported here, which is
 * erased at build time; nothing pulls in the runtime-less `obsidian` module.
 */
function appWith(plugin: unknown, { hasRegistry = true } = {}): App {
	const internalPlugins = hasRegistry ? { getPluginById: () => plugin } : undefined;
	return { internalPlugins } as unknown as App;
}

/** A plugin entry the way Obsidian exposes it when Daily notes is on. */
function dailyNotesPlugin(options: Record<string, unknown> | undefined, enabled = true) {
	return { enabled, instance: options === undefined ? undefined : { options } };
}

describe("isDailyNotesPluginEnabled", () => {
	it("is true when the core plugin reports itself enabled", () => {
		expect(isDailyNotesPluginEnabled(appWith(dailyNotesPlugin({})))).toBe(true);
	});

	it("is false when the core plugin is turned off", () => {
		expect(isDailyNotesPluginEnabled(appWith(dailyNotesPlugin({}, false)))).toBe(false);
	});

	it("is false when the plugin is not registered at all", () => {
		expect(isDailyNotesPluginEnabled(appWith(null))).toBe(false);
	});

	it("is false rather than throwing when the internals have moved", () => {
		expect(isDailyNotesPluginEnabled(appWith(null, { hasRegistry: false }))).toBe(false);
		expect(isDailyNotesPluginEnabled(appWith({}))).toBe(false);
	});
});

describe("getDailyNoteConfig", () => {
	it("reads the folder, format and template the user configured", () => {
		const config = getDailyNoteConfig(
			appWith(
				dailyNotesPlugin({
					folder: "Journal/Daily",
					format: "YYYY/MM/DD",
					template: "Templates/Daily.md",
				}),
			),
		);

		expect(config).toEqual({
			folder: "Journal/Daily",
			format: "YYYY/MM/DD",
			template: "Templates/Daily.md",
		});
	});

	it("trims the whitespace a hand-edited config can carry", () => {
		const config = getDailyNoteConfig(
			appWith(dailyNotesPlugin({ folder: "  Journal  ", template: " T.md " })),
		);

		expect(config.folder).toBe("Journal");
		expect(config.template).toBe("T.md");
	});

	it("treats an empty format as the default, matching core behaviour", () => {
		expect(getDailyNoteConfig(appWith(dailyNotesPlugin({ format: "" }))).format).toBe(
			"YYYY-MM-DD",
		);
		expect(getDailyNoteConfig(appWith(dailyNotesPlugin({ format: "   " }))).format).toBe(
			"YYYY-MM-DD",
		);
	});

	it("keeps an empty folder and template empty, since both mean 'none'", () => {
		const config = getDailyNoteConfig(appWith(dailyNotesPlugin({ folder: "", template: "" })));
		expect(config.folder).toBe("");
		expect(config.template).toBe("");
	});

	it("falls back for keys the options bag does not carry", () => {
		expect(getDailyNoteConfig(appWith(dailyNotesPlugin({})))).toEqual({
			folder: "",
			format: "YYYY-MM-DD",
			template: "",
		});
	});

	it("falls back when the plugin is off, so the calendar still works", () => {
		expect(getDailyNoteConfig(appWith(dailyNotesPlugin(undefined, false)))).toEqual({
			folder: "",
			format: "YYYY-MM-DD",
			template: "",
		});
	});

	it("falls back rather than throwing when the internals have moved", () => {
		const fallback = { folder: "", format: "YYYY-MM-DD", template: "" };
		expect(getDailyNoteConfig(appWith(null))).toEqual(fallback);
		expect(getDailyNoteConfig(appWith(null, { hasRegistry: false }))).toEqual(fallback);
		expect(getDailyNoteConfig(appWith({}))).toEqual(fallback);
	});

	it("hands out a fresh object, so a caller cannot poison the fallback", () => {
		const first = getDailyNoteConfig(appWith(null));
		first.folder = "mutated";
		expect(getDailyNoteConfig(appWith(null)).folder).toBe("");
	});
});
