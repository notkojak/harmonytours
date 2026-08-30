/**
 * Formate un numéro de téléphone en groupes de 2 chiffres (ex. « 0612345678 »
 * → « 06 12 34 56 78 ») pour plus de lisibilité. Les espaces et caractères
 * non chiffres sont ignorés ; au plus 10 chiffres sont conservés.
 */
export function formatPhone(raw: string | null | undefined): string {
	if (!raw) return '';
	const digits = raw.replace(/\D/g, '').slice(0, 10);
	if (!digits) return '';
	return digits.match(/.{1,2}/g)?.join(' ') ?? '';
}

/**
 * Formate un champ téléphone en direct pendant la saisie, en préservant la
 * position du curseur. À brancher sur `oninput` du champ.
 */
export function onPhoneInput(e: Event & { currentTarget: HTMLInputElement }): void {
	const input = e.currentTarget;
	const cursor = input.selectionStart ?? input.value.length;
	// Nombre de chiffres saisis avant le curseur (les espaces ne comptent pas).
	const digitsBefore = input.value.slice(0, cursor).replace(/\D/g, '').length;
	const formatted = formatPhone(input.value);
	if (input.value === formatted) return;
	input.value = formatted;
	// On replace le curseur après le (digitsBefore)-ième chiffre formaté.
	let pos = 0;
	let seen = 0;
	while (pos < formatted.length && seen < digitsBefore) {
		if (/\d/.test(formatted[pos])) seen++;
		pos++;
	}
	input.setSelectionRange(pos, pos);
}
