<script lang="ts">
	import { onMount } from 'svelte';
	import { env } from '$env/dynamic/public';
	import { getTheme } from '$lib/theme';
	import { LIGHT_STYLE_URL, STYLE_URL } from '$lib/zones/colors.js';
	import 'mapbox-gl/dist/mapbox-gl.css';
	import type { Map as MapboxMap, Marker } from 'mapbox-gl';
	import { rondDeDate, type Chantier } from '$lib/data/opportunite';

	// Carte des chantiers déjà planifiés autour du client. Elle sert aussi
	// d'écran à montrer : chaque rond porte la date de pose, et le nom du client
	// n'apparaît que dans la bulle ouverte, jamais en clair sur la carte.
	let {
		chantiers,
		retenus = [],
		adresse = '',
		centre,
		lectureSeule = false,
		onBasculer
	}: {
		chantiers: Chantier[];
		/** ids des chantiers regroupés (mis en avant sur la carte) */
		retenus?: string[];
		/** adresse du client, localisée pour situer le « chez vous » */
		adresse?: string;
		/** repli quand l'adresse ne peut pas être géocodée */
		centre: [number, number];
		/** vue client : les marqueurs s'ouvrent mais ne modifient rien */
		lectureSeule?: boolean;
		onBasculer?: (id: string) => void;
	} = $props();

	let conteneur: HTMLDivElement | null = $state(null);
	let carte: MapboxMap | null = $state(null);
	let sansToken = $state(false);
	let indisponible = $state(false);
	/** position du client, géocodée depuis son adresse */
	let chezVous = $state<[number, number] | null>(null);

	type ModuleMapbox = typeof import('mapbox-gl').default;
	let mapboxgl: ModuleMapbox | null = null;
	let marqueurs: Marker[] = [];

	/** Marqueur rond d'un chantier : le jour au centre, l'anneau plus ou moins plein. */
	function elementMarqueur(c: Chantier, pris: boolean) {
		const rond = rondDeDate(c);
		const el = document.createElement('button');
		el.type = 'button';
		el.title = `${c.commune} · dans ${rond.jours} j`;
		el.className = [
			'grid size-9 cursor-pointer place-items-center rounded-full border text-center leading-none shadow-lg transition-transform hover:scale-110',
			pris ? 'border-brand bg-brand text-white scale-110' : 'border-brand/60 bg-base/95 text-ink'
		].join(' ');
		el.innerHTML = `<span class="block text-[11px] font-bold">${rond.jour}</span><span class="block text-[7.5px] font-semibold opacity-80">${rond.mois}</span>`;
		el.addEventListener('click', (e) => {
			e.stopPropagation();
			ouvrirBulle(c, el);
		});
		return el;
	}

	/**
	 * Marqueur « chez vous » : l'adresse du client en cours de chiffrage. Le bleu
	 * de marque, comme le « Votre maison » de la carte de quartier : c'est le
	 * même objet, il doit se lire pareil sur les deux cartes.
	 */
	function elementMaison() {
		const el = document.createElement('div');
		el.className =
			'rounded-full border border-brand bg-brand px-2 py-0.5 text-[10px] font-bold whitespace-nowrap text-white shadow-lg';
		el.textContent = 'Chez vous';
		return el;
	}

	function ouvrirBulle(c: Chantier, el: HTMLElement) {
		if (!carte || !mapboxgl) return;
		const rond = rondDeDate(c);
		const bulle = new mapboxgl.Popup({ offset: 18, closeButton: false, maxWidth: '260px' })
			.setLngLat([c.lon, c.lat])
			.setHTML(
				`<div style="font-size:12px;line-height:1.35">
					<strong>${c.client}</strong><br />
					<span style="opacity:.75">${c.projet}</span><br />
					<span style="opacity:.6">${c.commune} · pose le ${rond.jour} ${rond.mois} (dans ${rond.jours} j)</span>
				</div>`
			);
		if (!lectureSeule && onBasculer) {
			const pris = retenus.includes(c.id);
			const bouton = document.createElement('button');
			bouton.type = 'button';
			bouton.className =
				'mt-2 w-full rounded-full border border-current/30 px-2 py-1 text-[11px] font-semibold';
			bouton.textContent = pris ? 'Retirer du regroupement' : 'Regrouper ce chantier';
			bouton.addEventListener('click', () => {
				onBasculer(c.id);
				bulle.remove();
			});
			const corps = bulle.getElement();
			if (corps) corps.appendChild(bouton);
		}
		bulle.addTo(carte);
		el.blur();
	}

	function dessinerMarqueurs() {
		if (!carte || !mapboxgl) return;
		for (const m of marqueurs) m.remove();
		marqueurs = [];

		for (const c of chantiers) {
			const pris = retenus.includes(c.id);
			marqueurs.push(
				new mapboxgl.Marker({ element: elementMarqueur(c, pris), anchor: 'center' })
					.setLngLat([c.lon, c.lat])
					.addTo(carte)
			);
		}

		if (chezVous) {
			marqueurs.push(
				new mapboxgl.Marker({ element: elementMaison(), anchor: 'bottom' })
					.setLngLat(chezVous)
					.addTo(carte)
			);
		}
	}

	function cadrer() {
		if (!carte || !mapboxgl) return;
		const points: [number, number][] = chantiers.map((c) => [c.lon, c.lat]);
		if (chezVous) points.push(chezVous);
		if (!points.length) {
			carte.setCenter(centre);
			carte.setZoom(11);
			return;
		}
		if (points.length === 1) {
			carte.setCenter(points[0]);
			carte.setZoom(13);
			return;
		}
		const bornes = points.reduce(
			(b, p) => b.extend(p),
			new mapboxgl.LngLatBounds(points[0], points[0])
		);
		carte.fitBounds(bornes, { padding: 52, maxZoom: 13.5, duration: 600 });
	}

	/**
	 * Fenêtre de recherche autour du secteur (≈ ±20 km). Sans elle, « 12 rue des
	 * Acacias » peut être géocodée à 500 km et recadrer la carte sur la France.
	 */
	const DELTA_LON = 0.3;
	const DELTA_LAT = 0.25;

	/** Adresse du client → coordonnées, via le géocodage Mapbox du projet. */
	async function localiserAdresse() {
		const token = env.PUBLIC_MAPBOX_TOKEN;
		if (!token || adresse.trim().length < 5) {
			chezVous = null;
			return;
		}
		const [lon, lat] = centre;
		const bbox = [lon - DELTA_LON, lat - DELTA_LAT, lon + DELTA_LON, lat + DELTA_LAT].join(',');
		try {
			const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
				adresse
			)}.json?country=fr&limit=1&language=fr&proximity=${lon},${lat}&bbox=${bbox}&access_token=${token}`;
			const res = await fetch(url);
			if (!res.ok) throw new Error('geocoding failed');
			const data = (await res.json()) as { features?: { center?: [number, number] }[] };
			const trouve = data.features?.[0]?.center ?? null;
			// Ceinture et bretelles : une adresse hors zone ne recadre pas la carte.
			chezVous =
				trouve && Math.abs(trouve[0] - lon) <= 0.6 && Math.abs(trouve[1] - lat) <= 0.5
					? trouve
					: null;
		} catch {
			// adresse introuvable : la carte reste centrée sur le secteur
			chezVous = null;
		}
	}

	/** Deux images d'attente : la boîte du dialogue a alors sa taille définitive. */
	function miseEnPagePrete() {
		return new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
	}

	onMount(() => {
		let dispose = false;
		let observateur: ResizeObserver | null = null;

		(async () => {
			const token = env.PUBLIC_MAPBOX_TOKEN;
			if (!token) {
				sansToken = true;
				return;
			}
			let module: ModuleMapbox;
			try {
				// Import dynamique : mapbox-gl ne passe pas le rendu serveur.
				({ default: module } = await import('mapbox-gl'));
			} catch {
				indisponible = true;
				return;
			}
			// Le dialogue s'ouvre avec une animation : créer la carte trop tôt ferait
			// mesurer un conteneur provisoire, et les marqueurs partiraient hors cadre.
			await miseEnPagePrete();
			if (dispose || !conteneur) return;

			mapboxgl = module;
			module.accessToken = token;
			carte = new module.Map({
				container: conteneur,
				style: getTheme() === 'light' ? LIGHT_STYLE_URL : STYLE_URL,
				center: centre,
				zoom: 11,
				attributionControl: false,
				// Cadre resserré : la carte montre le quartier, pas la région.
				maxZoom: 17,
				minZoom: 8
			});

			carte.on('load', () => {
				if (dispose) return;
				carte?.resize();
			});

			// Le panneau est redimensionné (mobile, ouverture du dialogue) : la carte
			// doit se recadrer sans attendre un événement de la fenêtre.
			observateur = new ResizeObserver(() => carte?.resize());
			observateur.observe(conteneur);

			await localiserAdresse();
			if (dispose) return;
			dessinerMarqueurs();
			cadrer();
		})();

		function onResize() {
			carte?.resize();
		}
		window.addEventListener('resize', onResize);

		return () => {
			dispose = true;
			window.removeEventListener('resize', onResize);
			observateur?.disconnect();
			observateur = null;
			for (const m of marqueurs) m.remove();
			marqueurs = [];
			carte?.remove();
			carte = null;
		};
	});

	// Les marqueurs suivent le regroupement : chaque clic sur un rond, dans la
	// liste ou sur la carte, redessine l'ensemble.
	$effect(() => {
		void chantiers;
		void retenus;
		void chezVous;
		if (carte) dessinerMarqueurs();
	});

	$effect(() => {
		void chantiers;
		void chezVous;
		if (carte) cadrer();
	});
</script>

<!--
	Un seul élément : Mapbox ajoute ses classes `mapboxgl-map` (dont
	`position: relative`) sur ce nœud. Un conteneur imbriqué en `absolute inset-0`
	perdrait sa position et se retrouverait haut de 0 px.
-->
<div
	bind:this={conteneur}
	class="h-56 w-full overflow-hidden rounded-2xl border border-line bg-card2 sm:h-64"
	class:invisible={sansToken || indisponible}
></div>

{#if sansToken || indisponible}
	<p
		class="flex items-start gap-2 rounded-2xl border border-line bg-card2 px-3 py-2 text-[11px] leading-snug text-ink-soft"
	>
		Cartographie indisponible : les chantiers du secteur restent listés ci-dessous{indisponible
			? '.'
			: ' — il manque le jeton Mapbox.'}
	</p>
{/if}
