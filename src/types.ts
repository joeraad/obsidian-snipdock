import type { App, Menu, Vault } from "obsidian";

export interface CustomCssApi {
	snippets: string[];
	enabledSnippets: Set<string>;
	getSnippetsFolder(): string;
	getSnippetPath(name: string): string;
	setCssEnabledStatus(name: string, enabled: boolean): void;
	requestLoadSnippets(): void;
}

export interface SettingApi {
	open(): void;
	openTabById(id: string): void;
}

// `saveConfig` flushes `appearance.json` immediately, bypassing Obsidian's 1s
// debounce on `enabledCssSnippets`. It's undocumented but stable across
// modern Obsidian builds; we guard the call site so older clients no-op.
export interface VaultWithSaveConfig extends Vault {
	saveConfig?: () => Promise<void> | void;
}

export interface SnipDockApp extends App {
	customCss: CustomCssApi;
	setting: SettingApi;
	vault: VaultWithSaveConfig;
	openWithDefaultApp(path: string): void;
}

export interface MenuWithDom extends Menu {
	dom: HTMLElement;
	scrollEl: HTMLElement;
}
