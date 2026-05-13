import { addIcon } from "obsidian";

const ICONS: Record<string, string> = {
	"snipdock-dock": `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M7 14h2m4 0h4M7 10h6"/></svg>`,
	"snipdock-snippet": `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="8 6 3 12 8 18"/><polyline points="16 6 21 12 16 18"/><line x1="14" y1="4" x2="10" y2="20"/></svg>`,
};

export function registerIcons(): void {
	for (const key of Object.keys(ICONS)) {
		const svg = ICONS[key];
		if (svg !== undefined) addIcon(key, svg);
	}
}
