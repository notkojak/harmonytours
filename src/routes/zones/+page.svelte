<script lang="ts">
	import { onMount } from 'svelte';
	import { env } from '$env/dynamic/public';
	import {
		Check,
		Lock,
		Map as MapIcon,
		Pencil,
		Plus,
		Search,
		Trash2,
		TriangleAlert,
		Unlock,
		X
	} from '@lucide/svelte';
	import { useQuery, useMutation } from 'convex-svelte';
	import { api } from '../../convex/_generated/api.js';
	import { authState } from '$lib/auth-state.svelte';
	import { canAccessAdministration } from '$lib/data/roles';
	import type { Map as MapboxMap, MapMouseEvent, GeoJSONSource } from 'mapbox-gl';
	import type MapboxDraw from '@mapbox/mapbox-gl-draw';
	import type { Feature, FeatureCollection } from 'geojson';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import type { Zone } from '$lib/zones/types.js';
	import {
		todayISO,
		formatDate,
		daysUntilReProspect,
		nextProspectionDateISO,
		isOlderThanSixMonths
	} from '$lib/zones/dates.js';
	import { getDrawStyles, getZoneFillExpression } from '$lib/zones/drawStyles.js';
	import {
		COLOR_OLD,
		DEFAULT_ZONE_COLOR,
		ZONE_PALETTE,
		STYLE_URL,
		LIGHT_STYLE_URL,
		FILL_OPACITY,
		zoneDisplayColor
	} from '$lib/zones/colors.js';
	import { getTheme } from '$lib/theme';
	import { drawing, editing, selectedZoneId } from '$lib/zones/ui.js';
	import { pointInPolygon } from '$lib/zones/geometry.js';

	import 'mapbox-gl/dist/mapbox-gl.css';
	import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

	// Code de déverrouillage de l'édition (identique au projet map).
	const CODE_EDITION = 'harmopierre';

	// Les managers (administrateur, directeur de zone, directeur d'agence) ont
	// l'édition déverrouillée d'office, sans code. Les autres doivent saisir le code.
	const profile = useQuery(api.users.getProfile, () => (authState.isAuthenticated ? {} : 'skip'));
	const isManager = $derived(canAccessAdministration(profile.data?.role));

	$effect(() => {
		if (profile.data && canAccessAdministration(profile.data.role)) {
			editing.set(true);
		}
	});

	// Zones stockées dans Convex (table `zones`).
	const zonesQuery = useQuery(api.zones.list, () => (authState.isAuthenticated ? {} : 'skip'));
	const upsertZone = useMutation(api.zones.upsert);
	const removeZone = useMutation(api.zones.remove);

	// Pins « GMS » (grandes surfaces en cours).
	const gmsQuery = useQuery(api.gms.list, () => (authState.isAuthenticated ? {} : 'skip'));
	const upsertGms = useMutation(api.gms.upsert);
	const removeGms = useMutation(api.gms.remove);
	let actionError = $state('');

	const zoneList = $derived(
		(zonesQuery.data ?? []).map((z) => ({
			id: z.externalId,
			name: z.name,
			lastProspected: z.lastProspected ?? null,
			createdAt: z.createdAt,
			geometry: z.geometry,
			color: z.color ?? null,
			greenWhenOld: z.greenWhenOld ?? false
		}))
	);
	const zonesErrorMessage = $derived(zonesQuery.error?.message ?? actionError ?? '');

	let container: HTMLDivElement | undefined = $state();
	let map = $state<MapboxMap | null>(null);
	let draw: MapboxDraw | null = null;
	let drawReady = $state(false);
	let syncing = false;
	let noToken = $state(false);
	let selectedId = $state<string | null>(null);
	let modalOpen = $state(false);
	let code = $state('');
	let codeError = $state(false);

	// État des pins GMS.
	let placingGms = $state(false);
	let gmsDialogOpen = $state(false);
	let gmsLabel = $state('');
	let gmsCoords = $state<[number, number] | null>(null);
	let gmsSelected = $state<string | null>(null);
	let gmsMarkers: any[] = [];
	let mapboxglCtor: any = null;

	// --- Création / édition d'une zone (nom + couleur + option « 6 mois ») ---
	let zoneDialogOpen = $state(false);
	let zoneFormId = $state<string | null>(null);
	let zoneFormName = $state('');
	let zoneFormColor = $state(DEFAULT_ZONE_COLOR);
	let zoneFormGreenWhenOld = $state(true);
	// Feature Mapbox Draw d'une nouvelle zone, en attente de validation (nom +
	// couleur) avant enregistrement dans Convex.
	let pendingDraw = $state<{ drawId: string; geometry: Zone['geometry'] } | null>(null);

	// --- Recherche de ville (géocodage Mapbox) qui cadre la carte ---
	let cityQuery = $state('');
	let citySuggestions = $state<
		{ label: string; center: [number, number]; bbox: [number, number, number, number] | null }[]
	>([]);
	let cityOpen = $state(false);
	let cityTimer: ReturnType<typeof setTimeout> | undefined;
	let citySearching = $state(false);

	const gmsList = $derived(gmsQuery.data ?? []);
	const zoneCount = $derived(zoneList.length);
	const selectedZone = $derived(zoneList.find((z) => z.id === selectedId) ?? null);
	// GMS situées dans la zone sélectionnée.
	const selectedZoneGms = $derived(
		selectedZone
			? gmsList.filter((g) => pointInPolygon(g.longitude, g.latitude, selectedZone.geometry))
			: []
	);

	// Synchronise la carte avec les zones chargées depuis Convex : dès que la
	// liste change (ou que la carte/dessin est prêt), on met à jour le rendu.
	$effect(() => {
		if (map && drawReady) syncStoreToDraw(zoneList);
		updateRenderAndLabels(zoneList);
	});

	// Met à jour les pins GMS dès que la liste change (ou que la carte est prête).
	$effect(() => {
		if (map && mapboxglCtor) updateGmsMarkers();
	});

	// Si le formulaire se ferme sans enregistrement (croix, clic extérieur…), on
	// supprime le tracé non validé pour ne pas laisser de polygone orphelin.
	$effect(() => {
		if (!zoneDialogOpen && pendingDraw) {
			const { drawId } = pendingDraw;
			pendingDraw = null;
			syncing = true;
			draw?.delete(drawId);
			setTimeout(() => {
				syncing = false;
			}, 0);
		}
	});

	function zoneToFeature(z: Zone): Feature {
		return {
			type: 'Feature',
			id: z.id,
			properties: {
				name: z.name,
				lastProspected: z.lastProspected,
				color: zoneDisplayColor(z),
				greenWhenOld: z.greenWhenOld
			},
			geometry: z.geometry
		};
	}

	function toFeatureCollection(features: Feature[]): FeatureCollection {
		return { type: 'FeatureCollection', features };
	}

	function defaultZoneName(): string {
		return `Zone ${zoneList.length + 1}`;
	}

	function centroidOf(geometry: Zone['geometry']): [number, number] {
		const ring = geometry.coordinates[0];
		let x = 0;
		let y = 0;
		for (const point of ring) {
			x += point[0];
			y += point[1];
		}
		return [x / ring.length, y / ring.length];
	}

	const CHAR_W = 7.6;
	const LINE_H = 14 * 1.4;
	const LABEL_MARGIN = 16;

	function zoneScreenBounds(z: Zone) {
		if (!map) return { width: 0, height: 0 };
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		for (const ring of z.geometry.coordinates) {
			for (const point of ring) {
				const p = map.project(point as [number, number]);
				if (p.x < minX) minX = p.x;
				if (p.x > maxX) maxX = p.x;
				if (p.y < minY) minY = p.y;
				if (p.y > maxY) maxY = p.y;
			}
		}
		return { width: maxX - minX, height: maxY - minY };
	}

	function textPixelSize(label: string) {
		const lines = label.split('\n');
		const width = Math.max(...lines.map((l) => l.length * CHAR_W));
		const height = lines.length * LINE_H;
		return { width, height };
	}

	function labelFits(z: Zone, label: string): boolean {
		if (!map) return true;
		const { width, height } = zoneScreenBounds(z);
		const { width: tw, height: th } = textPixelSize(label);
		return tw + LABEL_MARGIN <= width && th + LABEL_MARGIN <= height;
	}

	function buildLabels(list: Zone[]): FeatureCollection {
		const features: Feature[] = list
			.filter((z) => z.geometry && z.geometry.type === 'Polygon')
			.map((z): Feature => {
				// Sur la carte, on n'affiche que le titre de la zone.
				const label = z.name;
				return {
					type: 'Feature',
					properties: {
						label,
						color: zoneDisplayColor(z),
						show: labelFits(z, label) ? 1 : 0
					},
					geometry: { type: 'Point', coordinates: centroidOf(z.geometry) }
				};
			});
		return toFeatureCollection(features);
	}

	function refreshLabels() {
		if (!map) return;
		const src = map.getSource('zone-labels') as GeoJSONSource | undefined;
		if (!src) return;
		src.setData(buildLabels(zoneList));
	}

	let visibilityTimer: ReturnType<typeof setTimeout> | undefined;
	function onMapMove() {
		if (visibilityTimer) return;
		visibilityTimer = setTimeout(() => {
			visibilityTimer = undefined;
			refreshLabels();
		}, 120);
	}

	function saveZone(zone: Parameters<typeof upsertZone>[0]) {
		upsertZone(zone).catch((err) => {
			actionError =
				err instanceof Error ? err.message : "Erreur lors de l'enregistrement de la zone.";
		});
	}

	function deleteZone(id: string) {
		removeZone({ id }).catch((err) => {
			actionError =
				err instanceof Error ? err.message : 'Erreur lors de la suppression de la zone.';
		});
	}

	function handleCreate(e: { features: any[] }) {
		const f = e.features[0];
		if (!f) return;
		// Le tracé est conservé en attente : on demande le nom et la couleur avant
		// de créer la zone dans Convex.
		pendingDraw = { drawId: String(f.id), geometry: f.geometry };
		zoneFormId = null;
		zoneFormName = defaultZoneName();
		zoneFormColor = DEFAULT_ZONE_COLOR;
		zoneFormGreenWhenOld = true;
		zoneDialogOpen = true;
	}

	function handleUpdate(e: { features: any[] }) {
		const f = e.features[0];
		if (!f) return;
		const existing = zoneList.find((z) => z.id === String(f.id)) ?? null;
		if (!existing) return;
		syncing = true;
		saveZone({
			id: existing.id,
			name: existing.name,
			lastProspected: existing.lastProspected ?? undefined,
			createdAt: existing.createdAt,
			geometry: f.geometry,
			color: existing.color ?? undefined,
			greenWhenOld: existing.greenWhenOld
		});
		setTimeout(() => {
			syncing = false;
		}, 0);
	}

	// Ouvre le formulaire d'édition d'une zone existante (nom, couleur, option).
	function openZoneEdit(z: Zone) {
		pendingDraw = null;
		zoneFormId = z.id;
		zoneFormName = z.name;
		zoneFormColor = z.color ?? DEFAULT_ZONE_COLOR;
		zoneFormGreenWhenOld = z.greenWhenOld;
		zoneDialogOpen = true;
	}

	// Valide le formulaire : crée la zone (tracé en attente) ou met à jour une
	// zone existante (nom, couleur, option « 6 mois »).
	function submitZoneForm() {
		const name = zoneFormName.trim() || defaultZoneName();
		if (zoneFormId) {
			const z = zoneList.find((x) => x.id === zoneFormId);
			if (z) {
				saveZone({
					id: z.id,
					name,
					lastProspected: z.lastProspected ?? undefined,
					createdAt: z.createdAt,
					geometry: z.geometry,
					color: zoneFormColor,
					greenWhenOld: zoneFormGreenWhenOld
				});
			}
		} else if (pendingDraw) {
			const id = crypto.randomUUID();
			const date = todayISO();
			syncing = true;
			draw?.delete(pendingDraw.drawId);
			draw?.add({
				type: 'Feature',
				id,
				properties: {
					name,
					lastProspected: date,
					color: zoneFormColor,
					greenWhenOld: zoneFormGreenWhenOld
				},
				geometry: pendingDraw.geometry
			} as Feature);
			saveZone({
				id,
				name,
				lastProspected: date,
				createdAt: Date.now(),
				geometry: pendingDraw.geometry,
				color: zoneFormColor,
				greenWhenOld: zoneFormGreenWhenOld
			});
			pendingDraw = null;
			setTimeout(() => {
				syncing = false;
			}, 0);
		}
		zoneDialogOpen = false;
	}

	// Annule le formulaire : la fermeture déclenche le nettoyage du tracé.
	function cancelZoneForm() {
		zoneDialogOpen = false;
	}

	// --- Recherche de ville (géocodage Mapbox) et cadrage de la carte ---
	async function fetchCitySuggestions(query: string) {
		if (!env.PUBLIC_MAPBOX_TOKEN) return;
		citySearching = true;
		try {
			const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
				query
			)}.json?types=place&country=fr&limit=5&language=fr&access_token=${env.PUBLIC_MAPBOX_TOKEN}`;
			const res = await fetch(url);
			if (!res.ok) throw new Error('geocoding failed');
			const data = (await res.json()) as {
				features?: { place_name?: string; center?: [number, number]; bbox?: number[] }[];
			};
			citySuggestions = (data.features ?? [])
				.filter((f) => f.center)
				.map((f) => ({
					label: (f.place_name ?? '').replace(/, France$/, ''),
					center: f.center as [number, number],
					bbox: f.bbox && f.bbox.length === 4 ? (f.bbox as [number, number, number, number]) : null
				}));
			cityOpen = citySuggestions.length > 0;
		} catch {
			citySuggestions = [];
			cityOpen = false;
		} finally {
			citySearching = false;
		}
	}

	function onCityInput(e: Event) {
		cityQuery = (e.currentTarget as HTMLInputElement).value;
		clearTimeout(cityTimer);
		citySuggestions = [];
		cityOpen = false;
		const q = cityQuery.trim();
		if (q.length < 2) return;
		cityTimer = setTimeout(() => fetchCitySuggestions(q), 300);
	}

	// Centre la carte sur la ville choisie (zoom adapté à sa taille).
	function pickCity(s: {
		center: [number, number];
		bbox: [number, number, number, number] | null;
	}) {
		if (!map) return;
		if (s.bbox) {
			map.fitBounds(
				[
					[s.bbox[0], s.bbox[1]],
					[s.bbox[2], s.bbox[3]]
				],
				{ padding: 60, duration: 900, maxZoom: 13 }
			);
		} else {
			map.flyTo({ center: s.center, zoom: 11, duration: 900 });
		}
		citySuggestions = [];
		cityOpen = false;
		cityQuery = '';
	}

	function handleDelete(e: { features: any[] }) {
		syncing = true;
		for (const f of e.features) {
			const id = String(f.id);
			// On ignore le tracé en attente de validation (pas encore créé).
			if (zoneList.some((z) => z.id === id)) deleteZone(id);
			if (selectedId === f.id) selectedId = null;
		}
		setTimeout(() => {
			syncing = false;
		}, 0);
	}

	function handleModeChange(e: { mode: string }) {
		drawing.set(e.mode === 'draw_polygon');
	}

	function handleSelection(e: { features: any[] }) {
		const id = e.features.length ? e.features[0].id : null;
		selectedZoneId.set(id ? String(id) : null);
		selectedId = id ? String(id) : null;
	}

	function syncStoreToDraw(list: Zone[]) {
		if (!drawReady || syncing || !draw) return;
		const inDraw = new Map<string, any>(draw.getAll().features.map((f) => [String(f.id), f]));
		for (const z of list) {
			const f = inDraw.get(z.id);
			if (!f) {
				draw.add(zoneToFeature(z));
				continue;
			}
			if (f.properties.lastProspected !== z.lastProspected) {
				draw.setFeatureProperty(z.id, 'lastProspected', z.lastProspected);
			}
			if (f.properties.name !== z.name) {
				draw.setFeatureProperty(z.id, 'name', z.name);
			}
			const displayColor = zoneDisplayColor(z);
			if (f.properties.color !== displayColor) {
				draw.setFeatureProperty(z.id, 'color', displayColor);
			}
			if (f.properties.greenWhenOld !== z.greenWhenOld) {
				draw.setFeatureProperty(z.id, 'greenWhenOld', z.greenWhenOld);
			}
		}
		for (const [id] of inDraw) {
			if (!list.some((z) => z.id === id)) draw.delete(id);
		}
	}

	function updateRenderAndLabels(list: Zone[]) {
		if (!map) return;
		const renderSrc = map.getSource('zones-render') as GeoJSONSource | undefined;
		if (renderSrc) {
			renderSrc.setData(
				toFeatureCollection(
					list
						.filter((z) => z.geometry && z.geometry.type === 'Polygon')
						.map((z): Feature => ({
							type: 'Feature',
							id: z.id,
							properties: {
								id: z.id,
								name: z.name,
								lastProspected: z.lastProspected,
								color: zoneDisplayColor(z),
								greenWhenOld: z.greenWhenOld
							},
							geometry: z.geometry
						}))
				)
			);
		}
		const labelsSrc = map.getSource('zone-labels') as GeoJSONSource | undefined;
		if (labelsSrc) {
			try {
				labelsSrc.setData(buildLabels(list));
			} catch (err) {
				console.error('zone-labels update failed', err);
			}
		}
	}

	function ensureDraw(isEditing: boolean) {
		if (!map || !draw) return;
		if (isEditing) {
			if (!drawReady) {
				map.addControl(draw, 'top-right');
				drawReady = true;
				if (zoneList.length) {
					draw.add(toFeatureCollection(zoneList.map(zoneToFeature)));
				}
				if (map.getLayer('zone-labels')) map.moveLayer('zone-labels');
			}
			draw.changeMode('simple_select');
		} else {
			if (drawReady) {
				map.removeControl(draw);
				drawReady = false;
				drawing.set(false);
			}
			selectedId = null;
			placingGms = false;
			if (map) map.getCanvas().style.cursor = '';
		}
	}

	function handleMapClick(e: MapMouseEvent) {
		if (placingGms) {
			placingGms = false;
			if (map) map.getCanvas().style.cursor = '';
			gmsCoords = [e.lngLat.lng, e.lngLat.lat];
			gmsLabel = '';
			gmsDialogOpen = true;
			return;
		}
		if ($drawing) {
			selectedId = null;
			return;
		}
		const layers = drawReady
			? ['zones-fill', 'gl-draw-polygon-fill.cold', 'gl-draw-polygon-fill.hot']
			: ['zones-fill'];
		const features = map?.queryRenderedFeatures(e.point, { layers }) ?? [];
		const f = features.find((x) => x.properties && x.properties.id);
		selectedId = f ? String(f.properties?.id) : null;
	}

	function zoneColor(z: Zone): string {
		return zoneDisplayColor(z);
	}

	// Statut d'une zone : plus de notion de « prospection en cours » (< 7 j).
	// Tant que la zone garde sa couleur (rouge ou perso), on indique simplement
	// quand elle redeviendra re-prospectable ; repassée en vert, elle l'est.
	function zoneStatus(z: Zone): string {
		if (z.greenWhenOld && isOlderThanSixMonths(z.lastProspected)) return 'Re-prospectable';
		const days = daysUntilReProspect(z.lastProspected);
		if (days === null) return 'Date inconnue';
		return days <= 0
			? 'Re-prospectable'
			: `Re-prospectable dans ${days} jour${days > 1 ? 's' : ''}`;
	}

	function deleteSelected() {
		if (!selectedId) return;
		deleteZone(selectedId);
		selectedId = null;
	}

	function startDrawing() {
		draw?.changeMode('draw_polygon');
	}

	// --- Pins GMS (grandes surfaces en cours) ---

	function makeGmsElement(g: { externalId: string; label: string }): HTMLElement {
		const el = document.createElement('div');
		el.className = 'gms-pin';
		el.textContent = '🏪';
		el.title = g.label;
		el.addEventListener('click', (ev) => {
			ev.stopPropagation();
			openGmsEdit(g.externalId);
		});
		return el;
	}

	function updateGmsMarkers() {
		if (!map || !mapboxglCtor) return;
		for (const m of gmsMarkers) m.remove();
		gmsMarkers = [];
		for (const g of gmsList) {
			const marker = new mapboxglCtor.Marker({ element: makeGmsElement(g), anchor: 'bottom' })
				.setLngLat([g.longitude, g.latitude])
				.addTo(map);
			gmsMarkers.push(marker);
		}
	}

	function startPlacingGms() {
		placingGms = !placingGms;
		if (map) map.getCanvas().style.cursor = placingGms ? 'crosshair' : '';
	}

	function openGmsEdit(id: string) {
		const g = gmsList.find((x) => x.externalId === id);
		if (!g) return;
		gmsSelected = id;
		gmsLabel = g.label;
		gmsCoords = null;
		gmsDialogOpen = true;
	}

	function saveGms() {
		const label = gmsLabel.trim();
		if (!label) return;
		if (gmsSelected) {
			const g = gmsList.find((x) => x.externalId === gmsSelected);
			if (g) {
				upsertGms({
					id: g.externalId,
					label,
					latitude: g.latitude,
					longitude: g.longitude,
					createdAt: g.createdAt
				});
			}
		} else if (gmsCoords) {
			upsertGms({
				id: crypto.randomUUID(),
				label,
				latitude: gmsCoords[1],
				longitude: gmsCoords[0],
				createdAt: Date.now()
			});
		}
		gmsDialogOpen = false;
		gmsSelected = null;
		gmsCoords = null;
		gmsLabel = '';
	}

	function deleteGms() {
		if (!gmsSelected) return;
		removeGms({ id: gmsSelected });
		gmsDialogOpen = false;
		gmsSelected = null;
	}

	function submitCode() {
		if (code === CODE_EDITION) {
			editing.set(true);
			codeError = false;
			modalOpen = false;
		} else {
			codeError = true;
		}
	}

	function lockMode() {
		editing.set(false);
		modalOpen = false;
	}

	onMount(() => {
		let disposed = false;
		// Modules Mapbox chargés une seule fois (réutilisés à chaque remontage de
		// la carte au changement de thème) et observer de thème partagé.
		let mapboxglMod: any = null;
		let mapboxDrawMod: any = null;
		let themeObserver: MutationObserver | null = null;

		// Le bouton « édition » ajoute / retire le contrôle draw sur la carte
		// courante ; un seul abonnement survit aux remontages de la carte.
		editing.subscribe(ensureDraw);

		// Monte la carte Mapbox (fond + draw + couches) et renvoie l'instance.
		// Rejouée à chaque changement de thème pour appliquer le style clair / sombre.
		function mountMap(): MapboxMap | null {
			if (disposed || !container) return null;
			const isMobile = window.matchMedia('(max-width: 768px)').matches;
			const m = new mapboxglMod.Map({
				container,
				style: getTheme() === 'light' ? LIGHT_STYLE_URL : STYLE_URL,
				center: [0.6886, 47.3941],
				zoom: isMobile ? 7 : 9
			});
			map = m;

			m.on('load', () => {
				const d = new mapboxDrawMod({
					displayControlsDefault: false,
					controls: { polygon: true, trash: true },
					defaultMode: 'simple_select',
					userProperties: true,
					styles: getDrawStyles()
				});
				draw = d;

				m.on('draw.create', handleCreate);
				m.on('draw.update', handleUpdate);
				m.on('draw.delete', handleDelete);
				m.on('draw.modechange', handleModeChange);
				m.on('draw.selectionchange', handleSelection);
				m.on('move', onMapMove);
				m.on('moveend', refreshLabels);
				m.on('click', handleMapClick);

				ensureDraw($editing);

				m.addControl(new mapboxglMod.NavigationControl({ visualizePitch: false }), 'bottom-right');

				try {
					m.addSource('zones-render', {
						type: 'geojson',
						data: { type: 'FeatureCollection', features: [] }
					});
					m.addLayer({
						id: 'zones-fill',
						type: 'fill',
						source: 'zones-render',
						paint: {
							'fill-color': getZoneFillExpression(),
							'fill-outline-color': 'rgba(255, 255, 255, 0.85)',
							'fill-opacity': FILL_OPACITY
						}
					});
					m.addLayer({
						id: 'zones-outline',
						type: 'line',
						source: 'zones-render',
						paint: {
							'line-color': '#ffffff',
							'line-width': 2
						}
					});

					m.addSource('zone-labels', {
						type: 'geojson',
						data: { type: 'FeatureCollection', features: [] }
					});
					m.addLayer({
						id: 'zone-labels',
						type: 'symbol',
						source: 'zone-labels',
						filter: ['==', ['get', 'show'], 1],
						layout: {
							'text-field': ['get', 'label'],
							'text-size': 14,
							'text-line-height': 1.4,
							'text-anchor': 'center',
							'text-font': ['Open Sans Semibold', 'Open Sans Regular'],
							'text-allow-overlap': true,
							'text-ignore-placement': true,
							'text-optional': true
						},
						paint: {
							'text-color': '#ffffff',
							'text-halo-color': '#000000',
							'text-halo-width': 3
						}
					});
				} catch (err) {
					console.error('zone layers setup failed', err);
				}

				// Premier rendu des zones une fois les sources prêtes.
				updateRenderAndLabels(zoneList);
			});

			return m;
		}

		(async () => {
			const token = env.PUBLIC_MAPBOX_TOKEN;
			if (!token) {
				noToken = true;
				return;
			}

			// Import dynamique : mapbox-gl n'est pas compatible avec le rendu SSR.
			const [{ default: mapboxgl }, { default: MapboxDrawCtor }] = await Promise.all([
				import('mapbox-gl'),
				import('@mapbox/mapbox-gl-draw')
			]);
			if (disposed || !container) return;
			mapboxglMod = mapboxgl;
			mapboxDrawMod = MapboxDrawCtor;
			mapboxglCtor = mapboxgl;
			mapboxgl.accessToken = token;

			mountMap();

			// Bascule du thème : on recrée la carte (draw + couches) en conservant
			// le centre et le zoom.
			let currentLight = getTheme() === 'light';
			themeObserver = new MutationObserver(() => {
				const light = getTheme() === 'light';
				if (light === currentLight) return;
				currentLight = light;
				const center = map?.getCenter();
				const zoom = map?.getZoom();
				map?.remove();
				map = null;
				draw = null;
				drawReady = false;
				const next = mountMap();
				next?.once('load', () => {
					if (center) next.setCenter(center);
					if (zoom != null) next.setZoom(zoom);
				});
			});
			themeObserver.observe(document.documentElement, {
				attributes: true,
				attributeFilter: ['class']
			});
		})();

		return () => {
			disposed = true;
			themeObserver?.disconnect();
			map?.remove();
			map = null;
			draw = null;
			drawReady = false;
		};
	});
</script>

<div class="relative h-full min-h-[560px] overflow-hidden rounded-xl border border-line bg-card">
	{#if noToken}
		<div
			class="absolute top-4 left-1/2 z-20 w-[min(92%,420px)] -translate-x-1/2 rounded-xl border border-line bg-card2 p-4 text-center shadow-lg"
		>
			<p class="text-[13px] font-semibold text-foreground">Token Mapbox manquant</p>
			<p class="mt-1 text-[12px] leading-relaxed text-muted-foreground">
				Ajoute <code class="rounded bg-muted px-1 py-0.5 text-amber-400">PUBLIC_MAPBOX_TOKEN</code>
				au fichier <code class="rounded bg-muted px-1 py-0.5 text-amber-400">.env</code>
				(récupérable sur account.mapbox.com), puis relance
				<code class="rounded bg-muted px-1 py-0.5 text-amber-400">npm run dev</code>.
			</p>
		</div>
	{/if}

	<!-- Wrapper absolu : mapboxgl force `position: relative` sur le conteneur
		     (.mapboxgl-map), ce qui écraserait le `absolute inset-0` de Tailwind
		     et ferait s'effondrer la carte à 0 px de haut. -->
	<div class="absolute inset-0">
		<div class="h-full w-full" bind:this={container}></div>
	</div>

	<!-- Panneau latéral : actions + légende -->
	<aside
		class="absolute top-4 right-4 z-10 flex max-h-[calc(100%-2rem)] w-72 max-w-[calc(100%-2rem)] flex-col gap-3 overflow-y-auto overscroll-contain rounded-xl border border-line bg-surface/85 p-4 shadow-lg backdrop-blur"
	>
		<header class="flex items-center justify-between gap-2">
			<div class="flex min-w-0 items-center gap-2.5">
				<span
					class="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-card2 text-muted-foreground"
				>
					<MapIcon class="size-4" strokeWidth={1.7} />
				</span>
				<div class="min-w-0 leading-tight">
					<p class="truncate text-[13px] font-semibold text-foreground">Zones de prospection</p>
					<p class="text-[11px] font-medium text-muted-foreground">
						{zoneCount} zone{zoneCount > 1 ? 's' : ''}
					</p>
				</div>
			</div>
		</header>

		<!-- Recherche d'une ville : la carte se cale dessus -->
		<div class="relative">
			<Search
				class="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
				strokeWidth={1.7}
			/>
			<input
				type="search"
				value={cityQuery}
				oninput={onCityInput}
				onfocus={() => (cityOpen = citySuggestions.length > 0)}
				placeholder="Chercher une ville…"
				class="h-9 w-full rounded-lg border border-line bg-base pr-2.5 pl-8 text-[12px] text-foreground placeholder:text-muted-foreground focus:border-line focus:outline-none"
			/>
			{#if citySearching}
				<p class="px-0.5 pt-1 text-[11px] text-muted-foreground">Recherche…</p>
			{/if}
			{#if cityOpen}
				<div
					class="absolute z-20 mt-1 flex w-full flex-col overflow-hidden rounded-lg border border-line bg-card shadow-lg"
				>
					{#each citySuggestions as s (s.label)}
						<button
							type="button"
							class="truncate px-3 py-2 text-left text-[12px] text-foreground transition-colors hover:bg-glass-3"
							onclick={() => pickCity(s)}
						>
							{s.label}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		{#if zonesErrorMessage}
			<div
				class="flex flex-col gap-1 rounded-lg border border-rose-500/60 bg-rose-500/10 p-2.5 text-[11.5px] leading-relaxed"
			>
				<p class="flex items-center gap-1.5 font-semibold text-rose-400">
					<TriangleAlert class="size-3.5" strokeWidth={1.7} />
					Erreur
				</p>
				<p class="text-muted-foreground">{zonesErrorMessage}</p>
			</div>
		{/if}

		{#if $editing}
			<Button
				class="w-full bg-primary text-primary-foreground hover:bg-primary/80"
				onclick={startDrawing}
			>
				<Plus class="size-4" strokeWidth={2} />
				Nouvelle zone
			</Button>
		{/if}

		{#if $editing}
			<Button variant="outline" class="w-full" onclick={startPlacingGms}>
				<span class="text-[14px] leading-none">🏪</span>
				Ajouter une GMS
			</Button>
		{/if}

		{#if placingGms}
			<div
				class="rounded-lg border border-amber-500/50 bg-amber-500/10 p-2.5 text-[11.5px] leading-relaxed text-amber-400"
			>
				Clique sur la carte à l'emplacement de la GMS pour poser le pin 🏪.
			</div>
		{/if}

		{#if $drawing}
			<div
				class="rounded-lg border border-amber-500/50 bg-amber-500/10 p-2.5 text-[11.5px] leading-relaxed text-amber-400"
			>
				Clique sur la carte pour poser les points, puis double-clic pour fermer la zone.
			</div>
		{/if}

		<div
			class="hidden flex-col gap-1.5 rounded-lg border border-line bg-card2 p-2.5 text-[11.5px] sm:flex"
		>
			<div class="flex items-center gap-2 text-muted-foreground">
				<span class="size-2.5 shrink-0 rounded-full" style={`background:${DEFAULT_ZONE_COLOR}`}
				></span>
				Couleur personnalisée de la zone
			</div>
			<div class="flex items-center gap-2 text-muted-foreground">
				<span class="size-2.5 shrink-0 rounded-full" style={`background:${COLOR_OLD}`}></span>
				Repassée en vert après 6 mois
			</div>
		</div>

		<!-- GMS en cours : pins 🏪 avec leur intitulé -->
		{#if gmsList.length}
			<div class="flex flex-col gap-1.5 rounded-lg border border-line bg-card2 p-2.5">
				<p class="text-[10.5px] font-semibold tracking-wider text-muted-foreground uppercase">
					GMS en cours ({gmsList.length})
				</p>
				<div class="flex max-h-40 flex-col gap-1 overflow-y-auto pr-0.5">
					{#each gmsList as g (g.externalId)}
						<div class="flex items-center justify-between gap-2 rounded-md bg-base px-2 py-1">
							<span
								class="flex min-w-0 items-center gap-1.5 text-[12px] font-medium text-foreground"
							>
								<span class="shrink-0 text-[12px]">🏪</span>
								<span class="truncate">{g.label}</span>
							</span>
							{#if $editing}
								<button
									type="button"
									class="grid size-5.5 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-glass-3 hover:text-foreground"
									title="Modifier l'intitulé"
									onclick={() => openGmsEdit(g.externalId)}
								>
									<Pencil class="size-3.5" strokeWidth={1.7} />
								</button>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</aside>

	<!-- Fiche de la zone sélectionnée -->
	{#if selectedZone}
		{@const z = selectedZone}
		<div
			class="absolute top-4 left-4 z-10 flex w-72 max-w-[calc(100%-2rem)] flex-col gap-2.5 rounded-xl border border-line bg-surface/85 p-4 shadow-lg backdrop-blur"
		>
			<div class="flex items-start justify-between gap-2">
				<div class="flex min-w-0 items-center gap-2">
					<span
						class="size-3 shrink-0 rounded-full border border-white/40"
						style={`background:${zoneColor(z)}`}
					></span>
					<div class="min-w-0 leading-tight">
						<p class="truncate text-[13px] font-semibold text-foreground">{z.name}</p>
						<p class="text-[11px] font-medium text-muted-foreground">Zone de prospection</p>
					</div>
				</div>
				<div class="flex shrink-0 items-center gap-1">
					{#if $editing}
						<button
							type="button"
							class="grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-glass-3 hover:text-foreground"
							title="Modifier le nom et la couleur"
							onclick={() => openZoneEdit(z)}
						>
							<Pencil class="size-3.5" strokeWidth={1.7} />
						</button>
					{/if}
					<button
						type="button"
						class="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-glass-3 hover:text-foreground"
						title="Fermer"
						onclick={() => (selectedId = null)}
					>
						<X class="size-3.5" />
					</button>
				</div>
			</div>

			<div class="space-y-1.5 text-[12px]">
				<div class="flex items-center justify-between gap-3">
					<span class="text-muted-foreground">Dernière prospection</span>
					<span class="font-semibold text-foreground">{formatDate(z.lastProspected)}</span>
				</div>
				<div class="flex items-center justify-between gap-3">
					<span class="text-muted-foreground">Prochaine prospection</span>
					<span class="font-semibold text-foreground">
						{z.lastProspected ? formatDate(nextProspectionDateISO(z.lastProspected)) : '—'}
					</span>
				</div>
				<div class="flex items-center justify-between gap-3">
					<span class="text-muted-foreground">Statut</span>
					<span class="font-semibold" style={`color:${zoneColor(z)}`}>{zoneStatus(z)}</span>
				</div>
			</div>

			{#if selectedZoneGms.length}
				<div class="space-y-1.5 border-t border-line pt-2.5">
					<p class="text-[10.5px] font-semibold tracking-wider text-muted-foreground uppercase">
						GMS en cours ({selectedZoneGms.length})
					</p>
					{#each selectedZoneGms as g (g.externalId)}
						<div
							class="flex items-center justify-between gap-2 rounded-lg border border-line bg-card2 px-2.5 py-1.5"
						>
							<span
								class="flex min-w-0 items-center gap-1.5 text-[12px] font-medium text-foreground"
							>
								<span class="shrink-0 text-[13px]">🏪</span>
								<span class="truncate">{g.label}</span>
							</span>
							{#if $editing}
								<button
									type="button"
									class="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-glass-3 hover:text-foreground"
									title="Modifier l'intitulé"
									onclick={() => openGmsEdit(g.externalId)}
								>
									<Pencil class="size-3.5" strokeWidth={1.7} />
								</button>
							{/if}
						</div>
					{/each}
				</div>
			{/if}

			{#if $editing}
				<div class="space-y-2 border-t border-line pt-2.5">
					<div class="space-y-1">
						<Label class="text-[11px] font-medium text-muted-foreground">Dernière prospection</Label
						>
						<Input
							type="date"
							value={z.lastProspected ?? ''}
							oninput={(e) =>
								saveZone({
									id: z.id,
									name: z.name,
									lastProspected: e.currentTarget.value,
									createdAt: z.createdAt,
									geometry: z.geometry,
									color: z.color ?? undefined,
									greenWhenOld: z.greenWhenOld
								})}
							class="h-8 border-line bg-base text-[12px]"
						/>
					</div>
					<Button class="h-8 w-full bg-rose-600 hover:bg-rose-500" onclick={deleteSelected}>
						<Trash2 class="size-3.5" strokeWidth={1.7} />
						Supprimer le secteur
					</Button>
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- Déverrouillage / verrouillage de l'édition -->
<Dialog bind:open={modalOpen}>
	<DialogContent class="rounded-xl border-line bg-card sm:max-w-sm">
		<DialogHeader>
			<DialogTitle>{$editing ? 'Mode édition' : "Déverrouiller l'édition"}</DialogTitle>
			<DialogDescription>
				{#if $editing}
					L'édition est activée : tu peux créer, modifier et supprimer des zones.
				{:else}
					Entre le code pour activer l'édition des zones.
				{/if}
			</DialogDescription>
		</DialogHeader>

		{#if $editing}
			<Button class="w-full bg-violet-600 hover:bg-violet-500" onclick={lockMode}>
				<Lock class="size-4" strokeWidth={1.7} />
				Verrouiller (lecture seule)
			</Button>
		{:else if isManager}
			<Button
				class="w-full bg-violet-600 hover:bg-violet-500"
				onclick={() => {
					editing.set(true);
					modalOpen = false;
				}}
			>
				<Unlock class="size-4" strokeWidth={1.7} />
				Déverrouiller l'édition
			</Button>
		{:else}
			<div class="space-y-1.5">
				<Label for="zone-unlock-code">Code</Label>
				<Input
					id="zone-unlock-code"
					type="password"
					bind:value={code}
					placeholder="Code"
					class="border-line bg-base"
					onkeydown={(e) => {
						if (e.key === 'Enter') submitCode();
					}}
				/>
			</div>
			{#if codeError}
				<p class="text-[12px] font-medium text-destructive">Code incorrect</p>
			{/if}
			<DialogFooter class="gap-2">
				<Button variant="outline" onclick={() => (modalOpen = false)}>
					<X class="size-4" strokeWidth={1.7} />
					Annuler
				</Button>
				<Button class="bg-violet-600 hover:bg-violet-500" onclick={submitCode}>
					<Unlock class="size-4" strokeWidth={1.7} />
					Déverrouiller
				</Button>
			</DialogFooter>
		{/if}
	</DialogContent>
</Dialog>

<!-- Ajout / modification d'une GMS (pin 🏪) -->
<Dialog bind:open={gmsDialogOpen}>
	<DialogContent class="rounded-xl border-line bg-card sm:max-w-sm">
		<DialogHeader>
			<DialogTitle>{gmsSelected ? 'Modifier la GMS' : 'Ajouter une GMS'}</DialogTitle>
			<DialogDescription>
				{#if gmsSelected}
					Modifie l'intitulé de cette grande surface en cours.
				{:else}
					Donne un intitulé à cette grande surface (GMS en cours).
				{/if}
			</DialogDescription>
		</DialogHeader>

		<div class="space-y-1.5">
			<Label for="gms-label">Intitulé</Label>
			<Input
				id="gms-label"
				bind:value={gmsLabel}
				placeholder="Ex. Super U – Tours Nord"
				class="border-line bg-base"
				onkeydown={(e) => {
					if (e.key === 'Enter') saveGms();
				}}
			/>
		</div>

		<DialogFooter class="gap-2">
			{#if gmsSelected}
				<Button variant="outline" class="text-rose-500" onclick={deleteGms}>
					<Trash2 class="size-4" strokeWidth={1.7} />
					Supprimer
				</Button>
			{/if}
			<Button variant="outline" onclick={() => (gmsDialogOpen = false)}>
				<X class="size-4" strokeWidth={1.7} />
				Annuler
			</Button>
			<Button onclick={saveGms} disabled={!gmsLabel.trim()}>
				<Check class="size-4" strokeWidth={1.7} />
				Enregistrer
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

<!-- Création / édition d'une zone : nom + couleur + option « 6 mois » -->
<Dialog bind:open={zoneDialogOpen}>
	<DialogContent class="rounded-xl border-line bg-card sm:max-w-sm">
		<DialogHeader>
			<DialogTitle>{zoneFormId ? 'Modifier la zone' : 'Nouvelle zone'}</DialogTitle>
			<DialogDescription>Donne un nom à la zone et choisis sa couleur.</DialogDescription>
		</DialogHeader>

		<div class="space-y-3">
			<div class="space-y-1.5">
				<Label for="zone-name">Nom de la zone</Label>
				<Input
					id="zone-name"
					bind:value={zoneFormName}
					placeholder="Ex. Tours Nord"
					class="border-line bg-base"
					onkeydown={(e) => {
						if (e.key === 'Enter') submitZoneForm();
					}}
				/>
			</div>

			<div class="space-y-1.5">
				<Label>Couleur</Label>
				<div class="flex flex-wrap gap-2">
					{#each ZONE_PALETTE as c (c)}
						<button
							type="button"
							class="grid size-7 place-items-center rounded-full border-2 transition-transform hover:scale-110"
							class:border-white={zoneFormColor === c}
							class:border-transparent={zoneFormColor !== c}
							style={`background:${c}`}
							title={c}
							onclick={() => (zoneFormColor = c)}
						>
							{#if zoneFormColor === c}
								<Check class="size-3.5 text-white" strokeWidth={3} />
							{/if}
						</button>
					{/each}
				</div>
			</div>

			<label
				class="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line bg-card2 p-2.5"
			>
				<input
					type="checkbox"
					bind:checked={zoneFormGreenWhenOld}
					class="mt-0.5 size-4 accent-emerald-500"
				/>
				<span class="text-[12px] leading-snug text-muted-foreground">
					Repasser en vert après 6 mois sans prospection
				</span>
			</label>
		</div>

		<DialogFooter class="gap-2">
			<Button variant="outline" onclick={cancelZoneForm}>
				<X class="size-4" strokeWidth={1.7} />
				Annuler
			</Button>
			<Button onclick={submitZoneForm}>
				<Check class="size-4" strokeWidth={1.7} />
				Enregistrer
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

<style>
	/* Contrôles mapbox assortis au thème sombre Harmony */
	:global(.mapboxgl-ctrl-group) {
		background: #17171a !important;
		border: 1px solid #27272c !important;
		border-radius: 8px;
		box-shadow: none !important;
		overflow: hidden;
	}
	:global(.mapboxgl-ctrl-group button) {
		background-color: #17171a !important;
		border-bottom: 1px solid #27272c !important;
	}
	:global(.mapboxgl-ctrl-group button:hover) {
		background-color: #1e1e23 !important;
	}
	:global(.mapboxgl-ctrl-group button span) {
		background-color: transparent !important;
	}
	:global(.mapboxgl-ctrl-group .mapboxgl-ctrl-icon) {
		filter: invert(0.85);
	}
	:global(.mapboxgl-ctrl-logo),
	:global(.mapboxgl-ctrl-attrib) {
		display: none !important;
	}
	:global(.mapboxgl-canvas) {
		outline: none;
	}
	/* Pin GMS 🏪 : bulle avec pointe posée sur la carte */
	:global(.gms-pin) {
		position: relative;
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		background: #f59e0b; /* amber-500 */
		border: 2px solid rgba(255, 255, 255, 0.95);
		border-radius: 50%;
		box-shadow: 0 3px 8px rgba(0, 0, 0, 0.45);
		cursor: pointer;
		transform: translateY(-2px);
		transition: transform 0.15s ease;
		font-size: 16px;
		line-height: 1;
	}
	:global(.gms-pin::after) {
		content: '';
		position: absolute;
		bottom: -7px;
		left: 50%;
		width: 10px;
		height: 10px;
		background: #f59e0b;
		border-right: 2px solid rgba(255, 255, 255, 0.95);
		border-bottom: 2px solid rgba(255, 255, 255, 0.95);
		border-radius: 0 0 2px 0;
		transform: translateX(-50%) rotate(45deg);
	}
	:global(.gms-pin:hover) {
		transform: translateY(-2px) scale(1.15);
	}
</style>
