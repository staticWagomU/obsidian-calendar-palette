/**
 * Key bindings for the calendar grid.
 *
 * Deliberately free of Obsidian imports: matching a keystroke to an action is
 * the part with rules worth testing, and `Scope` only ever hands us a
 * `KeyboardEvent`.
 */

/** Which extra key set is layered on top of the arrows. */
export type KeymapMode = "default" | "vim" | "emacs";

export type CalendarAction =
	| "prev-day"
	| "next-day"
	| "prev-week"
	| "next-week"
	| "prev-month"
	| "next-month"
	| "prev-year"
	| "next-year"
	| "today"
	| "open"
	| "open-in-new-tab";

export interface KeyBinding {
	/** A `KeyboardEvent.key` value, compared case-insensitively when it is one character. */
	key: string;
	/**
	 * A `KeyboardEvent.code` value, used in place of `key` whenever Alt is part
	 * of the binding: macOS composes Option+V into "√", so `key` says nothing
	 * about which key was struck once Alt is down.
	 */
	code?: string;
	/** Control itself, never Command — Emacs bindings are Control on every platform. */
	ctrl?: boolean;
	alt?: boolean;
	shift?: boolean;
	/** Command on macOS, Control elsewhere — Obsidian's `Mod`. */
	mod?: boolean;
	action: CalendarAction;
}

/** The parts of a KeyboardEvent the matcher reads. */
export interface KeyStroke {
	key: string;
	code: string;
	ctrlKey: boolean;
	metaKey: boolean;
	altKey: boolean;
	shiftKey: boolean;
}

/**
 * Always active, whichever mode is chosen. A vim or emacs user gets their keys
 * in addition to the arrows rather than instead of them: the modal is also
 * driven by mouse and by people who never opted into either scheme, and the
 * arrows are what the hint line has to fall back on.
 */
const BASE: KeyBinding[] = [
	{ key: "ArrowLeft", action: "prev-day" },
	{ key: "ArrowRight", action: "next-day" },
	{ key: "ArrowUp", action: "prev-week" },
	{ key: "ArrowDown", action: "next-week" },
	{ key: "PageUp", action: "prev-month" },
	{ key: "PageDown", action: "next-month" },
	{ key: "PageUp", shift: true, action: "prev-year" },
	{ key: "PageDown", shift: true, action: "next-year" },
	{ key: "Home", action: "today" },
	// Most Mac keyboards have no Home key, so offer a letter alias. The modal
	// has no text input, so a bare letter cannot swallow typing.
	{ key: "t", action: "today" },
	{ key: "Enter", action: "open" },
	{ key: "Enter", mod: true, action: "open-in-new-tab" },
];

/**
 * hjkl for the small units, and vim's own paging keys for the large ones:
 * Ctrl+B/Ctrl+F already mean "a screenful back/forward", which is what a month
 * is here. Shift widens the unit from month to year, matching the rule the
 * arrows follow with Shift+Page up.
 */
const VIM: KeyBinding[] = [
	{ key: "h", action: "prev-day" },
	{ key: "l", action: "next-day" },
	{ key: "k", action: "prev-week" },
	{ key: "j", action: "next-week" },
	{ key: "b", ctrl: true, action: "prev-month" },
	{ key: "f", ctrl: true, action: "next-month" },
	{ key: "b", ctrl: true, shift: true, action: "prev-year" },
	{ key: "f", ctrl: true, shift: true, action: "next-year" },
];

/**
 * The bindings Emacs `calendar-mode` actually uses: C-f/C-b by day, C-n/C-p by
 * week, and `.` back to today. Month paging is Emacs' own scrolling pair, C-v
 * and M-v, rather than calendar-mode's M-{ / M-} — a lone `}` needs a different
 * physical key on half the keyboard layouts in use, and C-v/M-v do not.
 */
const EMACS: KeyBinding[] = [
	{ key: "b", ctrl: true, action: "prev-day" },
	{ key: "f", ctrl: true, action: "next-day" },
	{ key: "p", ctrl: true, action: "prev-week" },
	{ key: "n", ctrl: true, action: "next-week" },
	{ key: "v", code: "KeyV", alt: true, action: "prev-month" },
	{ key: "v", ctrl: true, action: "next-month" },
	{ key: "v", code: "KeyV", alt: true, shift: true, action: "prev-year" },
	{ key: "v", ctrl: true, shift: true, action: "next-year" },
	{ key: ".", action: "today" },
];

/**
 * Mode keys come first so they win any overlap with the base set. Nothing
 * overlaps today, but the ordering is what makes adding a mode key safe.
 */
export function bindingsFor(mode: KeymapMode): KeyBinding[] {
	switch (mode) {
		case "vim":
			return [...VIM, ...BASE];
		case "emacs":
			return [...EMACS, ...BASE];
		default:
			return [...BASE];
	}
}

/** The line under the grid. Kept to the keys a user has to be told about. */
export function hintFor(mode: KeymapMode): string {
	const tail = "Enter opens · Mod+Enter opens in a new tab";
	switch (mode) {
		case "vim":
			return `h j k l move · Ctrl+B/Ctrl+F changes month · T jumps to today · ${tail}`;
		case "emacs":
			return `Ctrl+B/F/P/N move · Ctrl+V and Alt+V change month · . jumps to today · ${tail}`;
		default:
			return `Arrows move · Page up/down changes month · T jumps to today · ${tail}`;
	}
}

/** The first binding the keystroke satisfies, or null if it is not ours. */
export function resolveAction(
	bindings: readonly KeyBinding[],
	stroke: KeyStroke,
	isMacOS: boolean,
): CalendarAction | null {
	for (const binding of bindings) {
		if (matches(binding, stroke, isMacOS)) return binding.action;
	}
	return null;
}

function matches(binding: KeyBinding, stroke: KeyStroke, isMacOS: boolean): boolean {
	// Every modifier is checked, including the ones the binding does not ask
	// for: Ctrl+Alt+F must not fire the binding that wants a plain Ctrl+F.
	const wantsCtrl = binding.ctrl === true || (binding.mod === true && !isMacOS);
	const wantsMeta = binding.mod === true && isMacOS;
	if (stroke.ctrlKey !== wantsCtrl) return false;
	if (stroke.metaKey !== wantsMeta) return false;
	if (stroke.altKey !== (binding.alt === true)) return false;
	if (stroke.shiftKey !== (binding.shift === true)) return false;

	if (binding.alt === true && binding.code !== undefined) {
		return stroke.code === binding.code;
	}
	// Single characters are compared folded, so Shift+F still reads as "f" and
	// the shift check above is what decides whether it was wanted.
	return binding.key.length === 1
		? stroke.key.toLowerCase() === binding.key
		: stroke.key === binding.key;
}
