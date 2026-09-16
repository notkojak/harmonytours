<script lang="ts">
	import { env } from '$env/dynamic/public';
	import { BarChart3, ChevronLeft, ChevronRight } from '@lucide/svelte';
	import { useQuery } from 'convex-svelte';
	import { api } from '../../convex/_generated/api.js';
	import type { Id } from '../../convex/_generated/dataModel.js';
	import type { Map as MapboxMap, GeoJSONSource } from 'mapbox-gl';
	import type { Feature, Point } from 'geojson';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { authState } from '$lib/auth-state.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import { STYLE_URL, LIGHT_STYLE_URL } from '$lib/zones/colors.js';
	import { getTheme } from '$lib/theme';
	import {
		bilangmsSurPeriode,
		bilanSurPeriode,
		doorStatusBadge,
		doorStatusDot,
		doorStatusLabel,
		doorStatusPin,
		fmtEuros,
		firstDayOfMonth,
		PIPELINE_ORDER,
		type BilanStats,
		type GmsBilan,
		type GmsStatRow,
		type VisiteRow
	} from '$lib/data/beastdoor.js';

	import 'mapbox-gl/dist/mapbox-gl.css';

	// --- Helpers locaux ---
	function isoOf(d: Date): string {
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const dd = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${dd}`;
	}
	function dayAdd(iso: string, days: number): string {
		const d = new Date(iso + 'T12:00:00');
		d.setDate(d.getDate() + days);
		return isoOf(d);
	}
	// --- Profil (rôle) et membres de l'équipe pour les onglets ---
	const profile = useQuery(api.users.getProfile, () => (authState.isAuthenticated ? {} : 'skip'));
	// L'admin, le directeur de zone et le directeur d'agence voient le bilan de
	// leur équipe ; les autres rôles gardent le comportement historique.
	const isScopeAll = $derived(
		!!profile.data &&
			['administrateur', 'directeur de zone', "directeur d'agence"].includes(
				profile.data.role ?? ''
			)
	);
	const people = useQuery(api.access.listPeople, () =>
		authState.isAuthenticated && isScopeAll ? {} : 'skip'
	);

	// Onglet sélectionné : null = « Tous » (toute l'équipe), sinon l'id du membre.
	let memberId = $state<Id<'users'> | null>(null);

	// --- Sélecteur de période (mois courant par défaut) ---
	let viewISO = $state(firstDayOfMonth(new Date())); // 'YYYY-MM-DD' (1er du mois)
	const monthLabel = $derived(
		new Date(`${viewISO.slice(0, 7)}-01T12:00:00`).toLocaleDateString('fr-FR', {
			month: 'long',
			year: 'numeric'
		})
	);

	// Jour focusé (null = vue mois). Par défaut : vue jour (aujourd'hui).
	let focusDay = $state<string | null>(isoOf(new Date()));

	// Fin du mois (exclusive) : premier jour du mois suivant.
	const monthEndExclusive = $derived(
		(() => {
			const d = new Date(viewISO + 'T12:00:00');
			d.setMonth(d.getMonth() + 1);
			return firstDayOfMonth(d);
		})()
	);

	// Période affichée (mois ou jour focusé) — utilisée pour le bilan ET la carte.
	const periodStart = $derived(focusDay ?? viewISO);
	const periodEnd = $derived(focusDay ? dayAdd(focusDay, 1) : monthEndExclusive);

	// --- Données importées depuis BeastDoor (portes + visites) ---
	// Admin / directeur de zone : « Tous » passe tous les ids de l'équipe, un
	// onglet membre passe le sien ; les autres rôles ne passent rien (défaut).
	// `from`/`to` bornent la lecture côté Convex à la période affichée : cette
	// query est ré-exécutée à CHAQUE écriture de la prospection, donc relire tout
	// l'historique (≈ 2 400 documents) à chaque fois coûtait cher (Database I/O).
	const data = useQuery(api.beastdoor.list, () =>
		authState.isAuthenticated
			? isScopeAll
				? {
						personIds: memberId === null ? (people.data ?? []).map((p) => p._id) : [memberId],
						from: periodStart,
						to: periodEnd
					}
				: { from: periodStart, to: periodEnd }
			: 'skip'
	);
	const portes = $derived(data.data?.portes ?? []);
	const visites = $derived(data.data?.visites ?? []);

	// Libellé de la période affichée : le jour quand la vue « Jour » est active,
	// sinon le mois.
	const periodLabel = $derived(
		focusDay
			? new Date(`${focusDay}T12:00:00`).toLocaleDateString('fr-FR', {
					weekday: 'short',
					day: 'numeric',
					month: 'long',
					year: 'numeric'
				})
			: monthLabel
	);

	// En vue « Jour » les flèches naviguent jour par jour ; en vue « Mois » elles
	// changent de mois.
	function prevPeriod() {
		const d = new Date((focusDay ?? viewISO) + 'T12:00:00');
		if (focusDay) {
			d.setDate(d.getDate() - 1);
			focusDay = isoOf(d);
		} else {
			d.setMonth(d.getMonth() - 1);
			viewISO = firstDayOfMonth(d);
			focusDay = null;
		}
	}
	function nextPeriod() {
		const d = new Date((focusDay ?? viewISO) + 'T12:00:00');
		if (focusDay) {
			d.setDate(d.getDate() + 1);
			focusDay = isoOf(d);
		} else {
			d.setMonth(d.getMonth() + 1);
			viewISO = firstDayOfMonth(d);
			focusDay = null;
		}
	}

	// --- Agrégations ---
	const bilanMois = $derived(bilanSurPeriode(visites, viewISO, monthEndExclusive));

	// Bilan affiché : celui du mois ou de la journée focusée.
	const currentBilan = $derived<BilanStats>(
		focusDay ? bilanSurPeriode(visites, focusDay, dayAdd(focusDay, 1)) : bilanMois
	);

	// --- Bilan GMS (séparé du bilan « portes ») ---
	const gmsStats = $derived(data.data?.gmsStats ?? ([] as GmsStatRow[]));
	const gmsMois = $derived(bilangmsSurPeriode(gmsStats, visites, viewISO, monthEndExclusive));
	const currentGms = $derived<GmsBilan>(
		focusDay ? bilangmsSurPeriode(gmsStats, visites, focusDay, dayAdd(focusDay, 1)) : gmsMois
	);

	// Lignes du Bilan GMS.
	const gmsRows = $derived([
		{
			label: 'Salutation',
			value: currentGms.salutation,
			icon: '👋',
			badge: 'bg-sky-400/15 text-sky-400'
		},
		{
			label: 'Question posée',
			value: currentGms.question,
			icon: '❓',
			badge: 'bg-emerald-400/15 text-emerald-400'
		},
		{ label: 'RDV', value: currentGms.rdv, icon: '📅', badge: 'bg-sky-500/15 text-sky-400' },
		{
			label: 'Contact',
			value: currentGms.contact,
			icon: '🤝',
			badge: 'bg-fuchsia-400/15 text-fuchsia-400'
		}
	]);

	// Statut sélectionné pour filtrer la carte (null = tous).
	let filterStatus = $state<string | null>(null);

	// --- Carte Mapbox : points colorés par statut (comme la carte mobile) ---
	let container: HTMLDivElement | undefined = $state();
	let map = $state<MapboxMap | null>(null);
	let mapboxgl: any = null;
	let noToken = $state(false);

	type PorteFeature = Feature<Point, { status?: string | null; label: string }>;

	// Statut de la porte tel qu'observé dans la période (dernière visite).
	// Utile pour colorer la carte sur le mois / jour affiché.
	const porteStatusInPeriod = $derived.by(() => {
		const map = new Map<string, { visitedAt: number; status: string | null }>();
		const start = Date.parse(periodStart);
		const end = Date.parse(periodEnd);
		for (const v of visites) {
			if (v.deletedAt != null || v.visitedAt < start || v.visitedAt >= end) continue;
			const cur = map.get(v.addressId);
			if (!cur || cur.visitedAt < v.visitedAt) {
				map.set(v.addressId, { visitedAt: v.visitedAt, status: v.status ?? null });
			}
		}
		const statusByPorte = new Map<string, string | null>();
		for (const [addr, val] of map) statusByPorte.set(addr, val.status);
		return statusByPorte;
	});

	const porteFeatures = $derived<PorteFeature[]>(
		portes
			.filter((p) => p.latitude != null && p.longitude != null)
			// Seules les portes touchées pendant la période affichée (mois ou jour).
			.filter((p) => porteStatusInPeriod.has(p.id))
			.filter((p) => !filterStatus || porteStatusInPeriod.get(p.id) === filterStatus)
			.map((p) => ({
				type: 'Feature',
				properties: { status: porteStatusInPeriod.get(p.id) ?? null, label: p.label ?? '' },
				geometry: {
					type: 'Point',
					coordinates: [p.longitude as number, p.latitude as number]
				}
			}))
	);

	function updateMap() {
		if (!map) return;
		const src = map.getSource('portes') as GeoJSONSource | undefined;
		if (!src) return;
		src.setData({ type: 'FeatureCollection', features: porteFeatures });
		fitPortes(map);
	}

	function updateLayerColors() {
		if (!map || !mapboxgl) return;
		try {
			if (map.getLayer('portes-fill')) {
				map.setPaintProperty('portes-fill', 'circle-color', statusColorExpression());
			}
		} catch {
			// ignoré
		}
	}

	function statusColorExpression(): any {
		return [
			'match',
			['get', 'status'],
			'non_present',
			doorStatusPin('non_present'),
			'refus',
			doorStatusPin('refus'),
			'etude',
			doorStatusPin('etude'),
			'deballe',
			doorStatusPin('deballe'),
			'rdv',
			doorStatusPin('rdv'),
			'contact',
			doorStatusPin('contact'),
			'vente',
			doorStatusPin('vente'),
			'vente_echouee',
			doorStatusPin('vente_echouee'),
			'rgba(148,163,184,0.85)'
		];
	}

	$effect(() => {
		// Lecture explicite des dépendances (période / filtre / données) pour que
		// Svelte trace bien le changement de période et mette à jour la carte.
		const n = porteFeatures.length;
		const p = periodStart;
		void n;
		void p;
		if (map) updateMap();
	});
	$effect(() => {
		const n = porteFeatures.length;
		void n;
		if (map) updateLayerColors();
	});

	function fitPortes(m: MapboxMap) {
		if (!mapboxgl) return;
		const coords = porteFeatures
			.map((f: any) => f.geometry.coordinates)
			.filter((c: any) => Array.isArray(c) && c.length === 2);
		if (!coords.length) return;
		const bounds = new mapboxgl.LngLatBounds();
		for (const c of coords) bounds.extend(c);
		try {
			m.fitBounds(bounds, { padding: 46, duration: 200, maxZoom: 14 });
		} catch {
			// ignoré
		}
	}

	// La carte est montée tardivement (après le chargement de `data`), donc on
	// initialise Mapbox via un `$effect` qui observe `container` plutôt qu'un
	// `onMount` (qui tournerait trop tôt, avant que le conteneur n'existe).
	$effect(() => {
		const el = container;
		if (!el) return;
		let disposed = false;
		let cleanup: (() => void) | null = null;

		(async () => {
			const token = env.PUBLIC_MAPBOX_TOKEN;
			if (!token) {
				noToken = true;
				return;
			}
			const { default: mapboxglModule } = await import('mapbox-gl');
			if (disposed || !el) return;
			mapboxgl = mapboxglModule;
			mapboxgl.accessToken = token;
			const m = new mapboxglModule.Map({
				container: el,
				style: getTheme() === 'light' ? LIGHT_STYLE_URL : STYLE_URL,
				center: [0.7171, 47.2777],
				zoom: 11,
				attributionControl: false
			});
			map = m;

			// Ré-ajoute la couche « portes » quand elle a été réinitialisée (le
			// changement de style Mapbox la détruit), puis rafraîchit les points.
			function ensureLayers() {
				if (disposed) return;
				try {
					if (!m.getSource('portes')) {
						m.addSource('portes', {
							type: 'geojson',
							data: { type: 'FeatureCollection', features: [] }
						});
					}
					if (!m.getLayer('portes-fill')) {
						m.addLayer({
							id: 'portes-fill',
							type: 'circle',
							source: 'portes',
							paint: {
								'circle-radius': 6,
								'circle-color': statusColorExpression(),
								'circle-stroke-color': 'rgba(255,255,255,0.7)',
								'circle-stroke-width': 1
							}
						});
					}
				} catch (err) {
					console.error('bilan map layers setup failed', err);
				}
				updateMap();
			}

			m.on('load', ensureLayers);

			// Bascule automatique du style de la carte quand on change de thème.
			let currentLight = getTheme() === 'light';
			const themeObserver = new MutationObserver(() => {
				const light = getTheme() === 'light';
				if (light === currentLight) return;
				currentLight = light;
				map?.setStyle(light ? LIGHT_STYLE_URL : STYLE_URL);
				// Le changement de style supprime la couche : on la recrée au chargement.
				map?.once('style.load', ensureLayers);
			});
			themeObserver.observe(document.documentElement, {
				attributes: true,
				attributeFilter: ['class']
			});

			const ro = new ResizeObserver(() => m.resize());
			ro.observe(el);
			cleanup = () => {
				try {
					themeObserver.disconnect();
				} catch {
					// ignoré
				}
				try {
					ro.disconnect();
				} catch {
					// ignoré
				}
				m.remove();
			};
			// (le cleanup est restitué par le retour de l'effet)
		})();

		return () => {
			disposed = true;
			cleanup?.();
			map = null;
		};
	});

	// Lignes du pipeline (portes sonnées + statuts) pour les totaux.
	const pipelineRows = $derived(
		PIPELINE_ORDER.map((p) => ({
			key: p.key,
			status: p.status,
			label: p.label,
			value:
				p.key === 'portesSonnees' ? currentBilan.portesSonnees : ((currentBilan as any)[p.key] ?? 0)
		}))
	);

	// Émoji de chaque statut du Bilan TAP (sonnée 🔔, traité ❌, RDV 📅, Contact 🤝).
	const TAP_STATUS_EMOJI: Record<string, string> = {
		nonPresent: '🔔',
		refus: '❌',
		rdv: '📅',
		contact: '🤝'
	};

	function focusToday() {
		const nowIso = isoOf(new Date());
		if (nowIso.startsWith(viewISO.slice(0, 7))) {
			focusDay = nowIso;
		} else {
			viewISO = `${nowIso.slice(0, 7)}-01`;
			focusDay = nowIso;
		}
	}
</script>

<div class="space-y-5">
	<Card class="gap-0 rounded-2xl border-line py-0 shadow-none">
		<CardHeader class="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-0">
			<CardTitle class="flex items-center gap-2.5 text-[14px] font-semibold">
				<span
					class="grid size-8 place-items-center rounded-lg border border-line bg-card2 text-muted-foreground"
				>
					<BarChart3 class="size-4" strokeWidth={1.7} />
				</span> Bilan
			</CardTitle>
		</CardHeader>

		<CardContent class="px-5 pt-3 pb-5">
			<!-- Sélecteur mois / jour -->
			<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
				<div class="flex items-center gap-1">
					<Button variant="outline" class="h-8 px-2" onclick={prevPeriod}>
						<ChevronLeft class="size-4" strokeWidth={2} />
					</Button>
					<span
						class="min-w-44 px-2 text-center text-[12.5px] font-semibold text-foreground capitalize"
					>
						{periodLabel}
					</span>
					<Button variant="outline" class="h-8 px-2" onclick={nextPeriod}>
						<ChevronRight class="size-4" strokeWidth={2} />
					</Button>
				</div>

				<div class="flex items-center gap-1 rounded-lg border border-line bg-card2/60 p-0.5">
					<button
						type="button"
						class={[
							'rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
							focusDay
								? 'bg-white text-black shadow-sm dark:bg-foreground dark:text-background'
								: 'text-muted-foreground hover:bg-primary/10'
						].join(' ')}
						onclick={focusToday}
					>
						Jour
					</button>
					<button
						type="button"
						class={[
							'rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
							!focusDay
								? 'bg-white text-black shadow-sm dark:bg-foreground dark:text-background'
								: 'text-muted-foreground hover:bg-primary/10'
						].join(' ')}
						onclick={() => (focusDay = null)}
					>
						Mois
					</button>
				</div>
			</div>

			<!-- Onglets équipe (admin / directeur de zone) : « Tous » ou un membre -->
			{#if isScopeAll && (people.data?.length ?? 0) > 0}
				<div class="mb-4 flex flex-wrap items-center gap-1.5">
					<span class="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
						Équipe :
					</span>
					<div
						class="flex flex-wrap items-center gap-1 rounded-xl border border-line bg-card2/60 p-1"
					>
						<button
							type="button"
							onclick={() => (memberId = null)}
							class={[
								'flex items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-medium whitespace-nowrap transition-all duration-150',
								memberId === null
									? 'bg-white text-black shadow-md shadow-black/10 light:bg-foreground light:text-background'
									: 'text-muted-foreground hover:bg-primary/10 hover:text-violet-200 light:hover:text-violet-600'
							].join(' ')}
						>
							Tous
						</button>
						{#each people.data ?? [] as p}
							<button
								type="button"
								onclick={() => (memberId = p._id)}
								class={[
									'flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium whitespace-nowrap transition-all duration-150',
									memberId === p._id
										? 'bg-white text-black shadow-md shadow-black/10 light:bg-foreground light:text-background'
										: 'text-muted-foreground hover:bg-primary/10 hover:text-violet-200 light:hover:text-violet-600'
								].join(' ')}
							>
								<Avatar
									photo={p.photo}
									label={p.name
										.trim()
										.split(/\s+/)
										.map((w) => w[0] ?? '')
										.slice(0, 2)
										.join('')
										.toUpperCase()}
									class="size-6 rounded-full bg-muted text-[9px] font-bold text-muted-foreground"
								/>
								{p.name}
							</button>
						{/each}
					</div>
				</div>
			{/if}

			{#if data.isLoading}
				<div class="space-y-3 py-10">
					<div class="skeleton h-3 w-56 rounded-full"></div>
					<div class="skeleton h-64 w-full rounded-2xl"></div>
				</div>
			{:else}
				<!-- Grands totaux -->
				<p class="mb-2 flex items-center gap-2 text-[12px] font-semibold text-foreground">
					🚪 Bilan TAP
				</p>
				<div class="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
					{#each pipelineRows as row}
						<div class="rounded-xl border border-line bg-card2 px-2.5 py-2">
							<div class="flex items-center gap-2">
								<span
									class={[
										'grid size-6 shrink-0 place-items-center rounded-md text-[10.5px] font-bold',
										row.key === 'portesSonnees'
											? 'bg-muted text-foreground'
											: doorStatusBadge(row.status ?? row.key)
									].join(' ')}
								>
									{row.key === 'portesSonnees'
										? '🚪'
										: (TAP_STATUS_EMOJI[row.key] ?? row.key.slice(0, 1).toUpperCase())}
								</span>
								<span class="truncate text-[11.5px] font-medium text-muted-foreground">
									{row.label}
								</span>
							</div>
							<p class="mt-1 text-[17px] leading-none font-bold text-foreground">{row.value}</p>
						</div>
					{/each}
				</div>

				<!-- Bilan GMS (même design que le bilan tap) -->
				<div class="mb-3">
					<p class="mb-2 flex items-center gap-2 text-[12px] font-semibold text-foreground">
						🏪 Bilan GMS
					</p>
					<div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
						{#each gmsRows as row}
							<div class="rounded-xl border border-line bg-card2 px-2.5 py-2">
								<div class="flex items-center gap-2">
									<span
										class={[
											'grid size-6 shrink-0 place-items-center rounded-md text-[11px]',
											row.badge
										].join(' ')}
									>
										{row.icon}
									</span>
									<span class="truncate text-[11.5px] font-medium text-muted-foreground">
										{row.label}
									</span>
								</div>
								<p class="mt-1 text-[17px] leading-none font-bold text-foreground">{row.value}</p>
							</div>
						{/each}
					</div>
				</div>

				<!-- Filtre carte -->
				<div class="mb-3 flex flex-wrap items-center gap-1.5">
					<span class="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
						Carte :
					</span>
					<button
						type="button"
						onclick={() => (filterStatus = null)}
						class={[
							'rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors',
							filterStatus === null
								? 'bg-white text-black dark:bg-foreground dark:text-background'
								: 'bg-card2 text-muted-foreground hover:bg-glass-2'
						].join(' ')}
					>
						Tous
					</button>
					{#each PIPELINE_ORDER as s}
						{#if s.key !== 'portesSonnees'}
							<button
								type="button"
								onclick={() => (filterStatus = filterStatus === s.status ? null : s.status)}
								class={[
									'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors',
									filterStatus === s.status
										? 'bg-white text-black dark:bg-foreground dark:text-background'
										: 'bg-card2 text-muted-foreground hover:bg-glass-2'
								].join(' ')}
							>
								<span class={['size-2 rounded-full', doorStatusDot(s.status)].join(' ')}></span>
								{doorStatusLabel(s.status)}
							</button>
						{/if}
					{/each}
				</div>

				<!-- Carte -->
				<div class="relative h-[30rem] overflow-hidden rounded-lg border border-line bg-card2">
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
			{/if}
		</CardContent>
	</Card>
</div>

<style>
	/* Le DOM de Mapbox n'est pas scopable par Svelte : on masque le logo via :global */
	:global(.mapboxgl-ctrl-bottom-left .mapboxgl-ctrl-logo) {
		display: none;
	}
</style>
