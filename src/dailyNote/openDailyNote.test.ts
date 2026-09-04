import { describe, expect, it, vi } from "vite-plus/test";
import type { DailyNoteConfig } from "./coreSettings";
import type { DailyNoteEnvironment, VaultEntry } from "./environment";
import { dailyNotePath, hasDailyNote, openDailyNote } from "./openDailyNote";

/**
 * A vault held in a Map, with the note handle being the path itself.
 *
 * Everything the real environment reaches Obsidian for is recorded rather than
 * done, so a test states an outcome ("nothing was created") instead of a call
 * sequence.
 */
interface FakeVault {
	env: DailyNoteEnvironment<string>;
	entries: Map<string, "note" | "folder">;
	contents: Map<string, string>;
	foldersCreated: string[];
	opened: { note: string; newTab: boolean }[];
	notices: string[];
	nowCalls: number;
}

interface FakeVaultOptions {
	/** Paths that already exist, and what occupies each. */
	entries?: Record<string, "note" | "folder">;
	/** Template text by link path. Anything else resolves to "not found". */
	templates?: Record<string, string>;
	/** Makes note creation blow up, standing in for a disk or permission error. */
	failCreate?: boolean;
}

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * Stand-in for the moment tokens this plugin actually uses: enough to tell the
 * patterns apart in an assertion without pulling moment into the test. One
 * pass, so a pattern that repeats a token (`YYYY/MM/YYYY-MM-DD`) still works.
 */
function formatWithFakeMomentTokens(date: Date, pattern: string): string {
	return pattern.replace(/YYYY|MM|DD|HH|mm/g, (token) => {
		switch (token) {
			case "YYYY":
				return String(date.getFullYear());
			case "MM":
				return pad(date.getMonth() + 1);
			case "DD":
				return pad(date.getDate());
			case "HH":
				return pad(date.getHours());
			default:
				return pad(date.getMinutes());
		}
	});
}

function fakeVault(options: FakeVaultOptions = {}): FakeVault {
	const vault: FakeVault = {
		entries: new Map(Object.entries(options.entries ?? {})),
		contents: new Map(),
		foldersCreated: [],
		opened: [],
		notices: [],
		nowCalls: 0,
		env: undefined as unknown as DailyNoteEnvironment<string>,
	};
	const templates = new Map(Object.entries(options.templates ?? {}));

	vault.env = {
		formatDate: formatWithFakeMomentTokens,
		now: () => {
			vault.nowCalls++;
			return new Date(2026, 8, 4, 13, 45);
		},
		// The real normalizePath collapses repeated slashes and trims the ends.
		normalizePath: (path) => path.replace(/\/+/g, "/").replace(/^\/|\/$/g, ""),
		entryAt: (path): VaultEntry<string> | null => {
			const kind = vault.entries.get(path);
			if (kind === "note") return { kind: "note", note: path };
			return kind ? { kind: "folder" } : null;
		},
		createFolder: async (path) => {
			vault.foldersCreated.push(path);
			vault.entries.set(path, "folder");
		},
		createNote: async (path, content) => {
			if (options.failCreate) throw new Error("disk on fire");
			vault.entries.set(path, "note");
			vault.contents.set(path, content);
			return path;
		},
		openNote: async (note, newTab) => {
			vault.opened.push({ note, newTab });
		},
		readTemplate: async (linkPath) => templates.get(linkPath) ?? null,
		notify: (message) => vault.notices.push(message),
	};
	return vault;
}

const CONFIG: DailyNoteConfig = { folder: "Journal", format: "YYYY-MM-DD", template: "" };
const DATE = new Date(2026, 8, 4);

/** Options that create without asking, which most cases are not about. */
function silently(overrides: Partial<Parameters<typeof openDailyNote>[3]> = {}) {
	return {
		newTab: false,
		confirmBeforeCreate: false,
		confirm: async () => true,
		...overrides,
	};
}

describe("dailyNotePath", () => {
	it("formats the date and nests it under the configured folder", () => {
		const { env } = fakeVault();
		expect(dailyNotePath(DATE, CONFIG, env)).toBe("Journal/2026-09-04.md");
	});

	it("puts the note at the vault root when no folder is configured", () => {
		const { env } = fakeVault();
		expect(dailyNotePath(DATE, { ...CONFIG, folder: "" }, env)).toBe("2026-09-04.md");
	});

	it("normalises the path it hands out", () => {
		const { env } = fakeVault();
		expect(dailyNotePath(DATE, { ...CONFIG, folder: "/Journal//" }, env)).toBe(
			"Journal/2026-09-04.md",
		);
	});
});

describe("hasDailyNote", () => {
	it("is true once the note exists", () => {
		const { env } = fakeVault({ entries: { "Journal/2026-09-04.md": "note" } });
		expect(hasDailyNote(DATE, CONFIG, env)).toBe(true);
	});

	it("is false when nothing is there", () => {
		const { env } = fakeVault();
		expect(hasDailyNote(DATE, CONFIG, env)).toBe(false);
	});

	it("is false when a folder sits at the note's path", () => {
		const { env } = fakeVault({ entries: { "Journal/2026-09-04.md": "folder" } });
		expect(hasDailyNote(DATE, CONFIG, env)).toBe(false);
	});
});

describe("openDailyNote on a note that already exists", () => {
	it("opens it without creating anything", async () => {
		const vault = fakeVault({ entries: { "Journal/2026-09-04.md": "note" } });

		expect(await openDailyNote(DATE, CONFIG, vault.env, silently())).toBe(true);
		expect(vault.opened).toEqual([{ note: "Journal/2026-09-04.md", newTab: false }]);
		expect(vault.contents.size).toBe(0);
		expect(vault.foldersCreated).toEqual([]);
	});

	it("never asks for confirmation, since nothing is being created", async () => {
		const vault = fakeVault({ entries: { "Journal/2026-09-04.md": "note" } });
		const confirm = vi.fn(async () => true);

		await openDailyNote(
			DATE,
			CONFIG,
			vault.env,
			silently({ confirmBeforeCreate: true, confirm }),
		);
		expect(confirm).not.toHaveBeenCalled();
	});

	it("opens in a new tab when asked", async () => {
		const vault = fakeVault({ entries: { "Journal/2026-09-04.md": "note" } });

		await openDailyNote(DATE, CONFIG, vault.env, silently({ newTab: true }));
		expect(vault.opened).toEqual([{ note: "Journal/2026-09-04.md", newTab: true }]);
	});
});

describe("openDailyNote on a note that does not exist yet", () => {
	it("creates it and opens it", async () => {
		const vault = fakeVault({ entries: { Journal: "folder" } });

		expect(await openDailyNote(DATE, CONFIG, vault.env, silently())).toBe(true);
		expect(vault.contents.get("Journal/2026-09-04.md")).toBe("");
		expect(vault.opened).toEqual([{ note: "Journal/2026-09-04.md", newTab: false }]);
	});

	it("asks first when the setting is on, and creates on a yes", async () => {
		const vault = fakeVault({ entries: { Journal: "folder" } });
		const confirm = vi.fn(async () => true);

		expect(
			await openDailyNote(
				DATE,
				CONFIG,
				vault.env,
				silently({ confirmBeforeCreate: true, confirm }),
			),
		).toBe(true);
		// The dialog names the path the user is about to get.
		expect(confirm).toHaveBeenCalledWith("Journal/2026-09-04.md");
		expect(vault.contents.has("Journal/2026-09-04.md")).toBe(true);
	});

	it("creates and opens nothing on a no, and reports the decline", async () => {
		const vault = fakeVault({ entries: { Journal: "folder" } });

		const opened = await openDailyNote(
			DATE,
			CONFIG,
			vault.env,
			silently({ confirmBeforeCreate: true, confirm: async () => false }),
		);

		expect(opened).toBe(false);
		expect(vault.contents.size).toBe(0);
		expect(vault.foldersCreated).toEqual([]);
		expect(vault.opened).toEqual([]);
		// Declining is a choice, not a failure: it earns no error message.
		expect(vault.notices).toEqual([]);
	});
});

describe("openDailyNote when the path is obstructed", () => {
	it("reports a folder standing where the note goes, and creates nothing", async () => {
		const vault = fakeVault({ entries: { "Journal/2026-09-04.md": "folder" } });

		expect(await openDailyNote(DATE, CONFIG, vault.env, silently())).toBe(false);
		expect(vault.notices).toEqual(["A folder already exists at Journal/2026-09-04.md."]);
		expect(vault.opened).toEqual([]);
	});

	it("reports a note standing where an ancestor folder goes", async () => {
		const vault = fakeVault({ entries: { Journal: "note" } });

		expect(await openDailyNote(DATE, CONFIG, vault.env, silently())).toBe(false);
		expect(vault.notices).toEqual(["Could not create Journal/2026-09-04.md."]);
		expect(vault.opened).toEqual([]);
	});

	it("reports a failed creation rather than opening nothing", async () => {
		const vault = fakeVault({ entries: { Journal: "folder" }, failCreate: true });
		const logged = vi.spyOn(console, "error").mockImplementation(() => {});

		expect(await openDailyNote(DATE, CONFIG, vault.env, silently())).toBe(false);
		expect(vault.notices).toEqual(["Could not create Journal/2026-09-04.md."]);
		expect(vault.opened).toEqual([]);
		expect(logged).toHaveBeenCalled();
		logged.mockRestore();
	});
});

describe("openDailyNote creating missing folders", () => {
	it("creates the note's folder when it does not exist", async () => {
		const vault = fakeVault();

		await openDailyNote(DATE, CONFIG, vault.env, silently());
		expect(vault.foldersCreated).toEqual(["Journal"]);
	});

	it("creates nested folders outermost first, since Vault.create skips parents", async () => {
		const vault = fakeVault();
		const config = { ...CONFIG, folder: "Notes/Daily/Journal" };

		await openDailyNote(DATE, config, vault.env, silently());
		expect(vault.foldersCreated).toEqual(["Notes", "Notes/Daily", "Notes/Daily/Journal"]);
	});

	it("leaves folders that already exist alone", async () => {
		const vault = fakeVault({ entries: { Notes: "folder" } });

		await openDailyNote(DATE, { ...CONFIG, folder: "Notes/Daily" }, vault.env, silently());
		expect(vault.foldersCreated).toEqual(["Notes/Daily"]);
	});

	it("treats slashes inside the date format as folders too", async () => {
		const vault = fakeVault();
		const config = { ...CONFIG, folder: "", format: "YYYY/MM/YYYY-MM-DD" };

		await openDailyNote(DATE, config, vault.env, silently());
		expect(vault.foldersCreated).toEqual(["2026", "2026/09"]);
		expect(vault.contents.has("2026/09/2026-09-04.md")).toBe(true);
	});
});

describe("openDailyNote applying a template", () => {
	it("leaves the note empty when no template is configured", async () => {
		const vault = fakeVault({ entries: { Journal: "folder" } });

		await openDailyNote(DATE, CONFIG, vault.env, silently());
		expect(vault.contents.get("Journal/2026-09-04.md")).toBe("");
	});

	it("expands the placeholders the core plugin supports", async () => {
		const vault = fakeVault({
			entries: { Journal: "folder" },
			templates: { "Templates/Daily": "# {{title}}\n{{date}} at {{time}}\n" },
		});
		const config = { ...CONFIG, template: "Templates/Daily" };

		await openDailyNote(DATE, config, vault.env, silently());
		expect(vault.contents.get("Journal/2026-09-04.md")).toBe(
			"# 2026-09-04\n2026-09-04 at 13:45\n",
		);
	});

	it("reads the clock once, so two {{time}} placeholders cannot disagree", async () => {
		const vault = fakeVault({
			entries: { Journal: "folder" },
			templates: { "Templates/Daily": "{{time}} {{time:HH}}" },
		});

		await openDailyNote(
			DATE,
			{ ...CONFIG, template: "Templates/Daily" },
			vault.env,
			silently(),
		);
		expect(vault.nowCalls).toBe(1);
	});

	it("still creates the note when the template is missing, and says so", async () => {
		const vault = fakeVault({ entries: { Journal: "folder" } });
		const config = { ...CONFIG, template: "Templates/Gone" };

		expect(await openDailyNote(DATE, config, vault.env, silently())).toBe(true);
		expect(vault.notices).toEqual(["Daily note template not found: Templates/Gone"]);
		expect(vault.contents.get("Journal/2026-09-04.md")).toBe("");
	});
});
