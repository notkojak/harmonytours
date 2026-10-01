import type { ZoneGeometry } from './types.js';
import { pointInPolygon } from './geometry.js';

// Communes « principales » d'une zone, via l'API Géo officielle
// (geo.api.gouv.fr). L'API ne renvoie que des communes : les lieux-dits sont
// donc exclus par construction. On filtre ensuite par population pour ne garder
// que les villages principaux, et on ne garde que ceux dont le centre tombe
// dans le polygone de la zone.

const GEO_API = 'https://geo.api.gouv.fr';

export type Commune = {
	code: string;
	nom: string;
	centre: [number, number];
	population: number;
};

function centroidOf(geometry: ZoneGeometry): [number, number] {
	const ring = geometry.coordinates[0];
	let x = 0;
	let y = 0;
	for (const point of ring) {
		x += point[0];
		y += point[1];
	}
	return [x / ring.length, y / ring.length];
}

async function departementOf(lng: number, lat: number): Promise<string | null> {
	try {
		const res = await fetch(
			`${GEO_API}/communes?lat=${lat}&lon=${lng}&fields=departement&format=json`
		);
		if (!res.ok) return null;
		const data = (await res.json()) as { departement?: { code?: string } }[];
		return data?.[0]?.departement?.code ?? null;
	} catch {
		return null;
	}
}

async function communesOfDepartement(code: string): Promise<Commune[]> {
	try {
		const res = await fetch(
			`${GEO_API}/departements/${code}/communes?fields=nom,centre,population&format=json`
		);
		if (!res.ok) return [];
		const data = (await res.json()) as {
			code?: string;
			nom?: string;
			centre?: { coordinates?: number[] };
			population?: number;
		}[];
		return (data ?? [])
			.filter((c) => Array.isArray(c.centre?.coordinates) && c.centre!.coordinates!.length === 2)
			.map((c) => ({
				code: c.code ?? '',
				nom: c.nom ?? '',
				centre: c.centre!.coordinates as [number, number],
				population: c.population ?? 0
			}));
	} catch {
		return [];
	}
}

// Renvoie, pour chaque zone fournie, la liste de ses communes principales
// (triées par population décroissante), indexée par l'id de la zone.
export async function fetchVillagesByZone(
	zones: { id: string; geometry: ZoneGeometry }[],
	minPopulation = 500
): Promise<Map<string, Commune[]>> {
	const result = new Map<string, Commune[]>();
	if (!zones.length) return result;

	// Un département par zone (via le centre du polygone), mis en cache pour
	// n'interroger l'API qu'une fois par département.
	const depCache = new Map<string, string | null>();
	const depByZone = new Map<string, string | null>();
	for (const z of zones) {
		const [lng, lat] = centroidOf(z.geometry);
		const key = `${lng},${lat}`;
		let dep = depCache.get(key);
		if (dep === undefined) {
			dep = await departementOf(lng, lat);
			depCache.set(key, dep);
		}
		depByZone.set(z.id, dep);
	}

	const communesCache = new Map<string, Commune[]>();
	for (const code of new Set([...depByZone.values()].filter((d): d is string => !!d))) {
		communesCache.set(code, await communesOfDepartement(code));
	}

	for (const z of zones) {
		const dep = depByZone.get(z.id);
		const communes = dep ? (communesCache.get(dep) ?? []) : [];
		const inside = communes.filter((c) => pointInPolygon(c.centre[0], c.centre[1], z.geometry));
		const main = inside.filter((c) => c.population >= minPopulation);
		// Si aucune commune n'atteint le seuil, on garde au moins les plus peuplées
		// pour ne pas renvoyer une liste vide.
		const kept = main.length ? main : inside.slice(0, 5);
		result.set(
			z.id,
			kept.sort((a, b) => b.population - a.population)
		);
	}

	return result;
}

export function formatPopulation(population: number): string {
	if (population >= 1000) return `${Math.round(population / 1000)}k hab.`;
	return `${population} hab.`;
}
