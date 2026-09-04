import { App, ButtonComponent, Modal } from "obsidian";

interface ConfirmModalOptions {
	title: string;
	message: string;
	cta: string;
	onResolve: (confirmed: boolean) => void;
}

/**
 * Yes/no dialog that always settles exactly once, including when the user
 * dismisses it with Escape or by clicking the backdrop.
 */
class ConfirmModal extends Modal {
	private settled = false;

	constructor(
		app: App,
		private readonly options: ConfirmModalOptions,
	) {
		super(app);
	}

	override onOpen(): void {
		this.titleEl.setText(this.options.title);
		this.contentEl.createEl("p", { text: this.options.message });

		const buttons = this.contentEl.createDiv({ cls: "modal-button-container" });
		new ButtonComponent(buttons).setButtonText("Cancel").onClick(() => this.settle(false));
		new ButtonComponent(buttons)
			.setButtonText(this.options.cta)
			.setCta()
			.onClick(() => this.settle(true))
			.buttonEl.focus();

		this.scope.register([], "Enter", (evt) => {
			evt.preventDefault();
			this.settle(true);
			return false;
		});
	}

	override onClose(): void {
		this.contentEl.empty();
		// Escape and backdrop clicks reach here without going through settle().
		this.settle(false);
	}

	private settle(confirmed: boolean): void {
		if (this.settled) return;
		this.settled = true;
		this.options.onResolve(confirmed);
		this.close();
	}
}

/** Asks whether to create a missing daily note. Resolves false if dismissed. */
export function confirmCreateNote(app: App, path: string): Promise<boolean> {
	return new Promise((resolve) => {
		new ConfirmModal(app, {
			title: "Create daily note",
			message: `${path} does not exist yet. Create it?`,
			cta: "Create",
			onResolve: resolve,
		}).open();
	});
}
