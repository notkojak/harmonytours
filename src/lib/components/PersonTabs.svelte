<script module>
	// Rôles qui voient tout le CRM (périmètre agence/zone) — miroir de access.ts.
	const MANAGER = [
		'animateur de zone',
		'animateur',
		"directeur d'agence",
		'directeur de zone',
		'administrateur'
	];
</script>

<script lang="ts">
	import { useQuery } from 'convex-svelte';
	import { api } from '../../convex/_generated/api.js';
	import type { Id } from '../../convex/_generated/dataModel.js';
	import { authState } from '$lib/auth-state.svelte';
	import Avatar from './Avatar.svelte';

	// `value` = id du commercial sélectionné, ou undefined (= « Tout »).
	type Props = { value?: Id<'users'> | undefined };
	let { value = $bindable(undefined) }: Props = $props();

	const profile = useQuery(api.users.getProfile, () => (authState.isAuthenticated ? {} : 'skip'));
	const people = useQuery(api.access.listPeople, () => (authState.isAuthenticated ? {} : 'skip'));

	const isManager = $derived(!!profile.data && MANAGER.includes(profile.data.role ?? ''));

	// On n'affiche la barre que pour les managers (les commerciaux n'ont qu'eux-mêmes).
	const show = $derived(isManager && !!people.data);
</script>

{#if show}
	<div
		class="flex max-w-full flex-wrap items-center gap-1 rounded-xl border border-line bg-card2/60 p-1"
	>
		<button
			type="button"
			onclick={() => (value = undefined)}
			class={[
				'flex items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all duration-150',
				value === undefined
					? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
					: 'text-muted-foreground hover:bg-primary/10 hover:text-violet-200 light:hover:text-violet-600'
			].join(' ')}
		>
			Tout
		</button>
		{#each people.data ?? [] as p}
			<button
				type="button"
				onclick={() => (value = p._id)}
				class={[
					'flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium whitespace-nowrap transition-all duration-150',
					value === p._id
						? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
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
