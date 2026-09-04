import { describe, expect, it } from "vite-plus/test";
import { applyTemplate, type TemplateContext } from "./template";

/** Stands in for moment: records which clock and pattern were used. */
const context: TemplateContext = {
	formatDate: (pattern) => `date<${pattern}>`,
	formatTime: (pattern) => `time<${pattern}>`,
	dateFormat: "YYYY-MM-DD",
	timeFormat: "HH:mm",
	title: "2026-09-04",
};

describe("applyTemplate", () => {
	it("returns an empty string for an empty template", () => {
		expect(applyTemplate("", context)).toBe("");
	});

	it("leaves text without placeholders untouched", () => {
		expect(applyTemplate("## Log\n\n- ", context)).toBe("## Log\n\n- ");
	});

	it("substitutes {{date}} using the daily note format", () => {
		expect(applyTemplate("{{date}}", context)).toBe("date<YYYY-MM-DD>");
	});

	it("substitutes {{time}} using the time format", () => {
		expect(applyTemplate("{{time}}", context)).toBe("time<HH:mm>");
	});

	// The note's date is local midnight, so {{time}} must read a different clock
	// than {{date}} or every daily note would claim it was created at 00:00.
	it("formats {{time}} through a different clock than {{date}}", () => {
		expect(applyTemplate("{{date}} {{time}}", context)).toBe("date<YYYY-MM-DD> time<HH:mm>");
	});

	it("substitutes {{title}} with the note's basename", () => {
		expect(applyTemplate("# {{title}}", context)).toBe("# 2026-09-04");
	});

	it("honours an explicit format after a colon", () => {
		expect(applyTemplate("{{date:YYYY}}", context)).toBe("date<YYYY>");
	});

	it("keeps colons inside an explicit format", () => {
		expect(applyTemplate("{{time:HH:mm:ss}}", context)).toBe("time<HH:mm:ss>");
	});

	it("tolerates whitespace inside the braces", () => {
		expect(applyTemplate("{{ date }}", context)).toBe("date<YYYY-MM-DD>");
		expect(applyTemplate("{{ date : YYYY }}", context)).toBe("date<YYYY>");
	});

	it("matches placeholder names case-insensitively", () => {
		expect(applyTemplate("{{DATE}} {{Title}}", context)).toBe("date<YYYY-MM-DD> 2026-09-04");
	});

	it("substitutes every occurrence", () => {
		expect(applyTemplate("{{date}} / {{date}}", context)).toBe(
			"date<YYYY-MM-DD> / date<YYYY-MM-DD>",
		);
	});

	it("leaves unknown placeholders alone so other plugins can expand them", () => {
		expect(applyTemplate("{{foo}} {{date}}", context)).toBe("{{foo}} date<YYYY-MM-DD>");
	});

	it("ignores a format on {{title}}", () => {
		expect(applyTemplate("{{title:YYYY}}", context)).toBe("2026-09-04");
	});
});
