import { App, PluginSettingTab, Setting, TextAreaComponent } from "obsidian";
import type SnipDockPlugin from "./main";
import {
	DEFAULT_SETTINGS,
	MENU_HEIGHT_MAX,
	MENU_HEIGHT_MIN,
	MENU_WIDTH_MAX,
	MENU_WIDTH_MIN,
} from "./settings";

export class SnipDockSettingTab extends PluginSettingTab {
	private readonly plugin: SnipDockPlugin;

	constructor(app: App, plugin: SnipDockPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName("Menu").setHeading();

		new Setting(containerEl)
			.setName("Menu width")
			.setDesc("Width of the status-bar menu, in pixels.")
			.addSlider((slider) =>
				slider
					.setLimits(MENU_WIDTH_MIN, MENU_WIDTH_MAX, 10)
					.setValue(this.plugin.settings.menuWidth)
					.setDynamicTooltip()
					.onChange((value) => {
						this.plugin.settings.menuWidth = value;
						void this.plugin.saveSettings();
					})
			)
			.addExtraButton((btn) =>
				btn
					.setIcon("rotate-ccw")
					.setTooltip(`Reset to default (${DEFAULT_SETTINGS.menuWidth}px)`)
					.onClick(() => {
						this.plugin.settings.menuWidth = DEFAULT_SETTINGS.menuWidth;
						void this.plugin.saveSettings();
						this.display();
					})
			);

		new Setting(containerEl)
			.setName("Menu max height")
			.setDesc("Maximum height of the menu, as a percentage of the window height.")
			.addSlider((slider) =>
				slider
					.setLimits(MENU_HEIGHT_MIN, MENU_HEIGHT_MAX, 5)
					.setValue(this.plugin.settings.menuMaxHeightVh)
					.setDynamicTooltip()
					.onChange((value) => {
						this.plugin.settings.menuMaxHeightVh = value;
						void this.plugin.saveSettings();
					})
			)
			.addExtraButton((btn) =>
				btn
					.setIcon("rotate-ccw")
					.setTooltip(`Reset to default (${DEFAULT_SETTINGS.menuMaxHeightVh}%)`)
					.onClick(() => {
						this.plugin.settings.menuMaxHeightVh =
							DEFAULT_SETTINGS.menuMaxHeightVh;
						void this.plugin.saveSettings();
						this.display();
					})
			);

		new Setting(containerEl).setName("New snippets").setHeading();

		new Setting(containerEl)
			.setName("Open after creating")
			.setDesc("Open the new snippet in your default app right after it is created.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.autoOpenOnCreate).onChange((value) => {
					this.plugin.settings.autoOpenOnCreate = value;
					void this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Enable on creation")
			.setDesc("Activate new snippets automatically as soon as they are created.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.enableNewByDefault).onChange((value) => {
					this.plugin.settings.enableNewByDefault = value;
					void this.plugin.saveSettings();
				})
			);

		const template = new Setting(containerEl)
			.setName("Snippet template")
			.setDesc("Starter CSS used when creating a new snippet from the menu.");
		template.settingEl.addClass("snipdock-stacked-setting");
		const editor = new TextAreaComponent(template.controlEl);
		editor.inputEl.addClass("snipdock-css-editor");
		editor.setValue(this.plugin.settings.defaultSnippetTemplate).onChange((value) => {
			this.plugin.settings.defaultSnippetTemplate = value;
			void this.plugin.saveSettings();
		});

		this.renderCredits(containerEl);
	}

	private renderCredits(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Credits").setHeading();

		new Setting(containerEl).setName("Author").setDesc(
			this.linkFragment("Joe Raad", "https://github.com/joeraad")
		);

		new Setting(containerEl)
			.setName(
				this.linkFragment(
					"MySnippets",
					"https://github.com/chetachiezikeuzor/MySnippets-Plugin"
				)
			)
			.setDesc(
				"By Chetachi Ezikeuzor. The original status-bar snippet manager that inspired this rewrite."
			);

		new Setting(containerEl)
			.setName(this.linkFragment("Lucide", "https://lucide.dev/"))
			.setDesc("Icon set used throughout the menu.");
	}

	private linkFragment(text: string, href: string): DocumentFragment {
		return createFragment((frag) => {
			frag.createEl("a", { text, href });
		});
	}
}
