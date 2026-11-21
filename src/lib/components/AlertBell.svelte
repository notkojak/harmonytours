<script lang="ts">
	import { resolve } from '$app/paths';
	import { Bell } from '@lucide/svelte';
	import { useQuery } from 'convex-svelte';
	import { api } from '../../convex/_generated/api.js';
	import { authState } from '$lib/auth-state.svelte';
	import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover/index.js';

	// Alertes du jour, calculées côté serveur à chaque écriture : rappels en
	// retard, RDV du jour et ventes en attente depuis plus de trois jours.
	const alertes = useQuery(api.pilotage.alertes, () => (authState.isAuthenticated ? {} : 'skip'));

	const total = $derived(alertes.data?.total ?? 0);
	const hasAlerts = $derived(total > 0);
	const badge = $derived(total > 9 ? '9+' : String(total));
	const actionsTotal = $derived(alertes.data?.actions?.total ?? 0);
	const actionCounts = $derived(alertes.data?.actions?.counts);
	const actionItems = $derived((alertes.data?.actions?.items ?? []).slice(0, 6));

	// Les cas qui coûtent de l'argent remontent dans la cloche, pas seulement
	// dans le centre d'actions du tableau de bord.
	type ActionRoute = '/ventes' | '/contacts';

	const categories: Array<{
		key: keyof NonNullable<typeof actionCounts>;
		label: string;
		href: ActionRoute;
	}> = [
		{ key: 'pose', label: 'Poses à confirmer', href: '/ventes' },
		{ key: 'metrage', label: 'Métrages à confirmer', href: '/ventes' },
		{ key: 'fiRefuse', label: 'FI refusés', href: '/ventes' },
		{ key: 'fiEnAttente', label: 'FI en attente', href: '/ventes' },
		{ key: 'nonConfortee', label: 'À conforter', href: '/ventes' },
		{ key: 'rdvAReprogrammer', label: 'RDV à replacer', href: '/contacts' },
		{ key: 'sansAction', label: 'Sans action', href: '/contacts' },
		{ key: 'clientSansSuite', label: 'Sans suite', href: '/ventes' }
	];

	const actionLabel: Record<string, string> = {
		pose: 'Pose',
		metrage: 'Métrage',
		fiRefuse: 'FI refusé',
		fiEnAttente: 'FI en attente',
		nonConfortee: 'À conforter',
		rdvAReprogrammer: 'RDV à replacer',
		sansAction: 'Sans action',
		clientSansSuite: 'Sans suite'
	};

	const actionHref = (kind: string): ActionRoute =>
		kind === 'rdvAReprogrammer' || kind === 'sansAction' ? '/contacts' : '/ventes';
</script>

<Popover>
	<PopoverTrigger
		class="relative grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
		aria-label={hasAlerts ? `${total} alerte${total > 1 ? 's' : ''}` : 'Alertes'}
		title="Alertes du jour"
	>
		<Bell class="size-4" strokeWidth={1.7} />
		{#if hasAlerts}
			<span
				class="absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] leading-4 font-bold text-white"
			>
				{badge}
			</span>
		{/if}
	</PopoverTrigger>

	<PopoverContent
		class="w-80 rounded-2xl border-0 bg-[#161618] p-2 text-white shadow-[0_18px_40px_-18px_rgba(0,0,0,0.75)]"
		align="end"
		sideOffset={6}
	>
		<p class="px-2 py-1.5 text-[11px] font-semibold tracking-wider text-white/40 uppercase">
			Alertes du jour
		</p>

		{#if !hasAlerts}
			<p class="px-2 py-3 text-[12px] text-white/50">Rien à signaler aujourd'hui.</p>
		{:else}
			<div class="max-h-[70vh] space-y-2 overflow-y-auto">
				{#if actionsTotal > 0}
					<div class="space-y-1 rounded-xl bg-amber-500/10 px-2 py-2">
						<a href={resolve('/')} class="flex items-center gap-2">
							<span class="min-w-0 flex-1 text-[12.5px] font-semibold text-amber-200">
								Centre d'actions du jour
							</span>
							<span
								class="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 font-mono text-[10.5px] font-semibold text-amber-200"
							>
								{actionsTotal}
							</span>
						</a>
						<div class="flex flex-wrap gap-1">
							{#each categories as categorie (categorie.key)}
								{#if (actionCounts?.[categorie.key] ?? 0) > 0}
									<a
										href={resolve(categorie.href)}
										class="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10.5px] font-semibold text-amber-200/90 transition-colors hover:bg-amber-500/25"
									>
										{actionCounts?.[categorie.key]}
										{categorie.label}
									</a>
								{/if}
							{/each}
						</div>
						{#each actionItems as item (item.key)}
							<a
								href={resolve(actionHref(item.kind))}
								class="flex items-center gap-2 rounded-lg px-1 py-1 transition-colors hover:bg-white/[0.07]"
							>
								<span class="min-w-0 flex-1 truncate text-[12px] font-medium text-white/90">
									{item.titre}
								</span>
								<span class="shrink-0 text-[10px] font-semibold text-amber-200/80">
									{actionLabel[item.kind] ?? ''}
								</span>
								{#if item.jours != null}
									<span class="shrink-0 font-mono text-[10px] text-white/40">
										{item.jours} j
									</span>
								{/if}
							</a>
						{/each}
					</div>
				{/if}
				{#if alertes.data?.rappels.length}
					<div class="space-y-0.5">
						<p
							class="px-2 pt-1 text-[10.5px] font-semibold tracking-wide text-amber-300/80 uppercase"
						>
							Rappels en retard
						</p>
						{#each alertes.data.rappels as r (r._id)}
							<a
								href={resolve('/contacts')}
								class="flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/[0.07]"
							>
								<span class="min-w-0 flex-1 truncate text-[12.5px] font-medium text-white/90">
									{r.name}
								</span>
								<span class="shrink-0 font-mono text-[10.5px] text-amber-300/90">
									{r.joursDeRetard} j
								</span>
							</a>
						{/each}
					</div>
				{/if}

				{#if alertes.data?.rdvDuJour.length}
					<div class="space-y-0.5">
						<p
							class="px-2 pt-1 text-[10.5px] font-semibold tracking-wide text-sky-300/80 uppercase"
						>
							RDV du jour
						</p>
						{#each alertes.data.rdvDuJour as r (r._id)}
							<a
								href={resolve('/agenda')}
								class="flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/[0.07]"
							>
								<span class="w-9 shrink-0 font-mono text-[10.5px] text-white/50">
									{r.time ?? '—'}
								</span>
								<span class="min-w-0 flex-1 truncate text-[12.5px] font-medium text-white/90">
									{r.name}
								</span>
							</a>
						{/each}
					</div>
				{/if}

				{#if alertes.data?.enAttente.length}
					<div class="space-y-0.5">
						<p
							class="px-2 pt-1 text-[10.5px] font-semibold tracking-wide text-red-300/80 uppercase"
						>
							Ventes à valider
						</p>
						{#each alertes.data.enAttente as v (v._id)}
							<a
								href={resolve('/ventes')}
								class="flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/[0.07]"
							>
								<span class="min-w-0 flex-1 truncate text-[12.5px] font-medium text-white/90">
									{v.contactName}
								</span>
								<span class="shrink-0 font-mono text-[10.5px] text-red-300/90">
									{v.jours} j
								</span>
							</a>
						{/each}
					</div>
				{/if}

				{#if (alertes.data?.enErreur ?? 0) > 0}
					<a
						href={resolve('/ventes')}
						class="flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/[0.07]"
					>
						<span class="min-w-0 flex-1 text-[12px] font-medium text-white/80">
							Dossiers en erreur
						</span>
						<span class="shrink-0 font-mono text-[10.5px] text-red-300/90">
							{alertes.data?.enErreur}
						</span>
					</a>
				{/if}
			</div>
		{/if}
	</PopoverContent>
</Popover>
