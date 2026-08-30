export type ZoneGeometry = { type: 'Polygon'; coordinates: number[][][] };

export type Zone = {
	id: string;
	name: string;
	lastProspected: string | null;
	createdAt: number;
	geometry: ZoneGeometry;
};
