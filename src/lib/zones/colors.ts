import { isOlderThanSixMonths } from './dates.js';

// Couleur par défaut d'une nouvelle zone (rouge « à prospecter »).
export const DEFAULT_ZONE_COLOR = '#f43f5e';

// Vert appliqué automatiquement à une zone non re-prospectée depuis 6 mois.
export const COLOR_OLD = '#22c55e';

// Palette proposée pour choisir la couleur d'une zone.
export const ZONE_PALETTE = [
	'#f43f5e', // rouge
	'#f97316', // orange
	'#fbb03b', // ambre
	'#eab308', // jaune
	'#22c55e', // vert
	'#14b8a6', // turquoise
	'#3b82f6', // bleu
	'#8b5cf6', // violet
	'#ec4899', // rose
	'#64748b' // ardoise
];

export const COLOR_OUTLINE = '#ffffff';

export const FILL_OPACITY = 0.2;
export const FILL_OPACITY_ACTIVE = 0.3;
export const OUTLINE_WIDTH = 2;

export const STYLE_URL = 'mapbox://styles/mapbox/dark-v11';
export const LIGHT_STYLE_URL = 'mapbox://styles/mapbox/light-v11';

// Couleur affichée d'une zone : sa couleur personnalisée, sauf si l'option
// « repasser en vert après 6 mois » est activée et que la dernière
// prospection remonte à plus de 6 mois.
export function zoneDisplayColor(z: {
	color?: string | null;
	greenWhenOld?: boolean | null;
	lastProspected: string | null;
}): string {
	if (z.greenWhenOld && isOlderThanSixMonths(z.lastProspected)) return COLOR_OLD;
	return z.color ?? DEFAULT_ZONE_COLOR;
}
