// Le suivi du dossier technique se déduit des dates et du calendrier :
// - une date de pose passée (ou du jour) reste « à confirmer » tant qu'un
//   responsable n'a pas explicitement validé que la pose a bien eu lieu ;
// - une date de pose à venir ⇒ « pose programmée » ;
// - sinon une date de métrage passée ⇒ « métrage à confirmer », à venir ⇒
//   « métrage programmé » ;
// - aucune date ⇒ pas de suivi.
// La confirmation est volontaire : une date passée ne prouve pas que le chantier
// a été réalisé (report, absence, erreur de saisie).

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
	metrageConfirmeAt?: number | null;
	poseConfirmeAt?: number | null;
}): string | null {
	const jour = aujourdHuiIso();
	if (vente.datePose) {
		if (vente.datePose > jour) return 'pose programmée';
		return vente.poseConfirmeAt ? 'posée' : 'pose à confirmer';
	}
	if (vente.dateMetrage) {
		if (vente.dateMetrage > jour) return 'métré programmé';
		return vente.metrageConfirmeAt ? 'métrée' : 'métrage à confirmer';
	}
	return vente.suivi ?? null;
}

// Étape dont la date est passée sans confirmation : sert aux alertes et au
// bouton « Confirmer » de la fiche.
export function etapeAConfirmer(vente: {
	dateMetrage?: string | null;
	datePose?: string | null;
	metrageConfirmeAt?: number | null;
	poseConfirmeAt?: number | null;
}): 'metrage' | 'pose' | null {
	const jour = aujourdHuiIso();
	if (vente.datePose && vente.datePose <= jour && !vente.poseConfirmeAt) return 'pose';
	if (
		!vente.datePose &&
		vente.dateMetrage &&
		vente.dateMetrage <= jour &&
		!vente.metrageConfirmeAt
	) {
		return 'metrage';
	}
	return null;
}

export function suiviLabel(suivi: string | null | undefined): string {
	if (suivi === 'posée') return 'Posée';
	if (suivi === 'pose programmée') return 'Pose programmée';
	if (suivi === 'pose à confirmer') return 'Pose à confirmer';
	if (suivi === 'métrée') return 'Métrée';
	if (suivi === 'métré programmé') return 'Métrage programmé';
	if (suivi === 'métrage à confirmer') return 'Métrage à confirmer';
	return '—';
}

// Teintes : métrage orange, pose vert ; une date encore à venir garde la même
// couleur mais en pointillés, pour distinguer « programmé » de « fait ». Une
// étape passée non confirmée passe en ambre : elle demande une action.
export function suiviClass(suivi: string | null | undefined): string {
	if (suivi === 'posée') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
	if (suivi === 'pose programmée')
		return 'border border-dashed border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300';
	if (suivi === 'pose à confirmer')
		return 'border border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-300';
	if (suivi === 'métrée') return 'bg-orange-500/15 text-orange-700 dark:text-orange-300';
	if (suivi === 'métré programmé')
		return 'border border-dashed border-orange-500/40 bg-orange-500/5 text-orange-700 dark:text-orange-300';
	if (suivi === 'métrage à confirmer')
		return 'border border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-300';
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

// Puce compacte des tableaux denses (statut, suivi, paiement) : même rendu que
// PUCE, en plus petit, pour que neuf colonnes tiennent en largeur.
export const PUCE_FINE =
	'inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11.5px] font-semibold whitespace-nowrap';

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
