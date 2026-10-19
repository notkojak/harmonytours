// MOTEUR DE CHIFFRAGE — applique le book 2026 à un article et à ses options.
// Pur TypeScript (aucun Svelte) pour être testable en dehors de l'interface :
// c'est ici que vivent les règles du book, l'interface ne fait que les piloter.

import { GRILLE_BY_ID, GRILLES, prixGrille, type Grille } from './grilles';
import { BAREME_BY_ID, coteProche, prixBareme } from './baremes';
import {
	appliquerOptions,
	optionsPour,
	sectionDe,
	SECTIONS_OPTIONS,
	type CalculOptions,
	type GroupeOption,
	type OptionTarif,
	type SectionOption
} from './options';
import type { Produit, TVA } from './catalogue';

export type Article = { kind: 'grille'; g: Grille } | { kind: 'produit'; p: Produit };

/** Cotes courantes du chiffrage (mm). */
export type Cotes = { h: number; l: number; imposteH?: number };

// ------------------------------------------------------------ Rattachements
/** Groupe d'options porté par une grille (menuiseries, volets, garage). */
export function groupeDeGrille(g: Grille): GroupeOption | null {
	if (g.categorie.endsWith('PVC')) return 'pvc';
	if (g.categorie.endsWith('ALU')) return 'alu';
	if (g.categorie === 'Volets roulants solaires') return 'volet';
	if (g.categorie === 'Portes de garage') return 'garage';
	return null;
}

/** Options proposables pour un article, dans l'ordre du book. */
export function optionsDeArticle(a: Article): OptionTarif[] {
	if (a.kind === 'grille') {
		const groupe = groupeDeGrille(a.g);
		return groupe ? optionsPour(a.g.id, groupe) : [];
	}
	return (a.p.optionGroupes ?? []).flatMap((g) => optionsPour(a.p.id, g as GroupeOption));
}

/** Regroupe les options par section d'affichage, dans l'ordre du book. */
export function sectionsDoptions(
	options: OptionTarif[]
): { section: SectionOption; options: OptionTarif[] }[] {
	const groupes: { section: SectionOption; options: OptionTarif[] }[] = [];
	for (const s of SECTIONS_OPTIONS) {
		const dedans = options.filter((o) => sectionDe(o).id === s.id);
		if (dedans.length) groupes.push({ section: s, options: dedans });
	}
	return groupes;
}

/**
 * Prix HT le plus bas réellement atteignable dans une grille, calculé une fois
 * pour toutes (grilles dérivées comprises : porte-fenêtre = OF × 1,15).
 */
const PRIX_MINI = new Map<string, number>();
for (const g of GRILLES) {
	let mini = Infinity;
	for (const ligne of g.lignes) {
		for (const col of g.cols) {
			const p = prixGrille(g, ligne.d, col);
			if (p != null && p < mini) mini = p;
		}
	}
	if (Number.isFinite(mini)) PRIX_MINI.set(g.id, mini);
}

export function prixMiniGrille(g: Grille): number {
	return PRIX_MINI.get(g.id) ?? 0;
}

/** Cotes de départ d'une grille : les valeurs médianes, les plus courantes. */
export function cotesMedianes(g: Grille): { h: number; l: number } {
	const hs = [...new Set(g.lignes.map((x) => x.d.v))].sort((a, b) => a - b);
	const ls = g.cols.map((c) => c.v);
	return { h: hs[Math.floor(hs.length / 2)], l: ls[Math.floor(ls.length / 2)] };
}

/** Vantaux ouvrants d'une menuiserie, déduits de la référence de la grille. */
export function vantauxDeGrille(g: Grille): number {
	const v = /-(\d)v\b/.exec(g.id);
	if (v) return Number(v[1]);
	const f = /-(?:of|pf)(\d)/.exec(g.id);
	if (f) return Number(f[1]);
	return 1;
}

// -------------------------------------------------------- Plus-values cotes
/**
 * Prix d'une plus-value de dimension :
 * — barème à la largeur (traverses intérieures, p. 17 et 30) ;
 * — grille 2D (imposte ALU p. 29, moustiquaire du volet p. 34).
 * Renvoie `null` quand la cote sort de la grille du book : l'option n'existe pas.
 */
export function montantPlusValue(o: OptionTarif, cotes: Cotes): number | null {
	if (o.type !== 'grille') return 0;

	const bareme = o.baremeId ? BAREME_BY_ID.get(o.baremeId) : undefined;
	if (bareme) return prixBareme(bareme, cotes.l);

	const sous = o.baremeId ? (GRILLE_BY_ID.get(o.baremeId) ?? null) : null;
	if (!sous) return 0;

	// Le book désigne lui-même l'axe de lecture (addon) : largeur du châssis en
	// lignes, hauteur d'imposte en colonnes, ou les cotes du volet pour la
	// moustiquaire.
	const hs = [...new Set(sous.lignes.map((x) => x.d.v))];
	const ls = sous.cols.map((c) => c.v);
	const ligne = o.addon?.autoLignes === 'l' ? cotes.l : cotes.h;
	const colonne =
		o.addon?.autoCols === 'l'
			? cotes.l
			: o.addon?.autoCols === 'h'
				? cotes.h
				: (cotes.imposteH ?? 600);

	if (ligne < Math.min(...hs) || ligne > Math.max(...hs)) return null;
	if (colonne < Math.min(...ls) || colonne > Math.max(...ls)) return null;
	return prixGrille(sous, { v: coteProche(ligne, hs) }, { v: coteProche(colonne, ls) });
}

// -------------------------------------------------------------- Chiffrage
export type ContexteChiffrage = {
	article: Article;
	h: number;
	l: number;
	qte: number;
	choix: string[];
	imposteH?: number;
	carreaux?: number;
	/** Force le nombre de vantaux (sinon déduit de la grille). */
	vantauxForce?: number | null;
};

export type Chiffrage = {
	/** Prix de grille ou prix du book, avant options (HT). */
	base: number | null;
	tva: TVA;
	page: number;
	surface: number;
	metres: number;
	vantaux: number;
	/** Montant de chaque plus-value de dimension (`null` = hors grille). */
	plusValues: Map<string, number | null>;
	retenues: { option: OptionTarif; quantite?: number; montantGrille?: number }[];
	calcul: CalculOptions | null;
};

export function chiffrer(ctx: ContexteChiffrage): Chiffrage {
	const { article, h, l, qte } = ctx;
	const cotes: Cotes = { h, l, imposteH: ctx.imposteH ?? 600 };
	const options = optionsDeArticle(article);
	const choix = ctx.choix ?? [];

	const surface = article.kind === 'grille' ? (h * l) / 1_000_000 : qte;
	const metres = article.kind === 'grille' ? l / 1000 : qte;
	const vantaux = article.kind === 'grille' ? (ctx.vantauxForce ?? vantauxDeGrille(article.g)) : 1;

	const plusValues = new Map<string, number | null>();
	for (const o of options) {
		if (o.type === 'grille') plusValues.set(o.id, montantPlusValue(o, cotes));
	}

	const retenues = options
		.filter((o) => choix.includes(o.id))
		.map((o) => {
			switch (o.type) {
				case 'eur_m2':
					return { option: o, quantite: surface };
				case 'eur_ml':
					return { option: o, quantite: metres };
				case 'eur_vantail':
					return { option: o, quantite: vantaux };
				case 'eur_carrea':
					return { option: o, quantite: ctx.carreaux ?? 4 };
				case 'grille':
					return { option: o, montantGrille: plusValues.get(o.id) ?? 0 };
				default:
					return { option: o };
			}
		});

	const base =
		article.kind === 'grille' ? prixGrille(article.g, { v: h }, { v: l }) : article.p.prixHT;

	return {
		base,
		tva: article.kind === 'grille' ? (article.g.tva as TVA) : article.p.tva,
		page: article.kind === 'grille' ? article.g.page : article.p.page,
		surface,
		metres,
		vantaux,
		plusValues,
		retenues,
		calcul: base == null ? null : appliquerOptions(base, retenues)
	};
}
