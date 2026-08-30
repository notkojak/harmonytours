<script lang="ts">
	import { CalendarDays, LoaderCircle } from '@lucide/svelte';
	import { CalendarDate, type DateValue } from '@internationalized/date';
	import { useMutation, useQuery } from 'convex-svelte';
	import { api } from '../../convex/_generated/api.js';
	import type { Id } from '../../convex/_generated/dataModel.js';
	import { authState } from '$lib/auth-state.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Calendar } from '$lib/components/ui/calendar/index.js';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover/index.js';

	// `initialMonth` = « YYYY-MM » du mois affiché dans les statistiques.
	let { open = $bindable(false), initialMonth = '' }: { open?: boolean; initialMonth?: string } =
		$props();

	const now = new Date();
	const pad = (n: number) => String(n).padStart(2, '0');
	const defaultMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;

	// Date du calendrier (1er jour du mois sélectionné) et libellé affiché.
	const pickerDate = $derived.by(() => {
		const [y, m] = (month || defaultMonth).split('-').map(Number);
		return new CalendarDate(y || now.getFullYear(), m || now.getMonth() + 1, 1);
	});
	const monthLabel = $derived.by(() => {
		if (!month) return defaultMonth;
		const [y, m] = month.split('-').map(Number);
		return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', {
			month: 'long',
			year: 'numeric'
		});
	});

	let month = $state('');
	let rows = $state<{ _id: Id<'users'>; name: string; ca: string; rdv: string }[]>([]);
	let syncedMonth: string | null = $state(null);
	let busy = $state(false);
	let error = $state('');

	// À l'ouverture, initialise le mois (valeur transmise ou mois courant).
	$effect(() => {
		if (open && !month) {
			month = initialMonth || defaultMonth;
		}
	});

	const targets = useQuery(api.objectifs.listTargets, () =>
		authState.isAuthenticated ? {} : 'skip'
	);
	const objectifs = useQuery(api.objectifs.listByMonth, () =>
		authState.isAuthenticated ? { mois: month } : 'skip'
	);
	const setObjective = useMutation(api.objectifs.set);

	// Construit les lignes quand le dialogue s'ouvre ou que le mois change, sans
	// écraser les saisies déjà présentes pour un mois déjà chargé.
	$effect(() => {
		if (!open || syncedMonth === month) return;
		const t = targets.data;
		if (!t || targets.isLoading || objectifs.isLoading) return;
		const oByUser = new Map((objectifs.data ?? []).map((o) => [o.userId, o]));
		rows = t.map((u) => {
			const ex = oByUser.get(u._id);
			return {
				_id: u._id,
				name: `${u.firstName} ${u.lastName}`.trim() || '—',
				ca: ex ? String(ex.ca) : '',
				rdv: ex ? String(ex.rdv) : ''
			};
		});
		syncedMonth = month;
	});

	async function save() {
		if (busy) return;
		busy = true;
		error = '';
		try {
			for (const r of rows) {
				await setObjective({
					userId: r._id,
					mois: month,
					ca: Number(r.ca) || 0,
					rdv: Number(r.rdv) || 0
				});
			}
			open = false;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Erreur lors de l’enregistrement.';
		} finally {
			busy = false;
		}
	}
</script>

<Dialog bind:open>
	<DialogContent class="max-w-lg border-line bg-card p-0">
		<DialogHeader class="border-b border-line px-5 pt-5 pb-4">
			<DialogTitle class="text-[15px] font-semibold">Objectifs mensuels</DialogTitle>
			<DialogDescription class="text-[12px] text-muted-foreground">
				Fixer les objectifs de RDV et de CA (HT) par employé pour le mois choisi.
			</DialogDescription>
		</DialogHeader>

		<div class="px-5 pt-4">
			<Label class="mb-1.5 block text-[12px] font-medium text-foreground">Mois</Label>
			<div class="flex items-center gap-2">
				<Popover>
					<PopoverTrigger
						class="flex h-8 items-center gap-2 rounded-full border border-line bg-card px-3 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-card2 hover:text-foreground"
					>
						<CalendarDays class="size-3.5" strokeWidth={1.7} />
						{monthLabel}
					</PopoverTrigger>
					<PopoverContent class="w-auto rounded-xl border-line bg-card p-0" align="start">
						<Calendar
							locale="fr-FR"
							type="single"
							value={pickerDate}
							onValueChange={(value: DateValue | DateValue[] | undefined) => {
								const d = Array.isArray(value) ? value[0] : value;
								if (d) month = d.toString().slice(0, 7);
							}}
						/>
					</PopoverContent>
				</Popover>
				{#if objectifs.isLoading}
					<span class="flex items-center gap-1.5 text-[12px] text-muted-foreground">
						<LoaderCircle class="size-3.5 animate-spin" /> Chargement…
					</span>
				{/if}
			</div>
		</div>

		<div class="mt-3 max-h-[46vh] overflow-y-auto px-5">
			{#if rows.length === 0 && !targets.isLoading}
				<p class="py-6 text-center text-[13px] text-muted-foreground">
					Aucun employé dans votre agence.
				</p>
			{:else}
				<div class="divide-y divide-line/60">
					{#each rows as row (row._id)}
						<div class="flex items-center gap-3 py-2.5">
							<div class="min-w-0 flex-1">
								<p class="truncate text-[13px] font-medium text-foreground">{row.name}</p>
							</div>
							<label class="flex items-center gap-1.5 text-[12px] text-muted-foreground">
								<span class="w-9">RDV</span>
								<Input
									type="number"
									min="0"
									bind:value={row.rdv}
									class="h-8 w-20 border-line bg-base text-right"
								/>
							</label>
							<label class="flex items-center gap-1.5 text-[12px] text-muted-foreground">
								<span class="w-6">CA</span>
								<Input
									type="number"
									min="0"
									step="100"
									bind:value={row.ca}
									class="h-8 w-24 border-line bg-base text-right"
								/>
								<span class="text-[12px] text-muted-foreground">€</span>
							</label>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		{#if error}
			<p class="px-5 text-[12px] text-destructive">{error}</p>
		{/if}

		<DialogFooter class="px-5 pb-5">
			<Button variant="ghost" size="sm" onclick={() => (open = false)}>Annuler</Button>
			<Button size="sm" onclick={save} disabled={busy}>
				{#if busy}
					<LoaderCircle class="size-3.5 animate-spin" />
				{/if}
				Enregistrer
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>