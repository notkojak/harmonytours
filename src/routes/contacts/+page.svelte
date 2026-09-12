<script lang="ts">
	import { Check, ContactRound, Pencil, Printer, Search } from '@lucide/svelte';
	import { tick, untrack } from 'svelte';
	import { useMutation, useQuery } from 'convex-svelte';
	import { api } from '../../convex/_generated/api.js';
	import type { Id } from '../../convex/_generated/dataModel.js';
	import { authState } from '$lib/auth-state.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table/index.js';
	import { Tabs, TabsList, TabsTrigger } from '$lib/components/ui/tabs/index.js';
	import { sourceClass } from '$lib/data/sources';
	import ContactDialog, { type ContactRow } from '$lib/components/ContactDialog.svelte';
	import ContactPrintSheet from '$lib/components/ContactPrintSheet.svelte';
	import { contactQualif } from '$lib/data/qualification';
	import PersonTabs from '$lib/components/PersonTabs.svelte';
	import Avatar from '$lib/components/Avatar.svelte';

	// Onglet « par personne » (réservé aux managers) : undefined = Tout.
	let person = $state<Id<'users'> | undefined>(undefined);
	const contacts = useQuery(api.contacts.list, () =>
		authState.isAuthenticated ? { personId: person } : 'skip'
	);

	// Photos des commerciaux (nom complet → photo) pour les avatars.
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
	const photoForName = (name: string | null | undefined): string | undefined =>
		name ? photoByName.get(name.trim().toLowerCase()) : undefined;
	const initialsOf = (name: string | null | undefined): string =>
		(name ?? '')
			.trim()
			.split(/\s+/)
			.map((w) => w[0] ?? '')
			.slice(0, 2)
			.join('')
			.toUpperCase();

	let selected = $state<ContactRow | null>(null);
	let dialogOpen = $state(false);

	// Impression directe depuis la liste : la feuille imprimable du contact est
	// montée le temps de l'impression (elle ne s'affiche qu'à l'impression), puis
	// le contact est marqué comme imprimé (bouton vert, état conservé).
	const markContactPrinted = useMutation(api.contacts.markPrinted);
	let printTarget = $state<ContactRow | null>(null);
	let printing = $state<string | null>(null);
	const printAnswers = $derived(printTarget ? contactQualif(printTarget) : null);

	async function printContact(contact: ContactRow, event?: MouseEvent) {
		event?.stopPropagation();
		if (printing) return;
		printing = contact._id;
		printTarget = contact;
		try {
			await tick();
			window.print();
			await markContactPrinted({ contactId: contact._id as Id<'contacts'> });
		} catch (e) {
			console.error(e);
		} finally {
			// La liste est rechargée par la souscription Convex : l'état vert vient
			// du champ `printedAt` renvoyé par la requête.
			untrack(() => {
				printTarget = null;
				printing = null;
			});
		}
	}
	let search = $state('');
	// Onglets par état du RDV : « En attente » en premier et par défaut.
	let tab = $state<'attente' | 'deballe' | 'annule' | 'rappel' | 'traite'>('attente');

	type T = { statut?: string | null; followUp?: { type?: string; status?: string | null } | null };
	const isRdv = (c: T) => c.followUp?.type === 'rdv' && c.statut !== 'traité';
	const isInAttente = (c: T) => isRdv(c) && !c.followUp?.status;
	const counts = $derived({
		// Onglet RDV : tous les RDV non annulés (programmé, déballé, vendu).
		attente: (contacts.data ?? []).filter((c) => isRdv(c) && c.followUp?.status !== 'annulé')
			.length,
		deballe: (contacts.data ?? []).filter((c) => isRdv(c) && c.followUp?.status === 'déballé')
			.length,
		annule: (contacts.data ?? []).filter((c) => isRdv(c) && c.followUp?.status === 'annulé').length,
		rappel: (contacts.data ?? []).filter(
			(c) => c.followUp?.type === 'rappel' && c.statut !== 'traité'
		).length,
		traite: (contacts.data ?? []).filter((c) => c.statut === 'traité').length
	});

	const filtered = $derived(
		(contacts.data ?? [])
			.filter((contact) => {
				if (tab === 'attente') return isRdv(contact) && contact.followUp?.status !== 'annulé';
				if (tab === 'deballe') return isRdv(contact) && contact.followUp?.status === 'déballé';
				if (tab === 'annule') return isRdv(contact) && contact.followUp?.status === 'annulé';
				if (tab === 'rappel')
					return contact.followUp?.type === 'rappel' && contact.statut !== 'traité';
				if (tab === 'traite') return contact.statut === 'traité';
				return true;
			})
			.filter((contact) => contact.name.toLowerCase().includes(search.trim().toLowerCase()))
	);

	function openContact(contact: ContactRow) {
		selected = contact;
		dialogOpen = true;
	}

	function formatDate(iso: string | null | undefined): string {
		if (!iso) return '—';
		const [y, m, d] = iso.split('-').map(Number);
		return new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'short'
		});
	}

	// Affiche l'état réel du RDV (en attente / déballé / vendu / annulé) plutot
	// qu'un libellé générique.
	function statusLabel(c: {
		statut?: string | null;
		followUp?: { type?: string; status?: string | null } | null;
	}): string {
		if (c.statut === 'traité') return 'Traité';
		if (c.followUp?.type === 'rdv') {
			const s = c.followUp.status;
			if (s === 'déballé') return 'Déballé';
			if (s === 'vendu') return 'Vendu';
			if (s === 'annulé') return 'Annulé';
			return 'Programmé';
		}
		if (c.followUp?.type === 'rappel') return 'Rappel';
		return 'Actif';
	}

	function statusClass(c: {
		statut?: string | null;
		followUp?: { type?: string; status?: string | null } | null;
	}): string {
		if (c.statut === 'traité') return 'bg-emerald-500/15 text-emerald-400';
		if (c.followUp?.type === 'rdv') {
			const s = c.followUp.status;
			if (s === 'déballé') return 'bg-violet-500/15 text-violet-400';
			if (s === 'vendu') return 'bg-emerald-500/15 text-emerald-400';
			if (s === 'annulé') return 'bg-red-500/15 text-red-400';
			return 'bg-blue-500/15 text-blue-400';
		}
		if (c.followUp?.type === 'rappel') return 'bg-amber-500/15 text-amber-400';
		return 'bg-glass-2 text-muted-foreground';
	}
</script>

<div class="space-y-5">
	<Card class="gap-0 rounded-xl border-line py-0 shadow-none">
		<CardHeader class="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-0">
			<CardTitle class="flex items-center gap-2.5 text-[14px] font-semibold">
				<span
					class="grid size-8 place-items-center rounded-lg border border-line bg-card2 text-muted-foreground"
				>
					<ContactRound class="size-4" strokeWidth={1.7} />
				</span>
				Contacts
			</CardTitle>
			<PersonTabs bind:value={person} />
			<div class="flex items-center gap-2">
				<div class="relative">
					<Search
						class="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
						strokeWidth={1.7}
					/>
					<Input
						type="search"
						placeholder="Rechercher par nom…"
						bind:value={search}
						class="h-8 w-56 border-line bg-base pl-8"
					/>
				</div>
				<Badge variant="secondary" class="rounded-full px-2">
					{filtered.length}
				</Badge>
			</div>
		</CardHeader>
		<CardContent class="px-5 pt-2 pb-5">
			<Tabs
				value={tab}
				onValueChange={(value) =>
					(tab = value as 'attente' | 'deballe' | 'annule' | 'rappel' | 'traite')}
				class="mb-4 w-fit"
			>
				<TabsList class="flex-wrap">
					<TabsTrigger value="attente" class="group">
						RDV
						<span
							class="ml-1.5 rounded-full bg-glass-3 px-1.5 py-px text-[10px] font-semibold text-muted-foreground tabular-nums group-data-[state=active]:bg-primary-foreground/10 group-data-[state=active]:text-primary-foreground"
						>
							{counts.attente}
						</span>
					</TabsTrigger>
					<TabsTrigger value="rappel" class="group">
						Rappel
						<span
							class="ml-1.5 rounded-full bg-glass-3 px-1.5 py-px text-[10px] font-semibold text-muted-foreground tabular-nums group-data-[state=active]:bg-primary-foreground/10 group-data-[state=active]:text-primary-foreground"
						>
							{counts.rappel}
						</span>
					</TabsTrigger>
					<TabsTrigger value="annule" class="group">
						RDV annulé
						<span
							class="ml-1.5 rounded-full bg-glass-3 px-1.5 py-px text-[10px] font-semibold text-muted-foreground tabular-nums group-data-[state=active]:bg-primary-foreground/10 group-data-[state=active]:text-primary-foreground"
						>
							{counts.annule}
						</span>
					</TabsTrigger>
					<TabsTrigger value="deballe" class="group">
						RDV Déballé
						<span
							class="ml-1.5 rounded-full bg-glass-3 px-1.5 py-px text-[10px] font-semibold text-muted-foreground tabular-nums group-data-[state=active]:bg-primary-foreground/10 group-data-[state=active]:text-primary-foreground"
						>
							{counts.deballe}
						</span>
					</TabsTrigger>
					<TabsTrigger value="traite" class="group">
						Traité
						<span
							class="ml-1.5 rounded-full bg-glass-3 px-1.5 py-px text-[10px] font-semibold text-muted-foreground tabular-nums group-data-[state=active]:bg-primary-foreground/10 group-data-[state=active]:text-primary-foreground"
						>
							{counts.traite}
						</span>
					</TabsTrigger>
				</TabsList>
			</Tabs>

			<div class="overflow-x-auto rounded-lg border border-line">
				<Table class="min-w-[560px]">
					<TableHeader>
						<TableRow class="border-line bg-transparent hover:bg-transparent">
							<TableHead
								class="px-4 py-3 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase"
							>
								Statut
							</TableHead>
							<TableHead
								class="px-4 py-3 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase"
							>
								Date
							</TableHead>
							<TableHead
								class="px-4 py-3 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase"
							>
								Nom
							</TableHead>
							<TableHead
								class="px-4 py-3 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase"
							>
								Commercial
							</TableHead>
							<TableHead
								class="px-4 py-3 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase"
							>
								Projet
							</TableHead>
							<TableHead
								class="px-4 py-3 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase"
							>
								Source
							</TableHead>
							<TableHead
								class="px-4 py-3 text-right text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase"
							>
								Fiche
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{#each filtered as contact}
							<TableRow
								class="cursor-pointer border-line/60 transition-colors hover:bg-glass-1"
								onclick={() => openContact(contact)}
							>
								<TableCell class="px-4 py-3">
									<Badge
										class={[
											'rounded-sm px-2 py-0.5 text-[11.5px] font-medium',
											statusClass(contact)
										].join(' ')}
									>
										{statusLabel(contact)}
									</Badge>
								</TableCell>
								<TableCell class="px-4 py-3">
									{#if contact.followUp}
										<span class="inline-flex items-center gap-2 whitespace-nowrap">
											<span class="inline-block min-w-[4.5rem] text-[13.5px] text-foreground">
												{formatDate(contact.followUp.date)}
											</span>
											{#if contact.followUp.time}
												<span class="text-[11.5px] text-muted-foreground tabular-nums">
													{contact.followUp.time}
												</span>
											{/if}
										</span>
									{:else}
										<span class="text-[13.5px] text-muted-foreground">—</span>
									{/if}
								</TableCell>
								<TableCell class="px-4 py-3 text-[14px] font-medium text-foreground">
									{contact.name}
								</TableCell>
								<TableCell class="px-4 py-3 text-[13.5px] text-muted-foreground">
									{#if contact.createdByName}
										<span class="flex items-center gap-2">
											<Avatar
												photo={photoForName(contact.createdByName)}
												label={initialsOf(contact.createdByName)}
												class="size-6 bg-muted text-[9px] font-bold text-muted-foreground"
											/>
											<span class="whitespace-nowrap">{contact.createdByName}</span>
										</span>
									{:else}
										—
									{/if}
								</TableCell>
								<TableCell class="px-4 py-3 text-[13.5px] text-muted-foreground">
									{contact.projet ?? '—'}
								</TableCell>
								<TableCell class="px-4 py-3">
									{#if contact.source}
										<Badge
											class={[
												'rounded-sm px-2 py-0.5 text-[11.5px] font-medium',
												sourceClass(contact.source)
											].join(' ')}
										>
											{contact.source}
										</Badge>
									{:else}
										<span class="text-[13.5px] text-muted-foreground">—</span>
									{/if}
								</TableCell>
								<TableCell class="px-4 py-3">
									<div class="flex items-center justify-end gap-1.5">
										<button
											type="button"
											onclick={(event) => printContact(contact, event)}
											disabled={printing === contact._id}
											class={[
												'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11.5px] font-medium transition-colors',
												contact.printedAt
													? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15 hover:text-emerald-300'
													: 'border-line text-muted-foreground hover:bg-glass-1 hover:text-foreground'
											].join(' ')}
											title={contact.printedAt
												? 'Fiche déjà imprimée — cliquer pour réimprimer'
												: 'Imprimer la fiche'}
										>
											{#if contact.printedAt}
												<Check class="size-3.5" />
												Imprimée
											{:else}
												<Printer class="size-3.5" strokeWidth={1.7} />
												Imprimer
											{/if}
										</button>
										<Pencil class="size-3.5 text-muted-foreground" strokeWidth={1.7} />
									</div>
								</TableCell>
							</TableRow>
						{/each}
						{#if filtered.length === 0}
							<TableRow class="border-line/60 hover:bg-transparent">
								<TableCell
									colspan={7}
									class="px-4 py-8 text-center text-[13px] text-muted-foreground"
								>
									{search.trim()
										? 'Aucun contact ne correspond à la recherche.'
										: 'Aucun contact pour le moment.'}
								</TableCell>
							</TableRow>
						{/if}
					</TableBody>
				</Table>
			</div>
		</CardContent>
	</Card>
</div>

<ContactDialog bind:contact={selected} bind:open={dialogOpen} />

{#if printTarget}
	<ContactPrintSheet contact={printTarget} answers={printAnswers} />
{/if}
