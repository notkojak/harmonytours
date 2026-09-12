<script lang="ts">
	import { ChevronDown, Sparkles } from '@lucide/svelte';
	import { Input } from '$lib/components/ui/input/index.js';
	import { FAMILLES } from '$lib/data/catalogue';
	import {
		achatOptions,
		ageOptions,
		chauffageOptions,
		concurrenceOptions,
		foyerOptions,
		habiteOptions,
		initialQualification,
		pourQuandOptions,
		qualifAnswered,
		soncasOptions,
		type QualifAnswers
	} from '$lib/data/qualification';

	let { answers = $bindable(initialQualification()) }: { answers?: QualifAnswers } = $props();

	let qualifOpen = $state(true);

	function chipClass(active: boolean): string {
		return [
			'rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-all',
			active
				? 'border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/25'
				: 'border-line bg-card2 text-muted-foreground hover:border-primary/40 hover:text-foreground'
		].join(' ');
	}

	function toggleClass(active: boolean): string {
		return [
			'flex items-center justify-center gap-1 rounded-lg px-3 py-1 text-[12px] font-medium transition-all',
			active
				? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
				: 'text-muted-foreground hover:bg-primary/10 hover:text-foreground'
		].join(' ');
	}
</script>

{#snippet qHeader(n: number, text: string)}
	<p class="mb-1.5 text-[12px] font-medium text-foreground">
		<span
			class="mr-1.5 inline-grid size-4 place-items-center rounded-md bg-muted text-[9.5px] font-bold text-muted-foreground"
		>
			{n}
		</span>
		{text}
	</p>
{/snippet}

{#snippet chipGroup(options: string[], selected: string, onPick: (v: string) => void)}
	<div class="flex flex-wrap gap-1.5">
		{#each options as opt}
			<button type="button" onclick={() => onPick(opt)} class={chipClass(selected === opt)}>
				{opt}
			</button>
		{/each}
	</div>
{/snippet}

{#snippet chipGroupMulti(
	options: { lettre: string; label: string }[],
	selected: string[],
	onPick: (label: string) => void
)}
	<div class="flex flex-wrap gap-1.5">
		{#each options as opt}
			<button
				type="button"
				onclick={() => onPick(opt.label)}
				class={chipClass(selected.includes(opt.label))}
			>
				{opt.lettre} · {opt.label}
			</button>
		{/each}
	</div>
{/snippet}

{#snippet toggleRow(value: '' | 'oui' | 'non', set: (v: '' | 'oui' | 'non') => void)}
	<div
		class="relative inline-grid grid-cols-2 gap-1 rounded-xl border border-line bg-card2/60 p-0.5"
	>
		<button
			type="button"
			onclick={() => set(value === 'oui' ? '' : 'oui')}
			class={toggleClass(value === 'oui')}
		>
			👍 Oui
		</button>
		<button
			type="button"
			onclick={() => set(value === 'non' ? '' : 'non')}
			class={toggleClass(value === 'non')}
		>
			👎 Non
		</button>
	</div>
{/snippet}

<div class="rounded-xl border border-line bg-card2/40">
	<button
		type="button"
		onclick={() => (qualifOpen = !qualifOpen)}
		class="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-card2/70"
	>
		<span class="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
			<Sparkles class="size-3.5" strokeWidth={1.7} />
		</span>
		<span class="text-[13px] font-semibold">Questions découverte</span>
		<span class="rounded-full bg-primary/15 px-2 py-0.5 text-[10.5px] font-semibold text-primary">
			{qualifAnswered(answers)}/12
		</span>
		<ChevronDown
			class={[
				'ml-auto size-4 text-muted-foreground transition-transform',
				qualifOpen ? '' : '-rotate-90'
			].join(' ')}
		/>
	</button>

	{#if qualifOpen}
		<div class="space-y-3.5 border-t border-line px-3 py-3.5">
			<div>
				{@render qHeader(1, 'Nombre de personnes dans le foyer ?')}
				{@render chipGroup(
					foyerOptions,
					answers.foyer,
					(v) => (answers.foyer = answers.foyer === v ? '' : v)
				)}
			</div>

			<div>
				{@render qHeader(2, 'Depuis combien de temps habitent-ils ici ?')}
				{@render chipGroup(
					habiteOptions,
					answers.habite,
					(v) => (answers.habite = answers.habite === v ? '' : v)
				)}
			</div>

			<div>
				{@render qHeader(3, 'Se plaisent-ils bien chez eux ?')}
				{@render toggleRow(answers.plait, (v) => (answers.plait = v))}
			</div>

			<div>
				{@render qHeader(4, 'Dernier investissement / gros achat ?')}
				{@render chipGroup(
					achatOptions,
					answers.achat,
					(v) => (answers.achat = answers.achat === v ? '' : v)
				)}
				{#if answers.achat === 'Rénovation'}
					<Input
						bind:value={answers.achatDetail}
						placeholder="Quel type de rénovation ?"
						class="mt-1.5 h-8 w-64 border-line bg-base text-[12px]"
					/>
				{:else if answers.achat === 'Autre…'}
					<Input
						bind:value={answers.achatDetail}
						placeholder="Précisez…"
						class="mt-1.5 h-8 w-56 border-line bg-base text-[12px]"
					/>
				{/if}
			</div>

			<div>
				{@render qHeader(5, 'Métier ?')}
				<div class="grid max-w-md grid-cols-1 gap-2 sm:grid-cols-2">
					<Input
						bind:value={answers.metierMme}
						placeholder="Métier madame"
						class="h-8 border-line bg-base text-[12px]"
					/>
					<Input
						bind:value={answers.metierM}
						placeholder="Métier monsieur"
						class="h-8 border-line bg-base text-[12px]"
					/>
				</div>
			</div>

			<div>
				{@render qHeader(6, 'Imposable ou pas ?')}
				{@render toggleRow(answers.imposable, (v) => (answers.imposable = v))}
			</div>

			<div>
				{@render qHeader(7, 'Mode de chauffage et coût ?')}
				{@render chipGroup(
					chauffageOptions,
					answers.chauffage,
					(v) => (answers.chauffage = answers.chauffage === v ? '' : v)
				)}
				{#if answers.chauffage}
					<div class="mt-1.5 flex items-center gap-1.5">
						<Input
							bind:value={answers.chauffageCout}
							inputmode="numeric"
							placeholder="Coût mensuel"
							class="h-8 w-40 border-line bg-base text-[12px]"
						/>
						<span class="text-[11.5px] text-muted-foreground">€ / mois</span>
					</div>
				{/if}
			</div>

			<div>
				{@render qHeader(8, 'Connaissez-vous le produit ? Déjà renseignés ?')}
				{@render toggleRow(answers.connait, (v) => (answers.connait = v))}
			</div>

			{#if answers.connait === 'oui'}
				<div class="rounded-lg border border-primary/25 bg-primary/5 px-2.5 py-2">
					{@render qHeader(9, 'Fourchette tarifaire de la concurrence ?')}
					{@render chipGroup(
						concurrenceOptions,
						answers.concurrence,
						(v) => (answers.concurrence = answers.concurrence === v ? '' : v)
					)}
				</div>
			{/if}

			<div>
				{@render qHeader(10, 'Âge ?')}
				{@render chipGroup(
					ageOptions,
					answers.age,
					(v) => (answers.age = answers.age === v ? '' : v)
				)}
			</div>

			<div>
				{@render qHeader(11, 'Que veulent-ils changer ?')}
				{@render chipGroup(
					FAMILLES,
					answers.changer,
					(v) => (answers.changer = answers.changer === v ? '' : v)
				)}
				{#if answers.changer}
					<div class="mt-1.5">
						<p class="mb-1 text-[11.5px] font-medium text-muted-foreground">Pour quand ?</p>
						{@render chipGroup(
							pourQuandOptions,
							answers.pourQuand,
							(v) => (answers.pourQuand = answers.pourQuand === v ? '' : v)
						)}
					</div>
				{/if}
			</div>

			<div class="rounded-lg border border-line bg-card2/60 px-2.5 py-2">
				{@render qHeader(12, "SONCAS — leviers d'achat ?")}
				{@render chipGroupMulti(
					soncasOptions,
					answers.soncas,
					(label) =>
						(answers.soncas = answers.soncas.includes(label)
							? answers.soncas.filter((s) => s !== label)
							: [...answers.soncas, label])
				)}
			</div>
		</div>
	{/if}
</div>
