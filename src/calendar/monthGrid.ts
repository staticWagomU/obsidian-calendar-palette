import { addDays } from "./dateMath";

export const DAYS_IN_WEEK = 7;

/**
 * Six rows cover every possible month layout (a 31-day month starting on the
 * week's last day spans six weeks). Fixing the count rather than trimming empty
 * rows keeps the modal a constant height, so cells stay put while paging.
 */
export const WEEKS_IN_GRID = 6;

export interface CalendarCell {
	/** Local midnight of the day this cell represents. */
	date: Date;
	/** False for the leading/trailing days borrowed from the adjacent months. */
	inCurrentMonth: boolean;
}

/**
 * Builds the visible grid for the month containing `anchor`.
 *
 * @param weekStart - Day index the week starts on, 0 = Sunday through 6 = Saturday.
 */
export function buildMonthGrid(anchor: Date, weekStart: number): CalendarCell[][] {
	const month = anchor.getMonth();
	const firstOfMonth = new Date(anchor.getFullYear(), month, 1);
	const offset = (firstOfMonth.getDay() - weekStart + DAYS_IN_WEEK) % DAYS_IN_WEEK;
	const firstCell = addDays(firstOfMonth, -offset);

	const grid: CalendarCell[][] = [];
	for (let week = 0; week < WEEKS_IN_GRID; week++) {
		const row: CalendarCell[] = [];
		for (let day = 0; day < DAYS_IN_WEEK; day++) {
			const date = addDays(firstCell, week * DAYS_IN_WEEK + day);
			row.push({ date, inCurrentMonth: date.getMonth() === month });
		}
		grid.push(row);
	}
	return grid;
}

/** Weekday indices in display order, for labelling the header row. */
export function weekdayOrder(weekStart: number): number[] {
	return Array.from({ length: DAYS_IN_WEEK }, (_, i) => (weekStart + i) % DAYS_IN_WEEK);
}
