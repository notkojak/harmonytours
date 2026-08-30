import type { ExpressionSpecification } from 'mapbox-gl';
import { todayISO, sixMonthsAgoISO, addDaysISO } from './dates.js';
import {
	COLOR_RECENT,
	COLOR_OLD,
	COLOR_WARNING,
	COLOR_PROSPECTING,
	COLOR_OUTLINE,
	FILL_OPACITY,
	FILL_OPACITY_ACTIVE,
	OUTLINE_WIDTH
} from './colors.js';

// Expression Mapbox : couleur de remplissage selon l'ancienneté de la
// dernière prospection (prospection en cours < 7 j, plus de 6 mois, etc.).
export function getZoneFillExpression(): ExpressionSpecification {
	const prospectingThreshold = addDaysISO(todayISO(), -7);
	const oldThreshold = sixMonthsAgoISO();
	const warningThreshold = addDaysISO(oldThreshold, 32);
	const last = ['coalesce', ['get', 'user_lastProspected'], ['get', 'lastProspected']];
	return [
		'case',
		['>', last, prospectingThreshold],
		COLOR_PROSPECTING,
		['<', last, oldThreshold],
		COLOR_OLD,
		['<', last, warningThreshold],
		COLOR_WARNING,
		COLOR_RECENT
	] as unknown as ExpressionSpecification;
}

export function getDrawStyles() {
	const fillColor = getZoneFillExpression();

	return [
		{
			id: 'gl-draw-polygon-fill',
			type: 'fill',
			filter: ['all', ['==', '$type', 'Polygon']],
			paint: {
				'fill-color': fillColor,
				'fill-outline-color': 'rgba(255, 255, 255, 0.85)',
				'fill-opacity': [
					'case',
					['==', ['get', 'active'], 'true'],
					FILL_OPACITY_ACTIVE,
					FILL_OPACITY
				]
			}
		},
		{
			id: 'gl-draw-lines',
			type: 'line',
			filter: ['any', ['==', '$type', 'LineString'], ['==', '$type', 'Polygon']],
			layout: {
				'line-cap': 'round',
				'line-join': 'round'
			},
			paint: {
				'line-color': ['case', ['==', ['get', 'active'], 'true'], '#fbb03b', COLOR_OUTLINE],
				'line-dasharray': ['case', ['==', ['get', 'active'], 'true'], [0.2, 2], [2, 0]],
				'line-width': ['case', ['==', ['get', 'active'], 'true'], 2, OUTLINE_WIDTH]
			}
		},
		{
			id: 'gl-draw-point-outer',
			type: 'circle',
			filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'feature']],
			paint: {
				'circle-radius': ['case', ['==', ['get', 'active'], 'true'], 7, 5],
				'circle-color': '#ffffff'
			}
		},
		{
			id: 'gl-draw-point-inner',
			type: 'circle',
			filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'feature']],
			paint: {
				'circle-radius': ['case', ['==', ['get', 'active'], 'true'], 5, 3],
				'circle-color': ['case', ['==', ['get', 'active'], 'true'], '#fbb03b', '#f43f5e']
			}
		},
		{
			id: 'gl-draw-vertex-outer',
			type: 'circle',
			filter: [
				'all',
				['==', '$type', 'Point'],
				['==', 'meta', 'vertex'],
				['!=', 'mode', 'simple_select']
			],
			paint: {
				'circle-radius': ['case', ['==', ['get', 'active'], 'true'], 7, 5],
				'circle-color': '#ffffff'
			}
		},
		{
			id: 'gl-draw-vertex-inner',
			type: 'circle',
			filter: [
				'all',
				['==', '$type', 'Point'],
				['==', 'meta', 'vertex'],
				['!=', 'mode', 'simple_select']
			],
			paint: {
				'circle-radius': ['case', ['==', ['get', 'active'], 'true'], 5, 3],
				'circle-color': '#fbb03b'
			}
		},
		{
			id: 'gl-draw-midpoint',
			type: 'circle',
			filter: ['all', ['==', 'meta', 'midpoint']],
			paint: {
				'circle-radius': 3,
				'circle-color': '#fbb03b'
			}
		}
	];
}
