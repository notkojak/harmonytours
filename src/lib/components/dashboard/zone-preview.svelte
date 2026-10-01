<script lang="ts">
	import { onMount } from 'svelte';
	import { env } from '$env/dynamic/public';
	import { Map as MapIcon } from '@lucide/svelte';
	import { useQuery } from 'convex-svelte';
	import { api } from '../../../convex/_generated/api.js';
	import type { Map as MapboxMap, GeoJSONSource } from 'mapbox-gl';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import { authState } from '$lib/auth-state.svelte';
	import { isInProspecting } from '$lib/zones/dates.js';
	import { getZoneFillExpression } from '$lib/zones/drawStyles.js';
	import { STYLE_URL, LIGHT_STYLE_URL, FILL_OPACITY, zoneDisplayColor } from '$lib/zones/colors.js';
	import { getTheme } from '$lib/theme';

	import 'mapbox-gl/dist/mapbox-gl.css';

	// Zones de l'agence de l'utilisateur connecté (list filtrée côté serveur).
	const zonesQuery = useQuery(api.zones.list, () => (authState.isAuthenticated ? {} : 'skip'));
	const zones = $derived(zonesQuery.data ?? []);
	// Pins GMS 🏪 (grandes surfaces en cours) posés sur la carte.
	const gmsQuery = useQuery(api.gms.list, () => (authState.isAuthenticated ? {} : 'skip'));
	const gmsList = $derived(gmsQuery.data ?? []);
	// « En cours de prospection » : dernière prospection datant de moins de 7 jours.
	const enCours = $derived(zones.filter((z) => isInProspecting(z.lastProspected ?? null)));

	let container: HTMLDivElement | undefined = $state();
	let map = $state<MapboxMap | null>(null);
	let mapboxgl: any = null;
	let noToken = $state(false);
	let gmsMarkers: any[] = [];

	function updateGmsMarkers() {
		if (!map || !mapboxgl) return;
		for (const mk of gmsMarkers) mk.remove();
		gmsMarkers = [];
		for (const g of gmsList) {
			const el = document.createElement('div');
			el.className = 'gms-pin';
			el.textContent = '🏪';
			el.title = g.label;
			gmsMarkers.push(
				new mapboxgl.Marker({ element: el, anchor: 'bottom' })
					.setLngLat([g.longitude, g.latitude])
					.addTo(map)
			);
		}
	}

	function updateMap() {
		if (!map) return;
		const src = map.getSource('zones') as GeoJSONSource | undefined;
		if (!src) return;
		src.setData({
			type: 'FeatureCollection',
			features: zones.map((z) => ({
				type: 'Feature',
				properties: {
					lastProspected: z.lastProspected,
					color: zoneDisplayColor({
						color: z.color ?? null,
						greenWhenOld: z.greenWhenOld ?? false,
						lastProspected: z.lastProspected ?? null
					})
				},
				geometry: z.geometry
			}))
		});
		updateGmsMarkers();
		// Cadrage sur les zones en cours, sinon sur toutes les zones de l'agence,
		// en incluant les pins GMS pour qu'ils restent visibles.
		const focus = enCours.length ? enCours : zones;
		if ((focus.length || gmsList.length) && mapboxgl) {
			const bounds = new mapboxgl.LngLatBounds();
			for (const z of focus) {
				for (const ring of z.geometry.coordinates) {
					for (const point of ring) {
						bounds.extend(point);
					}
				}
			}
			for (const g of gmsList) {
				bounds.extend([g.longitude, g.latitude]);
			}
			map.fitBounds(bounds, { padding: 44, duration: 0, maxZoom: 13 });
		}
	}

	$effect(() => {
		if (map) updateMap();
	});

	$effect(() => {
		if (map && mapboxgl) updateGmsMarkers();
	});

	onMount(() => {
		let disposed = false;
		let cleanup: (() => void) | null = null;

		(async () => {
			const token = env.PUBLIC_MAPBOX_TOKEN;
			if (!token) {
				noToken = true;
				return;
			}
			const { default: mapboxglModule } = await import('mapbox-gl');
			if (disposed || !container) return;
			mapboxgl = mapboxglModule;
			mapboxgl.accessToken = token;
			const m = new mapboxglModule.Map({
				container,
				style: getTheme() === 'light' ? LIGHT_STYLE_URL : STYLE_URL,
				center: [0.6886, 47.3941],
				zoom: 8,
				attributionControl: false
			});
			map = m;

			// Ré-ajoute la couche « zones » quand elle a été réinitialisée par un
			// changement de style, puis rafraîchit les polygones et markers.
			function ensureLayers() {
				if (disposed) return;
				try {
					if (!m.getSource('zones')) {
						m.addSource('zones', {
							type: 'geojson',
							data: { type: 'FeatureCollection', features: [] }
						});
					}
					if (!m.getLayer('zones-fill')) {
						m.addLayer({
							id: 'zones-fill',
							type: 'fill',
							source: 'zones',
							paint: {
								'fill-color': getZoneFillExpression(),
								'fill-outline-color': 'rgba(255, 255, 255, 0.85)',
								'fill-opacity': FILL_OPACITY
							}
						});
					}
					if (!m.getLayer('zones-outline')) {
						m.addLayer({
							id: 'zones-outline',
							type: 'line',
							source: 'zones',
							paint: {
								'line-color': '#ffffff',
								'line-width': 1.5
							}
						});
					}
				} catch (err) {
					console.error('zone preview layers setup failed', err);
				}
				updateMap();
			}

			m.on('load', ensureLayers);

			// Bascule automatique du style de la carte en fonction du thème.
			let currentLight = getTheme() === 'light';
			const themeObserver = new MutationObserver(() => {
				const light = getTheme() === 'light';
				if (light === currentLight) return;
				currentLight = light;
				map?.setStyle(light ? LIGHT_STYLE_URL : STYLE_URL);
				map?.once('style.load', ensureLayers);
			});
			themeObserver.observe(document.documentElement, {
				attributes: true,
				attributeFilter: ['class']
			});

			const ro = new ResizeObserver(() => m.resize());
			ro.observe(container);
			cleanup = () => {
				themeObserver.disconnect();
				ro.disconnect();
				m.remove();
			};
		})();

		return () => {
			disposed = true;
			cleanup?.();
			map = null;
		};
	});
</script>

<Card class="gap-0 overflow-hidden rounded-xl border-line py-0 shadow-none">
	<CardHeader class="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-3">
		<CardTitle class="flex items-center gap-2.5 text-[14px] font-semibold">
			<span
				class="grid size-8 place-items-center rounded-lg border border-line bg-card2 text-muted-foreground"
			>
				<MapIcon class="size-4" strokeWidth={1.7} />
			</span>
			Prospection en cours
		</CardTitle>
		<a
			href="/zones"
			class="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[12px] font-semibold text-foreground shadow-sm transition-colors hover:bg-white/90 dark:text-[#0f1115]"
		>
			Ouvrir la carte
		</a>
	</CardHeader>

	<CardContent class="px-5 pb-5">
		<!-- GMS en cours : pins 🏪 avec leur intitulé -->
		{#if gmsList.length}
			<div class="mb-3 space-y-1.5">
				<p class="text-[10.5px] font-semibold tracking-wider text-muted-foreground uppercase">
					GMS en cours ({gmsList.length})
				</p>
				<div class="flex flex-col gap-1.5">
					{#each gmsList as g (g.externalId)}
						<div
							class="flex items-center gap-2 rounded-lg border border-line bg-card2 px-2.5 py-1.5"
						>
							<span class="shrink-0 text-[13px]">🏪</span>
							<span class="truncate text-[12px] font-medium text-foreground">{g.label}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Mini carte -->
		<div class="relative h-56 overflow-hidden rounded-lg border border-line bg-card2">
			{#if noToken}
				<div class="absolute inset-0 grid place-items-center p-4 text-center">
					<p class="text-[12px] leading-relaxed text-muted-foreground">
						Token Mapbox manquant — ajoute
						<code class="rounded bg-muted px-1 py-0.5 text-amber-400">PUBLIC_MAPBOX_TOKEN</code>
						dans <code class="rounded bg-muted px-1 py-0.5 text-amber-400">.env</code>.
					</p>
				</div>
			{/if}
			<div class="absolute inset-0">
				<div class="h-full w-full" bind:this={container}></div>
			</div>
		</div>
	</CardContent>
</Card>

<style>
	/* Pin GMS 🏪 : bulle avec pointe posée sur la mini-carte */
	:global(.gms-pin) {
		position: relative;
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		background: #f59e0b; /* amber-500 */
		border: 2px solid rgba(255, 255, 255, 0.95);
		border-radius: 50%;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
		cursor: pointer;
		transform: translateY(-2px);
		font-size: 14px;
		line-height: 1;
	}
	:global(.gms-pin::after) {
		content: '';
		position: absolute;
		bottom: -6px;
		left: 50%;
		width: 9px;
		height: 9px;
		background: #f59e0b;
		border-right: 2px solid rgba(255, 255, 255, 0.95);
		border-bottom: 2px solid rgba(255, 255, 255, 0.95);
		border-radius: 0 0 2px 0;
		transform: translateX(-50%) rotate(45deg);
	}
</style>
