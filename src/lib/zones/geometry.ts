import type { ZoneGeometry } from './types.js';

// Ray casting : point dans un polygone (anneau extérieur GeoJSON).
export function pointInPolygon(lng: number, lat: number, polygon: ZoneGeometry): boolean {
	const ring = polygon.coordinates[0];
	if (!ring || ring.length < 3) return false;
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const xi = ring[i][0];
		const yi = ring[i][1];
		const xj = ring[j][0];
		const yj = ring[j][1];
		const intersect =
			yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
		if (intersect) inside = !inside;
	}
	return inside;
}