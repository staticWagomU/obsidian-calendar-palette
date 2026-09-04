import { describe, expect, it } from "vite-plus/test";
import { toISODate } from "./dateMath";
import { monthNumber, pageDirection, resolveWeekStart, step } from "./navigation";

/** Local-midnight Date, so assertions never depend on the machine's timezone offset. */
function d(year: number, month: number, day: number): Date {
	return new Date(year, month - 1, day);
}

const TODAY = d(2026, 9, 4);

function move(action: Parameters<typeof step>[0], from: Date): string {
	return toISODate(step(action, from, TODAY));
}

describe("step", () => {
	it("moves by a day", () => {
		expect(move("prev-day", d(2026, 9, 4))).toBe("2026-09-03");
		expect(move("next-day", d(2026, 9, 4))).toBe("2026-09-05");
	});

	it("moves by a week", () => {
		expect(move("prev-week", d(2026, 9, 4))).toBe("2026-08-28");
		expect(move("next-week", d(2026, 9, 4))).toBe("2026-09-11");
	});

	it("moves by a month", () => {
		expect(move("prev-month", d(2026, 9, 4))).toBe("2026-08-04");
		expect(move("next-month", d(2026, 9, 4))).toBe("2026-10-04");
	});

	it("moves by a year", () => {
		expect(move("prev-year", d(2026, 9, 4))).toBe("2025-09-04");
		expect(move("next-year", d(2026, 9, 4))).toBe("2027-09-04");
	});

	it("clamps onto a shorter month rather than overflowing into the next one", () => {
		expect(move("next-month", d(2026, 1, 31))).toBe("2026-02-28");
		expect(move("prev-month", d(2026, 3, 31))).toBe("2026-02-28");
	});

	it("clamps a leap day onto a non-leap year", () => {
		expect(move("next-year", d(2024, 2, 29))).toBe("2025-02-28");
	});

	it("returns today whatever the focus is", () => {
		expect(move("today", d(2019, 4, 17))).toBe("2026-09-04");
	});

	it("leaves the focus where it is for the actions that open a note", () => {
		// The modal handles these before it ever steps, so landing on today is
		// only a fallback; what matters is that it is not an arbitrary date.
		expect(move("open", d(2019, 4, 17))).toBe("2026-09-04");
		expect(move("open-in-new-tab", d(2019, 4, 17))).toBe("2026-09-04");
	});
});

describe("monthNumber", () => {
	it("increases by one per calendar month", () => {
		expect(monthNumber(d(2026, 10, 1)) - monthNumber(d(2026, 9, 30))).toBe(1);
	});

	it("keeps counting across a year boundary", () => {
		expect(monthNumber(d(2027, 1, 1)) - monthNumber(d(2026, 12, 31))).toBe(1);
	});

	it("ignores the day of month", () => {
		expect(monthNumber(d(2026, 9, 1))).toBe(monthNumber(d(2026, 9, 30)));
	});
});

describe("pageDirection", () => {
	const september = monthNumber(d(2026, 9, 1));
	const october = monthNumber(d(2026, 10, 1));
	const august = monthNumber(d(2026, 8, 1));

	it("travels forward for a later month", () => {
		expect(pageDirection(september, october, false)).toBe(1);
	});

	it("travels back for an earlier month", () => {
		expect(pageDirection(september, august, false)).toBe(-1);
	});

	it("stays put when the focus moves within one month", () => {
		expect(pageDirection(september, september, false)).toBe(0);
	});

	it("stays put on the initial open, so the grid does not slide in from nowhere", () => {
		expect(pageDirection(null, september, true)).toBe(0);
		expect(pageDirection(september, october, true)).toBe(0);
	});

	it("stays put when nothing has been rendered yet", () => {
		expect(pageDirection(null, september, false)).toBe(0);
	});

	it("travels one step for a jump of several months, not several", () => {
		expect(pageDirection(september, monthNumber(d(2028, 3, 1)), false)).toBe(1);
	});
});

describe("resolveWeekStart", () => {
	it("pins Sunday and Monday regardless of the locale", () => {
		expect(resolveWeekStart("sunday", 1)).toBe(0);
		expect(resolveWeekStart("monday", 0)).toBe(1);
	});

	it("defers to the locale otherwise", () => {
		expect(resolveWeekStart("locale", 1)).toBe(1);
		expect(resolveWeekStart("locale", 6)).toBe(6);
	});
});
