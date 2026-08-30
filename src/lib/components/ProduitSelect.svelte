<script lang="ts">
	import { FAMILLES, produitsOf, familleOf } from '$lib/data/catalogue';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select/index.js';

	let {
		produit = $bindable(''),
		famille = $bindable(''),
		label = 'Produit',
		produitPlaceholder = 'Choisir un produit'
	}: {
		produit?: string;
		famille?: string;
		label?: string;
		produitPlaceholder?: string;
	} = $props();

	// Édition : si un produit est déjà renseigné, on retrouve sa famille.
	$effect(() => {
		const f = familleOf(produit);
		if (produit && f && famille !== f) {
			famille = f;
		} else if (!famille) {
			famille = FAMILLES[0] ?? '';
		}
	});

	function onFamilleChange(newFamille: string) {
		if (newFamille === famille) return;
		famille = newFamille;
		produit = '';
	}
</script>

<div class="space-y-1.5">
	<Label>{label}</Label>
	<Select type="single" value={famille} onValueChange={(v) => onFamilleChange(v as string)}>
		<SelectTrigger class="w-full border-line bg-base text-[12.5px]">
			<span data-slot="select-value">{famille || 'Choisir une famille'}</span>
		</SelectTrigger>
		<SelectContent class="max-h-64 overflow-y-auto">
			{#each FAMILLES as f}
				<SelectItem value={f}>{f}</SelectItem>
			{/each}
		</SelectContent>
	</Select>
	{#if famille}
		<Select type="single" bind:value={produit}>
			<SelectTrigger class="w-full border-line bg-base text-[12.5px]">
				<span data-slot="select-value">{produit || produitPlaceholder}</span>
			</SelectTrigger>
			<SelectContent class="max-h-64 overflow-y-auto">
				{#each produitsOf(famille) as p}
					<SelectItem value={p}>{p}</SelectItem>
				{/each}
			</SelectContent>
		</Select>
	{/if}
</div>