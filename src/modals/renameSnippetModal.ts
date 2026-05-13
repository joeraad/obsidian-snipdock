import { ButtonComponent, Modal, Notice, Setting, TextComponent } from "obsidian";
import type SnipDockPlugin from "../main";

export class RenameSnippetModal extends Modal {
	private readonly plugin: SnipDockPlugin;
	private readonly originalName: string;
	private nameInput!: TextComponent;

	constructor(plugin: SnipDockPlugin, snippetName: string) {
		super(plugin.app);
		this.plugin = plugin;
		this.originalName = snippetName;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		new Setting(contentEl).setName("Rename CSS snippet").setHeading();

		new Setting(contentEl)
			.setName("New name")
			.setDesc(`Renaming "${this.originalName}.css". The .css suffix is added automatically.`)
			.addText((text) => {
				this.nameInput = text;
				text.setValue(this.originalName);
			});

		const buttonRow = contentEl.createDiv({ cls: "snipdock-modal-buttons" });
		new ButtonComponent(buttonRow)
			.setButtonText("Rename")
			.setCta()
			.onClick(() => void this.submit());

		this.nameInput.inputEl.focus();
		this.nameInput.inputEl.select();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private async submit(): Promise<void> {
		const next = this.nameInput.getValue().trim();
		if (!next) {
			new Notice("SnipDock: please enter a new name.");
			return;
		}
		if (next === this.originalName) {
			this.close();
			return;
		}

		const customCss = this.plugin.app.customCss;
		if (customCss.snippets.includes(next)) {
			new Notice(`SnipDock: a snippet called "${next}" already exists.`);
			return;
		}

		const adapter = this.plugin.app.vault.adapter;
		const oldPath = customCss.getSnippetPath(this.originalName);
		const folder = customCss.getSnippetsFolder();
		const newPath = `${folder}/${next}.css`;

		const wasEnabled = customCss.enabledSnippets.has(this.originalName);
		if (wasEnabled) customCss.setCssEnabledStatus(this.originalName, false);

		await adapter.rename(oldPath, newPath);
		customCss.requestLoadSnippets();

		if (wasEnabled) {
			const win = this.plugin.app.workspace.containerEl.win;
			win.setTimeout(() => customCss.setCssEnabledStatus(next, true), 100);
		}

		new Notice(`SnipDock: renamed to "${next}.css".`);
		this.close();
	}
}
