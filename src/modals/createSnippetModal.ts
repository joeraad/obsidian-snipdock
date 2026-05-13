import {
	ButtonComponent,
	Modal,
	Notice,
	Setting,
	TextAreaComponent,
	TextComponent,
} from "obsidian";
import type SnipDockPlugin from "../main";

const SNIPPET_SUBFOLDER = "snippets";

export class CreateSnippetModal extends Modal {
	private readonly plugin: SnipDockPlugin;
	private nameInput!: TextComponent;
	private bodyInput!: TextAreaComponent;

	constructor(plugin: SnipDockPlugin) {
		super(plugin.app);
		this.plugin = plugin;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		new Setting(contentEl).setName("Create a CSS snippet").setHeading();

		new Setting(contentEl)
			.setName("Snippet title")
			.setDesc("File name for the new snippet, without the .css suffix.")
			.addText((text) => {
				this.nameInput = text;
				text.setPlaceholder("my-snippet");
			});

		const bodySetting = new Setting(contentEl)
			.setName("Snippet styles")
			.setDesc("CSS for this snippet. Pre-filled with your template.");
		bodySetting.settingEl.addClass("snipdock-stacked-setting");

		this.bodyInput = new TextAreaComponent(bodySetting.controlEl);
		this.bodyInput.inputEl.addClass("snipdock-css-editor");
		this.bodyInput.setValue(this.plugin.settings.defaultSnippetTemplate);

		const buttonRow = contentEl.createDiv({ cls: "snipdock-modal-buttons" });
		new ButtonComponent(buttonRow)
			.setButtonText("Create snippet")
			.setCta()
			.onClick(() => void this.submit());

		this.nameInput.inputEl.focus();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private async submit(): Promise<void> {
		const name = this.nameInput.getValue().trim();
		const body = this.bodyInput.getValue();
		if (!name) {
			new Notice("SnipDock: please enter a name for the snippet.");
			return;
		}

		const customCss = this.plugin.app.customCss;
		if (customCss.snippets.includes(name)) {
			new Notice(`SnipDock: a snippet called "${name}" already exists.`);
			return;
		}

		await ensureSnippetsFolder(this.plugin);

		const adapter = this.plugin.app.vault.adapter;
		const folder = customCss.getSnippetsFolder();
		const filePath = `${folder}/${name}.css`;
		await adapter.write(filePath, body);

		customCss.requestLoadSnippets();

		if (this.plugin.settings.enableNewByDefault) {
			customCss.setCssEnabledStatus(name, true);
		}
		if (this.plugin.settings.autoOpenOnCreate) {
			this.plugin.app.openWithDefaultApp(customCss.getSnippetPath(name));
		}

		new Notice(`SnipDock: created "${name}.css".`);
		this.close();
	}
}

export async function ensureSnippetsFolder(plugin: SnipDockPlugin): Promise<void> {
	const adapter = plugin.app.vault.adapter;
	const folder = plugin.app.customCss.getSnippetsFolder();
	const exists = await adapter.exists(folder);
	if (!exists) {
		const configDir = plugin.app.vault.configDir;
		const relative = `${configDir}/${SNIPPET_SUBFOLDER}`;
		const relativeExists = await adapter.exists(relative);
		if (!relativeExists) await adapter.mkdir(relative);
	}
}
