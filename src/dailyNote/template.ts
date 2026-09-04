export interface TemplateContext {
	/** Formats the note's date with a moment pattern. Injected to keep this module obsidian-free. */
	formatDate: (pattern: string) => string;
	/**
	 * Formats the creation time. Separate from `formatDate` because the note's
	 * date sits at local midnight, so reusing it would render every `{{time}}`
	 * as 00:00 instead of the time the note was actually created.
	 */
	formatTime: (pattern: string) => string;
	/** Pattern used for a bare `{{date}}` — the daily note filename format. */
	dateFormat: string;
	/** Pattern used for a bare `{{time}}`. */
	timeFormat: string;
	/** Expansion for `{{title}}` — the note's basename. */
	title: string;
}

/**
 * Matches `{{date}}`, `{{time}}` and `{{title}}`, optionally followed by
 * `:pattern`. The pattern half is `[^}]*` rather than `[^:}]*` so that time
 * patterns keep their own colons (`{{time:HH:mm}}`).
 */
const PLACEHOLDER = /\{\{\s*(date|time|title)\s*(?::([^}]*))?\}\}/gi;

/**
 * Expands the placeholders Obsidian's core daily notes plugin supports.
 *
 * Unrecognised placeholders are left verbatim: Templater and friends run their
 * own pass over the file after creation, and eating their syntax would break them.
 */
export function applyTemplate(template: string, context: TemplateContext): string {
	return template.replace(PLACEHOLDER, (_match, name: string, pattern?: string) => {
		const explicitFormat = pattern?.trim();
		switch (name.toLowerCase()) {
			case "date":
				return context.formatDate(explicitFormat || context.dateFormat);
			case "time":
				return context.formatTime(explicitFormat || context.timeFormat);
			default:
				return context.title;
		}
	});
}
