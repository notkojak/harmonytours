<script lang="ts">
	import { Check } from '@lucide/svelte';
	import type { ProgressionStep } from '$lib/data/progression';

	type Props = {
		steps: readonly ProgressionStep[];
		validated: string[];
		canEdit?: boolean;
		onToggle?: (key: string) => void;
	};
	let { steps, validated, canEdit = false, onToggle }: Props = $props();

	const validatedSet = $derived(new Set(validated));
	const N = $derived(steps.length);

	const NODE = 52;
	const CY = 84; // hauteur du centre d'un nœud
	const SLOT = 120; // espace horizontal entre 2 étapes consécutives
	const W = $derived(Math.max(NODE + 40, N * SLOT + 20));
	const H = $derived(CY + NODE + 64); // réserve pour les libellés sur 3-4 lignes

	function nodePos(i: number): { x: number; y: number } {
		return {
			x: W / 2 + (i - (N - 1) / 2) * SLOT,
			y: CY
		};
	}

	function pathD(i: number): string {
		const a = nodePos(i);
		const b = nodePos(i + 1);
		return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
	}

	const done = $derived(validatedSet.size);
	const complete = $derived(steps.length > 0 && done === steps.length);
</script>

<div class="flex flex-col items-center">
	<!-- Récapitulatif de progression -->
	<div class="w-full max-w-sm">
		<div class="flex items-center justify-between text-[12px]">
			<span class="font-semibold text-foreground">Progression</span>
			{#if complete}
				<span class="flex items-center gap-1 font-bold text-emerald-400">
					<Check class="size-3.5" strokeWidth={3} />
					Complété
				</span>
			{:else}
				<span class="font-medium text-muted-foreground">
					{done}/{steps.length} étape{done > 1 ? 's' : ''} validée{done > 1 ? 's' : ''}
				</span>
			{/if}
		</div>
		<div class="mt-2 h-2 overflow-hidden rounded-full bg-card2">
			<div
				class="h-full rounded-full bg-linear-to-r from-emerald-400 to-emerald-600 transition-all duration-500"
				style={`width:${steps.length ? (done / steps.length) * 100 : 0}%`}
			></div>
		</div>
		{#if canEdit}
			<p class="mt-2 text-[11px] text-muted-foreground">
				Clique sur une étape pour la valider — reclique pour la retirer.
			</p>
		{:else}
			<p class="mt-2 text-[11px] text-muted-foreground">
				Chaque étape validée par ton manager fait grandir ton arbre 🌱
			</p>
		{/if}
	</div>

	<!-- L'arbre sur une seule ligne horizontale (défile horizontal si trop large) -->
	<div class="w-full overflow-x-auto">
		<div class="relative mx-auto shrink-0" style={`width:${W}px;height:${H}px`}>
			<svg class="pointer-events-none absolute inset-0" width={W} height={H}>
				{#each steps as step, i}
					{#if i < steps.length - 1}
						{@const active = validatedSet.has(steps[i + 1].key)}
						<path
							d={pathD(i)}
							fill="none"
							stroke={active ? '#10b981' : 'var(--color-border)'}
							stroke-width={6}
							stroke-linecap="round"
						/>
					{/if}
				{/each}
			</svg>

			{#each steps as step, i}
				{@const pos = nodePos(i)}
				{@const active = validatedSet.has(step.key)}
				<!-- Le rond lui-même est un élément positionné de taille fixe, centré
				     exactement sur le nœud : pas de dépendance à la taille d'un span
				     interne, donc tous les ronds sont forcément sur la même ligne. -->
				<button
					type="button"
					disabled={!canEdit}
					onclick={() => onToggle?.(step.key)}
					title={canEdit
						? active
							? `Retirer « ${step.label} »`
							: `Valider « ${step.label} »`
						: step.label}
					class={[
						'absolute grid place-items-center overflow-visible rounded-full border-[3px] transition-all duration-200',
						canEdit ? 'cursor-pointer hover:scale-105 hover:ring-4 hover:ring-emerald-500/25' : '',
						active
							? 'border-emerald-300/70 bg-linear-to-b from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-900/40'
							: 'border-line bg-card2 opacity-90'
					].join(' ')}
					style={`left:${pos.x}px;top:${pos.y}px;width:${NODE}px;height:${NODE}px;transform:translate(-50%,-50%)`}
				>
					<span
						class={[
							'text-[22px] leading-none [line-height:0]',
							active ? '' : 'opacity-55 grayscale'
						].join(' ')}
					>
						{step.emoji}
					</span>
					{#if active}
						<span
							class="absolute -top-1.5 -right-1.5 grid size-5.5 place-items-center rounded-full bg-emerald-500 text-white shadow-md shadow-emerald-900/40"
						>
							<Check class="size-3.5" strokeWidth={3} />
						</span>
					{/if}
				</button>
				<span
					class={[
						'absolute max-w-28 text-center text-[10.5px] leading-tight font-medium break-words',
						active ? 'text-foreground' : 'text-muted-foreground/70'
					].join(' ')}
					style={`left:${pos.x}px;top:${pos.y + NODE / 2 + 6}px;transform:translate(-50%,0)`}
				>
					{step.label}
				</span>
			{/each}
		</div>
	</div>
</div>
