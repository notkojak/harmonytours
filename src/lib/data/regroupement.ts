// Regroupement de chantier — le visuel que l'on montre au client.
//
// Le book est formel : rien de la mécanique interne de la DO ne doit filtrer
// devant le client. Ce module ne contient donc que ce qui se montre — les
// conditions qu'il valide, puis les chantiers programmés de son secteur — et
// aucune trace des objections, des thèmes, du seuil de supervision ou de la
// remise.

export type PointAValider = {
	id: string;
	emoji: string;
	titre: string;
	aide: string;
};

/**
 * Les quatre conditions du regroupement, telles qu'elles se valident avec le
 * client. Aucune ne parle de nos contreparties internes.
 */
export const POINTS_A_VALIDER: PointAValider[] = [
	{
		id: 'pas-presse',
		emoji: '⏳',
		titre: 'Pas être pressé',
		aide: 'Le prochain planning de poses est dans 2 mois : rien ne se décide dans la précipitation.'
	},
	{
		id: 'panneau',
		emoji: '🪧',
		titre: 'Un panneau de chantier pendant 2 mois',
		aide: 'Le panneau reste sur place deux mois après la pose : de la visibilité pour votre quartier.'
	},
	{
		id: 'avant-apres',
		emoji: '📸',
		titre: 'Un avant / après en photo',
		aide: 'Votre maison est photographiée avant et après les travaux.'
	},
	{
		id: 'discretion',
		emoji: '🤐',
		titre: 'Discrétion sur le prix annoncé',
		aide: 'Le prix annoncé ne circule pas en dehors de votre dossier.'
	}
];

/** Rayon de la zone de regroupement autour de la maison, en mètres. */
export const RAYON_ZONE = 20_000;

/** Nombre de dossiers montrés au client : cinq, pas plus. */
export const MAX_CHANTIERS_PROGRAMMES = 5;

/** Délai annoncé pour les chantiers programmés : deux mois et demi. */
export const DELAI_JOURS = 75;

/** Les cinq poses s'étalent sur deux semaines. */
export const FENETRE_POSES_JOURS = 14;

export type ChantierProgramme = {
	id: string;
	/** nature du chantier, toujours un produit cousin de celui du client */
	projet: string;
	/** commune de la pose — sert au vendeur, jamais affichée au client */
	commune: string;
	/** distance à la maison du client, en mètres */
	distance: number;
	/** horodatage de la pose prévue */
	pose: number;
	lat: number;
	lon: number;
};

/** Une pose du planning : un vrai lieu du secteur, sans nom de client. */
type PoseProgrammee = { commune: string; lon: number; lat: number };

/**
 * Le planning de pose du secteur. Positions réelles des communes autour de
 * l'agence, de 2 à 20 km : la démonstration ne fabrique rien à partir de
 * l'adresse du client, elle ne retient que ce qui tombe dans son rayon. La
 * nature du chantier n'est pas portée ici : elle dépend du projet du client.
 */
const PLANNING: PoseProgrammee[] = [
	{ commune: 'Tours', lon: 0.689, lat: 47.41 },
	{ commune: 'Saint-Cyr-sur-Loire', lon: 0.6556, lat: 47.4027 },
	{ commune: 'La Riche', lon: 0.6544, lat: 47.3894 },
	{ commune: 'Saint-Pierre-des-Corps', lon: 0.7264, lat: 47.39 },
	{ commune: 'Saint-Avertin', lon: 0.7403, lat: 47.3636 },
	{ commune: 'Joué-lès-Tours', lon: 0.6642, lat: 47.3514 },
	{ commune: 'Rochecorbon', lon: 0.757, lat: 47.414 },
	{ commune: 'Chambray-lès-Tours', lon: 0.7108, lat: 47.3375 },
	{ commune: 'Notre-Dame-d’Oé', lon: 0.712, lat: 47.4525 },
	{ commune: 'Parçay-Meslay', lon: 0.746, lat: 47.442 },
	{ commune: 'Fondettes', lon: 0.5989, lat: 47.4044 },
	{ commune: 'Mettray', lon: 0.65, lat: 47.4519 },
	{ commune: 'Chanceaux-sur-Choisille', lon: 0.686, lat: 47.46 },
	{ commune: 'La Membrolle-sur-Choisille', lon: 0.617, lat: 47.44 },
	{ commune: 'Vouvray', lon: 0.799, lat: 47.412 },
	{ commune: 'Luynes', lon: 0.577, lat: 47.3844 },
	{ commune: 'Ballan-Miré', lon: 0.61, lat: 47.3397 },
	{ commune: 'Savonnières', lon: 0.55, lat: 47.352 },
	{ commune: 'Montbazon', lon: 0.713, lat: 47.287 },
	{ commune: 'Vernou-sur-Brenne', lon: 0.846, lat: 47.419 },
	{ commune: 'Veigné', lon: 0.739, lat: 47.287 },
	{ commune: 'Villandry', lon: 0.512, lat: 47.339 },
	{ commune: 'Artannes-sur-Indre', lon: 0.594, lat: 47.272 },
	{ commune: 'Noizay', lon: 0.893, lat: 47.422 },
	{ commune: 'Cormery', lon: 0.84, lat: 47.268 },
	{ commune: 'Cinq-Mars-la-Pile', lon: 0.457, lat: 47.347 },
	{ commune: 'Neuillé-Pont-Pierre', lon: 0.571, lat: 47.548 }
];

// ------------------------------------------------------- Produits cousins
//
// Les poses programmées parlent du même métier que le projet du client : c'est
// la même équipe, la même tournée, le même matériel. Un client qui achète des
// volets voit donc des volets, des fenêtres et des portes d'entrée — jamais des
// panneaux solaires.

/** Les familles qui se posent naturellement avec celle du client, la sienne d'abord. */
const FAMILLES_LIEES: Record<string, string[]> = {
	solaire: ['solaire', 'borne', 'elec'],
	borne: ['borne', 'solaire', 'elec'],
	elec: ['elec', 'solaire', 'borne'],
	clim: ['clim', 'pac', 'ecs'],
	pac: ['pac', 'clim', 'ecs'],
	ecs: ['ecs', 'pac', 'clim'],
	menuiseries: ['menuiseries', 'volets', 'entree', 'garage'],
	volets: ['volets', 'menuiseries', 'entree'],
	garage: ['garage', 'entree', 'menuiseries'],
	entree: ['entree', 'menuiseries', 'garage'],
	toiture: ['toiture', 'exterieur'],
	exterieur: ['exterieur', 'menuiseries', 'toiture']
};

/** Libellés courts par famille, tels qu'ils s'affichent dans la frise des poses. */
const PRODUITS_COURTS: Record<string, string[]> = {
	solaire: ['Panneaux photovoltaïques', 'Batterie de stockage'],
	borne: ['Borne de recharge'],
	elec: ['Tableau électrique'],
	clim: ['Climatisation'],
	pac: ['Pompe à chaleur'],
	ecs: ['Ballon thermodynamique', 'Chauffe-eau'],
	menuiseries: ['Fenêtres PVC', 'Baie coulissante alu'],
	volets: ['Volets roulants', 'Volet solaire'],
	garage: ['Porte de garage'],
	entree: ['Porte d’entrée'],
	toiture: ['Hydrofuge toiture', 'Ravalement de façade'],
	exterieur: ['Pergola bioclimatique', 'Store banne']
};

/** Repli quand le devis ne dit pas de quelle famille il s'agit. */
const PRODUITS_GENERIQUES = [
	'Fenêtres PVC',
	'Volets roulants',
	'Porte de garage',
	'Pompe à chaleur',
	'Store banne'
];

/**
 * Les produits à montrer : ceux de la famille du client, puis ceux de ses
 * voisines, en alternance pour que la frise ne ressemble pas à un catalogue.
 */
function produitsPour(famille: string): string[] {
	if (!famille) return PRODUITS_GENERIQUES;
	const listes = (FAMILLES_LIEES[famille] ?? [famille])
		.map((f) => PRODUITS_COURTS[f] ?? [])
		.filter((l) => l.length > 0);
	const libelles: string[] = [];
	for (let tour = 0; tour < 4; tour++) {
		for (const liste of listes) {
			const libelle = liste[tour];
			if (libelle && !libelles.includes(libelle)) libelles.push(libelle);
		}
	}
	return libelles.length ? libelles : PRODUITS_GENERIQUES;
}

const M_PAR_DEG_LAT = 111_320;
const JOUR_MS = 24 * 60 * 60 * 1000;

/**
 * Les cinq poses de la fenêtre, bien espacées : une tous les trois à quatre
 * jours, du premier au dernier jour des deux semaines.
 */
const DECALAGES = [0, 3, 7, 10, FENETRE_POSES_JOURS];

/** Accents, casse, tirets et apostrophes ignorés : « Joué-lès-Tours » = « joue les tours ». */
function normaliser(nom: string): string {
	return nom
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '');
}

/** Le client ne doit voir aucune pose dans sa propre commune. */
function autreCommune(commune: string, communeExclue: string): boolean {
	if (!communeExclue) return true;
	return normaliser(commune) !== normaliser(communeExclue);
}

/** Pose calée à midi : un décalage de fuseau ne change pas le jour affiché. */
function pose(dansJours: number): number {
	const d = new Date();
	d.setHours(12, 0, 0, 0);
	return d.getTime() + dansJours * JOUR_MS;
}

/** Distance à vol d'oiseau, en mètres. */
function distanceM(depuis: [number, number], lat: number, lon: number): number {
	const dLat = (lat - depuis[1]) * M_PAR_DEG_LAT;
	const dLon = (lon - depuis[0]) * M_PAR_DEG_LAT * Math.cos((depuis[1] * Math.PI) / 180);
	return Math.hypot(dLat, dLon);
}

/**
 * Échantillonne `n` éléments répartis sur toute la liste. Le planning du secteur
 * compte plus de poses que la carte n'en montre : on veut du proche et du loin,
 * pas seulement les huit plus proches collées autour de la maison.
 */
function repartir<T>(liste: T[], n: number): T[] {
	if (liste.length <= n) return liste;
	const pas = (liste.length - 1) / (n - 1);
	return Array.from({ length: n }, (_, k) => liste[Math.round(k * pas)]);
}

/**
 * Repli : la maison est trop loin du planning pour que quoi que ce soit tombe
 * dans son rayon. On sème alors des poses tout autour d'elle, pour que la
 * démonstration reste lisible. Les graines sont toutes à plus de 5 km du centre,
 * pour ne pas poser un chantier dans la commune du client.
 */
function semerAutour(centre: [number, number]): { p: PoseProgrammee; distance: number }[] {
	const [lon, lat] = centre;
	const mParDegLon = M_PAR_DEG_LAT * Math.cos((lat * Math.PI) / 180);
	const graines = [
		{ angle: 0.14, rayon: 0.26 },
		{ angle: 0.42, rayon: 0.52 },
		{ angle: 0.68, rayon: 0.38 },
		{ angle: 0.86, rayon: 0.74 },
		{ angle: 0.24, rayon: 0.9 }
	];
	return graines.map((g) => {
		const a = g.angle * 2 * Math.PI;
		const m = g.rayon * RAYON_ZONE;
		return {
			p: {
				commune: 'Secteur',
				lat: lat + (m * Math.cos(a)) / M_PAR_DEG_LAT,
				lon: lon + (m * Math.sin(a)) / mParDegLon
			},
			distance: m
		};
	});
} /**
 * Les cinq dossiers du rayon, du plus proche au plus lointain. Ce sont des poses
 * réelles du planning de l'agence : rien n'est fabriqué à partir de l'adresse du
 * client, on ne garde que celles qui tombent dans son rayon — et jamais une pose
 * dans sa propre commune, qui trahirait la mise en scène.
 *
 * `famille` est la famille du book du produit vendu : les cinq dossiers portent
 * alors des produits cousins du sien, pas un catalogue sans rapport.
 */
export function chantiersProgrammes(
	centre: [number, number],
	communeExclue = '',
	famille = ''
): ChantierProgramme[] {
	const dansLeRayon = PLANNING.map((p) => ({ p, distance: distanceM(centre, p.lat, p.lon) }))
		.filter((x) => x.distance <= RAYON_ZONE && autreCommune(x.p.commune, communeExclue))
		.sort((a, b) => a.distance - b.distance);

	const poses =
		dansLeRayon.length >= MAX_CHANTIERS_PROGRAMMES
			? repartir(dansLeRayon, MAX_CHANTIERS_PROGRAMMES)
			: semerAutour(centre);
	const produits = produitsPour(famille);

	return poses.map((x, i) => ({
		id: `pr-${i + 1}`,
		projet: produits[i % produits.length],
		commune: x.p.commune,
		distance: Math.round(x.distance / 10) * 10,
		pose: pose(DELAI_JOURS + DECALAGES[i % DECALAGES.length]),
		lat: x.p.lat,
		lon: x.p.lon
	}));
}

/**
 * Le centre du rond : le milieu des chantiers programmés, jamais la maison du
 * client. C'est le secteur où nos équipes sont déjà à l'œuvre qui dessine la
 * zone ; la maison du client vient s'y ajouter.
 */
export function centreDesChantiers(chantiers: ChantierProgramme[]): [number, number] | null {
	if (!chantiers.length) return null;
	return [
		chantiers.reduce((s, c) => s + c.lon, 0) / chantiers.length,
		chantiers.reduce((s, c) => s + c.lat, 0) / chantiers.length
	];
}

/** Anneau de la zone : polygone approchant un cercle de `rayon` mètres. */
export function cercleZone(
	centre: [number, number],
	rayon = RAYON_ZONE,
	sommets = 96
): {
	type: 'Feature';
	properties: Record<string, never>;
	geometry: { type: 'Polygon'; coordinates: [number, number][][] };
} {
	const [lon, lat] = centre;
	const mParDegLon = M_PAR_DEG_LAT * Math.cos((lat * Math.PI) / 180);
	const anneau: [number, number][] = [];
	for (let i = 0; i <= sommets; i++) {
		const a = (i / sommets) * 2 * Math.PI;
		anneau.push([
			lon + (rayon * Math.sin(a)) / mParDegLon,
			lat + (rayon * Math.cos(a)) / M_PAR_DEG_LAT
		]);
	}
	return {
		type: 'Feature',
		properties: {},
		geometry: { type: 'Polygon', coordinates: [anneau] }
	};
}

/** Boîte englobante de la zone, pour recadrer la carte sur le rond. */
export function bornesZone(centre: [number, number], rayon = RAYON_ZONE): [number, number][] {
	const [lon, lat] = centre;
	const dLat = rayon / M_PAR_DEG_LAT;
	const dLon = rayon / (M_PAR_DEG_LAT * Math.cos((lat * Math.PI) / 180));
	return [
		[lon - dLon, lat - dLat],
		[lon + dLon, lat + dLat]
	];
}

const MOIS_COURT = [
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

const MOIS_LONG = [
	'janvier',
	'février',
	'mars',
	'avril',
	'mai',
	'juin',
	'juillet',
	'août',
	'septembre',
	'octobre',
	'novembre',
	'décembre'
];

export function jourDe(ms: number): { jour: number; mois: string; court: string } {
	const d = new Date(ms);
	return {
		jour: d.getDate(),
		mois: MOIS_COURT[d.getMonth()],
		court: `${d.getDate()} ${MOIS_COURT[d.getMonth()]}`
	};
}

export function moisAnneeDe(ms: number): string {
	const d = new Date(ms);
	return `${MOIS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

/** Distance lisible : « à 480 m », « à 8,5 km ». */
export function distanceTexte(m: number): string {
	if (m < 1000) return `à ${Math.round(m / 10) * 10} m`;
	return `à ${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

// ------------------------------------------ Mémorisation du visuel client
//
// Les cinq maisons montrées au client viennent du planning réel du secteur,
// mais leurs dates de pose sont calculées à partir d'aujourd'hui. Sans mémoire,
// rouvrir le visuel (ou revenir sur le même devis un autre jour) changerait les
// dates, voire la sélection. On garde donc le résultat sur l'appareil : mêmes
// maisons tant que l'adresse — et la famille de produit — ne changent pas.

const CLE_REGROUPEMENT = 'harmony-regroupement';
const VERSION_REGROUPEMENT = 1;

/** Une maison mémorisée n'est reprise que si elle est complète. */
function estChantier(valeur: unknown): valeur is ChantierProgramme {
	if (typeof valeur !== 'object' || valeur === null) return false;
	const c = valeur as Record<string, unknown>;
	const nombre = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
	return (
		typeof c.id === 'string' &&
		typeof c.projet === 'string' &&
		typeof c.commune === 'string' &&
		nombre(c.distance) &&
		c.distance >= 0 &&
		nombre(c.pose) &&
		nombre(c.lat) &&
		nombre(c.lon)
	);
}

/**
 * Les maisons déjà montrées pour cette adresse et cette famille de produit, ou
 * null s'il n'y a rien de valable à reprendre. Un changement d'adresse repart
 * donc d'un tirage neuf, comme demandé.
 */
export function chargerChantiers(adresse: string, famille: string): ChantierProgramme[] | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const brut = localStorage.getItem(CLE_REGROUPEMENT);
		if (!brut) return null;
		const data = JSON.parse(brut) as Record<string, unknown> | null;
		if (
			!data ||
			data.version !== VERSION_REGROUPEMENT ||
			typeof data.adresse !== 'string' ||
			typeof data.famille !== 'string' ||
			normaliser(data.adresse) !== normaliser(adresse) ||
			data.famille !== famille ||
			!Array.isArray(data.chantiers)
		) {
			return null;
		}
		const chantiers = data.chantiers.filter(estChantier).slice(0, MAX_CHANTIERS_PROGRAMMES);
		return chantiers.length ? chantiers : null;
	} catch {
		return null;
	}
}

/** Mémorise les maisons du visuel pour cette adresse et cette famille. */
export function sauverChantiers(
	adresse: string,
	famille: string,
	chantiers: ChantierProgramme[]
): void {
	if (typeof localStorage === 'undefined' || !chantiers.length) return;
	try {
		localStorage.setItem(
			CLE_REGROUPEMENT,
			JSON.stringify({
				version: VERSION_REGROUPEMENT,
				adresse,
				famille,
				chantiers
			})
		);
	} catch {
		// Stockage refusé (navigation privée, quota) : le visuel reste utilisable,
		// seule la reprise à l'identique est perdue.
	}
}

/** Vide le panier : les maisons mémorisées repartent du planning du secteur. */
export function effacerChantiers(): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.removeItem(CLE_REGROUPEMENT);
	} catch {
		// Stockage inaccessible : rien à nettoyer.
	}
}
