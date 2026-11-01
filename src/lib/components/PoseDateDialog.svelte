<script lang="ts">
	import { LoaderCircle, Wrench } from '@lucide/svelte';
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
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select/index.js';

	export type VentePoseOption = {
		_id: string;
		contactName: string;
		date: number;
		statut?: string | null;
	};

	let {
		open = $bindable(false),
		initialDate = '',
		ventes = []
	}: {
		open?: boolean;
		initialDate?: string;
		ventes?: VentePoseOption[];
	} = $props();

	const addDatePose = useMutation(api.ventes.addDatePose);

	const todayISO = () => {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	};

	let venteId = $state('');
	let date = $state('');
	let time = $state('08:00');
	let note = $state('');
	let busy = $state(false);
	let error = $state('');

	const ventesDispo = $derived(ventes.filter((v) => v.statut !== 'annulée'));

	const dateVente = (ts: number) =>
		new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

	$effect(() => {
		if (!open) return;
		date = initialDate || todayISO();
		time = '08:00';
		note = '';
		error = '';
		if (!ventesDispo.some((v) => v._id === venteId)) {
			venteId = ventesDispo[0]?._id ?? '';
		}
	});

	async function enregistrer() {
		if (busy) return;
		if (!venteId) {
			error = 'Choisis la vente concernée.';
			return;
		}
		if (!date) {
			error = 'Choisis la date de pose.';
			return;
		}
		busy = true;
		error = '';
		try {
			await addDatePose({
				venteId: venteId as Id<'ventes'>,
				date,
				time: time || undefined,
				note: note.trim() || undefined
			});
			open = false;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Ajout impossible.';
		} finally {
			busy = false;
		}
	}
</script>

<Dialog bind:open>
	<DialogContent class="max-w-md rounded-xl border-line bg-card">
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2 text-[14px] font-semibold">
				<span
					class="grid size-8 place-items-center rounded-lg border border-line bg-card2 text-muted-foreground"
				>
					<Wrench class="size-4" strokeWidth={1.7} />
				</span>
				Date de pose
			</DialogTitle>
		</DialogHeader>

		<div class="space-y-3">
			<div class="space-y-1.5">
				<Label>Vente concernée</Label>
				<Select type="single" bind:value={venteId}>
					<SelectTrigger class="w-full border-input bg-base">
						<span data-slot="select-value">
							{ventesDispo.find((v) => v._id === venteId)?.contactName ?? 'Choisir une vente'}
						</span>
					</SelectTrigger>
					<SelectContent>
						{#each ventesDispo as v (v._id)}
							<SelectItem value={v._id}>
								{v.contactName} — {dateVente(v.date)}
							</SelectItem>
						{/each}
					</SelectContent>
				</Select>
				{#if ventesDispo.length === 0}
					<p class="text-[11.5px] text-muted-foreground">
						Aucune vente disponible : ajoute d'abord une vente sur une fiche client.
					</p>
				{/if}
			</div>

			<div class="flex gap-3">
				<div class="flex-1 space-y-1.5">
					<Label for="poseDate">Date</Label>
					<Input id="poseDate" type="date" bind:value={date} class="border-input bg-base" />
				</div>
				<div class="w-28 space-y-1.5">
					<Label for="poseTime">Heure</Label>
					<Input id="poseTime" type="time" bind:value={time} class="border-input bg-base" />
				</div>
			</div>

			<div class="space-y-1.5">
				<Label for="poseNote">Précision (facultatif)</Label>
				<Input
					id="poseNote"
					placeholder="Ex : pose portail, 2e intervention…"
					bind:value={note}
					class="border-input bg-base"
				/>
			</div>

			{#if error}
				<p class="text-[12px] text-destructive">{error}</p>
			{/if}
		</div>

		<DialogFooter class="gap-2">
			<Button variant="ghost" onclick={() => (open = false)} disabled={busy}>Annuler</Button>
			<Button onclick={enregistrer} disabled={busy || ventesDispo.length === 0}>
				{#if busy}
					<LoaderCircle class="size-4 animate-spin" />
				{/if}
				Ajouter la date
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
