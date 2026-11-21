<script lang="ts">
	import { useQuery } from 'convex-svelte';
	import { api } from '../../../convex/_generated/api.js';
	import { authState } from '$lib/auth-state.svelte';
	import { statsPeriod } from '$lib/stats-period.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import {
		confortationClass,
		confortationLabel,
		paiementClass,
		PUCE_FINE,
		prenoms
	} from '$lib/data/vente-suivi';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import ContactDialog, { type ContactRow } from '$lib/components/ContactDialog.svelte';
	import VenteParcours from '$lib/components/VenteParcours.svelte';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table/index.js';

	const ventes = useQuery(api.ventes.listVentes, () => (authState.isAuthenticated ? {} : 'skip'));

	// Photos des membres (nom complet → photo) pour les avatars des commerciaux.
	const membresPhotos = useQuery(api.evenements.listMembres, () =>
		authState.isAuthenticated ? {} : 'skip'
	);
	const photoByName = $derived.by(() => {
		const map = new Map<string, string>();
		for (const m of membresPhotos.data ?? []) {
			const key = `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim().toLowerCase();
			if (m.photo && key) map.set(key, m.photo);
		}
		return map;
	});
	const photoForName = (name: string | null | undefined): string | undefined =>
		name ? photoByName.get(name.trim().toLowerCase()) : undefined;

	const fmt = (n: number) =>
		n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

	// La carte suit le mois sélectionné dans le filtre du tableau de bord : on ne
	// garde que les ventes datées de ce mois (les autres mois restent hors carte).
	const mois = $derived(statsPeriod.date.slice(0, 7));
	const moisDe = (ts: number) => {
		const d = new Date(ts);
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
	};
	// Toutes les ventes du mois restent affichées dans le tableau, y compris les
	// annulées (badge rouge « Annulée ») ; le total des annulations est rappelé
	// en dessous.
	const duMois = $derived((ventes.data ?? []).filter((v) => moisDe(v.date) === mois));
	const affichees = $derived(duMois);
	const annulations = $derived(duMois.filter((v) => v.statut === 'annulée'));

	const totalHT = $derived(affichees.reduce((sum, v) => sum + v.totalHT, 0));
	const totalTTC = $derived(affichees.reduce((sum, v) => sum + v.totalTTC, 0));

	const totalAnnulationsHT = $derived(annulations.reduce((sum, v) => sum + v.totalHT, 0));
	const totalAnnulationsTTC = $derived(annulations.reduce((sum, v) => sum + v.totalTTC, 0));

	let selected = $state<ContactRow | null>(null);
	let dialogOpen = $state(false);

	function openFiche(vente: { contact?: ContactRow | null }) {
		if (!vente.contact) return;
		selected = vente.contact;
		dialogOpen = true;
	}

	const statutLabel = (s: string | undefined | null): string => {
		if (s === 'erreur') return 'Erreur';
		if (s === 'annulée') return 'Annulée';
		if (s === 'en attente') return 'En attente';
		return 'Valide';
	};
	const statutClass = (s: string | undefined | null): string => {
		if (s === 'erreur') return 'bg-orange-500/15 text-orange-700 dark:text-orange-300';
		if (s === 'annulée') return 'bg-red-500/15 text-red-700 dark:text-red-300';
		if (s === 'en attente') return 'bg-sky-500/15 text-sky-700 dark:text-sky-300';
		return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
	};

	function produitsOf(v: { produits: { produit: string }[] }): string {
		return v.produits.map((p) => p.produit).join(', ');
	}

	function formatDate(ts: number): string {
		return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
	}

	// En-têtes et cellules partagent le même pas horizontal serré : le tableau
	// (9 colonnes) tient dans la carte sans défilement latéral.
	const CELL = 'px-2.5 py-3';
	const paiementCourt = (paiement: string | null | undefined): string =>
		paiement === 'financement' ? 'Financement' : paiement === 'comptant' ? 'Comptant' : '—';
	const HEAD =
		'px-2.5 py-2.5 text-[10.5px] font-semibold tracking-wide whitespace-nowrap text-muted-foreground uppercase';
</script>

<Card class="gap-0 rounded-2xl border-0 py-0 shadow-none">
	<CardHeader class="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-0">
		<div class="min-w-0">
			<CardTitle class="flex items-center gap-2.5 text-[14px] font-semibold">
				<span class="text-[15px] leading-none" aria-hidden="true">🧾</span>
				Ventes du mois
				<Badge variant="secondary" class="rounded-full bg-card2 px-2">
					{affichees.length} ventes
				</Badge>
			</CardTitle>
			<p class="mt-1 pl-6 text-[11.5px] font-medium text-muted-foreground">Suivi des dossiers</p>
		</div>
	</CardHeader>
	<CardContent class="px-5 pt-3 pb-5">
		<div class="overflow-x-auto rounded-2xl">
			<Table class="border-separate border-spacing-y-1.5">
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
					{#each affichees as vente (vente._id)}
						<TableRow
							class={[
								'cursor-pointer border-0 transition-colors [&>td:first-child]:rounded-l-xl [&>td:last-child]:rounded-r-xl',
								vente.statut === 'annulée'
									? '[&:hover>td]:bg-red-500/[0.1] [&>td]:bg-red-500/[0.06]'
									: vente.statut === 'en attente'
										? '[&:hover>td]:bg-amber-500/[0.1] [&>td]:bg-amber-500/[0.06]'
										: '[&:hover>td]:bg-glass-3 [&>td]:bg-card2'
							].join(' ')}
							onclick={() => openFiche(vente)}
						>
							<TableCell class={CELL}>
								<span class={[PUCE_FINE, statutClass(vente.statut)].join(' ')}>
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
								{formatDate(vente.date)}
							</TableCell>
							<TableCell class={CELL}>
								<div class="flex items-center gap-1.5">
									<Avatar
										photo={photoForName(vente.vendeurName)}
										label={vente.vendeurName
											.split(' ')
											.map((part) => part[0])
											.join('')}
										class="size-6 bg-muted text-[9px] font-bold text-muted-foreground"
									/>
									<span
										class="block max-w-[5rem] truncate text-[12.5px] text-muted-foreground"
										title={vente.vendeurDisplay ?? vente.vendeurName}
									>
										{prenoms(vente.vendeurDisplay ?? vente.vendeurName)}
									</span>
								</div>
							</TableCell>
							<TableCell class={CELL}>
								<span
									class="block max-w-[7.5rem] truncate text-[12.5px] font-medium text-foreground"
									title={vente.contactName}
								>
									{vente.contactName}
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
					{#if affichees.length === 0 && !ventes.isLoading}
						<TableRow class="border-0 hover:bg-transparent">
							<TableCell
								colspan={9}
								class="px-4 py-8 text-center text-[13px] text-muted-foreground"
							>
								Aucune vente pour le moment.
							</TableCell>
						</TableRow>
					{/if}
				</TableBody>
			</Table>
		</div>

		<div
			class="mt-1 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-card2 px-3 py-2.5"
		>
			<span class="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
				Total
			</span>
			<span class="flex items-baseline gap-3 text-[12.5px] tabular-nums">
				<span class="text-muted-foreground">{fmt(totalHT)} € HT</span>
				<span class="font-bold text-foreground">{fmt(totalTTC)} € TTC</span>
			</span>
		</div>

		{#if annulations.length > 0}
			<div
				class="mt-1.5 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-red-500/[0.06] px-3 py-2.5"
			>
				<span
					class="text-[11px] font-semibold tracking-wider text-red-700 uppercase dark:text-red-300"
				>
					Total annulations ({annulations.length})
				</span>
				<span class="flex items-baseline gap-3 text-[12.5px] tabular-nums">
					<span class="text-red-700 dark:text-red-300">{fmt(totalAnnulationsHT)} € HT</span>
					<span class="font-bold text-red-700 dark:text-red-300">
						{fmt(totalAnnulationsTTC)} € TTC
					</span>
				</span>
			</div>
		{/if}
	</CardContent>
</Card>

<ContactDialog bind:contact={selected} bind:open={dialogOpen} />
