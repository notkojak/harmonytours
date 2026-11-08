<script lang="ts">
	import { CalendarDays, ChevronLeft, ChevronRight } from '@lucide/svelte';
	import { CalendarDate, type DateValue } from '@internationalized/date';
	import { Calendar } from '$lib/components/ui/calendar/index.js';
	import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover/index.js';
	import { statsPeriod, type StatsPeriodValue } from '$lib/stats-period.svelte';

	const periods: { value: StatsPeriodValue; label: string }[] = [
		{ value: 'mois', label: 'Mois' },
		{ value: 'semaine', label: 'Semaine' },
		{ value: 'jour', label: 'Jour' }
	];

	// Jour sélectionné : il suit la période (flèches comprises), le calendrier
	// affiche donc toujours la bonne date.
	const selected = $derived.by(() => {
		const [year, month, day] = statsPeriod.date.split('-').map(Number);
		return new CalendarDate(year, month, day);
	});

	function handleDateChange(value: DateValue | DateValue[] | undefined) {
		const date = Array.isArray(value) ? value[0] : value;
		if (!date) return;
		statsPeriod.date = date.toString();
	}

	const isoDate = (d: Date) =>
		`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

	// Mois : on garde le jour du mois quand il existe (le 31 devient le 28/30 en
	// février). Semaine : on avance ou recule de sept jours.
	function shift(delta: number) {
		const [year, month, day] = statsPeriod.date.split('-').map(Number);
		if (statsPeriod.period === 'mois') {
			const cible = new Date(year, month - 1 + delta, 1);
			const dernierJour = new Date(cible.getFullYear(), cible.getMonth() + 1, 0).getDate();
			cible.setDate(Math.min(day, dernierJour));
			statsPeriod.date = isoDate(cible);
			return;
		}
		const d = new Date(year, month - 1, day);
		d.setDate(d.getDate() + delta * 7);
		statsPeriod.date = isoDate(d);
	}

	const formattedDate = $derived(
		new Date(`${statsPeriod.date}T00:00:00`).toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		})
	);

	const moisLabel = $derived(
		new Date(`${statsPeriod.date}T00:00:00`).toLocaleDateString('fr-FR', {
			month: 'long',
			year: 'numeric'
		})
	);

	// « 3 – 9 nov. » : la semaine du lundi au dimanche qui contient la date.
	const semaineLabel = $derived.by(() => {
		const d = new Date(`${statsPeriod.date}T00:00:00`);
		const depuisLundi = (d.getDay() + 6) % 7;
		const debut = new Date(d);
		debut.setDate(d.getDate() - depuisLundi);
		const fin = new Date(debut);
		fin.setDate(debut.getDate() + 6);
		const fmt = (x: Date) => x.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
		return `${fmt(debut)} – ${fmt(fin)}`;
	});

	const periodeLabel = $derived(statsPeriod.period === 'mois' ? moisLabel : semaineLabel);
	const fleche =
		'grid h-full w-9 place-items-center text-white/45 transition-colors hover:bg-white/10 hover:text-white';
</script>

<div class="flex items-center gap-2">
	<div class="inline-grid h-10 grid-cols-3 items-stretch gap-1 rounded-full bg-white/5 p-1">
		{#each periods as period}
			<button
				type="button"
				class={[
					'flex items-center justify-center rounded-full px-3.5 text-[12px] font-medium transition-all duration-150',
					statsPeriod.period === period.value
						? 'bg-white text-black'
						: 'text-white/50 hover:bg-white/10 hover:text-white'
				].join(' ')}
				onclick={() => (statsPeriod.period = period.value)}
			>
				{period.label}
			</button>
		{/each}
	</div>

	{#if statsPeriod.period === 'jour'}
		<Popover>
			<PopoverTrigger
				class="flex h-10 items-center gap-2 rounded-full bg-white/5 px-4 text-[12.5px] font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white"
			>
				<CalendarDays class="size-3.5" strokeWidth={1.7} />
				{formattedDate}
			</PopoverTrigger>
			<PopoverContent class="w-auto rounded-xl border-line bg-card p-0" align="end">
				<Calendar
					locale="fr-FR"
					type="single"
					value={selected}
					onValueChange={(value: DateValue | undefined) => handleDateChange(value)}
				/>
			</PopoverContent>
		</Popover>
	{:else}
		<div class="flex h-10 items-center rounded-full bg-white/5">
			<button
				type="button"
				class={['rounded-l-full', fleche].join(' ')}
				onclick={() => shift(-1)}
				aria-label={statsPeriod.period === 'mois' ? 'Mois précédent' : 'Semaine précédente'}
				title={statsPeriod.period === 'mois' ? 'Mois précédent' : 'Semaine précédente'}
			>
				<ChevronLeft class="size-4" strokeWidth={1.8} />
			</button>
			<span
				class="min-w-[8.5rem] px-1 text-center text-[12.5px] font-medium whitespace-nowrap text-white/80 capitalize"
			>
				{periodeLabel}
			</span>
			<button
				type="button"
				class={['rounded-r-full', fleche].join(' ')}
				onclick={() => shift(1)}
				aria-label={statsPeriod.period === 'mois' ? 'Mois suivant' : 'Semaine suivante'}
				title={statsPeriod.period === 'mois' ? 'Mois suivant' : 'Semaine suivante'}
			>
				<ChevronRight class="size-4" strokeWidth={1.8} />
			</button>
		</div>
	{/if}
</div>
