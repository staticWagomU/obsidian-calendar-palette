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

	private titleTextEl!: HTMLElement;
	private gridBodyEl!: HTMLElement;
	private readonly cellEls = new Map<string, HTMLElement>();
	private renderedMonthKey = "";

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
		this.titleEl.setText("Calendar");
		this.buildChrome();
		this.registerKeys();
		this.render();
	}

	override onClose(): void {
		this.contentEl.empty();
		this.cellEls.clear();
	}

	private buildChrome(): void {
		const { contentEl } = this;
		contentEl.addClass("calendar-palette");

		this.titleTextEl = contentEl.createDiv({
			cls: "calendar-palette-month",
			// Announce month changes to screen readers, since focus never moves.
			attr: { "aria-live": "polite" },
		});

		const table = contentEl.createEl("table", {
			cls: "calendar-palette-grid",
			attr: { role: "grid" },
		});

		// role="grid" suppresses the table's implicit row/cell roles, so every
		// descendant has to declare its own.
		const headRow = table.createEl("thead").createEl("tr", { attr: { role: "row" } });
		// weekdaysShort() is Sunday-first regardless of locale, so the index
		// lines up with the day numbers weekdayOrder() returns.
		const labels = moment.weekdaysShort();
		for (const weekday of weekdayOrder(this.weekStart)) {
			headRow.createEl("th", {
				text: labels[weekday] ?? "",
				attr: { role: "columnheader", scope: "col" },
			});
		}

		this.gridBodyEl = table.createEl("tbody");

		contentEl.createDiv({ cls: "calendar-palette-hint", text: KEY_HINT });
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

	private render(): void {
		const monthKey = `${this.focused.getFullYear()}-${this.focused.getMonth()}`;
		if (monthKey !== this.renderedMonthKey) {
			this.renderedMonthKey = monthKey;
			this.titleTextEl.setText(moment(this.focused).format("MMMM YYYY"));
			this.renderGrid();
		}
		this.highlightFocus();
	}

	private renderGrid(): void {
		this.gridBodyEl.empty();
		this.cellEls.clear();

		for (const week of buildMonthGrid(this.focused, this.weekStart)) {
			const rowEl = this.gridBodyEl.createEl("tr", { attr: { role: "row" } });
			for (const cell of week) {
				const cellEl = rowEl.createEl("td", {
					cls: "calendar-palette-day",
					text: String(cell.date.getDate()),
					attr: {
						role: "gridcell",
						"aria-label": moment(cell.date).format("LL"),
					},
				});
				cellEl.toggleClass("is-outside-month", !cell.inCurrentMonth);
				cellEl.toggleClass("is-today", isSameDay(cell.date, this.today));
				// A CSS ::after dot rather than a child element, so setText above
				// stays the single source of the cell's text content.
				cellEl.toggleClass("has-note", this.options.hasNote(cell.date));

				const date = cell.date;
				cellEl.addEventListener("click", (evt) => {
					this.focused = date;
					this.pick(evt.metaKey || evt.ctrlKey);
				});

				this.cellEls.set(toISODate(cell.date), cellEl);
			}
		}
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
