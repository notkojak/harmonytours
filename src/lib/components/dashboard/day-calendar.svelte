<script lang="ts">
	import { CalendarClock } from '@lucide/svelte';
	import { useQuery } from 'convex-svelte';
	import { api } from '../../../convex/_generated/api.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import { formatPhone } from '$lib/data/phone';
	import { authState } from '$lib/auth-state.svelte';
	import ContactDialog, { type ContactRow } from '$lib/components/ContactDialog.svelte';

	// includeClients : les RDV des clients (vendu) restent visibles dans le planning du jour.
	const contacts = useQuery(api.contacts.list, () =>
		authState.isAuthenticated ? { includeClients: true } : 'skip'
	);

	let { date }: { date?: string } = $props();

	const todayISO = $derived.by(() => {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
			d.getDate()
		).padStart(2, '0')}`;
	});
	const selectedDate = $derived(date ?? todayISO);

	// RDV du jour : suivi courant de type RDV à la date sélectionnée (date du
	// picker du Topbar, ou aujourd'hui par défaut), contacts non traités.
	const todayRdv = $derived.by(() =>
		(contacts.data ?? [])
			.filter(
				(c) =>
					c.followUp?.type === 'rdv' && c.followUp.date === selectedDate && c.statut !== 'traité'
			)
			.sort((a, b) => (a.followUp?.time ?? '').localeCompare(b.followUp?.time ?? ''))
	);

	// Titre : « Planning du jour » si la date est aujourd'hui, sinon la date choisie.
	const planningTitle = $derived(
		selectedDate === todayISO
			? 'Planning du jour'
			: `Planning du ${new Date(`${selectedDate}T00:00:00`).toLocaleDateString('fr-FR', {
					day: 'numeric',
					month: 'short'
				})}`
	);

	// Couleur du RDV selon son statut : bleu (en attente), violet (déballé),
	// rouge (annulé), vert (vendu).
	function rdvStatusClass(status: string | null | undefined): string {
		if (status === 'déballé') return 'bg-violet-500/15 text-violet-400';
		if (status === 'annulé') return 'bg-red-500/15 text-red-400';
		if (status === 'vendu') return 'bg-emerald-500/15 text-emerald-400';
		return 'bg-blue-500/15 text-blue-400';
	}

	function rdvStatusLabel(status: string | null | undefined): string {
		if (status === 'déballé') return 'Déballé';
		if (status === 'annulé') return 'Annulé';
		if (status === 'vendu') return 'Vendu';
		return 'Programmé';
	}

	let selected = $state<ContactRow | null>(null);
	let dialogOpen = $state(false);

	function openFiche(contact: ContactRow) {
		selected = contact;
		dialogOpen = true;
	}
</script>

<Card class="flex h-full flex-col gap-0 rounded-2xl border-line py-0 shadow-none">
	<CardHeader class="flex items-center justify-between gap-3 px-5 pt-5 pb-0">
		<CardTitle class="flex items-center gap-2.5 text-[14px] font-semibold">
			<span
				class="grid size-8 place-items-center rounded-lg border border-line bg-card2 text-muted-foreground"
			>
				<CalendarClock class="size-4" strokeWidth={1.7} />
			</span>
			{planningTitle}
			<Badge variant="secondary" class="rounded-full px-2">
				{todayRdv.length} RDV
			</Badge>
		</CardTitle>
	</CardHeader>
	<CardContent class="flex min-h-0 flex-1 flex-col px-5 pt-2 pb-5">
		{#if todayRdv.length === 0}
			<div class="flex flex-1 items-center justify-center py-10">
				<p class="text-[12.5px] text-muted-foreground">Aucun RDV aujourd'hui.</p>
			</div>
		{:else}
			<ul class="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
				{#each todayRdv as rdv}
					<button
						type="button"
						onclick={() => openFiche(rdv)}
						class="flex w-full items-center gap-3 rounded-xl border border-line bg-card2 px-3 py-2 text-left transition-colors hover:bg-glass-1"
					>
						<span class="w-11 shrink-0 font-mono text-[11.5px] font-medium text-foreground">
							{rdv.followUp?.time ?? ''}
						</span>
						<div class="min-w-0 flex-1 leading-tight">
							<p class="truncate text-[12.5px] font-semibold text-foreground">
								{rdv.name}
							</p>
							<p class="truncate text-[11px] text-muted-foreground">
								{rdv.projet || '—'}
							</p>
						</div>
						<span class="hidden shrink-0 font-mono text-[10.5px] text-muted-foreground sm:block">
							{formatPhone(rdv.phone) || ''}
						</span>
						<span
							class={[
								'shrink-0 rounded-md px-1.5 py-0.5 text-[9.5px] font-bold tracking-wider uppercase',
								rdvStatusClass(rdv.followUp?.status)
							].join(' ')}
						>
							{rdvStatusLabel(rdv.followUp?.status)}
						</span>
					</button>
				{/each}
			</ul>
		{/if}
	</CardContent>

	<ContactDialog bind:contact={selected} bind:open={dialogOpen} />
</Card>
