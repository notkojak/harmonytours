<script lang="ts">
	import { Check, LoaderCircle, Plus, Trash2 } from '@lucide/svelte';
	import { useMutation } from 'convex-svelte';
	import { api } from '../../convex/_generated/api.js';
	import type { Id } from '../../convex/_generated/dataModel.js';

	// Recontact de la fiche : une liste de type to-do, une ligne par échange,
	// avec une saisie directe en pied de liste. Rien ici ne touche au rendez-vous
	// ni au suivi du contact : on consigne seulement ce qui s'est dit.
	let {
		contactId,
		recontacts = [],
		onAdded,
		onRemoved
	}: {
		contactId?: string;
		recontacts?: { date: number; response: string }[] | null;
		onAdded?: (entry: { date: number; response: string }) => void;
		onRemoved?: (date: number) => void;
	} = $props();

	const addRecontact = useMutation(api.contacts.recontact);
	const deleteRecontact = useMutation(api.contacts.removeRecontact);

	let draft = $state('');
	let busy = $state(false);
	let removing = $state<number | null>(null);
	let error = $state('');

	const appels = $derived([...(recontacts ?? [])].sort((a, b) => b.date - a.date));
	const visibles = $derived(appels.slice(0, 6));

	// Ancienneté lisible : aujourd'hui, hier, puis « il y a X jours ». Au-delà
	// d'un mois, la date reprend le dessus.
	function jourLisible(ts: number): string {
		const jour = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
		const jours = Math.round((jour(new Date()) - jour(new Date(ts))) / 86_400_000);
		if (jours <= 0) return "aujourd'hui";
		if (jours === 1) return 'hier';
		if (jours < 30) return `il y a ${jours} j`;
		return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
	}

	async function ajouter() {
		const response = draft.trim();
		if (!response || !contactId || busy) return;
		busy = true;
		error = '';
		try {
			// La date renvoyée par le serveur est celle enregistrée : elle sert de
			// clé pour la suppression de la ligne.
			const entry = await addRecontact({ contactId: contactId as Id<'contacts'>, response });
			onAdded?.(entry ?? { date: Date.now(), response });
			draft = '';
		} catch (e) {
			error = e instanceof Error ? e.message : 'Recontact impossible.';
		} finally {
			busy = false;
		}
	}

	async function supprimer(date: number) {
		if (!contactId || removing !== null) return;
		removing = date;
		error = '';
		try {
			await deleteRecontact({ contactId: contactId as Id<'contacts'>, date });
			onRemoved?.(date);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Suppression impossible.';
		} finally {
			removing = null;
		}
	}
</script>

<div class="rounded-lg border border-line bg-card2/60 px-3 py-2.5">
	<p
		class="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase"
	>
		Recontact
		{#if appels.length > 0}
			<span class="rounded-full bg-glass-3 px-1.5 py-0.5 text-[9.5px] tabular-nums">
				{appels.length}
			</span>
		{/if}
	</p>

	{#if appels.length === 0}
		<p class="text-[11.5px] text-muted-foreground">Aucun recontact enregistré.</p>
	{:else}
		<ul class="space-y-0.5">
			{#each visibles as appel, i (appel.date + '-' + i)}
				<li class="group flex items-start gap-2 py-0.5">
					<span
						class="mt-0.5 grid size-3.5 shrink-0 place-items-center rounded-[4px] border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
					>
						<Check class="size-2.5" strokeWidth={3} />
					</span>
					<span
						class="min-w-0 flex-1 truncate text-[12.5px] text-foreground"
						title={appel.response}
					>
						{appel.response}
					</span>
					<span class="shrink-0 text-[10.5px] whitespace-nowrap text-muted-foreground tabular-nums">
						{jourLisible(appel.date)}
					</span>
					<button
						type="button"
						onclick={() => supprimer(appel.date)}
						disabled={removing !== null}
						class="mt-0.5 shrink-0 text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100 disabled:opacity-40 max-md:opacity-60"
						title="Supprimer ce recontact"
					>
						{#if removing === appel.date}
							<LoaderCircle class="size-3 animate-spin" />
						{:else}
							<Trash2 class="size-3" strokeWidth={1.8} />
						{/if}
					</button>
				</li>
			{/each}
			{#if appels.length > visibles.length}
				<li class="pt-0.5 pl-[22px] text-[10.5px] text-muted-foreground">
					+ {appels.length - visibles.length} autre(s)
				</li>
			{/if}
		</ul>
	{/if}

	<form class="mt-1.5 flex items-center gap-2" onsubmit={(e) => (e.preventDefault(), ajouter())}>
		<input
			bind:value={draft}
			placeholder="Ajouter un recontact…"
			class="h-7 min-w-0 flex-1 rounded-md border border-line bg-base px-2 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:border-brand/50"
		/>
		<button
			type="submit"
			disabled={busy || !draft.trim() || !contactId}
			class="grid size-7 shrink-0 place-items-center rounded-md border border-line text-muted-foreground transition-colors hover:border-brand/50 hover:text-brand disabled:opacity-40"
			title="Enregistrer le recontact"
		>
			{#if busy}
				<LoaderCircle class="size-3.5 animate-spin" />
			{:else}
				<Plus class="size-3.5" strokeWidth={2} />
			{/if}
		</button>
	</form>
	{#if error}
		<p class="mt-1 text-[11px] text-destructive">{error}</p>
	{/if}
</div>
