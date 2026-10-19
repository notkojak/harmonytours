// CONTRÔLE DU BOOK TARIFAIRE — vérifie que le moteur de chiffrage rend bien les
// prix imprimés dans le book 2026. À relancer à chaque mise à jour du tarif :
//
//   npm run check:book
//
// Les valeurs attendues sont recopiées telles quelles depuis le PDF page par
// page : si une ligne de contrôle casse, c'est que les données ont bougé.

import { GRILLE_BY_ID, GRILLES } from '../src/lib/data/book/grilles';
import { PRODUIT_BY_ID } from '../src/lib/data/book/catalogue';
import {
	chiffrer,
	cotesMedianes,
	optionsDeArticle,
	type Article
} from '../src/lib/data/book/moteur';
import { FAMILLES, grillesVendables, produitsDeFamille } from '../src/lib/data/book/index';

export type ResultatControle = { ok: number; ko: number; messages: string[] };

const G = (id: string): Article => ({ kind: 'grille', g: GRILLE_BY_ID.get(id)! });
const P = (id: string): Article => ({ kind: 'produit', p: PRODUIT_BY_ID.get(id)! });

function prix(
	a: Article,
	h: number,
	l: number,
	choix: string[] = [],
	extra: Record<string, unknown> = {}
) {
	return chiffrer({ article: a, h, l, qte: 1, choix, ...extra });
}

export function verifierBook(): ResultatControle {
	let ok = 0;
	let ko = 0;
	const messages: string[] = [];

	const check = (nom: string, attendu: number | null, obtenu: number | null) => {
		const bon =
			attendu == null ? obtenu == null : obtenu != null && Math.abs(obtenu - attendu) < 0.011;
		if (bon) ok++;
		else {
			ko++;
			messages.push(`✗ ${nom} : attendu ${attendu}, obtenu ${obtenu}`);
		}
	};

	// Les cotes et les prix attendus sont recopiés du book, page par page.
	const c = check;

	// --- Grilles : prix lus au couple hauteur × largeur -------------------------
	c('fixe PVC 1250×900 = 816 (p.10)', 816, prix(G('pvc-fixe'), 1250, 900).base);
	c('fixe PVC 450×400 = 652 (p.10)', 652, prix(G('pvc-fixe'), 450, 400).base);
	c('OF1 PVC 1250×1000 = 1164 (p.11)', 1164, prix(G('pvc-of1'), 1250, 1000).base);
	c('PF1 PVC 1250×1000 = 1338,60 (OF1 × 1,15)', 1338.6, prix(G('pvc-pf1'), 1250, 1000).base);
	c(
		'coulissant frappe PVC 1250×2000 = 4344 (p.14)',
		4344,
		prix(G('pvc-coulissant-frappe'), 1250, 2000).base
	);
	c(
		'coulissant 2v ALU 1250×1200 = 2697 (p.23)',
		2697,
		prix(G('alu-coulissant-2v-a'), 1250, 1200).base
	);
	c('PF2 ALU 1950×1300 = 4845 (p.21)', 4845, prix(G('alu-pf2'), 1950, 1300).base);
	c('volet 41 h1000 l900 = 1543 (p.31)', 1543, prix(G('volet-41-a'), 1000, 900).base);
	c('volet 41 h1900 l1100 = 1778 (p.31)', 1778, prix(G('volet-41-a'), 1900, 1100).base);
	c('volet 54 h2000 l2500 = 3163 (p.33)', 3163, prix(G('volet-54-b'), 2000, 2500).base);
	c(
		'garage EASY blanc 1950×1700 = 4132 (p.35)',
		4132,
		prix(G('garage-easy-blanc'), 1950, 1700).base
	);
	c('garage EXCEL RAL 2450×2500 = 6241 (p.35)', 6241, prix(G('garage-excel-ral'), 2450, 2500).base);
	c('store toile 1250×1800 = 2567 (p.41)', 2567, prix(G('store-toile'), 1250, 1800).base);
	c(
		'carport solaire avant.2200 larg.2800 = 10398 (p.40)',
		10398,
		prix(G('carport-solaire'), 2200, 2800).base
	);
	c(
		'carport solaire avant.5900 larg.6000 = 21629 (p.40)',
		21629,
		prix(G('carport-solaire'), 5900, 6000).base
	);
	c('hors grille OF1 PVC 650×1200 = —', null, prix(G('pvc-of1'), 650, 1200).base);

	// --- Ordre du book : pourcentages, coefficients, puis montants fixes --------
	const A = G('pvc-fixe');
	c(
		'816 × 1,2 (filmé 1 face, p.16)',
		979.2,
		prix(A, 1250, 900, ['pvc-filme-1']).calcul?.total ?? null
	);
	c(
		'816 × 1,17 (phonique, p.16)',
		954.72,
		prix(A, 1250, 900, ['pvc-vitrage-phonique']).calcul?.total ?? null
	);
	c(
		'816 × 1,2 × 1,17 + 56 (phonique + poignée laiton)',
		1201.66,
		prix(A, 1250, 900, ['pvc-filme-1', 'pvc-vitrage-phonique', 'pvc-poignee-laiton']).calcul
			?.total ?? null
	);
	c(
		'barème traverse fixe PVC : 100 € à 900 mm, 155 € à 1 400 mm (p.17)',
		100,
		chiffrer({ article: A, h: 1250, l: 900, qte: 1, choix: ['pvc-traverse-fixe'] }).retenues[0]
			?.montantGrille ?? null
	);
	c(
		'barème traverse fixe PVC à 1 400 mm = 155',
		155,
		chiffrer({ article: A, h: 1250, l: 1400, qte: 1, choix: ['pvc-traverse-fixe'] }).retenues[0]
			?.montantGrille ?? null
	);

	// --- Plus-values en grille 2D (imposte p.29, moustiquaire p.34) -------------
	c(
		'moustiquaire volet h1000 l900 = 414 (p.34)',
		1543 + 414,
		prix(G('volet-41-a'), 1000, 900, ['volet-moustiquaire']).calcul?.total ?? null
	);
	c(
		'moustiquaire indisponible au-delà de 1 600 mm de large',
		null,
		prix(G('volet-41-a'), 1000, 2000).plusValues.get('volet-moustiquaire') ?? null
	);
	c(
		'coloris 7016 (+20 %) et laquage (+20 %) = 1543 × 1,4',
		1543 * 1.4,
		prix(G('volet-41-a'), 1000, 900, ['volet-coloris-7016', 'volet-laquage']).calcul?.total ?? null
	);
	c(
		'imposte coulissant ALU l=1200, hauteur 600 = 377 (p.29)',
		377,
		chiffrer({
			article: G('alu-coulissant-2v-a'),
			h: 1250,
			l: 1200,
			qte: 1,
			choix: ['alu-imposte-coulissant'],
			imposteH: 600
		}).retenues[0]?.montantGrille ?? null
	);

	// --- Portes d'entrée : coefficients sur le prix de gamme (p.37) -------------
	c('19 options proposables', 19, optionsDeArticle(P('porte-pvc-classique')).length);
	c(
		'3710 × 1,12 = 4155,20',
		4155.2,
		prix(P('porte-pvc-classique'), 0, 0, ['porte-vitrage-deco']).calcul?.total ?? null
	);
	c(
		'3710 × 0,95 + 170 = 3694,50',
		3694.5,
		prix(P('porte-pvc-classique'), 0, 0, ['porte-panneau-plein', 'porte-croisillons']).calcul
			?.total ?? null
	);
	c('TVA porte d’entrée 5,5 %', 0.055, prix(P('porte-pvc-classique'), 0, 0).tva);

	// --- Ciblage : les coloris de garage ne portent que sur les grilles blanc ----
	const garageBlanc = optionsDeArticle(G('garage-easy-blanc')).map((o) => o.id);
	const garageRal = optionsDeArticle(G('garage-easy-ral')).map((o) => o.id);
	c(
		'noir 2100 offert sur EASY blanc',
		1,
		garageBlanc.filter((i) => i === 'garage-noir-easy').length
	);
	c(
		'noir 2100 refusé sur la grille EASY RAL',
		0,
		garageRal.filter((i) => i === 'garage-noir-easy').length
	);
	c('aucun coloris sur une grille déjà colorisée', 0, garageRal.length);

	// --- TVA du récapitulatif (p.3) --------------------------------------------
	c('volet tablier 41 : TVA 5,5 %', 0.055, prix(G('volet-41-a'), 1000, 900).tva);
	c('volet tablier 54 : TVA 10 %', 0.1, prix(G('volet-54-b'), 2000, 2500).tva);
	c('batterie : TVA 20 %', 0.2, prix(P('batterie-5kwh'), 0, 0).tva);
	c('borne de recharge : TVA 5,5 %', 0.055, prix(P('borne-7'), 0, 0).tva);

	// --- Balayage : chaque grille et chaque option doit se calculer ------------
	let balayees = 0;
	for (const g of GRILLES) {
		const a: Article = { kind: 'grille', g };
		const cotes = cotesMedianes(g);
		const r = chiffrer({ article: a, h: cotes.h, l: cotes.l, qte: 1, choix: [] });
		const aDesPrix = g.lignes.some((x) => x.p.some((p) => p != null));
		if (aDesPrix && r.base == null) {
			ko++;
			messages.push(`✗ ${g.id} non chiffrable à ses cotes médianes (${cotes.h}×${cotes.l})`);
		}
		for (const o of optionsDeArticle(a)) {
			chiffrer({ article: a, h: cotes.h, l: cotes.l, qte: 1, choix: [o.id] });
			balayees++;
		}
	}
	messages.push(`· ${balayees} couples grille × option évalués sans erreur`);

	// --- Balayage : tous les forfaits du catalogue -----------------------------
	for (const p of PRODUIT_BY_ID.values()) {
		const r = chiffrer({
			article: { kind: 'produit', p },
			h: 0,
			l: 0,
			qte: p.unite === 'u' ? 1 : 10,
			choix: []
		});
		if (r.calcul == null || r.calcul.total <= 0) {
			ko++;
			messages.push(`✗ forfait non chiffrable : ${p.id}`);
		}
	}

	// --- Parcours : aucune gamme sans article ----------------------------------
	for (const f of FAMILLES) {
		const n = produitsDeFamille(f.id).length + grillesVendables(f.id).length;
		if (n === 0) {
			ko++;
			messages.push(`✗ gamme sans aucun article : ${f.id}`);
		}
	}

	return { ok, ko, messages };
}
