import polygonClipping from 'polygon-clipping';
import type { ZoneGeometry } from './types.js';

// Fusion géométrique de zones : on calcule l'union réelle des polygones.
// Si l'union produit plusieurs morceaux disjoints, on garde le plus grand
// (une zone reste un unique polygone, cohérent avec le reste de l'app).

type Ring = [number, number][];

function ringArea(ring: Ring): number {
	let area = 0;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		area += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
	}
	return Math.abs(area / 2);
}

function isPolygon(g: ZoneGeometry | null | undefined): g is ZoneGeometry {
	return (
		!!g && g.type === 'Polygon' && Array.isArray(g.coordinates) && g.coordinates[0]?.length >= 3
	);
}

export function unionZones(geometries: (ZoneGeometry | null | undefined)[]): ZoneGeometry | null {
	const valid = geometries.filter(isPolygon);
	if (valid.length === 0) return null;
	// Un seul polygone : rien à calculer.
	if (valid.length === 1) return valid[0];
	try {
		const polygons = valid.map((g) => [g.coordinates] as unknown as Ring[][]);
		const result = polygonClipping.union(
			polygons[0] as never,
			...(polygons.slice(1) as never[])
		) as unknown as Ring[][];
		if (!result.length) return null;
		let best = result[0];
		let bestArea = ringArea(best[0]);
		for (const poly of result) {
			const area = ringArea(poly[0]);
			if (area > bestArea) {
				bestArea = area;
				best = poly;
			}
		}
		return { type: 'Polygon', coordinates: best as unknown as number[][][] };
	} catch {
		return null;
	}
}
