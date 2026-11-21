<script lang="ts">
	import {
		Check,
		CreditCard,
		HandCoins,
		LoaderCircle,
		PhoneOff,
		RefreshCw,
		Ruler,
		ShieldAlert
	} from '@lucide/svelte';
	import { useMutation, useQuery } from 'convex-svelte';
	import { api } from '../../../convex/_generated/api.js';
	import type { Id } from '../../../convex/_generated/dataModel.js';
	import { authState } from '$lib/auth-state.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Card, CardContent, CardHeader } from '$lib/components/ui/card/index.js';
	import { dateCourt } from '$lib/data/vente-suivi';
	import ContactDialog, { type ContactRow } from '$lib/components/ContactDialog.svelte';

	type ActionKind =
		| 'pose'
		| 'metrage'
		| 'fiRefuse'
		| 'rdvAReprogrammer'
		| 'nonConfortee'
		| 'fiEnAttente'
		| 'sansAction'
		| 'clientSansSuite';

	type ActionItem = {
		key: string;
		kind: ActionKind;
		titre: string;
		date: string | null;
		jours: number | null;
		montantHT: number | null;
		contactId: string;
		venteId: string | null;
		commercial: string | null;
	};

	const alertes = useQuery(api.pilotage.alertes, () => (authState.isAuthenticated ? {} : 'skip'));
	const contacts = useQuery(api.contacts.listAgenda, () =>
		authState.isAuthenticated ? { includeClients: true } : 'skip'
	);
	const confirmerEtape = useMutation(api.ventes.confirmerEtape);

	const actions = $derived(alertes.data?.actions);
	const items = $derived((actions?.items ?? []) as ActionItem[]);
	const counts = $derived(actions?.counts);
	const total = $derived(actions?.total ?? 0);

	let busyKey = $state<string | null>(null);
	let selected = $state<ContactRow | null>(null);
	let dialogOpen = $state(false);

	function openContact(contactId: string) {
		selected = (contacts.data ?? []).find((c) => c._id === contactId) ?? null;
		if (selected) dialogOpen = true;
	}

	async function confirmer(item: ActionItem, event: MouseEvent) {
		event.stopPropagation();
		if (!item.venteId || busyKey) return;
		busyKey = item.key;
		try {
			await confirmerEtape({
				venteId: item.venteId as Id<'ventes'>,
				etape: item.kind === 'pose' ? 'pose' : 'metrage'
			});
		} catch (e) {
			console.error('Confirmation de l’étape impossible', e);
		} finally {
			busyKey = null;
		}
	}

	const kindLabel: Record<ActionKind, string> = {
		pose: 'Pose à confirmer',
		metrage: 'Métrage à confirmer',
		fiRefuse: 'FI refusé',
		rdvAReprogrammer: 'RDV à replacer',
		nonConfortee: 'À conforter',
		fiEnAttente: 'FI en attente',
		sansAction: 'Sans action',
		clientSansSuite: 'Client sans suite'
	};

	const kindClass: Record<ActionKind, string> = {
		pose: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
		metrage: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
		fiRefuse: 'bg-red-500/15 text-red-700 dark:text-red-300',
		rdvAReprogrammer: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
		nonConfortee: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
		fiEnAttente: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
		sansAction: 'bg-glass-2 text-muted-foreground',
		clientSansSuite: 'bg-teal-500/15 text-teal-700 dark:text-teal-300'
	};

	const chips: Array<{ key: keyof NonNullable<typeof counts>; label: string }> = [
		{ key: 'pose', label: 'Poses' },
		{ key: 'metrage', label: 'Métrages' },
		{ key: 'fiRefuse', label: 'FI refusés' },
		{ key: 'rdvAReprogrammer', label: 'RDV à replacer' },
		{ key: 'nonConfortee', label: 'À conforter' },
		{ key: 'fiEnAttente', label: 'FI en attente' },
		{ key: 'sansAction', label: 'Sans action' },
		{ key: 'clientSansSuite', label: 'Sans suite' }
	];

	function montant(n: number | null): string {
		if (n == null) return '';
		return `${n.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`;
	}

	function detail(item: ActionItem): string {
		const commercial = item.commercial ? ` · ${item.commercial}` : '';
		const date = item.date ? dateCourt(item.date) : '';
		const age = item.jours != null ? ` · ${item.jours} j` : '';
		switch (item.kind) {
			case 'pose':
				return `Pose du ${date}${age} · ${montant(item.montantHT)}${commercial}`;
			case 'metrage':
				return `Métrage du ${date}${age} · ${montant(item.montantHT)}${commercial}`;
			case 'fiRefuse':
				return `Financement refusé · ${montant(item.montantHT)}${commercial}`;
			case 'fiEnAttente':
				return `Financement en attente depuis ${item.jours ?? 0} j · ${montant(item.montantHT)}${commercial}`;
			case 'nonConfortee':
				return `Vente du ${date} · ${item.jours ?? 0} j · ${montant(item.montantHT)}${commercial}`;
			case 'rdvAReprogrammer':
				return `RDV du ${date}${age}${commercial}`;
			case 'clientSansSuite':
				return `Vente du ${date} · aucune pose planifiée${commercial}`;
			default:
				return `Aucune prochaine action planifiée${commercial}`;
		}
	}

	function icone(kind: ActionKind) {
		if (kind === 'pose' || kind === 'metrage') return Ruler;
		if (kind === 'fiRefuse' || kind === 'fiEnAttente') return CreditCard;
		if (kind === 'rdvAReprogrammer') return RefreshCw;
		if (kind === 'nonConfortee') return ShieldAlert;
		if (kind === 'clientSansSuite') return HandCoins;
		return PhoneOff;
	}
</script>

{#if total > 0}
	<Card class="gap-0 rounded-2xl border-0 py-0 shadow-none">
		<CardHeader class="flex flex-wrap items-center justify-end gap-3 px-5 pt-4 pb-0">
			<Badge variant="secondary" class="rounded-full bg-card2 px-2.5">
				{total} action{total > 1 ? 's' : ''}
			</Badge>
		</CardHeader>
		<CardContent class="px-5 pt-2 pb-5">
			<div class="mb-3 flex flex-wrap gap-1.5">
				{#each chips as chip (chip.key)}
					{#if (counts?.[chip.key] ?? 0) > 0}
						<span
							class="rounded-full bg-card2 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
						>
							{counts?.[chip.key]}
							{chip.label}
						</span>
					{/if}
				{/each}
			</div>

			<ul class="divide-y divide-line/60">
				{#each items as item (item.key)}
					{@const Icone = icone(item.kind)}
					<li class="flex items-center gap-2 py-1.5">
						<button
							type="button"
							onclick={() => openContact(item.contactId)}
							class="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-glass-2 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
						>
							<span
								class="grid size-7 shrink-0 place-items-center rounded-lg bg-card2 text-muted-foreground"
							>
								<Icone class="size-3.5" strokeWidth={1.7} />
							</span>
							<span class="min-w-0 flex-1">
								<span class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
									<span class="truncate text-[13px] font-semibold text-foreground">
										{item.titre}
									</span>
									<span
										class={[
											'rounded-sm px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap',
											kindClass[item.kind]
										].join(' ')}
									>
										{kindLabel[item.kind]}
									</span>
								</span>
								<span class="mt-0.5 block truncate text-[11.5px] text-muted-foreground">
									{detail(item)}
								</span>
							</span>
						</button>
						{#if item.kind === 'pose' || item.kind === 'metrage'}
							<button
								type="button"
								onclick={(event) => confirmer(item, event)}
								disabled={busyKey === item.key}
								class="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11.5px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/25 disabled:opacity-60 dark:text-emerald-300"
								title="Confirmer que l'étape a bien eu lieu"
							>
								{#if busyKey === item.key}
									<LoaderCircle class="size-3.5 animate-spin" />
								{:else}
									<Check class="size-3.5" />
								{/if}
								Confirmer
							</button>
						{/if}
					</li>
				{/each}
			</ul>

			{#if total > items.length}
				<p class="mt-2 text-[11.5px] text-muted-foreground">
					+ {total - items.length} autre{total - items.length > 1 ? 's' : ''} action{total -
						items.length >
					1
						? 's'
						: ''} à retrouver dans les onglets Ventes et Contacts.
				</p>
			{/if}
		</CardContent>
	</Card>

	<ContactDialog bind:contact={selected} bind:open={dialogOpen} />
{/if}
