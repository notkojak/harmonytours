<script lang="ts">
	import { CalendarDays, ChevronLeft, ChevronRight } from '@lucide/svelte';
	import { useQuery } from 'convex-svelte';
	import { api } from '../../convex/_generated/api.js';
	import { authState } from '$lib/auth-state.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		Dialog,
		DialogContent,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog/index.js';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	// Agenda partagé de l'agence (comme la page Agenda) : RDV + événements.
	const contacts = useQuery(api.contacts.listAgenda, () =>
		authState.isAuthenticated ? { includeClients: true } : 'skip'
	);
	const evenements = useQuery(api.evenements.list, () => (authState.isAuthenticated ? {} : 'skip'));

	// Pas de dimanche : la semaine de travail va du lundi au samedi.
	const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
	const RDV_EMOJI = '💼';

	// Styles identiques à la page Agenda.
	const EVENT_STYLE: Record<string, string> = {
		réunion: 'bg-violet-500/20 text-violet-300 light:bg-violet-500/15 light:text-violet-700',
		formation: 'bg-yellow-500/20 text-yellow-300 light:bg-yellow-500/15 light:text-yellow-700',
		prospection: 'bg-rose-500/20 text-rose-300 light:bg-rose-500/15 light:text-rose-700',
		gestion: 'bg-violet-500/20 text-violet-300 light:bg-violet-500/15 light:text-violet-700'
	};
	const EVENT_EMOJI: Record<string, string> = {
		réunion: '👨‍🏫',
		formation: '🎓',
		prospection: '🔎',
		gestion: '📁'
	};
	const EVENT_TYPE_LABEL: Record<string, string> = {
		réunion: 'Réunion',
		formation: 'Formation',
		prospection: 'Prospection',
		gestion: 'Gestion dossier'
	};
	const rdvStatusClass = (status: string | null | undefined) =>
		status === 'déballé'
			? 'bg-violet-500/15 text-violet-400 light:bg-violet-500/15 light:text-violet-700'
			: status === 'annulé'
				? 'bg-red-500/15 text-red-400 light:bg-red-500/15 light:text-red-700'
				: status === 'vendu'
					? 'bg-emerald-500/15 text-emerald-400 light:bg-emerald-500/15 light:text-emerald-700'
					: 'bg-blue-500/15 text-blue-400 light:bg-blue-500/15 light:text-blue-700';
	const chipMonth =
		'overflow-hidden rounded-md text-left text-[11px] font-medium transition-colors flex w-full items-start gap-1.5 px-2 py-1';

	// Gestion dossier : créneaux fixes mercredi 14h–15h et vendredi 14h–15h.

	function isGestionDay(day: Date): boolean {
		return day.getDay() === 3 || day.getDay() === 5;
	}
	// Réunion : créneau fixe lundi et vendredi matin 8h30–9h30.
	function isReunionDay(day: Date): boolean {
		return day.getDay() === 1 || day.getDay() === 5;
	}

	type MonthItem =
		| { id: string; kind: 'rdv'; time: string; name: string; projet?: string; status?: string }
		| {
				id: string;
				kind: 'evenement';
				time: string;
				type: string;
				titre: string;
		  }
		| { id: string; kind: 'gestion'; time: string }
		| { id: string; kind: 'reunion'; time: string };

	const toISO = (d: Date) =>
		`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
			d.getDate()
		).padStart(2, '0')}`;

	const today = new Date();
	today.setHours(0, 0, 0, 0);
	let anchor = $state(new Date(today.getFullYear(), today.getMonth(), 1));

	const monthCells = $derived.by(() => {
		const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
		const start = new Date(first);
		start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
		return Array.from({ length: 42 }, (_, i) => {
			const d = new Date(start);
			d.setDate(start.getDate() + i);
			return d;
		}).filter((d) => d.getDay() !== 0);
	});

	// RDV de l'agence (type RDV, non traités) par date.
	const rdvsByDate = $derived.by(() => {
		const map = new Map<string, MonthItem[]>();
		for (const c of contacts.data ?? []) {
			const date = c.followUp?.date;
			if (!date || c.followUp?.type !== 'rdv' || c.statut === 'traité') continue;
			const item: MonthItem = {
				id: c._id,
				kind: 'rdv',
				time: c.followUp?.time ?? '',
				name: c.name,
				projet: c.projet ?? undefined,
				status: c.followUp?.status ?? undefined
			};
			map.set(date, [...(map.get(date) ?? []), item]);
		}
		for (const list of map.values()) list.sort((a, b) => a.time.localeCompare(b.time));
		return map;
	});

	const monthItemsByDate = $derived.by(() => {
		const map = new Map<string, MonthItem[]>();
		for (const [date, list] of rdvsByDate) map.set(date, [...list]);
		for (const e of evenements.data ?? []) {
			const item: MonthItem = {
				id: e._id,
				kind: 'evenement',
				time: e.start,
				type: e.type,
				titre: e.titre
			};
			map.set(e.date, [...(map.get(e.date) ?? []), item]);
		}
		for (const cell of monthCells) {
			const date = toISO(cell);
			if (isGestionDay(cell)) {
				map.set(date, [
					...(map.get(date) ?? []),
					{ id: `gestion-${date}`, kind: 'gestion', time: '14:00' }
				]);
			}
			if (isReunionDay(cell)) {
				map.set(date, [
					...(map.get(date) ?? []),
					{ id: `reunion-${date}`, kind: 'reunion', time: '08:30' }
				]);
			}
		}
		for (const list of map.values()) list.sort((a, b) => a.time.localeCompare(b.time));
		return map;
	});

	const label = $derived(
		anchor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
	);

	function prev() {
		anchor = new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1);
	}
	function next() {
		anchor = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
	}

	function sameDay(a: Date, b: Date): boolean {
		return (
			a.getFullYear() === b.getFullYear() &&
			a.getMonth() === b.getMonth() &&
			a.getDate() === b.getDate()
		);
	}
</script>

<Dialog bind:open>
	<DialogContent
		class="max-h-[90vh] overflow-y-auto rounded-xl border-line bg-card sm:max-w-3xl"
	>
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2.5 text-[15px] font-semibold">
				<span
					class="grid size-8 place-items-center rounded-lg border border-line bg-card2 text-muted-foreground"
				>
					<CalendarDays class="size-4" strokeWidth={1.7} />
				</span>
				Agenda
			</DialogTitle>
		</DialogHeader>

		<div class="mb-3 flex items-center justify-between gap-2">
			<Button variant="outline" size="icon-sm" onclick={prev} aria-label="Mois précédent">
				<ChevronLeft class="size-4" />
			</Button>
			<span class="text-[13px] font-semibold text-foreground capitalize">{label}</span>
			<Button variant="outline" size="icon-sm" onclick={next} aria-label="Mois suivant">
				<ChevronRight class="size-4" />
			</Button>
		</div>

		<div class="overflow-x-auto rounded-lg border border-line">
			<div class="grid min-w-[660px] grid-cols-6 border-b border-line bg-card2/50 max-md:min-w-0">
				{#each WEEKDAYS as wd}
					<div
						class="px-2 py-2 text-center text-[10px] font-semibold tracking-wider text-muted-foreground uppercase"
					>
						{wd}
					</div>
				{/each}
			</div>
			<div class="grid min-w-[660px] grid-cols-6 max-md:min-w-0">
				{#each monthCells as cell, i}
					{@const inMonth = cell.getMonth() === anchor.getMonth()}
					{@const dateISO = toISO(cell)}
					<div
						class={[
							'min-h-[92px] p-1.5 max-md:min-h-[64px] max-md:p-1',
							i % 6 !== 0 ? 'border-l border-line/50' : '',
							i < 30 ? 'border-b border-line/50' : ''
						].join(' ')}
					>
						<p
							class={[
								'mb-1 flex size-6 items-center justify-center rounded-full text-[12px] font-semibold',
								sameDay(cell, today)
									? 'bg-primary text-primary-foreground'
									: inMonth
										? 'text-foreground'
										: 'text-muted-foreground/40'
							].join(' ')}
						>
							{cell.getDate()}
						</p>
						<div class="space-y-1">
							{#each monthItemsByDate.get(dateISO) ?? [] as item (item.id)}
								{#if item.kind === 'rdv'}
									<div
										class={[chipMonth, rdvStatusClass(item.status)].join(' ')}
										title={[item.name, item.projet].filter(Boolean).join(' — ')}
									>
										<span class="hidden font-mono text-[10px] opacity-70 sm:block">
											{item.time}
										</span>
										<span
											class="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
										>
											<span class="hidden sm:inline">{RDV_EMOJI}</span>
											{item.name}
										</span>
									</div>
								{:else if item.kind === 'evenement'}
									<div
										class={[chipMonth, EVENT_STYLE[item.type] ?? EVENT_STYLE.gestion].join(
											' '
										)}
										title={`${EVENT_TYPE_LABEL[item.type] ?? item.type} — ${item.time}`}
									>
										<span class="hidden font-mono text-[10px] opacity-70 sm:block">
											{item.time}
										</span>
										<span
											class="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
										>
											<span class="hidden sm:inline">{EVENT_EMOJI[item.type] ?? ''}</span>
											{item.titre}
										</span>
									</div>
								{:else if item.kind === 'gestion'}
									<div
										class={chipMonth + ' ' + EVENT_STYLE.gestion}
										title="Gestion dossier — créneau fixe (mercredi et vendredi 14h–15h)"
									>
										<span class="hidden font-mono text-[10px] opacity-70 sm:block">14:00</span>
										<span
											class="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
										>
											Gestion dossier
										</span>
									</div>
								{:else}
									<div
										class={chipMonth + ' ' + EVENT_STYLE.gestion}
										title="Réunion — créneau fixe (lundi et vendredi 8h30–9h30)"
									>
										<span class="hidden font-mono text-[10px] opacity-70 sm:block">08:30</span>
										<span
											class="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
										>
											📋 Réunion
										</span>
									</div>
								{/if}
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>

		<p class="mt-1 text-[11px] text-muted-foreground">
			Aperçu en temps réel de l'agenda de l'agence (RDV, événements et créneaux d'équipe).
		</p>

		<DialogFooter class="gap-2">
			<Button variant="ghost" type="button" onclick={() => (open = false)}>Fermer</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>