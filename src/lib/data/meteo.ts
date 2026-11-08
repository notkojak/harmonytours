// Météo du jour à Tours, pour le bloc d'accueil du tableau de bord.
// Source : Open-Meteo (gratuit, sans clé). On garde le matin (9 h), l'après-midi
// (15 h) et le détail heure par heure de 9 h à 19 h, avec un emoji par créneau.

export type MeteoMoment = { temperature: number; emoji: string };
export type MeteoHeure = { heure: number; label: string; temperature: number; emoji: string };
export type MeteoJour = {
	matin: MeteoMoment;
	apresMidi: MeteoMoment;
	/** Créneaux horaires de 9 h à 19 h (bornes incluses). */
	heures: MeteoHeure[];
	/** Températures extrêmes de la journée de travail. */
	min: number;
	max: number;
};

/** Première et dernière heure affichées dans la frise météo. */
export const HEURE_DEBUT = 9;
export const HEURE_FIN = 19;

export const TOURS = { latitude: 47.3941, longitude: 0.6848 };

// Codes WMO utilisés par Open-Meteo → emoji le plus parlant.
export function emojiMeteo(code: number | null | undefined): string {
	if (code == null) return '🌡️';
	if (code === 0) return '☀️';
	if (code === 1) return '🌤️';
	if (code === 2) return '⛅';
	if (code === 3) return '☁️';
	// Brouillard / dépôt de givre : le glyphe couleur 🌫️ manque sur certains
	// systèmes (carré vide) et 🌁 est illisible en petit. Un nuage reste clair.
	if (code === 45 || code === 48) return '☁️';
	if ([51, 53, 55, 56, 57].includes(code)) return '🌦️';
	if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return '🌧️';
	if ([71, 73, 75, 77, 85, 86].includes(code)) return '🌨️';
	if ([95, 96, 99].includes(code)) return '⛈️';
	return '🌡️';
}

export async function chargerMeteoTours(): Promise<MeteoJour | null> {
	const url =
		'https://api.open-meteo.com/v1/forecast' +
		`?latitude=${TOURS.latitude}&longitude=${TOURS.longitude}` +
		'&hourly=temperature_2m,weather_code&timezone=Europe%2FParis&forecast_days=1';

	try {
		const res = await fetch(url);
		if (!res.ok) return null;
		const data = (await res.json()) as {
			hourly?: {
				time?: string[];
				temperature_2m?: (number | null)[];
				weather_code?: (number | null)[];
			};
		};

		const times = data.hourly?.time ?? [];
		const temperatures = data.hourly?.temperature_2m ?? [];
		const codes = data.hourly?.weather_code ?? [];

		const indexDe = (heure: number) => {
			const suffixe = `T${String(heure).padStart(2, '0')}:00`;
			const index = times.findIndex((t) => t.endsWith(suffixe));
			// Repli : les séries horaires commencent à minuit.
			return index >= 0 ? index : heure;
		};

		const lire = (index: number): MeteoMoment | null => {
			const temperature = temperatures[index];
			if (typeof temperature !== 'number') return null;
			return {
				temperature: Math.round(temperature),
				emoji: emojiMeteo(codes[index])
			};
		};

		const matin = lire(indexDe(9));
		const apresMidi = lire(indexDe(15));
		if (!matin || !apresMidi) return null;

		// Frise horaire 9 h → 19 h : chaque heure disponible devient une pastille.
		const heures: MeteoHeure[] = [];
		for (let heure = HEURE_DEBUT; heure <= HEURE_FIN; heure++) {
			const moment = lire(indexDe(heure));
			if (!moment) continue;
			heures.push({
				heure,
				label: `${String(heure).padStart(2, '0')}:00`,
				temperature: moment.temperature,
				emoji: moment.emoji
			});
		}

		const valeurs = heures.map((h) => h.temperature);
		if (valeurs.length === 0) return null;

		return {
			matin,
			apresMidi,
			heures,
			min: Math.min(...valeurs),
			max: Math.max(...valeurs)
		};
	} catch {
		return null;
	}
}

/**
 * Météo côté navigateur : on passe d'abord par le proxy same-origin
 * (`/api/meteo`, pas de CORS ni de blocage tiers), puis on retombe sur l'API
 * publique si le proxy n'est pas disponible (hébergement statique).
 */
export async function chargerMeteo(): Promise<MeteoJour | null> {
	try {
		// Pas de cache HTTP : la météo est rafraîchie périodiquement et on veut
		// tout de suite une éventuelle correction de mapping.
		const res = await fetch('/api/meteo', { cache: 'no-store' });
		if (res.ok) {
			const data = (await res.json()) as MeteoJour | null;
			// `heures` est requis : un payload à l'ancien format (matin / après-midi
			// seulement) est ignoré pour retenter l'appel direct ci-dessous.
			if (data?.matin && data?.apresMidi && data.heures?.length) return data;
		}
	} catch {
		// proxy indisponible → appel direct ci-dessous
	}
	return chargerMeteoTours();
}
