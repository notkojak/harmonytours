<script lang="ts">
	import { Handshake } from '@lucide/svelte';
	import { useQuery } from 'convex-svelte';
	import { api } from '../../../convex/_generated/api.js';
	import { authState } from '$lib/auth-state.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
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

	// Toutes les ventes restent affichées dans le tableau, y compris les annulées
	// (badge rouge « Annulée ») ; le total des annulations est rappelé en dessous.
	const affichees = $derived(ventes.data ?? []);
	const annulations = $derived((ventes.data ?? []).filter((v) => v.statut === 'annulée'));

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
		if (s === 'erreur') return 'bg-orange-500/15 text-orange-400';
		if (s === 'annulée') return 'bg-red-500/15 text-red-400';
		if (s === 'en attente') return 'bg-sky-500/15 text-sky-400';
		return 'bg-emerald-500/15 text-emerald-400';
	};

	function produitsOf(v: { produits: { produit: string }[] }): string {
		return v.produits.map((p) => p.produit).join(', ');
	}

	function formatDate(ts: number): string {
		return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
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
			<Badge variant="secondary" class="rounded-full px-2">
				{affichees.length} ventes
			</Badge>
		</CardTitle>
	</CardHeader>
	<CardContent class="px-5 pt-2 pb-5">
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
								vente.statut === 'annulée' ? 'bg-red-500/[0.03]' : ''
							].join(' ')}
							onclick={() => openFiche(vente)}
						>
							<TableCell class="px-4 py-3">
								<span
									class={[
										'rounded-sm px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap',
										statutClass(vente.statut)
									].join(' ')}
								>
									{statutLabel(vente.statut)}
								</span>
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
								colspan={7}
								class="px-4 py-8 text-center text-[13px] text-muted-foreground"
							>
								Aucune vente pour le moment.
							</TableCell>
						</TableRow>
					{/if}
					<TableRow class="bg-glass-1 hover:bg-glass-1">
						<TableCell
							colspan={5}
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
								colspan={5}
								class="px-4 py-3 text-[12px] font-semibold tracking-wider text-red-400 uppercase"
							>
								Total annulations ({annulations.length})
							</TableCell>
							<TableCell class="px-4 py-3 text-right text-[13.5px] font-semibold text-red-400">
								{fmt(totalAnnulationsHT)} € HT
							</TableCell>
							<TableCell class="px-4 py-3 text-right text-[13.5px] font-bold text-red-400">
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
