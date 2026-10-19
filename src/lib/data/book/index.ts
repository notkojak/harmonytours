// Point d'entrée des données tarifaires « BOOK TARIFAIRE » 2026.
// Réunit le catalogue (forfaits), les grilles (cotes × prix) et les options.

import { GRILLES, GRILLE_BY_ID, prixGrille, type Cote, type Grille } from './grilles';
import { BAREMES, BAREME_BY_ID, prixBareme, coteProche, type Bareme } from './baremes';
import {
	OPTIONS,
	optionsPour,
	appliquerOptions,
	sectionDe,
	SECTIONS_OPTIONS,
	estInclus,
	type GroupeOption,
	type OptionTarif
} from './options';
import {
	FAMILLES,
	FAMILLE_BY_ID,
	PRODUITS,
	PRODUIT_BY_ID,
	produitsDeFamille,
	TVA_ALERTE,
	TVA_RECAP,
	type Famille,
	type Produit,
	type TVA
} from './catalogue';
import {
	chiffrer,
	cotesMedianes,
	groupeDeGrille,
	montantPlusValue,
	optionsDeArticle,
	prixMiniGrille,
	sectionsDoptions,
	vantauxDeGrille
} from './moteur';

export {
	GRILLES,
	GRILLE_BY_ID,
	prixGrille,
	BAREMES,
	BAREME_BY_ID,
	prixBareme,
	coteProche,
	OPTIONS,
	optionsPour,
	appliquerOptions,
	sectionDe,
	SECTIONS_OPTIONS,
	estInclus,
	chiffrer,
	cotesMedianes,
	groupeDeGrille,
	montantPlusValue,
	optionsDeArticle,
	prixMiniGrille,
	sectionsDoptions,
	vantauxDeGrille,
	FAMILLES,
	FAMILLE_BY_ID,
	PRODUITS,
	PRODUIT_BY_ID,
	produitsDeFamille,
	TVA_ALERTE,
	TVA_RECAP
};
export type { Cote, Grille, Bareme, GroupeOption, OptionTarif, Famille, Produit, TVA };
export type { SectionOption } from './options';
export type { Article, Chiffrage, ContexteChiffrage, Cotes } from './moteur';

/**
 * Version du book tarifaire. À incrémenter dès qu'un prix change : les devis
 * conservés sur les appareils sont alors écartés au lieu d'être repris avec des
 * montants périmés.
 */
export const VERSION_BOOK = '2026';

export const TVA_LABEL: Record<number, string> = {
	0.055: 'TVA 5,5 %',
	0.1: 'TVA 10 %',
	0.2: 'TVA 20 %'
};

export const TVA_COURT: Record<number, string> = {
	0.055: '5,5 %',
	0.1: '10 %',
	0.2: '20 %'
};

export const euro = new Intl.NumberFormat('fr-FR', {
	style: 'currency',
	currency: 'EUR',
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
});

export const euro0 = new Intl.NumberFormat('fr-FR', {
	style: 'currency',
	currency: 'EUR',
	minimumFractionDigits: 0,
	maximumFractionDigits: 0
});

export const nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

/** Grilles rattachées à une grande famille du parcours. */
export function grillesDeFamille(famille: string): Grille[] {
	switch (famille) {
		case 'menuiseries':
			return GRILLES.filter(
				(g) =>
					g.categorie === 'Fenêtres PVC' ||
					g.categorie === 'Fenêtres ALU' ||
					g.categorie === 'Coulissants PVC' ||
					g.categorie === 'Coulissants ALU' ||
					g.categorie === 'Portes-fenêtres ALU'
			);
		case 'volets':
			return GRILLES.filter((g) => g.categorie === 'Volets roulants solaires');
		case 'garage':
			return GRILLES.filter((g) => g.categorie === 'Portes de garage');
		case 'exterieur':
			return GRILLES.filter((g) => g.categorie === 'Carport solaire' || g.categorie === 'Stores');
		default:
			return GRILLES.filter((g) => g.categorie === FAMILLE_BY_ID.get(famille)?.nom);
	}
}

/**
 * Grilles vendables seules d'une famille. Les grilles référencées par une option
 * (moustiquaire du volet roulant, impostes) sont des plus-values : elles ne se
 * chiffrent jamais à part, elles s'ajoutent au prix du châssis.
 */
const GRILLES_PLUS_VALUES = new Set(
	OPTIONS.map((o) => o.baremeId).filter((id): id is string => id != null && GRILLE_BY_ID.has(id))
);

export function grillesVendables(famille: string): Grille[] {
	return grillesDeFamille(famille).filter((g) => !GRILLES_PLUS_VALUES.has(g.id));
}

/** Famille du parcours à laquelle une grille est rattachée. */
export function familleDeGrille(grilleId: string): string | null {
	for (const f of FAMILLES) {
		if (grillesDeFamille(f.id).some((g) => g.id === grilleId)) return f.id;
	}
	return null;
}

/** Groupe d'options correspondant à une grille (menuiseries, volets, garage). */
export function groupeOptionsDeGrille(g: Grille): GroupeOption | null {
	return groupeDeGrille(g);
}

export function optionsDeGrille(g: Grille): OptionTarif[] {
	return optionsDeArticle({ kind: 'grille', g });
}

/** Barème 1D éventuellement attaché à une option « grille ». */
export function baremeDeOption(o: OptionTarif): Bareme | null {
	return o.baremeId ? (BAREME_BY_ID.get(o.baremeId) ?? null) : null;
}

/** Grille 2D éventuellement attachée à une option « grille » (imposte, moustiquaire). */
export function grilleDeOption(o: OptionTarif): Grille | null {
	return o.baremeId ? (GRILLE_BY_ID.get(o.baremeId) ?? null) : null;
}

// ---------------------------------------------------------------- Devis
export type LigneDevis = {
	/** identifiant unique de la ligne dans le devis */
	uid: string;
	/** référence produit ou grille + cotes (pour retrouver d'où vient le prix) */
	ref: string;
	designation: string;
	detail?: string;
	prixUnitaireHT: number;
	quantite: number;
	unite: 'u' | 'm2' | 'ml';
	tva: number;
	page?: number;
};

export type TotauxDevis = {
	totalHT: number;
	totalTVA: number;
	totalTTC: number;
	parTva: Map<number, { ht: number; tva: number; ttc: number }>;
};

export function totauxDevis(lignes: LigneDevis[], remisePct = 0): TotauxDevis {
	const k = 1 - remisePct / 100;
	let totalHT = 0;
	let totalTVA = 0;
	const parTva = new Map<number, { ht: number; tva: number; ttc: number }>();
	for (const l of lignes) {
		const ht = l.prixUnitaireHT * l.quantite * k;
		const tva = ht * l.tva;
		totalHT += ht;
		totalTVA += tva;
		const g = parTva.get(l.tva) ?? { ht: 0, tva: 0, ttc: 0 };
		g.ht += ht;
		g.tva += tva;
		g.ttc += tva + ht;
		parTva.set(l.tva, g);
	}
	return { totalHT, totalTVA, totalTTC: totalHT + totalTVA, parTva };
}

export function recapTexte(lignes: LigneDevis[], remisePct = 0): string {
	const t = totauxDevis(lignes, remisePct);
	const parts: string[] = [];
	for (const l of lignes) {
		const unite = l.unite === 'u' ? '' : l.unite === 'm2' ? ' m²' : ' ml';
		parts.push(
			`- ${l.designation}${l.detail ? ` (${l.detail})` : ''} × ${l.quantite}${unite} : ${euro.format(
				l.prixUnitaireHT * l.quantite * (1 - remisePct / 100)
			)} HT — ${TVA_LABEL[l.tva]}`
		);
	}
	if (remisePct) parts.push(`Remise commerciale : -${remisePct} %`);
	// Une seule TVA dans le devis : le total porte déjà tout, on ne le dit pas deux fois.
	const taux = [...t.parTva.entries()].sort((a, b) => a[0] - b[0]);
	if (taux.length > 1) {
		for (const [rate, g] of taux) {
			parts.push(
				`${TVA_LABEL[rate]} : ${euro.format(g.ht)} HT — ${euro.format(g.tva)} de TVA — ${euro.format(g.ttc)} TTC`
			);
		}
	}
	parts.push(
		`TOTAL : ${euro.format(t.totalHT)} HT — ${euro.format(t.totalTVA)} de TVA — ${euro.format(t.totalTTC)} TTC`
	);
	return parts.join('\n');
}
