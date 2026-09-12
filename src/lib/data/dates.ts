// Conversions entre un horodatage (ms, tel que stocké en base) et la valeur d'un
// champ `<input type="date">` (AAAA-MM-JJ), en heure locale.

/** Horodatage → valeur d'input date (AAAA-MM-JJ). Chaîne vide si absent. */
export function msToDateInput(ms: number | null | undefined): string {
	if (!ms) return '';
	const d = new Date(ms);
	const p = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Valeur d'input date (AAAA-MM-JJ) → horodatage, calé à midi : la date reste la
 * même quel que soit le fuseau (minuit basculerait la veille en UTC).
 */
export function dateInputToMs(value: string): number | undefined {
	const [y, m, d] = (value ?? '').split('-').map(Number);
	if (!y || !m || !d) return undefined;
	return new Date(y, m - 1, d, 12, 0, 0, 0).getTime();
}
