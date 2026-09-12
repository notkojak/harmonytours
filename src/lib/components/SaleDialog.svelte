<script lang="ts">
	import { LoaderCircle, Plus, Trash2 } from '@lucide/svelte';
	import { useMutation, useQuery } from 'convex-svelte';
	import { api } from '../../convex/_generated/api.js';
	import type { Id } from '../../convex/_generated/dataModel.js';
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
	import {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger
	} from '$lib/components/ui/select/index.js';
	import { FAMILLES } from '$lib/data/catalogue';
	import { dateInputToMs, msToDateInput } from '$lib/data/dates';

	let {
		open = $bindable(false),
		contactId,
		commercialName,
		venteId,
		initialVente
	}: {
		open?: boolean;
		contactId?: Id<'contacts'> | string;
		commercialName?: string;
		venteId?: string;
		initialVente?: {
			produits: { produit: string; tva: number; montantHT: number }[];
			vendeurId?: string | null;
			// Date de la vente (ms) affichée dans le champ date.
			date?: number | null;
		} | null;
	} = $props();

	const addVente = useMutation(api.ventes.addVente);
	const updateVente = useMutation(api.ventes.updateVente);
	const vendeurs = useQuery(api.employes.listVendeurs, () => (open ? {} : 'skip'));
	let vendeurId = $state<string | undefined>();
	// Date de la vente (AAAA-MM-JJ) : modifiable, elle place la vente dans les
	// statistiques du mois correspondant.
	let venteDate = $state(msToDateInput(Date.now()));

	const isEdit = $derived(!!venteId);
	const titre = $derived(isEdit ? 'Modifier la vente' : 'Ajouter une vente');

	type LigneProduit = {
		produit: string;
		tva: '5.5' | '10' | '20';
		montantHT: string;
	};

	let lignes = $state<LigneProduit[]>([]);
	let busy = $state(false);
	let error = $state('');
	let lastVenteId = $state<string | undefined>();

	function addLigne() {
		lignes = [...lignes, { produit: FAMILLES[0] ?? '', tva: '20', montantHT: '' }];
	}

	function removeLigne(index: number) {
		lignes = lignes.filter((_, i) => i !== index);
	}

	$effect(() => {
		// Réinitialise à l'ouverture, ou quand on passe d'une vente à une autre en édition.
		if (open && (lignes.length === 0 || lastVenteId !== venteId)) {
			lastVenteId = venteId;
			if (isEdit && initialVente) {
				lignes = initialVente.produits.map((p) => ({
					produit: p.produit,
					tva: String(p.tva) as '5.5' | '10' | '20',
					montantHT: String(p.montantHT).replace('.', ',')
				}));
				vendeurId = initialVente.vendeurId ?? undefined;
				venteDate = msToDateInput(initialVente.date ?? Date.now());
			} else {
				lignes = [{ produit: FAMILLES[0] ?? '', tva: '20', montantHT: '' }];
				vendeurId = undefined;
				venteDate = msToDateInput(Date.now());
			}
			error = '';
		}
	});

	// Auto-sélection du vendeur : le commercial lié au RDV du contact si présent,
	// sinon l'utilisateur connecté (premier de la liste).
	$effect(() => {
		const list = vendeurs.data;
		if (open && list && list.length > 0 && !vendeurId) {
			const match = commercialName
				? list.find((v) => v.name.toLowerCase() === commercialName.toLowerCase())
				: undefined;
			vendeurId = match?._id ?? list.find((v) => v.isMe)?._id ?? list[0]?._id;
		}
	});

	const montant = (l: LigneProduit) => parseFloat(String(l.montantHT ?? '').replace(',', '.')) || 0;

	const totalHT = $derived(lignes.reduce((sum, l) => sum + montant(l), 0));
	const totalTVA = $derived(
		lignes.reduce((sum, l) => sum + (montant(l) * parseFloat(l.tva)) / 100, 0)
	);
	const totalTTC = $derived(totalHT + totalTVA);

	const fmt = (n: number) =>
		n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

	function close() {
		open = false;
	}

	async function save() {
		if (!contactId) return;
		const produits = lignes
			.filter((l) => l.produit && montant(l) > 0)
			.map((l) => ({
				produit: l.produit,
				tva: parseFloat(l.tva) as 5.5 | 10 | 20,
				montantHT: montant(l)
			}));
		if (produits.length === 0) {
			error = 'Ajoute au moins un produit avec un montant HT valide.';
			return;
		}
		const date = dateInputToMs(venteDate);
		busy = true;
		error = '';
		try {
			if (isEdit && venteId) {
				await updateVente({
					venteId: venteId as Id<'ventes'>,
					produits,
					...(vendeurId ? { vendeurId: vendeurId as Id<'users'> } : {}),
					...(date ? { date } : {})
				});
			} else {
				await addVente({
					contactId: contactId as Id<'contacts'>,
					produits,
					...(vendeurId ? { vendeurId: vendeurId as Id<'users'> } : {}),
					...(date ? { date } : {})
				});
			}
			lignes = [];
			close();
		} catch (e) {
			error = e instanceof Error ? e.message : "Erreur lors de l'enregistrement de la vente.";
		} finally {
			busy = false;
		}
	}
</script>

<Dialog bind:open>
	<DialogContent class="sm:max-w-3xl">
		<DialogHeader>
			<DialogTitle>{titre}</DialogTitle>
		</DialogHeader>

		<div class="space-y-3">
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<div class="space-y-1">
					<Label>Commercial accompagnateur</Label>
					<Select type="single" bind:value={vendeurId}>
						<SelectTrigger class="w-full border-line bg-base">
							<span data-slot="select-value">
								{vendeurs?.data?.find((v) => v._id === vendeurId)?.name ??
									'Choisir un commercial'}
							</span>
						</SelectTrigger>
						<SelectContent>
							{#each vendeurs?.data ?? [] as v}
								<SelectItem value={v._id}>{v.name}{v.isMe ? ' (moi)' : ''}</SelectItem>
							{/each}
						</SelectContent>
					</Select>
				</div>

				<div class="space-y-1">
					<Label for="venteDate">Date de la vente</Label>
					<Input id="venteDate" type="date" bind:value={venteDate} class="border-line bg-base" />
				</div>
			</div>

			<div class="flex items-center justify-between text-[12px] font-medium text-muted-foreground">
				<span>Produits de la vente</span>
				<Button variant="outline" size="sm" onclick={addLigne}>
					<Plus class="size-3.5" />
					Ajouter un produit
				</Button>
			</div>

			{#each lignes as ligne, i (i)}
				<div class="rounded-lg border border-line bg-base p-3">
					<div class="space-y-1.5">
						<Label>Produit</Label>
						<Select type="single" bind:value={lignes[i].produit}>
							<SelectTrigger class="w-full border-line bg-base">
								<span data-slot="select-value">
									{lignes[i].produit || 'Choisir un produit'}
								</span>
							</SelectTrigger>
							<SelectContent>
								{#each FAMILLES as f}
									<SelectItem value={f}>{f}</SelectItem>
								{/each}
							</SelectContent>
						</Select>
					</div>
					<div class="mt-2 grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_120px_auto]">
						<div class="space-y-1">
							<Label>Montant HT (€)</Label>
							<Input
								type="number"
								min="0"
								step="0.01"
								placeholder="0,00"
								bind:value={lignes[i].montantHT}
								class="border-line bg-base"
							/>
						</div>
						<div class="space-y-1">
							<Label>TVA</Label>
							<Select type="single" bind:value={lignes[i].tva}>
								<SelectTrigger class="w-full border-line bg-base">
									<span data-slot="select-value">{lignes[i].tva} %</span>
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="5.5">5,5 %</SelectItem>
									<SelectItem value="10">10 %</SelectItem>
									<SelectItem value="20">20 %</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<Button
							variant="ghost"
							size="icon-sm"
							class="text-muted-foreground hover:text-destructive"
							onclick={() => removeLigne(i)}
							aria-label="Supprimer le produit"
						>
							<Trash2 class="size-4" />
						</Button>
					</div>
				</div>
			{/each}

			{#if lignes.length === 0}
				<p
					class="rounded-lg border border-dashed border-line p-4 text-center text-[12px] text-muted-foreground"
				>
					Aucun produit. Clique sur « Ajouter un produit » pour commencer.
				</p>
			{/if}

			<div
				class="flex items-center justify-end gap-4 rounded-lg border border-line bg-card2 px-4 py-2.5 text-[12.5px]"
			>
				<span class="text-muted-foreground">
					Total HT : <span class="font-semibold text-foreground">{fmt(totalHT)} €</span>
				</span>
				<span class="text-muted-foreground">
					TVA : <span class="font-semibold text-foreground">{fmt(totalTVA)} €</span>
				</span>
				<span class="text-muted-foreground">
					Total TTC : <span class="font-semibold text-foreground">{fmt(totalTTC)} €</span>
				</span>
			</div>

			{#if error}
				<p class="text-[12px] text-destructive">{error}</p>
			{/if}
		</div>

		<DialogFooter>
			<Button variant="outline" onclick={close}>Annuler</Button>
			<Button onclick={save} disabled={busy}>
				{#if busy}
					<LoaderCircle class="size-4 animate-spin" />
				{/if}
				{isEdit ? 'Enregistrer les modifications' : 'Enregistrer la vente'}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
