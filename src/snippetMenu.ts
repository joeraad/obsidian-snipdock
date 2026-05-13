import {
	ButtonComponent,
	Menu,
	Notice,
	setTooltip,
	ToggleComponent,
} from "obsidian";
import type SnipDockPlugin from "./main";
import { CreateSnippetModal } from "./modals/createSnippetModal";
import { RenameSnippetModal } from "./modals/renameSnippetModal";
import type { MenuWithDom } from "./types";

const MENU_CLASS = "snipdock-menu";

interface MenuState {
	plugin: SnipDockPlugin;
	masterTitleEl: HTMLElement | null;
	masterToggle: ToggleComponent | null;
	snippetToggles: Map<string, ToggleComponent>;
	isSyncing: boolean;
}

export function openSnippetMenu(plugin: SnipDockPlugin): void {
	const doc = plugin.app.workspace.containerEl.doc;
	if (doc.querySelector(`.menu.${MENU_CLASS}`)) return;

	const menu = new Menu() as MenuWithDom;
	menu.dom.addClass(MENU_CLASS);
	menu.dom.setCssProps({
		"--snipdock-menu-width": `${plugin.settings.menuWidth}px`,
		"--snipdock-menu-max-height": `${plugin.settings.menuMaxHeightVh}vh`,
	});

	suppressMousePositionScroll(menu);

	const state: MenuState = {
		plugin,
		masterTitleEl: null,
		masterToggle: null,
		snippetToggles: new Map(),
		isSyncing: false,
	};

	addMasterRow(menu, state);
	menu.addSeparator();
	addSnippetRows(menu, state);
	menu.addSeparator();
	addActionRow(menu, plugin);

	const win = plugin.app.workspace.containerEl.win;
	menu.showAtPosition({ x: win.innerWidth - 15, y: win.innerHeight - 37 });
	pinHeaderAndFooter(menu);
}

/* Move the master row above `.menu-scroll` and the action row below it, so they
   stay pinned while the middle list scrolls. `.menu` is already a flex column,
   so this just makes them flex siblings of the scroll container. */
function pinHeaderAndFooter(menu: MenuWithDom): void {
	const dom = menu.dom;
	const scrollEl = menu.scrollEl;
	const master = dom.querySelector<HTMLElement>(".snipdock-row-master");
	const action = dom.querySelector<HTMLElement>(".snipdock-row-action");
	if (master) dom.insertBefore(master, scrollEl);
	if (action) dom.insertBefore(action, scrollEl.nextSibling);
	// The separators that bracketed master/action are now stranded at the
	// scroll edges, drop them.
	const firstChild = scrollEl.firstElementChild;
	if (firstChild?.hasClass("menu-separator")) firstChild.remove();
	const lastChild = scrollEl.lastElementChild;
	if (lastChild?.hasClass("menu-separator")) lastChild.remove();
}

/* Obsidian's Menu attaches a `mousemove` handler to `.menu-scroll` that drives
   scrollTop from cursor Y. Shadow `addEventListener` so that handler can't bind,
   leaving the user with a normal scrollbar. */
function suppressMousePositionScroll(menu: MenuWithDom): void {
	const scrollEl = menu.scrollEl;
	const orig = scrollEl.addEventListener.bind(scrollEl);
	(scrollEl as unknown as {
		addEventListener: (
			type: string,
			listener: EventListenerOrEventListenerObject,
			options?: boolean | AddEventListenerOptions
		) => void;
	}).addEventListener = (type, listener, options) => {
		if (type === "mousemove") return;
		orig(type, listener, options);
	};
}

/* Obsidian's `Menu.select` is called on every mouseover and calls
   `row.scrollIntoView({block:"nearest"})`, which jolts the menu whenever the
   cursor crosses a partially-visible item at the edge. No-op it per row. */
function disableRowScrollIntoView(row: HTMLElement): void {
	row.scrollIntoView = () => {};
}

function syncMenu(state: MenuState): void {
	const { customCss } = state.plugin.app;
	const total = customCss.snippets.length;
	const enabledCount = customCss.snippets.filter((s) =>
		customCss.enabledSnippets.has(s)
	).length;

	state.isSyncing = true;
	try {
		if (state.masterTitleEl) {
			state.masterTitleEl.setText(
				`All snippets · ${enabledCount} of ${total} on`
			);
		}
		if (state.masterToggle) {
			state.masterToggle.setValue(enabledCount > 0);
		}
		for (const [name, toggle] of state.snippetToggles) {
			toggle.setValue(customCss.enabledSnippets.has(name));
		}
	} finally {
		state.isSyncing = false;
	}
}

function addMasterRow(menu: Menu, state: MenuState): void {
	const plugin = state.plugin;
	const { customCss } = plugin.app;
	const total = customCss.snippets.length;
	const enabledCount = customCss.snippets.filter((s) =>
		customCss.enabledSnippets.has(s)
	).length;

	menu.addItem((item) => {
		item.setTitle(`All snippets · ${enabledCount} of ${total} on`);
		const row = (item as unknown as { dom: HTMLElement }).dom;
		row.addClass("snipdock-row-master");
		disableRowScrollIntoView(row);
		const titleEl = (item as unknown as { titleEl: HTMLElement }).titleEl;
		state.masterTitleEl = titleEl;

		const toggle = new ToggleComponent(row);
		toggle.setValue(enabledCount > 0).onChange((value) => {
			if (state.isSyncing) return;
			if (value) {
				const toEnable =
					plugin.settings.rememberedEnabled.length > 0
						? plugin.settings.rememberedEnabled
						: customCss.snippets;
				for (const s of toEnable) {
					if (customCss.snippets.includes(s)) {
						customCss.setCssEnabledStatus(s, true);
					}
				}
			} else {
				plugin.settings.rememberedEnabled = customCss.snippets.filter(
					(s) => customCss.enabledSnippets.has(s)
				);
				for (const s of customCss.snippets) {
					customCss.setCssEnabledStatus(s, false);
				}
			}
			void plugin.saveSettings();
			syncMenu(state);
		});
		if (toggle.toggleEl) {
			setTooltip(
				toggle.toggleEl,
				"Pause/resume snippets. Remembers which were on."
			);
		}
		stopToggleBubbling(toggle);
		state.masterToggle = toggle;

		const enableAllBtn = new ButtonComponent(row);
		enableAllBtn
			.setIcon("check-check")
			.setClass("snipdock-row-btn")
			.setClass("snipdock-row-btn-master")
			.setTooltip("Enable every snippet")
			.onClick((evt) => {
				evt.stopPropagation();
				for (const s of customCss.snippets) {
					customCss.setCssEnabledStatus(s, true);
				}
				syncMenu(state);
			});

		const disableAllBtn = new ButtonComponent(row);
		disableAllBtn
			.setIcon("x")
			.setClass("snipdock-row-btn")
			.setClass("snipdock-row-btn-master")
			.setTooltip("Disable every snippet")
			.onClick((evt) => {
				evt.stopPropagation();
				for (const s of customCss.snippets) {
					customCss.setCssEnabledStatus(s, false);
				}
				syncMenu(state);
			});

		row.addEventListener(
			"click",
			(evt) => {
				if (isControlClick(evt.target)) return;
				evt.preventDefault();
				evt.stopPropagation();
				toggle.setValue(!toggle.getValue());
			},
			true
		);
	});
}

function addSnippetRows(menu: Menu, state: MenuState): void {
	const plugin = state.plugin;
	const { customCss } = plugin.app;

	if (customCss.snippets.length === 0) {
		menu.addItem((item) => {
			item.setTitle("No snippets yet. Use the buttons below to add one.");
			item.setDisabled(true);
		});
		return;
	}

	for (const snippet of customCss.snippets) {
		const snippetPath = customCss.getSnippetPath(snippet);

		menu.addItem((item) => {
			item.setTitle(snippet);
			const row = (item as unknown as { dom: HTMLElement }).dom;
			row.addClass("snipdock-row-snippet");
			disableRowScrollIntoView(row);

			const toggle = new ToggleComponent(row);
			toggle
				.setValue(customCss.enabledSnippets.has(snippet))
				.onChange((value) => {
					if (state.isSyncing) return;
					customCss.setCssEnabledStatus(snippet, value);
					syncMenu(state);
				});
			stopToggleBubbling(toggle);
			state.snippetToggles.set(snippet, toggle);

			const renameBtn = new ButtonComponent(row);
			renameBtn
				.setIcon("file-pen-line")
				.setClass("snipdock-row-btn")
				.setClass("snipdock-row-btn-rename")
				.setTooltip("Rename snippet")
				.onClick((evt) => {
					evt.stopPropagation();
					new RenameSnippetModal(plugin, snippet).open();
				});

			const openBtn = new ButtonComponent(row);
			openBtn
				.setIcon("snipdock-snippet")
				.setClass("snipdock-row-btn")
				.setClass("snipdock-row-btn-open")
				.setTooltip("Open snippet in default app")
				.onClick((evt) => {
					evt.stopPropagation();
					plugin.app.openWithDefaultApp(snippetPath);
				});

			row.addEventListener(
				"click",
				(evt) => {
					if (isControlClick(evt.target)) return;
					evt.preventDefault();
					evt.stopPropagation();
					toggle.setValue(!toggle.getValue());
				},
				true
			);
		});
	}
}

function isControlClick(target: EventTarget | null): boolean {
	const el = target as HTMLElement | null;
	if (!el) return false;
	return (
		el.closest(".checkbox-container") !== null ||
		el.closest(".snipdock-row-btn") !== null
	);
}

function addActionRow(menu: Menu, plugin: SnipDockPlugin): void {
	const { customCss } = plugin.app;

	menu.addItem((item) => {
		item.setTitle("");
		const row = (item as unknown as { dom: HTMLElement }).dom;
		row.addClass("snipdock-row-action");
		disableRowScrollIntoView(row);

		const reload = new ButtonComponent(row);
		reload
			.setIcon("refresh-cw")
			.setClass("snipdock-action-btn")
			.setTooltip("Reload snippets")
			.onClick((evt) => {
				evt.stopPropagation();
				customCss.requestLoadSnippets();
				new Notice("Snippets reloaded.");
			});

		const folder = new ButtonComponent(row);
		folder
			.setIcon("folder")
			.setClass("snipdock-action-btn")
			.setTooltip("Open snippets folder")
			.onClick((evt) => {
				evt.stopPropagation();
				plugin.app.openWithDefaultApp(customCss.getSnippetsFolder());
			});

		const create = new ButtonComponent(row);
		create
			.setIcon("plus")
			.setClass("snipdock-action-btn")
			.setClass("snipdock-action-btn-primary")
			.setTooltip("Create new snippet")
			.onClick((evt) => {
				evt.stopPropagation();
				new CreateSnippetModal(plugin).open();
			});

		const settings = new ButtonComponent(row);
		settings
			.setIcon("settings")
			.setClass("snipdock-action-btn")
			.setTooltip("Open SnipDock settings")
			.onClick((evt) => {
				evt.stopPropagation();
				plugin.app.setting.open();
				plugin.app.setting.openTabById(plugin.manifest.id);
			});
	});
}

function stopToggleBubbling(toggle: ToggleComponent): void {
	toggle.toggleEl?.addEventListener("click", (evt) => evt.stopPropagation());
}
