<script lang="ts">
	import { Download, Handshake } from '@lucide/svelte';
	import { useQuery } from 'convex-svelte';
	import { api } from '../../../convex/_generated/api.js';
	import { authState } from '$lib/auth-state.svelte';
	import { statsPeriod } from '$lib/stats-period.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { datedName, downloadCsv } from '$lib/csv';
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

	// Mise en avant des informations de paiement et de confortation.
	const enAttente = $derived(duMois.filter((v) => v.statut === 'en attente'));
	const valides = $derived(duMois.filter((v) => v.statut === 'valide'));
	const confortees = $derived(duMois.filter((v) => v.confortee));
	const financees = $derived(duMois.filter((v) => v.paiement === 'financement'));
	const totalValide = $derived(valides.reduce((sum, v) => sum + v.totalHT, 0));
	const totalEnAttente = $derived(enAttente.reduce((sum, v) => sum + v.totalHT, 0));
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

	function exporter() {
		const rows: (string | number)[][] = [
			['Date', 'Statut', 'Paiement', 'Commercial', 'Client', 'Produits', 'HT', 'TTC']
		];
		for (const v of affichees) {
			rows.push([
				new Date(v.date).toLocaleDateString('fr-FR'),
				statutLabel(v.statut),
				v.paiement ?? '',
				vendeurNames(v),
				v.contactName,
				produitsOf(v),
				Math.round(v.totalHT * 100) / 100,
				Math.round(v.totalTTC * 100) / 100
			]);
		}
		downloadCsv(datedName(`harmony-ventes-${mois}`), rows);
	}

	// Les deux personnes du binôme quand la vente est partagée.
	function vendeurNames(v: { vendeurDisplay?: string | null; vendeurName: string }): string {
		return v.vendeurDisplay ?? v.vendeurName;
	}
</script>

<Card class="gap-0 rounded-2xl border-line py-0 shadow-none">
	<CardHeader class="flex items-center justify-between gap-3 px-5 pt-5 pb-0">
		<CardTitle class="flex items-center gap-2.5 text-[14px] font-semibold">
			<span
				class="grid size-8 place-items-center rounded-lg border border-line bg-card2 text-muted-foreground"
			>
				<Handshake class="size-4" strokeWidth={1.7} />
			</span>
			Ventes du mois
			<Badge variant="secondary" class="rounded-sm px-2">
				{affichees.length} ventes
			</Badge>
			<Button variant="outline" size="sm" class="ml-auto gap-1.5" onclick={exporter}>
				<Download class="size-3.5" /> CSV
			</Button>
		</CardTitle>
	</CardHeader>
	<CardContent class="px-5 pt-3 pb-5">
		<div class="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
			<div class="rounded-xl border border-line bg-card2/60 px-3 py-2">
				<p class="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
					Total HT
				</p>
				<p class="mt-0.5 text-[16px] leading-none font-bold text-foreground tabular-nums">
					{fmt(totalHT)} €
				</p>
				<p class="mt-1 text-[10px] text-muted-foreground">en attente incluse</p>
			</div>
			<div class="rounded-xl border border-line bg-card2/60 px-3 py-2">
				<p class="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
					Validé HT
				</p>
				<p class="mt-0.5 text-[16px] leading-none font-bold text-emerald-700 tabular-nums dark:text-emerald-300">
					{fmt(totalValide)} €
				</p>
				<p class="mt-1 text-[10px] text-muted-foreground">{valides.length} vente(s)</p>
			</div>
			<div class="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2">
				<p class="text-[10px] font-semibold tracking-wide text-amber-700 uppercase dark:text-amber-300">
					En attente HT
				</p>
				<p class="mt-0.5 text-[16px] leading-none font-bold text-amber-700 tabular-nums dark:text-amber-300">
					{fmt(totalEnAttente)} €
				</p>
				<p class="mt-1 text-[10px] text-muted-foreground">{enAttente.length} vente(s)</p>
			</div>
			<div class="rounded-xl border border-line bg-card2/60 px-3 py-2">
				<p class="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
					Confortation
				</p>
				<p class="mt-0.5 text-[16px] leading-none font-bold text-foreground tabular-nums">
					{confortees.length} / {duMois.filter((v) => v.statut !== 'annulée').length}
				</p>
				<p class="mt-1 text-[10px] text-muted-foreground">
					{financees.length} financement(s)
				</p>
			</div>
		</div>

		<div class="overflow-x-auto rounded-xl border border-line">
			<Table>
				<TableHeader>
					<TableRow class="border-line bg-transparent hover:bg-transparent">
						<TableHead
							class="px-4 py-3 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase"
						>
							Statut
						</TableHead>
						<TableHead
							class="px-4 py-3 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase"
						>
							Paiement
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
								'cursor-pointer border-line/60 transition-colors hover:bg-glass-1',
								vente.statut === 'annulée'
									? 'bg-red-500/[0.03]'
									: vente.statut === 'en attente'
										? 'bg-amber-500/[0.03]'
										: ''
							].join(' ')}
							onclick={() => openFiche(vente)}
						>
							<TableCell class="px-4 py-3">
								<div class="flex flex-col items-start gap-1">
									<span
										class={[
											'rounded-sm px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
											statutClass(vente.statut)
										].join(' ')}
									>
										{statutLabel(vente.statut)}
									</span>
									{#if vente.statut !== 'annulée'}
										<span
											class={[
												'inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap',
												vente.confortee
													? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
													: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
											].join(' ')}
										>
											{vente.confortee ? '✓ Confortée' : 'À conforter'}
										</span>
									{/if}
								</div>
							</TableCell>
							<TableCell class="px-4 py-3">
								<div class="flex flex-col items-start gap-1">
									{#if vente.paiement}
										<span
											class={[
												'inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap',
												vente.paiement === 'financement'
													? 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300'
													: 'border-line bg-glass-2 text-foreground'
											].join(' ')}
										>
											{vente.paiement === 'financement' ? '💳 Financement' : '💶 Comptant'}
										</span>
										{#if vente.paiement === 'financement'}
											<span
												class={[
													'inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[9.5px] font-semibold whitespace-nowrap',
													vente.fiAccepte
														? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
														: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
												].join(' ')}
											>
												{vente.fiAccepte ? '✓ FI accepté' : 'FI en attente'}
											</span>
										{/if}
									{:else}
										<span class="text-[11.5px] text-muted-foreground">—</span>
									{/if}
								</div>
							</TableCell>
							<TableCell class="px-4 py-3 text-[13.5px] text-muted-foreground">
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
									<span class="text-[13.5px] text-muted-foreground">
										{vente.vendeurDisplay ?? vente.vendeurName}
									</span>
								</div>
							</TableCell>
							<TableCell class="px-4 py-3 text-[13px] font-medium text-foreground">
								{vente.contactName}
							</TableCell>
							<TableCell class="max-w-[240px] px-4 py-3 text-[13.5px] text-muted-foreground">
								<span class="line-clamp-1">{produitsOf(vente)}</span>
							</TableCell>
							<TableCell class="px-4 py-3 text-right text-[13.5px] text-muted-foreground">
								{fmt(vente.totalHT)} €
							</TableCell>
							<TableCell class="px-4 py-3 text-right text-[13.5px] font-semibold text-foreground">
								{fmt(vente.totalTTC)} €
							</TableCell>
						</TableRow>
					{/each}
					{#if affichees.length === 0 && !ventes.isLoading}
						<TableRow class="border-line/60 hover:bg-transparent">
							<TableCell
								colspan={8}
								class="px-4 py-8 text-center text-[13px] text-muted-foreground"
							>
								Aucune vente pour le moment.
							</TableCell>
						</TableRow>
					{/if}
					<TableRow class="bg-glass-1 hover:bg-glass-1">
						<TableCell
							colspan={6}
							class="px-4 py-3 text-[12px] font-semibold tracking-wider text-muted-foreground uppercase"
						>
							Total
						</TableCell>
						<TableCell class="px-4 py-3 text-right text-[13.5px] font-semibold text-foreground">
							{fmt(totalHT)} € HT
						</TableCell>
						<TableCell class="px-4 py-3 text-right text-[13px] font-bold text-foreground">
							{fmt(totalTTC)} € TTC
						</TableCell>
					</TableRow>
					{#if annulations.length > 0}
						<TableRow class="bg-red-500/[0.04] hover:bg-red-500/[0.04]">
							<TableCell
								colspan={6}
								class="px-4 py-3 text-[12px] font-semibold tracking-wider text-red-700 uppercase dark:text-red-300"
							>
								Total annulations ({annulations.length})
							</TableCell>
							<TableCell
								class="px-4 py-3 text-right text-[13.5px] font-semibold text-red-700 dark:text-red-300"
							>
								{fmt(totalAnnulationsHT)} € HT
							</TableCell>
							<TableCell
								class="px-4 py-3 text-right text-[13.5px] font-bold text-red-700 dark:text-red-300"
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
