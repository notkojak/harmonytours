<script lang="ts">
	import { untrack } from 'svelte';
	import { LoaderCircle } from '@lucide/svelte';
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
			// Montants de TVA par taux, tels qu'ils ont été saisis.
			tvaDetail?: { taux: number; montant: number }[] | null;
			vendeurId?: string | null;
			// Date de la vente (ms) affichée dans le champ date.
			date?: number | null;
			// Suivi commercial de la vente.
			confortee?: boolean | null;
			paiement?: 'comptant' | 'financement' | null;
			fiAccepte?: boolean | null;
		} | null;
	} = $props();

	const addVente = useMutation(api.ventes.addVente);
	const updateVente = useMutation(api.ventes.updateVente);
	// Le commercial et la date ne sont plus demandés : on reprend le commercial
	// du RDV (sinon l'utilisateur connecté) et la date du jour.
	const vendeurs = useQuery(api.employes.listVendeurs, () => (open ? {} : 'skip'));
	let vendeurId = $state<string | undefined>();
	let venteDate = $state(msToDateInput(Date.now()));
	// Suivi commercial : vente confortée, paiement comptant / financement, et
	// acceptation du dossier de financement (FI) le cas échéant.
	let confortee = $state(false);
	let paiement = $state<'comptant' | 'financement'>('comptant');
	let fiAccepte = $state(false);

	const isEdit = $derived(!!venteId);
	const titre = $derived(isEdit ? 'Modifier la vente' : 'Ajouter une vente');

	// Un prix HT, puis le montant de TVA de chaque taux utilisé, et le TTC qui
	// additionne le tout. Plusieurs taux peuvent cohabiter dans une même vente.
	const TAUX = ['5.5', '10', '20'] as const;
	type Taux = (typeof TAUX)[number];
	const TAUX_LABEL: Record<Taux, string> = { '5.5': '5,5 %', '10': '10 %', '20': '20 %' };

	let famille = $state('');
	let prixHT = $state('');
	let tvaMontants = $state<Record<Taux, string>>({ '5.5': '', '10': '', '20': '' });
	let busy = $state(false);
	let error = $state('');

	const vide = (): Record<Taux, string> => ({ '5.5': '', '10': '', '20': '' });
	const num = (v: string) => parseFloat(String(v ?? '').replace(',', '.')) || 0;

	const totalHT = $derived(num(prixHT));
	const totalTVA = $derived(TAUX.reduce((s, k) => s + num(tvaMontants[k]), 0));
	const totalTTC = $derived(totalHT + totalTVA);

	const fmt = (n: number) =>
		n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

	// À chaque ouverture, le formulaire repart de la vente éditée ou d'une page blanche.
	$effect(() => {
		if (!open) return;
		untrack(() => {
			error = '';
			if (isEdit && initialVente && initialVente.produits.length > 0) {
				const p = initialVente.produits;
				famille = p[0].produit;
				prixHT = String(Math.round(p.reduce((s, x) => s + x.montantHT, 0) * 100) / 100).replace(
					'.',
					','
				);
				// Le détail enregistré prime ; sinon on le retrouve depuis les lignes.
				const parTaux: Record<Taux, number> = { '5.5': 0, '10': 0, '20': 0 };
				if (initialVente.tvaDetail && initialVente.tvaDetail.length > 0) {
					for (const d of initialVente.tvaDetail) {
						const k = String(d.taux) as Taux;
						if (k in parTaux) parTaux[k] += d.montant;
					}
				} else {
					for (const ligne of p) {
						const k = String(ligne.tva) as Taux;
						if (k in parTaux) parTaux[k] += (ligne.montantHT * ligne.tva) / 100;
					}
				}
				tvaMontants = {
					'5.5': parTaux['5.5'] ? String(Math.round(parTaux['5.5'] * 100) / 100) : '',
					'10': parTaux['10'] ? String(Math.round(parTaux['10'] * 100) / 100) : '',
					'20': parTaux['20'] ? String(Math.round(parTaux['20'] * 100) / 100) : ''
				};
				vendeurId = initialVente.vendeurId ?? undefined;
				venteDate = msToDateInput(initialVente.date ?? Date.now());
				confortee = !!initialVente.confortee;
				paiement = initialVente.paiement ?? 'comptant';
				fiAccepte = !!initialVente.fiAccepte;
			} else {
				famille = '';
				prixHT = '';
				tvaMontants = vide();
				vendeurId = undefined;
				venteDate = msToDateInput(Date.now());
				confortee = false;
				paiement = 'comptant';
				fiAccepte = false;
			}
		});
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

	function close() {
		open = false;
	}

	async function save() {
		if (!contactId) return;
		if (!famille) {
			error = 'Choisis une famille de produit.';
			return;
		}
		if (totalHT <= 0) {
			error = 'Renseigne un prix HT.';
			return;
		}
		// Le prix HT et les montants de TVA saisis donnent le TTC. On enregistre une
		// ligne au taux effectif (TVA totale / HT) pour que le serveur retrouve
		// exactement ce TTC, et le détail par taux à côté pour l'affichage.
		const tauxEffectif = totalTVA > 0 ? (totalTVA / totalHT) * 100 : 0;
		const produits = [{ produit: famille, tva: tauxEffectif, montantHT: totalHT }];
		const tvaDetail = TAUX.filter((k) => num(tvaMontants[k]) > 0).map((k) => ({
			taux: parseFloat(k),
			montant: num(tvaMontants[k])
		}));
		const date = dateInputToMs(venteDate);
		busy = true;
		error = '';
		try {
			if (isEdit && venteId) {
				await updateVente({
					venteId: venteId as Id<'ventes'>,
					produits,
					tvaDetail,
					confortee,
					paiement,
					...(paiement === 'financement' ? { fiAccepte } : {}),
					...(vendeurId ? { vendeurId: vendeurId as Id<'users'> } : {}),
					...(date ? { date } : {})
				});
			} else {
				await addVente({
					contactId: contactId as Id<'contacts'>,
					produits,
					tvaDetail,
					confortee,
					paiement,
					...(paiement === 'financement' ? { fiAccepte } : {}),
					...(vendeurId ? { vendeurId: vendeurId as Id<'users'> } : {}),
					...(date ? { date } : {})
				});
			}
			famille = '';
			prixHT = '';
			tvaMontants = vide();
			close();
		} catch (e) {
			error = e instanceof Error ? e.message : "Erreur lors de l'enregistrement de la vente.";
		} finally {
			busy = false;
		}
	}
</script>

<Dialog bind:open>
	<DialogContent
		class="max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border-line bg-card sm:max-w-md"
	>
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2 text-[14px] font-semibold">
				<span
					class="grid size-8 place-items-center rounded-lg border border-line bg-card2 text-muted-foreground"
				>
					🛍️
				</span>
				{titre}
			</DialogTitle>
		</DialogHeader>

		<div class="space-y-3">
			<div class="space-y-1">
				<Label for="famille" class="text-[11px] text-muted-foreground">Famille de produit</Label>
				<Select type="single" value={famille} onValueChange={(v) => (famille = v as string)}>
					<SelectTrigger id="famille" class="w-full border-input bg-base">
						<span data-slot="select-value">{famille || 'Choisir une famille'}</span>
					</SelectTrigger>
					<SelectContent class="max-h-64 overflow-y-auto">
						{#each FAMILLES as f}
							<SelectItem value={f}>{f}</SelectItem>
						{/each}
					</SelectContent>
				</Select>
			</div>

			<div class="space-y-1">
				<Label for="prixHT" class="text-[11px] text-muted-foreground">Prix HT (€)</Label>
				<Input
					id="prixHT"
					type="number"
					min="0"
					step="0.01"
					inputmode="decimal"
					placeholder="0,00"
					bind:value={prixHT}
					class="border-input bg-base tabular-nums"
				/>
			</div>

			<!-- Une case par taux : on n'y met que les montants de TVA concernés. -->
			<div class="space-y-1">
				<Label class="text-[11px] text-muted-foreground">Montants de TVA (€)</Label>
				<div class="grid grid-cols-3 gap-2">
					{#each TAUX as taux}
						<div class="space-y-1">
							<p class="text-center text-[10.5px] font-medium text-muted-foreground">
								{TAUX_LABEL[taux]}
							</p>
							<Input
								id="tva{taux}"
								type="number"
								min="0"
								step="0.01"
								inputmode="decimal"
								placeholder="0,00"
								bind:value={tvaMontants[taux]}
								class="border-input bg-base px-2 text-center tabular-nums"
							/>
						</div>
					{/each}
				</div>
			</div>

			<!-- Paiement : comptant, ou financement avec suivi du dossier FI. -->
			<div class="space-y-1">
				<Label class="text-[11px] text-muted-foreground">Paiement</Label>
				<div class="grid grid-cols-2 gap-1 rounded-lg border border-input bg-base p-1">
					<button
						type="button"
						onclick={() => (paiement = 'comptant')}
						class="h-8 rounded-md text-[12px] font-semibold transition-colors {paiement ===
						'comptant'
							? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
							: 'text-muted-foreground hover:text-foreground'}"
					>
						Comptant
					</button>
					<button
						type="button"
						onclick={() => (paiement = 'financement')}
						class="h-8 rounded-md text-[12px] font-semibold transition-colors {paiement ===
						'financement'
							? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
							: 'text-muted-foreground hover:text-foreground'}"
					>
						Financement
					</button>
				</div>
			</div>

			{#if paiement === 'financement'}
				<div
					class="flex items-center justify-between gap-3 rounded-lg border border-line bg-card2/60 px-3 py-2"
				>
					<div class="min-w-0">
						<p class="text-[12px] font-semibold text-ink">FI accepté</p>
						<p class="text-[10.5px] text-muted-foreground">
							Le dossier de financement a été accepté.
						</p>
					</div>
					<button
						type="button"
						role="switch"
						aria-checked={fiAccepte}
						aria-label="Financement accepté"
						onclick={() => (fiAccepte = !fiAccepte)}
						class="relative h-6 w-11 shrink-0 rounded-full transition-colors {fiAccepte
							? 'bg-emerald-500'
							: 'bg-glass-3'}"
					>
						<span
							class="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform {fiAccepte
								? 'translate-x-5'
								: 'translate-x-0'}"
						></span>
					</button>
				</div>
			{/if}

			<div
				class="flex items-center justify-between gap-3 rounded-lg border border-line bg-card2/60 px-3 py-2"
			>
				<div class="min-w-0">
					<p class="text-[12px] font-semibold text-ink">Vente confortée</p>
					<p class="text-[10.5px] text-muted-foreground">
						Le client a confirmé la vente après réflexion.
					</p>
				</div>
				<button
					type="button"
					role="switch"
					aria-checked={confortee}
					aria-label="Vente confortée"
					onclick={() => (confortee = !confortee)}
					class="relative h-6 w-11 shrink-0 rounded-full transition-colors {confortee
						? 'bg-emerald-500'
						: 'bg-glass-3'}"
				>
					<span
						class="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform {confortee
							? 'translate-x-5'
							: 'translate-x-0'}"
					></span>
				</button>
			</div>

			<!-- Même hauteur de champ que les saisies, mais en lecture seule. -->
			<div class="space-y-1">
				<Label class="text-[11px] text-muted-foreground">Total TTC</Label>
				<div
					class="flex h-11 items-center justify-between gap-3 rounded-md border border-input bg-card px-3.5"
				>
					<span class="text-[11px] font-semibold tracking-wider text-brand uppercase">TTC</span>
					<span class="text-[15px] font-bold text-ink tabular-nums">{fmt(totalTTC)} €</span>
				</div>
			</div>

			{#if error}
				<p class="text-[12px] text-destructive">{error}</p>
			{/if}
		</div>

		<DialogFooter>
			<Button variant="ghost" onclick={close}>Annuler</Button>
			<Button onclick={save} disabled={busy || totalTTC <= 0}>
				{#if busy}
					<LoaderCircle class="size-4 animate-spin" />
				{/if}
				{isEdit ? 'Enregistrer' : 'Enregistrer la vente'}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
