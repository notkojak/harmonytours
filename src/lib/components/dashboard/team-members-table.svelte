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

	// Superviseurs de zone (directeur de zone, animateur de zone) : pas
	// d'objectifs (cases vides) et exclus du total. Ils restent affichés sous
	// une ligne séparatrice « AUTRES » car ils peuvent avoir du CA.
	const isZoneManagerRow = (m: TeamMember): boolean =>
		m.role === 'directeur de zone' || m.role === 'animateur de zone' || m.role === 'animateur';

	// Classement des commerciaux par performance : TOTAL HT, puis CA HT (de la
	// période), puis VENTES, puis TOTAL de RDV — descendant, puis nom.
	const compareMembers = (a: TeamMember, b: TeamMember): number => {
		for (const key of ['caTotal', 'caPeriode', 'ventes', 'total'] as const) {
			if (a[key] !== b[key]) return b[key] - a[key];
		}
		return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, 'fr');
	};
	const ordered = $derived.by(() => {
		const commerciaux = members.filter((m) => !isZoneManagerRow(m)).sort(compareMembers);
		const autres = members.filter((m) => isZoneManagerRow(m)).sort(compareMembers);
		return { commerciaux, autres };
	});

	// Totaux : uniquement les commerciaux (les superviseurs n'y participent pas,
	// ils sont totalisés à part dans la ligne « Total autres »).
	const totals = $derived(
		ordered.commerciaux.reduce(
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
	const countTotals = $derived(
		ordered.autres.reduce(
			(acc, member) => ({
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

	// Total : toute l'agence, commerciaux + superviseurs (objectifs des
	// superviseurs exclus puisqu'ils n'en ont pas). Ligne finale du tableau.
	const grandTotals = $derived.by(() => {
		const t = {
			objectiveCa: totals.objectiveCa,
			objectiveRdv: totals.objectiveRdv,
			rdvTap: totals.rdvTap + countTotals.rdvTap,
			rdvGms: totals.rdvGms + countTotals.rdvGms,
			total: totals.total + countTotals.total,
			rdvTraites: totals.rdvTraites + countTotals.rdvTraites,
			ventes: totals.ventes + countTotals.ventes,
			caPeriode: totals.caPeriode + countTotals.caPeriode,
			caAttente: totals.caAttente + countTotals.caAttente,
			caErreur: totals.caErreur + countTotals.caErreur,
			caAnnulations: totals.caAnnulations + countTotals.caAnnulations,
			caTotal: totals.caTotal + countTotals.caTotal
		};
		return t;
	});
</script>

<!-- Mobile : prénom nom + CA total uniquement (mêmes regroupements que le tableau) -->
<div class="flex flex-col gap-1.5 md:hidden">
	{#each [...ordered.commerciaux, ...ordered.autres] as member}
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
	{#if ordered.autres.length > 0}
		<div
			class="flex items-center justify-between gap-3 rounded-lg border border-dashed border-line px-3 py-2"
		>
			<span class="text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
				>Total autres</span
			>
			<span class="text-[13px] font-semibold text-muted-foreground"
				>{euro.format(countTotals.caTotal)}</span
			>
		</div>
	{/if}
	<div
		class="flex items-center justify-between gap-3 rounded-lg border border-line bg-glass-1 px-3 py-2"
	>
		<span class="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
			>Total</span
		>
		<span class="text-[13.5px] font-bold text-foreground"
			>{euro.format(grandTotals.caTotal)}</span
		>
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
			{#each ordered.commerciaux as member (member._id ?? `${member.firstName} ${member.lastName}`)}
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
						{#if isZoneManagerRow(member)}
							<!-- Les superviseurs de zone n'ont pas d'objectifs : case vide. -->
						{:else}
							{euro.format(member.objectiveCa)}
						{/if}
					</TableCell>
					<TableCell
						class="px-2.5 py-1.5 text-right text-[13.5px] whitespace-nowrap text-foreground"
					>
						{#if !isZoneManagerRow(member)}{member.objectiveRdv}{/if}
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

			{#if ordered.autres.length > 0}
				<!-- Ligne « AUTRES » : superviseurs de zone (directeur de zone,
				     animateur de zone) — pas d'objectifs, hors total des commerciaux. -->
				<TableRow class="border-line bg-glass-1/70 hover:bg-glass-1/70">
					<TableCell
						colspan={13}
						class="px-2.5 py-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
					>
						Autres — animation
					</TableCell>
				</TableRow>
				{#each ordered.autres as member (member._id ?? `${member.firstName} ${member.lastName}`)}
					<TableRow class="border-line/60 hover:bg-glass-1">
						<TableCell class="px-2.5 py-1.5">
							<div class="flex items-center gap-2">
								<Avatar
									photo={photoForMember(member.firstName, member.lastName)}
									label={`${member.firstName[0]}${member.lastName[0]}`}
									class="size-7 bg-muted text-[10px] font-bold text-muted-foreground"
								/>
								<span
									class="text-[14px] font-medium whitespace-nowrap text-foreground"
								>
									{member.firstName}
									{member.lastName}
								</span>
							</div>
						</TableCell>
						<!-- Objectifs vides pour les superviseurs de zone. -->
						<TableCell
							class="px-2.5 py-1.5 text-right text-[13.5px] whitespace-nowrap text-foreground"
						></TableCell>
						<TableCell
							class="px-2.5 py-1.5 text-right text-[13.5px] whitespace-nowrap text-foreground"
						></TableCell>
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
			{/if}

			{#if members.length === 0}
				<TableRow class="border-line/60 hover:bg-transparent">
					<TableCell colspan={13} class="px-4 py-8 text-center text-[13px] text-muted-foreground">
						Aucun membre pour le moment.
					</TableCell>
				</TableRow>
			{/if}

			{#if ordered.autres.length > 0}
				<!-- Total du groupe AUTRES (superviseurs de zone) : mêmes colonnes
				     que les commerciaux, sauf les objectifs (ils n'en ont pas). -->
				<TableRow class="hover:bg-transparent">
					<TableCell
						class="px-2.5 py-1.5 text-[13px] font-semibold tracking-wide text-muted-foreground uppercase"
					>
						Total autres
					</TableCell>
					<TableCell class="px-2.5 py-1.5"></TableCell>
					<TableCell class="px-2.5 py-1.5"></TableCell>
					<TableCell
						class="px-2.5 py-1.5 text-right text-[13px] font-semibold whitespace-nowrap text-muted-foreground"
					>
						{count(countTotals.rdvTap)}
					</TableCell>
					<TableCell
						class="px-2.5 py-1.5 text-right text-[13px] font-semibold whitespace-nowrap text-muted-foreground"
					>
						{count(countTotals.rdvGms)}
					</TableCell>
					<TableCell
						class="px-2.5 py-1.5 text-right text-[13px] font-semibold whitespace-nowrap text-muted-foreground"
					>
						{count(countTotals.total)}
					</TableCell>
					<TableCell
						class="px-2.5 py-1.5 text-right text-[13px] font-semibold whitespace-nowrap text-muted-foreground"
					>
						{count(countTotals.rdvTraites)}
					</TableCell>
					<TableCell
						class="px-2.5 py-1.5 text-right text-[13px] font-semibold whitespace-nowrap text-muted-foreground"
					>
						{count(countTotals.ventes)}
					</TableCell>
					<TableCell
						class="px-2.5 py-1.5 text-right text-[13px] font-semibold whitespace-nowrap text-muted-foreground"
					>
						{euro.format(countTotals.caPeriode)}
					</TableCell>
					<TableCell
						class="px-2.5 py-1.5 text-right text-[13px] font-semibold whitespace-nowrap text-sky-400/70"
					>
						{euro.format(countTotals.caAttente)}
					</TableCell>
					<TableCell
						class="px-2.5 py-1.5 text-right text-[13px] font-semibold whitespace-nowrap text-orange-400/70"
					>
						{euro.format(countTotals.caErreur)}
					</TableCell>
					<TableCell
						class="px-2.5 py-1.5 text-right text-[13px] font-semibold whitespace-nowrap text-red-400/70"
					>
						{euro.format(countTotals.caAnnulations)}
					</TableCell>
					<TableCell
						class="px-2.5 py-1.5 text-right text-[13px] font-semibold whitespace-nowrap text-muted-foreground"
					>
						{euro.format(countTotals.caTotal)}
					</TableCell>
				</TableRow>
			{/if}

			<!-- Total : toute l'agence (commerciaux + superviseurs de zone). Sans
			     superviseur, il reste le total des commerciaux. -->
			<TableRow class="border-t-2 border-line bg-glass-1 hover:bg-glass-1">
					<TableCell
						class="px-2.5 py-1.5 text-[13.5px] font-bold tracking-wider text-foreground uppercase"
					>
						Total
					</TableCell>
					<TableCell
						class="px-2.5 py-1.5 text-right text-[13.5px] font-bold whitespace-nowrap text-foreground"
					>
						{euro.format(grandTotals.objectiveCa)}
					</TableCell>
					<TableCell
						class="px-2.5 py-1.5 text-right text-[13.5px] font-bold whitespace-nowrap text-foreground"
					>
						{grandTotals.objectiveRdv}
					</TableCell>
					<TableCell
						class="px-2.5 py-1.5 text-right text-[13.5px] font-bold whitespace-nowrap text-foreground"
					>
						{count(grandTotals.rdvTap)}
					</TableCell>
					<TableCell
						class="px-2.5 py-1.5 text-right text-[13.5px] font-bold whitespace-nowrap text-foreground"
					>
						{count(grandTotals.rdvGms)}
					</TableCell>
					<TableCell
						class="px-2.5 py-1.5 text-right text-[13.5px] font-bold whitespace-nowrap text-foreground"
					>
						{count(grandTotals.total)}
					</TableCell>
					<TableCell
						class="px-2.5 py-1.5 text-right text-[13.5px] font-bold whitespace-nowrap text-foreground"
					>
						{count(grandTotals.rdvTraites)}
					</TableCell>
					<TableCell
						class="px-2.5 py-1.5 text-right text-[13.5px] font-bold whitespace-nowrap text-foreground"
					>
						{count(grandTotals.ventes)}
					</TableCell>
					<TableCell
						class="px-2.5 py-1.5 text-right text-[13.5px] font-bold whitespace-nowrap text-foreground"
					>
						{euro.format(grandTotals.caPeriode)}
					</TableCell>
					<TableCell
						class="px-2.5 py-1.5 text-right text-[13.5px] font-bold whitespace-nowrap text-sky-400"
					>
						{euro.format(grandTotals.caAttente)}
					</TableCell>
					<TableCell
						class="px-2.5 py-1.5 text-right text-[13.5px] font-bold whitespace-nowrap text-orange-400"
					>
						{euro.format(grandTotals.caErreur)}
					</TableCell>
					<TableCell
						class="px-2.5 py-1.5 text-right text-[13.5px] font-bold whitespace-nowrap text-red-400"
					>
						{euro.format(grandTotals.caAnnulations)}
					</TableCell>
					<TableCell
						class="px-2.5 py-1.5 text-right text-[13.5px] font-bold whitespace-nowrap text-foreground"
					>
						{euro.format(grandTotals.caTotal)}
					</TableCell>
				</TableRow>
		</TableBody>
	</Table>
</div>
