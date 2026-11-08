<script lang="ts">
	import { CalendarPlus, LoaderCircle } from '@lucide/svelte';
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

	let {
		open = $bindable(false),
		contactId,
		commercial = '',
		onCreated
	}: {
		open?: boolean;
		contactId: string;
		commercial?: string;
		onCreated?: (followUp: unknown) => void;
	} = $props();

	const schedule = useMutation(api.contacts.scheduleConfortation);

	const todayISO = () => {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	};

	let date = $state('');
	let time = $state('10:00');
	let commercialName = $state('');
	let busy = $state(false);
	let error = $state('');

	$effect(() => {
		if (!open) return;
		date = todayISO();
		time = '10:00';
		commercialName = commercial;
		error = '';
	});

	async function enregistrer() {
		if (busy) return;
		if (!date) {
			error = 'Choisis la date du rendez-vous.';
			return;
		}
		busy = true;
		error = '';
		try {
			const followUp = await schedule({
				contactId: contactId as Id<'contacts'>,
				date,
				time: time || undefined,
				commercial: commercialName.trim() || undefined
			});
			onCreated?.(followUp);
			open = false;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Création impossible.';
		} finally {
			busy = false;
		}
	}
</script>

<Dialog bind:open>
	<DialogContent class="max-w-md rounded-2xl border-0 bg-card shadow-none">
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2 text-[14px] font-semibold">
				<span class="grid size-8 place-items-center rounded-xl bg-card2 text-muted-foreground">
					<CalendarPlus class="size-4" strokeWidth={1.7} />
				</span>
				Rendez-vous de confortation
			</DialogTitle>
		</DialogHeader>

		<div class="space-y-3">
			<p class="text-[12px] leading-snug text-muted-foreground">
				Rendez-vous de suivi après la vente : il apparaît dans l'agenda mais ne compte pas comme un
				RDV dans les statistiques.
			</p>

			<div class="flex gap-3">
				<div class="flex-1 space-y-1.5">
					<Label for="confortationDate">Date</Label>
					<Input
						id="confortationDate"
						type="date"
						bind:value={date}
						class="border-0 bg-card2 shadow-none"
					/>
				</div>
				<div class="w-28 space-y-1.5">
					<Label for="confortationTime">Heure</Label>
					<Input
						id="confortationTime"
						type="time"
						bind:value={time}
						class="border-0 bg-card2 shadow-none"
					/>
				</div>
			</div>

			<div class="space-y-1.5">
				<Label for="confortationCommercial">Commercial (facultatif)</Label>
				<Input
					id="confortationCommercial"
					placeholder="Nom du commercial"
					bind:value={commercialName}
					class="border-0 bg-card2 shadow-none"
				/>
			</div>

			{#if error}
				<p class="text-[12px] text-destructive">{error}</p>
			{/if}
		</div>

		<DialogFooter class="gap-2">
			<Button variant="ghost" onclick={() => (open = false)} disabled={busy}>Annuler</Button>
			<Button onclick={enregistrer} disabled={busy}>
				{#if busy}
					<LoaderCircle class="size-4 animate-spin" />
				{/if}
				Créer le rendez-vous
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
