import { describe, expect, it } from "vite-plus/test";

// Pure logic tests (no Obsidian dependencies)
describe("Example Test", () => {
	it("should pass basic assertion", () => {
		expect(1 + 1).toBe(2);
	});

	it("should handle string operations", () => {
		const greeting = "Hello, Obsidian!";
		expect(greeting).toContain("Obsidian");
	});
});
