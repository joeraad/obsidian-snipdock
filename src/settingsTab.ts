import { App, PluginSettingTab, Setting, TextAreaComponent } from "obsidian";
import type SnipDockPlugin from "./main";
import {
	COLUMN_COUNT_MAX,
	COLUMN_COUNT_MIN,
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

		const multiColumn = this.plugin.settings.multiColumn;

		new Setting(containerEl)
			.setName(multiColumn ? "Column width" : "Menu width")
			.setDesc(
				multiColumn
					? "Width of each column, in pixels."
					: "Width of the status-bar menu, in pixels."
			)
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

		new Setting(containerEl)
			.setName("Anchor to status bar icon")
			.setDesc(
				"Open the menu directly above the status-bar icon instead of the corner of the window."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.anchorToStatusBar)
					.onChange((value) => {
						this.plugin.settings.anchorToStatusBar = value;
						void this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Search bar")
			.setDesc("Show a search box that filters the snippet list as you type.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableSearch)
					.onChange((value) => {
						this.plugin.settings.enableSearch = value;
						void this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Multi-column layout")
			.setDesc(
				"Lay snippets out across multiple columns instead of a single list."
			)
			.addToggle((toggle) =>
				toggle.setValue(multiColumn).onChange((value) => {
					this.plugin.settings.multiColumn = value;
					void this.plugin.saveSettings();
					this.display();
				})
			);

		if (multiColumn) {
			new Setting(containerEl)
				.setName("Columns")
				.setDesc("How many columns to split the snippets across.")
				.addSlider((slider) =>
					slider
						.setLimits(COLUMN_COUNT_MIN, COLUMN_COUNT_MAX, 1)
						.setValue(this.plugin.settings.columnCount)
						.setDynamicTooltip()
						.onChange((value) => {
							this.plugin.settings.columnCount = value;
							void this.plugin.saveSettings();
						})
				)
				.addExtraButton((btn) =>
					btn
						.setIcon("rotate-ccw")
						.setTooltip(
							`Reset to default (${DEFAULT_SETTINGS.columnCount})`
						)
						.onClick(() => {
							this.plugin.settings.columnCount =
								DEFAULT_SETTINGS.columnCount;
							void this.plugin.saveSettings();
							this.display();
						})
				);

			new Setting(containerEl)
				.setName("Column-first sorting")
				.setDesc(
					"Fill each column top-to-bottom before moving to the next, instead of dealing snippets row-by-row across columns."
				)
				.addToggle((toggle) =>
					toggle
						.setValue(this.plugin.settings.columnFirstSort)
						.onChange((value) => {
							this.plugin.settings.columnFirstSort = value;
							void this.plugin.saveSettings();
						})
				);
		}

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
