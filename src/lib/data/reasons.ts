// Taxonomie des issues de RDV : les codes sont stockés dans la fiche (et
// agrégés dans la vue Direction), le commentaire libre reste possible à côté.
export const NON_VENTE_REASONS = [
	{ key: 'prix', label: 'Prix / budget' },
	{ key: 'financement', label: 'Financement refusé' },
	{ key: 'delai', label: 'Pas le bon moment' },
	{ key: 'concurrence', label: 'Déjà chez un concurrent' },
	{ key: 'conjoint', label: 'Décision à deux / conjoint' },
	{ key: 'projet_abandonne', label: 'Projet abandonné' },
	{ key: 'technique', label: 'Contrainte technique' },
	{ key: 'autre', label: 'Autre' }
] as const;

export const ANNULATION_REASONS = [
	{ key: 'indisponible', label: 'Client indisponible' },
	{ key: 'injoignable', label: 'Client injoignable' },
	{ key: 'report', label: 'Report demandé par le client' },
	{ key: 'erreur_planification', label: 'Erreur de planification' },
	{ key: 'annule_commercial', label: 'Annulé par le commercial' },
	{ key: 'autre', label: 'Autre' }
] as const;

export function reasonLabel(
	list: readonly { key: string; label: string }[],
	key: string | null | undefined
): string | null {
	if (!key) return null;
	return list.find((r) => r.key === key)?.label ?? key;
}
