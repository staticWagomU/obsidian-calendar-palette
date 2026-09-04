import { describe, expect, it } from "vite-plus/test";
import { resolveDailyNotePath } from "./notePath";

describe("resolveDailyNotePath", () => {
	it("puts the note at the vault root when no folder is configured", () => {
		expect(resolveDailyNotePath("", "2026-09-04")).toEqual({
			path: "2026-09-04.md",
			ancestorFolders: [],
		});
	});

	it("nests the note under the configured folder", () => {
		expect(resolveDailyNotePath("Daily", "2026-09-04")).toEqual({
			path: "Daily/2026-09-04.md",
			ancestorFolders: ["Daily"],
		});
	});

	it("nests under a multi-level folder", () => {
		expect(resolveDailyNotePath("Journal/Daily", "2026-09-04")).toEqual({
			path: "Journal/Daily/2026-09-04.md",
			ancestorFolders: ["Journal", "Journal/Daily"],
		});
	});

	it("tolerates leading, trailing and doubled slashes in the folder", () => {
		const expected = {
			path: "Daily/2026-09-04.md",
			ancestorFolders: ["Daily"],
		};
		expect(resolveDailyNotePath("/Daily", "2026-09-04")).toEqual(expected);
		expect(resolveDailyNotePath("Daily/", "2026-09-04")).toEqual(expected);
		expect(resolveDailyNotePath("//Daily//", "2026-09-04")).toEqual(expected);
		expect(resolveDailyNotePath("  Daily  ", "2026-09-04")).toEqual(expected);
	});

	it("treats a bare slash as the vault root", () => {
		expect(resolveDailyNotePath("/", "2026-09-04")).toEqual({
			path: "2026-09-04.md",
			ancestorFolders: [],
		});
	});

	// The daily note *format* can itself contain slashes, e.g. "YYYY/MM/YYYY-MM-DD".
	it("derives folders from slashes inside the formatted date", () => {
		expect(resolveDailyNotePath("Daily", "2026/09/2026-09-04")).toEqual({
			path: "Daily/2026/09/2026-09-04.md",
			ancestorFolders: ["Daily", "Daily/2026", "Daily/2026/09"],
		});
	});

	it("derives folders from the formatted date even at the vault root", () => {
		expect(resolveDailyNotePath("", "2026/09/2026-09-04")).toEqual({
			path: "2026/09/2026-09-04.md",
			ancestorFolders: ["2026", "2026/09"],
		});
	});

	it("does not double up the .md extension", () => {
		expect(resolveDailyNotePath("Daily", "2026-09-04").path).toBe("Daily/2026-09-04.md");
	});
});
