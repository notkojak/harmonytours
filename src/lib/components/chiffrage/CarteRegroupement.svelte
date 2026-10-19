<script lang="ts">
	import { onMount } from 'svelte';
	import { env } from '$env/dynamic/public';
	import { getTheme } from '$lib/theme';
	import { BLEU_MARQUE, OMBRE_BLEUE } from '$lib/chiffrage-style';
	import { LIGHT_STYLE_URL, STYLE_URL, encreLibellesLieux } from '$lib/zones/colors.js';
	import 'mapbox-gl/dist/mapbox-gl.css';
	import type { Map as MapboxMap, Marker } from 'mapbox-gl';
	import {
		bornesZone,
		centreDesChantiers,
		cercleZone,
		distanceTexte,
		jourDe,
		type ChantierProgramme
	} from '$lib/data/regroupement';

	// La carte du visuel client : la maison, le rond du secteur de poses, puis les
	// chantiers programmés qui s'allument un par un. Lecture seule — on ne
	// regroupe rien ici, on montre.
	let {
		centre,
		maison = null,
		chantiers,
		visibles,
		onPret
	}: {
		/** position de la maison du client (à défaut, le centre du secteur) */
		centre: [number, number];
		maison?: [number, number] | null;
		chantiers: ChantierProgramme[];
		/** nombre de chantiers déjà allumés (l'animation est pilotée par le parent) */
		visibles: number;
		onPret?: () => void;
	} = $props();

	let conteneur: HTMLDivElement | null = $state(null);
	let carte: MapboxMap | null = $state(null);
	let sansToken = $state(false);
	let indisponible = $state(false);

	type ModuleMapbox = typeof import('mapbox-gl').default;
	let mapboxgl: ModuleMapbox | null = null;
	let marqueurs: { id: string; marker: Marker }[] = [];
	let observateurTheme: MutationObserver | null = null;

	// Les trois repères sont trois poids d'une seule teinte, le bleu de la
	// marque : la maison est pleine, un chantier programmé est un anneau creux,
	// la zone est un voile. C'est la forme qui distingue, pas la couleur.
	const MAISON_COULEUR = BLEU_MARQUE;
	const CHANTIER_COULEUR = BLEU_MARQUE;
	const ZONE_COULEUR = BLEU_MARQUE;

	/** Le foyer du client : le seul repère qui suit son adresse. */
	const foyer = $derived(maison ?? centre);
	/**
	 * Le rond se cale sur les chantiers programmés, pas sur la maison : c'est le
	 * secteur où nos équipes sont déjà à l'œuvre qu'on dessine. À défaut de
	 * chantier, faute de mieux, on retombe sur la maison.
	 */
	const centreZone = $derived(centreDesChantiers(chantiers) ?? foyer);

	const ICONE_MAISON =
		'<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#ffffff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/><path d="M10 21v-6h4v6"/></svg>';

	/** Marqueur d'un chantier programmé : la nature du chantier, jamais un nom. */
	function elementChantier(c: ChantierProgramme, i: number) {
		const date = jourDe(c.pose);
		const el = document.createElement('button');
		el.type = 'button';
		el.style.cssText = 'padding:0;border:0;background:none;cursor:pointer;';

		// La pastille vit dans un enfant : animer la racine écraserait le
		// `transform` par lequel Mapbox positionne le marqueur (il repartirait
		// dans le coin de la carte pendant l'animation).
		const pastille = document.createElement('span');
		pastille.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:3px;';

		const pin = document.createElement('span');
		// Anneau creux : fond clair, cercle bleu, glyphe bleu. C'est la maison du
		// client, pleine, qui doit rester le repère le plus fort.
		pin.style.cssText = `display:grid;place-items:center;width:30px;height:30px;border-radius:9999px;background:#ffffff;border:2.5px solid ${CHANTIER_COULEUR};box-shadow:0 8px 20px ${OMBRE_BLEUE};`;
		pin.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="${BLEU_MARQUE}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/></svg>`;

		const cap = document.createElement('span');
		cap.textContent = `${date.jour} ${date.mois}`;
		cap.style.cssText =
			'font-size:9.5px;font-weight:800;letter-spacing:.01em;color:#ffffff;background:rgba(2,6,23,.82);padding:1.5px 6px;border-radius:9999px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.25);';

		pastille.append(pin, cap);
		el.append(pastille);
		pastille.animate(
			[
				{ opacity: 0, transform: 'translateY(12px) scale(.45)' },
				{ opacity: 1, transform: 'none' }
			],
			{
				duration: 620,
				delay: Math.min(2, i) * 40,
				easing: 'cubic-bezier(.22,1,.36,1)',
				fill: 'backwards'
			}
		);
		el.addEventListener('click', (e) => {
			e.stopPropagation();
			ouvrirBulle(c, el);
		});
		return el;
	}

	/** Marqueur de la maison du client, avec un halo qui bat. */
	function elementMaison() {
		const el = document.createElement('div');
		el.style.cssText =
			'position:relative;display:flex;flex-direction:column;align-items:center;gap:3px;';

		const halo = document.createElement('span');
		halo.style.cssText = `position:absolute;top:5px;width:46px;height:46px;border-radius:9999px;background:${MAISON_COULEUR};opacity:.35;`;
		halo.animate(
			[
				{ transform: 'scale(.55)', opacity: 0.45 },
				{ transform: 'scale(2.3)', opacity: 0 }
			],
			{ duration: 2600, iterations: Infinity, easing: 'ease-out' }
		);

		const pin = document.createElement('span');
		pin.style.cssText = `position:relative;display:grid;place-items:center;width:42px;height:42px;border-radius:9999px;background:${MAISON_COULEUR};border:3px solid #ffffff;box-shadow:0 10px 26px ${OMBRE_BLEUE};`;
		pin.innerHTML = ICONE_MAISON;

		const cap = document.createElement('span');
		cap.textContent = 'Votre maison';
		cap.style.cssText = `font-size:10px;font-weight:800;color:#ffffff;background:${BLEU_MARQUE};padding:2px 8px;border-radius:9999px;white-space:nowrap;box-shadow:0 4px 14px ${OMBRE_BLEUE};`;

		el.append(halo, pin, cap);
		return el;
	}

	function ouvrirBulle(c: ChantierProgramme, el: HTMLElement) {
		if (!carte || !mapboxgl) return;
		new mapboxgl.Popup({ offset: 22, closeButton: false, maxWidth: '240px' })
			.setLngLat([c.lon, c.lat])
			.setHTML(
				`<div style="font-size:12px;line-height:1.4">
					<strong>Chantier programmé</strong><br />
					<span style="opacity:.8">${c.projet}</span><br />
					<span style="opacity:.6">Pose prévue le ${jourDe(c.pose).court} · ${distanceTexte(c.distance)}</span>
				</div>`
			)
			.addTo(carte);
		el.blur();
	}

	/** Le rond de la zone, ajouté (ou ré-ajouté) après chaque chargement de style. */
	function dessinerZone() {
		if (!carte) return;
		try {
			if (!carte.getSource('zone-regroupement')) {
				carte.addSource('zone-regroupement', { type: 'geojson', data: cercleZone(centreZone) });
			}
			if (!carte.getLayer('zone-regroupement-fill')) {
				carte.addLayer({
					id: 'zone-regroupement-fill',
					type: 'fill',
					source: 'zone-regroupement',
					paint: { 'fill-color': ZONE_COULEUR, 'fill-opacity': 0.13 }
				});
			}
			if (!carte.getLayer('zone-regroupement-trait')) {
				carte.addLayer({
					id: 'zone-regroupement-trait',
					type: 'line',
					source: 'zone-regroupement',
					paint: {
						'line-color': ZONE_COULEUR,
						'line-width': 1.6,
						'line-dasharray': [2.4, 1.6]
					}
				});
			}
			// Light-v11 écrit les villes en gris : en thème clair on les repasse à
			// l'encre, à chaque chargement de style.
			if (getTheme() === 'light') encreLibellesLieux(carte);
		} catch (err) {
			console.error('dessin de la zone de regroupement impossible', err);
		}
	}

	function dessinerMaison() {
		if (!carte || !mapboxgl) return;
		const existante = marqueurs.find((m) => m.id === 'maison');
		if (existante) {
			existante.marker.setLngLat(foyer);
			return;
		}
		marqueurs.push({
			id: 'maison',
			marker: new mapboxgl.Marker({ element: elementMaison(), anchor: 'bottom' })
				.setLngLat(foyer)
				.addTo(carte)
		});
	}

	/** N'allume que les nouveaux : les maisons déjà posées ne rejouent pas leur entrée. */
	function dessinerChantiers() {
		if (!carte || !mapboxgl) return;
		const voulus = chantiers.slice(0, Math.max(0, visibles));

		// Les maisons qui ne sont plus voulues s'éteignent (le temps que l'on rejoue).
		for (const m of marqueurs) {
			if (m.id !== 'maison' && !voulus.some((c) => c.id === m.id)) m.marker.remove();
		}
		marqueurs = marqueurs.filter((m) => m.id === 'maison' || voulus.some((c) => c.id === m.id));

		voulus.forEach((c, i) => {
			if (marqueurs.some((m) => m.id === c.id)) return;
			marqueurs.push({
				id: c.id,
				marker: new mapboxgl!.Marker({ element: elementChantier(c, i), anchor: 'bottom' })
					.setLngLat([c.lon, c.lat])
					.addTo(carte!)
			});
		});
	}

	/**
	 * Deux images d'attente : le dialogue a alors sa taille définitive. Le
	 * minuteur prend le relais si `requestAnimationFrame` ne bat plus (onglet
	 * en arrière-plan) : sans lui, la carte ne s'afficherait jamais.
	 */
	function miseEnPagePrete() {
		return Promise.race([
			new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
			new Promise<void>((r) => setTimeout(r, 400))
		]);
	}

	onMount(() => {
		let dispose = false;
		let observateur: ResizeObserver | null = null;
		let minuteurPret: ReturnType<typeof setTimeout> | null = null;

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
			await miseEnPagePrete();
			if (dispose || !conteneur) return;

			mapboxgl = module;
			module.accessToken = token;
			const m = new module.Map({
				container: conteneur,
				style: getTheme() === 'light' ? LIGHT_STYLE_URL : STYLE_URL,
				center: centreZone,
				zoom: 9.6,
				attributionControl: false,
				// La carte se promène, mais ne vole pas le défilement de la page.
				scrollZoom: false,
				maxZoom: 17,
				minZoom: 9
			});
			carte = m;
			(window as unknown as Record<string, unknown>).__carteRegroupement = m;
			m.dragRotate.disable();
			m.touchZoomRotate.disableRotation();

			m.on('load', () => {
				if (dispose) return;
				m.resize();
				dessinerZone();
				dessinerMaison();
				dessinerChantiers();
				// Le mouvement de caméra : on part large et on plonge sur la zone, en
				// gardant la maison du client dans le cadre.
				const [sudOuest, nordEst] = bornesZone(centreZone);
				const bornes = new module.LngLatBounds(sudOuest, nordEst);
				bornes.extend(foyer);
				m.fitBounds(bornes, {
					padding: 44,
					duration: 2400,
					maxZoom: 15.2,
					essential: true
				});
				minuteurPret = setTimeout(() => {
					if (!dispose) onPret?.();
				}, 1900);
			});

			// Un changement de style (thème) efface les couches : on les repose.
			let clair = getTheme() === 'light';
			observateurTheme = new MutationObserver(() => {
				const maintenantClair = getTheme() === 'light';
				if (maintenantClair === clair) return;
				clair = maintenantClair;
				m.setStyle(maintenantClair ? LIGHT_STYLE_URL : STYLE_URL);
				m.once('style.load', () => dessinerZone());
			});
			observateurTheme.observe(document.documentElement, {
				attributes: true,
				attributeFilter: ['class']
			});

			observateur = new ResizeObserver(() => m.resize());
			observateur.observe(conteneur);
		})();

		function onResize() {
			carte?.resize();
		}
		window.addEventListener('resize', onResize);

		return () => {
			dispose = true;
			window.removeEventListener('resize', onResize);
			if (minuteurPret) clearTimeout(minuteurPret);
			observateur?.disconnect();
			observateur = null;
			observateurTheme?.disconnect();
			observateurTheme = null;
			for (const m of marqueurs) m.marker.remove();
			marqueurs = [];
			carte?.remove();
			carte = null;
		};
	});

	$effect(() => {
		void chantiers;
		void visibles;
		void maison;
		if (carte) dessinerChantiers();
	});
</script>

<div
	bind:this={conteneur}
	class="h-64 w-full overflow-hidden rounded-3xl border border-line bg-card2 sm:h-[22rem]"
	class:invisible={sansToken || indisponible}
></div>

{#if sansToken || indisponible}
	<div
		class="flex h-52 w-full flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-line bg-card2/60 px-6 text-center"
	>
		<span class="text-2xl">🗺️</span>
		<p class="text-[12px] leading-snug text-ink-soft">
			La carte du quartier ne peut pas s’afficher ici{indisponible
				? '.'
				: ' : il manque le jeton Mapbox.'}
			<br />Les chantiers programmés restent listés juste en dessous.
		</p>
	</div>
{/if}
