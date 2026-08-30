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
	}
] as const;

export type TreeKey = (typeof TREES)[number]['key'];
export type ProgressionStep = (typeof TREES)[number]['steps'][number];
