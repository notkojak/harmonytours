// OPTIONS & PLUS-VALUES — « BOOK TARIFAIRE » 2026.
// Ordre d'application donné par le book : d'abord les coefficients et les
// pourcentages sur le prix de grille (les pourcentages s'additionnent entre
// eux), ensuite les plus-values fixes en euros.
//   prix = base × (1 + Σ pourcentages) × Π coefficients + Σ plus-values fixes

import type { TVA } from './catalogue';

export type TypeOption =
	| 'pct' // pourcentage sur le prix de grille
	| 'coef' // coefficient multiplicateur (peut être < 1)
	| 'eur' // plus-value fixe à l'unité
	| 'eur_m2'
	| 'eur_ml'
	| 'eur_vantail'
	| 'eur_carrea' // par carreau
	| 'info' // rappel : valeur inchangée
	| 'grille'; // plus-value calculée par un barème de largeur

export type OptionTarif = {
	id: string;
	nom: string;
	groupe: GroupeOption;
	type: TypeOption;
	/** % (0.4 = +40 %), coefficient (1.15) ou montant HT en euros. */
	valeur: number;
	detail?: string;
	page: number;
	/** Restreint l'option à certaines menuiseries (par identifiant de grille). */
	pour?: (grilleId: string) => boolean;
	/** Barème de largeur utilisé pour le type « grille ». */
	baremeId?: string;
	/** Grille 2D (imposte, moustiquaire) : libellés des axes et auto-remplissage. */
	addon?: {
		lignes: string;
		cols: string;
		/** Axe parent utilisé pour pré-remplir (h = hauteur, l = largeur). */
		autoLignes?: 'h' | 'l';
		autoCols?: 'h' | 'l';
		defCols?: number;
	};
};

export type GroupeOption = 'pvc' | 'alu' | 'volet' | 'garage' | 'entree';

export const GROUPES_OPTIONS: { id: GroupeOption; nom: string; tva: TVA }[] = [
	{ id: 'pvc', nom: 'Options menuiseries PVC', tva: 0.055 },
	{ id: 'alu', nom: 'Options menuiseries ALU', tva: 0.055 },
	{ id: 'volet', nom: 'Options volet roulant solaire', tva: 0.055 },
	{ id: 'garage', nom: 'Options porte de garage', tva: 0.1 },
	{ id: 'entree', nom: 'Options porte d’entrée', tva: 0.055 }
];

// --- Prédicats de ciblage ---------------------------------------------------
const pvc = (id: string) => id.startsWith('pvc-');
const alu = (id: string) => id.startsWith('alu-');
const coulissant = (id: string) => id.includes('coulissant');
const galandage = (id: string) => id.includes('galandage');
const frappe = (id: string) => /-(of|pf)\d/.test(id);
const of1 = (id: string) => /-of1$/.test(id);
const of2 = (id: string) => /-of2$/.test(id);
const pf1 = (id: string) => /-pf1$/.test(id);
const fixe = (id: string) => id.includes('fixe') || id.includes('trapeze');
const soufflet = (id: string) => id.includes('soufflet');
const coulissantFrappe = (id: string) => id.includes('coulissant-frappe');
const coulissant2v = (id: string) => id.includes('coulissant-2v');
const tous = () => true;

export const OPTIONS: OptionTarif[] = [
	// --------------------------------------------------- Menuiseries PVC (p.16)
	{
		id: 'pvc-couleurs-filmees',
		nom: 'Autres couleurs filmées 1 ou 2 faces',
		groupe: 'pvc',
		type: 'pct',
		valeur: 0.4,
		page: 16,
		pour: pvc
	},
	{
		id: 'pvc-beige',
		nom: 'Coloris beige teinté masse (dit « sable »)',
		groupe: 'pvc',
		type: 'pct',
		valeur: 0.05,
		page: 16,
		pour: pvc
	},
	{
		id: 'pvc-filme-1',
		nom: 'Coloris filmé 1 face (chêne doré…)',
		groupe: 'pvc',
		type: 'pct',
		valeur: 0.2,
		page: 16,
		pour: pvc
	},
	{
		id: 'pvc-filme-2',
		nom: 'Coloris filmé 2 faces',
		groupe: 'pvc',
		type: 'pct',
		valeur: 0.35,
		page: 16,
		pour: pvc
	},
	{
		id: 'pvc-gris',
		nom: 'Coloris gris teinté masse',
		groupe: 'pvc',
		type: 'pct',
		valeur: 0.05,
		page: 16,
		pour: pvc
	},
	{
		id: 'pvc-doublage-140',
		nom: 'Doublage 140 mm',
		groupe: 'pvc',
		type: 'pct',
		valeur: 0.03,
		page: 16,
		pour: pvc
	},
	{
		id: 'pvc-doublage-160',
		nom: 'Doublage 160 mm',
		groupe: 'pvc',
		type: 'pct',
		valeur: 0.06,
		page: 16,
		pour: pvc
	},
	{
		id: 'pvc-mixte',
		nom: 'PVC 1 face laquée + 1 face filmée ou teintée masse',
		groupe: 'pvc',
		type: 'pct',
		valeur: 0.4,
		page: 16,
		pour: pvc
	},
	{
		id: 'pvc-laque-1',
		nom: 'PVC laqué 1 face — 20 RAL du nuancier',
		groupe: 'pvc',
		type: 'pct',
		valeur: 0.25,
		page: 16,
		pour: pvc
	},
	{
		id: 'pvc-laque-2',
		nom: 'PVC laqué 2 faces, même coloris',
		groupe: 'pvc',
		type: 'pct',
		valeur: 0.4,
		page: 16,
		pour: pvc
	},
	{
		id: 'pvc-bicoloration',
		nom: 'PVC laqué bicoloration — 2 faces, 2 coloris',
		groupe: 'pvc',
		type: 'pct',
		valeur: 0.4,
		page: 16,
		pour: pvc
	},
	{
		id: 'pvc-hors-nuancier',
		nom: 'PVC laqué hors nuancier — 185 couleurs sur demande',
		groupe: 'pvc',
		type: 'pct',
		valeur: 0.4,
		page: 16,
		pour: pvc
	},
	{
		id: 'pvc-renfort',
		nom: 'Renforcement total',
		groupe: 'pvc',
		type: 'pct',
		valeur: 0.1,
		page: 16,
		pour: pvc
	},
	{
		id: 'pvc-vitrage-depoli',
		nom: 'Vitrage dépoli',
		groupe: 'pvc',
		type: 'coef',
		valeur: 2.26,
		page: 16,
		pour: pvc
	},
	{
		id: 'pvc-vitrage-chinchilla',
		nom: 'Vitrage marbré Chinchilla',
		groupe: 'pvc',
		type: 'coef',
		valeur: 1.53,
		page: 16,
		pour: pvc
	},
	{
		id: 'pvc-vitrage-phonique',
		nom: 'Vitrage phonique 10.16.4',
		groupe: 'pvc',
		type: 'coef',
		valeur: 1.17,
		page: 16,
		pour: pvc
	},
	{
		id: 'pvc-vitrage-securite',
		nom: 'Vitrage sécurité 44/2.16.4 ou Delta',
		groupe: 'pvc',
		type: 'coef',
		valeur: 1.32,
		page: 16,
		pour: pvc
	},
	{
		id: 'pvc-vitrage-thermique',
		nom: 'Vitrage thermique renforcé 4.20.4 ou Imprimé 200',
		groupe: 'pvc',
		type: 'info',
		valeur: 1,
		page: 16,
		pour: pvc
	},
	{
		id: 'pvc-cache-paumelle',
		nom: 'Cache paumelle laiton',
		groupe: 'pvc',
		type: 'eur',
		valeur: 21,
		page: 16,
		pour: pvc
	},
	{
		id: 'pvc-canne-tirage',
		nom: 'Canne de tirage, soufflet à tringle',
		groupe: 'pvc',
		type: 'eur',
		valeur: 23,
		page: 16,
		pour: (id) => pvc(id) && soufflet(id)
	},
	{
		id: 'pvc-croisillon-colle-26',
		nom: 'Croisillons collés PVC 26 mm (blanc, beige, chêne doré)',
		groupe: 'pvc',
		type: 'eur_carrea',
		valeur: 35,
		page: 16,
		pour: pvc
	},
	{
		id: 'pvc-croisillon-inc-10',
		nom: 'Croisillons incorporés PVC 10 mm (canon de fusil, blanc, laiton)',
		groupe: 'pvc',
		type: 'eur_carrea',
		valeur: 19,
		page: 16,
		pour: pvc
	},
	{
		id: 'pvc-croisillon-inc-blanc-26',
		nom: 'Croisillons incorporés PVC blanc 26 mm',
		groupe: 'pvc',
		type: 'eur_carrea',
		valeur: 16,
		page: 16,
		pour: pvc
	},
	{
		id: 'pvc-croisillon-inc-couleur-26',
		nom: 'Croisillons incorporés PVC couleur 26 mm ou mixtes',
		groupe: 'pvc',
		type: 'eur_carrea',
		valeur: 20,
		page: 16,
		pour: pvc
	},
	{
		id: 'pvc-cremone-soufflet',
		nom: 'Crémone et poignée, soufflet à tringle',
		groupe: 'pvc',
		type: 'eur',
		valeur: 43,
		page: 16,
		pour: (id) => pvc(id) && soufflet(id)
	},
	{
		id: 'pvc-cremone-serrure',
		nom: 'Crémone serrure',
		groupe: 'pvc',
		type: 'eur',
		valeur: 246,
		page: 16,
		pour: (id) => pvc(id) && !soufflet(id)
	},
	{
		id: 'pvc-grille-defense',
		nom: 'Grille de défense PVC 75 × 60 × 4 cm',
		groupe: 'pvc',
		type: 'eur',
		valeur: 710,
		page: 16,
		pour: pvc
	},
	{
		id: 'pvc-grille-ventilation',
		nom: 'Grille de ventilation',
		groupe: 'pvc',
		type: 'eur',
		valeur: 19,
		page: 16,
		pour: pvc
	},
	{
		id: 'pvc-mortaise',
		nom: 'Mortaise de ventilation',
		groupe: 'pvc',
		type: 'eur',
		valeur: 8,
		page: 16,
		pour: (id) => pvc(id) && !coulissant(id)
	},
	{
		id: 'pvc-oscillo',
		nom: 'Oscillo-battant',
		groupe: 'pvc',
		type: 'eur',
		valeur: 128,
		page: 16,
		pour: (id) => pvc(id) && (of1(id) || of2(id))
	},
	{
		id: 'pvc-panneau-alu',
		nom: 'Panneau alu lisse, chêne doré uniquement',
		groupe: 'pvc',
		type: 'eur_m2',
		valeur: 314,
		page: 16,
		pour: pvc
	},
	{
		id: 'pvc-traverse-fixe',
		nom: 'Plus-value traverse intérieure, fixe vitré PVC',
		groupe: 'pvc',
		type: 'grille',
		valeur: 0,
		baremeId: 'traverse-fixe-pvc',
		page: 17,
		pour: (id) => pvc(id) && fixe(id)
	},
	{
		id: 'pvc-traverse-soufflet',
		nom: 'Plus-value traverse intérieure, soufflet PVC',
		groupe: 'pvc',
		type: 'grille',
		valeur: 0,
		baremeId: 'traverse-soufflet-pvc',
		page: 17,
		pour: (id) => pvc(id) && soufflet(id)
	},
	{
		id: 'pvc-poignee-cds',
		nom: 'Poignée de tirage CDS',
		groupe: 'pvc',
		type: 'eur_vantail',
		valeur: 48,
		page: 16,
		pour: pvc
	},
	{
		id: 'pvc-poignee-entrebailleuse',
		nom: 'Poignée entrebailleuse',
		groupe: 'pvc',
		type: 'eur',
		valeur: 39,
		page: 16,
		pour: pvc
	},
	{
		id: 'pvc-poignee-laiton',
		nom: 'Poignée laiton',
		groupe: 'pvc',
		type: 'eur',
		valeur: 56,
		page: 16,
		pour: pvc
	},
	{
		id: 'pvc-poignee-laiton-cle',
		nom: 'Poignée laiton à clé',
		groupe: 'pvc',
		type: 'eur',
		valeur: 198,
		page: 16,
		pour: pvc
	},
	{
		id: 'pvc-poignee-cle',
		nom: 'Poignée à clé',
		groupe: 'pvc',
		type: 'eur',
		valeur: 99,
		page: 16,
		pour: pvc
	},
	{
		id: 'pvc-rejet-eau',
		nom: 'Rejet d’eau sur ouvrant',
		groupe: 'pvc',
		type: 'eur',
		valeur: 23,
		page: 16,
		pour: pvc
	},
	{
		id: 'pvc-serrure-coulissant',
		nom: 'Serrure poignées 2 faces, coulissant à frappe',
		groupe: 'pvc',
		type: 'eur',
		valeur: 545,
		page: 16,
		pour: (id) => pvc(id) && coulissantFrappe(id)
	},
	{
		id: 'pvc-seuil-alu',
		nom: 'Seuil alu',
		groupe: 'pvc',
		type: 'eur_ml',
		valeur: 118,
		page: 16,
		pour: pvc
	},

	// --------------------------------------------------- Menuiseries ALU (p.28)
	{
		id: 'alu-ral-galandage',
		nom: 'Autre RAL, galandage',
		groupe: 'alu',
		type: 'pct',
		valeur: 0.12,
		page: 28,
		pour: (id) => alu(id) && galandage(id)
	},
	{
		id: 'alu-bicoloration',
		nom: 'Bicoloration — intérieur blanc, extérieur coloré',
		groupe: 'alu',
		type: 'pct',
		valeur: 0.05,
		page: 28,
		pour: alu
	},
	{
		id: 'alu-medium',
		nom: 'Coloris MEDIUM',
		groupe: 'alu',
		type: 'pct',
		valeur: 0.05,
		detail:
			'1013, 1015, 1247, 3004, 5008, 6021, 7022, 7035, 7039, 8019, 9005, 9006, noir 2100 et gris 2900 sablés.',
		page: 28,
		pour: alu
	},
	{
		id: 'alu-premium',
		nom: 'Coloris PREMIUM et hors nuancier',
		groupe: 'alu',
		type: 'pct',
		valeur: 0.2,
		detail: 'Mars 2525 sablé, Anodic natura, Anodic champagne et les 200 coloris sur demande.',
		page: 28,
		pour: alu
	},
	{
		id: 'alu-standard',
		nom: 'Coloris STANDARD — blanc trafic 9016 satiné, gris anthracite 7016 texturé mat',
		groupe: 'alu',
		type: 'info',
		valeur: 1,
		page: 28,
		pour: alu
	},
	{
		id: 'alu-iso-galandage',
		nom: 'ISO 100, galandage',
		groupe: 'alu',
		type: 'pct',
		valeur: 0.1,
		page: 28,
		pour: (id) => alu(id) && galandage(id)
	},
	{
		id: 'alu-vitrage-depoli',
		nom: 'Vitrage dépoli',
		groupe: 'alu',
		type: 'coef',
		valeur: 2.26,
		page: 28,
		pour: alu
	},
	{
		id: 'alu-vitrage-chinchilla',
		nom: 'Vitrage marbré Chinchilla',
		groupe: 'alu',
		type: 'coef',
		valeur: 1.53,
		page: 28,
		pour: alu
	},
	{
		id: 'alu-vitrage-phonique',
		nom: 'Vitrage phonique 10.16.4',
		groupe: 'alu',
		type: 'coef',
		valeur: 1.17,
		page: 28,
		pour: alu
	},
	{
		id: 'alu-vitrage-securite',
		nom: 'Vitrage sécurité 44/2.16.4 ou Delta',
		groupe: 'alu',
		type: 'coef',
		valeur: 1.32,
		page: 28,
		pour: alu
	},
	{
		id: 'alu-croisillon-couleur-26',
		nom: 'Croisillons ALU couleur 26 mm ou mixtes',
		groupe: 'alu',
		type: 'eur_carrea',
		valeur: 23,
		page: 28,
		pour: alu
	},
	{
		id: 'alu-croisillon-colle-26',
		nom: 'Croisillons collés ALU 26 mm',
		groupe: 'alu',
		type: 'eur_carrea',
		valeur: 40,
		page: 28,
		pour: alu
	},
	{
		id: 'alu-croisillon-inc-10',
		nom: 'Croisillons incorporés ALU 10 mm',
		groupe: 'alu',
		type: 'eur_carrea',
		valeur: 22,
		page: 28,
		pour: alu
	},
	{
		id: 'alu-croisillon-inc-blanc-26',
		nom: 'Croisillons incorporés ALU blanc 26 mm',
		groupe: 'alu',
		type: 'eur_carrea',
		valeur: 18,
		page: 28,
		pour: alu
	},
	{
		id: 'alu-cremone',
		nom: 'Crémone et poignée',
		groupe: 'alu',
		type: 'eur',
		valeur: 53,
		page: 28,
		pour: alu
	},
	{
		id: 'alu-grille-defense',
		nom: 'Grille de défense ALU 75 × 60 × 4 cm',
		groupe: 'alu',
		type: 'eur',
		valeur: 816,
		page: 28,
		pour: alu
	},
	{
		id: 'alu-grille-ventilation',
		nom: 'Grille de ventilation 30 m³ acoustique 41 dB',
		groupe: 'alu',
		type: 'eur',
		valeur: 122,
		page: 28,
		pour: alu
	},
	{
		id: 'alu-oscillo',
		nom: 'Oscillo-battant, OF1 et OF2',
		groupe: 'alu',
		type: 'eur',
		valeur: 158,
		page: 28,
		pour: (id) => alu(id) && (of1(id) || of2(id))
	},
	{
		id: 'alu-panneau-coulissant',
		nom: 'Panneau alu 2 faces lisses, coulissants et galandages',
		groupe: 'alu',
		type: 'eur_m2',
		valeur: 244,
		page: 28,
		pour: (id) => alu(id) && (coulissant(id) || galandage(id))
	},
	{
		id: 'alu-panneau-frappe',
		nom: 'Panneau alu 2 faces lisses, frappes OF1, PF1, OF2, PF2',
		groupe: 'alu',
		type: 'eur_m2',
		valeur: 212,
		page: 28,
		pour: (id) => alu(id) && frappe(id) && !coulissant(id)
	},
	{
		id: 'alu-imposte-coulissant',
		nom: 'Plus-value imposte, coulissant ALU 2 vantaux 2 rails',
		groupe: 'alu',
		type: 'grille',
		valeur: 0,
		baremeId: 'alu-imposte-coulissant',
		page: 29,
		pour: (id) => alu(id) && coulissant2v(id),
		addon: {
			lignes: 'Largeur du châssis',
			cols: 'Hauteur d’imposte (400 à 1 000 mm)',
			autoLignes: 'l',
			defCols: 600
		}
	},
	{
		id: 'alu-imposte-pf1',
		nom: 'Plus-value imposte, porte-fenêtre ALU 1 vantail',
		groupe: 'alu',
		type: 'grille',
		valeur: 0,
		baremeId: 'alu-imposte-pf1',
		page: 29,
		pour: (id) => alu(id) && pf1(id),
		addon: {
			lignes: 'Largeur du châssis',
			cols: 'Hauteur d’imposte (400 à 1 000 mm)',
			autoLignes: 'l',
			defCols: 600
		}
	},
	{
		id: 'alu-traverse-coulissant',
		nom: 'Plus-value traverse intérieure, coulissant ALU 2 vantaux',
		groupe: 'alu',
		type: 'grille',
		valeur: 0,
		baremeId: 'traverse-coulissant-alu',
		page: 30,
		pour: (id) => alu(id) && coulissant2v(id)
	},
	{
		id: 'alu-traverse-fixe',
		nom: 'Plus-value traverse intérieure, fixe ALU',
		groupe: 'alu',
		type: 'eur',
		valeur: 244,
		page: 28,
		pour: (id) => alu(id) && fixe(id)
	},
	{
		id: 'alu-traverse-frappe',
		nom: 'Plus-value traverse intérieure, frappe et soufflet ALU',
		groupe: 'alu',
		type: 'grille',
		valeur: 0,
		baremeId: 'traverse-frappe-alu',
		page: 30,
		pour: (id) => alu(id) && (frappe(id) || soufflet(id))
	},
	{
		id: 'alu-poignee-coulissant',
		nom: 'Poignée confort fixe tirage extérieur, coulissant',
		groupe: 'alu',
		type: 'eur',
		valeur: 45,
		page: 28,
		pour: (id) => alu(id) && coulissant(id)
	},
	{
		id: 'alu-poignee-galandage',
		nom: 'Poignée confort fixe tirage extérieur, galandage',
		groupe: 'alu',
		type: 'eur',
		valeur: 128,
		page: 28,
		pour: (id) => alu(id) && galandage(id)
	},
	{
		id: 'alu-poignee-galandage-cle',
		nom: 'Poignée extérieure à clé, intérieure commande ou fixe, galandage',
		groupe: 'alu',
		type: 'eur',
		valeur: 214,
		page: 28,
		pour: (id) => alu(id) && galandage(id)
	},
	{
		id: 'alu-poignee-f9-of1',
		nom: 'Poignée finition F9, OF1',
		groupe: 'alu',
		type: 'eur',
		valeur: 69,
		page: 28,
		pour: (id) => alu(id) && of1(id)
	},
	{
		id: 'alu-poignee-f9-coulissant',
		nom: 'Poignée finition F9, coulissants',
		groupe: 'alu',
		type: 'eur',
		valeur: 45,
		page: 28,
		pour: (id) => alu(id) && coulissant(id)
	},
	{
		id: 'alu-poignee-cle-of',
		nom: 'Poignée à clé, OF1 et OF2',
		groupe: 'alu',
		type: 'eur',
		valeur: 122,
		page: 28,
		pour: (id) => alu(id) && (of1(id) || of2(id))
	},
	{
		id: 'alu-poignee-cle-coulissant',
		nom: 'Poignée à clé, coulissants',
		groupe: 'alu',
		type: 'eur',
		valeur: 283,
		page: 28,
		pour: (id) => alu(id) && coulissant(id)
	},
	{
		id: 'alu-serrure-coulissant',
		nom: 'Serrure poignées 2 faces, coulissants',
		groupe: 'alu',
		type: 'eur_vantail',
		valeur: 244,
		page: 28,
		pour: (id) => alu(id) && coulissant(id)
	},
	{
		id: 'alu-seuil-of',
		nom: 'Seuil alu 20 mm, OF1 et OF2',
		groupe: 'alu',
		type: 'eur',
		valeur: 146,
		page: 28,
		pour: (id) => alu(id) && (of1(id) || of2(id))
	},

	// ------------------------------------------------ Volet roulant solaire (p.34)
	{
		id: 'volet-coloris-7016',
		nom: 'Coloris 7016, bleu acier, rouge pourpre ou vert sapin, coffre 1/4 de rond',
		groupe: 'volet',
		type: 'pct',
		valeur: 0.2,
		page: 34,
		pour: tous
	},
	{
		id: 'volet-coloris-calise',
		nom: 'Coloris de tablier CALISO : gris anthracite 7016, ivoire 1015 ou brun 8019',
		groupe: 'volet',
		type: 'pct',
		valeur: 0.1,
		page: 34,
		pour: tous
	},
	{
		id: 'volet-laquage',
		nom: 'Laquage coffre, coulisse et lame finale',
		groupe: 'volet',
		type: 'pct',
		valeur: 0.2,
		page: 34,
		pour: tous
	},
	{
		id: 'volet-alim-secours',
		nom: 'Alimentation de secours',
		groupe: 'volet',
		type: 'eur',
		valeur: 158,
		page: 34,
		pour: tous
	},
	{
		id: 'volet-arret-bas',
		nom: 'Arrêt bas filant blanc, marron, beige ou 8003',
		groupe: 'volet',
		type: 'eur',
		valeur: 102,
		page: 34,
		pour: tous
	},
	{
		id: 'volet-arret-bas-laque',
		nom: 'Arrêt bas filant laqué suivant demande',
		groupe: 'volet',
		type: 'eur',
		valeur: 356,
		page: 34,
		pour: tous
	},
	{
		id: 'volet-capot',
		nom: 'Capot arrondi pour coulisse rénovation',
		groupe: 'volet',
		type: 'eur_ml',
		valeur: 56,
		page: 34,
		pour: tous
	},
	{
		id: 'volet-dos-150',
		nom: 'Dos de coffre 150 mm pour habillage',
		groupe: 'volet',
		type: 'eur_ml',
		valeur: 42,
		page: 34,
		pour: tous
	},
	{
		id: 'volet-dos-180',
		nom: 'Dos de coffre 180 mm pour habillage',
		groupe: 'volet',
		type: 'eur_ml',
		valeur: 54,
		page: 34,
		pour: tous
	},
	{
		id: 'volet-manoeuvre-secours',
		nom: 'Manœuvre de secours',
		groupe: 'volet',
		type: 'eur',
		valeur: 619,
		detail: 'Largeur ≥ 900 mm.',
		page: 34,
		pour: tous
	},
	{
		id: 'volet-moustiquaire',
		nom: 'Moustiquaire intégrée au volet roulant',
		groupe: 'volet',
		type: 'grille',
		valeur: 0,
		baremeId: 'volet-moustiquaire',
		detail: 'Largeurs 500 à 1 600 mm.',
		page: 34,
		pour: tous,
		addon: { lignes: 'Hauteur du volet', cols: 'Largeur du volet', autoLignes: 'h', autoCols: 'l' }
	},

	// ------------------------------------------------- Porte de garage (p.36)
	// Les plus-values de coloris ne s'appliquent qu'aux grilles « blanc » : le
	// book imprime une grille RAL / plaxé à part, déjà colorisée.
	{
		id: 'garage-noir-easy',
		nom: 'Coloris noir 2100, gamme EASY',
		groupe: 'garage',
		type: 'pct',
		valeur: 0.12,
		page: 36,
		pour: (id) => id.startsWith('garage-easy') && id.endsWith('-blanc')
	},
	{
		id: 'garage-plaxe',
		nom: 'Coloris plaxé — chêne doré, teck foncé (EASY), noyer (EXCEL)',
		groupe: 'garage',
		type: 'pct',
		valeur: 0.2,
		page: 36,
		pour: (id) => id.endsWith('-blanc')
	},

	// ------------------------------------------------- Porte d'entrée (p.37)
	{
		id: 'porte-bicoloration-alu',
		nom: 'Bi-coloration, ALU',
		groupe: 'entree',
		type: 'coef',
		valeur: 1.25,
		page: 37,
		pour: tous
	},
	{
		id: 'porte-ral-alu',
		nom: 'Coloris RAL nuancier, ALU',
		groupe: 'entree',
		type: 'coef',
		valeur: 1.52,
		page: 37,
		pour: tous
	},
	{
		id: 'porte-beige-alu',
		nom: 'Coloris beige, portes ALU',
		groupe: 'entree',
		type: 'coef',
		valeur: 1.05,
		page: 37,
		pour: tous
	},
	{
		id: 'porte-beige-pvc',
		nom: 'Coloris beige, portes PVC',
		groupe: 'entree',
		type: 'coef',
		valeur: 1.05,
		page: 37,
		pour: tous
	},
	{
		id: 'porte-panneau-plein',
		nom: 'Panneau plein',
		groupe: 'entree',
		type: 'coef',
		valeur: 0.95,
		page: 37,
		pour: tous
	},
	{
		id: 'porte-vitrage-deco',
		nom: 'Vitrage décoratif',
		groupe: 'entree',
		type: 'coef',
		valeur: 1.12,
		page: 37,
		pour: tous
	},
	{
		id: 'porte-vitrage-special',
		nom: 'Vitrage spécial, dépoli ou fusion',
		groupe: 'entree',
		type: 'coef',
		valeur: 0.95,
		page: 37,
		pour: tous
	},
	{
		id: 'porte-cle-supp',
		nom: 'Clé supplémentaire',
		groupe: 'entree',
		type: 'eur',
		valeur: 30,
		page: 37,
		pour: tous
	},
	{
		id: 'porte-croisillons',
		nom: 'Croisillons incorporés',
		groupe: 'entree',
		type: 'eur',
		valeur: 170,
		page: 37,
		pour: tous
	},
	{
		id: 'porte-double-poignee',
		nom: 'Double poignée laiton ou alu brossé, PVC',
		groupe: 'entree',
		type: 'eur',
		valeur: 170,
		page: 37,
		pour: tous
	},
	{
		id: 'porte-boite-lettres',
		nom: 'Entrée boîte à lettres',
		groupe: 'entree',
		type: 'eur',
		valeur: 180,
		page: 37,
		pour: tous
	},
	{
		id: 'porte-heurtoir',
		nom: 'Heurtoir',
		groupe: 'entree',
		type: 'eur',
		valeur: 280,
		page: 37,
		pour: tous
	},
	{
		id: 'porte-judas',
		nom: 'Judas',
		groupe: 'entree',
		type: 'eur',
		valeur: 120,
		page: 37,
		pour: tous
	},
	{
		id: 'porte-ouverture-ext',
		nom: 'Ouverture extérieure',
		groupe: 'entree',
		type: 'eur',
		valeur: 337,
		page: 37,
		pour: tous
	},
	{
		id: 'porte-panneau-3vitres',
		nom: 'Panneau de plus de 3 vitres',
		groupe: 'entree',
		type: 'eur',
		valeur: 220,
		page: 37,
		pour: tous
	},
	{
		id: 'porte-pommeau',
		nom: 'Pommeau rond laiton ou titane',
		groupe: 'entree',
		type: 'eur',
		valeur: 210,
		page: 37,
		pour: tous
	},
	{
		id: 'porte-tierce-ouvrante',
		nom: 'Tierce ouvrante',
		groupe: 'entree',
		type: 'eur',
		valeur: 290,
		page: 37,
		pour: tous
	},
	{
		id: 'porte-tierce-pleine',
		nom: 'Tierce pleine assortie',
		groupe: 'entree',
		type: 'eur',
		valeur: 1257,
		page: 37,
		pour: tous
	},
	{
		id: 'porte-tierce-vitree',
		nom: 'Tierce vitrée',
		groupe: 'entree',
		type: 'eur',
		valeur: 1007,
		page: 37,
		pour: tous
	}
];

/** Options proposables pour une menuiserie donnée. */
export function optionsPour(grilleId: string, groupe: GroupeOption): OptionTarif[] {
	return OPTIONS.filter((o) => o.groupe === groupe && (o.pour ? o.pour(grilleId) : true));
}

// --- Sections d'affichage des options ---------------------------------------
// Le book range ses plus-values par nature. On s'appuie sur ces sections pour
// n'afficher qu'un seul choix là où le book ne facture qu'une alternative
// (un coloris, un vitrage, un doublage) : cumuler deux coloris n'a pas de sens.
export type SectionOption = {
	id: string;
	nom: string;
	/** true : les options de la section s'excluent (un seul choix possible). */
	exclusif?: boolean;
	/** Aide affichée sous le titre de la section. */
	aide?: string;
	match: (o: OptionTarif) => boolean;
};

export const SECTIONS_OPTIONS: SectionOption[] = [
	{
		id: 'doublage',
		nom: 'Doublage',
		exclusif: true,
		match: (o) => o.id.startsWith('pvc-doublage')
	},
	{ id: 'renfort', nom: 'Renfort', match: (o) => o.id.includes('renfort') },
	{ id: 'coffre', nom: 'Finition du coffre', match: (o) => o.id.includes('laquage') },
	{
		id: 'coloris',
		nom: 'Coloris',
		exclusif: true,
		aide: 'Un seul coloris par menuiserie.',
		match: (o) => o.type === 'pct'
	},
	{
		id: 'vitrage',
		nom: 'Vitrage & finition',
		exclusif: true,
		aide: 'Coefficients appliqués sur le prix de grille — un seul choix.',
		match: (o) => o.type === 'coef' || o.id.includes('vitrage')
	},
	{
		id: 'dimension',
		nom: 'Plus-values de dimension',
		aide: 'Traverses et impostes : s’ajoutent au prix du châssis, jamais à la place.',
		match: (o) => o.type === 'grille'
	},
	{ id: 'inclus', nom: 'Inclus de série', match: (o) => o.type === 'info' },
	{ id: 'accessoire', nom: 'Accessoires & quincaillerie', match: () => true }
];

/** Section d'affichage d'une option (la dernière section sert de repli). */
export function sectionDe(o: OptionTarif): SectionOption {
	return SECTIONS_OPTIONS.find((s) => s.match(o)) ?? SECTIONS_OPTIONS[SECTIONS_OPTIONS.length - 1]!;
}

/** Une option « info » rappelle simplement que la valeur est déjà dans le prix. */
export const estInclus = (o: OptionTarif) => o.type === 'info';

export const OPTION_BY_ID = new Map(OPTIONS.map((o) => [o.id, o]));

export type LigneCalcul = {
	nom: string;
	montant: number;
	/** 'pct' : pourcentage ; 'coef' : coefficient (montant 0, le facteur est dans `facteur`) ; 'fixe' : montant HT. */
	type: 'pct' | 'coef' | 'fixe';
	facteur?: number;
};

export type CalculOptions = {
	/** Prix de base (grille ou forfait). */
	base: number;
	/** Somme des pourcentages retenus (0.2 = +20 %). */
	pct: number;
	/** Produit des coefficients retenus (1 = aucun). */
	coef: number;
	/** Détail ligne à ligne, dans l'ordre du book. */
	lignes: LigneCalcul[];
	total: number;
};

/**
 * Applique les options au prix de base en respectant l'ordre du book :
 * pourcentages additionnés, puis coefficients, puis plus-values fixes.
 */
export function appliquerOptions(
	base: number,
	options: { option: OptionTarif; quantite?: number; montantGrille?: number }[]
): CalculOptions {
	const pct = options
		.filter((o) => o.option.type === 'pct')
		.reduce((s, o) => s + o.option.valeur, 0);
	const coef = options
		.filter((o) => o.option.type === 'coef')
		.reduce((s, o) => s * o.option.valeur, 1);
	let prix = base * (1 + pct) * coef;
	// Le détail suit l'ordre du book : pourcentages, coefficients, puis montants.
	const lignes: LigneCalcul[] = [];
	for (const { option } of options) {
		if (option.type === 'pct') {
			lignes.push({
				nom: option.nom,
				montant: base * option.valeur * coef,
				type: 'pct',
				facteur: option.valeur
			});
		} else if (option.type === 'coef') {
			lignes.push({ nom: option.nom, montant: 0, type: 'coef', facteur: option.valeur });
		}
	}
	for (const { option, quantite = 1, montantGrille } of options) {
		if (option.type === 'pct' || option.type === 'coef' || option.type === 'info') continue;
		const montant = option.type === 'grille' ? (montantGrille ?? 0) : option.valeur * quantite;
		prix += montant;
		lignes.push({ nom: option.nom, montant, type: 'fixe' });
	}
	return { base, pct, coef, lignes, total: Math.round(prix * 100) / 100 };
}
