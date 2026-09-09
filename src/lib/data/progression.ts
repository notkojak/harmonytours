// Arbres de progression (gamification), du bas (premier élément) vers le haut.
// Miroir de src/convex/progression.ts (mêmes clés pour les mutations).
export const TREES = [
	{
		key: 'integration',
		label: "Parcours d'intégration",
		emoji: '🌱',
		steps: [
			{ key: 'integration', label: 'Intégration', emoji: '🤝' },
			{ key: 'qualification', label: 'Points de qualification', emoji: '💬' },
			{ key: 'decouverte', label: 'Points de découverte', emoji: '🔍' },
			{ key: 'baseline', label: 'Produits du catalogue', emoji: '🗂️' }
		]
	},
	{
		key: 'tram',
		label: 'Tram de prospection',
		emoji: '🚀',
		steps: [
			{ key: 'ambiance', label: 'Ambiance', emoji: '🎵' },
			{ key: 'presentation', label: 'Présentation', emoji: '🗣️' },
			{ key: 'decouverte', label: 'Découverte', emoji: '💡' },
			{ key: 'adresse', label: "Prise d'adresse", emoji: '📍' },
			{ key: 'prix', label: 'Notion de prix', emoji: '💶' },
			{ key: 'rdv', label: 'Prise de RDV', emoji: '📅' },
			{ key: 'confirmation', label: 'Confirmation', emoji: '✅' }
		]
	},
	{
		key: 'attitude',
		label: 'Attitude',
		emoji: '🧭',
		steps: [
			{ key: 'ciblage', label: 'Ciblage de secteurs', emoji: '🎯' },
			{ key: 'porte', label: 'Attitude devant une porte', emoji: '🚪' },
			{ key: 'client', label: 'Attitude devant un client', emoji: '💼' },
			{ key: 'gms', label: 'Attitude en GMS', emoji: '🏪' }
		]
	},
	{
		key: 'performances',
		label: 'Performances',
		emoji: '🔥',
		steps: [
			{ key: 'rdv15', label: '15 RDV en 1 mois', emoji: '🗓️' },
			{ key: 'ca15', label: '15 000 € de CA en 1 mois', emoji: '💰' },
			{ key: 'rdv30', label: '30 RDV en 1 mois', emoji: '📈' },
			{ key: 'ca30', label: '30 000 € de CA en 1 mois', emoji: '🏆' }
		]
	},
	// Formations sur les familles du catalogue (même liste que le select
	// « Projet » du nouveau contact) : technique et commercial. Rendu en grille
	// avec un rond par élément (un arbre horizontal de 14 nœuds serait illisible).
	{
		key: 'formation_technique',
		label: 'Formation technique',
		emoji: '🛠️',
		steps: [
			{ key: 'photovoltaique', label: 'Photovoltaïque', emoji: '☀️' },
			{ key: 'batterie', label: 'Batterie', emoji: '🔋' },
			{ key: 'borne_recharge', label: 'Borne de recharge', emoji: '🔌' },
			{ key: 'pac', label: 'PAC air / eau', emoji: '♨️' },
			{ key: 'climatisation', label: 'Climatisation air / air', emoji: '❄️' },
			{ key: 'ballon_thermo', label: 'Ballon thermodynamique', emoji: '🌡️' },
			{ key: 'chauffe_eau', label: 'Chauffe-eau électrique', emoji: '🚿' },
			{ key: 'sanitaire', label: 'Sanitaire / ventilation / électricité', emoji: '🔧' },
			{ key: 'toiture', label: 'Toiture', emoji: '🏠' },
			{ key: 'facade', label: 'Façade', emoji: '🧱' },
			{ key: 'combles', label: 'Combles & charpente', emoji: '🪜' },
			{ key: 'pergola', label: 'Pergola & carport', emoji: '🏖️' },
			{ key: 'portes', label: "Portes d'entrée", emoji: '🚪' },
			{ key: 'menuiseries', label: 'Menuiseries & fermetures', emoji: '🪟' }
		]
	},
	{
		key: 'formation_theorique',
		label: 'Formations commerciales',
		emoji: '💼',
		steps: [
			{ key: 'photovoltaique', label: 'Photovoltaïque', emoji: '☀️' },
			{ key: 'batterie', label: 'Batterie', emoji: '🔋' },
			{ key: 'borne_recharge', label: 'Borne de recharge', emoji: '🔌' },
			{ key: 'pac', label: 'PAC air / eau', emoji: '♨️' },
			{ key: 'climatisation', label: 'Climatisation air / air', emoji: '❄️' },
			{ key: 'ballon_thermo', label: 'Ballon thermodynamique', emoji: '🌡️' },
			{ key: 'chauffe_eau', label: 'Chauffe-eau électrique', emoji: '🚿' },
			{ key: 'sanitaire', label: 'Sanitaire / ventilation / électricité', emoji: '🔧' },
			{ key: 'toiture', label: 'Toiture', emoji: '🏠' },
			{ key: 'facade', label: 'Façade', emoji: '🧱' },
			{ key: 'combles', label: 'Combles & charpente', emoji: '🪜' },
			{ key: 'pergola', label: 'Pergola & carport', emoji: '🏖️' },
			{ key: 'portes', label: "Portes d'entrée", emoji: '🚪' },
			{ key: 'menuiseries', label: 'Menuiseries & fermetures', emoji: '🪟' }
		]
	},
	// Technique de ventes : modules du book de formation commercial (TAP déjà
	// couvert par la tram de prospection ; qualification, découverte et
	// fondamentaux du RDV retirés). Rendu en arbre de ronds comme la tram.
	{
		key: 'technique_ventes',
		label: 'Technique de ventes',
		emoji: '🎯',
		steps: [
			{ key: 'deroule_rdv', label: "Déroulé d'un RDV", emoji: '🗓️' },
			{ key: 'catalogue', label: 'Le catalogue', emoji: '📖' },
			{ key: 'deballe_fi', label: 'Déballe FI', emoji: '💶' },
			{ key: 'deballe_solaire', label: 'Déballe Solaire', emoji: '☀️' },
			{ key: 'objections', label: 'Objections', emoji: '🛡️' },
			{ key: 'do', label: 'DO', emoji: '🤝' },
			{ key: 'conforte', label: 'Conforte', emoji: '😌' }
		]
	}
] as const;

export type TreeKey = (typeof TREES)[number]['key'];
export type ProgressionStep = (typeof TREES)[number]['steps'][number];
