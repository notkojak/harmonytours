export type Theme = 'dark' | 'light';

// L'identité bravaux.fr est claire : c'est le thème par défaut, le sombre est opt-in.
export const DEFAULT_THEME: Theme = 'light';

export function getTheme(): Theme {
	if (typeof document === 'undefined') return DEFAULT_THEME;
	return document.documentElement.classList.contains('dark') ? 'dark' : DEFAULT_THEME;
}

export function setTheme(theme: Theme) {
	const root = document.documentElement;
	root.classList.toggle('dark', theme === 'dark');
	root.classList.toggle('light', theme === 'light');
	try {
		localStorage.setItem('theme', theme);
	} catch {
		// stockage indisponible (navigation privée) : on ignore
	}
}
