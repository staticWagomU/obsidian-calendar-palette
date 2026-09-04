/**
 * Where the focus lands, and which way the grid should travel to get there.
 *
 * Split out of the modal because these are the two rules with edge cases worth
 * pinning down — clamping across month lengths, and not animating a move that
 * stays inside one month — and neither needs a DOM or an `obsidian` import.
 */

import type { WeekStart } from "../settings";
import type { CalendarAction } from "../ui/keymap";
import { addDays, addMonths, addYears } from "./dateMath";

/** Months on one continuous axis, so the sign of a difference is a direction. */
export function monthNumber(date: Date): number {
	return date.getFullYear() * 12 + date.getMonth();
}

/** Where a movement action lands, given where the focus is now. */
export function step(action: CalendarAction, from: Date, today: Date): Date {
	switch (action) {
		case "prev-day":
			return addDays(from, -1);
		case "next-day":
			return addDays(from, 1);
		case "prev-week":
			return addDays(from, -7);
		case "next-week":
			return addDays(from, 7);
		case "prev-month":
			return addMonths(from, -1);
		case "next-month":
			return addMonths(from, 1);
		case "prev-year":
			return addYears(from, -1);
		case "next-year":
			return addYears(from, 1);
		default:
			return today;
	}
}

/**
 * Which way a render should travel: +1 for a later month, -1 for an earlier
 * one, and 0 for anything that must not move.
 *
 * @param renderedMonth - Month currently on screen, or null before the first render.
 * @param force - The initial open rather than navigation, so the grid is
 * rebuilt but lands without moving.
 */
export function pageDirection(
	renderedMonth: number | null,
	targetMonth: number,
	force: boolean,
): number {
	if (force || renderedMonth === null) return 0;
	return Math.sign(targetMonth - renderedMonth);
}

/**
 * Maps the setting onto a weekday index, 0 = Sunday.
 *
 * @param localeFirstDay - What the active moment locale starts its week on,
 * which is the only part the caller has to reach into `obsidian` for.
 */
export function resolveWeekStart(setting: WeekStart, localeFirstDay: number): number {
	switch (setting) {
		case "sunday":
			return 0;
		case "monday":
			return 1;
		default:
			return localeFirstDay;
	}
}
