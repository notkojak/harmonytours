<script lang="ts">
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table/index.js';
	import type { TeamMember } from '$lib/data/dashboard';
	import type { StatsPeriodValue } from '$lib/stats-period.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import { useQuery } from 'convex-svelte';
	import { api } from '../../../convex/_generated/api.js';
	import { authState } from '$lib/auth-state.svelte';

	let { members = [], period = 'mois' }: { members?: TeamMember[]; period?: StatsPeriodValue } =
		$props();

	// Photos des membres (nom complet → photo) pour les avatars du tableau.
	const membresPhotos = useQuery(api.evenements.listMembres, () =>
		authState.isAuthenticated ? {} : 'skip'
	);
	const photoByName = $derived.by(() => {
		const map = new Map<string, string>();
		for (const m of membresPhotos.data ?? []) {
			const key = `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim().toLowerCase();
			if (m.photo && key) map.set(key, m.photo);
		}
		return map;
	});
	const photoForMember = (firstName: string, lastName: string): string | undefined =>
		photoByName.get(`${firstName} ${lastName}`.trim().toLowerCase());

	const euro = new Intl.NumberFormat('fr-FR', {
		style: 'currency',
		currency: 'EUR',
		maximumFractionDigits: 0
	});

	// Compteurs pouvant être fractionnaires (0,5 quand 2 commerciaux sont liés).
	const count = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

	const totals = $derived(
		members.reduce(
			(acc, member) => ({
				objectiveCa: acc.objectiveCa + member.objectiveCa,
				objectiveRdv: acc.objectiveRdv + member.objectiveRdv,
				rdvTap: acc.rdvTap + member.rdvTap,
				rdvGms: acc.rdvGms + member.rdvGms,
				total: acc.total + member.total,
				rdvTraites: acc.rdvTraites + member.rdvTraites,
				ventes: acc.ventes + member.ventes,
				caPeriode: acc.caPeriode + member.caPeriode,
				caAttente: acc.caAttente + (member.caAttente ?? 0),
				caErreur: acc.caErreur + member.caErreur,
				caAnnulations: acc.caAnnulations + member.caAnnulations,
				caTotal: acc.caTotal + member.caTotal
			}),
			{
				objectiveCa: 0,
				objectiveRdv: 0,
				rdvTap: 0,
				rdvGms: 0,
				total: 0,
				rdvTraites: 0,
				ventes: 0,
				caPeriode: 0,
				caAttente: 0,
				caErreur: 0,
				caAnnulations: 0,
				caTotal: 0
			}
		)
	);
</script>

<!-- Mobile : prénom nom + CA total uniquement -->
<div class="flex flex-col gap-1.5 md:hidden">
	{#each members as member}
		<div
			class="flex items-center justify-between gap-3 rounded-lg border border-line/60 bg-card2/50 px-3 py-2"
		>
			<span class="flex min-w-0 items-center gap-2">
				<Avatar
					photo={photoForMember(member.firstName, member.lastName)}
					label={`${member.firstName[0]}${member.lastName[0]}`}
					class="size-7 bg-muted text-[10px] font-bold text-muted-foreground"
				/>
				<span class="truncate text-[13px] font-medium text-foreground">
					{member.firstName}
					{member.lastName}
				</span>
			</span>
			<span class="shrink-0 text-[13.5px] font-semibold text-foreground">
				{euro.format(member.caTotal)}
			</span>
		</div>
	{/each}
	<div
		class="flex items-center justify-between gap-3 rounded-lg border border-line bg-glass-1 px-3 py-2"
	>
		<span class="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
			>Total</span
		>
		<span class="text-[13.5px] font-bold text-foreground">{euro.format(totals.caTotal)}</span>
	</div>
</div>

<!-- Desktop / tablette : tableau complet -->
<div class="hidden overflow-x-auto rounded-xl border border-line md:block">
	<Table class="min-w-[1000px]">
		<TableHeader>
			<TableRow class="border-line bg-transparent hover:bg-transparent">
				<TableHead
					class="px-2.5 py-2 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase"
				>
					Commercial
				</TableHead>
				<TableHead
					class="px-2.5 py-2 text-right text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase"
				>
					Obj. CA HT
				</TableHead>
				<TableHead
					class="px-2.5 py-2 text-right text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase"
				>
					Obj. RDV
				</TableHead>
				<TableHead
					class="px-2.5 py-2 text-right text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase"
				>
					TAP
				</TableHead>
				<TableHead
					class="px-2.5 py-2 text-right text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase"
				>
					GMS
				</TableHead>
				<TableHead
					class="px-2.5 py-2 text-right text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase"
				>
					TOTAL
				</TableHead>
				<TableHead
					class="px-2.5 py-2 text-right text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase"
				>
					TRAITÉS
				</TableHead>
				<TableHead
					class="px-2.5 py-2 text-right text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase"
				>
					VENTES
				</TableHead>
				<TableHead
					class="px-2.5 py-2 text-right text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase"
				>
					CA HT
				</TableHead>
				<TableHead
					class="px-2.5 py-2 text-right text-[11.5px] font-semibold tracking-wide text-sky-400/70 uppercase"
				>
					EN ATTENTE
				</TableHead>
				<TableHead
					class="px-2.5 py-2 text-right text-[11.5px] font-semibold tracking-wide text-orange-400/70 uppercase"
				>
					ERREUR
				</TableHead>
				<TableHead
					class="px-2.5 py-2 text-right text-[11.5px] font-semibold tracking-wide text-red-400/70 uppercase"
				>
					ANNULÉES
				</TableHead>
				<TableHead
					class="px-2.5 py-2 text-right text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase"
				>
					TOTAL HT
				</TableHead>
			</TableRow>
		</TableHeader>
		<TableBody>
			{#each members as member}
				<TableRow class="border-line/60 hover:bg-glass-1">
					<TableCell class="px-2.5 py-1.5">
						<div class="flex items-center gap-2">
							<Avatar
								photo={photoForMember(member.firstName, member.lastName)}
								label={`${member.firstName[0]}${member.lastName[0]}`}
								class="size-7 bg-muted text-[10px] font-bold text-muted-foreground"
							/>
							<span class="text-[14px] font-medium whitespace-nowrap text-foreground">
								{member.firstName}
								{member.lastName}
							</span>
						</div>
					</TableCell>
					<TableCell
						class="px-2.5 py-1.5 text-right text-[13.5px] whitespace-nowrap text-foreground"
					>
						{euro.format(member.objectiveCa)}
					</TableCell>
					<TableCell
						class="px-2.5 py-1.5 text-right text-[13.5px] whitespace-nowrap text-foreground"
					>
						{member.objectiveRdv}
					</TableCell>
					<TableCell
						class="px-2.5 py-1.5 text-right text-[13.5px] whitespace-nowrap text-foreground"
					>
						{count(member.rdvTap)}
					</TableCell>
					<TableCell
						class="px-2.5 py-1.5 text-right text-[13.5px] whitespace-nowrap text-foreground"
					>
						{count(member.rdvGms)}
					</TableCell>
					<TableCell
						class="px-2.5 py-1.5 text-right text-[13.5px] font-semibold whitespace-nowrap text-foreground"
					>
						{count(member.total)}
					</TableCell>
					<TableCell
						class="px-2.5 py-1.5 text-right text-[13.5px] whitespace-nowrap text-foreground"
					>
						{count(member.rdvTraites)}
					</TableCell>
					<TableCell
						class="px-2.5 py-1.5 text-right text-[13.5px] whitespace-nowrap text-foreground"
					>
						{count(member.ventes)}
					</TableCell>
					<TableCell
						class="px-2.5 py-1.5 text-right text-[13.5px] whitespace-nowrap text-foreground"
					>
						{euro.format(member.caPeriode)}
					</TableCell>
					<TableCell
						class="px-2.5 py-1.5 text-right text-[13.5px] font-semibold whitespace-nowrap text-sky-400/90"
					>
						{euro.format(member.caAttente ?? 0)}
					</TableCell>
					<TableCell
						class="px-2.5 py-1.5 text-right text-[13.5px] font-semibold whitespace-nowrap text-orange-400/90"
					>
						{euro.format(member.caErreur)}
					</TableCell>
					<TableCell
						class="px-2.5 py-1.5 text-right text-[13.5px] font-semibold whitespace-nowrap text-red-400/90"
					>
						{euro.format(member.caAnnulations)}
					</TableCell>
					<TableCell
						class="px-2.5 py-1.5 text-right text-[13.5px] font-semibold whitespace-nowrap text-foreground"
					>
						{euro.format(member.caTotal)}
					</TableCell>
				</TableRow>
			{/each}
			{#if members.length === 0}
				<TableRow class="border-line/60 hover:bg-transparent">
					<TableCell colspan={13} class="px-4 py-8 text-center text-[13px] text-muted-foreground">
						Aucun membre pour le moment.
					</TableCell>
				</TableRow>
			{/if}
			<TableRow class="bg-glass-1 hover:bg-glass-1">
				<TableCell
					class="px-2.5 py-1.5 text-[13.5px] font-semibold tracking-wider text-muted-foreground uppercase"
				>
					Total
				</TableCell>
				<TableCell
					class="px-2.5 py-1.5 text-right text-[13.5px] font-bold whitespace-nowrap text-foreground"
				>
					{euro.format(totals.objectiveCa)}
				</TableCell>
				<TableCell
					class="px-2.5 py-1.5 text-right text-[13.5px] font-bold whitespace-nowrap text-foreground"
				>
					{totals.objectiveRdv}
				</TableCell>
				<TableCell
					class="px-2.5 py-1.5 text-right text-[13.5px] font-bold whitespace-nowrap text-foreground"
				>
					{count(totals.rdvTap)}
				</TableCell>
				<TableCell
					class="px-2.5 py-1.5 text-right text-[13.5px] font-bold whitespace-nowrap text-foreground"
				>
					{count(totals.rdvGms)}
				</TableCell>
				<TableCell
					class="px-2.5 py-1.5 text-right text-[13.5px] font-bold whitespace-nowrap text-foreground"
				>
					{count(totals.total)}
				</TableCell>
				<TableCell
					class="px-2.5 py-1.5 text-right text-[13.5px] font-bold whitespace-nowrap text-foreground"
				>
					{count(totals.rdvTraites)}
				</TableCell>
				<TableCell
					class="px-2.5 py-1.5 text-right text-[13.5px] font-bold whitespace-nowrap text-foreground"
				>
					{count(totals.ventes)}
				</TableCell>
				<TableCell
					class="px-2.5 py-1.5 text-right text-[13.5px] font-bold whitespace-nowrap text-foreground"
				>
					{euro.format(totals.caPeriode)}
				</TableCell>
				<TableCell
					class="px-2.5 py-1.5 text-right text-[13.5px] font-bold whitespace-nowrap text-sky-400"
				>
					{euro.format(totals.caAttente ?? 0)}
				</TableCell>
				<TableCell
					class="px-2.5 py-1.5 text-right text-[13.5px] font-bold whitespace-nowrap text-orange-400"
				>
					{euro.format(totals.caErreur)}
				</TableCell>
				<TableCell
					class="px-2.5 py-1.5 text-right text-[13.5px] font-bold whitespace-nowrap text-red-400"
				>
					{euro.format(totals.caAnnulations)}
				</TableCell>
				<TableCell
					class="px-2.5 py-1.5 text-right text-[13.5px] font-bold whitespace-nowrap text-foreground"
				>
					{euro.format(totals.caTotal)}
				</TableCell>
			</TableRow>
		</TableBody>
	</Table>
</div>
