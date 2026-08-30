<script lang="ts">
	import { CalendarDays } from '@lucide/svelte';
	import { CalendarDate, type DateValue } from '@internationalized/date';
	import { Calendar } from '$lib/components/ui/calendar/index.js';
	import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover/index.js';
	import { statsPeriod, type StatsPeriodValue } from '$lib/stats-period.svelte';

	const periods: { value: StatsPeriodValue; label: string }[] = [
		{ value: 'mois', label: 'Mois' },
		{ value: 'semaine', label: 'Semaine' },
		{ value: 'jour', label: 'Jour' }
	];

	const [year, month, day] = statsPeriod.date.split('-').map(Number);
	let selected = $state(new CalendarDate(year, month, day));

	function handleDateChange(value: DateValue | DateValue[] | undefined) {
		const date = Array.isArray(value) ? value[0] : value;
		if (!date) return;
		selected = date as CalendarDate;
		statsPeriod.date = date.toString();
	}

	const formattedDate = $derived(
		new Date(`${statsPeriod.date}T00:00:00`).toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		})
	);
</script>

<div class="flex items-center gap-2">
	<div class="inline-grid grid-cols-3 gap-1 rounded-xl border border-line bg-card2/60 p-1">
		{#each periods as period}
			<button
				type="button"
				class={[
					'flex items-center justify-center rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all duration-150',
					statsPeriod.period === period.value
						? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
						: 'text-muted-foreground hover:bg-primary/10 hover:text-violet-200 light:hover:text-violet-600'
				].join(' ')}
				onclick={() => (statsPeriod.period = period.value)}
			>
				{period.label}
			</button>
		{/each}
	</div>

	<Popover>
		<PopoverTrigger
			class="flex items-center gap-2 rounded-xl border border-line bg-card px-4 py-2.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-card2 hover:text-foreground"
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
</div>
