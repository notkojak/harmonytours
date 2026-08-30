<script lang="ts">
	import { AlertTriangle, LoaderCircle, X } from '@lucide/svelte';
	import { useMutation } from 'convex-svelte';
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
	import { Label } from '$lib/components/ui/label/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';

	const MANQUANTS = [
		'CNI',
		'RIB',
		'Attestation domicile',
		'Fiches de paye',
		'Relevé bancaire',
		"Avis d'imposition",
		'Bon de commande',
		'Attestations Harmony'
	];

	let {
		open = $bindable(false),
		vente
	}: {
		open?: boolean;
		vente?: {
			_id: string;
			vendeurName?: string;
			vendeurDisplay?: string;
			totalTTC?: number;
		} | null;
	} = $props();

	const setErreur = useMutation(api.ventes.setErreur);

	let selected = $state<string[]>([]);
	let note = $state('');
	let busy = $state(false);
	let error = $state('');

	$effect(() => {
		if (open) {
			selected = [];
			note = '';
			error = '';
		}
	});

	function toggleManquant(doc: string) {
		selected = selected.includes(doc) ? selected.filter((d) => d !== doc) : [...selected, doc];
	}

	async function save() {
		if (!vente) return;
		if (selected.length === 0) {
			error = 'Sélectionne au moins un document manquant.';
			return;
		}
		busy = true;
		error = '';
		try {
			await setErreur({
				venteId: vente._id as Id<'ventes'>,
				manquants: selected,
				note: note.trim()
			});
			open = false;
		} catch (e) {
			error = e instanceof Error ? e.message : "Erreur lors de l'enregistrement.";
		} finally {
			busy = false;
		}
	}
</script>

<Dialog bind:open>
	<DialogContent class="sm:max-w-xl">
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2">
				<AlertTriangle class="size-4 text-orange-400" />
				Mettre la vente en erreur
			</DialogTitle>
		</DialogHeader>

		<div class="space-y-4">
			{#if vente}
				<p class="text-[12.5px] text-muted-foreground">
					Vente de
					<span class="font-medium text-foreground">
						{vente.vendeurDisplay ?? vente.vendeurName ?? '—'}
					</span>
					—
					<span class="font-semibold text-foreground">
						{(vente.totalTTC ?? 0).toLocaleString('fr-FR', {
							minimumFractionDigits: 2,
							maximumFractionDigits: 2
						})} € TTC
					</span>
				</p>
			{/if}

			<div class="space-y-1.5">
				<Label>Documents manquants</Label>
				<div class="flex flex-wrap gap-1.5">
					{#each MANQUANTS as doc}
						<button
							type="button"
							onclick={() => toggleManquant(doc)}
							class={[
								'rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors',
								selected.includes(doc)
									? 'border-orange-500/60 bg-orange-500/15 text-orange-400'
									: 'border-line bg-base text-muted-foreground hover:bg-glass-2 hover:text-foreground'
							].join(' ')}
						>
							{doc}
						</button>
					{/each}
				</div>
			</div>

			<div class="space-y-1.5">
				<Label>Note (argumente l'erreur)</Label>
				<Textarea
					bind:value={note}
					rows={6}
					placeholder="Explique pourquoi le dossier est bloqué, ce qui manque, ce qui a été demandé…"
					class="border-line bg-base"
				/>
			</div>

			{#if error}
				<p class="text-[12px] text-destructive">{error}</p>
			{/if}
		</div>

		<DialogFooter class="gap-2">
			<Button variant="outline" onclick={() => (open = false)} disabled={busy}>
				<X class="size-4" />
				Annuler
			</Button>
			<Button onclick={save} disabled={busy} class="bg-orange-600 hover:bg-orange-500">
				{#if busy}
					<LoaderCircle class="size-4 animate-spin" />
				{/if}
				Passer en erreur
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
