<script lang="ts">
	import { SlidersHorizontal, TrendingUp } from '@lucide/svelte';
	import { useQuery } from 'convex-svelte';
	import { api } from '../convex/_generated/api.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import BlockingDossiers from '$lib/components/dashboard/blocking-dossiers.svelte';
	import ContactsWeek from '$lib/components/dashboard/contacts-week.svelte';
	import DayCalendar from '$lib/components/dashboard/day-calendar.svelte';
	import ObjectivesDialog from '$lib/components/ObjectivesDialog.svelte';
	import TeamMembersTable from '$lib/components/dashboard/team-members-table.svelte';
	import type { TeamMember } from '$lib/data/dashboard';
	import VentesList from '$lib/components/dashboard/ventes-list.svelte';
	import ZonePreview from '$lib/components/dashboard/zone-preview.svelte';
	import { statsPeriod } from '$lib/stats-period.svelte';
	import { authState } from '$lib/auth-state.svelte';

	const statsTitle = $derived(
		statsPeriod.period === 'mois'
			? 'Statistiques du mois'
			: statsPeriod.period === 'semaine'
				? 'Statistiques de la semaine'
				: 'Statistiques du jour'
	);

	// Membres visibles : actifs + virés pendant la période choisie (jour / semaine
	// / mois autour de la date sélectionnée dans le Topbar).
	const team = useQuery(api.employes.listTeamMembers, () =>
		authState.isAuthenticated ? { period: statsPeriod.period, date: statsPeriod.date } : 'skip'
	);
	const teamLoading = $derived(authState.isAuthenticated && team.isLoading);
	// On garde les dernières données (pas de « Aucun membre » clignotant au
	// changement de période).
	let teamMembers = $state<TeamMember[]>([]);
	$effect(() => {
		if (team.data) teamMembers = team.data;
	});
	const members = $derived(teamMembers);

	// Objectifs mensuels : réservés au directeur d'agence.
	const profile = useQuery(api.users.getProfile, () => (authState.isAuthenticated ? {} : 'skip'));
	const canEditObjectifs = $derived(
		['administrateur', 'directeur de zone', "directeur d'agence"].includes(profile.data?.role ?? '')
	);
	const statsMonth = $derived(statsPeriod.date.slice(0, 7));
	let objectifsOpen = $state(false);
</script>

<div class="space-y-5">
	<!-- Dossiers bloquants (carte masquée si aucun dossier en erreur) -->
	<BlockingDossiers />

	<!-- Statistiques : pleine largeur -->
	<Card class="gap-0 rounded-2xl border-line py-0 shadow-none">
		<CardHeader class="flex items-center justify-between gap-3 px-5 pt-5 pb-0">
			<CardTitle class="flex items-center gap-2.5 text-[14px] font-semibold">
				<span
					class="grid size-8 place-items-center rounded-lg border border-line bg-card2 text-muted-foreground"
				>
					<TrendingUp class="size-4" strokeWidth={1.7} />
				</span>
				{statsTitle}
			</CardTitle>
			{#if canEditObjectifs}
				<Button
					variant="outline"
					size="sm"
					class="border-violet-500/40 text-violet-300 hover:bg-violet-500/10 hover:text-violet-200 light:border-violet-500/60 light:text-violet-600 light:hover:text-violet-700"
					onclick={() => (objectifsOpen = true)}
				>
					<SlidersHorizontal class="size-3.5" />
					Objectifs
				</Button>
			{/if}
		</CardHeader>
		<CardContent class="px-5 pt-2 pb-5">
			<TeamMembersTable {members} period={statsPeriod.period} />
		</CardContent>
	</Card>

	<!-- Zone de prospection en cours : mini carte pleine largeur -->
	<ZonePreview />

	<!-- Planning du jour + contacts à rappeler : côte à côte -->
	<div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
		<DayCalendar date={statsPeriod.date} />
		<ContactsWeek />
	</div>

	<!-- Ventes du mois : pleine largeur -->
	<VentesList />
</div>

<ObjectivesDialog bind:open={objectifsOpen} initialMonth={statsMonth} />
