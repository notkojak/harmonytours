// DO — Demande d'Opportunité.
//
// Le book est formel : aucune remise ne se décide chez le client, elle se
// négocie au téléphone avec un responsable, contre des contreparties (les thèmes
// de DO). Ce module rassemble les contreparties, les chantiers regroupables et
// le calcul de la remise qui en découle — la logique est pure pour rester
// testable sans interface.

/** Conditions à réunir côté client avant d'appeler le responsable. */
export type ConditionsOpportunite = {
	/** Le client peut accorder un quart d'heure : les objections sont traitées. */
	pasPresse: boolean;
	/** Le client accepte le panneau de chantier pendant la pose. */
	panneau: boolean;
	/** Le prix obtenu ne circule pas. */
	discretion: boolean;
};

export type CleCondition = keyof ConditionsOpportunite;

export const CONDITIONS: {
	id: CleCondition;
	emoji: string;
	nom: string;
	aide: string;
}[] = [
	{
		id: 'pasPresse',
		emoji: '⏳',
		nom: 'Pas être pressé',
		aide: 'Le client peut t’accorder un quart d’heure : toutes les objections doivent être traitées avant l’appel.'
	},
	{
		id: 'panneau',
		emoji: '🪧',
		nom: 'Panneau de chantier',
		aide: 'Le panneau reste pendant la pose : c’est de la publicité gratuite dans son quartier.'
	},
	{
		id: 'discretion',
		emoji: '🤐',
		nom: 'Discrétion sur le tarif',
		aide: 'Le prix obtenu ne circule pas : sans ça, plus aucune marge sur les voisins.'
	}
];

/** Durée d'objections exigée par le book avant tout appel. */
export const DUREE_OBJECTIONS_MIN = 15;

/** Contreparties négociables, chacune valant une poignée de points de remise. */
export type ThemeDo = {
	id: string;
	emoji: string;
	nom: string;
	aide: string;
	/** points de remise apportés (le regroupement compte au chantier) */
	remise: number;
};

export const THEMES: ThemeDo[] = [
	{
		id: 'regroupement',
		emoji: '📍',
		nom: 'Regroupement de chantier',
		aide: 'Poser chez un client déjà planifié dans le secteur : 2 % par chantier, 3 maximum.',
		remise: 0
	},
	{
		id: 'maison-temoin',
		emoji: '🏠',
		nom: 'Maison témoin',
		aide: 'Le client accepte les visites de prospects une fois la pose terminée.',
		remise: 5
	},
	{
		id: 'prise-de-vue',
		emoji: '📸',
		nom: 'Prise de vue',
		aide: 'Photos avant / après pour la publicité et les réseaux.',
		remise: 4
	},
	{
		id: 'reference',
		emoji: '⭐',
		nom: 'Chantier référence',
		aide: 'Le client accepte d’être cité comme référence de la gamme.',
		remise: 3
	},
	{
		id: 'parrainage',
		emoji: '🤝',
		nom: 'Offre de parrainage',
		aide: 'Trois contacts de son entourage sont transmis.',
		remise: 4
	},
	{
		id: 'destockage',
		emoji: '🎯',
		nom: 'Opération déstockage',
		aide: 'La série est disponible en stock, donc posée sans réapprovisionnement.',
		remise: 2
	}
];

export const REMISE_PAR_CHANTIER = 2;
export const MAX_CHANTIERS_REGROUPES = 3;

/**
 * À partir de ce taux, la remise sort du périmètre du technicien conseil : elle
 * reste bloquée jusqu'à ce que le responsable l'assume explicitement.
 */
export const SEUIL_SUPERVISION = 20;

/** Plafond de sécurité, pour ne jamais signer une remise aberrante. */
export const REMISE_MAX = 40;

// ------------------------------------------------------------- Chantiers
export type Chantier = {
	id: string;
	client: string;
	commune: string;
	secteur: string;
	projet: string;
	/** horodatage de la pose prévue */
	pose: number;
	/** 0 → devis signé, 1 → pose terminée */
	avancement: number;
	/** position sur la carte */
	lat: number;
	lon: number;
};

/** Secteurs de la zone, avec leurs voisins : on regroupe d'abord de proche en proche. */
export const SECTEURS: { nom: string; voisins: string[] }[] = [
	{ nom: 'Tours Nord', voisins: ['Tours Centre', 'Saint-Cyr-sur-Loire'] },
	{ nom: 'Tours Centre', voisins: ['Tours Nord', 'Tours Sud', 'La Riche'] },
	{ nom: 'Tours Sud', voisins: ['Tours Centre', 'Joué-lès-Tours', 'Chambray-lès-Tours'] },
	{ nom: 'Joué-lès-Tours', voisins: ['Tours Sud', 'Chambray-lès-Tours'] },
	{ nom: 'Saint-Cyr-sur-Loire', voisins: ['Tours Nord', 'Fondettes'] }
];

const JOUR_MS = 24 * 60 * 60 * 1000;

/** Pose calée à midi, pour qu'un décalage de fuseau ne change pas le jour affiché. */
function pose(dans: number, heure = 12): number {
	const d = new Date();
	d.setHours(heure, 0, 0, 0);
	return d.getTime() + dans * JOUR_MS;
}

/**
 * Chantiers déjà planifiés dans la zone. Données d'exemple, comme les agences du
 * tableau de bord : à remplacer par les ventes réelles quand elles seront
 * exposées côté Convex.
 */
function chantiers(): Chantier[] {
	return [
		{
			id: 'ch-1',
			client: 'M. et Mme Berthelot',
			commune: 'Tours Nord',
			secteur: 'Tours Nord',
			projet: '6 fenêtres PVC + volet 41',
			pose: pose(4),
			avancement: 0.15,
			lat: 47.42,
			lon: 0.69
		},
		{
			id: 'ch-2',
			client: 'M. Lemoine',
			commune: 'Fondettes',
			secteur: 'Tours Nord',
			projet: 'Porte de garage EASY',
			pose: pose(9),
			avancement: 0.1,
			lat: 47.404,
			lon: 0.599
		},
		{
			id: 'ch-3',
			client: 'Mme Ferrand',
			commune: 'Saint-Cyr-sur-Loire',
			secteur: 'Saint-Cyr-sur-Loire',
			projet: 'Pergola bioclimatique 18 m²',
			pose: pose(16),
			avancement: 0.05,
			lat: 47.402,
			lon: 0.665
		},
		{
			id: 'ch-4',
			client: 'SCI des Tilleuls',
			commune: 'Tours Centre',
			secteur: 'Tours Centre',
			projet: 'Coulissant ALU 3 vantaux',
			pose: pose(2),
			avancement: 0.8,
			lat: 47.392,
			lon: 0.689
		},
		{
			id: 'ch-5',
			client: 'M. Nguyen',
			commune: 'La Riche',
			secteur: 'Tours Centre',
			projet: 'PAC air / eau COMBI 220 L',
			pose: pose(12),
			avancement: 0.2,
			lat: 47.379,
			lon: 0.65
		},
		{
			id: 'ch-6',
			client: 'Mme Aubert',
			commune: 'Tours Sud',
			secteur: 'Tours Sud',
			projet: 'Volets solaires tablier 54',
			pose: pose(6),
			avancement: 0.35,
			lat: 47.36,
			lon: 0.69
		},
		{
			id: 'ch-7',
			client: 'M. et Mme Ravel',
			commune: 'Chambray-lès-Tours',
			secteur: 'Tours Sud',
			projet: '10 fenêtres ALU + moustiquaires',
			pose: pose(21),
			avancement: 0.05,
			lat: 47.343,
			lon: 0.707
		},
		{
			id: 'ch-8',
			client: 'M. Diallo',
			commune: 'Joué-lès-Tours',
			secteur: 'Joué-lès-Tours',
			projet: 'Hydrofuge toiture + ravalement',
			pose: pose(27),
			avancement: 0,
			lat: 47.352,
			lon: 0.657
		}
	];
}

/**
 * Centre de carte d'un groupe de chantiers : on y recadre la vue quand l'adresse
 * du client n'a pas pu être localisée.
 */
export function centreDe(chantiers: Chantier[]): [number, number] {
	if (!chantiers.length) return [0.6886, 47.3941];
	return [
		chantiers.reduce((s, c) => s + c.lon, 0) / chantiers.length,
		chantiers.reduce((s, c) => s + c.lat, 0) / chantiers.length
	];
}

/** Secteur déduit d'une adresse libre, ou null si aucune commune ne correspond. */
export function secteurDe(adresse: string): string | null {
	const a = adresse.trim().toLowerCase();
	if (a.length < 3) return null;
	const proche = (s: string) => {
		const n = s.toLowerCase();
		return a.includes(n) || n.startsWith(a);
	};
	for (const ch of chantiers()) {
		if (proche(ch.commune)) return ch.secteur;
	}
	for (const s of SECTEURS) if (proche(s.nom)) return s.nom;
	return null;
}

/**
 * Chantiers regroupables autour d'un secteur : le secteur visé d'abord, puis ses
 * voisins, du plus proche au plus lointain dans le temps.
 */
export function chantiersProches(secteur: string | null): Chantier[] {
	const tous = chantiers();
	if (!secteur) return [];
	const voisins = SECTEURS.find((s) => s.nom === secteur)?.voisins ?? [];
	const rang = (c: Chantier) => (c.secteur === secteur ? 0 : voisins.includes(c.secteur) ? 1 : 2);
	return tous.filter((c) => rang(c) < 2).sort((a, b) => rang(a) - rang(b) || a.pose - b.pose);
}

export type RondDeDate = {
	jour: number;
	mois: string;
	/** jours restants avant la pose (négatif si la pose est passée) */
	jours: number;
	/** part du rond à remplir, 1 = pose imminente */
	arc: number;
};

const MOIS = [
	'janv.',
	'févr.',
	'mars',
	'avr.',
	'mai',
	'juin',
	'juil.',
	'août',
	'sept.',
	'oct.',
	'nov.',
	'déc.'
];

/**
 * Ce qu'affiche le rond de date d'un chantier : le jour au centre, l'anneau
 * d'autant plus rempli que la pose approche (fenêtre de 60 jours).
 */
export function rondDeDate(c: Chantier, maintenant = Date.now()): RondDeDate {
	const d = new Date(c.pose);
	const jours = Math.round((c.pose - maintenant) / JOUR_MS);
	return {
		jour: d.getDate(),
		mois: MOIS[d.getMonth()],
		jours,
		arc: Math.min(1, Math.max(0, 1 - jours / 60))
	};
}

// ------------------------------------------------------------- La DO
export type Opportunite = {
	conditions: ConditionsOpportunite;
	/** minutes d'objections écoulées avant l'ouverture de l'outil */
	objections: number;
	adresse: string;
	secteur: string;
	/** ids des chantiers regroupés */
	chantiers: string[];
	/** ids des thèmes accordés par le responsable */
	themes: string[];
	responsable: string;
	/** remise négociée, en % */
	remise: number;
	/** nom signé par le responsable si la remise dépasse le seuil */
	valideePar: string | null;
	/** horodatage de la création de l'opportunité */
	le: number;
};

export function conditionsOk(c: ConditionsOpportunite): boolean {
	return c.pasPresse && c.panneau && c.discretion;
}

/** Remise totale apportée par les contreparties : chaque thème vaut ses points. */
export function remiseDe(themes: string[], chantiersRegroupes: number): number {
	let remise = 0;
	for (const t of THEMES) if (themes.includes(t.id)) remise += t.remise;
	if (themes.includes('regroupement')) {
		remise += REMISE_PAR_CHANTIER * Math.min(MAX_CHANTIERS_REGROUPES, chantiersRegroupes);
	}
	return Math.min(REMISE_MAX, remise);
}

/** Une remise au-delà du seuil doit être assumée par un responsable. */
export function supervisionRequise(remise: number): boolean {
	return remise >= SEUIL_SUPERVISION;
}

export function opportunitePrete(o: {
	remise: number;
	valideePar: string | null;
	responsable: string;
}): boolean {
	if (!supervisionRequise(o.remise)) return true;
	return o.valideePar != null && o.valideePar.trim().length > 1;
}

export function nouvelleOpportunite(): Opportunite {
	return {
		conditions: { pasPresse: false, panneau: false, discretion: false },
		objections: 0,
		adresse: '',
		secteur: '',
		chantiers: [],
		themes: [],
		responsable: '',
		remise: 0,
		valideePar: null,
		le: 0
	};
}
