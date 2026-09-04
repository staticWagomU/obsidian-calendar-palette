import { moment } from "obsidian";

/**
 * The one place that touches `moment`, because the `obsidian` types get it
 * wrong under TypeScript 6 and 7.
 *
 * `obsidian.d.ts` does `import * as Moment from 'moment'` and re-exports
 * `export const moment: typeof Moment`. TypeScript 7 removed the option to
 * turn `esModuleInterop` off, and with interop on, a namespace import of a
 * CommonJS `export =` module is a plain object with no call signatures — so
 * `moment(date)` stops type-checking (`TS2349`) even though it works at
 * runtime. Property access like `moment.weekdaysShort()` is unaffected, which
 * is why only the call form needs the cast below.
 *
 * Keeping every use behind this module means the cast exists once, and this
 * file is the only thing to delete when the `obsidian` package fixes its
 * declaration. Check with `vp lint --type-aware --type-check`; the day it
 * reports nothing, inline these three functions and remove the file.
 */
type MomentCall = (input: Date) => { format: (pattern: string) => string };

// oxlint-disable-next-line typescript/no-unsafe-type-assertion
const callMoment = moment as unknown as MomentCall;

/** Renders `date` with a moment pattern, e.g. `"YYYY-MM-DD"`. */
export function formatMoment(date: Date, pattern: string): string {
	return callMoment(date).format(pattern);
}

/** What the active locale starts its week on, 0 = Sunday. */
export function localeFirstDayOfWeek(): number {
	return moment.localeData().firstDayOfWeek();
}

/** Short weekday names, always Sunday-first regardless of locale. */
export function weekdayShortLabels(): string[] {
	return moment.weekdaysShort();
}
