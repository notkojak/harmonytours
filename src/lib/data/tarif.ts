// Catalogue tarifaire Bravaux 2026 (extrait du book de tarifs) pour
// l'outil de chiffrage. Prix HT = « prix annoncé » du tarif (colonne PRIX
// ANNONCÉ, avant la remise -20 % du NOUVEAU HT TAQUET).
// Les menuiseries (fenêtres, volets, portes…) sont vendues au « point » selon
// les dimensions : voir menuiseries.ts (grilles hauteur × largeur).

export type TarifProduct = {
	id: string;
	nom: string;
	categorie: string;
	unite: 'u' | 'm2' | 'ml';
	tva: 0.055 | 0.1 | 0.2;
	detail?: string;
	sous?: string; // sous-onglet du catalogue (page travaux du book)
} & (
	| { prixHT: number } // € HT — unitaire, ou par m² / ml
	| {
			points: number; // colonne POINTS du book : prix = points × valeur du point
			tiers?: { jusque: number; points: number }[]; // tarif dégressif selon la quantité (m²)
		}
);

const u = 'u' as const;

export const TARIF: TarifProduct[] = [
	// --- Photovoltaïque ---
	...['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k): TarifProduct => ({
		id: `pv-classique-${k}`,
		nom: `Photovoltaïque classique ${k} kWc`,
		categorie: 'Photovoltaïque',
		prixHT: [8500, 10500, 13400, 14200, 15800, 18400, 20100, 21800, 24800][Number(k) - 1],
		unite: u,
		tva: 0.2,
		detail: 'Gestionnaire inclus — pose comprise'
	})),
	{
		id: 'pv-classique-supp',
		nom: 'Photovoltaïque classique — kWc supplémentaire',
		categorie: 'Photovoltaïque',
		prixHT: 2500,
		unite: u,
		tva: 0.2
	},
	...['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k): TarifProduct => ({
		id: `pv-bas-carbone-${k}`,
		nom: `Photovoltaïque bas carbone ${k} kWc`,
		categorie: 'Photovoltaïque',
		prixHT: [10500, 12250, 15500, 16500, 18500, 22000, 23500, 25500, 27500][Number(k) - 1],
		unite: u,
		tva: 0.055,
		detail: 'Gestionnaire inclus — pose comprise'
	})),
	{
		id: 'pv-bas-carbone-supp',
		nom: 'Photovoltaïque bas carbone — kWc supplémentaire',
		categorie: 'Photovoltaïque',
		prixHT: 3500,
		unite: u,
		tva: 0.055
	},

	// --- Batterie ---
	{
		id: 'centrale-solplanet',
		nom: 'Centrale d’optimisation SolPlanet — onduleur hybride + batterie 5 kWh',
		categorie: 'Batterie',
		prixHT: 11250,
		unite: u,
		tva: 0.2,
		detail: 'ASW5000H-S2 + module ASW5120 — mono ou tri'
	},
	{
		id: 'module-batterie',
		nom: 'Module batterie SolPlanet 5 kWh supplémentaire',
		categorie: 'Batterie',
		prixHT: 6500,
		unite: u,
		tva: 0.2,
		detail: 'Compatible onduleur hybride ASW500H-S2 existant'
	},

	// --- PAC air / eau ---
	...[
		['8,5', 20125],
		['10', 20750],
		['12', 22750],
		['14', 24750]
	].map(([k, p]): TarifProduct => ({
		id: `pac-eau-${k}`,
		nom: `PAC air / eau Air H2O S ${k} kW — mono ou tri`,
		categorie: 'PAC air / eau',
		prixHT: p as number,
		unite: u,
		tva: 0.055
	})),
	...[
		['8,5', 22125],
		['10', 22750],
		['12', 24750],
		['14', 26750]
	].map(([k, p]): TarifProduct => ({
		id: `pac-eau-combi-${k}`,
		nom: `PAC air / eau Air H2O S ${k} kW Combi 220 L — mono ou tri`,
		categorie: 'PAC air / eau',
		prixHT: p as number,
		unite: u,
		tva: 0.055
	})),
	...[
		['11', 27250],
		['14', 29350],
		['16', 31490]
	].map(([k, p]): TarifProduct => ({
		id: `yutaki-${k}`,
		nom: `PAC air / eau Yutaki S80 ${k} kW Combi 200 L — mono ou tri`,
		categorie: 'PAC air / eau',
		prixHT: p as number,
		unite: u,
		tva: 0.055
	})),

	// --- PAC air / air ---
	...[
		['1,8', 2900],
		['2,5', 3500],
		['3,5', 4200],
		['5', 5200],
		['6', 6900],
		['7', 7900]
	].map(([k, p]): TarifProduct => ({
		id: `pac-air-${k}`,
		nom: `PAC air / air Monosplit ${k} kW`,
		categorie: 'PAC air / air',
		prixHT: p as number,
		unite: u,
		tva: 0.2
	})),
	...[
		['3,6', 8900],
		['4,3', 9500],
		['5,5', 10950],
		['6,8', 11950]
	].map(([k, p]): TarifProduct => ({
		id: `pac-air-2sorties-${k}`,
		nom: `PAC air / air Multisplit ${k} kW — 2 sorties`,
		categorie: 'PAC air / air',
		prixHT: p as number,
		unite: u,
		tva: 0.2
	})),
	...[
		['5,5', 10900],
		['6,8', 11900],
		['7', 12900],
		['8,5', 14900]
	].map(([k, p]): TarifProduct => ({
		id: `pac-air-3sorties-${k}`,
		nom: `PAC air / air Multisplit ${k} kW — 3 sorties`,
		categorie: 'PAC air / air',
		prixHT: p as number,
		unite: u,
		tva: 0.2
	})),

	// --- Ballon thermodynamique ---
	{
		id: 'bt-yutampo-190',
		nom: 'Ballon thermodynamique BT Yutampo 190 L',
		categorie: 'Ballon thermodynamique',
		prixHT: 6050,
		unite: u,
		tva: 0.055
	},
	{
		id: 'bt-yutampo-270',
		nom: 'Ballon thermodynamique BT Yutampo 270 L',
		categorie: 'Ballon thermodynamique',
		prixHT: 7450,
		unite: u,
		tva: 0.055
	},
	{
		id: 'bt-neptuo-230',
		nom: 'Ballon thermodynamique BT Neptuo 230 BG',
		categorie: 'Ballon thermodynamique',
		prixHT: 6258,
		unite: u,
		tva: 0.055
	},
	{
		id: 'bt-neptuo-350',
		nom: 'Ballon thermodynamique BT Neptuo 350 BG',
		categorie: 'Ballon thermodynamique',
		prixHT: 6990,
		unite: u,
		tva: 0.055
	},

	// --- Toiture & façade : page « TRAVAUX DE TOITURE ET FACADE » du book ---
	// Pour tout chantier toiture/façade : mise en place + échafaudage obligatoires.
	{
		id: 'mise-en-place-chantier',
		nom: 'Mise en place et nettoyage de chantier',
		categorie: 'Toiture & façade',
		sous: 'Travaux',
		points: 5.66,
		unite: u,
		tva: 0.1,
		detail: 'Colonne POINTS du book — obligatoire pour tout chantier toiture / façade'
	},
	{
		id: 'echafaudage-r1',
		nom: 'Pose d’un échafaudage à partir du R+1',
		categorie: 'Toiture & façade',
		sous: 'Travaux',
		points: 26.4,
		unite: u,
		tva: 0.1,
		detail: 'Colonne POINTS du book — vendu seul'
	},
	{
		id: 'epi',
		nom: 'EPI',
		categorie: 'Toiture & façade',
		sous: 'Travaux',
		points: 2.6,
		unite: u,
		tva: 0.1,
		detail: 'Colonne POINTS du book'
	},
	{
		id: 'toit-nettoyage-tuiles',
		nom: 'Nettoyage HP, démoussage, hydrofugation des tuiles',
		categorie: 'Toiture & façade',
		sous: 'La toiture',
		points: 0.57,
		unite: 'm2',
		tva: 0.1
	},
	{
		id: 'toit-nettoyage-tuiles-colorees',
		nom: 'Nettoyage HP, démoussage, hydrofugation des tuiles colorées',
		categorie: 'Toiture & façade',
		sous: 'La toiture',
		points: 0.7,
		unite: 'm2',
		tva: 0.1
	},
	{
		id: 'toit-faitage-1-5',
		nom: 'Faîtage et rives de 1 ml à 5 ml',
		categorie: 'Toiture & façade',
		sous: 'La toiture',
		points: 4.5,
		unite: 'ml',
		tva: 0.1
	},
	{
		id: 'toit-faitage-6-10',
		nom: 'Faîtage et rives de 6 ml à 10 ml',
		categorie: 'Toiture & façade',
		sous: 'La toiture',
		points: 3.5,
		unite: 'ml',
		tva: 0.1
	},
	{
		id: 'toit-faitage-11',
		nom: 'Faîtage et rives au-dessus de 11 ml',
		categorie: 'Toiture & façade',
		sous: 'La toiture',
		points: 2.5,
		unite: 'ml',
		tva: 0.1
	},
	{
		id: 'toit-solin',
		nom: 'Solin',
		categorie: 'Toiture & façade',
		sous: 'La toiture',
		points: 2.3,
		unite: 'ml',
		tva: 0.1
	},
	{
		id: 'toit-depose-cheminée',
		nom: 'Dépose de cheminée et mise en place des tuiles',
		categorie: 'Toiture & façade',
		sous: 'La toiture',
		points: 9.97,
		unite: u,
		tva: 0.1
	},
	{
		id: 'toit-abergement',
		nom: 'Abergement cheminée',
		categorie: 'Toiture & façade',
		sous: 'La toiture',
		points: 19,
		unite: u,
		tva: 0.1,
		detail: '14,00 avec un autre produit toiture'
	},
	{
		id: 'toit-remaniement',
		nom: 'Remaniement de tuiles / réfection de toiture',
		categorie: 'Toiture & façade',
		sous: 'La toiture',
		points: 2.78,
		unite: 'm2',
		tva: 0.1
	},
	{
		id: 'toit-gouttiere-pvc',
		nom: 'Gouttière PVC',
		categorie: 'Toiture & façade',
		sous: 'La toiture',
		points: 1.42,
		unite: 'ml',
		tva: 0.1
	},
	{
		id: 'toit-gouttiere-alu',
		nom: 'Gouttière ALU',
		categorie: 'Toiture & façade',
		sous: 'La toiture',
		points: 2.06,
		unite: 'ml',
		tva: 0.1
	},
	{
		id: 'toit-ardoise-fibro',
		nom: 'Réfection couverture ardoise fibro',
		categorie: 'Toiture & façade',
		sous: 'La toiture',
		prixHT: 380,
		unite: 'm2',
		tva: 0.1,
		detail: 'Prix annoncé HT / m²'
	},
	{
		id: 'toit-ardoise-naturelle',
		nom: 'Réfection couverture ardoise naturelle',
		categorie: 'Toiture & façade',
		sous: 'La toiture',
		prixHT: 480,
		unite: 'm2',
		tva: 0.1,
		detail: 'Prix annoncé HT / m²'
	},
	{
		id: 'combles-soufflage',
		nom: 'Soufflage de 31,5 cm de laine de roche (R7)',
		categorie: 'Toiture & façade',
		sous: 'Les combles',
		points: 0.57,
		unite: 'm2',
		tva: 0.055
	},
	{
		id: 'combles-depose-isolation',
		nom: 'Dépose de l’ancienne isolation',
		categorie: 'Toiture & façade',
		sous: 'Les combles',
		points: 0.22,
		unite: 'm2',
		tva: 0.055
	},
	{
		id: 'combles-film-ecran',
		nom: 'Pose de film écran sous toiture',
		categorie: 'Toiture & façade',
		sous: 'Les combles',
		points: 0.52,
		unite: 'm2',
		tva: 0.1
	},
	{
		id: 'combles-rampant',
		nom: 'Isolation sous rampant',
		categorie: 'Toiture & façade',
		sous: 'Les combles',
		points: 1.4,
		unite: 'm2',
		tva: 0.055
	},
	{
		id: 'combles-rampant-placo',
		nom: 'Isolation sous rampant, finition placo + peinture blanche',
		categorie: 'Toiture & façade',
		sous: 'Les combles',
		points: 3.3,
		unite: 'm2',
		tva: 0.055
	},
	{
		id: 'combles-bois-injection',
		nom: 'Traitement de bois par injection (curatif)',
		categorie: 'Toiture & façade',
		sous: 'Les combles',
		points: 0.49,
		unite: 'm2',
		tva: 0.1
	},
	{
		id: 'combles-bois-pulverisation',
		nom: 'Traitement de bois par pulvérisation (préventif)',
		categorie: 'Toiture & façade',
		sous: 'Les combles',
		points: 0.29,
		unite: 'm2',
		tva: 0.1
	},
	{
		id: 'combles-vmi',
		nom: 'Ventilation VMI',
		categorie: 'Toiture & façade',
		sous: 'Les combles',
		points: 72,
		unite: u,
		tva: 0.1
	},
	{
		id: 'combles-parasites',
		nom: 'Traitement contre les parasites (abeilles, guêpes, rongeurs…)',
		categorie: 'Toiture & façade',
		sous: 'Les combles',
		points: 0.44,
		unite: 'm2',
		tva: 0.1
	},
	{
		id: 'facade-nettoyage-rc',
		nom: 'Nettoyage HP & peinture hydrofuge des façades RC',
		categorie: 'Toiture & façade',
		sous: 'La façade',
		points: 0.88,
		unite: 'm2',
		tva: 0.1,
		tiers: [
			{ jusque: 99, points: 0.88 },
			{ jusque: 149, points: 0.83 },
			{ jusque: 199, points: 0.75 },
			{ jusque: 249, points: 0.7 },
			{ jusque: Infinity, points: 0.65 }
		],
		detail: 'Au point, dégressif selon la surface : 0,88 ≤99 m² → 0,65 >250 m²'
	},
	{
		id: 'facade-nettoyage-r1',
		nom: 'Nettoyage HP & peinture hydrofuge des façades R+1',
		categorie: 'Toiture & façade',
		sous: 'La façade',
		points: 0.99,
		unite: 'm2',
		tva: 0.1,
		tiers: [
			{ jusque: 99, points: 0.99 },
			{ jusque: 149, points: 0.99 },
			{ jusque: 199, points: 0.85 },
			{ jusque: 249, points: 0.8 },
			{ jusque: Infinity, points: 0.75 }
		],
		detail: 'Au point, dégressif selon la surface : 0,99 ≤99 m² → 0,75 >250 m²'
	},
	{
		id: 'facade-ravalement-enduit',
		nom: 'Ravalement de façade avec enduit couleur de finition',
		categorie: 'Toiture & façade',
		sous: 'La façade',
		points: 1.39,
		unite: 'm2',
		tva: 0.1
	},
	{
		id: 'facade-remontees-capillaires',
		nom: 'Traitement de remontées capillaires',
		categorie: 'Toiture & façade',
		sous: 'La façade',
		points: 3.1,
		unite: 'ml',
		tva: 0.1
	},
	{
		id: 'facade-ite',
		nom: 'ITE (isolation thermique extérieure)',
		categorie: 'Toiture & façade',
		sous: 'La façade',
		points: 3.3,
		unite: 'm2',
		tva: 0.055
	},
	{
		id: 'facade-volet-a-deporter',
		nom: 'Volet battant à déporter',
		categorie: 'Toiture & façade',
		sous: 'La façade',
		points: 4.5,
		unite: u,
		tva: 0.1
	},
	{
		id: 'facade-veranda',
		nom: 'Véranda aluminium (sur chappe existante)',
		categorie: 'Terrasses & vérandas',
		points: 20,
		unite: 'm2',
		tva: 0.1,
		detail: 'Page toiture & façade : 20 pts/m² (p.52 rappel qualif : 19 pts/m²)'
	},
	{
		id: 'facade-pergola',
		nom: 'Pergola (alu sur façade)',
		categorie: 'Toiture & façade',
		sous: 'La façade',
		prixHT: 1500,
		unite: 'm2',
		tva: 0.1,
		detail: 'Prix annoncé : 1 500 € / m² — pergola solaire : voir outil pergola'
	},
	{
		id: 'facade-aluloge',
		nom: 'Aluloge / carport',
		categorie: 'Toiture & façade',
		sous: 'La façade',
		points: 12,
		unite: 'm2',
		tva: 0.1,
		detail: '12 pts/m² — colonne POINTS du book'
	},
	{
		id: 'facade-depose-pv',
		nom: 'Dépose ancien PV / repose PV AC',
		categorie: 'Toiture & façade',
		sous: 'La façade',
		points: 2.78,
		unite: 'm2',
		tva: 0.1
	},

	// --- Terrasses & vérandas (page aménagements extérieurs, TVA 10 %) ---
	{
		id: 'terrasse-reagrenage',
		nom: 'Terrasse : mise en place, démolition, réagrénage fibré (sans carrelage)',
		categorie: 'Terrasses & vérandas',
		points: 3.84,
		unite: 'm2',
		tva: 0.1,
		detail: 'Avec finition béton'
	},
	{
		id: 'terrasse-benne',
		nom: 'Terrasse : benne à gravats 3 m³ (≈ 40-50 m²)',
		categorie: 'Terrasses & vérandas',
		points: 6.6,
		unite: u,
		tva: 0.1
	},
	{
		id: 'terrasse-carrelage',
		nom: 'Terrasse : option carrelage',
		categorie: 'Terrasses & vérandas',
		points: 0.7,
		unite: 'm2',
		tva: 0.1
	}
];

export const TARIF_CATEGORIES = [...new Set(TARIF.map((p) => p.categorie))];

export const TVA_LABEL: Record<number, string> = {
	0.055: 'TVA 5,5 %',
	0.1: 'TVA 10 %',
	0.2: 'TVA 20 %'
};
