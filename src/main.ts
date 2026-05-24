import { Plugin, setIcon, setTooltip } from "obsidian";
import { registerIcons } from "./icons";
import { CreateSnippetModal } from "./modals/createSnippetModal";
import { DEFAULT_SETTINGS, SnipDockSettings } from "./settings";
import { SnipDockSettingTab } from "./settingsTab";
import { openSnippetMenu } from "./snippetMenu";
import type { SnipDockApp } from "./types";

export default class SnipDockPlugin extends Plugin {
	declare app: SnipDockApp;
	settings!: SnipDockSettings;
	private statusBarEl: HTMLElement | null = null;

	async onload(): Promise<void> {
		registerIcons();
		await this.loadSettings();
		this.addSettingTab(new SnipDockSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => this.mountStatusBar());

		this.addCommand({
			id: "open-snippet-menu",
			name: "Open snippet menu",
			icon: "snipdock-dock",
			callback: () => openSnippetMenu(this, this.statusBarEl),
		});

		this.addCommand({
			id: "create-snippet",
			name: "Create CSS snippet",
			icon: "plus",
			callback: () => new CreateSnippetModal(this).open(),
		});

		this.addCommand({
			id: "toggle-all-snippets",
			name: "Toggle all snippets on or off",
			callback: () => this.toggleAllSnippets(),
		});
	}

	override onunload(): void {
		this.statusBarEl?.remove();
		this.statusBarEl = null;
	}

	async loadSettings(): Promise<void> {
		const data = (await this.loadData()) as Partial<SnipDockSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data ?? {});
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	/* Flush Obsidian's `enabledCssSnippets` write to disk now. `setCssEnabledStatus`
	   debounces `saveConfig` by 1s with no quit-time flush, so ⌘Q on macOS loses
	   the toggle if the user closes within that window (issue #10). */
	flushCustomCssConfig(): void {
		void this.app.vault.saveConfig?.();
	}

	private mountStatusBar(): void {
		const el = this.addStatusBarItem();
		el.addClass("snipdock-status-button");
		el.addClass("mod-clickable");
		setIcon(el, "snipdock-dock");
		setTooltip(el, "Open SnipDock menu", { placement: "top" });
		this.registerDomEvent(el, "click", () => openSnippetMenu(this, el));
		this.statusBarEl = el;
	}

	private toggleAllSnippets(): void {
		const { customCss } = this.app;
		const anyEnabled = customCss.snippets.some((s) =>
			customCss.enabledSnippets.has(s)
		);
		if (anyEnabled) {
			this.settings.rememberedEnabled = customCss.snippets.filter((s) =>
				customCss.enabledSnippets.has(s)
			);
			for (const s of customCss.snippets) {
				customCss.setCssEnabledStatus(s, false);
			}
		} else {
			const toEnable =
				this.settings.rememberedEnabled.length > 0
					? this.settings.rememberedEnabled
					: customCss.snippets;
			for (const s of toEnable) {
				if (customCss.snippets.includes(s)) {
					customCss.setCssEnabledStatus(s, true);
				}
			}
		}
		this.flushCustomCssConfig();
		void this.saveSettings();
	}
}
