/**
 * Calendar arithmetic on plain `Date` values pinned to local midnight.
 *
 * Deliberately free of any `obsidian` import: `moment` is re-exported by the
 * `obsidian` module, which the bundler marks external, so anything importing it
 * is unreachable from the node-based test runner.
 */

/** Returns a copy of `date` with the time component cleared. */
export function startOfDay(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
	const result = startOfDay(date);
	result.setDate(result.getDate() + days);
	return result;
}

/**
 * Adds calendar months, clamping to the last day when the target month is
 * shorter. Going through `setDate(1)` first avoids `Date#setMonth`'s overflow,
 * which would turn Jan 31 + 1 month into Mar 3 rather than Feb 28.
 */
export function addMonths(date: Date, months: number): Date {
	const dayOfMonth = date.getDate();
	const result = startOfDay(date);
	result.setDate(1);
	result.setMonth(result.getMonth() + months);
	result.setDate(Math.min(dayOfMonth, daysInMonth(result.getFullYear(), result.getMonth())));
	return result;
}

export function addYears(date: Date, years: number): Date {
	return addMonths(date, years * 12);
}

/** Number of days in `month` (0-indexed) of `year`. */
export function daysInMonth(year: number, month: number): number {
	// Day 0 of the following month is the last day of this one.
	return new Date(year, month + 1, 0).getDate();
}

export function isSameDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

/** Stable `YYYY-MM-DD` rendering in local time, used for keys and assertions. */
export function toISODate(date: Date): string {
	const year = String(date.getFullYear()).padStart(4, "0");
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}
