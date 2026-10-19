// Le territoire de l'agence : les quatre départements sur lesquels on pose.
// Sert à faire remonter les bonnes adresses dans les suggestions et à borner la
// recherche, pour qu'une saisie approximative ne parte pas à 500 km.

/**
 * Départements couverts, par ordre de priorité : 37, 86, 72 et 41. Le 37 étant
 * le département de l'agence, ses adresses passent devant.
 */
export const DEPARTEMENTS: readonly string[] = ['37', '86', '72', '41'];

/**
 * Boîte englobante des quatre départements (Indre-et-Loire, Vienne, Sarthe,
 * Loir-et-Cher). Volontairement large : elle encadre, elle ne découpe pas.
 */
export const BBOX_TERRITOIRE = {
	lonMin: -0.6,
	lonMax: 2.25,
	latMin: 46.05,
	latMax: 48.55
};

/**
 * Département d'un libellé d'adresse, déduit de son code postal. Les libellés de
 * la Base Adresse Nationale finissent par « … 37300 Joué-lès-Tours ».
 */
export function departementDe(libelle: string): string | null {
	const m = libelle.match(/\b(\d{2})\d{3}\b/);
	return m ? m[1] : null;
}

/** Une position tombe-t-elle dans la boîte du territoire ? */
export function dansLeTerritoire(lon: number, lat: number): boolean {
	return (
		lon >= BBOX_TERRITOIRE.lonMin &&
		lon <= BBOX_TERRITOIRE.lonMax &&
		lat >= BBOX_TERRITOIRE.latMin &&
		lat <= BBOX_TERRITOIRE.latMax
	);
}
