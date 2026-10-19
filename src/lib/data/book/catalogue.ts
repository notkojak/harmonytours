// CATALOGUE DES FORFAITS — « BOOK TARIFAIRE » 2026 (Bravaux).
// Prix HT à l'annonce, fourniture et pose comprises. Tout vient du book :
// les forfaits ci-dessous sont vendus au prix affiché, sans option ni
// plus-value (sauf mention contraire), d'après la page 9 du book.

export type TVA = 0.055 | 0.1 | 0.2;

export type Famille = {
	id: string;
	nom: string;
	emoji: string;
	accroche: string;
};

export type Produit = {
	id: string;
	nom: string;
	famille: string;
	categorie: string;
	prixHT: number;
	unite: 'u' | 'm2' | 'ml';
	tva: TVA;
	page: number;
	detail?: string;
	/** Produit vendu au forfait : aucune plus-value ne s'y greffe (book p. 9). */
	forfait?: boolean;
	/** Groupes d'options applicables (voir options.ts). */
	optionGroupes?: string[];
};

export const FAMILLES: Famille[] = [
	{
		id: 'solaire',
		nom: 'Photovoltaïque & batterie',
		emoji: '☀️',
		accroche: 'Production, stockage, dépose / repose'
	},
	{ id: 'borne', nom: 'Borne de recharge', emoji: '🔌', accroche: '7 kW mono et 11 kW tri' },
	{
		id: 'elec',
		nom: 'Tableau électrique',
		emoji: '⚡',
		accroche: 'Remise en sécurité NF C 15-100'
	},
	{
		id: 'clim',
		nom: 'Climatisation air / air',
		emoji: '❄️',
		accroche: 'Monosplit, bisplit, trisplit'
	},
	{
		id: 'ecs',
		nom: 'Eau chaude & eau',
		emoji: '💧',
		accroche: 'Ballon thermo, chauffe-eau, adoucisseur, VMC'
	},
	{ id: 'pac', nom: 'PAC air / eau', emoji: '🌡️', accroche: 'AIR H2O S et COMBI 220 L' },
	{
		id: 'menuiseries',
		nom: 'Fenêtres & coulissants',
		emoji: '🪟',
		accroche: 'PVC et ALU, au couple hauteur × largeur'
	},
	{
		id: 'volets',
		nom: 'Volets roulants solaires',
		emoji: '🎚️',
		accroche: 'Tablier 41 et 54, moteur solaire inclus'
	},
	{ id: 'garage', nom: 'Portes de garage', emoji: '🚗', accroche: 'Enroulable EASY et EXCEL' },
	{ id: 'entree', nom: 'Portes d’entrée', emoji: '🚪', accroche: 'PVC et ALU, 19 options' },
	{
		id: 'toiture',
		nom: 'Toiture, façade & isolation',
		emoji: '🏠',
		accroche: 'Hydrofuge, ravalement, combles, traitement'
	},
	{
		id: 'exterieur',
		nom: 'Pergola, carport & store',
		emoji: '🌿',
		accroche: 'Prix au m², LED inclus'
	}
];

// Le photovoltaïque bas carbone suit une grille lissée : +2 150 € HT par kWc,
// arrondie à 50 € (book p. 4).
const PV_BAS_CARBONE: [number, number][] = [
	[1, 10450],
	[2, 12600],
	[3, 14800],
	[4, 16950],
	[5, 19100],
	[6, 21250],
	[7, 23400],
	[8, 25550],
	[9, 27700]
];

const CLIM_MONO: [string, number][] = [
	['1,8', 3190],
	['2,5', 3850],
	['3,5', 4620],
	['5', 5720],
	['6', 7590],
	['7', 8690]
];

const CLIM_BI: [string, number][] = [
	['3,6', 9790],
	['4,3', 10450],
	['5,5', 12045],
	['6,8', 13145]
];

const CLIM_TRI: [string, number][] = [
	['5,5', 13245],
	['6,8', 14345],
	['7', 15445],
	['8,5', 17645]
];

const PAC_EAU: [string, number][] = [
	['8,5', 20125],
	['10', 20750],
	['12', 22750],
	['14', 24750]
];

const PAC_EAU_COMBI: [string, number][] = [
	['8,5', 22125],
	['10', 22750],
	['12', 24750],
	['14', 26750]
];

export const PRODUITS: Produit[] = [
	// ---------------------------------------------------------- Photovoltaïque
	...PV_BAS_CARBONE.map(([kwc, prix]): Produit => ({
		id: `pv-${kwc}`,
		nom: `Photovoltaïque bas carbone ${kwc} kWc`,
		famille: 'solaire',
		categorie: 'Photovoltaïque',
		prixHT: prix,
		unite: 'u',
		tva: 0.055,
		page: 4,
		detail: 'Gestionnaire d’énergie inclus. Pose comprise.'
	})),
	{
		id: 'pv-supp',
		nom: 'kWc supplémentaire au-delà de 9 kWc',
		famille: 'solaire',
		categorie: 'Photovoltaïque',
		prixHT: 2150,
		unite: 'u',
		tva: 0.055,
		page: 4,
		detail: 'Même tarif que la marche de la grille lissée (2 150 € par kWc).'
	},
	{
		id: 'depose-pv-tuile',
		nom: 'Dépose ancien PV / repose PV — tuile mécanique, provençale ou PST',
		famille: 'solaire',
		categorie: 'Dépose / repose PV',
		prixHT: 278,
		unite: 'm2',
		tva: 0.055,
		page: 4,
		detail:
			'Uniquement sur les surfaces recevant ou portant des panneaux. Jamais en réfection de couverture.'
	},
	{
		id: 'depose-pv-ardoise-fibro',
		nom: 'Dépose ancien PV / repose PV — ardoise fibro ou tuile de pays',
		famille: 'solaire',
		categorie: 'Dépose / repose PV',
		prixHT: 380,
		unite: 'm2',
		tva: 0.055,
		page: 4
	},
	{
		id: 'depose-pv-ardoise-naturelle',
		nom: 'Dépose ancien PV / repose PV — ardoise naturelle',
		famille: 'solaire',
		categorie: 'Dépose / repose PV',
		prixHT: 480,
		unite: 'm2',
		tva: 0.055,
		page: 4
	},
	{
		id: 'batterie-5kwh',
		nom: 'Onduleur hybride ASW5000H-S2 + batterie 5 kWh',
		famille: 'solaire',
		categorie: 'Batterie',
		prixHT: 11250,
		unite: 'u',
		tva: 0.2,
		page: 4,
		forfait: true,
		detail: 'TVA 20 %. Accès Internet obligatoire, compteur Linky obligatoire en triphasé.'
	},
	{
		id: 'batterie-module',
		nom: 'Module batterie 5 kWh supplémentaire',
		famille: 'solaire',
		categorie: 'Batterie',
		prixHT: 6500,
		unite: 'u',
		tva: 0.2,
		page: 4,
		forfait: true,
		detail: 'TVA 20 %. Se greffe sur l’onduleur hybride existant.'
	},

	// ------------------------------------------------------- Borne de recharge
	{
		id: 'borne-7',
		nom: 'Borne de recharge 7 kW monophasée',
		famille: 'borne',
		categorie: 'Borne de recharge',
		prixHT: 3900,
		unite: 'u',
		tva: 0.055,
		page: 5,
		forfait: true,
		detail:
			'WallBox pilotable, câblage 5G compris jusqu’à 10 ml, mise en service et charge pilotée. Compteur existant.'
	},
	{
		id: 'borne-11',
		nom: 'Borne de recharge 11 kW triphasée',
		famille: 'borne',
		categorie: 'Borne de recharge',
		prixHT: 4900,
		unite: 'u',
		tva: 0.055,
		page: 5,
		forfait: true,
		detail:
			'Exige un compteur triphasé déjà en place. Passage mono → tri : Enedis, hors devis. Câblage 10 ml compris.'
	},

	// ------------------------------------------------------ Tableau électrique
	...[
		['mono-1', 'Remise en sécurité tableau, mono, 1 ligne', 1900],
		['mono-2', 'Remise en sécurité tableau, mono, 2 lignes', 2900],
		['mono-3', 'Remise en sécurité tableau, mono, 3 lignes', 3900],
		['tri-1', 'Remise en sécurité tableau, tri, 1 ligne', 2500],
		['tri-2', 'Remise en sécurité tableau, tri, 2 lignes', 3700],
		['tri-3', 'Remise en sécurité tableau, tri, 3 lignes', 4900]
	].map(([k, nom, prix]): Produit => ({
		id: `tableau-${k}`,
		nom: nom as string,
		famille: 'elec',
		categorie: (k as string).startsWith('mono') ? 'Monophasé' : 'Triphasé',
		prixHT: prix as number,
		unite: 'u',
		tva: 0.1,
		page: 6,
		forfait: true,
		detail:
			'Marque Hager par défaut. Diagnostic, dépose, pose, 30 mA, mise à la terre, essais et remise en service.'
	})),

	// ---------------------------------------------------------- Climatisation
	...CLIM_MONO.map(([kw, prix]): Produit => ({
		id: `clim-mono-${kw}`,
		nom: `Monosplit ${kw} kW`,
		famille: 'clim',
		categorie: 'Monosplit — 1 unité intérieure',
		prixHT: prix,
		unite: 'u',
		tva: 0.055,
		page: 7,
		detail:
			'airHome 400. Liaisons frigorifiques 10 ml incluses, module de pilotage à distance compris.'
	})),
	...CLIM_BI.map(([kw, prix]): Produit => ({
		id: `clim-bi-${kw}`,
		nom: `Bisplit ${kw} kW — 2 unités intérieures`,
		famille: 'clim',
		categorie: 'Bisplit — 2 unités intérieures',
		prixHT: prix,
		unite: 'u',
		tva: 0.055,
		page: 7,
		detail:
			'Groupes multi-split RAM-G. 10 ml de liaison par unité intérieure (20 ml), pilotage compris.'
	})),
	...CLIM_TRI.map(([kw, prix]): Produit => ({
		id: `clim-tri-${kw}`,
		nom: `Trisplit ${kw} kW — 3 unités intérieures`,
		famille: 'clim',
		categorie: 'Trisplit — 3 unités intérieures',
		prixHT: prix,
		unite: 'u',
		tva: 0.055,
		page: 7,
		detail:
			'30 ml de liaisons incluses. Maximum 3 unités intérieures : Bravaux n’installe pas au-delà du trisplit.'
	})),

	// ------------------------------------------- Eau chaude, eau et air
	{
		id: 'bt-yutampo-190',
		nom: 'Ballon thermodynamique Yutampo 190 L',
		famille: 'ecs',
		categorie: 'Ballon thermodynamique — 5,5 %',
		prixHT: 6050,
		unite: 'u',
		tva: 0.055,
		page: 8,
		forfait: true,
		detail: 'Pose comprise, dépose de l’ancien appareil comprise.'
	},
	{
		id: 'bt-yutampo-270',
		nom: 'Ballon thermodynamique Yutampo 270 L',
		famille: 'ecs',
		categorie: 'Ballon thermodynamique — 5,5 %',
		prixHT: 7450,
		unite: 'u',
		tva: 0.055,
		page: 8,
		forfait: true
	},
	{
		id: 'bt-neptuo-230',
		nom: 'Ballon thermodynamique Neptuo 230 BG',
		famille: 'ecs',
		categorie: 'Ballon thermodynamique — 5,5 %',
		prixHT: 6250,
		unite: 'u',
		tva: 0.055,
		page: 8,
		forfait: true
	},
	{
		id: 'bt-neptuo-350',
		nom: 'Ballon thermodynamique Neptuo 350 BG',
		famille: 'ecs',
		categorie: 'Ballon thermodynamique — 5,5 %',
		prixHT: 6990,
		unite: 'u',
		tva: 0.055,
		page: 8,
		forfait: true
	},
	{
		id: 'ce-lineo-150',
		nom: 'Chauffe-eau électrique Linéo Connecté 150 L vertical mural',
		famille: 'ecs',
		categorie: 'Chauffe-eau électrique — 10 %',
		prixHT: 2890,
		unite: 'u',
		tva: 0.1,
		page: 8,
		forfait: true,
		detail: 'Appareil à effet Joule : TVA 10 %, jamais 5,5 %.'
	},
	{
		id: 'adoucisseur',
		nom: 'Adoucisseur d’eau',
		famille: 'ecs',
		categorie: 'Traitement de l’eau et de l’air — 10 %',
		prixHT: 5900,
		unite: 'u',
		tva: 0.1,
		page: 9,
		forfait: true
	},
	{
		id: 'vmc-simple-flux',
		nom: 'VMC simple flux',
		famille: 'ecs',
		categorie: 'Traitement de l’eau et de l’air — 10 %',
		prixHT: 2850,
		unite: 'u',
		tva: 0.1,
		page: 9,
		forfait: true
	},

	// ------------------------------------------------------------ PAC air / eau
	...PAC_EAU.map(([kw, prix]): Produit => ({
		id: `pac-air-h2o-${kw}`,
		nom: `AIR H2O S ${kw} kW — mono ou triphasé`,
		famille: 'pac',
		categorie: 'AIR H2O S',
		prixHT: prix,
		unite: 'u',
		tva: 0.055,
		page: 9,
		forfait: true,
		detail:
			'Désembouage, dépose de chaudière gaz ou fioul et neutralisation de cuve : après visite technique, en deux temps.'
	})),
	...PAC_EAU_COMBI.map(([kw, prix]): Produit => ({
		id: `pac-air-h2o-combi-${kw}`,
		nom: `COMBI 220 L ${kw} kW`,
		famille: 'pac',
		categorie: 'COMBI 220 L',
		prixHT: prix,
		unite: 'u',
		tva: 0.055,
		page: 9,
		forfait: true
	})),

	// --------------------------------------------------- Extérieur (au m²)
	{
		id: 'toit-hydro-incolore',
		nom: 'Hydrofugation toiture incolore',
		famille: 'toiture',
		categorie: 'Toiture — 10 %',
		prixHT: 57,
		unite: 'm2',
		tva: 0.1,
		page: 38,
		detail: 'Nettoyage HP et démoussage inclus.'
	},
	{
		id: 'toit-hydro-colore',
		nom: 'Hydrofugation toiture colorée',
		famille: 'toiture',
		categorie: 'Toiture — 10 %',
		prixHT: 70,
		unite: 'm2',
		tva: 0.1,
		page: 38,
		detail: 'Nettoyage HP et démoussage inclus.'
	},
	{
		id: 'toit-dessous-pvc',
		nom: 'Dessous de toit PVC blanc, planche de rive et lambris',
		famille: 'toiture',
		categorie: 'Toiture — 10 %',
		prixHT: 239,
		unite: 'ml',
		tva: 0.1,
		page: 38
	},
	{
		id: 'facade-hydro-colore',
		nom: 'Hydrofuge de façade coloré',
		famille: 'toiture',
		categorie: 'Façade — 10 %',
		prixHT: 78,
		unite: 'm2',
		tva: 0.1,
		page: 38
	},
	{
		id: 'facade-ravalement',
		nom: 'Ravalement enduit couleur',
		famille: 'toiture',
		categorie: 'Façade — 10 %',
		prixHT: 139,
		unite: 'm2',
		tva: 0.1,
		page: 38
	},
	{
		id: 'chantier-toiture',
		nom: 'Mise en place et nettoyage de chantier',
		famille: 'toiture',
		categorie: 'Façade — 10 %',
		prixHT: 566,
		unite: 'u',
		tva: 0.1,
		page: 38
	},
	{
		id: 'echafaudage',
		nom: 'Échafaudage à partir du R+1',
		famille: 'toiture',
		categorie: 'Façade — 10 %',
		prixHT: 2640,
		unite: 'u',
		tva: 0.1,
		page: 38,
		detail:
			'Forfait unique de 2 640 €, valable pour la façade, la toiture, les combles et une pose photovoltaïque à partir du R+1.'
	},
	{
		id: 'combles-laine-roche',
		nom: 'Isolation combles, soufflage laine de roche R7',
		famille: 'toiture',
		categorie: 'Isolation — 5,5 %',
		prixHT: 70,
		unite: 'm2',
		tva: 0.055,
		page: 38
	},
	{
		id: 'combles-laine-verre',
		nom: 'Isolation combles, laine de verre à souffler R7',
		famille: 'toiture',
		categorie: 'Isolation — 5,5 %',
		prixHT: 57,
		unite: 'm2',
		tva: 0.055,
		page: 38
	},
	{
		id: 'combles-depose',
		nom: 'Dépose ancienne isolation',
		famille: 'toiture',
		categorie: 'Isolation — 5,5 %',
		prixHT: 35,
		unite: 'm2',
		tva: 0.055,
		page: 38
	},
	{
		id: 'traitement-bois-preventif',
		nom: 'Traitement bois préventif',
		famille: 'toiture',
		categorie: 'Traitement — 10 %',
		prixHT: 29,
		unite: 'm2',
		tva: 0.1,
		page: 38
	},
	{
		id: 'traitement-bois-curatif',
		nom: 'Traitement bois curatif',
		famille: 'toiture',
		categorie: 'Traitement — 10 %',
		prixHT: 49,
		unite: 'm2',
		tva: 0.1,
		page: 38
	},
	{
		id: 'chantier-traitement',
		nom: 'Mise en place et nettoyage de chantier (traitement)',
		famille: 'toiture',
		categorie: 'Traitement — 10 %',
		prixHT: 566,
		unite: 'u',
		tva: 0.1,
		page: 38
	},

	// ------------------------------------------------ Pergola, carport, store
	{
		id: 'pergola-bioclimatique',
		nom: 'Pergola bioclimatique — éclairage LED inclus',
		famille: 'exterieur',
		categorie: 'Pergola & carport — 10 %',
		prixHT: 1500,
		unite: 'm2',
		tva: 0.1,
		page: 39,
		detail:
			'Prix au m², fourniture et pose. Un spot LED pour 5 m² inclus. Aucune fermeture latérale : l’ouvrage reste ouvert (TVA 10 %).'
	},
	{
		id: 'carport-classique',
		nom: 'Carport classique — éclairage LED inclus',
		famille: 'exterieur',
		categorie: 'Pergola & carport — 10 %',
		prixHT: 1200,
		unite: 'm2',
		tva: 0.1,
		page: 39,
		detail: 'Prix au m², fourniture et pose. Led inclus. Aucune fermeture latérale.'
	},

	// ------------------------------------------------- Portes d'entrée
	{
		id: 'porte-pvc-classique',
		nom: 'Porte d’entrée PVC classiques et variantes T1 à T4',
		famille: 'entree',
		categorie: 'PVC',
		prixHT: 3710,
		unite: 'u',
		tva: 0.055,
		page: 37,
		detail:
			'Granada · Eva · Agatha · Arcadia · Athéna · Corsa · Gothica · Octavia · Célia. Prix de gamme, puis options.'
	},
	{
		id: 'porte-pvc-contemporaine',
		nom: 'Porte d’entrée PVC contemporaines et vitrées',
		famille: 'entree',
		categorie: 'PVC',
		prixHT: 5849,
		unite: 'u',
		tva: 0.055,
		page: 37,
		detail: 'Personnalisation Normabaie.'
	},
	{
		id: 'porte-alu-contemporaine',
		nom: 'Porte d’entrée ALU contemporaines',
		famille: 'entree',
		categorie: 'ALU',
		prixHT: 7560,
		unite: 'u',
		tva: 0.055,
		page: 37,
		detail:
			'Full · Sensation · Natural · Kréative · Moon · Square · Line · Graphic · Art Déco · Atelier d’artiste.'
	},
	{
		id: 'porte-alu-verrieres',
		nom: 'Porte d’entrée ALU verrières',
		famille: 'entree',
		categorie: 'ALU',
		prixHT: 7560,
		unite: 'u',
		tva: 0.055,
		page: 37,
		detail: 'Kréative · Contemporaines · Authentiques.'
	},
	{
		id: 'porte-alu-authentique',
		nom: 'Porte d’entrée ALU authentiques',
		famille: 'entree',
		categorie: 'ALU',
		prixHT: 7560,
		unite: 'u',
		tva: 0.055,
		page: 37,
		detail: 'Maison de maître · Maison de campagne · Origine.'
	}
];

// Options applicables produit par produit. Les identifiants sont ceux de
// `GroupeOption` (options.ts), pas les libellés des groupes.
for (const p of PRODUITS) {
	if (p.famille === 'entree') p.optionGroupes = ['entree'];
}

export const PRODUIT_BY_ID = new Map(PRODUITS.map((p) => [p.id, p]));

export const produitsDeFamille = (famille: string) => PRODUITS.filter((p) => p.famille === famille);

export const FAMILLE_BY_ID = new Map(FAMILLES.map((f) => [f.id, f]));

/** Âge du logement et TVA : rappel du récapitulatif TVA du book (p. 3). */
export const TVA_RECAP: { gamme: string; tva: string }[] = [
	{ gamme: 'Chauffe-eau électrique (effet Joule)', tva: '10 %' },
	{ gamme: 'Ballon thermodynamique', tva: '5,5 %' },
	{ gamme: 'Batterie', tva: '20 %' },
	{ gamme: 'Borne de recharge', tva: '5,5 %' },
	{ gamme: 'Charpente', tva: '10 %' },
	{ gamme: 'Climatisation air/air', tva: '5,5 %' },
	{ gamme: 'Combles', tva: '5,5 %' },
	{ gamme: 'Façade', tva: '10 %' },
	{ gamme: 'Menuiserie ALU', tva: '5,5 %' },
	{ gamme: 'Menuiserie PVC', tva: '5,5 %' },
	{ gamme: 'PAC air/eau', tva: '5,5 %' },
	{ gamme: 'Pergola & Carport', tva: '10 %' },
	{ gamme: "Porte d'entrée", tva: '5,5 %' },
	{ gamme: 'Porte de garage', tva: '10 %' },
	{ gamme: 'Solaire photovoltaïque', tva: '5,5 %' },
	{ gamme: 'Store toile', tva: '10 %' },
	{ gamme: 'Tableau électrique', tva: '10 %' },
	{ gamme: 'Toiture', tva: '10 %' },
	{ gamme: "Traitement de l'eau", tva: '10 %' },
	{ gamme: 'Ventilation', tva: '10 %' },
	{ gamme: 'Volet roulant tablier 54 (lame ADP 55)', tva: '10 %' },
	{ gamme: 'Volet roulant tablier 41 (lame ADP CALISO)', tva: '5,5 %' }
];

export const TVA_ALERTE =
	'Logement achevé depuis plus de 2 ans, travaux réalisés par une entreprise avec fourniture et pose. Logement de moins de 2 ans ou usage non résidentiel : TVA 20 %, sauf borne de recharge.';
