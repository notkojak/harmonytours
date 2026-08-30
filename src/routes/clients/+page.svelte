<script lang="ts">
	import { Pencil, Search, Users } from '@lucide/svelte';
	import { useQuery } from 'convex-svelte';
	import { api } from '../../convex/_generated/api.js';
	import type { Id } from '../../convex/_generated/dataModel.js';
	import { authState } from '$lib/auth-state.svelte';
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
	import { formatPhone } from '$lib/data/phone';
	import ContactDialog, { type ContactRow } from '$lib/components/ContactDialog.svelte';
	import PersonTabs from '$lib/components/PersonTabs.svelte';
	import Avatar from '$lib/components/Avatar.svelte';

	// Onglet « par personne » (réservé aux managers) : undefined = Tout.
	let person = $state<Id<'users'> | undefined>(undefined);
	const clients = useQuery(api.ventes.listClients, () =>
		authState.isAuthenticated ? { personId: person } : 'skip'
	);

	let selected = $state<ContactRow | null>(null);
	let dialogOpen = $state(false);
	let search = $state('');

	const fmt = (n: number) =>
		n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

	// Produits additionnés sur toutes les ventes du client (sans doublons).
	function produitsOf(client: {
		contact: ContactRow;
		ventes: { produits: { produit: string }[] }[];
	}) {
		const set = new Set<string>();
		for (const v of client.ventes) for (const p of v.produits) set.add(p.produit);
		return [...set].join(', ');
	}

	// Commerciaux liés au client (sans doublons) : créateur du contact + vendeurs
	// des ventes (le binôme).
	function vendeurNamesOf(client: { contact: ContactRow; ventes: { vendeurName: string }[] }) {
		const set = new Set<string>();
		if (client.contact.createdByName) set.add(client.contact.createdByName);
		for (const v of client.ventes) if (v.vendeurName) set.add(v.vendeurName);
		return [...set];
	}
	function vendeursOf(client: { contact: ContactRow; ventes: { vendeurName: string }[] }) {
		return vendeurNamesOf(client).join(', ');
	}

	// Photos des commerciaux (nom complet → photo) pour les avatars.
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
	const initialsOf = (name: string | null | undefined): string =>
		(name ?? '')
			.trim()
			.split(/\s+/)
			.map((w) => w[0] ?? '')
			.slice(0, 2)
			.join('')
			.toUpperCase();

	const filtered = $derived(
		(clients.data ?? []).filter((client) =>
			client.contact.name.toLowerCase().includes(search.trim().toLowerCase())
		)
	);

	function formatDate(iso: string | null | undefined): string {
		if (!iso) return '—';
		const [y, m, d] = iso.split('-').map(Number);
		return new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'short'
		});
	}

	function openFiche(client: { contact: ContactRow; ventes: unknown[]; totalTTC: number }) {
		selected = client.contact;
		dialogOpen = true;
	}
</script>

<div class="space-y-5">
	<Card class="gap-0 rounded-xl border-line py-0 shadow-none">
		<CardHeader class="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-0">
			<CardTitle class="flex items-center gap-2.5 text-[14px] font-semibold">
				<span
					class="grid size-8 place-items-center rounded-lg border border-line bg-card2 text-muted-foreground"
				>
					<Users class="size-4" strokeWidth={1.7} />
				</span>
				Clients
			</CardTitle>
			<PersonTabs bind:value={person} />
			<div class="flex items-center gap-2">
				<div class="relative">
					<Search
						class="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
						strokeWidth={1.7}
					/>
					<Input
						type="search"
						placeholder="Rechercher par nom…"
						bind:value={search}
						class="h-8 w-56 border-line bg-base pl-8"
					/>
				</div>
				<Badge variant="secondary" class="rounded-full px-2">
					{filtered.length}
				</Badge>
			</div>
		</CardHeader>
		<CardContent class="px-5 pt-3 pb-5">
			{#if !clients.isLoading && (clients.data?.length ?? 0) === 0}
				<div class="flex flex-col items-center justify-center gap-2 py-14 text-center">
					<p class="text-[13px] font-medium text-foreground">Aucun client pour le moment.</p>
					<p class="max-w-sm text-[12px] text-muted-foreground">
						Les clients apparaissent ici dès qu'une vente est ajoutée à un contact depuis sa fiche.
					</p>
				</div>
			{:else}
				<div class="overflow-x-auto rounded-lg border border-line">
					<Table class="min-w-[680px]">
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
									Nom
								</TableHead>
								<TableHead
									class="px-4 py-3 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase"
								>
									Commercial
								</TableHead>
								<TableHead
									class="px-4 py-3 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase"
								>
									Téléphone
								</TableHead>
								<TableHead
									class="px-4 py-3 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase"
								>
									Produits
								</TableHead>
								<TableHead
									class="px-4 py-3 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase"
								>
									Total TTC
								</TableHead>
								<TableHead
									class="px-4 py-3 text-right text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase"
								>
									Fiche
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{#each filtered as client (client.contact._id)}
								<TableRow
									class="cursor-pointer border-line/60 transition-colors hover:bg-glass-1"
									onclick={() => openFiche(client)}
								>
									<TableCell class="px-4 py-3">
										<Badge
											class="rounded-sm bg-emerald-500/15 px-2 py-0.5 text-[11.5px] font-medium text-emerald-400"
										>
											Client
										</Badge>
									</TableCell>
									<TableCell class="px-4 py-3">
										{#if client.contact.followUp}
											<span class="inline-flex items-center gap-2 whitespace-nowrap">
												<span class="inline-block min-w-[4.5rem] text-[13.5px] text-foreground">
													{formatDate(client.contact.followUp.date)}
												</span>
												{#if client.contact.followUp.time}
													<span class="text-[11.5px] text-muted-foreground tabular-nums">
														{client.contact.followUp.time}
													</span>
												{/if}
											</span>
										{:else}
											<span class="text-[13.5px] text-muted-foreground">—</span>
										{/if}
									</TableCell>
									<TableCell class="px-4 py-3 text-[14px] font-medium text-foreground">
										{client.contact.name}
									</TableCell>
									<TableCell class="px-4 py-3 text-[13.5px] text-muted-foreground">
										{#if vendeurNamesOf(client).length > 0}
											<span class="flex flex-wrap items-center gap-x-3 gap-y-1">
												{#each vendeurNamesOf(client) as vendeur}
													<span class="flex items-center gap-1.5">
														<Avatar
															photo={photoForName(vendeur)}
															label={initialsOf(vendeur)}
															class="size-6 bg-muted text-[9px] font-bold text-muted-foreground"
														/>
														<span class="whitespace-nowrap">{vendeur}</span>
													</span>
												{/each}
											</span>
										{:else}
											—
										{/if}
									</TableCell>
									<TableCell class="px-4 py-3 font-mono text-[13.5px] text-muted-foreground">
										{formatPhone(client.contact.phone) || '—'}
									</TableCell>
									<TableCell class="max-w-[260px] px-4 py-3 text-[13.5px] text-muted-foreground">
										<span class="line-clamp-2">{produitsOf(client) || '—'}</span>
									</TableCell>
									<TableCell class="px-4 py-3 text-[13.5px] font-semibold text-foreground">
										{fmt(client.totalTTC)} €
									</TableCell>
									<TableCell class="px-4 py-3">
										<div class="flex justify-end text-muted-foreground">
											<Pencil class="size-3.5" strokeWidth={1.7} />
										</div>
									</TableCell>
								</TableRow>
							{/each}
							{#if filtered.length === 0}
								<TableRow class="border-line/60 hover:bg-transparent">
									<TableCell
										colspan={8}
										class="px-4 py-8 text-center text-[13px] text-muted-foreground"
									>
										{search.trim()
											? 'Aucun client ne correspond à la recherche.'
											: 'Aucun client pour le moment.'}
									</TableCell>
								</TableRow>
							{/if}
						</TableBody>
					</Table>
				</div>
			{/if}
		</CardContent>
	</Card>
</div>

<ContactDialog bind:contact={selected} bind:open={dialogOpen} />
