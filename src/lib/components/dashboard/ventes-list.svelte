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
		dateCourt,
		PUCE,
		paiementClass,
		paiementLabel,
		suiviClass,
		suiviDeVente,
		suiviLabel,
		prenoms
	} from '$lib/data/vente-suivi';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import ContactDialog, { type ContactRow } from '$lib/components/ContactDialog.svelte';
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
			<p class="mt-1 pl-6 text-[11.5px] font-medium text-muted-foreground">
				Suivi des dossiers et confortations
			</p>
		</div>
	</CardHeader>
	<CardContent class="px-5 pt-3 pb-5">
		<div class="overflow-x-auto rounded-2xl">
			<Table class="border-separate border-spacing-y-1.5">
				<TableHeader>
					<TableRow class="border-transparent bg-transparent hover:bg-transparent">
						<TableHead
							class="px-4 py-3 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase"
						>
							Statut
						</TableHead>
						<TableHead
							class="px-4 py-3 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase"
						>
							Confortation
						</TableHead>
						<TableHead
							class="px-4 py-3 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase"
						>
							Paiement
						</TableHead>
						<TableHead
							class="px-4 py-3 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase"
						>
							Suivi pose
						</TableHead>
						<TableHead
							class="px-4 py-3 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase"
						>
							Date
						</TableHead>
						<TableHead
							class="px-4 py-3 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase"
						>
							Commercial
						</TableHead>
						<TableHead
							class="px-4 py-3 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase"
						>
							Client
						</TableHead>
						<TableHead
							class="px-4 py-3 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase"
						>
							Produits
						</TableHead>
						<TableHead
							class="px-4 py-3 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase"
						>
							Métrage
						</TableHead>
						<TableHead
							class="px-4 py-3 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase"
						>
							Pose
						</TableHead>
						<TableHead
							class="px-4 py-3 text-right text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase"
						>
							HT
						</TableHead>
						<TableHead
							class="px-4 py-3 text-right text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase"
						>
							TTC
						</TableHead>
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
							<TableCell class="px-4 py-3 align-top">
								<div class="flex flex-col items-start gap-1">
									<span class={[PUCE, statutClass(vente.statut)].join(' ')}>
										{statutLabel(vente.statut)}
									</span>
								</div>
							</TableCell>
							<TableCell class="px-4 py-3 align-top">
								<span class={[PUCE, confortationClass(vente.confortee)].join(' ')}>
									{confortationLabel(vente.confortee)}
								</span>
							</TableCell>
							<TableCell class="px-4 py-3 align-top">
								<div class="flex flex-col items-start gap-1">
									{#if vente.paiement}
										<span
											class={[
												PUCE,
												paiementClass(vente.paiement, vente.fiStatut, vente.fiAccepte)
											].join(' ')}
										>
											{paiementLabel(vente.paiement)}
										</span>
									{:else}
										<span class="text-[13px] text-muted-foreground">—</span>
									{/if}
								</div>
							</TableCell>
							<TableCell class="px-4 py-3">
								{#if vente.statut === 'annulée'}
									<span class="text-[13px] text-muted-foreground">—</span>
								{:else}
									<span class={[PUCE, suiviClass(suiviDeVente(vente))].join(' ')}>
										{suiviLabel(suiviDeVente(vente))}
									</span>
								{/if}
							</TableCell>
							<TableCell class="px-4 py-3 text-[13px] text-muted-foreground">
								{formatDate(vente.date)}
							</TableCell>
							<TableCell class="px-4 py-3">
								<div class="flex items-center gap-2">
									<Avatar
										photo={photoForName(vente.vendeurName)}
										label={vente.vendeurName
											.split(' ')
											.map((part) => part[0])
											.join('')}
										class="size-7 bg-muted text-[10px] font-bold text-muted-foreground"
									/>
									<span class="text-[13px] text-muted-foreground">
										{prenoms(vente.vendeurDisplay ?? vente.vendeurName)}
									</span>
								</div>
							</TableCell>
							<TableCell class="px-4 py-3 text-[13px] font-medium text-foreground">
								{vente.contactName}
							</TableCell>
							<TableCell class="max-w-[240px] px-4 py-3 text-[13px] text-muted-foreground">
								<span class="line-clamp-1">{produitsOf(vente)}</span>
							</TableCell>
							<TableCell
								class="px-4 py-3 text-[13px] whitespace-nowrap text-muted-foreground tabular-nums"
							>
								{dateCourt(vente.dateMetrage)}
							</TableCell>
							<TableCell
								class="px-4 py-3 text-[13px] whitespace-nowrap text-muted-foreground tabular-nums"
							>
								{dateCourt(vente.datePose)}
							</TableCell>
							<TableCell class="px-4 py-3 text-right text-[13px] text-muted-foreground">
								{fmt(vente.totalHT)} €
							</TableCell>
							<TableCell class="px-4 py-3 text-right text-[13px] font-semibold text-foreground">
								{fmt(vente.totalTTC)} €
							</TableCell>
						</TableRow>
					{/each}
					{#if affichees.length === 0 && !ventes.isLoading}
						<TableRow class="border-0 hover:bg-transparent">
							<TableCell
								colspan={12}
								class="px-4 py-8 text-center text-[13px] text-muted-foreground"
							>
								Aucune vente pour le moment.
							</TableCell>
						</TableRow>
					{/if}
					<TableRow
						class="border-0 hover:bg-transparent [&>td]:bg-card2 [&>td:first-child]:rounded-l-xl [&>td:last-child]:rounded-r-xl"
					>
						<TableCell
							colspan={10}
							class="px-4 py-3 text-[13px] font-semibold tracking-wider text-muted-foreground uppercase"
						>
							Total
						</TableCell>
						<TableCell class="px-4 py-3 text-right text-[13px] font-semibold text-foreground">
							{fmt(totalHT)} € HT
						</TableCell>
						<TableCell class="px-4 py-3 text-right text-[13px] font-bold text-foreground">
							{fmt(totalTTC)} € TTC
						</TableCell>
					</TableRow>
					{#if annulations.length > 0}
						<TableRow
							class="border-0 hover:bg-transparent [&>td]:bg-red-500/[0.06] [&>td:first-child]:rounded-l-xl [&>td:last-child]:rounded-r-xl"
						>
							<TableCell
								colspan={10}
								class="px-4 py-3 text-[13px] font-semibold tracking-wider text-red-700 uppercase dark:text-red-300"
							>
								Total annulations ({annulations.length})
							</TableCell>
							<TableCell
								class="px-4 py-3 text-right text-[13px] font-semibold text-red-700 dark:text-red-300"
							>
								{fmt(totalAnnulationsHT)} € HT
							</TableCell>
							<TableCell
								class="px-4 py-3 text-right text-[13px] font-bold text-red-700 dark:text-red-300"
							>
								{fmt(totalAnnulationsTTC)} € TTC
							</TableCell>
						</TableRow>
					{/if}
				</TableBody>
			</Table>
		</div>
	</CardContent>
</Card>

<ContactDialog bind:contact={selected} bind:open={dialogOpen} />
