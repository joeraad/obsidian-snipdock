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
	masterRowEl: HTMLElement | null;
	masterTitleEl: HTMLElement | null;
	masterToggle: ToggleComponent | null;
	snippetToggles: Map<string, ToggleComponent>;
	snippetRows: Map<string, HTMLElement>;
	searchInputEl: HTMLInputElement | null;
	isSyncing: boolean;
}

export function openSnippetMenu(
	plugin: SnipDockPlugin,
	anchorEl?: HTMLElement | null
): void {
	const doc = plugin.app.workspace.containerEl.doc;
	if (doc.querySelector(`.menu.${MENU_CLASS}`)) return;

	const menu = new Menu() as MenuWithDom;
	// macOS defaults `Menu.useNativeMenu` to true, which routes through Electron's
	// native menu and strips every ButtonComponent/ToggleComponent we attach —
	// leaving an empty popover. Force the DOM path so our custom rows render.
	menu.setUseNativeMenu(false);
	menu.dom.addClass(MENU_CLASS);

	const win = plugin.app.workspace.containerEl.win;
	const { multiColumn, columnCount, menuWidth } = plugin.settings;
	const COLUMN_GAP = 8;
	const rawWidth = multiColumn
		? columnCount * menuWidth + (columnCount - 1) * COLUMN_GAP
		: menuWidth;
	// Never let the menu exceed the viewport, however many wide columns are set.
	const menuWidthPx = Math.min(rawWidth, win.innerWidth - 24);
	menu.dom.setCssProps({
		"--snipdock-menu-width": `${menuWidthPx}px`,
		"--snipdock-menu-max-height": `${plugin.settings.menuMaxHeightVh}vh`,
	});

	suppressMousePositionScroll(menu);

	const state: MenuState = {
		plugin,
		masterRowEl: null,
		masterTitleEl: null,
		masterToggle: null,
		snippetToggles: new Map(),
		snippetRows: new Map(),
		searchInputEl: null,
		isSyncing: false,
	};

	if (plugin.settings.enableSearch) {
		addSearchRow(menu, state);
		menu.addSeparator();
	}
	addMasterRow(menu, state);
	menu.addSeparator();
	addSnippetRows(menu, state);
	menu.addSeparator();
	addActionRow(menu, plugin);

	const anchored = plugin.settings.anchorToStatusBar && anchorEl;
	if (anchored) {
		const rect = anchorEl!.getBoundingClientRect();
		menu.showAtPosition({ x: rect.left, y: rect.top });
	} else {
		menu.showAtPosition({ x: win.innerWidth - 15, y: win.innerHeight - 37 });
	}
	pinHeaderAndFooter(menu, state);
	if (plugin.settings.multiColumn) applyMultiColumnLayout(menu, state);
	// Obsidian fixes `top` at open time, so a shrinking list would lift the
	// menu away from the status bar. Re-anchor by the bottom edge so it always
	// grows/shrinks upward from just above the bar.
	const bottomOffset = anchored
		? win.innerHeight - anchorEl!.getBoundingClientRect().top
		: 37;
	menu.dom.style.top = "";
	menu.dom.style.bottom = `${bottomOffset}px`;
	// Keep the (possibly very wide) menu fully on screen horizontally.
	const menuRect = menu.dom.getBoundingClientRect();
	let left = menuRect.left;
	if (left + menuRect.width > win.innerWidth - 8) {
		left = win.innerWidth - menuRect.width - 8;
	}
	if (left < 8) left = 8;
	menu.dom.style.left = `${left}px`;
	state.searchInputEl?.focus();
}

/* Move the master row above `.menu-scroll` and the action row below it, so they
   stay pinned while the middle list scrolls. `.menu` is already a flex column,
   so this just makes them flex siblings of the scroll container. */
function pinHeaderAndFooter(menu: MenuWithDom, state: MenuState): void {
	const dom = menu.dom;
	const scrollEl = menu.scrollEl;
	const search = dom.querySelector<HTMLElement>(".snipdock-row-search");
	const master = dom.querySelector<HTMLElement>(".snipdock-row-master");
	const action = dom.querySelector<HTMLElement>(".snipdock-row-action");
	if (master) dom.insertBefore(master, scrollEl);
	if (search) dom.insertBefore(search, master ?? scrollEl);
	if (action) dom.insertBefore(action, scrollEl.nextSibling);
	// Separators only existed to bracket the pinned rows; once those are moved
	// out they're just stray lines (and there can be several stacked at the
	// scroll edges). Drop them all — CSS borders divide the sections instead.
	for (const sep of Array.from(dom.querySelectorAll(".menu-separator"))) {
		sep.remove();
	}
	void state;
}

function addSearchRow(menu: Menu, state: MenuState): void {
	menu.addItem((item) => {
		item.setTitle("");
		const row = (item as unknown as { dom: HTMLElement }).dom;
		row.addClass("snipdock-row-search");
		disableRowScrollIntoView(row);

		const input = row.createEl("input", {
			type: "text",
			cls: "snipdock-search-input",
			attr: { placeholder: "Search snippets…" },
		});
		state.searchInputEl = input;

		input.addEventListener("input", () => filterSnippets(state, input.value));
		// Keep menu keyboard nav and item-selection from hijacking the field.
		input.addEventListener("keydown", (evt) => evt.stopPropagation());
		row.addEventListener(
			"click",
			(evt) => {
				evt.preventDefault();
				evt.stopPropagation();
				input.focus();
			},
			true
		);
	});
}

function filterSnippets(state: MenuState, query: string): void {
	const q = query.trim().toLowerCase();
	for (const [name, row] of state.snippetRows) {
		const match = q === "" || name.toLowerCase().includes(q);
		row.toggleClass("snipdock-hidden", !match);
	}
}

/* Restructure the scrolled snippet rows into evenly-distributed columns.
   Two modes:
   - row-first (default): row i -> column (i % columnCount). Snippets read
     left-to-right, columns hold interleaved slices.
   - column-first: row i -> column floor(i / perColumn). Each column is a
     contiguous top-to-bottom slice (Issue #7). */
function applyMultiColumnLayout(menu: MenuWithDom, state: MenuState): void {
	const scrollEl = menu.scrollEl;
	const rows = Array.from(
		scrollEl.querySelectorAll<HTMLElement>(".snipdock-row-snippet")
	);
	if (rows.length === 0) return;

	const count = Math.max(2, state.plugin.settings.columnCount);
	const columnFirst = state.plugin.settings.columnFirstSort;
	const perColumn = Math.ceil(rows.length / count);
	const container = scrollEl.createDiv({ cls: "snipdock-columns" });
	const columns: HTMLElement[] = [];
	for (let i = 0; i < count; i++) {
		columns.push(container.createDiv({ cls: "snipdock-column" }));
	}
	rows.forEach((row, i) => {
		const col = columnFirst
			? columns[Math.floor(i / perColumn)]
			: columns[i % count];
		if (col) col.appendChild(row);
	});
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
	const rememberedCount = state.plugin.settings.rememberedEnabled.length;
	const isPaused = enabledCount === 0 && rememberedCount > 0;

	const masterText = isPaused
		? `Paused · ${rememberedCount} remembered · tap to resume`
		: `All snippets · ${enabledCount} of ${total} on`;

	state.isSyncing = true;
	try {
		if (state.masterTitleEl) {
			state.masterTitleEl.setText(masterText);
			setTooltip(state.masterTitleEl, masterText, { placement: "top" });
		}
		if (state.masterRowEl) {
			state.masterRowEl.toggleClass("snipdock-paused", isPaused);
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
	const rememberedCount = plugin.settings.rememberedEnabled.length;
	const isPaused = enabledCount === 0 && rememberedCount > 0;
	const initialTitle = isPaused
		? `Paused · ${rememberedCount} remembered · tap to resume`
		: `All snippets · ${enabledCount} of ${total} on`;

	menu.addItem((item) => {
		item.setTitle(initialTitle);
		const row = (item as unknown as { dom: HTMLElement }).dom;
		row.addClass("snipdock-row-master");
		row.toggleClass("snipdock-paused", isPaused);
		disableRowScrollIntoView(row);
		const titleEl = (item as unknown as { titleEl: HTMLElement }).titleEl;
		state.masterRowEl = row;
		state.masterTitleEl = titleEl;
		// Title ellipsis-truncates in narrow menus; surface the full text on hover.
		setTooltip(titleEl, initialTitle, { placement: "top" });

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
			plugin.flushCustomCssConfig();
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
				plugin.flushCustomCssConfig();
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
				// X is an explicit "all off"; clear remembered set so the row
				// doesn't claim to be a recoverable "paused" state.
				plugin.settings.rememberedEnabled = [];
				plugin.flushCustomCssConfig();
				void plugin.saveSettings();
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
			state.snippetRows.set(snippet, row);

			const toggle = new ToggleComponent(row);
			toggle
				.setValue(customCss.enabledSnippets.has(snippet))
				.onChange((value) => {
					if (state.isSyncing) return;
					customCss.setCssEnabledStatus(snippet, value);
					plugin.flushCustomCssConfig();
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
