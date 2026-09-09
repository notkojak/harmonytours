// Stores extérieurs & bannes (book de tarifs 2026) — vendus au point,
// grilles tombée (mm) × largeur (mm). TVA 10 % (page stores extérieurs du book).
// Données extraites du PDF « BOOK TARIF NEW » (pages 84-87 du book).
import type { GrilleMenuiserie } from './menuiseries';

export const GRID_BANNE_SEMI_COFFRE: GrilleMenuiserie = {
	id: 'banne-semi-coffre',
	nom: 'Banne semi coffre — 2 bras électrique',
	categorie: 'Stores extérieurs',
	tva: 0.1,
	cols: [{ v: 3680 }, { v: 4740 }, { v: 5920 }],
	lignes: [
		{ d: { v: 1500 }, p: [43.71, 48.72, 54.26] },
		{ d: { v: 2000 }, p: [45.49, 50.95, 56.89] },
		{ d: { v: 2500 }, p: [46.16, 51.86, 60.05] },
		{ d: { v: 3000 }, p: [47.88, 54.01, 62.47] }
	]
};

// Le 4e largeur du book s'affiche « 4840 » en double ; on conserve la 4e colonne
// telle quelle (valeurs supérieures) avec le libellé « 4840 bis ».
export const GRID_BANNE_COFFRE_INTEGRAL: GrilleMenuiserie = {
	id: 'banne-coffre-integral',
	nom: 'Banne coffre intégral — 2 bras électrique',
	categorie: 'Stores extérieurs',
	tva: 0.1,
	cols: [
		{ v: 2470 },
		{ v: 3670 },
		{ v: 4840 },
		{ v: 4841, l: '4840 (2 nœuds œillets)' }
	],
	lignes: [
		{ d: { v: 1500 }, p: [58.26, 63.68, 69.48, 74.9] },
		{ d: { v: 2000 }, p: [60.26, 65.87, 72.1, 77.97] },
		{ d: { v: 2500 }, p: [null, 68.02, 74.73, 81.09] },
		{ d: { v: 3000 }, p: [null, 69.48, 76.36, 83.11] },
		{ d: { v: 3500 }, p: [null, null, 77.93, 85.09] }
	]
};

export const GRID_BANNE_SANS_COFFRE_2BRAS: GrilleMenuiserie = {
	id: 'banne-sans-coffre-2bras',
	nom: 'Banne sans coffre — 2 bras électrique',
	categorie: 'Stores extérieurs',
	tva: 0.1,
	cols: [{ v: 2380 }, { v: 3560 }, { v: 4740 }, { v: 5920 }],
	lignes: [
		{ d: { v: 1500 }, p: [37.8, 41.45, 45.45, 50.93] },
		{ d: { v: 2000 }, p: [39.22, 42.46, 48.18, 54.16] },
		{ d: { v: 2500 }, p: [39.75, 45.52, 50.29, 56.39] },
		{ d: { v: 3000 }, p: [41.09, 47.49, 52.69, 59.29] },
		{ d: { v: 3500 }, p: [43.82, 49.64, 56.89, 64.62] },
		{ d: { v: 4000 }, p: [null, null, 60.82, 68.54] }
	]
};

export const GRID_BANNE_SANS_COFFRE_4BRAS: GrilleMenuiserie = {
	id: 'banne-sans-coffre-4bras',
	nom: 'Banne sans coffre — 4 bras électrique',
	categorie: 'Stores extérieurs',
	tva: 0.1,
	cols: [{ v: 7100 }, { v: 8280 }, { v: 9460 }, { v: 10640 }, { v: 11820 }],
	lignes: [
		{ d: { v: 1500 }, p: [76.81, 80.55, 84.25, 89.36, 94.5] },
		{ d: { v: 2000 }, p: [80.92, 85.13, 89.34, 94.95, 100.48] },
		{ d: { v: 2500 }, p: [87.11, 91.77, 96.33, 102.32, 108.26] },
		{ d: { v: 3000 }, p: [91.02, 96.09, 101.21, 107.68, 114.04] },
		{ d: { v: 3500 }, p: [102.28, 109.31, 116.92, 124.42, null] },
		{ d: { v: 4000 }, p: [114.49, 122.03, 129.54, null, null] }
	]
};

export const GRID_BANNE_SANS_COFFRE_6BRAS: GrilleMenuiserie = {
	id: 'banne-sans-coffre-6bras',
	nom: 'Banne sans coffre — 6 bras électrique',
	categorie: 'Stores extérieurs',
	tva: 0.1,
	cols: [{ v: 13000 }, { v: 14180 }, { v: 15360 }, { v: 16540 }, { v: 17720 }],
	lignes: [
		{ d: { v: 1500 }, p: [111.59, 115.99, 120.14, 126.07, 130.29] },
		{ d: { v: 2000 }, p: [118.98, 123.88, 128.55, 134.95, 139.68] },
		{ d: { v: 2500 }, p: [127.21, 132.22, 137.02, 143.44, 148.3] },
		{ d: { v: 3000 }, p: [133.86, 139.42, 144.6, 151.5, 156.79] },
		{ d: { v: 3500 }, p: [145.42, 151.37, 157.09, 164.46, 170.31] },
		{ d: { v: 4000 }, p: [158.19, 163.9, 171.28, 177.08, null] }
	]
};

export const BANNES: GrilleMenuiserie[] = [
	GRID_BANNE_SEMI_COFFRE,
	GRID_BANNE_COFFRE_INTEGRAL,
	GRID_BANNE_SANS_COFFRE_2BRAS,
	GRID_BANNE_SANS_COFFRE_4BRAS,
	GRID_BANNE_SANS_COFFRE_6BRAS
];

// Options & plus-values (points fixes, TVA 10 %)
export type BanneOption = { id: string; nom: string; points: number };
export const BANNE_OPTIONS: BanneOption[] = [
	{ id: 'banne-manivelle', nom: 'Manivelle 2000-2400-3000 mm (2-4 bras)', points: 3.1 },
	{ id: 'banne-manivelle-46', nom: 'Manivelle 2000-2400-3000 mm (4-6 bras)', points: 9.04 },
	{ id: 'banne-treuil-semi', nom: 'Treuil avec fin de course (semi coffre / coffre intégral)', points: -11.13 },
	{ id: 'banne-treuil-2bras', nom: 'Treuil avec fin de course, tombée maxi 3500 (sans coffre 2 bras)', points: -8.25 },
	{ id: 'banne-treuil-2bras-r', nom: 'Treuil R 1/13 fin de course, tombée 4000 (sans coffre 2 bras)', points: -5.42 },
	{ id: 'banne-treuil-4bras', nom: 'Treuil R 1/13 fin de course, tombée maxi 3000 (4 bras)', points: -7.52 },
	{ id: 'banne-lambrequin-201-400', nom: 'Lambrequin hauteur 201 à 400 mm (2 bras)', points: 2.97 },
	{ id: 'banne-lambrequin-201-400-46', nom: 'Lambrequin hauteur 201 à 400 mm (4-6 bras)', points: 1.18 },
	{ id: 'banne-lambrequin-401-800', nom: 'Lambrequin hauteur 401 à 800 mm', points: 2.39 },
	{ id: 'banne-mot-filaire-cs', nom: 'Option motorisation : manœuvre filaire CS AXM', points: 3.7 },
	{ id: 'banne-mot-filaire-lt', nom: 'Option motorisation : manœuvre filaire LT', points: 2.67 },
	{ id: 'banne-mot-cs-lt-csi', nom: 'Option motorisation : manœuvre filaire CS LT CSI', points: 6.43 },
	{ id: 'banne-mot-radio-orea', nom: 'Option motorisation : radio Orea RTS', points: 4.62 },
	{ id: 'banne-mot-radio-altus', nom: 'Option motorisation : radio Altus RTS', points: 6.79 },
	{ id: 'banne-mot-radio-cs-rts', nom: 'Option motorisation : radio CS LT CSI RTS', points: 10.21 },
	{ id: 'banne-auto-vent-eolis', nom: 'Automatisme vent Eolis filaire', points: 7.22 },
	{ id: 'banne-auto-soleil-soliris', nom: 'Automatisme vent + soleil Soliris filaire', points: 11.26 },
	{ id: 'banne-auto-eolis-rts', nom: 'Automatisme vent Eolis RTS', points: 4.13 },
	{ id: 'banne-auto-soliris-rts', nom: 'Automatisme vent + soleil Soliris RTS', points: 6.53 },
	{ id: 'banne-capteur-vent', nom: 'Capteur vent autonome Eolis 3D RTS', points: 3.7 }
];
