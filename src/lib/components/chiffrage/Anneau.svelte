<script lang="ts">
	import type { Snippet } from 'svelte';

	// Anneau de progression : sert au chrono d'objections comme au rond de date
	// des chantiers. L'arc se remplit par transition CSS, donc il s'anime tout
	// seul dès que `progres` change.
	//
	// Les teintes suivent la charte (voir $lib/chiffrage-style) : `primary` pour
	// un état neutre ou acquis dans l'application, `brand` pour un acquis côté
	// marque, `brand-soft` pour un cran en dessous (échéance plus lointaine),
	// `danger` pour ce qui sort du périmètre, `muted` pour le reste.
	export type TeinteAnneau = 'primary' | 'brand' | 'brand-soft' | 'danger' | 'muted';

	let {
		progres,
		taille = 44,
		epaisseur = 3,
		ton = 'primary',
		children
	}: {
		progres: number;
		taille?: number;
		epaisseur?: number;
		ton?: TeinteAnneau;
		children?: Snippet;
	} = $props();

	const TEINTES: Record<TeinteAnneau, string> = {
		primary: 'stroke-primary',
		brand: 'stroke-brand',
		'brand-soft': 'stroke-brand/55',
		danger: 'stroke-destructive',
		muted: 'stroke-ink-mute'
	};

	const r = $derived((taille - epaisseur) / 2);
	const circonference = $derived(2 * Math.PI * r);
	const part = $derived(Math.min(1, Math.max(0, progres)));
</script>

<div
	class="relative grid shrink-0 place-items-center"
	style="width:{taille}px;height:{taille}px"
	role="img"
	aria-label="{Math.round(part * 100)} %"
>
	<svg width={taille} height={taille} class="-rotate-90">
		<circle
			cx={taille / 2}
			cy={taille / 2}
			{r}
			fill="none"
			stroke-width={epaisseur}
			class="stroke-line"
		/>
		<circle
			cx={taille / 2}
			cy={taille / 2}
			{r}
			fill="none"
			stroke-width={epaisseur}
			stroke-linecap="round"
			class={TEINTES[ton]}
			style="stroke-dasharray:{circonference};stroke-dashoffset:{circonference *
				(1 - part)};transition:stroke-dashoffset 700ms cubic-bezier(0.22, 1, 0.36, 1)"
		/>
	</svg>
	<div class="absolute inset-0 grid place-items-center">{@render children?.()}</div>
</div>
