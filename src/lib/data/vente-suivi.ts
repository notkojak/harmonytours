// Le suivi du dossier technique se déduit des dates et du calendrier :
// - une date de pose passée (ou du jour) ⇒ « posée » (état final) ;
// - une date de pose à venir ⇒ « pose programmée » ;
// - sinon une date de métrage passée ⇒ « métrée », à venir ⇒ « métrage programmé » ;
// - aucune date ⇒ pas de suivi.
// La bascule « programmé » → état final est donc automatique le lendemain.

export type VenteSuivi = 'métrée' | 'posée';

export const VENTE_SUIVIS: VenteSuivi[] = ['métrée', 'posée'];

// Date du jour en France au format AAAA-MM-JJ : les dates du dossier sont des
// dates civiles, on les compare sans décalage horaire.
export function aujourdHuiIso(): string {
	return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
}

// Suivi effectif d'une vente : les dates saisies priment sur la valeur stockée,
// pour qu'une pose prévue bascule en « posée » d'elle-même le lendemain.
export function suiviDeVente(vente: {
	suivi?: string | null;
	dateMetrage?: string | null;
	datePose?: string | null;
}): string | null {
	const jour = aujourdHuiIso();
	if (vente.datePose) return vente.datePose > jour ? 'pose programmée' : 'posée';
	if (vente.dateMetrage) return vente.dateMetrage > jour ? 'métré programmé' : 'métrée';
	return vente.suivi ?? null;
}

export function suiviLabel(suivi: string | null | undefined): string {
	if (suivi === 'posée') return 'Posée';
	if (suivi === 'pose programmée') return 'Pose programmée';
	if (suivi === 'métrée') return 'Métrée';
	if (suivi === 'métré programmé') return 'Métrage programmé';
	return '—';
}

// Teintes : métrage orange, pose vert ; une date encore à venir garde la même
// couleur mais en pointillés, pour distinguer « programmé » de « fait ».
export function suiviClass(suivi: string | null | undefined): string {
	if (suivi === 'posée') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
	if (suivi === 'pose programmée')
		return 'border border-dashed border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300';
	if (suivi === 'métrée') return 'bg-orange-500/15 text-orange-700 dark:text-orange-300';
	if (suivi === 'métré programmé')
		return 'border border-dashed border-orange-500/40 bg-orange-500/5 text-orange-700 dark:text-orange-300';
	return 'bg-glass-2 text-muted-foreground';
}

// Confortation : la vente a été confirmée par le client après réflexion.
export function confortationLabel(confortee: boolean | null | undefined): string {
	return confortee ? 'Confortée' : 'À conforter';
}

export function confortationClass(confortee: boolean | null | undefined): string {
	return confortee
		? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
		: 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
}

// Style unique des puces « statut », « suivi » et « paiement » : même rayon,
// même padding et même taille d'écriture dans la fiche client et dans les
// deux tableaux des ventes.
export const PUCE =
	'inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[13px] font-semibold whitespace-nowrap';

// Prénom seul d'un commercial dans les ventes : « Pierre Durand » → « Pierre »,
// et pour un binôme « Pierre Durand et Marie Dupont » → « Pierre et Marie ».
// Un nom stocké faute de prénom (adresse e-mail) est laissé tel quel.
export function prenoms(noms: string | null | undefined): string {
	if (!noms) return '—';
	return noms
		.split(/\s+et\s+/i)
		.map((nom) => {
			const court = nom.trim();
			if (court.includes('@')) return court;
			return court.split(/\s+/)[0] ?? court;
		})
		.join(' et ');
}

// Statut du dossier (colonne « Statut ») : valide, en attente, erreur, annulée.
export function statutLabel(statut: string | null | undefined): string {
	if (statut === 'erreur') return 'Erreur';
	if (statut === 'annulée') return 'Annulée';
	if (statut === 'en attente') return 'En attente';
	return 'Valide';
}

export function statutClass(statut: string | null | undefined): string {
	if (statut === 'erreur') return 'bg-orange-500/15 text-orange-700 dark:text-orange-300';
	if (statut === 'annulée') return 'bg-red-500/15 text-red-700 dark:text-red-300';
	if (statut === 'en attente') return 'bg-sky-500/15 text-sky-700 dark:text-sky-300';
	return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
}

// Mode de paiement et dossier de financement (colonne « Paiement »).
export function paiementLabel(paiement: string | null | undefined): string {
	if (paiement === 'financement') return '💳 Financement';
	if (paiement === 'comptant') return '💶 Comptant';
	return 'Paiement —';
}

// Dossier de financement (FI) : en attente, accepté ou refusé. La puce
// « Financement » prend sa teinte (orange / vert / rouge), ce qui remplace la
// seconde puce « FI accepté / en attente ».
export type FiStatut = 'en attente' | 'accepté' | 'refusé';

export const FI_STATUTS: FiStatut[] = ['en attente', 'accepté', 'refusé'];

// Les ventes saisies avant les trois états n'ont qu'un booléen `fiAccepte` :
// vrai = accepté, faux = encore en attente.
export function fiStatutOf(
	fiStatut: string | null | undefined,
	fiAccepte?: boolean | null
): FiStatut {
	if (fiStatut === 'accepté' || fiStatut === 'refusé' || fiStatut === 'en attente') return fiStatut;
	return fiAccepte ? 'accepté' : 'en attente';
}

export function fiLabel(fiStatut?: string | null, fiAccepte?: boolean | null): string {
	const s = fiStatutOf(fiStatut, fiAccepte);
	if (s === 'refusé') return 'FI refusé';
	if (s === 'accepté') return 'FI accepté';
	return 'FI en attente';
}

export function paiementClass(
	paiement: string | null | undefined,
	fiStatut?: string | null,
	fiAccepte?: boolean | null
): string {
	if (paiement === 'financement') return fiClass(fiStatut, fiAccepte);
	if (paiement === 'comptant') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
	return 'bg-glass-2 text-muted-foreground';
}

// Teinte du dossier de financement : vert accepté, rouge refusé, orange en attente.
export function fiClass(fiStatut?: string | null, fiAccepte?: boolean | null): string {
	const s = fiStatutOf(fiStatut, fiAccepte);
	if (s === 'refusé') return 'bg-red-500/15 text-red-700 dark:text-red-300';
	if (s === 'accepté') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
	return 'bg-orange-500/15 text-orange-700 dark:text-orange-300';
}

// Date ISO (YYYY-MM-DD) → « 12 nov. », ou un tiret.
export function dateCourt(iso: string | null | undefined): string {
	if (!iso) return '—';
	const [y, m, d] = iso.split('-').map(Number);
	if (!y || !m || !d) return '—';
	return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
