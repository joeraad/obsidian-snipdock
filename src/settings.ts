export interface SnipDockSettings {
	menuWidth: number;
	menuMaxHeightVh: number;
	autoOpenOnCreate: boolean;
	enableNewByDefault: boolean;
	defaultSnippetTemplate: string;
	rememberedEnabled: string[];
	anchorToStatusBar: boolean;
	enableSearch: boolean;
	multiColumn: boolean;
	columnCount: number;
	columnFirstSort: boolean;
}

export const MENU_WIDTH_MIN = 220;
export const MENU_WIDTH_MAX = 520;
export const MENU_HEIGHT_MIN = 30;
export const MENU_HEIGHT_MAX = 90;
export const COLUMN_COUNT_MIN = 2;
export const COLUMN_COUNT_MAX = 6;

export const DEFAULT_SETTINGS: SnipDockSettings = {
	menuWidth: 330,
	menuMaxHeightVh: 70,
	autoOpenOnCreate: true,
	enableNewByDefault: false,
	defaultSnippetTemplate: "",
	rememberedEnabled: [],
	anchorToStatusBar: false,
	enableSearch: false,
	multiColumn: false,
	columnCount: 2,
	columnFirstSort: false,
};
