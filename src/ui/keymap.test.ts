import { describe, expect, it } from "vite-plus/test";
import { bindingsFor, hintFor, type KeyStroke, resolveAction } from "./keymap";

/** A keystroke with every modifier up, so each test only states what it presses. */
function stroke(key: string, overrides: Partial<KeyStroke> = {}): KeyStroke {
	return {
		key,
		code: "",
		ctrlKey: false,
		metaKey: false,
		altKey: false,
		shiftKey: false,
		...overrides,
	};
}

function press(mode: Parameters<typeof bindingsFor>[0], s: KeyStroke, isMacOS = false) {
	return resolveAction(bindingsFor(mode), s, isMacOS);
}

describe("the base bindings", () => {
	it("moves by day and week on the arrows", () => {
		expect(press("default", stroke("ArrowLeft"))).toBe("prev-day");
		expect(press("default", stroke("ArrowRight"))).toBe("next-day");
		expect(press("default", stroke("ArrowUp"))).toBe("prev-week");
		expect(press("default", stroke("ArrowDown"))).toBe("next-week");
	});

	it("widens Page up/down from a month to a year with Shift", () => {
		expect(press("default", stroke("PageUp"))).toBe("prev-month");
		expect(press("default", stroke("PageUp", { shiftKey: true }))).toBe("prev-year");
		expect(press("default", stroke("PageDown"))).toBe("next-month");
		expect(press("default", stroke("PageDown", { shiftKey: true }))).toBe("next-year");
	});

	it("jumps to today on Home and on T", () => {
		expect(press("default", stroke("Home"))).toBe("today");
		expect(press("default", stroke("t"))).toBe("today");
	});

	it("stays available inside the vim and emacs modes", () => {
		expect(press("vim", stroke("ArrowLeft"))).toBe("prev-day");
		expect(press("emacs", stroke("PageDown"))).toBe("next-month");
	});

	it("ignores keys it does not bind", () => {
		expect(press("default", stroke("h"))).toBeNull();
		expect(press("default", stroke("z"))).toBeNull();
	});
});

describe("Mod+Enter", () => {
	it("is Command on macOS and Control elsewhere", () => {
		expect(press("default", stroke("Enter", { metaKey: true }), true)).toBe("open-in-new-tab");
		expect(press("default", stroke("Enter", { ctrlKey: true }), false)).toBe("open-in-new-tab");
	});

	it("is not satisfied by the other platform's modifier", () => {
		expect(press("default", stroke("Enter", { ctrlKey: true }), true)).toBeNull();
		expect(press("default", stroke("Enter", { metaKey: true }), false)).toBeNull();
	});

	it("leaves a bare Enter opening in the current tab", () => {
		expect(press("default", stroke("Enter"))).toBe("open");
	});
});

describe("the vim mode", () => {
	it("moves on hjkl", () => {
		expect(press("vim", stroke("h"))).toBe("prev-day");
		expect(press("vim", stroke("l"))).toBe("next-day");
		expect(press("vim", stroke("k"))).toBe("prev-week");
		expect(press("vim", stroke("j"))).toBe("next-week");
	});

	it("pages by month on Ctrl+B/Ctrl+F and by year with Shift", () => {
		expect(press("vim", stroke("b", { ctrlKey: true }))).toBe("prev-month");
		expect(press("vim", stroke("f", { ctrlKey: true }))).toBe("next-month");
		expect(press("vim", stroke("B", { ctrlKey: true, shiftKey: true }))).toBe("prev-year");
		expect(press("vim", stroke("F", { ctrlKey: true, shiftKey: true }))).toBe("next-year");
	});

	it("uses Control on macOS too, so Command is free for Obsidian", () => {
		expect(press("vim", stroke("f", { metaKey: true }), true)).toBeNull();
	});

	it("stays out of the way of the other modes", () => {
		expect(press("emacs", stroke("h"))).toBeNull();
		expect(press("default", stroke("j"))).toBeNull();
	});
});

describe("the emacs mode", () => {
	it("moves by day and week on the Emacs motion keys", () => {
		expect(press("emacs", stroke("b", { ctrlKey: true }))).toBe("prev-day");
		expect(press("emacs", stroke("f", { ctrlKey: true }))).toBe("next-day");
		expect(press("emacs", stroke("p", { ctrlKey: true }))).toBe("prev-week");
		expect(press("emacs", stroke("n", { ctrlKey: true }))).toBe("next-week");
	});

	it("pages by month on Ctrl+V and Alt+V", () => {
		expect(press("emacs", stroke("v", { ctrlKey: true }))).toBe("next-month");
		expect(press("emacs", stroke("v", { code: "KeyV", altKey: true }))).toBe("prev-month");
	});

	it("pages by year when Shift joins either", () => {
		expect(press("emacs", stroke("V", { ctrlKey: true, shiftKey: true }))).toBe("next-year");
		expect(press("emacs", stroke("V", { code: "KeyV", altKey: true, shiftKey: true }))).toBe(
			"prev-year",
		);
	});

	it("matches Alt bindings by physical key, since macOS composes Option+V into a glyph", () => {
		expect(press("emacs", stroke("√", { code: "KeyV", altKey: true }), true)).toBe(
			"prev-month",
		);
	});

	it("jumps to today on the period key", () => {
		expect(press("emacs", stroke("."))).toBe("today");
		expect(press("default", stroke("."))).toBeNull();
	});
});

describe("modifier matching", () => {
	it("rejects a stroke carrying a modifier the binding does not ask for", () => {
		expect(press("vim", stroke("h", { altKey: true }))).toBeNull();
		expect(press("vim", stroke("f", { ctrlKey: true, altKey: true }))).toBeNull();
		expect(press("default", stroke("ArrowLeft", { shiftKey: true }))).toBeNull();
	});
});

describe("hintFor", () => {
	it("names the keys the chosen mode actually answers to", () => {
		expect(hintFor("default")).toContain("Arrows");
		expect(hintFor("vim")).toContain("h j k l");
		expect(hintFor("emacs")).toContain("Ctrl+B/F/P/N");
	});

	it("always mentions how to open", () => {
		for (const mode of ["default", "vim", "emacs"] as const) {
			expect(hintFor(mode)).toContain("Enter opens");
		}
	});
});
