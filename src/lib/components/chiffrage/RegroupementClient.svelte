<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { ChevronRight, MapPin, Search, Sparkles, TriangleAlert } from '@lucide/svelte';
	import { Dialog, DialogContent } from '$lib/components/ui/dialog/index.js';
	import { env } from '$env/dynamic/public';
	import {
		chantiersProgrammes,
		chargerChantiers,
		distanceTexte,
		jourDe,
		moisAnneeDe,
		POINTS_A_VALIDER,
		RAYON_ZONE,
		sauverChantiers,
		type ChantierProgramme,
		type PointAValider
	} from '$lib/data/regroupement';
	import { BBOX_TERRITOIRE, dansLeTerritoire } from '$lib/data/territoire';
	import AddressInput from '$lib/components/AddressInput.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import CarteRegroupement from './CarteRegroupement.svelte';
	import {
		CARTE_ALERTE,
		CARTE_SUCCES,
		CTA_MUET,
		SUCCES_PLEIN,
		TEXTE_ALERTE,
		TEXTE_SUCCES
	} from '$lib/chiffrage-style';

	// Le visuel que l'on met sous les yeux du client, en trois temps :
	//   1 · les quatre conditions du regroupement,
	//   2 · l'adresse de sa maison, pour la placer sur la carte,
	//   3 · la carte qui s'anime — sa maison, le rond de la zone, et les chantiers
	//       programmés du quartier qui s'allument un à un.
	// Rien de la mécanique interne n'apparaît ici : ni objection, ni thème, ni
	// seuil, ni remise, ni appel de responsable.
	let {
		open = $bindable(false),
		centre = [0.6886, 47.3941] as [number, number],
		adresse = $bindable(''),
		famille = '',
		onTerminer
	}: {
		open?: boolean;
		/** repli quand l'adresse du client n'a pas pu être localisée */
		centre?: [number, number];
		adresse?: string;
		/** famille du book du produit vendu : les poses montrées en sont cousines */
		famille?: string;
		onTerminer?: (adresse: string) => void;
	} = $props();

	// ------------------------------------------------- Étape 1 · les conditions
	let points = $state<Record<string, boolean>>({});
	let secoue = $state(0);

	const pointsValides = $derived(POINTS_A_VALIDER.filter((p) => points[p.id]).length);
	const toutValide = $derived(pointsValides === POINTS_A_VALIDER.length);

	function basculer(p: PointAValider) {
		points[p.id] = !points[p.id];
	}

	// ----------------------------------------------------- Étape 2 · l'adresse
	let adresseSaisie = $state('');
	let localisation = $state(false);
	let adresseRatee = $state(false);
	/** position de la maison, une fois l'adresse localisée */
	let maison = $state<[number, number] | null>(null);
	/** commune du client : on ne montre jamais de pose chez lui */
	let communeClient = $state('');

	async function localiser() {
		if (adresseSaisie.trim().length < 5 || localisation) return;
		localisation = true;
		adresseRatee = false;
		const token = env.PUBLIC_MAPBOX_TOKEN;
		if (!token) {
			// Sans jeton, on ne peut pas poser la maison : on se rabat sur le secteur.
			replierSurSecteur();
			return;
		}
		const [lon, lat] = centre;
		// La recherche reste bornée au territoire de l'agence (37, 86, 72, 41) :
		// « 12 rue des Acacias » ne doit pas pouvoir partir à 500 km.
		const bbox = [
			BBOX_TERRITOIRE.lonMin,
			BBOX_TERRITOIRE.latMin,
			BBOX_TERRITOIRE.lonMax,
			BBOX_TERRITOIRE.latMax
		].join(',');
		try {
			const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
				adresseSaisie
			)}.json?country=fr&limit=1&language=fr&proximity=${lon},${lat}&bbox=${bbox}&access_token=${token}`;
			const res = await fetch(url);
			if (!res.ok) throw new Error('géocodage indisponible');
			const data = (await res.json()) as {
				features?: {
					center?: [number, number];
					place_name?: string;
					context?: { id?: string; text?: string }[];
				}[];
			};
			const resultat = data.features?.[0];
			const trouve = resultat?.center ?? null;
			// Ceinture et bretelles : une adresse hors territoire ne recadre pas la carte.
			if (!trouve || !dansLeTerritoire(trouve[0], trouve[1])) {
				adresseRatee = true;
				return;
			}
			maison = trouve;
			adresse = (resultat?.place_name ?? adresseSaisie).trim();
			adresseSaisie = adresse;
			// Mapbox range la commune dans son contexte : « place.Joué-lès-Tours ».
			communeClient = resultat?.context?.find((c) => c.id?.startsWith('place.'))?.text ?? '';
		} catch {
			adresseRatee = true;
		} finally {
			localisation = false;
		}
	}

	/** Sans adresse localisable, la démonstration se fait sur le secteur connu. */
	function replierSurSecteur() {
		maison = centre;
		communeClient = '';
		adresse = adresseSaisie.trim() || 'Secteur d’intervention';
		adresseSaisie = adresse;
		adresseRatee = false;
		localisation = false;
	}

	// ----------------------------------------------- Étape 3 · l'animation
	let phase = $state<1 | 2 | 3>(1);
	let visibles = $state(0);
	let minuteur: ReturnType<typeof setInterval> | null = null;
	let depart: ReturnType<typeof setTimeout> | null = null;
	let enAnimation = false;

	// Les maisons du visuel : mémorisées sur l'appareil pour cette adresse (et
	// cette famille de produit), afin de revoir exactement les mêmes à chaque
	// ouverture. Une nouvelle adresse relance la sélection.
	let programmes = $state<ChantierProgramme[]>([]);

	function preparerChantiers() {
		const memorisees = chargerChantiers(adresse, famille);
		programmes = memorisees ?? chantiersProgrammes(maison ?? centre, communeClient, famille);
		if (!memorisees) sauverChantiers(adresse, famille, programmes);
	}
	const allumes = $derived(programmes.slice(0, visibles));
	const enCours = $derived(visibles < programmes.length);
	const premierJour = $derived(allumes.length ? Math.min(...allumes.map((c) => c.pose)) : 0);
	const plusProche = $derived(allumes.length ? allumes[0].distance : 0);

	function stopper() {
		if (minuteur) clearInterval(minuteur);
		if (depart) clearTimeout(depart);
		minuteur = null;
		depart = null;
	}

	/**
	 * Allume les chantiers un à un. Appelée soit par la carte quand sa plongée est
	 * finie, soit par le minuteur de secours — le garde évite de repartir deux fois.
	 */
	function demarrerAnimation() {
		if (enAnimation) return;
		enAnimation = true;
		stopper();
		visibles = 0;
		depart = setTimeout(() => {
			minuteur = setInterval(() => {
				if (visibles >= programmes.length) {
					stopper();
					return;
				}
				visibles += 1;
			}, 420);
		}, 420);
	}

	/** Conditions validées → on demande l'adresse, qui sert à situer la maison. */
	function demanderLeRegroupement() {
		if (!toutValide) {
			secoue += 1;
			return;
		}
		phase = 2;
	}

	/** Adresse trouvée → la carte s'ouvre et l'animation démarre. */
	function ouvrirLaCarte() {
		if (!maison) return;
		preparerChantiers();
		phase = 3;
		stopper();
		enAnimation = false;
		visibles = 0;
		// La carte prévient quand sa plongée est finie ; ce minuteur n'est qu'un
		// filet, au cas où elle ne répondrait pas (jeton Mapbox absent, réseau).
		depart = setTimeout(demarrerAnimation, 2600);
	}

	function terminer() {
		open = false;
		onTerminer?.(adresse);
	}

	// Repartir d'un visuel vierge à chaque ouverture. L'adresse de départ est lue
	// hors piste : c'est une prop liée, et l'écrire (localisation) doit rester
	// sans effet sur cette remise à zéro.
	$effect(() => {
		if (open) {
			const adresseDeDepart = untrack(() => adresse);
			points = {};
			adresseSaisie = adresseDeDepart;
			localisation = false;
			adresseRatee = false;
			secoue = 0;
			maison = null;
			communeClient = '';
			programmes = [];
			phase = 1;
			visibles = 0;
			stopper();
			enAnimation = false;
		} else {
			stopper();
			enAnimation = false;
		}
	});

	onDestroy(stopper);

	const ETAPES = [
		{ n: 1, nom: 'Vos conditions' },
		{ n: 2, nom: 'Votre adresse' },
		{ n: 3, nom: 'Le regroupement' }
	];
</script>

<Dialog bind:open>
	<DialogContent
		class="max-h-[94vh] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-4xl"
		showCloseButton={false}
	>
		<!-- En-tête : la seule chose que le client voit arriver, donc la plus soignée. -->
		<header class="relative overflow-hidden border-b border-line px-5 py-4 sm:px-7 sm:py-5">
			<div
				class="pointer-events-none absolute -top-24 -right-16 size-56 rounded-full bg-brand/12 blur-3xl"
			></div>

			<div class="relative flex items-start gap-3.5">
				<span class="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand text-white">
					<MapPin class="size-5" strokeWidth={2.1} />
				</span>
				<div class="min-w-0 flex-1">
					<p class="text-[10.5px] font-bold tracking-[0.14em] {TEXTE_SUCCES} uppercase">
						Bravaux · votre quartier
					</p>
					<h2 class="mt-0.5 text-[19px] leading-tight font-extrabold text-ink sm:text-[22px]">
						Regroupement de chantier
					</h2>
					<p class="mt-1 text-[12px] leading-snug text-ink-soft sm:text-[12.5px]">
						{#if phase === 1}
							Les quatre conditions qui ouvrent votre demande de regroupement.
						{:else if phase === 2}
							Où se trouve votre maison ? On vous la place sur la carte.
						{:else}
							Votre maison et les chantiers programmés de votre secteur.
						{/if}
					</p>
				</div>
				<Button
					variant="ghost"
					size="xs"
					class="relative shrink-0"
					title="Fermer"
					onclick={terminer}
				>
					Fermer
				</Button>
			</div>

			<!-- Fil des trois temps -->
			<div class="relative mt-3.5 flex items-center gap-2">
				{#each ETAPES as e (e.n)}
					{@const actif = phase === e.n}
					{@const fait = phase > e.n}
					<span
						class="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors {actif
							? 'bg-brand text-white'
							: fait
								? 'bg-brand/15 text-brand'
								: 'bg-glass-2 text-ink-mute'}"
					>
						<span
							class="grid size-4 place-items-center rounded-full text-[9.5px] {actif
								? 'bg-white/25'
								: ''}"
						>
							{fait ? '✓' : e.n}
						</span>
						{e.nom}
					</span>
					{#if e.n < ETAPES.length}
						<span class="h-px flex-1 rounded-full bg-line"></span>
					{/if}
				{/each}
			</div>
		</header>

		<div class="overflow-y-auto px-5 py-4 sm:px-7 sm:py-5">
			{#if phase === 1}
				<!-- --------------------------------------------------- LES CONDITIONS -->
				<div class="space-y-2.5">
					{#each POINTS_A_VALIDER as p, i (p.id)}
						{@const actif = !!points[p.id]}
						<button
							type="button"
							onclick={() => basculer(p)}
							class="flex w-full animate-in items-start gap-3 rounded-2xl border p-3.5 text-left transition-colors duration-300 fade-in slide-in-from-bottom-2 {actif
								? CARTE_SUCCES
								: 'border-line bg-card2/60 hover:bg-glass-2/60'}"
							style="animation-delay:{i * 70}ms;animation-fill-mode:both"
						>
							<span
								class="grid size-10 shrink-0 place-items-center rounded-full border text-lg transition-colors {actif
									? 'border-brand/40 bg-brand/15'
									: 'border-input bg-base'}"
							>
								{p.emoji}
							</span>
							<span class="min-w-0 flex-1">
								<span class="block text-[13px] font-bold text-ink">{p.titre}</span>
								<span class="mt-0.5 block text-[11.5px] leading-snug text-ink-soft">{p.aide}</span>
							</span>
							<span
								class="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border transition-all duration-300 {actif
									? 'scale-100 border-brand bg-brand text-white'
									: 'border-line-strong text-transparent'}"
							>
								<svg
									viewBox="0 0 24 24"
									width="13"
									height="13"
									fill="none"
									stroke="currentColor"
									stroke-width="3.4"
									stroke-linecap="round"
									stroke-linejoin="round"><path d="m5 13 4 4L19 7" /></svg
								>
							</span>
						</button>
					{/each}
				</div>

				<!-- Progression + appel à l'action -->
				<div class="mt-4 rounded-2xl border border-line bg-card2/60 px-3.5 py-3">
					<div class="flex items-center justify-between gap-3">
						<p class="text-[12px] font-semibold text-ink">
							{pointsValides}/{POINTS_A_VALIDER.length} conditions validées
						</p>
						<span class="flex items-center gap-1">
							{#each POINTS_A_VALIDER as p (p.id)}
								<span
									class="h-1.5 w-6 rounded-full transition-colors duration-300 {points[p.id]
										? 'bg-brand'
										: 'bg-glass-3'}"
								></span>
							{/each}
						</span>
					</div>
					{#key secoue}
						<div class={secoue > 0 ? 'secouer mt-2.5' : 'mt-2.5'}>
							<Button
								variant={toutValide ? 'default' : 'ghost'}
								class="relative w-full overflow-hidden transition-all duration-300 {toutValide
									? ''
									: CTA_MUET}"
								onclick={demanderLeRegroupement}
							>
								{#if toutValide}
									<Sparkles class="size-4" strokeWidth={2.1} />
									Demander le regroupement de chantier
									<ChevronRight class="size-4" strokeWidth={2.4} />
								{:else}
									Encore {POINTS_A_VALIDER.length - pointsValides} condition{POINTS_A_VALIDER.length -
										pointsValides >
									1
										? 's'
										: ''} à valider
								{/if}
							</Button>
						</div>
					{/key}
					{#if !toutValide && secoue > 0}
						<p class="mt-1.5 text-center text-[11px] {TEXTE_ALERTE}">
							Touchez chacune des conditions ci-dessus pour les valider.
						</p>
					{/if}
				</div>
			{:else if phase === 2}
				<!-- ------------------------------------------------------ L'ADRESSE -->
				<div class="space-y-3">
					<div
						class="animate-in rounded-2xl border border-line bg-card2/60 px-3.5 py-3.5 fade-in slide-in-from-bottom-2"
					>
						<p class="flex items-center gap-2 text-[13px] font-bold text-ink">
							<MapPin class="size-4 {TEXTE_SUCCES}" strokeWidth={2.1} />
							Où se trouve votre maison ?
						</p>
						<p class="mt-1 text-[11.5px] leading-snug text-ink-soft">
							C’est l’adresse du chantier. Elle situe votre maison sur la carte ; les chantiers
							programmés se dessinent autour de votre secteur.
						</p>
						<div class="mt-2.5 flex flex-wrap gap-2">
							<div class="min-w-52 flex-1">
								<AddressInput
									bind:value={adresseSaisie}
									max={6}
									placeholder="12 rue des Acacias, Tours Nord"
									onPick={() => localiser()}
									onEnter={localiser}
								/>
							</div>
							<Button
								disabled={localisation || adresseSaisie.trim().length < 5}
								onclick={localiser}
							>
								<Search class="size-4" strokeWidth={2.2} />
								{localisation ? 'Localisation…' : 'Localiser ma maison'}
							</Button>
						</div>
						{#if adresseRatee}
							<div
								class="mt-2 flex flex-wrap items-center gap-2 rounded-2xl border {CARTE_ALERTE} px-2.5 py-2"
							>
								<p class="flex items-center gap-1.5 text-[11px] {TEXTE_ALERTE}">
									<TriangleAlert class="size-3.5 shrink-0" strokeWidth={2.2} />
									Adresse introuvable. Vérifiez la saisie, ou continuez sur le secteur.
								</p>
								<Button variant="destructive" size="xs" class="ml-auto" onclick={replierSurSecteur}>
									Continuer sur le secteur
								</Button>
							</div>
						{/if}
					</div>

					{#if maison}
						<div
							class="animate-in rounded-2xl border {CARTE_SUCCES} px-3.5 py-3 fade-in slide-in-from-bottom-2"
						>
							<p class="flex items-center gap-2 text-[12.5px] font-bold text-ink">
								<span class="grid size-5 place-items-center rounded-full {SUCCES_PLEIN}">
									<svg
										viewBox="0 0 24 24"
										width="12"
										height="12"
										fill="none"
										stroke="currentColor"
										stroke-width="3.4"
										stroke-linecap="round"
										stroke-linejoin="round"><path d="m5 13 4 4L19 7" /></svg
									>
								</span>
								Votre maison est placée
							</p>
							<p class="mt-1 truncate text-[11.5px] text-ink-soft">{adresse}</p>
						</div>
					{/if}
				</div>
			{:else}
				<!-- ------------------------------------------------- LE REGROUPEMENT -->
				<div class="space-y-3">
					<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
						<div
							class="animate-in rounded-2xl border border-line bg-card2/60 px-3 py-2.5 zoom-in-95 fade-in"
						>
							<p class="text-[10px] font-bold tracking-wider text-ink-mute uppercase">
								Chantiers programmés
							</p>
							<p class="mt-0.5 text-[22px] leading-none font-extrabold text-ink tabular-nums">
								{visibles}
								<span class="text-[13px] font-bold text-ink-mute">/{programmes.length}</span>
							</p>
						</div>
						<div
							class="animate-in rounded-2xl border border-line bg-card2/60 px-3 py-2.5 zoom-in-95 fade-in"
							style="animation-delay:70ms;animation-fill-mode:both"
						>
							<p class="text-[10px] font-bold tracking-wider text-ink-mute uppercase">
								Poses à partir de
							</p>
							<p class="mt-0.5 text-[15px] leading-tight font-extrabold text-ink">
								{premierJour ? moisAnneeDe(premierJour) : '—'}
							</p>
						</div>
						<div
							class="col-span-2 animate-in rounded-2xl border border-line bg-card2/60 px-3 py-2.5 zoom-in-95 fade-in sm:col-span-1"
							style="animation-delay:140ms;animation-fill-mode:both"
						>
							<p class="text-[10px] font-bold tracking-wider text-ink-mute uppercase">
								Zone des chantiers
							</p>
							<p class="mt-0.5 text-[15px] leading-tight font-extrabold text-ink">
								{(RAYON_ZONE / 1000).toFixed(0)} km de rayon autour des poses
							</p>
						</div>
					</div>

					<CarteRegroupement
						{centre}
						{maison}
						chantiers={programmes}
						{visibles}
						onPret={demarrerAnimation}
					/>

					<div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1">
						<span class="flex items-center gap-1.5 text-[11px] text-ink-soft">
							<span class="size-2.5 rounded-full bg-brand ring-2 ring-white/70"></span>
							Votre maison
						</span>
						<span class="flex items-center gap-1.5 text-[11px] text-ink-soft">
							<span class="size-2.5 rounded-full border-2 border-brand bg-base"></span>
							Chantier programmé
						</span>
						<span class="flex items-center gap-1.5 text-[11px] text-ink-soft">
							<span class="size-2.5 rounded-full bg-brand/25"></span>
							Zone des chantiers
						</span>
						{#if allumes.length}
							<span class="ml-auto text-[11px] font-semibold text-ink-soft">
								Le plus proche : {distanceTexte(plusProche)}
							</span>
						{/if}
					</div>

					<!-- La piste des poses, qui se remplit au rythme de la carte -->
					<div class="rounded-2xl border border-line bg-card2/60 px-3.5 py-3">
						<div class="flex items-center justify-between gap-3">
							<p class="text-[12px] font-semibold text-ink">Les poses prévues dans votre zone</p>
							<span class="text-[11px] font-semibold text-ink-mute tabular-nums">
								{allumes.length}/{programmes.length}
							</span>
						</div>
						<div
							class="mt-2 h-2 overflow-hidden rounded-full bg-glass-3 ring-1 ring-inset {enCours
								? 'ring-transparent'
								: 'ring-destructive/25'}"
						>
							<div
								class="h-full rounded-full transition-all duration-500 {enCours
									? 'bg-brand'
									: 'bg-destructive'}"
								style="width:{programmes.length ? (allumes.length / programmes.length) * 100 : 0}%"
							></div>
						</div>
						<div class="mt-2.5 space-y-1.5">
							{#each allumes as c (c.id)}
								{@const j = jourDe(c.pose)}
								<div
									class="flex animate-in items-center gap-2.5 rounded-2xl border border-line bg-base px-2.5 py-2 fade-in slide-in-from-bottom-2"
								>
									<span
										class="grid size-8 shrink-0 place-items-center rounded-full bg-brand/15 text-[10px] font-extrabold text-brand"
									>
										{j.jour}
									</span>
									<span class="min-w-0 flex-1">
										<span class="block truncate text-[12px] font-semibold text-ink">{c.projet}</span
										>
										<span class="block text-[10.5px] text-ink-soft">
											{j.court} · {distanceTexte(c.distance)} de chez vous
										</span>
									</span>
									<span
										class="shrink-0 rounded-full bg-glass-3 px-2 py-0.5 text-[10px] font-semibold text-ink-soft"
									>
										programmé
									</span>
								</div>
							{/each}
						</div>
					</div>

					<!-- Conclusion : le temps fort, une fois la carte remplie. Le constat
					     doit sauter aux yeux : bandeau rouge plein, titre en capitales. -->
					{#if !enCours}
						<div
							class="animate-in overflow-hidden rounded-2xl border-2 border-destructive/45 shadow-lg shadow-destructive/10 fade-in slide-in-from-bottom-2"
						>
							<div class="flex items-center gap-2.5 bg-destructive px-4 py-3 text-white">
								<span class="grid size-7 shrink-0 place-items-center rounded-full bg-white/20">
									<TriangleAlert class="size-4" strokeWidth={2.8} />
								</span>
								<div class="min-w-0">
									<p class="text-[14px] leading-tight font-black tracking-[0.04em] uppercase">
										Plus de place
									</p>
									<p class="text-[11px] font-semibold text-white/85">
										{programmes.length}/{programmes.length} sur le prochain regroupement
									</p>
								</div>
							</div>
							<div class="bg-destructive/8 px-4 py-3">
								<p class="text-[12.5px] leading-snug font-semibold {TEXTE_ALERTE}">
									Les {programmes.length} places du prochain regroupement sont déjà prises : votre demande
									ne peut pas être acceptée.
								</p>
								<p class="mt-1 text-[11.5px] leading-snug text-ink-soft">
									Contactez la supervision pour étudier votre dossier.
								</p>
							</div>
						</div>
					{:else}
						<p class="flex items-center gap-2 px-1 text-[11.5px] text-ink-soft">
							<Sparkles class="size-3.5 animate-pulse {TEXTE_SUCCES}" strokeWidth={2} />
							Les chantiers du secteur s’allument un à un sur la carte…
						</p>
					{/if}
				</div>
			{/if}
		</div>

		<footer class="border-t border-line px-5 py-3 sm:px-7">
			{#if phase === 1}
				<p class="text-center text-[11px] text-ink-mute">
					Rien n’est engagé : ces conditions servent uniquement à préparer votre demande.
				</p>
			{:else if phase === 2}
				<div class="flex items-center justify-between gap-2">
					<Button variant="outline" onclick={() => (phase = 1)}>Retour aux conditions</Button>
					<Button
						variant={maison ? 'default' : 'ghost'}
						disabled={!maison}
						class={maison ? '' : `${CTA_MUET} disabled:opacity-100`}
						onclick={ouvrirLaCarte}
					>
						{#if maison}
							Voir les chantiers de mon quartier
							<ChevronRight class="size-4" strokeWidth={2.4} />
						{:else}
							Localisez d’abord votre maison
						{/if}
					</Button>
				</div>
			{:else}
				<Button class="w-full" onclick={terminer}>
					Terminer
					<ChevronRight class="size-4" strokeWidth={2.4} />
				</Button>
			{/if}
		</footer>
	</DialogContent>
</Dialog>

<style>
	/* Secousse quand on demande le regroupement sans avoir tout validé. */
	@keyframes secouer {
		0%,
		100% {
			transform: translateX(0);
		}
		20% {
			transform: translateX(-5px);
		}
		40% {
			transform: translateX(5px);
		}
		60% {
			transform: translateX(-3px);
		}
		80% {
			transform: translateX(3px);
		}
	}
	.secouer {
		animation: secouer 420ms ease-in-out;
	}
</style>
