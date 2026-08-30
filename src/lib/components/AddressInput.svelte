<script lang="ts">
	import { LoaderCircle, MapPin } from '@lucide/svelte';
	import { Input } from '$lib/components/ui/input/index.js';

	let {
		value = $bindable(''),
		placeholder = 'Adresse'
	}: { value?: string; placeholder?: string } = $props();

	type Suggestion = { label: string };

	let local = $state(value);
	let suggestions = $state<Suggestion[]>([]);
	let open = $state(false);
	let loading = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		value = local;
	});

	function search(query: string) {
		clearTimeout(timer);
		if (!query || query.trim().length < 3) {
			suggestions = [];
			open = false;
			return;
		}			timer = setTimeout(async () => {
				loading = true;
				try {
					// Recherche large puis re-tri côté client : les adresses des départements
					// 37 (Indre-et-Loire), 41 (Loir-et-Cher), 72 (Sarthe) et 36 (Indre)
					// passent en premier, les autres suivent.
					const res = await fetch(
						`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=40&autocomplete=1`
					);
					const data = await res.json();
					const ZIP_PRIORITY = ['37', '41', '72', '36'];
					const inZone = (label: string) =>
						new RegExp(`\\b(${ZIP_PRIORITY.join('|')})\\d{3}\\b`).test(label);
					const features: { properties: { label: string } }[] = data.features ?? [];
					const mapped = features.map((f) => ({ label: f.properties.label, zone: inZone(f.properties.label) }));
					// Tri stable : la zone d'abord, puis ordre d'origine.
					mapped.sort((a, b) => Number(b.zone) - Number(a.zone));
					suggestions = mapped.map((m) => ({ label: m.label }));
					open = suggestions.length > 0;
				} catch {
					suggestions = [];
					open = false;
				} finally {
					loading = false;
				}
			}, 300);
	}

	function pick(suggestion: Suggestion) {
		local = suggestion.label;
		value = suggestion.label;
		suggestions = [];
		open = false;
	}
</script>

<div class="relative">
	<Input
		type="text"
		{placeholder}
		bind:value={local}
		oninput={() => search(local)}
		class="border-line bg-base"
	/>

	{#if open || loading}
		<div
			class="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-line bg-card shadow-lg"
		>
			{#if loading}
				<div
					class="flex items-center gap-2 px-3 py-2 text-[12px] text-muted-foreground"
				>
					<LoaderCircle class="size-3.5 animate-spin" />
					Recherche…
				</div>
			{:else}
				{#each suggestions as suggestion}
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
