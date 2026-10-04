<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { env } from '$env/dynamic/public';
	import {
		Camera,
		Check,
		Lock,
		Map as MapIcon,
		Maximize,
		Minimize,
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
	import type { Id } from '../../convex/_generated/dataModel.js';
	import { authState } from '$lib/auth-state.svelte';
	import { canAccessAdministration } from '$lib/data/roles';
	import type { Map as MapboxMap, MapMouseEvent, GeoJSONSource, Marker } from 'mapbox-gl';
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
		ZONE_RED,
		ZONE_PALETTE,
		STYLE_URL,
		LIGHT_STYLE_URL,
		FILL_OPACITY,
		zoneDisplayColor,
		isRedZone
	} from '$lib/zones/colors.js';
	import { getTheme } from '$lib/theme';
	import { drawing, editing, selectedZoneId } from '$lib/zones/ui.js';
	import { pointInPolygon } from '$lib/zones/geometry.js';
	import Avatar from '$lib/components/Avatar.svelte';

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

	// Employés (commerciaux) affectables à une zone, avec nom + photo.
	const peopleQuery = useQuery(api.access.listPeople, () =>
		authState.isAuthenticated ? {} : 'skip'
	);
	const people = $derived(peopleQuery.data ?? []);
	const personById = (id: string | null) => people.find((p) => p._id === id) ?? null;

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
			greenWhenOld: z.greenWhenOld ?? false,
			// Rétro-compat : ancien champ mono-commercial → tableau.
			commercialIds: z.commercialIds ?? (z.commercialId ? [z.commercialId] : [])
		}))
	);
	const zonesErrorMessage = $derived(zonesQuery.error?.message ?? actionError ?? '');

	let container: HTMLDivElement | undefined = $state();
	let wrapper: HTMLDivElement | undefined = $state();
	let map = $state<MapboxMap | null>(null);
	let draw: MapboxDraw | null = null;
	let drawReady = $state(false);
	let syncing = false;
	let noToken = $state(false);
	let selectedId = $state<string | null>(null);
	let modalOpen = $state(false);
	let code = $state('');
	let codeError = $state(false);

	// --- Mode capture : carte seule en plein écran, pour photographier les
	// zones sans aucun élément d'interface par-dessus ---
	let captureMode = $state(false);
	let captureUiVisible = $state(true);
	let captureUiTimer: ReturnType<typeof setTimeout> | undefined;
	// Pendant l'export PNG, une seconde capture est ignorée.
	let exporting = false;

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
	let zoneFormColor = $state(DEFAULT_ZONE_COLOR);
	let zoneFormGreenWhenOld = $state(true);
	let zoneFormCommercialIds = $state<string[]>([]);
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

	// --- Ancrage d'une zone ---
	// Le milieu d'un tracé n'est pas la moyenne de ses sommets : un côté
	// densément pointé (côte, tracé à main levée, reprise au lasso) attire la
	// moyenne et décentre le tag. On prend donc le vrai centre de gravité du
	// polygone (formule de l'aire) et, s'il tombe hors d'un tracé concave, le
	// point le plus « profond » à l'intérieur du tracé.
	// Cache volontairement non réactif : ce n'est pas un état d'interface, il ne
	// doit jamais déclencher de re-rendu (d'où le Map natif et non SvelteMap).
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const anchorCache = new Map<string, { geometry: Zone['geometry']; point: [number, number] }>();

	function zoneAnchor(z: Zone): [number, number] {
		const cached = anchorCache.get(z.id);
		if (cached && cached.geometry === z.geometry) return cached.point;
		const point = computeZoneAnchor(z.geometry);
		anchorCache.set(z.id, { geometry: z.geometry, point });
		return point;
	}

	function computeZoneAnchor(geometry: Zone['geometry']): [number, number] {
		const ring = geometry.coordinates[0];
		if (!ring || ring.length < 3) return [0, 0];
		const centroid = ringCentroid(ring);
		if (centroid && pointInPolygon(centroid[0], centroid[1], geometry)) return centroid;
		return deepestPoint(geometry, ring);
	}

	// Centre de gravité d'un anneau (formule du lacet).
	function ringCentroid(ring: number[][]): [number, number] | null {
		let twiceArea = 0;
		let x = 0;
		let y = 0;
		for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
			const [x0, y0] = ring[j];
			const [x1, y1] = ring[i];
			const cross = x0 * y1 - x1 * y0;
			twiceArea += cross;
			x += (x0 + x1) * cross;
			y += (y0 + y1) * cross;
		}
		if (Math.abs(twiceArea) < 1e-12) return null;
		return [x / (3 * twiceArea), y / (3 * twiceArea)];
	}

	// Distance d'un point au segment [a, b].
	function distanceToSegment(point: number[], a: number[], b: number[]): number {
		const dx = b[0] - a[0];
		const dy = b[1] - a[1];
		const lengthSq = dx * dx + dy * dy;
		let t = lengthSq === 0 ? 0 : ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lengthSq;
		t = clampNumber(t, 0, 1);
		return Math.hypot(point[0] - (a[0] + t * dx), point[1] - (a[1] + t * dy));
	}

	function distanceToRing(point: number[], ring: number[][]): number {
		let best = Infinity;
		for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
			const distance = distanceToSegment(point, ring[j], ring[i]);
			if (distance < best) best = distance;
		}
		return best;
	}

	// Point le plus éloigné des bords (approximation par grille resserrée) :
	// l'ancre reste ainsi à l'intérieur même pour un tracé concave.
	function deepestPoint(geometry: Zone['geometry'], ring: number[][]): [number, number] {
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		for (const [x, y] of ring) {
			if (x < minX) minX = x;
			if (x > maxX) maxX = x;
			if (y < minY) minY = y;
			if (y > maxY) maxY = y;
		}
		let centerX = (minX + maxX) / 2;
		let centerY = (minY + maxY) / 2;
		// Centre du cadre : départage plusieurs points à égale distance des bords
		// (forme en « C » par exemple) pour rester au milieu de la zone.
		const midX = centerX;
		const midY = centerY;
		let halfWidth = Math.max((maxX - minX) / 2, 1e-9);
		let halfHeight = Math.max((maxY - minY) / 2, 1e-9);
		let best: [number, number] = [centerX, centerY];
		let bestDistance = -1;
		let bestCenterDistance = Infinity;
		for (let iteration = 0; iteration < 5; iteration++) {
			const stepX = halfWidth / 4;
			const stepY = halfHeight / 4;
			for (let ix = -4; ix <= 4; ix++) {
				for (let iy = -4; iy <= 4; iy++) {
					const candidate: [number, number] = [centerX + ix * stepX, centerY + iy * stepY];
					if (!pointInPolygon(candidate[0], candidate[1], geometry)) continue;
					const distance = distanceToRing(candidate, ring);
					const centerDistance = Math.hypot(candidate[0] - midX, candidate[1] - midY);
					const better =
						distance > bestDistance + 1e-12 ||
						(Math.abs(distance - bestDistance) <= 1e-12 && centerDistance < bestCenterDistance);
					if (better) {
						bestDistance = distance;
						bestCenterDistance = centerDistance;
						best = candidate;
					}
				}
			}
			centerX = best[0];
			centerY = best[1];
			halfWidth = stepX;
			halfHeight = stepY;
		}
		return best;
	}

	function clampNumber(value: number, min: number, max: number) {
		return Math.min(max, Math.max(min, value));
	}

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

	// En dessous de cette largeur/hauteur à l'écran, la zone est trop petite pour
	// porter un tag : on le masque plutôt que de le faire déborder sur les zones
	// voisines.
	const TAG_MIN_ZONE_PX = 34;

	function zoneTagVisible(bounds: { width: number; height: number }): boolean {
		if (!map) return true;
		return Math.max(bounds.width, bounds.height) >= TAG_MIN_ZONE_PX;
	}

	// --- Tags de zone ---
	// Un badge HTML (photo + nom du commercial, ou « X J » pour les zones
	// rouges) posé au centre du tracé, avec un contour épais de la couleur de
	// la zone. Les tags suivent la carte tout seuls : on ne les reconstruit que
	// quand l'ensemble des zones visibles ou leur contenu change.
	// Registre interne des tags posés sur la carte (non réactif : la carte les
	// gère elle-même, on ne veut pas de re-rendu Svelte à chaque déplacement).
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	let zoneMarkers = new Map<string, { marker: Marker; signature: string }>();

	function makeZoneTagElement(z: Zone): HTMLElement {
		const el = document.createElement('div');
		el.className = 'zone-tag';
		el.style.setProperty('--zone-tag-color', zoneDisplayColor(z));

		// Zone rouge : uniquement le nombre de jours avant re-prospection.
		if (isRedZone(z)) {
			el.classList.add('zone-tag--days');
			const days = daysUntilReProspect(z.lastProspected);
			const value = days === null ? '?' : String(Math.max(0, days));
			const span = document.createElement('span');
			span.className = 'zone-tag__days';
			span.textContent = `${value} J`;
			el.append(span);
			return el;
		}

		// Sinon : photo + nom de chaque commercial affecté à la zone.
		const ids: (string | null)[] = z.commercialIds.length ? z.commercialIds : [null];
		for (const id of ids) {
			const row = document.createElement('span');
			row.className = 'zone-tag__row';

			const photo = personPhoto(id);
			const initial = (personName(id)[0] ?? '·').toUpperCase();
			if (photo) {
				const img = document.createElement('img');
				img.className = 'zone-tag__photo';
				img.src = photo;
				img.alt = '';
				img.decoding = 'async';
				// Retenue pour l'export PNG : si la photo ne peut pas être
				// récupérée par le canvas, c'est cette initiale qui est dessinée.
				img.dataset.initial = initial;
				// Photo indisponible : on retombe sur l'initiale plutôt que sur
				// l'icône d'image cassée du navigateur.
				img.addEventListener('error', () => {
					const fallback = document.createElement('span');
					fallback.className = 'zone-tag__photo zone-tag__photo--fallback';
					fallback.textContent = initial;
					img.replaceWith(fallback);
				});
				row.append(img);
			} else {
				const fallback = document.createElement('span');
				fallback.className = 'zone-tag__photo zone-tag__photo--fallback';
				fallback.textContent = initial;
				row.append(fallback);
			}

			const name = document.createElement('span');
			name.className = 'zone-tag__name';
			name.textContent = personName(id);
			row.append(name);
			el.append(row);
		}
		return el;
	}

	// Signature d'un tag : identifie tout ce qui change son contenu (couleur,
	// commerciaux, photos, jours restants) pour ne reconstruire que si besoin.
	function zoneTagSignature(z: Zone): string {
		if (isRedZone(z)) {
			const days = daysUntilReProspect(z.lastProspected);
			return `${z.id}:${zoneDisplayColor(z)}:${days === null ? '?' : Math.max(0, days)}`;
		}
		const ids: (string | null)[] = z.commercialIds.length ? z.commercialIds : [null];
		const peopleKey = ids.map((id) => `${id}@${personPhoto(id) ?? ''}`).join(',');
		return `${z.id}:${zoneDisplayColor(z)}:${peopleKey}`;
	}

	function updateZoneMarkers() {
		if (!map || !mapboxglCtor) return;
		// Purge les ancres des zones supprimées depuis le dernier rendu.
		if (anchorCache.size > zoneList.length) {
			const known = new Set(zoneList.map((z) => z.id));
			for (const id of anchorCache.keys()) {
				if (!known.has(id)) anchorCache.delete(id);
			}
		}
		const visible = zoneList.filter(
			(z) => z.geometry && z.geometry.type === 'Polygon' && zoneTagVisible(zoneScreenBounds(z))
		);

		// Retire les tags sortis de l'écran ou dont le contenu a changé (jours,
		// couleur, commerciaux, photo) : les autres sont conservés tels quels,
		// ce qui évite de recharger les photos à chaque déplacement.
		const wanted = new Map(visible.map((z) => [z.id, zoneTagSignature(z)]));
		for (const [id, entry] of [...zoneMarkers]) {
			if (wanted.get(id) === entry.signature) continue;
			entry.marker.remove();
			zoneMarkers.delete(id);
		}

		for (const z of visible) {
			if (zoneMarkers.has(z.id)) continue;
			const marker = new mapboxglCtor.Marker({
				element: makeZoneTagElement(z),
				anchor: 'center'
			})
				.setLngLat(zoneAnchor(z))
				.addTo(map);
			zoneMarkers.set(z.id, { marker, signature: wanted.get(z.id) ?? '' });
		}
	}

	let visibilityTimer: ReturnType<typeof setTimeout> | undefined;
	function onMapMove() {
		if (visibilityTimer) return;
		visibilityTimer = setTimeout(() => {
			visibilityTimer = undefined;
			updateZoneMarkers();
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
		// Le tracé est conservé en attente : on choisit les commerciaux et la
		// couleur avant de créer la zone dans Convex.
		pendingDraw = { drawId: String(f.id), geometry: f.geometry };
		zoneFormId = null;
		zoneFormColor = DEFAULT_ZONE_COLOR;
		zoneFormGreenWhenOld = true;
		zoneFormCommercialIds = [];
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
			greenWhenOld: existing.greenWhenOld,
			commercialIds: existing.commercialIds as Id<'users'>[]
		});
		setTimeout(() => {
			syncing = false;
		}, 0);
	}

	// Ouvre le formulaire d'édition d'une zone existante.
	function openZoneEdit(z: Zone) {
		pendingDraw = null;
		zoneFormId = z.id;
		zoneFormColor = z.color ?? DEFAULT_ZONE_COLOR;
		zoneFormGreenWhenOld = z.greenWhenOld;
		zoneFormCommercialIds = [...z.commercialIds];
		zoneDialogOpen = true;
	}

	function toggleFormCommercial(id: string) {
		zoneFormCommercialIds = zoneFormCommercialIds.includes(id)
			? zoneFormCommercialIds.filter((x) => x !== id)
			: [...zoneFormCommercialIds, id];
	}

	// Valide le formulaire : au moins un commercial est requis. Le « nom » de la
	// zone est dérivé des commerciaux (plus de nom saisi à la main).
	function submitZoneForm() {
		if (!zoneFormCommercialIds.length) return;
		const name = zoneTitle(zoneFormCommercialIds);
		const commercialIds = zoneFormCommercialIds as Id<'users'>[];
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
					greenWhenOld: zoneFormGreenWhenOld,
					commercialIds
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
				greenWhenOld: zoneFormGreenWhenOld,
				commercialIds
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

	// --- Nom affiché d'une zone ---
	function personName(id: string | null): string {
		if (!id) return 'Sans commercial';
		const p = personById(id);
		return p ? `${p.firstName} ${p.lastName}`.trim() : 'Commercial inconnu';
	}

	// Titre d'une zone : les noms de ses commerciaux (plus de nom de zone).
	function zoneTitle(ids: string[]): string {
		const names = ids.map((id) => personName(id)).filter((n) => n !== 'Commercial inconnu');
		return names.length ? names.join(', ') : 'Sans commercial';
	}

	function personPhoto(id: string | null): string | null {
		if (!id) return null;
		return personById(id)?.photo ?? null;
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
		updateZoneMarkers();
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

	// --- Mode capture : carte seule, en plein écran, pour photographier les
	// zones proprement (aucun panneau, aucun contrôle par-dessus) ---

	// La barre d'outils du mode capture s'efface après quelques secondes sans
	// souris : l'écran reste alors parfaitement net pour une capture d'écran.
	let captureUiStamp = 0;
	function revealCaptureUi() {
		if (!captureMode) return;
		const now = Date.now();
		// Réarmer le minuteur au plus toutes les 400 ms : on évite de créer un
		// timer à chaque événement mousemove tout en gardant la barre affichée
		// tant que la souris bouge.
		if (captureUiVisible && now - captureUiStamp < 400) return;
		captureUiStamp = now;
		captureUiVisible = true;
		clearTimeout(captureUiTimer);
		captureUiTimer = setTimeout(() => {
			captureUiVisible = false;
		}, 3500);
	}

	function resizeMapSoon(delay = 80) {
		setTimeout(() => {
			map?.resize();
			updateZoneMarkers();
		}, delay);
	}

	function enterCaptureMode() {
		captureMode = true;
		captureUiVisible = true;
		captureUiStamp = Date.now();
		selectedId = null;
		placingGms = false;
		if (map) map.getCanvas().style.cursor = '';
		// Le plein écran natif (qui masque aussi la barre du navigateur) est
		// demandé immédiatement : il exige l'activation utilisateur du clic.
		// S'il est refusé (iOS par ex.), la superposition CSS fixed inset-0 suffit.
		try {
			const request = wrapper?.requestFullscreen?.();
			if (request && typeof request.catch === 'function') request.catch(() => {});
		} catch {
			// ignore : le mode capture CSS prend le relais
		}
		tick().then(() => {
			revealCaptureUi();
			resizeMapSoon();
		});
	}

	async function exitCaptureMode() {
		captureMode = false;
		clearTimeout(captureUiTimer);
		if (document.fullscreenElement) {
			try {
				await document.exitFullscreen();
			} catch {
				// ignore
			}
		}
		resizeMapSoon();
	}

	function handleFullscreenChange() {
		// Sortie du plein écran natif (Échap, geste système…) : on quitte aussi
		// le mode capture pour retrouver l'interface.
		if (!document.fullscreenElement && captureMode) {
			void exitCaptureMode();
			return;
		}
		resizeMapSoon(60);
	}

	// --- Export PNG ---
	// Les tags (et les pins GMS) sont des éléments HTML, donc absents du canvas
	// Mapbox. On compose donc l'image : la carte, puis chaque tag redessiné
	// dans le canvas à partir de sa position et de son style réels à l'écran.
	// C'est ce qui garantit un export identique à ce qui est affiché.

	function roundedRectPath(
		ctx: CanvasRenderingContext2D,
		x: number,
		y: number,
		w: number,
		h: number,
		radius: number
	) {
		const r = Math.max(0, Math.min(radius, w / 2, h / 2));
		ctx.beginPath();
		ctx.moveTo(x + r, y);
		ctx.arcTo(x + w, y, x + w, y + h, r);
		ctx.arcTo(x + w, y + h, x, y + h, r);
		ctx.arcTo(x, y + h, x, y, r);
		ctx.arcTo(x, y, x + w, y, r);
		ctx.closePath();
	}

	// Récupère les photos des commerciaux sous forme d'images « propres » pour le
	// canvas (via fetch CORS) : dessiner directement une <img> distante
	// « souillerait » le canvas et interdirait l'export. Si une photo n'est pas
	// récupérable, l'initiale est dessinée à la place.
	async function loadTagPhotos(root: HTMLElement): Promise<{
		photos: Map<string, HTMLImageElement>;
		objectUrls: string[];
	}> {
		const urls = new SvelteSet<string>();
		for (const img of root.querySelectorAll<HTMLImageElement>('img.zone-tag__photo')) {
			if (img.src) urls.add(img.src);
		}
		const photos = new SvelteMap<string, HTMLImageElement>();
		const objectUrls: string[] = [];
		await Promise.all(
			[...urls].map(async (url) => {
				try {
					const response = await fetch(url, { mode: 'cors' });
					if (!response.ok) return;
					const objectUrl = URL.createObjectURL(await response.blob());
					const image = new Image();
					await new Promise<void>((resolve, reject) => {
						image.onload = () => resolve();
						image.onerror = () => reject(new Error('photo illisible'));
						image.src = objectUrl;
					});
					objectUrls.push(objectUrl);
					photos.set(url, image);
				} catch {
					// Photo non récupérable : l'initiale sera dessinée.
				}
			})
		);
		return { photos, objectUrls };
	}

	type ExportScale = { ratio: number; rect: DOMRect };

	function toCanvasX(scale: ExportScale, clientX: number) {
		return (clientX - scale.rect.left) * scale.ratio;
	}

	function toCanvasY(scale: ExportScale, clientY: number) {
		return (clientY - scale.rect.top) * scale.ratio;
	}

	function drawTagText(
		ctx: CanvasRenderingContext2D,
		node: HTMLElement | null,
		scale: ExportScale
	) {
		const text = node?.textContent ?? '';
		if (!node || !text) return;
		const rect = node.getBoundingClientRect();
		const style = getComputedStyle(node);
		// La taille de police doit suivre le ratio de l'écran (canvas en pixels
		// physiques, DOM en pixels CSS) : sinon le texte sort deux fois trop
		// petit sur un écran Retina.
		const fontSize = (parseFloat(style.fontSize) || 13) * scale.ratio;
		ctx.save();
		ctx.font = `${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
		ctx.fillStyle = style.color;
		ctx.textAlign = 'left';
		ctx.textBaseline = 'middle';
		ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
		ctx.shadowBlur = 3 * scale.ratio;
		ctx.shadowOffsetY = 1 * scale.ratio;
		ctx.fillText(text, toCanvasX(scale, rect.left), toCanvasY(scale, rect.top + rect.height / 2));
		ctx.restore();
	}

	function drawTagPhoto(
		ctx: CanvasRenderingContext2D,
		row: HTMLElement,
		scale: ExportScale,
		photos: Map<string, HTMLImageElement>
	) {
		const image = row.querySelector<HTMLImageElement>('img.zone-tag__photo');
		const fallback = row.querySelector<HTMLElement>('.zone-tag__photo--fallback');
		const node = image ?? fallback;
		if (!node) return;

		const rect = node.getBoundingClientRect();
		const size = rect.width * scale.ratio;
		if (size <= 0) return;
		const centerX = toCanvasX(scale, rect.left + rect.width / 2);
		const centerY = toCanvasY(scale, rect.top + rect.height / 2);
		const radius = size / 2;
		const bitmap = image ? photos.get(image.src) : null;
		// Une image cassée ferait échouer drawImage : on vérifie qu'elle est
		// réellement exploitable, sinon on dessine l'initiale.
		const usable = bitmap && bitmap.complete && bitmap.naturalWidth > 0;

		ctx.save();
		ctx.beginPath();
		ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
		ctx.closePath();
		ctx.clip();
		if (usable) {
			ctx.drawImage(bitmap, toCanvasX(scale, rect.left), toCanvasY(scale, rect.top), size, size);
		} else {
			ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
			ctx.fillRect(toCanvasX(scale, rect.left), toCanvasY(scale, rect.top), size, size);
			ctx.fillStyle = '#ffffff';
			ctx.font = `800 ${(size * 0.44).toFixed(1)}px ${getComputedStyle(node).fontFamily}`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(image?.dataset.initial ?? node.textContent ?? '·', centerX, centerY);
		}
		ctx.restore();

		// Anneau blanc autour de la photo (la bordure CSS est interne).
		const ring = Math.max(1, size * 0.065);
		ctx.save();
		ctx.beginPath();
		ctx.arc(centerX, centerY, radius - ring / 2, 0, Math.PI * 2);
		ctx.lineWidth = ring;
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
		ctx.stroke();
		ctx.restore();
	}

	function drawZoneTag(
		ctx: CanvasRenderingContext2D,
		el: HTMLElement,
		scale: ExportScale,
		photos: Map<string, HTMLImageElement>
	) {
		const rect = el.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return;
		const x = toCanvasX(scale, rect.left);
		const y = toCanvasY(scale, rect.top);
		const w = rect.width * scale.ratio;
		const h = rect.height * scale.ratio;
		const style = getComputedStyle(el);
		const border = (parseFloat(style.borderTopWidth) || 0) * scale.ratio;
		const radius = (parseFloat(style.borderTopLeftRadius) || 0) * scale.ratio;

		// Ombre portée puis fond.
		ctx.save();
		ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
		ctx.shadowBlur = 9 * scale.ratio;
		ctx.shadowOffsetY = 2 * scale.ratio;
		roundedRectPath(ctx, x, y, w, h, radius);
		ctx.fillStyle = style.backgroundColor;
		ctx.fill();
		ctx.restore();

		// Liseré clair extérieur (box-shadow 0 0 0 1.5px).
		ctx.save();
		const ring = 1.5 * scale.ratio;
		ctx.lineWidth = ring;
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
		roundedRectPath(ctx, x - ring / 2, y - ring / 2, w + ring, h + ring, radius + ring / 2);
		ctx.stroke();
		ctx.restore();

		// Contour épais de la couleur de la zone.
		if (border > 0) {
			ctx.save();
			ctx.lineWidth = border;
			ctx.strokeStyle = style.borderTopColor;
			roundedRectPath(
				ctx,
				x + border / 2,
				y + border / 2,
				w - border,
				h - border,
				Math.max(0, radius - border / 2)
			);
			ctx.stroke();
			ctx.restore();
		}

		// Contenu : une ligne photo + nom par commercial, ou « X J ».
		for (const row of el.querySelectorAll<HTMLElement>('.zone-tag__row')) {
			drawTagPhoto(ctx, row, scale, photos);
			drawTagText(ctx, row.querySelector<HTMLElement>('.zone-tag__name'), scale);
		}
		drawTagText(ctx, el.querySelector<HTMLElement>('.zone-tag__days'), scale);
	}

	// Pin GMS 🏪 : pastille ambre avec sa pointe et l'émoji.
	const GMS_EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

	function drawGmsPin(ctx: CanvasRenderingContext2D, el: HTMLElement, scale: ExportScale) {
		const rect = el.getBoundingClientRect();
		if (rect.width <= 0) return;
		const size = rect.width * scale.ratio;
		const centerX = toCanvasX(scale, rect.left + rect.width / 2);
		const centerY = toCanvasY(scale, rect.top + rect.height / 2);
		const radius = size / 2;

		ctx.save();
		ctx.translate(centerX, centerY + radius * 0.55);
		ctx.rotate(Math.PI / 4);
		ctx.fillStyle = '#f59e0b';
		ctx.fillRect(-size * 0.15, -size * 0.15, size * 0.3, size * 0.3);
		ctx.restore();

		ctx.save();
		ctx.beginPath();
		ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
		ctx.fillStyle = '#f59e0b';
		ctx.fill();
		ctx.lineWidth = Math.max(1, size * 0.06);
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
		ctx.stroke();
		ctx.font = `${(size * 0.5).toFixed(1)}px ${GMS_EMOJI_FONT}`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(el.textContent ?? '🏪', centerX, centerY);
		ctx.restore();
	}

	// Compose l'image finale : carte + tags + pins.
	async function renderMapImage(canvasMap: MapboxMap): Promise<HTMLCanvasElement> {
		const source = canvasMap.getCanvas();
		const container = canvasMap.getContainer();
		const output = document.createElement('canvas');
		output.width = source.width;
		output.height = source.height;
		const ctx = output.getContext('2d');
		if (!ctx) throw new Error('canvas 2D indisponible');
		ctx.drawImage(source, 0, 0);

		const containerRect = container.getBoundingClientRect();
		const scale: ExportScale = {
			ratio: containerRect.width > 0 ? source.width / containerRect.width : 1,
			rect: containerRect
		};

		const { photos, objectUrls } = await loadTagPhotos(container);
		try {
			// Un tag récalcitrant ne doit pas faire échouer tout l'export.
			for (const el of container.querySelectorAll<HTMLElement>('.zone-tag')) {
				try {
					drawZoneTag(ctx, el, scale, photos);
				} catch (err) {
					console.error('zone tag export failed', err);
				}
			}
			for (const el of container.querySelectorAll<HTMLElement>('.gms-pin')) {
				try {
					drawGmsPin(ctx, el, scale);
				} catch (err) {
					console.error('gms pin export failed', err);
				}
			}
		} finally {
			for (const url of objectUrls) URL.revokeObjectURL(url);
		}
		return output;
	}

	// Télécharge la carte (tags et pins compris) en PNG.
	async function downloadMapImage() {
		revealCaptureUi();
		if (!map || exporting) return;
		const canvasMap = map;
		exporting = true;
		try {
			// Garantit que toutes les zones visibles ont bien leur tag à l'écran.
			updateZoneMarkers();
			const image = await renderMapImage(canvasMap);
			if (map !== canvasMap) return;
			const link = document.createElement('a');
			link.href = image.toDataURL('image/png');
			link.download = `zones-${todayISO()}.png`;
			link.click();
		} catch {
			actionError = "Impossible d'enregistrer l'image de la carte.";
		} finally {
			exporting = false;
		}
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

		// Sortie du plein écran natif (touche Échap, geste système…) : on
		// resynchronise le mode capture et la taille de la carte.
		document.addEventListener('fullscreenchange', handleFullscreenChange);

		// En mode capture, tout mouvement de souris fait réapparaître la barre
		// d'outils ; elle s'efface ensuite toute seule.
		const wrapperEl = wrapper;
		const onWrapperMouseMove = () => {
			if (captureMode) revealCaptureUi();
		};
		wrapperEl?.addEventListener('mousemove', onWrapperMouseMove);

		// Monte la carte Mapbox (fond + draw + couches) et renvoie l'instance.
		// Rejouée à chaque changement de thème pour appliquer le style clair / sombre.
		function mountMap(): MapboxMap | null {
			if (disposed || !container) return null;
			const isMobile = window.matchMedia('(max-width: 768px)').matches;
			const m = new mapboxglMod.Map({
				container,
				style: getTheme() === 'light' ? LIGHT_STYLE_URL : STYLE_URL,
				center: [0.6886, 47.3941],
				zoom: isMobile ? 7 : 9,
				// Nécessaire pour pouvoir exporter la carte en PNG (toDataURL).
				preserveDrawingBuffer: true
			});
			map = m;
			// La carte est recréée (thème) : les anciens tags HTML ont disparu
			// avec elle, on force leur reconstruction au prochain rendu.
			zoneMarkers.clear();

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
				m.on('moveend', updateZoneMarkers);
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
			document.removeEventListener('fullscreenchange', handleFullscreenChange);
			wrapperEl?.removeEventListener('mousemove', onWrapperMouseMove);
			themeObserver?.disconnect();
			map?.remove();
			map = null;
			draw = null;
			drawReady = false;
		};
	});
</script>

<div
	bind:this={wrapper}
	class="relative h-full min-h-[560px] overflow-hidden rounded-xl border border-line bg-card"
	class:capture-mode={captureMode}
	class:fixed={captureMode}
	class:inset-0={captureMode}
	class:z-50={captureMode}
	class:rounded-none={captureMode}
	class:border-0={captureMode}
>
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

	<!-- Barre d'outils du mode capture : discrète et masquée automatiquement
	     après quelques secondes, pour laisser la carte totalement dégagée. -->
	{#if captureMode}
		<div
			class="absolute top-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/15 bg-black/60 p-1 shadow-lg backdrop-blur transition-opacity duration-300"
			class:pointer-events-none={!captureUiVisible}
			class:opacity-0={!captureUiVisible}
			class:opacity-100={captureUiVisible}
		>
			<button
				type="button"
				class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-white/15"
				title="Télécharger un PNG de la carte (zones et titres inclus)"
				onclick={downloadMapImage}
			>
				<Camera class="size-4" strokeWidth={1.8} />
				Télécharger l'image
			</button>
			<span class="h-4 w-px bg-white/20"></span>
			<button
				type="button"
				class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold text-white/80 transition-colors hover:bg-white/15 hover:text-white"
				title="Quitter le plein écran (Échap)"
				onclick={exitCaptureMode}
			>
				<Minimize class="size-4" strokeWidth={1.8} />
				Quitter
			</button>
		</div>
	{/if}

	{#if !captureMode}
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

			<Button variant="outline" class="w-full justify-center gap-2" onclick={enterCaptureMode}>
				<Maximize class="size-4" strokeWidth={1.7} />
				Plein écran
			</Button>

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
					<span class="size-2.5 shrink-0 rounded-full" style={`background:${ZONE_RED}`}></span>
					Rouge : jours avant re-prospection
				</div>
				<div class="flex items-center gap-2 text-muted-foreground">
					<span class="size-2.5 shrink-0 rounded-full" style={`background:${DEFAULT_ZONE_COLOR}`}
					></span>
					Autres zones : nom des commerciaux
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
							class="size-3.5 shrink-0 rounded-full border border-white/40"
							style={`background:${zoneColor(z)}`}
						></span>
						<div class="min-w-0 leading-tight">
							<p
								class="line-clamp-2 text-[15px] leading-snug font-semibold tracking-tight text-foreground"
							>
								{zoneTitle(z.commercialIds)}
							</p>
							<div class="mt-0.5 flex items-center gap-1">
								{#each z.commercialIds as cid (cid)}
									<Avatar
										photo={personPhoto(cid)}
										label={personName(cid)[0] ?? '·'}
										class="size-4 border border-line text-[8px]"
									/>
								{/each}
								<p class="text-[11px] font-medium text-muted-foreground">Zone de prospection</p>
							</div>
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
							<Label class="text-[11px] font-medium text-muted-foreground"
								>Dernière prospection</Label
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
										greenWhenOld: z.greenWhenOld,
										commercialIds: z.commercialIds as Id<'users'>[]
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
			<DialogDescription>
				Choisis au moins un commercial et la couleur de la zone.
			</DialogDescription>
		</DialogHeader>

		<div class="space-y-3">
			<div class="space-y-1.5">
				<Label>
					Commerciaux
					<span class="font-normal text-muted-foreground">(au moins un)</span>
				</Label>
				<div
					class="max-h-44 overflow-y-auto overscroll-contain rounded-lg border border-line bg-base p-1"
				>
					{#each people as p (p._id)}
						{@const selected = zoneFormCommercialIds.includes(p._id)}
						<button
							type="button"
							class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors hover:bg-glass-3"
							class:bg-glass-3={selected}
							onclick={() => toggleFormCommercial(p._id)}
						>
							<Avatar
								photo={p.photo}
								label={p.firstName?.[0] ?? '·'}
								class="size-6 border border-line text-[10px]"
							/>
							<span class="min-w-0 flex-1 truncate text-foreground">
								{`${p.firstName} ${p.lastName}`.trim()}
							</span>
							{#if selected}
								<Check class="size-4 shrink-0 text-emerald-500" strokeWidth={2.5} />
							{/if}
						</button>
					{:else}
						<p class="px-2 py-1.5 text-[12px] text-muted-foreground">Aucun employé disponible.</p>
					{/each}
				</div>
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
		</div>

		<DialogFooter class="gap-2">
			<Button variant="outline" onclick={cancelZoneForm}>
				<X class="size-4" strokeWidth={1.7} />
				Annuler
			</Button>
			<Button onclick={submitZoneForm} disabled={!zoneFormCommercialIds.length}>
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
	/* Mode capture : plus aucun contrôle Mapbox à l'écran (dessin, zoom…),
	     la carte et les titres de zones restent seuls. */
	:global(.capture-mode .mapboxgl-ctrl-top-left),
	:global(.capture-mode .mapboxgl-ctrl-top-right),
	:global(.capture-mode .mapboxgl-ctrl-bottom-left),
	:global(.capture-mode .mapboxgl-ctrl-bottom-right) {
		display: none !important;
	}
	/* Tag d'une zone : photo + nom du commercial (ou « X J » pour une zone
	   rouge), avec un contour épais de la couleur de la zone. */
	:global(.zone-tag) {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 3px 11px 3px 4px;
		background: rgba(9, 9, 11, 0.9);
		border: 3px solid var(--zone-tag-color, #ffffff);
		border-radius: 11px;
		/* Liseré clair extérieur : le tag se détache aussi du fond de carte
		   sombre (thème par défaut), en plus de son contour coloré. */
		box-shadow:
			0 0 0 1.5px rgba(255, 255, 255, 0.9),
			0 2px 9px rgba(0, 0, 0, 0.55);
		color: #ffffff;
		font-size: 13px;
		font-weight: 800;
		line-height: 1.15;
		letter-spacing: 0.01em;
		white-space: nowrap;
		pointer-events: none;
		user-select: none;
	}
	:global(.zone-tag__row) {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	:global(.zone-tag__photo) {
		display: block;
		width: 23px;
		height: 23px;
		flex-shrink: 0;
		border: 1.5px solid rgba(255, 255, 255, 0.92);
		border-radius: 50%;
		object-fit: cover;
	}
	:global(.zone-tag__photo--fallback) {
		display: grid;
		place-items: center;
		background: rgba(255, 255, 255, 0.2);
		font-size: 10px;
		font-weight: 800;
	}
	:global(.zone-tag__name) {
		padding-right: 3px;
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85);
	}
	:global(.zone-tag--days) {
		padding: 3px 12px;
		border-radius: 999px;
	}
	:global(.zone-tag__days) {
		font-size: 14px;
		font-weight: 800;
		letter-spacing: 0.03em;
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85);
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
