export type FamilleCatalogue = { name: string; produits: string[] };

// Catalogue Groupe Bravaux (applicable au 01/09/2026) — produits par famille.
export const CATALOGUE: FamilleCatalogue[] = [
	{
		name: 'Photovoltaïque',
		produits: ['Installation 1 à 9 kWc (gestionnaire inclus)', 'kWc supplémentaire']
	},
	{
		name: 'Batterie',
		produits: [
			'Onduleur hybride Solplanet ASW5000H-S2 + batterie 5 kWh',
			'Module batterie 5 kWh supplémentaire'
		]
	},
	{ name: 'Borne de recharge', produits: ['WallBox 7 kW monophasée', 'WallBox 11 kW triphasée'] },
	{
		name: 'PAC air / eau',
		produits: [
			'Air H2O S 8,5 / 10 / 12 / 14 kW — mono ou tri',
			'Air H2O S 8,5 / 10 / 12 / 14 kW Combi 220 L — mono ou tri'
		]
	},
	{
		name: 'Climatisation air / air',
		produits: [
			'Monosplit 1,8 / 2,5 / 3,5 / 5 / 6 / 7 kW',
			'Multisplit groupe ext. 2 sorties : 3,6 / 4,3 / 5,5 / 6,8 kW',
			'Multisplit groupe ext. 3 sorties : 5,5 / 6,8 / 7 / 8,5 kW'
		]
	},
	{
		name: 'Ballon thermodynamique',
		produits: ['BT Yutampo 190 L', 'BT Yutampo 270 L', 'BT Neptuo 230 BG', 'BT Neptuo 350 BG']
	},
	{
		name: 'Chauffe-eau électrique',
		produits: ['Chauffe-eau Linéo Connecté vertical mural 150 L — blanc']
	},
	{
		name: 'Sanitaire / ventilation / électricité',
		produits: [
			"Adoucisseur d'eau",
			'VMC simple flux',
			'Remise en sécurité tableau électrique mono (1 à 3 lignes)',
			'Remise en sécurité tableau électrique tri (1 à 3 lignes)'
		]
	},
	{
		name: 'Hydro Toiture',
		produits: [
			'Hydrofugation toiture incolore',
			'Hydrofugation toiture colorée',
			'Dessous de toit PVC blanc'
		]
	},
	{ name: 'Hydro Façade', produits: ['Hydrofugation façade colorée'] },
	{
		name: 'Ravalement',
		produits: [
			'Ravalement de façade avec enduit couleur de finition',
			'Mise en place et nettoyage de chantier',
			'Échafaudage à partir du R+1'
		]
	},
	{
		name: 'Iso combles',
		produits: [
			'Soufflage laine de roche 31,5 cm (R7)',
			'Soufflage laine de verre Comblissimo (R7)',
			"Dépose de l'ancienne isolation",
			'Mise en place et nettoyage de chantier'
		]
	},
	{
		name: 'Charpente',
		produits: [
			'Traitement charpente préventif (pulvérisation)',
			'Traitement charpente curatif (injection)',
			'Mise en place et nettoyage de chantier'
		]
	},
	{
		name: 'Pergola',
		produits: ['Pergola bioclimatique (LED de série)']
	},
	{
		name: 'Carport',
		produits: ['Carport classique / Aluloge', 'Carport solaire']
	},
	{
		name: "Portes d'entrée",
		produits: [
			'PVC gamme Classiques — Granada, Eva, Agatha, Arcadia, Athéna, Corsa, Gothica, Octavia, Célia',
			'PVC gamme Contemporaines / vitrées',
			"ALU gamme Contemporaines — Full, Sensation, Natural, Kréative, Moon, Square, Line, Graphic, Art Déco, Atelier d'artiste",
			'ALU gamme Verrières — Kréative, Contemporaines, Authentiques',
			'ALU gamme Authentiques — Maison de maître, Maison de campagne, Origine'
		]
	},
	{
		name: 'Menuiseries & fermetures',
		produits: [
			'Fenêtres & coulissants PVC rénovation',
			'Fenêtres & coulissants ALU',
			'Volet roulant solaire alu 41 & 54 mm',
			'Volet roulant solaire avec moustiquaire intégrée',
			'Porte de garage enroulable Easy',
			'Porte de garage enroulable Excel',
			'Store toile motorisé Screenéo'
		]
	}
];

export const FAMILLES = CATALOGUE.map((f) => f.name);

export function produitsOf(famille: string | undefined | null): string[] {
	if (!famille) return [];
	return CATALOGUE.find((f) => f.name === famille)?.produits ?? [];
}

export function familleOf(produit: string | undefined | null): string | undefined {
	if (!produit) return undefined;
	return CATALOGUE.find((f) => f.produits.includes(produit))?.name;
}

export const ALL_PRODUITS = CATALOGUE.flatMap((f) => f.produits);
export const PREMIER_PRODUIT = ALL_PRODUITS[0] ?? '';
