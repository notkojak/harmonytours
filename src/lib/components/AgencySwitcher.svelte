<script lang="ts">
	import { Building2, ChevronsUpDown } from '@lucide/svelte';
	import { useQuery } from 'convex-svelte';
	import { api } from '../../convex/_generated/api.js';
	import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover/index.js';
	import { authState } from '$lib/auth-state.svelte';

	// Agences visibles par l'utilisateur connecté (selon son rôle).
	const agences = useQuery(api.agences.list, () => (authState.isAuthenticated ? {} : 'skip'));
	const available = $derived(agences.data ?? []);

	let current = $state('');

	$effect(() => {
		if (available.length > 0 && !available.some((a) => a.name === current)) {
			current = available[0].name;
		}
	});

	function agencyLabel(name: string): string {
		return name.startsWith('Agence de ') ? name : `Agence de ${name}`;
	}
</script>

<Popover>
	<PopoverTrigger
		class="flex w-full items-center gap-2.5 rounded-xl border border-line bg-card p-2.5 text-left transition-colors hover:bg-card2"
	>
		<img src="/favicon.png" alt="Bravaux" class="size-8 shrink-0 rounded-lg object-cover" />
		<span class="min-w-0 flex-1 leading-tight">
			<span class="block truncate text-[13px] font-semibold text-foreground">
				{current ? agencyLabel(current) : 'Choisir une agence'}
			</span>
			<span class="block truncate text-[11px] text-muted-foreground"> Bravaux </span>
		</span>
		<ChevronsUpDown class="size-4 shrink-0 text-muted-foreground" strokeWidth={1.7} />
	</PopoverTrigger>

	<PopoverContent class="w-64 rounded-xl border-line bg-card p-1.5" align="start" sideOffset={6}>
		<div class="space-y-0.5">
			<p
				class="px-2 py-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
			>
				Agences
			</p>

			{#if available.length === 0}
				<p class="px-2 py-2 text-[12px] text-muted-foreground">Aucune agence disponible.</p>
			{:else}
				{#each available as agence}
					<button
						type="button"
						onclick={() => (current = agence.name)}
						class={[
							'flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors',
							current === agence.name
								? 'bg-glass-3 text-foreground'
								: 'text-muted-foreground hover:bg-glass-2 hover:text-foreground'
						].join(' ')}
					>
						<span
							class="grid size-7 shrink-0 place-items-center rounded-md bg-card2 text-muted-foreground"
						>
							<Building2 class="size-3.5" strokeWidth={1.7} />
						</span>
						<span class="min-w-0 flex-1 truncate text-[13px] font-medium">
							{agencyLabel(agence.name)}
						</span>
					</button>
				{/each}
			{/if}
		</div>
	</PopoverContent>
</Popover>
