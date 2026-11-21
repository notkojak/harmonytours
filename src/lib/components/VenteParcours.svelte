<script lang="ts">
	import { Check, X } from '@lucide/svelte';
	import { aujourdHuiIso, dateCourt } from '$lib/data/vente-suivi';

	type Props = {
		vente: {
			date: number;
			statut?: string | null;
			statutChangedAt?: number | null;
			confortee?: boolean | null;
			dateMetrage?: string | null;
			metrageConfirmeAt?: number | null;
			datePose?: string | null;
			poseConfirmeAt?: number | null;
		};
	};
	let { vente }: Props = $props();

	// Délai légal de rétractation d'une vente signée à domicile.
	const RETRACT_DAYS = 14;

	type State = 'done' | 'current' | 'pending' | 'late' | 'cancelled';
	type Step = { key: string; label: string; state: State; detail: string; title: string };

	function isoLocal(ms: number): string {
		const d = new Date(ms);
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
			d.getDate()
		).padStart(2, '0')}`;
	}

	const jour = aujourdHuiIso();
	const signature = $derived(isoLocal(vente.date));
	const finRetractation = $derived(isoLocal(vente.date + RETRACT_DAYS * 86_400_000));
	const joursRestants = $derived(
		Math.max(0, Math.round((Date.parse(finRetractation) - Date.parse(jour)) / 86_400_000))
	);

	const steps = $derived.by<Step[]>(() => {
		const annulee = vente.statut === 'annulée';

		const retractDone = jour > finRetractation;
		const confortee = vente.confortee === true;
		const metrageDone = !!vente.metrageConfirmeAt;
		const poseDone = !!vente.poseConfirmeAt;

		const metrageState: State = metrageDone
			? 'done'
			: vente.dateMetrage
				? vente.dateMetrage <= jour
					? 'late'
					: 'current'
				: 'pending';
		const poseState: State = poseDone
			? 'done'
			: vente.datePose
				? vente.datePose <= jour
					? 'late'
					: 'current'
				: 'pending';

		const list: Step[] = [
			{
				key: 'signature',
				label: 'Signature',
				state: 'done',
				detail: dateCourt(signature),
				title: `Vente signée le ${dateCourt(signature)}`
			},
			{
				key: 'confortation',
				label: 'Confortation',
				state: confortee ? 'done' : 'current',
				detail: confortee ? 'Oui' : 'En attente',
				title: confortee ? 'Vente confortée par le client' : 'Confortation client à recueillir'
			},
			{
				key: 'retractation',
				label: 'Rétractation',
				state: retractDone ? 'done' : confortee ? 'current' : 'pending',
				detail: retractDone ? dateCourt(finRetractation) : `J-${joursRestants}`,
				title: retractDone
					? `Délai de rétractation de ${RETRACT_DAYS} jours écoulé`
					: `Délai de rétractation : ${joursRestants} jour${joursRestants > 1 ? 's' : ''} restant${joursRestants > 1 ? 's' : ''}`
			},
			{
				key: 'metrage',
				label: 'Métrage',
				state: metrageState,
				detail: vente.dateMetrage ? dateCourt(vente.dateMetrage) : '—',
				title: metrageDone
					? `Métrage confirmé (${dateCourt(vente.dateMetrage)})`
					: vente.dateMetrage
						? metrageState === 'late'
							? `Métrage du ${dateCourt(vente.dateMetrage)} à confirmer`
							: `Métrage prévu le ${dateCourt(vente.dateMetrage)}`
						: 'Métrage non planifié'
			},
			{
				key: 'pose',
				label: 'Pose',
				state: poseState,
				detail: vente.datePose ? dateCourt(vente.datePose) : '—',
				title: poseDone
					? `Pose confirmée (${dateCourt(vente.datePose)})`
					: vente.datePose
						? poseState === 'late'
							? `Pose du ${dateCourt(vente.datePose)} à confirmer`
							: `Pose prévue le ${dateCourt(vente.datePose)}`
						: 'Pose non planifiée'
			}
		];

		// Annulation : le parcours s'arrête à la première étape non faite, qui
		// passe en rouge — les suivantes ne sont plus représentées comme actives.
		if (annulee) {
			const index = list.findIndex((s) => s.state !== 'done');
			const stop = index === -1 ? list.length - 1 : index;
			list[stop] = {
				...list[stop],
				state: 'cancelled',
				detail: vente.statutChangedAt ? dateCourt(isoLocal(vente.statutChangedAt)) : '—',
				title: `Vente annulée${vente.statutChangedAt ? ` le ${dateCourt(isoLocal(vente.statutChangedAt))}` : ''}`
			};
			for (let i = stop + 1; i < list.length; i++) {
				list[i] = { ...list[i], state: 'pending' };
			}
		}

		return list;
	});

	// Phrase sous les ronds : ce qu'il reste à faire, ou l'annulation.
	const resume = $derived.by(() => {
		if (vente.statut === 'annulée') {
			const when = vente.statutChangedAt ? ` le ${dateCourt(isoLocal(vente.statutChangedAt))}` : '';
			return `Annulée${when}`;
		}
		const next = steps.find((s) => s.state !== 'done');
		if (!next) return 'Parcours terminé';
		if (next.state === 'cancelled') return `Annulée`;
		if (next.key === 'retractation') {
			return `Rétractation · J-${joursRestants}`;
		}
		if (next.key === 'confortation') {
			return 'Confortation en attente';
		}
		if (next.key === 'metrage') {
			return next.state === 'late'
				? 'Métrage à confirmer'
				: vente.dateMetrage
					? `Métrage le ${dateCourt(vente.dateMetrage)}`
					: 'Métrage à planifier';
		}
		return next.state === 'late'
			? 'Pose à confirmer'
			: vente.datePose
				? `Pose le ${dateCourt(vente.datePose)}`
				: 'Pose à planifier';
	});

	const circleClass: Record<State, string> = {
		done: 'border-brand bg-brand text-white',
		current: 'border-brand bg-card2',
		pending: 'border-line-strong border-dashed bg-card2',
		late: 'border-amber-500/70 bg-amber-500/20',
		cancelled: 'border-red-500 bg-red-500/15 text-red-600 dark:text-red-400'
	};

	function connectorClass(state: State): string {
		return state === 'done' ? 'bg-brand' : 'bg-line';
	}
</script>

<div class="flex flex-col gap-1">
	<div class="flex items-center">
		{#each steps as step, i (step.key)}
			{#if i > 0}
				<span
					class={['h-0.5 w-2.5 shrink-0 rounded-full', connectorClass(steps[i - 1].state)].join(
						' '
					)}
				></span>
			{/if}
			<span
				class={[
					'grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors',
					circleClass[step.state]
				].join(' ')}
				title={step.title}
			>
				{#if step.state === 'done'}
					<Check class="size-2.5" strokeWidth={4} />
				{:else if step.state === 'cancelled'}
					<X class="size-2.5" strokeWidth={4} />
				{:else if step.state === 'current'}
					<span class="size-1.5 rounded-full bg-brand"></span>
				{:else if step.state === 'late'}
					<span class="size-1.5 rounded-full bg-amber-500"></span>
				{/if}
			</span>
		{/each}
	</div>
	<p
		class={[
			'max-w-[11rem] truncate text-[10px] leading-tight',
			vente.statut === 'annulée'
				? 'font-semibold text-red-600 dark:text-red-400'
				: steps.every((s) => s.state === 'done')
					? 'font-semibold text-brand'
					: 'text-muted-foreground'
		].join(' ')}
		title={steps.map((s) => `${s.label} · ${s.detail}`).join(' — ')}
	>
		{resume}
	</p>
</div>
