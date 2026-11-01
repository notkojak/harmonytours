// PERSISTANCE DU DEVIS — le chiffrage en cours est conservé sur l'appareil pour
// survivre à un rafraîchissement, un changement de page ou une fermeture
// d'onglet. Le devis est écarté dès que la version du book change : un panier
// construit sur l'ancien tarif ne doit jamais être repris avec des prix périmés.

import { VERSION_BOOK, type LigneDevis } from './data/book';
import { REMISE_MAX, type Deblocage } from './data/deblocage';

export type DevisSauve = {
	lignes: LigneDevis[];
	remise: number;
	/** place ouverte par le responsable, qui porte la remise du devis */
	deblocage: Deblocage | null;
};

const CLE = 'harmony-devis';
/** Garde-fou : on ne recharge jamais un panier plus gros que ça. */
const MAX_LIGNES = 300;
const UNITES = new Set(['u', 'm2', 'ml']);

/** Une ligne du stockage n'est reprise que si elle est complète et cohérente. */
function estLigne(valeur: unknown): valeur is LigneDevis {
	if (typeof valeur !== 'object' || valeur === null) return false;
	const l = valeur as Record<string, unknown>;
	return (
		typeof l.uid === 'string' &&
		typeof l.ref === 'string' &&
		typeof l.designation === 'string' &&
		typeof l.prixUnitaireHT === 'number' &&
		Number.isFinite(l.prixUnitaireHT) &&
		l.prixUnitaireHT >= 0 &&
		typeof l.quantite === 'number' &&
		Number.isFinite(l.quantite) &&
		l.quantite > 0 &&
		typeof l.tva === 'number' &&
		Number.isFinite(l.tva) &&
		typeof l.unite === 'string' &&
		UNITES.has(l.unite)
	);
}

/** Le déblocage repris doit être complet : sinon la remise serait orpheline. */
function estDeblocage(valeur: unknown): valeur is Deblocage {
	if (typeof valeur !== 'object' || valeur === null) return false;
	const d = valeur as Record<string, unknown>;
	return (
		typeof d.remise === 'number' &&
		Number.isFinite(d.remise) &&
		d.remise > 0 &&
		d.remise <= REMISE_MAX &&
		typeof d.le === 'number' &&
		Number.isFinite(d.le)
	);
}

export function chargerDevis(): DevisSauve | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const brut = localStorage.getItem(CLE);
		if (!brut) return null;

		const data = JSON.parse(brut) as Record<string, unknown> | null;
		if (!data || typeof data !== 'object' || data.version !== VERSION_BOOK) {
			localStorage.removeItem(CLE);
			return null;
		}

		const lignes = Array.isArray(data.lignes)
			? (data.lignes.filter(estLigne).slice(-MAX_LIGNES) as LigneDevis[])
			: [];
		const brutRemise =
			typeof data.remise === 'number' && Number.isFinite(data.remise) ? data.remise : 0;
		const deblocage = estDeblocage(data.deblocage) ? data.deblocage : null;
		// Une remise ne vient jamais seule : sans déblocage valide, elle retombe à zéro.
		const remise = deblocage ? Math.min(REMISE_MAX, Math.max(0, brutRemise)) : 0;

		return lignes.length ? { lignes, remise, deblocage } : null;
	} catch {
		// stockage illisible (valeur bricolée) : on repart d'un devis vide et on
		// efface l'entrée fautive pour ne pas la relire à chaque ouverture.
		try {
			localStorage.removeItem(CLE);
		} catch {
			// stockage inaccessible : rien à nettoyer
		}
		return null;
	}
}

export function sauverDevis(
	lignes: LigneDevis[],
	remise: number,
	deblocage: Deblocage | null
): void {
	if (typeof localStorage === 'undefined') return;
	try {
		if (!lignes.length) {
			localStorage.removeItem(CLE);
			return;
		}
		localStorage.setItem(
			CLE,
			JSON.stringify({
				version: VERSION_BOOK,
				lignes: lignes.slice(-MAX_LIGNES),
				remise,
				deblocage
			})
		);
	} catch {
		// quota dépassé ou stockage refusé (navigation privée) : le devis reste
		// utilisable en mémoire, seule la reprise après rechargement est perdue.
	}
}

/** Numéro de ligne libre, pour ne jamais réutiliser l'identifiant d'une ligne reprise. */
export function prochainNumeroLigne(lignes: LigneDevis[]): number {
	return lignes.reduce((max, l) => {
		const suffixe = Number(/\d+$/.exec(l.uid)?.[0] ?? 0);
		return Math.max(max, Number.isFinite(suffixe) ? suffixe + 1 : max);
	}, 0);
}
