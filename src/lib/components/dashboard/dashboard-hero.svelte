<script lang="ts">
	import { onMount } from 'svelte';
	import { useQuery } from 'convex-svelte';
	import { api } from '../../../convex/_generated/api.js';
	import { authState } from '$lib/auth-state.svelte';
	import { chargerMeteo, type MeteoJour } from '$lib/data/meteo';

	// Prénom de la personne connectée pour la présentation.
	const profile = useQuery(api.users.getProfile, () => (authState.isAuthenticated ? {} : 'skip'));
	const prenom = $derived.by(() => {
		const p = profile.data;
		return p?.firstName?.trim() || p?.email?.split('@')[0] || '';
	});

	// Horloge (précision à la minute) et météo horaire de Tours.
	let heure = $state(new Date());
	let meteo = $state<MeteoJour | null>(null);
	let chargement = $state(true);

	onMount(() => {
		const tick = setInterval(() => (heure = new Date()), 10_000);

		let annule = false;
		let essai: ReturnType<typeof setTimeout> | undefined;

		// Le proxy same-origin peut échouer ponctuellement : on retente deux fois.
		const charger = async (tentative = 0) => {
			const resultat = await chargerMeteo();
			if (annule) return;
			meteo = resultat;
			chargement = false;
			if (!resultat && tentative < 2) {
				essai = setTimeout(() => charger(tentative + 1), 4000);
			}
		};

		charger();
		const rafraichir = setInterval(() => charger(), 30 * 60 * 1000);

		return () => {
			annule = true;
			clearTimeout(essai);
			clearInterval(tick);
			clearInterval(rafraichir);
		};
	});

	const heureLabel = $derived(
		heure.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
	);

	const dateLabel = $derived.by(() => {
		const texte = heure.toLocaleDateString('fr-FR', {
			weekday: 'long',
			day: 'numeric',
			month: 'long'
		});
		return texte.charAt(0).toUpperCase() + texte.slice(1);
	});

	const heureCourante = $derived(heure.getHours());

	// Pile de polices explicite : garantit des émojis en couleur (Segoe UI Emoji
	// sur Windows) même si Inter est la police principale du document.
	const policeEmoji =
		"font-family: 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif";

	// 11 emplacements (9 h → 19 h) pour le squelette de chargement.
	const squelettes = Array.from({ length: 11 }, (_, rang) => rang);
</script>

<!-- Accueil du jour : présentation à gauche, frise météo 9 h → 19 h à droite. -->
<section
	class="flex flex-col gap-4 rounded-2xl bg-gradient-to-br from-brand/[0.07] via-card2/50 to-card2/25 p-4 sm:p-5 xl:flex-row xl:items-center xl:justify-between xl:gap-6"
	aria-labelledby="accueil-titre"
>
	<div class="min-w-0">
		<p class="text-[10.5px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
			{dateLabel}
		</p>
		<h1
			id="accueil-titre"
			class="mt-1 truncate font-display text-[22px] leading-tight font-semibold tracking-[-0.02em] text-foreground sm:text-[25px]"
		>
			Bonjour{prenom ? ` ${prenom}` : ''}
			<span class="ml-0.5 inline-block" aria-hidden="true">👋</span>
		</h1>
		<div class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-soft">
			<span>Il est <span class="font-semibold text-foreground">{heureLabel}</span></span>
			{#if meteo}
				<span class="text-ink-mute" aria-hidden="true">·</span>
				<span
					class="inline-flex items-center gap-1.5 rounded-full bg-glass-2 px-2.5 py-1 font-medium text-foreground"
					title="Températures de la journée à Tours"
				>
					<span class="text-[13px] leading-none" style={policeEmoji}>{meteo.matin.emoji}</span>
					<span class="tabular-nums">{meteo.min}° → {meteo.max}°</span>
				</span>
			{/if}
		</div>
	</div>

	<div class="min-w-0">
		<p class="mb-2 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
			Météo du jour à Tours
		</p>

		{#if meteo}
			<div
				class="flex [scrollbar-width:none] gap-1 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden"
			>
				{#each meteo.heures as h (h.heure)}
					<div
						class={[
							'flex w-[46px] shrink-0 flex-col items-center gap-1 rounded-xl py-2 tabular-nums transition-colors',
							h.heure === heureCourante
								? 'bg-primary text-primary-foreground shadow-sm'
								: 'bg-glass-1 text-ink-soft'
						].join(' ')}
						title={`${h.label} · ${h.temperature}°`}
					>
						<span class="text-[10px] font-medium">{h.label}</span>
						<span class="text-[15px] leading-none" style={policeEmoji}>{h.emoji}</span>
						<span class="text-[11.5px] font-semibold">{h.temperature}°</span>
					</div>
				{/each}
			</div>
		{:else if chargement}
			<div class="flex gap-1">
				{#each squelettes as rang (rang)}
					<div
						class="skeleton h-[62px] w-[46px] shrink-0 rounded-xl"
						style={`animation-delay: ${rang * 70}ms`}
					></div>
				{/each}
			</div>
		{:else}
			<p
				class="flex h-[62px] items-center rounded-xl bg-glass-1 px-3 text-[11.5px] text-muted-foreground"
			>
				Météo indisponible pour le moment.
			</p>
		{/if}
	</div>
</section>
