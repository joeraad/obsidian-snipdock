import type { App, Menu } from "obsidian";

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

export interface SnipDockApp extends App {
	customCss: CustomCssApi;
	setting: SettingApi;
	openWithDefaultApp(path: string): void;
}

export interface MenuWithDom extends Menu {
	dom: HTMLElement;
	scrollEl: HTMLElement;
}
