// Helpers de dates pour les zones de prospection (portage du projet map).

export function todayISO(): string {
	return toISO(new Date());
}

function toISO(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

export function addMonths(iso: string, months: number): string {
	const [y, m, d] = iso.split('-').map(Number);
	const date = new Date(y, m - 1 + months, d);
	return toISO(date);
}

export function addDaysISO(iso: string, days: number): string {
	const [y, m, d] = iso.split('-').map(Number);
	const date = new Date(y, m - 1, d + days);
	return toISO(date);
}

export function sixMonthsAgoISO(): string {
	return addMonths(todayISO(), -6);
}

export function isOlderThanSixMonths(iso: string | null): boolean {
	if (!iso) return false;
	return iso < sixMonthsAgoISO();
}

export function isInProspecting(iso: string | null): boolean {
	if (!iso) return false;
	return iso > addDaysISO(todayISO(), -7);
}

export function formatDate(iso: string | null): string {
	if (!iso) return '—';
	const [y, m, d] = iso.split('-');
	return `${d}/${m}/${y}`;
}

export function nextProspectionDateISO(iso: string | null): string | null {
	if (!iso) return null;
	return addMonths(iso, 6);
}

export function daysUntilReProspect(iso: string | null): number | null {
	if (!iso) return null;
	const target = new Date(nextProspectionDateISO(iso)! + 'T00:00:00');
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function formatProspectionDelay(iso: string | null): string {
	if (!iso) return '';
	const target = new Date(nextProspectionDateISO(iso)! + 'T00:00:00');
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

	let months =
		(target.getFullYear() - today.getFullYear()) * 12 + (target.getMonth() - today.getMonth());
	if (target.getDate() < today.getDate()) months -= 1;

	const afterMonths = new Date(today.getFullYear(), today.getMonth() + months, today.getDate());
	const days = Math.round((target.getTime() - afterMonths.getTime()) / 86400000);

	const parts: string[] = [];
	if (months > 0) parts.push(`${months} mois`);
	if (days > 0) parts.push(`${days} jour${days > 1 ? 's' : ''}`);
	if (months <= 0 && days <= 0) return 'maintenant';
	return parts.join(' et ');
}
