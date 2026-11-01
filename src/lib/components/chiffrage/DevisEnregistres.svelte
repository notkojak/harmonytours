<script lang="ts">
	import { Check, FileCheck2, LoaderCircle, Plus, RefreshCw, Trash2 } from '@lucide/svelte';
	import { useMutation, useQuery } from 'convex-svelte';
	import { api } from '../../../convex/_generated/api.js';
	import type { Id } from '../../../convex/_generated/dataModel.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		Dialog,
		DialogContent,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { euro, type LigneDevis } from '$lib/data/book';
	import type { Deblocage } from '$lib/data/deblocage';

	let {
		lignes = $bindable<LigneDevis[]>([]),
		remise = $bindable(0),
		deblocage = $bindable<Deblocage | null>(null)
	}: {
		lignes: LigneDevis[];
		remise: number;
		/** trace de la place ouverte par le responsable, qui justifie la remise */
		deblocage: Deblocage | null;
	} = $props();

	const devis = useQuery(api.devis.list, () => ({ limit: 8 }));
	const saveDevis = useMutation(api.devis.save);
	const setStatut = useMutation(api.devis.setStatut);
	const convertir = useMutation(api.devis.convertirEnVente);
	const removeDevis = useMutation(api.devis.remove);

	let dialogOpen = $state(false);
	let clientName = $state('');
	let contactQuery = $state('');
	let contactId = $state<Id<'contacts'> | undefined>();
	let contactLabel = $state('');
	let busy = $state(false);
	let error = $state('');
	let flash = $state<string | null>(null);

	// Recherche de fiche : on n'interroge le serveur qu'à partir de 2 caractères.
	const contacts = useQuery(api.contacts.search, () =>
		contactQuery.trim().length >= 2 ? { q: contactQuery, limit: 6 } : 'skip'
	);

	function ouvrir() {
		clientName = '';
		contactId = undefined;
		contactLabel = '';
		contactQuery = '';
		error = '';
		dialogOpen = true;
	}

	function choisirContact(c: { _id: string; name: string }) {
		contactId = c._id as Id<'contacts'>;
		contactLabel = c.name;
		clientName = c.name;
		contactQuery = '';
	}

	async function enregistrer() {
		if (!clientName.trim() || lignes.length === 0) return;
		busy = true;
		error = '';
		try {
			await saveDevis({
				clientName: clientName.trim(),
				...(contactId ? { contactId } : {}),
				lignes: lignes.map((l) => ({
					uid: l.uid,
					ref: l.ref,
					designation: l.designation,
					...(l.detail ? { detail: l.detail } : {}),
					prixUnitaireHT: l.prixUnitaireHT,
					quantite: l.quantite,
					unite: l.unite,
					tva: l.tva
				})),
				remise
			});
			dialogOpen = false;
			flash = 'Devis enregistré';
			setTimeout(() => (flash = null), 2500);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Enregistrement impossible.';
		} finally {
			busy = false;
		}
	}

	function reprendre(d: { lignes: unknown[]; remise: number }) {
		lignes = (d.lignes as LigneDevis[]).map((l) => ({
			...l,
			unite: l.unite as LigneDevis['unite']
		}));
		remise = d.remise;
		// Un devis repris garde sa remise : la trace du déblocage est reconstituée
		// pour que le panneau l'affiche comme acquise.
		deblocage = d.remise > 0 ? { remise: d.remise, le: Date.now() } : null;
		flash = 'Devis repris';
		setTimeout(() => (flash = null), 2500);
	}

	async function convertirEnVente(d: {
		_id: string;
		contactId?: string | null;
		venteId?: string | null;
	}) {
		error = '';
		try {
			await convertir({ devisId: d._id as Id<'devis'> });
			flash = 'Vente créée (en attente de validation)';
			setTimeout(() => (flash = null), 3000);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Conversion impossible.';
		}
	}

	async function changerStatut(
		d: { _id: string },
		statut: 'brouillon' | 'envoyé' | 'accepté' | 'refusé'
	) {
		try {
			await setStatut({ devisId: d._id as Id<'devis'>, statut });
		} catch (e) {
			error = e instanceof Error ? e.message : 'Mise à jour impossible.';
		}
	}

	async function supprimer(d: { _id: string }) {
		try {
			await removeDevis({ devisId: d._id as Id<'devis'> });
		} catch (e) {
			error = e instanceof Error ? e.message : 'Suppression impossible.';
		}
	}

	const jour = (ts: number) =>
		new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
	const statutClass: Record<string, string> = {
		brouillon: 'bg-glass-3 text-muted-foreground',
		envoyé: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
		accepté: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
		refusé: 'bg-red-500/15 text-red-700 dark:text-red-300'
	};
</script>

<div class="mt-3 rounded-2xl border border-line bg-card p-3.5">
	<div class="flex items-center gap-2">
		<FileCheck2 class="size-4 text-ink-soft" strokeWidth={1.7} />
		<p class="text-[13px] font-semibold text-ink">Devis enregistrés</p>
		<Button
			size="xs"
			variant="outline"
			class="ml-auto gap-1"
			onclick={ouvrir}
			disabled={lignes.length === 0}
			title={lignes.length === 0 ? 'Ajoute d’abord des lignes au devis' : 'Enregistrer ce devis'}
		>
			<Plus class="size-3.5" /> Enregistrer
		</Button>
	</div>

	{#if flash}
		<p
			class="mt-2 rounded-md bg-emerald-500/10 px-2.5 py-1.5 text-[11.5px] font-medium text-emerald-700 dark:text-emerald-300"
		>
			{flash}
		</p>
	{/if}
	{#if error}
		<p class="mt-2 rounded-md bg-destructive/10 px-2.5 py-1.5 text-[11.5px] text-destructive">
			{error}
		</p>
	{/if}

	<div class="mt-2 space-y-1.5">
		{#each devis.data ?? [] as d (d._id)}
			<div class="rounded-xl border border-line bg-base px-2.5 py-2">
				<div class="flex items-center gap-2">
					<span class="font-mono text-[10.5px] text-ink-mute">{d.numero}</span>
					<span class="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink"
						>{d.clientName}</span
					>
					<span class="shrink-0 text-[11.5px] font-bold text-ink tabular-nums">
						{euro.format(d.totalTTC)}
					</span>
				</div>
				<div class="mt-1 flex flex-wrap items-center gap-1.5">
					<select
						value={d.statut}
						onchange={(e) =>
							changerStatut(
								d,
								e.currentTarget.value as 'brouillon' | 'envoyé' | 'accepté' | 'refusé'
							)}
						class={[
							'rounded-md border-0 px-1.5 py-0.5 text-[10.5px] font-semibold outline-none',
							statutClass[d.statut] ?? statutClass.brouillon
						].join(' ')}
						aria-label="Statut du devis"
					>
						<option value="brouillon">Brouillon</option>
						<option value="envoyé">Envoyé</option>
						<option value="accepté">Accepté</option>
						<option value="refusé">Refusé</option>
					</select>
					<span class="text-[10px] text-ink-mute">{jour(d.updatedAt)}</span>
					{#if d.contactName}
						<span class="truncate text-[10px] text-ink-mute">· {d.contactName}</span>
					{/if}
					<div class="ml-auto flex items-center gap-1">
						<button
							type="button"
							onclick={() => reprendre(d)}
							title="Reprendre ce devis dans le panier"
							class="rounded p-1 text-ink-mute transition-colors hover:text-brand"
						>
							<RefreshCw class="size-3" strokeWidth={2} />
						</button>
						{#if d.contactId && !d.venteId}
							<button
								type="button"
								onclick={() => convertirEnVente(d)}
								title="Convertir en vente"
								class="rounded p-1 text-ink-mute transition-colors hover:text-emerald-600"
							>
								<Check class="size-3" strokeWidth={2.4} />
							</button>
						{:else if d.venteId}
							<span class="text-[9.5px] font-semibold text-emerald-700 dark:text-emerald-300"
								>vente</span
							>
						{/if}
						<button
							type="button"
							onclick={() => supprimer(d)}
							title="Archiver le devis"
							class="rounded p-1 text-ink-mute transition-colors hover:text-destructive"
						>
							<Trash2 class="size-3" strokeWidth={2} />
						</button>
					</div>
				</div>
			</div>
		{/each}
		{#if (devis.data?.length ?? 0) === 0}
			<p class="py-1 text-[11.5px] text-ink-mute">
				Aucun devis enregistré pour l'instant. Ils seront partagés avec l'agence et convertibles en
				vente.
			</p>
		{/if}
	</div>
</div>

<Dialog bind:open={dialogOpen}>
	<DialogContent class="max-w-md rounded-xl border-line bg-card">
		<DialogHeader>
			<DialogTitle class="text-[14px] font-semibold">Enregistrer le devis</DialogTitle>
		</DialogHeader>

		<div class="space-y-3">
			<div class="space-y-1.5">
				<Label for="devisClient">Client</Label>
				<Input
					id="devisClient"
					bind:value={clientName}
					placeholder="Nom du client"
					class="border-input bg-base"
				/>
				{#if contactLabel}
					<p class="text-[11px] text-emerald-700 dark:text-emerald-300">
						Rattaché à la fiche : {contactLabel}
					</p>
				{/if}
			</div>

			<div class="space-y-1.5">
				<Label for="devisContactSearch">Rattacher à une fiche (facultatif)</Label>
				<Input
					id="devisContactSearch"
					bind:value={contactQuery}
					placeholder="Rechercher un nom, un téléphone…"
					class="border-input bg-base"
				/>
				{#if (contacts.data?.length ?? 0) > 0}
					<div class="max-h-36 overflow-y-auto rounded-md border border-line bg-base">
						{#each contacts.data ?? [] as c (c._id)}
							<button
								type="button"
								onclick={() => choisirContact(c)}
								class="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] text-foreground hover:bg-glass-2"
							>
								<span class="min-w-0 flex-1 truncate">{c.name}</span>
								<span class="shrink-0 text-[10.5px] text-muted-foreground">
									{c.phone ?? ''}
								</span>
							</button>
						{/each}
					</div>
				{/if}
				<p class="text-[10.5px] text-muted-foreground">
					Sans fiche, le devis est enregistré mais ne pourra pas être converti en vente.
				</p>
			</div>
		</div>

		<DialogFooter class="gap-2">
			<Button variant="ghost" onclick={() => (dialogOpen = false)} disabled={busy}>Annuler</Button>
			<Button onclick={enregistrer} disabled={busy || !clientName.trim()}>
				{#if busy}<LoaderCircle class="size-4 animate-spin" />{/if}
				Enregistrer
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
