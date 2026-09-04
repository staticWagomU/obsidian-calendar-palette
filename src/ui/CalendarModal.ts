import { App, Modal, moment, type Modifier } from "obsidian";
import {
	addDays,
	addMonths,
	addYears,
	isSameDay,
	startOfDay,
	toISODate,
} from "../calendar/dateMath";
import { buildMonthGrid, weekdayOrder } from "../calendar/monthGrid";
import type { WeekStart } from "../settings";

export interface CalendarModalOptions {
	weekStart: WeekStart;
	/** Whether a daily note already exists for a given day, used to mark cells. */
	hasNote: (date: Date) => boolean;
	/** Invoked after the modal closes, with the day the user confirmed. */
	onPick: (date: Date, newTab: boolean) => void;
}

const KEY_HINT =
	"Arrows move · Page up/down changes month · T jumps to today · Enter opens · Mod+Enter opens in a new tab";

/** Months on one continuous axis, so the sign of a difference is a direction. */
function monthNumber(date: Date): number {
	return date.getFullYear() * 12 + date.getMonth();
}

/**
 * A month grid driven entirely from the keyboard.
 *
 * `Modal` owns a `Scope` that Obsidian pushes onto the keymap stack on open and
 * pops on close, so the arrow keys registered here never leak into the editor
 * underneath and no manual teardown is needed.
 */
export class CalendarModal extends Modal {
	private focused: Date;
	private readonly today = startOfDay(new Date());
	private readonly weekStart: number;

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
		this.contentEl.empty();
		this.cellEls.clear();
	}

	private buildChrome(): void {
		// The month is the heading, so it lives in .modal-title rather than on a
		// line of its own. Announcing from there keeps paging audible without a
		// second element saying the same thing.
		this.titleEl.setAttribute("aria-live", "polite");

		const paletteEl = this.contentEl.createDiv({ cls: "calendar-palette" });

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

		paletteEl.createDiv({ cls: "calendar-palette-hint", text: KEY_HINT });
	}

	private registerKeys(): void {
		const move = (step: (date: Date) => Date) => (evt: KeyboardEvent) => {
			evt.preventDefault();
			this.setFocus(step(this.focused));
			return false;
		};

		const movements: [Modifier[], string, (date: Date) => Date][] = [
			[[], "ArrowLeft", (date) => addDays(date, -1)],
			[[], "ArrowRight", (date) => addDays(date, 1)],
			[[], "ArrowUp", (date) => addDays(date, -7)],
			[[], "ArrowDown", (date) => addDays(date, 7)],
			[[], "PageUp", (date) => addMonths(date, -1)],
			[[], "PageDown", (date) => addMonths(date, 1)],
			[["Shift"], "PageUp", (date) => addYears(date, -1)],
			[["Shift"], "PageDown", (date) => addYears(date, 1)],
			[[], "Home", () => this.today],
			// Most Mac keyboards have no Home key, so offer a letter alias. The
			// modal has no text input, so a bare letter cannot swallow typing.
			[[], "t", () => this.today],
		];
		for (const [modifiers, key, step] of movements) {
			this.scope.register(modifiers, key, move(step));
		}

		this.scope.register([], "Enter", (evt) => {
			evt.preventDefault();
			this.pick(false);
			return false;
		});
		this.scope.register(["Mod"], "Enter", (evt) => {
			evt.preventDefault();
			this.pick(true);
			return false;
		});
	}

	private setFocus(date: Date): void {
		this.focused = date;
		this.render();
	}

	/**
	 * @param force - A settings change or the initial open rather than
	 * navigation, so the grid is rebuilt but lands without moving.
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
		this.setLabel(this.titleEl, moment(this.focused).format("MMMM YYYY"), direction);
		this.highlightFocus();

		// Only on a forced render — open, or a settings change. Those are the
		// times the columns can have been rebuilt, and measuring forces a
		// layout, which has no business running on every arrow key.
		if (force) this.alignHeadingToColumns();
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
	 * its month must not make the heading twitch.
	 */
	private setLabel(host: HTMLElement, text: string, direction: number): void {
		const current = host.querySelector(":scope > .is-current");
		if (current?.textContent === text) return;

		// The grid names itself from the heading, so they change together.
		this.gridEl.setAttribute("aria-label", text);
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
		// would never be cleaned up — replace outright instead of sliding.
		if (direction === 0 || !outgoing || !prefersMotion()) {
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
