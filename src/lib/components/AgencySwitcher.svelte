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
	<!-- Pastille d'en-tête : pilule sans contour, le logo de la marque (favicon.png).
	     Module volontairement en teintes sombres même en mode clair : la barre latérale
	     reste graphite dans les deux thèmes, une pilule claire y ferait une tache. -->
	<PopoverTrigger
		class="flex h-11 w-full items-center gap-2.5 rounded-full bg-white/[0.06] px-3 text-left transition-colors hover:bg-white/10"
	>
		<img
			src="/favicon.png"
			alt=""
			class="size-8 shrink-0 rounded-[10px] object-cover"
			aria-hidden="true"
		/>
		<span class="min-w-0 flex-1 leading-tight">
			<span class="block truncate font-display text-[13px] font-semibold text-white">
				{current ? agencyLabel(current) : 'Choisir une agence'}
			</span>
			<span class="block truncate text-[11px] text-white/45"> Bravaux </span>
		</span>
		<ChevronsUpDown class="size-4 shrink-0 text-white/40" strokeWidth={1.7} />
	</PopoverTrigger>

	<PopoverContent
		class="w-64 rounded-2xl border-0 bg-[#161618] p-1.5 text-white shadow-[0_18px_40px_-18px_rgba(0,0,0,0.75)]"
		align="start"
		sideOffset={6}
	>
		<div class="space-y-0.5">
			<p class="px-2 py-1.5 text-[11px] font-semibold tracking-wider text-white/40 uppercase">
				Agences
			</p>

			{#if available.length === 0}
				<p class="px-2 py-2 text-[12px] text-white/45">Aucune agence disponible.</p>
			{:else}
				{#each available as agence}
					<button
						type="button"
						onclick={() => (current = agence.name)}
						class={[
							'flex w-full items-center gap-2.5 rounded-full px-2 py-2 text-left transition-colors',
							current === agence.name
								? 'bg-white/10 text-white'
								: 'text-white/55 hover:bg-white/[0.06] hover:text-white'
						].join(' ')}
					>
						<span
							class={[
								'grid size-7 shrink-0 place-items-center rounded-xl',
								current === agence.name ? 'bg-white/10 text-white' : 'bg-white/[0.06] text-white/50'
							].join(' ')}
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
