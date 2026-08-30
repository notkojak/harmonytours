export type Theme = 'dark' | 'light';

export function getTheme(): Theme {
	if (typeof document === 'undefined') return 'dark';
	return document.documentElement.classList.contains('light') ? 'light' : 'dark';
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
