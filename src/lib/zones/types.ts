export type ZoneGeometry = { type: 'Polygon'; coordinates: number[][][] };

export type Zone = {
	id: string;
	name: string;
	lastProspected: string | null;
	createdAt: number;
	geometry: ZoneGeometry;
	// Couleur personnalisée du polygone (hex). `null` = couleur par défaut.
	color: string | null;
	// Repasse la zone en vert une fois la dernière prospection vieille de 6 mois.
	greenWhenOld: boolean;
	// Commercial affecté à la zone (id Convex users), `null` si non affectée.
	commercialId: string | null;
};
