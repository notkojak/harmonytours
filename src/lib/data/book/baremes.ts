// BARÈMES DE PLUS-VALUES À LA LARGEUR — « BOOK TARIFAIRE » 2026 (p. 17 et 30).
// Le prix dépend uniquement de la largeur du châssis, comme dans le book.

export type Bareme = {
	id: string;
	nom: string;
	categorie: string;
	tva: number;
	page: number;
	detail?: string;
	/** Largeurs du barème, en mm (ordre croissant). */
	largeurs: number[];
	/** Prix HT correspondant à chaque largeur. */
	prix: number[];
};

export const BAREMES: Bareme[] = [
	{
		id: 'traverse-fixe-pvc',
		nom: 'Traverse intérieure — fixe vitré PVC',
		categorie: 'Fenêtres PVC',
		tva: 0.055,
		page: 17,
		detail: 'À ajouter au prix du châssis selon sa largeur, jamais à la place.',
		largeurs: [400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2100, 2200, 2300, 2400],
		prix: [50, 60, 70, 81, 91, 100, 112, 124, 134, 145, 155, 165, 175, 186, 196, 205, 217, 226, 239, 250, 269]
	},
	{
		id: 'traverse-soufflet-pvc',
		nom: 'Traverse intérieure — soufflet PVC',
		categorie: 'Fenêtres PVC',
		tva: 0.055,
		page: 17,
		detail: 'Deux barèmes distincts : le fixe vitré et le soufflet ne portent pas les mêmes prix.',
		largeurs: [500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700],
		prix: [52, 64, 74, 85, 95, 105, 116, 126, 138, 147, 157, 169, 178]
	},
	{
		id: 'traverse-frappe-alu',
		nom: 'Traverse intérieure — frappe et soufflet ALU',
		categorie: 'Fenêtres ALU',
		tva: 0.055,
		page: 30,
		detail: 'À ajouter au prix de la menuiserie, jamais à la place.',
		largeurs: [500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2100, 2200, 2300, 2400],
		prix: [122, 146, 170, 193, 217, 241, 266, 292, 315, 339, 363, 388, 411, 435, 459, 483, 507, 530, 554, 581]
	},
	{
		id: 'traverse-coulissant-alu',
		nom: 'Traverse intérieure — coulissant ALU 2 vantaux',
		categorie: 'Coulissants ALU',
		tva: 0.055,
		page: 30,
		detail: 'Chaque barème a son propre code : la porte-fenêtre, le coulissant et la frappe ne portent pas les mêmes prix.',
		largeurs: [800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000],
		prix: [139, 155, 172, 191, 208, 224, 241, 258, 277, 294, 310, 328, 344]
	}
];

export const BAREME_BY_ID = new Map(BAREMES.map((b) => [b.id, b]));

/** Cote la plus proche d'une liste (comme le « snap » des grilles). */
export function coteProche(valeur: number, cotes: { v: number }[] | number[]): number {
	const liste = cotes.map((c) => (typeof c === 'number' ? c : c.v));
	if (liste.length === 0) return valeur;
	return liste.reduce((best, x) => (Math.abs(x - valeur) < Math.abs(best - valeur) ? x : best), liste[0]);
}

/** Prix HT d'un barème pour une largeur donnée (cote la plus proche). */
export function prixBareme(b: Bareme, largeur: number): number {
	const l = coteProche(largeur, b.largeurs);
	const i = b.largeurs.indexOf(l);
	return b.prix[i] ?? 0;
}
