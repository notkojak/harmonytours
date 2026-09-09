<script lang="ts">
	import { Check, Sprout } from '@lucide/svelte';
	import { useMutation, useQuery } from 'convex-svelte';
	import { api } from '../../convex/_generated/api.js';
	import type { Id } from '../../convex/_generated/dataModel.js';
	import { authState } from '$lib/auth-state.svelte';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import Avatar from '$lib/components/Avatar.svelte';
	import ProgressionTree from '$lib/components/ProgressionTree.svelte';
	import { TREES, type TreeKey } from '$lib/data/progression';

	const profile = useQuery(api.users.getProfile, () => (authState.isAuthenticated ? {} : 'skip'));
	// Les managers (animateur, directeur d'agence, directeur de zone, admin)
	// voient tous les arbres et peuvent valider les étapes.
	const isManager = $derived(
		!!profile.data &&
			[
				'animateur de zone',
				'animateur',
				"directeur d'agence",
				'directeur de zone',
				'administrateur'
			].includes(profile.data.role ?? '')
	);
	// L'animateur de zone visualise la progression mais ne peut pas valider les
	// étapes (clic désactivé). Les autres managers (admin, zône, agence) valident.
	const canEdit = $derived(
		isManager && !['animateur de zone', 'animateur'].includes(profile.data?.role ?? '')
	);

	const people = useQuery(api.access.listPeople, () => (authState.isAuthenticated ? {} : 'skip'));

	// Pour un manager : on sélectionne le premier employé par défaut.
	// Pour un commercial : undefined = son propre arbre.
	let selectedId = $state<Id<'users'> | undefined>(undefined);
	$effect(() => {
		if (isManager && people.data?.length && selectedId === undefined) {
			selectedId = people.data[0]._id;
		}
	});

	// Arbre affiché : parcours d'intégration (4 étapes) ou tram de prospection (7 étapes).
	let treeKey = $state<TreeKey>('integration');
	const currentTree = $derived(TREES.find((t) => t.key === treeKey) ?? TREES[0]);
	// Les formations (technique / commercial) listent les 14 familles du catalogue :
	// rendues en grille avec un rond par élément (un arbre horizontal de 14 nœuds
	// serait illisible).
	const isGridTree = $derived(
		treeKey === 'formation_technique' || treeKey === 'formation_theorique'
	);

	// Tous les arbres sont chargés en une requête pour afficher l'avancement
	// (et la validation) de chaque catégorie dans les onglets.
	const progression = useQuery(api.progression.getAll, () =>
		authState.isAuthenticated ? { userId: selectedId } : 'skip'
	);
	const validatedByTree = $derived<Record<TreeKey, string[]>>(
		Object.fromEntries((progression.data ?? []).map((p) => [p.tree, p.validated])) as Record<
			TreeKey,
			string[]
		>
	);
	const completeTree = $derived(
		(validatedByTree[treeKey]?.length ?? 0) >= currentTree.steps.length &&
			currentTree.steps.length > 0
	);
	const isLoading = $derived(progression.isLoading);
	const toggle = useMutation(api.progression.toggle);

	let toggleError = $state('');
	async function handleToggle(step: string) {
		if (!canEdit || !selectedId) return;
		toggleError = '';
		try {
			await toggle({ userId: selectedId, tree: treeKey, step });
		} catch (e) {
			toggleError = e instanceof Error ? e.message : "Erreur lors de la validation de l'étape.";
		}
	}
</script>

<div class="mx-auto max-w-5xl space-y-5">
	<Card class="gap-0 rounded-2xl border-line py-0 shadow-none">
		<CardHeader class="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-0">
			<CardTitle class="flex items-center gap-2.5 text-[14px] font-semibold">
				<span
					class="grid size-8 place-items-center rounded-lg border border-line bg-card2 text-muted-foreground"
				>
					<Sprout class="size-4" strokeWidth={1.7} />
				</span>
				{isManager ? 'Arbres de progression' : 'Mon arbre de progression'}
			</CardTitle>

			{#if isManager && (people.data?.length ?? 0) > 1}
				<div
					class="flex max-w-full flex-wrap items-center justify-end gap-1 rounded-xl border border-line bg-card2/60 p-1"
				>
					{#each people.data ?? [] as p}
						<button
							type="button"
							onclick={() => (selectedId = p._id)}
							class={[
								'flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium whitespace-nowrap transition-all duration-150',
								selectedId === p._id
									? 'bg-white text-black shadow-md shadow-black/10 light:bg-foreground light:text-background'
									: 'text-muted-foreground hover:bg-primary/10 hover:text-violet-200 light:hover:text-violet-600'
							].join(' ')}
						>
							<Avatar
								photo={p.photo}
								label={p.name
									.trim()
									.split(/\s+/)
									.map((w) => w[0] ?? '')
									.slice(0, 2)
									.join('')
									.toUpperCase()}
								class="size-6 rounded-full bg-muted text-[9px] font-bold text-muted-foreground"
							/>
							{p.name}
						</button>
					{/each}
				</div>
			{/if}
		</CardHeader>

		<CardContent class="flex flex-col items-center px-5 pt-2 pb-5">
			<!-- Sélecteur d'arbre : intégration puis tram de prospection.
			     Chaque catégorie affiche son avancement, et une coche verte dès
			     que toutes ses étapes sont validées. -->
			<div
				class="mb-5 flex max-w-full flex-wrap items-center justify-center gap-1 rounded-xl border border-line bg-card2/60 p-1"
			>
				{#each TREES as t}
					{@const done = validatedByTree[t.key]?.length ?? 0}
					{@const complete = done >= t.steps.length}
					{@const active = treeKey === t.key}
					<button
						type="button"
						onclick={() => (treeKey = t.key)}
						class={[
							'flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium whitespace-nowrap transition-all duration-150',
							treeKey === t.key
								? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/25'
								: complete
									? 'border border-emerald-500/50 bg-emerald-500/15 text-emerald-300 light:text-emerald-600'
									: 'text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-200 light:hover:text-emerald-600'
						].join(' ')}
					>
						<span class="text-[13px] leading-none">{t.emoji}</span>
						{t.label}
						<span
							class={[
								'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
								active
									? 'bg-black/15 text-black'
									: complete
										? 'bg-emerald-500/25 text-emerald-300 light:text-emerald-600'
										: 'bg-glass-3 text-muted-foreground'
							].join(' ')}
						>
							{done}/{t.steps.length}
						</span>
						{#if complete}
							<Check class="size-3.5" strokeWidth={3.5} />
						{/if}
					</button>
				{/each}
			</div>

			{#if completeTree}
				<div
					class="mb-4 flex w-full max-w-sm items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3"
				>
					<span
						class="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-500 text-white shadow-md shadow-emerald-900/40"
					>
						<Check class="size-4.5" strokeWidth={3} />
					</span>
					<div class="min-w-0 leading-tight">
						<p class="text-[13.5px] font-bold text-emerald-300">Catégorie validée 🎉</p>
						<p class="text-[11.5px] text-emerald-300/80">
							Toutes les étapes de « {currentTree.label} » sont complètes.
						</p>
					</div>
				</div>
			{/if}

			{#if isLoading}
				<div class="space-y-3 py-10">
					<div class="skeleton h-3 w-56 rounded-full"></div>
					<div class="skeleton h-64 w-72 rounded-2xl"></div>
				</div>
			{:else}
				{#if toggleError}
					<p
						class="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-400"
					>
						{toggleError}
					</p>
				{/if}
				{#if isGridTree}
					{@const done = validatedByTree[treeKey]?.length ?? 0}
					<div class="w-full max-w-2xl">
						<div class="flex items-center justify-between text-[12px]">
							<span class="font-semibold text-foreground">Progression</span>
							<span class="font-medium text-muted-foreground">
								{done}/{currentTree.steps.length} élément{done > 1 ? 's' : ''} validé{done > 1 ? 's' : ''}
							</span>
						</div>
						<div class="mt-2 h-2 overflow-hidden rounded-full bg-card2">
							<div
								class="h-full rounded-full bg-linear-to-r from-emerald-400 to-emerald-600 transition-all duration-500"
								style={`width:${(done / currentTree.steps.length) * 100}%`}
							></div>
						</div>
						{#if canEdit}
							<p class="mt-2 text-[11px] text-muted-foreground">
								Clique sur un rond pour valider la formation — reclique pour la retirer.
							</p>
						{/if}
					</div>

					<!-- Un rond par élément : familles du catalogue (même liste que le
					     select « Projet » du nouveau contact) ou modules de vente. -->
					<div class="grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
						{#each currentTree.steps as step}
							{@const active = (validatedByTree[treeKey] ?? []).includes(step.key)}
							<button
								type="button"
								disabled={!canEdit}
								onclick={() => handleToggle(step.key)}
								title={canEdit
									? active
										? `Retirer « ${step.label} »`
										: `Valider « ${step.label} »`
									: step.label}
								class={[
									'flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-all duration-150',
									canEdit
										? 'cursor-pointer hover:border-emerald-500/50 hover:bg-emerald-500/5'
										: 'cursor-default',
									active
										? 'border-emerald-500/50 bg-emerald-500/10'
										: 'border-line bg-card2/40'
								].join(' ')}
							>
								<span
									class={[
										'grid size-6 shrink-0 place-items-center rounded-full border-2 transition-all duration-150',
										active
											? 'border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-900/40'
											: 'border-line bg-base'
									].join(' ')}
								>
									{#if active}
										<Check class="size-3.5" strokeWidth={3.5} />
									{/if}
								</span>
								<span
									class={[
										'text-[12.5px] leading-snug font-medium',
										active ? 'text-foreground' : 'text-muted-foreground'
									].join(' ')}
								>
									<span class="mr-1.5 text-[13px]">{step.emoji}</span>
									{step.label}
								</span>
							</button>
						{/each}
					</div>
				{:else}
					<ProgressionTree
						steps={currentTree.steps}
						validated={validatedByTree[treeKey] ?? []}
						{canEdit}
						onToggle={handleToggle}
					/>
				{/if}
			{/if}
		</CardContent>
	</Card>
</div>
