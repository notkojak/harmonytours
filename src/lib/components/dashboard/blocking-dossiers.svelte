<script lang="ts">
	import { AlertTriangle, FileX } from '@lucide/svelte';
	import { useQuery } from 'convex-svelte';
	import { api } from '../../../convex/_generated/api.js';
	import { authState } from '$lib/auth-state.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import ContactDialog, { type ContactRow } from '$lib/components/ContactDialog.svelte';

	const ventesErreur = useQuery(api.ventes.listVentesEnErreur, () =>
		authState.isAuthenticated ? {} : 'skip'
	);

	// Contacts de l'agence (clients inclus) : permet d'ouvrir la fiche du client
	// au clic sur un dossier bloquant, même si le contact a été créé par un autre.
	const contacts = useQuery(api.contacts.listAgenda, () =>
		authState.isAuthenticated ? { includeClients: true } : 'skip'
	);

	let selected = $state<ContactRow | null>(null);
	let dialogOpen = $state(false);

	function openContact(contactId: string) {
		selected = contacts.data?.find((c) => c._id === contactId) ?? null;
		if (selected) dialogOpen = true;
	}

	function produitsOf(v: { produits: { produit: string }[] }): string {
		return v.produits.map((p) => p.produit).join(', ');
	}

	function formatDate(ts: number): string {
		return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
	}
</script>

{#if (ventesErreur.data?.length ?? 0) > 0}
	<Card class="gap-0 rounded-2xl border-line py-0 shadow-none">
		<CardHeader class="flex items-center justify-between gap-3 px-5 pt-5 pb-0">
			<CardTitle class="flex items-center gap-2.5 text-[14px] font-semibold text-destructive">
				<span
					class="grid size-8 place-items-center rounded-lg border border-destructive/30 bg-destructive/10 text-destructive"
				>
					<AlertTriangle class="size-4" strokeWidth={1.7} />
				</span>
				Dossiers bloquants
			</CardTitle>
			<Badge variant="destructive" class="rounded-full px-2.5">
				{ventesErreur.data?.length ?? 0} en erreur
			</Badge>
		</CardHeader>
		<CardContent class="px-5 pt-2 pb-5">
			<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
				{#each ventesErreur.data ?? [] as vente (vente._id)}
					<button
						type="button"
						onclick={() => openContact(vente.contactId)}
						class="flex w-full cursor-pointer items-start gap-3 rounded-xl bg-destructive/5 px-3.5 py-2.5 text-left transition-colors hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-destructive/40 focus-visible:outline-none"
					>
						<span
							class="grid size-8 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive"
						>
							<FileX class="size-4" strokeWidth={1.7} />
						</span>
						<div class="min-w-0 flex-1 leading-tight">
							<div class="flex items-center justify-between gap-2">
								<p class="truncate text-[13px] font-semibold text-foreground">
									{vente.contactName}
								</p>
								<span class="shrink-0 text-[10.5px] text-muted-foreground">
									{formatDate(vente.erreur?.at ?? vente.date)}
								</span>
							</div>
							<p class="mt-0.5 truncate text-[11.5px] text-muted-foreground">
								{produitsOf(vente)}
							</p>
							<p class="mt-0.5 text-[11px] text-muted-foreground">
								Vendu par
								<span class="font-medium text-foreground/80">
									{vente.vendeurDisplay ?? vente.vendeurName}
								</span>
								{#if vente.erreur?.par}
									· Erreur posée par {vente.erreur.par}
								{/if}
							</p>
							{#if (vente.erreur?.manquants?.length ?? 0) > 0}
								<div class="mt-1.5 flex flex-wrap gap-1">
									{#each vente.erreur?.manquants ?? [] as manquant}
										<span
											class="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-medium text-orange-400"
										>
											{manquant}
										</span>
									{/each}
								</div>
							{/if}
							{#if vente.erreur?.note}
								<p class="mt-1.5 line-clamp-3 text-[11.5px] whitespace-pre-wrap text-foreground/75">
									{vente.erreur.note}
								</p>
							{/if}
						</div>
					</button>
				{/each}
			</div>
		</CardContent>
	</Card>

	<ContactDialog bind:contact={selected} bind:open={dialogOpen} />
{/if}
