import { describe, expect, it } from "vite-plus/test";
import { toISODate } from "./dateMath";
import { buildMonthGrid, DAYS_IN_WEEK, WEEKS_IN_GRID, weekdayOrder } from "./monthGrid";

function d(year: number, month: number, day: number): Date {
	return new Date(year, month - 1, day);
}

function flatten(grid: readonly (readonly { date: Date }[])[]): string[] {
	return grid.flatMap((week) => week.map((cell) => toISODate(cell.date)));
}

describe("buildMonthGrid", () => {
	// A fixed 6x7 grid keeps the modal the same height every month, so the
	// focused cell never jumps under the cursor when paging between months.
	it("always returns 6 weeks of 7 days", () => {
		for (const anchor of [d(2026, 2, 15), d(2026, 9, 15), d(2026, 11, 15), d(2024, 2, 15)]) {
			const grid = buildMonthGrid(anchor, 0);
			expect(grid).toHaveLength(WEEKS_IN_GRID);
			for (const week of grid) {
				expect(week).toHaveLength(DAYS_IN_WEEK);
			}
		}
	});

	it("starts on the Sunday on or before the 1st when weekStart is 0", () => {
		// 2026-09-01 is a Tuesday.
		const grid = buildMonthGrid(d(2026, 9, 15), 0);
		expect(toISODate(grid[0]![0]!.date)).toBe("2026-08-30");
	});

	it("starts on the Monday on or before the 1st when weekStart is 1", () => {
		const grid = buildMonthGrid(d(2026, 9, 15), 1);
		expect(toISODate(grid[0]![0]!.date)).toBe("2026-08-31");
	});

	it("starts on the 1st when it already falls on the week's first day", () => {
		// 2026-02-01 is a Sunday.
		const grid = buildMonthGrid(d(2026, 2, 15), 0);
		expect(toISODate(grid[0]![0]!.date)).toBe("2026-02-01");
	});

	it("emits 42 consecutive days", () => {
		const dates = flatten(buildMonthGrid(d(2026, 9, 15), 0));
		expect(dates).toHaveLength(42);
		expect(dates[0]).toBe("2026-08-30");
		expect(dates[41]).toBe("2026-10-10");
	});

	it("marks cells outside the anchor month", () => {
		const cells = buildMonthGrid(d(2026, 9, 15), 0).flat();
		const inMonth = cells.filter((cell) => cell.inCurrentMonth);
		expect(inMonth).toHaveLength(30);
		expect(toISODate(inMonth[0]!.date)).toBe("2026-09-01");
		expect(toISODate(inMonth[29]!.date)).toBe("2026-09-30");
		expect(cells[0]!.inCurrentMonth).toBe(false);
		expect(cells[41]!.inCurrentMonth).toBe(false);
	});

	it("ignores the anchor's day of month", () => {
		const fromFirst = flatten(buildMonthGrid(d(2026, 9, 1), 0));
		const fromLast = flatten(buildMonthGrid(d(2026, 9, 30), 0));
		expect(fromFirst).toEqual(fromLast);
	});

	it("ignores the anchor's time component", () => {
		const grid = buildMonthGrid(new Date(2026, 8, 15, 23, 59), 0);
		expect(grid[0]![0]!.date.getHours()).toBe(0);
	});

	it("keeps a short month from collapsing to 4 weeks", () => {
		// February 2026 is 28 days starting on a Sunday: it fits in exactly 4
		// weeks, but the grid must still pad out to 6.
		const dates = flatten(buildMonthGrid(d(2026, 2, 15), 0));
		expect(dates[0]).toBe("2026-02-01");
		expect(dates[41]).toBe("2026-03-14");
	});
});

describe("weekdayOrder", () => {
	it("lists weekday indices starting from weekStart", () => {
		expect(weekdayOrder(0)).toEqual([0, 1, 2, 3, 4, 5, 6]);
		expect(weekdayOrder(1)).toEqual([1, 2, 3, 4, 5, 6, 0]);
		expect(weekdayOrder(6)).toEqual([6, 0, 1, 2, 3, 4, 5]);
	});
});
