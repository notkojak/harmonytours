<script lang="ts">
	import { pageEmojis } from '$lib/data/dashboard';
	import { Download, Receipt, Search } from '@lucide/svelte';
	import { useQuery } from 'convex-svelte';
	import { api } from '../../convex/_generated/api.js';
	import type { Id } from '../../convex/_generated/dataModel.js';
	import { authState } from '$lib/auth-state.svelte';
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import ContactDialog, { type ContactRow } from '$lib/components/ContactDialog.svelte';
	import VenteParcours from '$lib/components/VenteParcours.svelte';
	import PersonTabs from '$lib/components/PersonTabs.svelte';
	import { datedName, downloadCsv } from '$lib/csv';
	import { msToDateInput } from '$lib/data/dates';
	import {
		confortationClass,
		confortationLabel,
		fiStatutOf,
		paiementClass,
		PUCE_FINE,
		suiviDeVente,
		suiviLabel,
		prenoms
	} from '$lib/data/vente-suivi';

	// Toutes les ventes de mon périmètre, avec le contact pour ouvrir sa fiche.
	// On part des clients (déjà filtrés côté serveur) et on déroule leurs ventes :
	// chaque ligne connaît ainsi son client complet.
	let person = $state<Id<'users'> | undefined>(undefined);
	const clients = useQuery(api.ventes.listClients, () =>
		authState.isAuthenticated ? { personId: person } : 'skip'
	);

	let search = $state(page.url.searchParams.get('q') ?? '');

	// Recherche globale : la page peut être ouverte avec ?q=… pour préremplir.
	$effect(() => {
		const q = page.url.searchParams.get('q');
		if (q !== null) {
			untrack(() => {
				if (search !== q) search = q;
			});
		}
	});

	// Filtre rapide sur les dossiers qui demandent une relance.
	type Filtre = 'toutes' | 'aConforter' | 'fiAttente' | 'fiRefuse';
	let filtre = $state<Filtre>('toutes');

	const lignes = $derived(
		(clients.data ?? []).flatMap((client) =>
			client.ventes.map((vente) => ({ ...vente, contact: client.contact }))
		)
	);

	// Un dossier annulé ne demande plus de relance : il sort des filtres.
	const estActive = (vente: { statut?: string | null }) => vente.statut !== 'annulée';
	const estFiAttente = (vente: {
		paiement?: string | null;
		fiStatut?: string | null;
		fiAccepte?: boolean | null;
		statut?: string | null;
	}) =>
		estActive(vente) &&
		vente.paiement === 'financement' &&
		fiStatutOf(vente.fiStatut, vente.fiAccepte) === 'en attente';
	const estFiRefuse = (vente: {
		paiement?: string | null;
		fiStatut?: string | null;
		fiAccepte?: boolean | null;
		statut?: string | null;
	}) =>
		estActive(vente) &&
		vente.paiement === 'financement' &&
		fiStatutOf(vente.fiStatut, vente.fiAccepte) === 'refusé';
	const estAConforter = (vente: { confortee?: boolean | null; statut?: string | null }) =>
		vente.statut === 'valide' && vente.confortee !== true;

	const filtres = $derived([
		{ key: 'toutes' as const, label: 'Toutes', count: lignes.length },
		{
			key: 'aConforter' as const,
			label: 'À conforter',
			count: lignes.filter(estAConforter).length
		},
		{
			key: 'fiAttente' as const,
			label: 'FI en attente',
			count: lignes.filter(estFiAttente).length
		},
		{ key: 'fiRefuse' as const, label: 'FI refusé', count: lignes.filter(estFiRefuse).length }
	]);

	const fmt = (n: number) =>
		n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	const commercialFull = (vente: { vendeurDisplay?: string; vendeurName: string }) =>
		vente.vendeurDisplay ?? vente.vendeurName;
	// Colonne « Commercial » : prénom seul ; le nom complet reste en info-bulle.
	const commercialOf = (vente: { vendeurDisplay?: string; vendeurName: string }) =>
		prenoms(commercialFull(vente));
	const produitsOf = (vente: { produits: { produit: string }[] }) =>
		[...new Set(vente.produits.map((p) => p.produit))].join(', ');

	// Pas horizontal serré et puces compactes : le tableau (9 colonnes) tient
	// dans la carte sans défilement latéral.
	const CELL = 'px-2.5 py-3';
	const HEAD =
		'px-2.5 py-2.5 text-[10.5px] font-semibold tracking-wide whitespace-nowrap text-muted-foreground uppercase';
	const paiementCourt = (paiement: string | null | undefined): string =>
		paiement === 'financement' ? 'Financement' : paiement === 'comptant' ? 'Comptant' : '—';
	const statutLabel = (statut?: string | null) =>
		statut === 'annulée'
			? 'Annulée'
			: statut === 'erreur'
				? 'Erreur'
				: statut === 'en attente'
					? 'En attente'
					: 'Valide';
	const dateVente = (ms: number) => {
		const [y, m, d] = msToDateInput(ms).split('-').map(Number);
		return new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'short'
		});
	};

	// Même ordre que le tableau « Ventes du mois » : les ventes les plus récentes
	// d'abord.
	const ventesFiltrees = $derived.by(() => {
		const q = search.trim().toLowerCase();
		const list = lignes.filter((ligne) => {
			if (filtre === 'aConforter' && !estAConforter(ligne)) return false;
			if (filtre === 'fiAttente' && !estFiAttente(ligne)) return false;
			if (filtre === 'fiRefuse' && !estFiRefuse(ligne)) return false;
			return (
				!q ||
				ligne.contact.name.toLowerCase().includes(q) ||
				commercialFull(ligne).toLowerCase().includes(q)
			);
		});
		return [...list].sort(
			(a, b) => b.date - a.date || a.contact.name.localeCompare(b.contact.name)
		);
	});
	const totalHT = $derived(ventesFiltrees.reduce((s, v) => s + v.totalHT, 0));
	const totalTTC = $derived(ventesFiltrees.reduce((s, v) => s + v.totalTTC, 0));

	let selected = $state<ContactRow | null>(null);
	let dialogOpen = $state(false);
	function openFiche(contact: ContactRow) {
		selected = contact;
		dialogOpen = true;
	}

	function exporter() {
		const rows: (string | number)[][] = [
			[
				'Statut',
				'Confortation',
				'Paiement',
				'Suivi pose',
				'Date',
				'Client',
				'Commercial',
				'Produits',
				'Métrage',
				'Pose',
				'Total HT',
				'Total TTC'
			]
		];
		for (const vente of ventesFiltrees) {
			rows.push([
				statutLabel(vente.statut),
				confortationLabel(vente.confortee),
				vente.paiement === 'financement'
					? 'Financement'
					: vente.paiement === 'comptant'
						? 'Comptant'
						: '',
				suiviLabel(suiviDeVente(vente)),
				dateVente(vente.date),
				vente.contact.name,
				commercialFull(vente),
				produitsOf(vente),
				vente.dateMetrage ?? '',
				vente.datePose ?? '',
				Math.round(vente.totalHT * 100) / 100,
				Math.round(vente.totalTTC * 100) / 100
			]);
		}
		downloadCsv(datedName('harmony-ventes'), rows);
	}
</script>

<div class="space-y-5">
	<Card class="gap-0 rounded-2xl border-0 py-0 shadow-none">
		<CardHeader class="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-0">
			<div class="min-w-0">
				<CardTitle class="flex items-center gap-2.5 text-[14px] font-semibold">
					<span class="text-[15px] leading-none" aria-hidden="true">{pageEmojis['/ventes']}</span>
					Ventes
				</CardTitle>
			</div>
			<div class="flex items-center gap-2">
				<Badge variant="secondary" class="rounded-full bg-card2 px-2.5">
					{ventesFiltrees.length}
				</Badge>
				<Button variant="outline" size="sm" class="hidden gap-1.5" onclick={exporter}>
					<Download class="size-3.5" /> CSV
				</Button>
			</div>
		</CardHeader>
		<CardContent class="px-5 pt-4 pb-5">
			<div class="mb-3 flex flex-wrap items-center gap-2">
				{#each filtres as f (f.key)}
					<button
						type="button"
						onclick={() => (filtre = f.key)}
						class={[
							'rounded-full px-3 py-1 text-[12px] font-semibold transition-colors',
							filtre === f.key
								? 'bg-ink text-background'
								: 'bg-card2 text-muted-foreground hover:bg-glass-3'
						].join(' ')}
					>
						{f.label}
						<span class="ml-1 tabular-nums opacity-70">{f.count}</span>
					</button>
				{/each}
			</div>
			<div class="mb-4 flex flex-wrap items-center gap-2">
				<PersonTabs bind:value={person} />
				<div class="relative ml-auto">
					<Search
						class="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
						strokeWidth={1.7}
					/>
					<Input
						type="search"
						placeholder="Rechercher un client, un commercial…"
						bind:value={search}
						class="h-9 w-64 rounded-full border-0 bg-card2 pr-3 pl-8 text-[13px] shadow-none focus-visible:ring-2 focus-visible:ring-ink/10"
					/>
				</div>
			</div>
			{#if !clients.isLoading && ventesFiltrees.length === 0}
				<div class="flex flex-col items-center justify-center gap-2 py-14 text-center">
					<p class="text-[13px] font-medium text-foreground">Aucune vente pour le moment.</p>
					<p class="max-w-sm text-[13px] text-muted-foreground">
						Les ventes apparaissent ici dès qu'un dossier est vendu depuis la fiche d'un contact.
					</p>
				</div>
			{:else}
				<div class="overflow-x-auto rounded-2xl">
					<Table class="w-full border-separate border-spacing-y-1.5">
						<TableHeader>
							<TableRow class="border-transparent bg-transparent hover:bg-transparent">
								<TableHead class={HEAD}>Statut</TableHead>
								<TableHead class={HEAD}>Confortation</TableHead>
								<TableHead class={HEAD}>Paiement</TableHead>
								<TableHead class={[HEAD, 'hidden lg:table-cell']}>Date</TableHead>
								<TableHead class={HEAD}>Commercial</TableHead>
								<TableHead class={HEAD}>Client</TableHead>
								<TableHead class={[HEAD, 'hidden 2xl:table-cell']}>Produits</TableHead>
								<TableHead class={HEAD}>Parcours</TableHead>
								<TableHead class={[HEAD, 'text-right']}>Total</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{#each ventesFiltrees as vente (vente._id)}
								{@const suivi = suiviDeVente(vente)}
								<TableRow
									class={[
										'cursor-pointer border-0 transition-colors [&>td:first-child]:rounded-l-xl [&>td:last-child]:rounded-r-xl',
										vente.statut === 'annulée'
											? '[&:hover>td]:bg-red-500/16 [&>td]:bg-red-500/10'
											: vente.statut === 'erreur'
												? '[&:hover>td]:bg-orange-500/16 [&>td]:bg-orange-500/10'
												: suivi === 'posée'
													? '[&:hover>td]:bg-emerald-500/16 [&>td]:bg-emerald-500/10'
													: '[&:hover>td]:bg-glass-3 [&>td]:bg-card2'
									].join(' ')}
									onclick={() => openFiche(vente.contact)}
								>
									<TableCell class={CELL}>
										<span
											class={[
												PUCE_FINE,
												vente.statut === 'annulée'
													? 'bg-red-500/15 text-red-700 dark:text-red-300'
													: vente.statut === 'erreur'
														? 'bg-orange-500/15 text-orange-700 dark:text-orange-300'
														: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
											].join(' ')}
										>
											{statutLabel(vente.statut)}
										</span>
									</TableCell>
									<TableCell class={CELL}>
										<span class={[PUCE_FINE, confortationClass(vente.confortee)].join(' ')}>
											{confortationLabel(vente.confortee)}
										</span>
									</TableCell>
									<TableCell class={CELL}>
										{#if vente.paiement}
											<span
												class={[
													PUCE_FINE,
													paiementClass(vente.paiement, vente.fiStatut, vente.fiAccepte)
												].join(' ')}
											>
												{paiementCourt(vente.paiement)}
											</span>
										{:else}
											<span class="text-[12.5px] text-muted-foreground">—</span>
										{/if}
									</TableCell>
									<TableCell
										class={[
											CELL,
											'hidden text-[12.5px] whitespace-nowrap text-muted-foreground lg:table-cell'
										]}
									>
										{dateVente(vente.date)}
									</TableCell>
									<TableCell class={CELL}>
										<span
											class="block max-w-[5rem] truncate text-[12.5px] text-muted-foreground"
											title={commercialFull(vente)}
										>
											{commercialOf(vente)}
										</span>
									</TableCell>
									<TableCell class={CELL}>
										<span
											class="block max-w-[7.5rem] truncate text-[12.5px] font-medium text-foreground"
											title={vente.contact.name}
										>
											{vente.contact.name}
										</span>
									</TableCell>
									<TableCell class={[CELL, 'hidden 2xl:table-cell']}>
										<span
											class="block max-w-[8rem] truncate text-[12.5px] text-muted-foreground"
											title={produitsOf(vente)}
										>
											{produitsOf(vente) || '—'}
										</span>
									</TableCell>
									<TableCell class={CELL}>
										<VenteParcours {vente} />
									</TableCell>
									<TableCell class={[CELL, 'text-right whitespace-nowrap']}>
										<div class="flex flex-col items-end leading-tight">
											<span class="text-[12.5px] font-semibold text-foreground tabular-nums">
												{fmt(vente.totalTTC)} €
											</span>
											<span class="text-[10.5px] text-muted-foreground tabular-nums">
												{fmt(vente.totalHT)} € HT
											</span>
										</div>
									</TableCell>
								</TableRow>
							{/each}
							{#if ventesFiltrees.length === 0}
								<TableRow class="border-transparent hover:bg-transparent">
									<TableCell
										colspan={9}
										class="px-4 py-8 text-center text-[13px] text-muted-foreground"
									>
										Aucune vente ne correspond à la recherche.
									</TableCell>
								</TableRow>
							{/if}
						</TableBody>
					</Table>
				</div>

				<div
					class="mt-1 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-card2/40 px-3 py-2.5"
				>
					<span class="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
						Total
					</span>
					<span class="flex items-baseline gap-3 text-[12.5px] tabular-nums">
						<span class="text-muted-foreground">{fmt(totalHT)} € HT</span>
						<span class="font-bold text-foreground">{fmt(totalTTC)} € TTC</span>
					</span>
				</div>
			{/if}
		</CardContent>
	</Card>
</div>

<ContactDialog bind:contact={selected} bind:open={dialogOpen} />
