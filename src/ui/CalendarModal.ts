import { App, Modal, Platform, moment } from "obsidian";
import {
	addDays,
	addMonths,
	addYears,
	isSameDay,
	startOfDay,
	toISODate,
} from "../calendar/dateMath";
import { buildMonthGrid, weekdayOrder } from "../calendar/monthGrid";
import type { TitleMode, WeekStart } from "../settings";
import {
	type CalendarAction,
	bindingsFor,
	hintFor,
	type KeymapMode,
	resolveAction,
} from "./keymap";

export interface CalendarModalOptions {
	weekStart: WeekStart;
	titleMode: TitleMode;
	keymap: KeymapMode;
	/** Whether a daily note already exists for a given day, used to mark cells. */
	hasNote: (date: Date) => boolean;
	/** Invoked after the modal closes, with the day the user confirmed. */
	onPick: (date: Date, newTab: boolean) => void;
}

/** Months on one continuous axis, so the sign of a difference is a direction. */
function monthNumber(date: Date): number {
	return date.getFullYear() * 12 + date.getMonth();
}

/**
 * A month grid driven entirely from the keyboard.
 *
 * `Modal` owns a `Scope` that Obsidian pushes onto the keymap stack on open and
 * pops on close, so the keys registered here never leak into the editor
 * underneath and no manual teardown is needed.
 */
export class CalendarModal extends Modal {
	private focused: Date;
	private readonly today = startOfDay(new Date());
	private readonly weekStart: number;

	private monthEl!: HTMLElement;
	private gridEl!: HTMLElement;
	private weekdaysEl!: HTMLElement;
	private weeksEl!: HTMLElement;
	private readonly cellEls = new Map<string, HTMLElement>();
	private renderedMonth: number | null = null;

	constructor(
		app: App,
		private readonly options: CalendarModalOptions,
		initialDate: Date = new Date(),
	) {
		super(app);
		this.focused = startOfDay(initialDate);
		this.weekStart = resolveWeekStart(options.weekStart);
	}

	override onOpen(): void {
		this.modalEl.addClass("calendar-palette-modal");
		this.buildChrome();
		this.registerKeys();
		this.render(true);
	}

	override onClose(): void {
		this.titleEl.empty();
		this.titleEl.hidden = false;
		this.contentEl.empty();
		this.cellEls.clear();
	}

	private buildChrome(): void {
		const paletteEl = this.contentEl.createDiv({ cls: "calendar-palette" });

		// Always built, even when the modal title carries the month: the grid
		// names itself from this line, so it has to stay current while hidden.
		this.monthEl = paletteEl.createDiv({ cls: "calendar-palette-month" });

		this.gridEl = paletteEl.createDiv({
			cls: "calendar-palette-grid",
			attr: { role: "grid" },
		});

		this.weekdaysEl = this.gridEl.createDiv({
			cls: "calendar-palette-weekdays",
			attr: { role: "row" },
		});
		// weekdaysShort() is Sunday-first regardless of locale, so the index
		// lines up with the day numbers weekdayOrder() returns.
		const labels = moment.weekdaysShort();
		for (const weekday of weekdayOrder(this.weekStart)) {
			this.weekdaysEl.createDiv({
				text: labels[weekday] ?? "",
				attr: { role: "columnheader" },
			});
		}

		// role="presentation" so the clipping box drops out of the accessibility
		// tree and the panes inside it stay direct rowgroup children of the grid.
		this.weeksEl = this.gridEl.createDiv({
			cls: "calendar-palette-weeks",
			attr: { role: "presentation" },
		});

		paletteEl.createDiv({
			cls: "calendar-palette-hint",
			text: hintFor(this.options.keymap),
		});
	}

	/**
	 * One catch-all handler rather than a `scope.register` per binding, because
	 * the emacs mode needs `KeyboardEvent.code`: macOS composes Option+V into
	 * "√", and `Scope` only ever matches on `key`. Anything unrecognised falls
	 * through untouched, so Escape still closes the modal.
	 */
	private registerKeys(): void {
		const bindings = bindingsFor(this.options.keymap);
		this.scope.register(null, null, (evt) => {
			const action = resolveAction(bindings, evt, Platform.isMacOS);
			if (action === null) return;
			evt.preventDefault();
			this.run(action);
			return false;
		});
	}

	private run(action: CalendarAction): void {
		switch (action) {
			case "open":
				return this.pick(false);
			case "open-in-new-tab":
				return this.pick(true);
			default:
				return this.setFocus(step(action, this.focused, this.today));
		}
	}

	private setFocus(date: Date): void {
		this.focused = date;
		this.render();
	}

	/**
	 * @param force - The initial open rather than navigation, so the grid is
	 * rebuilt but lands without moving.
	 */
	private render(force = false): void {
		const month = monthNumber(this.focused);
		const direction =
			force || this.renderedMonth === null || month === this.renderedMonth
				? 0
				: Math.sign(month - this.renderedMonth);

		if (force || month !== this.renderedMonth) {
			this.renderedMonth = month;
			this.swapIn(this.weeksEl, this.buildPane(), direction);
		}
		this.renderHeadings(direction);
		this.highlightFocus();

		// Only on a forced render — the open. That is the time the columns can
		// have been built, and measuring forces a layout, which has no business
		// running on every arrow key.
		if (force) this.alignHeadingToColumns();
	}

	/**
	 * The month appears exactly once. When the modal title carries it, the
	 * separate month line is redundant and goes away; the live region moves with
	 * it so the month is still announced on paging.
	 */
	private renderHeadings(direction: number): void {
		const mode = this.options.titleMode;
		const titleCarriesMonth = mode === "title-left" || mode === "title-center";
		const monthText = moment(this.focused).format("MMMM YYYY");

		// Hidden state first: swapIn skips the animation on a hidden host, so
		// only the heading actually on screen moves.
		this.titleEl.hidden = mode === "month-only";
		this.monthEl.hidden = titleCarriesMonth;

		this.setLabel(this.titleEl, titleCarriesMonth ? monthText : "Calendar", direction);
		this.titleEl.toggleClass("x-title-center", mode === "title-center");
		this.setLabel(this.monthEl, monthText, direction);

		this.titleEl.toggleAttribute("aria-live", titleCarriesMonth);
		this.monthEl.toggleAttribute("aria-live", !titleCarriesMonth);
		// The grid names itself from the month, whichever line is showing it.
		this.gridEl.setAttribute("aria-label", monthText);
	}

	/**
	 * Builds one month as a self-contained pane and takes ownership of
	 * `cellEls`, so the map only ever holds the month currently on screen — a
	 * pane on its way out must not answer to `highlightFocus()`.
	 */
	private buildPane(): HTMLElement {
		const pane = createDiv({ cls: "calendar-palette-pane", attr: { role: "rowgroup" } });
		this.cellEls.clear();

		for (const week of buildMonthGrid(this.focused, this.weekStart)) {
			const rowEl = pane.createDiv({ cls: "calendar-palette-week", attr: { role: "row" } });
			for (const cell of week) {
				const cellEl = rowEl.createDiv({
					cls: "calendar-palette-day",
					text: String(cell.date.getDate()),
					attr: {
						role: "gridcell",
						"aria-label": moment(cell.date).format("LL"),
					},
				});
				cellEl.toggleClass("is-outside-month", !cell.inCurrentMonth);
				cellEl.toggleClass("is-today", isSameDay(cell.date, this.today));
				// A CSS ::after dot rather than a child element, so the text set
				// above stays the single source of the cell's text content.
				cellEl.toggleClass("has-note", this.options.hasNote(cell.date));

				const date = cell.date;
				cellEl.addEventListener("click", (evt) => {
					this.focused = date;
					this.pick(evt.metaKey || evt.ctrlKey);
				});

				this.cellEls.set(toISODate(cell.date), cellEl);
			}
		}
		return pane;
	}

	/**
	 * Sets a one-line heading, sliding sideways if the text actually changes.
	 * The guard matters: this runs on every arrow key, and a day moving within
	 * its month must not make the heading twitch. It is also what keeps a
	 * heading reading a fixed "Calendar" from animating at all.
	 */
	private setLabel(host: HTMLElement, text: string, direction: number): void {
		const current = host.querySelector(":scope > .is-current");
		if (current?.textContent === text) return;

		this.swapIn(host, createSpan({ cls: "calendar-palette-label", text }), direction);
	}

	/**
	 * Puts `incoming` into `host`, animating out whatever it replaces.
	 * `direction` is +1 for a later month, -1 for an earlier one, and 0 for a
	 * re-render in place, which should not move.
	 *
	 * The week grid and the month label share this: which keyframes run is
	 * decided in CSS from the child's class and the host's `data-page-dir`, so
	 * the two travel on different axes off one set of timings.
	 */
	private swapIn(host: HTMLElement, incoming: HTMLElement, direction: number): void {
		const outgoing = host.querySelector<HTMLElement>(":scope > .is-current");

		// A node still animating out is dropped rather than queued behind the
		// new one: holding Page down should page as fast as the key repeats.
		for (const stale of Array.from(host.querySelectorAll(":scope > .is-leaving"))) {
			stale.remove();
		}

		incoming.addClass("is-current");

		// Without an animation there is no animationend, so the outgoing node
		// would never be cleaned up — replace outright instead of sliding. A
		// hidden host runs no animation either, so it takes the same path.
		const animated = direction !== 0 && outgoing !== null && !host.hidden && prefersMotion();
		if (!animated) {
			host.replaceChildren(incoming);
			return;
		}

		host.dataset.pageDir = direction > 0 ? "forward" : "back";
		outgoing.removeClass("is-current");
		outgoing.removeClass("is-entering");
		outgoing.addClass("is-leaving");
		// The old month stays painted for the duration; keep it out of the
		// accessibility tree so nothing reports two months, and so the heading
		// — a live region — is not read out twice.
		outgoing.setAttribute("aria-hidden", "true");
		incoming.addClass("is-entering");

		host.append(incoming);
		outgoing.addEventListener("animationend", () => outgoing.remove(), { once: true });
		incoming.addEventListener("animationend", () => incoming.removeClass("is-entering"), {
			once: true,
		});
	}

	/**
	 * Publishes how far the first column's label sits inside the grid, so the
	 * heading can match it.
	 *
	 * Measured with a Range rather than the element box: the column header spans
	 * a full seventh of the grid and says nothing about where its three
	 * characters actually landed inside it. The grid itself does not move, so
	 * one pass is exact and re-running it is a no-op.
	 */
	private alignHeadingToColumns(): void {
		const label = this.weekdaysEl.firstElementChild;
		if (!label || label.textContent === "") return;

		const gridBox = this.gridEl.getBoundingClientRect();
		// Obsidian opens the modal on a scale transform, and
		// getBoundingClientRect reports pixels after it, so measuring
		// mid-animation lands short. offsetWidth is untransformed layout, so
		// their ratio undoes whatever scaling happens to be in flight.
		const scale = this.gridEl.offsetWidth ? gridBox.width / this.gridEl.offsetWidth : 1;

		const glyphs = this.gridEl.doc.createRange();
		glyphs.selectNodeContents(label);
		const inset = (glyphs.getBoundingClientRect().left - gridBox.left) / scale;
		this.modalEl.style.setProperty("--cp-column-inset", `${inset}px`);
	}

	private highlightFocus(): void {
		for (const cellEl of this.cellEls.values()) {
			cellEl.removeClass("is-focused");
			cellEl.removeAttribute("aria-selected");
		}
		const focusedEl = this.cellEls.get(toISODate(this.focused));
		focusedEl?.addClass("is-focused");
		focusedEl?.setAttribute("aria-selected", "true");
	}

	private pick(newTab: boolean): void {
		const date = this.focused;
		// Close first so the confirmation dialog (if any) is not stacked on top
		// of the calendar, and so the opened note gets the focus.
		this.close();
		this.options.onPick(date, newTab);
	}
}

/** Where a movement action lands, given where the focus is now. */
function step(action: CalendarAction, from: Date, today: Date): Date {
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

/** Maps the setting onto a moment weekday index, 0 = Sunday. */
function resolveWeekStart(setting: WeekStart): number {
	switch (setting) {
		case "sunday":
			return 0;
		case "monday":
			return 1;
		default:
			return moment.localeData().firstDayOfWeek();
	}
}

/**
 * Checked in script rather than left to a CSS media query: the paging code
 * relies on `animationend` to retire the outgoing pane, and a rule that
 * cancelled the animation would strand it on screen.
 */
function prefersMotion(): boolean {
	return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
