<script lang="ts">
	import { pageEmojis } from '$lib/data/dashboard';
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

	// Nombre de parcours terminés, affiché à côté du titre.
	const treesDone = $derived(
		TREES.filter((t) => (validatedByTree[t.key]?.length ?? 0) >= t.steps.length).length
	);

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

<div class="mx-auto max-w-6xl space-y-4">
	<Card class="gap-0 rounded-2xl border-0 py-0 shadow-none">
		<CardHeader class="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-0">
			<div class="min-w-0">
				<CardTitle class="flex items-center gap-2.5 text-[14px] font-semibold">
					<span class="text-[15px] leading-none" aria-hidden="true"
						>{pageEmojis['/progression']}</span
					>
					{isManager ? 'Arbres de progression' : 'Mon arbre de progression'}
					<span
						class="rounded-full bg-card2 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground tabular-nums"
					>
						{treesDone}/{TREES.length}
					</span>
				</CardTitle>
				<p class="mt-1 pl-6 text-[11.5px] font-medium text-muted-foreground">
					Valide tes étapes et suis ta montée en compétences
				</p>
			</div>

			{#if isManager && (people.data?.length ?? 0) > 1}
				<div class="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-card2 p-1">
					{#each people.data ?? [] as p (p._id)}
						<button
							type="button"
							onclick={() => (selectedId = p._id)}
							class={[
								'flex shrink-0 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] whitespace-nowrap transition-colors',
								selectedId === p._id
									? 'bg-primary font-semibold text-primary-foreground shadow-sm'
									: 'font-medium text-muted-foreground hover:bg-card hover:text-foreground'
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

		<CardContent class="px-5 pt-4 pb-5">
			<!-- Sélecteur d'arbre : une seule rangée qui défile, onglet actif en
			     pilule primaire, parcours terminé teinté en vert. -->
			<div class="mb-5 flex flex-wrap items-center gap-1.5">
				{#each TREES as t (t.key)}
					{@const done = validatedByTree[t.key]?.length ?? 0}
					{@const complete = done >= t.steps.length}
					{@const active = treeKey === t.key}
					<button
						type="button"
						onclick={() => (treeKey = t.key)}
						class={[
							'flex items-center justify-center gap-2 rounded-full px-3.5 py-2 text-[12.5px] whitespace-nowrap transition-colors',
							active
								? 'bg-primary font-semibold text-primary-foreground shadow-sm'
								: complete
									? 'bg-emerald-500/12 font-medium text-emerald-700 dark:text-emerald-300'
									: 'bg-card2 font-medium text-muted-foreground hover:bg-glass-3 hover:text-foreground'
						].join(' ')}
					>
						<span class="text-[13px] leading-none">{t.emoji}</span>
						{t.label}
						<span
							class={[
								'rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums',
								active
									? 'bg-primary-foreground/15 text-primary-foreground'
									: 'bg-card text-muted-foreground'
							].join(' ')}
						>
							{done}/{t.steps.length}
						</span>
						{#if complete && !active}
							<Check class="size-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={3.5} />
						{/if}
					</button>
				{/each}
			</div>

			<!-- Contenu de l'arbre sélectionné -->
			<div class="flex flex-col items-center">
				{#if completeTree}
					<div
						class="mb-5 flex w-full max-w-md items-center gap-3 rounded-2xl bg-emerald-500/10 px-4 py-3"
					>
						<span
							class="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-600 text-white"
						>
							<Check class="size-4.5" strokeWidth={3} />
						</span>
						<div class="min-w-0 leading-tight">
							<p class="text-[13.5px] font-semibold text-emerald-700 dark:text-emerald-300">
								Catégorie validée 🎉
							</p>
							<p class="text-[11.5px] text-emerald-700 dark:text-emerald-300/80">
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
							class="mb-4 w-full max-w-md rounded-2xl bg-destructive/10 px-3.5 py-2.5 text-[12px] text-destructive"
						>
							{toggleError}
						</p>
					{/if}
					{#if isGridTree}
						{@const done = validatedByTree[treeKey]?.length ?? 0}
						<div class="w-full max-w-2xl">
							<div class="flex items-baseline justify-between">
								<span class="text-[13px] font-semibold text-foreground"> Progression </span>
								<span class="text-[12px] font-medium text-muted-foreground tabular-nums">
									{done}/{currentTree.steps.length} élément{done > 1 ? 's' : ''} validé{done > 1
										? 's'
										: ''}
								</span>
							</div>
							<div class="mt-2 h-1.5 overflow-hidden rounded-full bg-card2">
								<div
									class="h-full rounded-full bg-brand transition-all duration-500"
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
						<div class="mt-4 grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
							{#each currentTree.steps as step (step.key)}
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
										'flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left transition-colors',
										canEdit ? 'cursor-pointer hover:bg-card' : 'cursor-default',
										active ? 'bg-brand/10' : 'bg-card2'
									].join(' ')}
								>
									<span
										class={[
											'grid size-6 shrink-0 place-items-center rounded-full transition-colors',
											active ? 'bg-brand text-white' : 'bg-card'
										].join(' ')}
									>
										{#if active}
											<Check class="size-3.5" strokeWidth={3.5} />
										{/if}
									</span>
									<span
										class={[
											'text-[12.5px] leading-snug',
											active ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'
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
			</div>
		</CardContent>
	</Card>
</div>
