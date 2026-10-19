<script lang="ts">
	import { untrack } from 'svelte';
	import { LoaderCircle, MapPin } from '@lucide/svelte';
	import { Input } from '$lib/components/ui/input/index.js';
	import { DEPARTEMENTS, departementDe } from '$lib/data/territoire';

	let {
		value = $bindable(''),
		placeholder = 'Adresse',
		max = 0,
		onPick,
		onEnter
	}: {
		value?: string;
		placeholder?: string;
		/** nombre de suggestions affichées (0 = toutes) */
		max?: number;
		/** appelée avec le libellé retenu quand on clique une suggestion */
		onPick?: (label: string) => void;
		/** appelée sur la touche Entrée */
		onEnter?: () => void;
	} = $props();

	type Suggestion = { label: string };

	let local = $state(value);
	let suggestions = $state<Suggestion[]>([]);
	let open = $state(false);
	let loading = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	// La saisie remonte au parent.
	$effect(() => {
		value = local;
	});

	// Le parent peut aussi la corriger — adresse résolue, remise à zéro — et on
	// reprend sa valeur sans écraser une saisie en cours.
	$effect(() => {
		const externe = value;
		untrack(() => {
			if (externe !== local) local = externe;
		});
	});

	function search(query: string) {
		clearTimeout(timer);
		if (!query || query.trim().length < 3) {
			suggestions = [];
			open = false;
			return;
		}
		timer = setTimeout(async () => {
			loading = true;
			suggestions = await chercher(query);
			open = suggestions.length > 0;
			loading = false;
		}, 300);
	}

	const ZONE_LIMIT = 20;
	const AILLEURS_LIMIT = 10;

	async function charger(url: string): Promise<string[]> {
		try {
			const res = await fetch(url);
			if (!res.ok) return [];
			const data = (await res.json()) as {
				features?: { properties?: { label?: string } }[];
			};
			const libelles: string[] = [];
			for (const f of data.features ?? []) {
				const label = f.properties?.label;
				if (label) libelles.push(label);
			}
			return libelles;
		} catch {
			return [];
		}
	}

	/**
	 * Les adresses du territoire d'abord. La Base Adresse Nationale classe ses
	 * résultats au niveau national : sans le filtre `depcode`, « rue de la Gare »
	 * ne renvoie aucune adresse du 37, 86, 72 ni 41. On interroge donc la zone à
	 * part, puis le reste de la France en complément.
	 */
	async function chercher(query: string): Promise<Suggestion[]> {
		const base = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&autocomplete=1&limit=`;
		const [zone, ailleurs] = await Promise.all([
			charger(`${base}${ZONE_LIMIT}&depcode=${DEPARTEMENTS.join(',')}`),
			charger(`${base}${AILLEURS_LIMIT}`)
		]);

		// Ordre des départements respecté (37, 86, 72, 41), les autres ensuite.
		const rang = (label: string) => {
			const i = DEPARTEMENTS.indexOf(departementDe(label) ?? '');
			return i < 0 ? DEPARTEMENTS.length : i;
		};
		const ordonnees = [...zone].sort((a, b) => rang(a) - rang(b));

		// Quelques dizaines de libellés au plus : un simple `includes` suffit à
		// écarter les doublons entre la zone et le reste de la France.
		const fusion: string[] = [];
		for (const label of [...ordonnees, ...ailleurs]) {
			if (fusion.includes(label)) continue;
			fusion.push(label);
		}

		const retenues = max > 0 ? fusion.slice(0, max) : fusion;
		return retenues.map((label) => ({ label }));
	}

	function pick(suggestion: Suggestion) {
		local = suggestion.label;
		value = suggestion.label;
		suggestions = [];
		open = false;
		onPick?.(suggestion.label);
	}
</script>

<div class="relative">
	<Input
		type="text"
		{placeholder}
		bind:value={local}
		oninput={() => search(local)}
		onkeydown={(e) => e.key === 'Enter' && onEnter?.()}
		class="border-input bg-base"
	/>

	{#if open || loading}
		<div
			class="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-line bg-card shadow-lg"
		>
			{#if loading}
				<div class="flex items-center gap-2 px-3 py-2 text-[12px] text-muted-foreground">
					<LoaderCircle class="size-3.5 animate-spin" />
					Recherche…
				</div>
			{:else}
				{#each suggestions as suggestion (suggestion.label)}
					<button
						type="button"
						onclick={() => pick(suggestion)}
						class="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] text-foreground transition-colors hover:bg-glass-2"
					>
						<MapPin class="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.7} />
						<span class="truncate">{suggestion.label}</span>
					</button>
				{/each}
			{/if}
		</div>
	{/if}
</div>
