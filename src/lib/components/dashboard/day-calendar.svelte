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

	// Événements de l'agenda (réunion, formation, prospection, gestion) pour
	// afficher aussi les réunions et autres événements dans le planning du jour.
	const evenements = useQuery(api.evenements.list, () => (authState.isAuthenticated ? {} : 'skip'));
	const profile = useQuery(api.users.getProfile, () => (authState.isAuthenticated ? {} : 'skip'));
	// La catégorie « Gestion » n'est visible que par l'administrateur et le
	// directeur de zone (comme la page Agenda).
	const canSeeGestion = $derived(
		['administrateur', 'directeur de zone'].includes(profile.data?.role ?? '')
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

	// Événements du jour (réunions, formations, prospections…) à la date
	// sélectionnée, triés par heure.
	const todayEvents = $derived.by(() =>
		(evenements.data ?? [])
			.filter((e) => e.date === selectedDate && (canSeeGestion || e.type !== 'gestion'))
			.sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''))
	);

	// Réunion : créneau fixe lundi et vendredi matin 8h30–9h30 (comme l'agenda).
	const isReunionDay = $derived.by(() => {
		const [yy, mm, dd] = selectedDate.split('-').map(Number);
		const dow = new Date(yy, mm - 1, dd).getDay();
		return dow === 1 || dow === 5;
	});

	// Couleurs / libellés / emojis des événements (mêmes que la page Agenda).
	const EVENT_META: Record<string, { label: string; emoji: string; chip: string }> = {
		réunion: { label: 'Réunion', emoji: '👨‍🏫', chip: 'bg-violet-500/15 text-violet-400' },
		formation: { label: 'Formation', emoji: '🎓', chip: 'bg-yellow-500/15 text-yellow-400' },
		prospection: { label: 'Prospection', emoji: '🔎', chip: 'bg-rose-500/15 text-rose-400' },
		gestion: { label: 'Gestion dossier', emoji: '📁', chip: 'bg-violet-500/15 text-violet-400' }
	};
	const eventMeta = (type: string) =>
		EVENT_META[type] ?? { label: 'Réunion', emoji: '👨‍🏫', chip: 'bg-violet-500/15 text-violet-400' };

	// Lignes du planning : RDV + événements mélangés et triés par heure.
	type DayItem =
		| { kind: 'rdv'; time: string; rdv: ContactRow }
		| {
				kind: 'event';
				time: string;
				type: string;
				titre: string | null | undefined;
				secteur: string | null | undefined;
				membres: string | null;
		  };
	const dayItems = $derived.by(() => {
		const items: DayItem[] = [];
		for (const rdv of todayRdv) {
			items.push({ kind: 'rdv', time: rdv.followUp?.time ?? '', rdv });
		}
		for (const e of todayEvents) {
			items.push({
				kind: 'event',
				time: e.start ?? '',
				type: e.type,
				titre: e.titre,
				secteur: e.secteur,
				membres: (e.membreNames ?? []).join(', ') || null
			});
		}
		// Créneau fixe « Réunion » (lundi et vendredi matin 8h30–9h30).
		if (isReunionDay) {
			items.push({
				kind: 'event',
				time: '08:30',
				type: 'réunion',
				titre: 'Réunion',
				secteur: null,
				membres: null
			});
		}
		return items.sort((a, b) => a.time.localeCompare(b.time));
	});

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
	// rouge (annulé), vert (vendu). Un RDV « Confortation » ou « Gestion dossier »
	// encore programmé s'affiche en violet comme une réunion.
	function rdvStatusClass(
		status: string | null | undefined,
		motif?: string | null | undefined
	): string {
		if (status === 'déballé') return 'bg-violet-500/15 text-violet-400';
		if (status === 'annulé') return 'bg-red-500/15 text-red-400';
		if (status === 'vendu') return 'bg-emerald-500/15 text-emerald-400';
		if (motif === 'confortation' || motif === 'gestion') return 'bg-violet-500/15 text-violet-400';
		return 'bg-blue-500/15 text-blue-400';
	}

	function rdvStatusLabel(
		status: string | null | undefined,
		motif?: string | null | undefined
	): string {
		if (status === 'déballé') return 'Déballé';
		if (status === 'annulé') return 'Annulé';
		if (status === 'vendu') return 'Vendu';
		if (motif === 'confortation') return 'Confortation';
		if (motif === 'gestion') return 'Gestion dossier';
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
				{dayItems.length}
				{dayItems.length > 1 ? 'éléments' : 'élément'}
			</Badge>
		</CardTitle>
	</CardHeader>
	<CardContent class="flex min-h-0 flex-1 flex-col px-5 pt-2 pb-5">
		{#if dayItems.length === 0}
			<div class="flex flex-1 items-center justify-center py-10">
				<p class="text-[12.5px] text-muted-foreground">Aucun RDV ni événement ce jour.</p>
			</div>
		{:else}
			<ul class="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
				{#each dayItems as item}
					{#if item.kind === 'rdv'}
						<button
							type="button"
							onclick={() => openFiche(item.rdv)}
							class="flex w-full items-center gap-3 rounded-xl border border-line bg-card2 px-3 py-2 text-left transition-colors hover:bg-glass-1"
						>
							<span class="w-11 shrink-0 font-mono text-[11.5px] font-medium text-foreground">
								{item.time}
							</span>
							<div class="min-w-0 flex-1 leading-tight">
								<p class="truncate text-[12.5px] font-semibold text-foreground">
									{item.rdv.name}
								</p>
								<p class="truncate text-[11px] text-muted-foreground">
									{item.rdv.projet || '—'}
								</p>
							</div>
							<span class="hidden shrink-0 font-mono text-[10.5px] text-muted-foreground sm:block">
								{formatPhone(item.rdv.phone) || ''}
							</span>
							<span
								class={[
									'shrink-0 rounded-md px-1.5 py-0.5 text-[9.5px] font-bold tracking-wider uppercase',
									rdvStatusClass(item.rdv.followUp?.status, item.rdv.followUp?.motif)
								].join(' ')}
							>
								{rdvStatusLabel(item.rdv.followUp?.status, item.rdv.followUp?.motif)}
							</span>
						</button>
					{:else}
						{@const meta = eventMeta(item.type)}
						<div
							class="flex w-full items-center gap-3 rounded-xl border border-line bg-card2 px-3 py-2"
						>
							<span class="w-11 shrink-0 font-mono text-[11.5px] font-medium text-foreground">
								{item.time}
							</span>
							<div class="min-w-0 flex-1 leading-tight">
								<p class="truncate text-[12.5px] font-semibold text-foreground">
									{meta.emoji}
									{item.titre || meta.label}
								</p>
								{#if item.secteur || item.membres}
									<p class="truncate text-[11px] text-muted-foreground">
										{item.secteur ? `📍 ${item.secteur}` : `👥 ${item.membres}`}
									</p>
								{/if}
							</div>
							<span
								class={[
									'shrink-0 rounded-md px-1.5 py-0.5 text-[9.5px] font-bold tracking-wider uppercase',
									meta.chip
								].join(' ')}
							>
								{meta.label}
							</span>
						</div>
					{/if}
				{/each}
			</ul>
		{/if}
	</CardContent>

	<ContactDialog bind:contact={selected} bind:open={dialogOpen} />
</Card>
