import { describe, expect, it } from "vite-plus/test";
import { addDays, addMonths, addYears, isSameDay, startOfDay, toISODate } from "./dateMath";

/** Local-midnight Date, so assertions never depend on the machine's timezone offset. */
function d(year: number, month: number, day: number): Date {
	return new Date(year, month - 1, day);
}

describe("startOfDay", () => {
	it("strips the time component", () => {
		const result = startOfDay(new Date(2026, 8, 4, 13, 45, 30, 500));
		expect(toISODate(result)).toBe("2026-09-04");
		expect(result.getHours()).toBe(0);
		expect(result.getMinutes()).toBe(0);
		expect(result.getSeconds()).toBe(0);
		expect(result.getMilliseconds()).toBe(0);
	});

	it("does not mutate its argument", () => {
		const original = new Date(2026, 8, 4, 13, 45);
		startOfDay(original);
		expect(original.getHours()).toBe(13);
	});
});

describe("addDays", () => {
	it("moves forward within a month", () => {
		expect(toISODate(addDays(d(2026, 9, 4), 1))).toBe("2026-09-05");
	});

	it("rolls over into the next month", () => {
		expect(toISODate(addDays(d(2026, 9, 30), 1))).toBe("2026-10-01");
	});

	it("rolls back into the previous month", () => {
		expect(toISODate(addDays(d(2026, 9, 4), -7))).toBe("2026-08-28");
	});

	it("crosses a year boundary", () => {
		expect(toISODate(addDays(d(2026, 12, 31), 1))).toBe("2027-01-01");
	});

	it("handles a leap day", () => {
		expect(toISODate(addDays(d(2024, 2, 28), 1))).toBe("2024-02-29");
	});

	it("does not mutate its argument", () => {
		const original = d(2026, 9, 4);
		addDays(original, 10);
		expect(toISODate(original)).toBe("2026-09-04");
	});
});

describe("addMonths", () => {
	it("keeps the day of month when it exists in the target month", () => {
		expect(toISODate(addMonths(d(2026, 9, 4), 1))).toBe("2026-10-04");
		expect(toISODate(addMonths(d(2026, 9, 4), -1))).toBe("2026-08-04");
	});

	// The naive Date#setMonth would overflow Jan 31 into Mar 3.
	it("clamps to the last day when the target month is shorter", () => {
		expect(toISODate(addMonths(d(2026, 1, 31), 1))).toBe("2026-02-28");
		expect(toISODate(addMonths(d(2026, 5, 31), 1))).toBe("2026-06-30");
	});

	it("clamps to Feb 29 in a leap year", () => {
		expect(toISODate(addMonths(d(2024, 1, 31), 1))).toBe("2024-02-29");
	});

	it("crosses a year boundary", () => {
		expect(toISODate(addMonths(d(2026, 12, 15), 1))).toBe("2027-01-15");
		expect(toISODate(addMonths(d(2026, 1, 15), -1))).toBe("2025-12-15");
	});
});

describe("addYears", () => {
	it("keeps the same month and day", () => {
		expect(toISODate(addYears(d(2026, 9, 4), 1))).toBe("2027-09-04");
		expect(toISODate(addYears(d(2026, 9, 4), -1))).toBe("2025-09-04");
	});

	it("clamps a leap day onto a non-leap year", () => {
		expect(toISODate(addYears(d(2024, 2, 29), 1))).toBe("2025-02-28");
	});
});

describe("isSameDay", () => {
	it("ignores the time component", () => {
		expect(isSameDay(new Date(2026, 8, 4, 0, 0), new Date(2026, 8, 4, 23, 59))).toBe(true);
	});

	it("distinguishes adjacent days", () => {
		expect(isSameDay(d(2026, 9, 4), d(2026, 9, 5))).toBe(false);
	});

	it("distinguishes the same day-of-month in different months", () => {
		expect(isSameDay(d(2026, 9, 4), d(2026, 10, 4))).toBe(false);
	});

	it("distinguishes the same date in different years", () => {
		expect(isSameDay(d(2026, 9, 4), d(2025, 9, 4))).toBe(false);
	});
});
