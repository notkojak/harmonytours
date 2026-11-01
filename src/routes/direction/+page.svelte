<script lang="ts">
	import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Download, Target } from '@lucide/svelte';
	import { useQuery } from 'convex-svelte';
	import { api } from '../../convex/_generated/api.js';
	import { authState } from '$lib/auth-state.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import { datedName, downloadCsv } from '$lib/csv';
	import { ANNULATION_REASONS, NON_VENTE_REASONS, reasonLabel } from '$lib/data/reasons';

	const moisCourant = () => {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
	};
	let mois = $state(moisCourant());

	const profile = useQuery(api.users.getProfile, () => (authState.isAuthenticated ? {} : 'skip'));
	const autorise = $derived(
		['administrateur', 'directeur de zone', 'animateur de zone', "directeur d'agence"].includes(
			profile.data?.role ?? ''
		)
	);

	const data = useQuery(api.pilotage.direction, () =>
		authState.isAuthenticated && autorise ? { mois } : 'skip'
	);

	function shift(delta: number) {
		const [y, m] = mois.split('-').map(Number);
		const d = new Date(y, m - 1 + delta, 1);
		mois = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
	}

	const moisLisible = $derived(
		new Date(`${mois}-01T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
	);

	const euro = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
	const pct = (n: number | null) => (n == null ? '—' : `${n} %`);
	const delta = (actuel: number, precedent: number) =>
		precedent <= 0 ? null : Math.round(((actuel - precedent) / precedent) * 100);

	const total = $derived(data.data?.total);

	function exporter() {
		if (!data.data) return;
		const rows: (string | number)[][] = [
			[
				'Agence',
				'CA validé HT',
				'CA précédent',
				'Objectif',
				'Réalisation',
				'Ventes',
				'Panier moyen',
				'Contacts',
				'RDV pris',
				'RDV traités',
				'En attente HT',
				'Erreurs HT',
				'Annulé HT'
			]
		];
		for (const a of data.data.parAgence) {
			rows.push([
				a.name,
				a.caValide,
				a.caPrecedent,
				a.objectifCa,
				a.tauxObjectif ?? '',
				a.ventes,
				a.panierMoyen,
				a.contactsCrees,
				a.rdvPris,
				a.rdvTraites,
				a.caAttente,
				a.caErreur,
				a.caAnnulee
			]);
		}
		rows.push([]);
		rows.push(['Commercial', 'Agence', 'CA validé HT', 'Ventes', 'Contacts', 'RDV pris', 'Objectif', 'Réalisation']);
		for (const p of data.data.parPersonne) {
			const agence = data.data.parAgence.find((a) => a._id === p.agencyId)?.name ?? '';
			rows.push([
				p.name,
				agence,
				p.caValide,
				p.ventes,
				p.contactsCrees,
				p.rdvPris,
				p.objectifCa,
				p.tauxObjectif ?? ''
			]);
		}
		downloadCsv(datedName(`harmony-direction-${mois}`), rows);
	}
</script>

<div class="space-y-5">
	{#if !autorise}
		<Card class="rounded-2xl border-line py-8">
			<CardContent class="text-center text-[13px] text-muted-foreground">
				La vue Direction est réservée aux managers (directeur d'agence, directeur de zone,
				animateur de zone, administrateur).
			</CardContent>
		</Card>
	{:else}
		<Card class="gap-0 rounded-2xl border-line py-0 shadow-none">
			<CardHeader class="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-0">
				<CardTitle class="flex items-center gap-2.5 text-[14px] font-semibold">
					<span
						class="grid size-8 place-items-center rounded-lg border border-brand/20 bg-brand/10 text-brand"
					>
						<Target class="size-4" strokeWidth={1.7} />
					</span>
					Direction
					<span class="text-[12px] font-normal text-muted-foreground capitalize">{moisLisible}</span>
				</CardTitle>
				<div class="flex items-center gap-2">
					<Button variant="outline" size="icon-sm" onclick={() => shift(-1)} aria-label="Mois précédent">
						<ChevronLeft class="size-4" />
					</Button>
					<Button variant="outline" size="icon-sm" onclick={() => shift(1)} disabled={mois >= moisCourant()} aria-label="Mois suivant">
						<ChevronRight class="size-4" />
					</Button>
					<Button variant="outline" size="sm" class="gap-1.5" onclick={exporter} disabled={!data.data}>
						<Download class="size-3.5" /> CSV
					</Button>
				</div>
			</CardHeader>

			<CardContent class="space-y-4 px-5 pt-4 pb-5">
				{#if data.isLoading || !total}
					<div class="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
						{#each [1, 2, 3, 4] as i}
							<div class="skeleton h-20 rounded-2xl"></div>
						{/each}
					</div>
				{:else}
					<!-- Totaux -->
					<div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
						<div class="rounded-2xl border border-line bg-card2 px-3 py-2.5">
							<p class="text-[10.5px] font-medium tracking-wide text-muted-foreground uppercase">CA validé HT</p>
							<p class="mt-1 text-[20px] leading-none font-bold text-foreground tabular-nums">{euro(total.caValide)} €</p>
							{#if delta(total.caValide, total.caPrecedent) != null}
								{@const d = delta(total.caValide, total.caPrecedent)}
								<p class={['mt-1 flex items-center gap-1 text-[10.5px] font-semibold', (d ?? 0) >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-destructive'].join(' ')}>
									{#if (d ?? 0) >= 0}<ArrowUpRight class="size-3" />{:else}<ArrowDownRight class="size-3" />{/if}
									{d} % vs mois -1
								</p>
							{/if}
						</div>
						<div class="rounded-2xl border border-line bg-card2 px-3 py-2.5">
							<p class="text-[10.5px] font-medium tracking-wide text-muted-foreground uppercase">Objectif</p>
							<p class="mt-1 text-[20px] leading-none font-bold text-foreground tabular-nums">{euro(total.objectifCa)} €</p>
							<p class="mt-1 text-[10.5px] text-muted-foreground">{pct(total.tauxObjectif)} réalisé</p>
						</div>
						<div class="rounded-2xl border border-line bg-card2 px-3 py-2.5">
							<p class="text-[10.5px] font-medium tracking-wide text-muted-foreground uppercase">Projection fin de mois</p>
							<p class="mt-1 text-[20px] leading-none font-bold text-brand tabular-nums">
								{total.projection == null ? '—' : `${euro(total.projection)} €`}
							</p>
							<p class="mt-1 text-[10.5px] text-muted-foreground">
								{total.objectifCa > 0 && total.projection != null
									? `${Math.round((total.projection / total.objectifCa) * 100)} % de l'objectif`
									: 'Mois clôturé'}
							</p>
						</div>
						<div class="rounded-2xl border border-line bg-card2 px-3 py-2.5">
							<p class="text-[10.5px] font-medium tracking-wide text-muted-foreground uppercase">Ventes</p>
							<p class="mt-1 text-[20px] leading-none font-bold text-foreground tabular-nums">{total.ventes}</p>
							<p class="mt-1 text-[10.5px] text-muted-foreground">panier {euro(total.panierMoyen)} € HT</p>
						</div>
						<div class="rounded-2xl border border-line bg-card2 px-3 py-2.5">
							<p class="text-[10.5px] font-medium tracking-wide text-muted-foreground uppercase">En attente</p>
							<p class="mt-1 text-[20px] leading-none font-bold text-amber-700 tabular-nums dark:text-amber-300">{euro(total.caAttente)} €</p>
							<p class="mt-1 text-[10.5px] text-muted-foreground">{total.ventesEnAttente} dossier(s) · plus ancien {total.attenteAge} j</p>
						</div>
						<div class="rounded-2xl border border-line bg-card2 px-3 py-2.5">
							<p class="text-[10.5px] font-medium tracking-wide text-muted-foreground uppercase">Erreurs / annulé</p>
							<p class="mt-1 text-[20px] leading-none font-bold text-destructive tabular-nums">{euro(total.caErreur)} €</p>
							<p class="mt-1 text-[10.5px] text-muted-foreground">{euro(total.caAnnulee)} € annulés</p>
						</div>
					</div>

					<!-- Entonnoir -->
					<div class="rounded-2xl border border-line bg-card2/60 px-4 py-3">
						<p class="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
							Entonnoir du mois
						</p>
						<div class="grid grid-cols-2 gap-2 sm:grid-cols-5">
							{#each [
								{ label: 'Contacts', value: total.contactsCrees, rate: null },
								{ label: 'RDV pris', value: total.rdvPris, rate: total.tauxContactRdv },
								{ label: 'RDV traités', value: total.rdvTraites, rate: total.tauxRdvTraite },
								{ label: 'Ventes', value: total.ventes, rate: total.rdvTraites ? Math.round((total.ventes / total.rdvTraites) * 100) : null }
							] as step}
								<div class="rounded-xl border border-line bg-card px-3 py-2">
									<p class="text-[10.5px] text-muted-foreground">{step.label}</p>
									<p class="text-[17px] font-bold text-foreground tabular-nums">{step.value}</p>
									{#if step.rate != null}
										<p class="text-[10px] font-semibold text-brand tabular-nums">{step.rate} %</p>
									{:else}
										<p class="text-[10px] text-muted-foreground">base</p>
									{/if}
								</div>
							{/each}
							<div class="rounded-xl border border-line bg-card px-3 py-2">
								<p class="text-[10.5px] text-muted-foreground">CA validé</p>
								<p class="text-[17px] font-bold text-foreground tabular-nums">{euro(total.caValide)} €</p>
								<p class="text-[10px] text-muted-foreground">{euro(total.panierMoyen)} € / vente</p>
							</div>
						</div>
					</div>

					<!-- Par agence -->
					<div class="overflow-x-auto rounded-2xl border border-line">
						<table class="w-full min-w-[760px] text-[12.5px]">
							<thead class="bg-glass-1 text-[10.5px] tracking-wide text-muted-foreground uppercase">
								<tr>
									<th class="px-3 py-2 text-left font-semibold">Agence</th>
									<th class="px-3 py-2 text-right font-semibold">CA HT</th>
									<th class="px-3 py-2 text-right font-semibold">Objectif</th>
									<th class="px-3 py-2 text-right font-semibold">Réalisé</th>
									<th class="px-3 py-2 text-right font-semibold">Projection</th>
									<th class="px-3 py-2 text-right font-semibold">Ventes</th>
									<th class="px-3 py-2 text-right font-semibold">Contacts</th>
									<th class="px-3 py-2 text-right font-semibold">RDV</th>
									<th class="px-3 py-2 text-right font-semibold">Traités</th>
									<th class="px-3 py-2 text-right font-semibold">En attente</th>
								</tr>
							</thead>
							<tbody>
								{#each data.data?.parAgence ?? [] as a (a._id)}
									<tr class="border-t border-line/60 hover:bg-glass-1">
										<td class="px-3 py-2 font-medium text-foreground">
											{a.name}
											{#if a.zone}<span class="ml-1 text-[10.5px] text-muted-foreground">· {a.zone}</span>{/if}
											<span class="ml-1 text-[10.5px] text-muted-foreground">({a.effectif})</span>
										</td>
										<td class="px-3 py-2 text-right font-semibold text-foreground tabular-nums">{euro(a.caValide)} €</td>
										<td class="px-3 py-2 text-right text-muted-foreground tabular-nums">{a.objectifCa ? `${euro(a.objectifCa)} €` : '—'}</td>
										<td class="px-3 py-2 text-right tabular-nums">
											<span class={['font-semibold', (a.tauxObjectif ?? 0) >= 100 ? 'text-emerald-700 dark:text-emerald-300' : (a.tauxObjectif ?? 0) >= 70 ? 'text-amber-700 dark:text-amber-300' : 'text-destructive'].join(' ')}>
												{pct(a.tauxObjectif)}
											</span>
										</td>
										<td class="px-3 py-2 text-right text-brand tabular-nums">{a.projection == null ? '—' : `${euro(a.projection)} €`}</td>
										<td class="px-3 py-2 text-right text-muted-foreground tabular-nums">{a.ventes}</td>
										<td class="px-3 py-2 text-right text-muted-foreground tabular-nums">{a.contactsCrees}</td>
										<td class="px-3 py-2 text-right text-muted-foreground tabular-nums">{a.rdvPris}</td>
										<td class="px-3 py-2 text-right text-muted-foreground tabular-nums">{a.rdvTraites}</td>
										<td class="px-3 py-2 text-right text-amber-700 tabular-nums dark:text-amber-300">
											{a.ventesEnAttente ? `${euro(a.caAttente)} €` : '—'}
										</td>
									</tr>
								{/each}
								{#if (data.data?.parAgence.length ?? 0) === 0}
									<tr><td colspan="10" class="px-3 py-6 text-center text-muted-foreground">Aucune agence dans ton périmètre.</td></tr>
								{/if}
							</tbody>
						</table>
					</div>

					<div class="grid gap-4 lg:grid-cols-[1fr_320px]">
						<!-- Par commercial -->
						<div class="overflow-x-auto rounded-2xl border border-line">
							<table class="w-full min-w-[560px] text-[12.5px]">
								<thead class="bg-glass-1 text-[10.5px] tracking-wide text-muted-foreground uppercase">
									<tr>
										<th class="px-3 py-2 text-left font-semibold">Commercial</th>
										<th class="px-3 py-2 text-right font-semibold">CA HT</th>
										<th class="px-3 py-2 text-right font-semibold">Objectif</th>
										<th class="px-3 py-2 text-right font-semibold">Ventes</th>
										<th class="px-3 py-2 text-right font-semibold">Contacts</th>
										<th class="px-3 py-2 text-right font-semibold">RDV</th>
									</tr>
								</thead>
								<tbody>
									{#each data.data?.parPersonne ?? [] as p (p._id)}
										<tr class="border-t border-line/60 hover:bg-glass-1">
											<td class="px-3 py-2">
												<span class="text-foreground">{p.name}</span>
												<span class="ml-1 text-[10px] text-muted-foreground">{p.role ?? ''}</span>
											</td>
											<td class="px-3 py-2 text-right font-semibold text-foreground tabular-nums">{euro(p.caValide)} €</td>
											<td class="px-3 py-2 text-right text-muted-foreground tabular-nums">{p.objectifCa ? `${euro(p.objectifCa)} €` : '—'}</td>
											<td class="px-3 py-2 text-right text-muted-foreground tabular-nums">{p.ventes}</td>
											<td class="px-3 py-2 text-right text-muted-foreground tabular-nums">{p.contactsCrees}</td>
											<td class="px-3 py-2 text-right text-muted-foreground tabular-nums">{p.rdvPris}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>

						<!-- Raisons -->
						<div class="rounded-2xl border border-line bg-card2/60 px-4 py-3">
							<p class="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
								Motifs de non-vente
							</p>
							{#if (data.data?.topRaisons.length ?? 0) === 0}
								<p class="text-[12px] text-muted-foreground">
									Aucun motif codifié sur le mois. Les raisons saisies librement ne sont pas
									agrégées.
								</p>
							{:else}
								<ul class="space-y-1.5">
									{#each data.data?.topRaisons ?? [] as r (r.code)}
										<li class="flex items-baseline gap-2 text-[12px]">
											<span class="min-w-0 flex-1 truncate text-foreground">
												{reasonLabel([...NON_VENTE_REASONS, ...ANNULATION_REASONS], r.code) ?? r.code}
											</span>
											<span class="shrink-0 font-semibold text-muted-foreground tabular-nums">{r.count}</span>
										</li>
									{/each}
								</ul>
							{/if}
						</div>
					</div>

					{#if data.data?.isCurrent}
						<p class="text-[11px] text-muted-foreground">
							Projection calculée sur {data.data.joursEcoules} jour(s) écoulés sur {data.data.joursDuMois}.
							Le CA retenu est celui des ventes validées.
						</p>
					{/if}
				{/if}
			</CardContent>
		</Card>
	{/if}
</div>
