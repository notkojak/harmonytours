<script lang="ts">
	import { pageEmojis } from '$lib/data/dashboard';
	import { PUCE } from '$lib/data/vente-suivi';
	import { Check, ContactRound, Printer, Search, Undo2 } from '@lucide/svelte';
	import { tick, untrack } from 'svelte';
	import { useMutation, useQuery } from 'convex-svelte';
	import { api } from '../../convex/_generated/api.js';
	import type { Id } from '../../convex/_generated/dataModel.js';
	import { authState } from '$lib/auth-state.svelte';
	import { page } from '$app/state';
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
	import { canWriteCrm } from '$lib/data/roles';
	import ContactDialog, { type ContactRow } from '$lib/components/ContactDialog.svelte';
	import ContactPrintSheet from '$lib/components/contact-print-sheet.svelte';
	import ContactPrintSheetClassic from '$lib/components/contact-print-sheet-classic.svelte';
	import { waitForPrintAssets } from '$lib/actions/print-page';
	import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover/index.js';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog/index.js';
	import { contactQualif } from '$lib/data/qualification';
	import PersonTabs from '$lib/components/PersonTabs.svelte';
	import Avatar from '$lib/components/Avatar.svelte';

	// Onglet « par personne » (réservé aux managers) : undefined = Tout.
	let person = $state<Id<'users'> | undefined>(undefined);
	const contacts = useQuery(api.contacts.list, () =>
		authState.isAuthenticated ? { personId: person } : 'skip'
	);

	// Écriture CRM : le commercial est en consultation seule (même règle que le
	// serveur) — on ne lui montre pas les actions qu'il ne peut pas faire.
	const profile = useQuery(api.users.getProfile, () => (authState.isAuthenticated ? {} : 'skip'));
	const canWrite = $derived(canWriteCrm(profile.data?.role));

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
	let printSecond = $state<ContactRow | null>(null);
	let printing = $state<string | null>(null);
	let printModel = $state<'moderne' | 'classique'>('moderne');
	const printAnswers = $derived(printTarget ? contactQualif(printTarget) : null);
	const printSecondAnswers = $derived(printSecond ? contactQualif(printSecond) : null);

	async function printContact(
		contact: ContactRow,
		model: 'moderne' | 'classique' = 'moderne',
		event?: MouseEvent
	) {
		await runPrint(contact, null, model, event);
	}

	// Impression de deux fiches sur une seule A4 paysage (deux moitiés A5).
	async function printPair(first: ContactRow, secondContact: ContactRow) {
		await runPrint(first, secondContact, 'moderne');
	}

	async function runPrint(
		contact: ContactRow,
		secondContact: ContactRow | null,
		model: 'moderne' | 'classique',
		event?: MouseEvent
	) {
		event?.stopPropagation();
		if (printing) return;
		printing = contact._id;
		printModel = model;
		printTarget = contact;
		printSecond = secondContact;
		try {
			await tick();
			// Le logo doit être chargé avant que l'aperçu ne fige la feuille.
			await waitForPrintAssets();
			window.print();
			await markContactPrinted({ contactId: contact._id as Id<'contacts'> });
			if (secondContact) {
				await markContactPrinted({ contactId: secondContact._id as Id<'contacts'> });
			}
		} catch (e) {
			console.error(e);
		} finally {
			// La liste est rechargée par la souscription Convex : l'état vert vient
			// du champ `printedAt` renvoyé par la requête.
			untrack(() => {
				printTarget = null;
				printSecond = null;
				printing = null;
			});
		}
	}

	// Choix du second contact à imprimer sur la même feuille.
	let pairFirst = $state<ContactRow | null>(null);
	let pairOpen = $state(false);
	let pairSearch = $state('');
	const pairCandidates = $derived(
		(contacts.data ?? []).filter((c) => {
			if (c._id === pairFirst?._id) return false;
			// On ne propose que les fiches qui n'ont jamais été imprimées.
			if (c.printedAt) return false;
			const q = pairSearch.trim().toLowerCase();
			return !q || c.name.toLowerCase().includes(q) || (c.projet ?? '').toLowerCase().includes(q);
		})
	);
	// Vrai s'il reste au moins une autre fiche jamais imprimée : permet de
	// distinguer « aucune correspondance » de « tout a déjà été imprimé ».
	const hasOtherUnprinted = $derived(
		(contacts.data ?? []).some((c) => c._id !== pairFirst?._id && !c.printedAt)
	);

	function openPairPicker(contact: ContactRow, event?: MouseEvent) {
		event?.stopPropagation();
		pairFirst = contact;
		pairSearch = '';
		pairOpen = true;
	}

	async function choosePair(secondContact: ContactRow) {
		const first = pairFirst;
		pairOpen = false;
		if (!first) return;
		await printPair(first, secondContact);
	}
	// Annulation du marquage « traité » depuis la liste : le contact revient dans
	// son onglet principal (RDV, rappel ou actif).
	const markContactTreated = useMutation(api.contacts.markTreated);
	async function untreatContact(contact: ContactRow, event?: MouseEvent) {
		event?.stopPropagation();
		try {
			await markContactTreated({
				contactId: contact._id as Id<'contacts'>,
				treated: false
			});
		} catch (e) {
			console.error(e);
		}
	}

	let search = $state(page.url.searchParams.get('q') ?? '');

	// Recherche globale : la page peut être ouverte avec ?q=… pour préremplir.
	$effect(() => {
		const q = page.url.searchParams.get('q');
		if (q !== null) {
			untrack(() => {
				if (search !== q) search = q;
			});
		}
	});
	// Trois onglets de vie du contact : en cours de suivi, à rejouer, ou clos.
	let tab = $state<'actif' | 'encours' | 'traite'>('actif');

	type T = {
		statut?: string | null;
		followUp?: { type?: string; date?: string; status?: string | null } | null;
	};
	// Dossier clos : soit marqué « traité », soit vendu (le RDV a abouti).
	const isTraite = (c: T) => c.statut === 'traité' || c.followUp?.status === 'vendu';
	// Actif : un suivi (RDV ou rappel) encore ouvert, ou un contact sans suivi.
	const isActif = (c: T) => !isTraite(c) && !c.followUp?.status;
	// En cours : le RDV a été annulé, déballé, ou doit être replanifié.
	const isEnCours = (c: T) =>
		!isTraite(c) && ['annulé', 'déballé', 'à reprogrammer'].includes(c.followUp?.status ?? '');

	const counts = $derived({
		actif: (contacts.data ?? []).filter(isActif).length,
		encours: (contacts.data ?? []).filter(isEnCours).length,
		traite: (contacts.data ?? []).filter(isTraite).length
	});

	const filtered = $derived(
		(contacts.data ?? [])
			.filter((contact) => {
				if (tab === 'actif') return isActif(contact);
				if (tab === 'encours') return isEnCours(contact);
				if (tab === 'traite') return isTraite(contact);
				return true;
			})
			.filter((contact) => contact.name.toLowerCase().includes(search.trim().toLowerCase()))
	);

	// Retard d'un suivi encore ouvert : nombre de jours dépassés, sinon null.
	function joursDeRetard(c: T): number | null {
		const fu = c.followUp;
		if (!fu?.date || fu.status || isTraite(c)) return null;
		const [y, m, d] = fu.date.split('-').map(Number);
		const aujourdhui = new Date();
		aujourdhui.setHours(0, 0, 0, 0);
		const jours = Math.round((new Date(y, m - 1, d).getTime() - aujourdhui.getTime()) / 86_400_000);
		return jours < 0 ? -jours : null;
	}

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
			if (s === 'à reprogrammer') return 'À reprogrammer';
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
		if (c.statut === 'traité') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
		if (c.followUp?.type === 'rdv') {
			const s = c.followUp.status;
			if (s === 'déballé') return 'bg-violet-500/15 text-violet-700 dark:text-violet-300';
			if (s === 'à reprogrammer') return 'bg-orange-500/15 text-orange-700 dark:text-orange-300';
			if (s === 'vendu') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
			if (s === 'annulé') return 'bg-red-500/15 text-red-700 dark:text-red-300';
			return 'bg-blue-500/15 text-blue-700 dark:text-blue-300';
		}
		if (c.followUp?.type === 'rappel') return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
		return 'bg-glass-2 text-muted-foreground';
	}
</script>

<div class="space-y-5">
	<Card class="gap-0 rounded-2xl border-0 py-0 shadow-none">
		<CardHeader class="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-0">
			<div class="min-w-0">
				<CardTitle class="flex items-center gap-2.5 text-[14px] font-semibold">
					<span class="text-[15px] leading-none" aria-hidden="true">{pageEmojis['/contacts']}</span>
					Contacts
				</CardTitle>
				<p class="mt-1 pl-6 text-[11.5px] font-medium text-muted-foreground">
					Prospects, rendez-vous et suivis
				</p>
			</div>
			<Badge variant="secondary" class="rounded-full bg-card2 px-2.5">
				{filtered.length}
			</Badge>
		</CardHeader>
		<CardContent class="px-5 pt-4 pb-5">
			<!-- Barre de filtres : statut, commercial, recherche -->
			<div class="mb-4 flex flex-wrap items-center gap-2">
				<Tabs
					value={tab}
					onValueChange={(value) => (tab = value as 'actif' | 'encours' | 'traite')}
					class="w-fit"
				>
					<TabsList class="flex-wrap rounded-full border-0 bg-card2">
						<TabsTrigger value="actif" class="group rounded-full">
							Actif
							<span
								class="ml-1.5 rounded-full bg-glass-3 px-1.5 py-px text-[10px] font-semibold text-muted-foreground tabular-nums group-data-[state=active]:bg-primary-foreground/10 group-data-[state=active]:text-primary-foreground"
							>
								{counts.actif}
							</span>
						</TabsTrigger>
						<TabsTrigger value="encours" class="group rounded-full">
							En cours
							<span
								class="ml-1.5 rounded-full bg-glass-3 px-1.5 py-px text-[10px] font-semibold text-muted-foreground tabular-nums group-data-[state=active]:bg-primary-foreground/10 group-data-[state=active]:text-primary-foreground"
							>
								{counts.encours}
							</span>
						</TabsTrigger>
						<TabsTrigger value="traite" class="group rounded-full">
							Traités
							<span
								class="ml-1.5 rounded-full bg-glass-3 px-1.5 py-px text-[10px] font-semibold text-muted-foreground tabular-nums group-data-[state=active]:bg-primary-foreground/10 group-data-[state=active]:text-primary-foreground"
							>
								{counts.traite}
							</span>
						</TabsTrigger>
					</TabsList>
				</Tabs>

				<PersonTabs bind:value={person} />

				<div class="relative ml-auto">
					<Search
						class="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
						strokeWidth={1.7}
					/>
					<Input
						type="search"
						placeholder="Rechercher par nom…"
						bind:value={search}
						class="h-9 w-64 rounded-full border-0 bg-card2 pr-3 pl-8 text-[13px] shadow-none focus-visible:ring-2 focus-visible:ring-ink/10"
					/>
				</div>
			</div>

			<div class="overflow-x-auto rounded-2xl">
				<Table class="min-w-[560px] border-separate border-spacing-y-1.5">
					<TableHeader>
						<TableRow class="border-transparent bg-transparent hover:bg-transparent">
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
							{@const retard = joursDeRetard(contact)}
							<TableRow
								class={[
									'cursor-pointer border-0 transition-colors [&>td:first-child]:rounded-l-xl [&>td:last-child]:rounded-r-xl',
									// Retard : la ligne entière passe en rouge, date et compteur de jours
									// compris. En thème sombre le voile est un peu plus dense, sinon
									// /5 se fond dans le fond quasi noir.
									retard
										? '[&:hover>td]:bg-destructive/12 [&>td]:bg-destructive/8'
										: '[&:hover>td]:bg-glass-3 [&>td]:bg-card2'
								].join(' ')}
								onclick={() => openContact(contact)}
							>
								<TableCell class="px-4 py-3">
									<span class={[PUCE, statusClass(contact)].join(' ')}>{statusLabel(contact)}</span>
								</TableCell>
								<TableCell class="px-4 py-3">
									{#if contact.followUp}
										<span class="inline-flex items-center gap-2 whitespace-nowrap">
											<span
												class={[
													'inline-block min-w-[4.5rem] text-[13px]',
													retard ? 'font-semibold text-destructive' : 'text-foreground'
												].join(' ')}
											>
												{formatDate(contact.followUp.date)}
											</span>
											{#if contact.followUp.time}
												<span class="text-[11.5px] text-muted-foreground tabular-nums">
													{contact.followUp.time}
												</span>
											{/if}
											{#if retard}
												<span
													class="rounded-md bg-destructive/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-destructive"
													title="Suivi en retard"
												>
													{retard} j
												</span>
											{/if}
										</span>
									{:else}
										<span class="text-[13px] text-muted-foreground">—</span>
									{/if}
								</TableCell>
								<TableCell class="px-4 py-3 text-[13px] font-medium text-foreground">
									{contact.name}
								</TableCell>
								<TableCell class="px-4 py-3 text-[13px] text-muted-foreground">
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
								<TableCell class="px-4 py-3 text-[13px] text-muted-foreground">
									{contact.projet ?? '—'}
								</TableCell>
								<TableCell class="px-4 py-3">
									{#if contact.source}
										<span class={[PUCE, sourceClass(contact.source)].join(' ')}>
											{contact.source}
										</span>
									{:else}
										<span class="text-[13px] text-muted-foreground">—</span>
									{/if}
								</TableCell>
								<TableCell class="px-4 py-3">
									<div class="flex items-center justify-end gap-1.5">
										<Popover>
											<PopoverTrigger
												disabled={printing === contact._id}
												onclick={(event) => event.stopPropagation()}
												class={[
													'inline-flex items-center gap-1.5 rounded-full border-0 px-2.5 py-1 text-[11.5px] font-medium transition-colors disabled:opacity-60',
													contact.printedAt
														? 'bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300'
														: 'bg-card text-muted-foreground hover:bg-glass-3 hover:text-foreground'
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
											</PopoverTrigger>
											<PopoverContent
												align="end"
												class="w-60 gap-0.5 p-1.5"
												onclick={(event) => event.stopPropagation()}
											>
												<button
													type="button"
													class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium text-foreground transition-colors hover:bg-glass-2"
													onclick={() => printContact(contact, 'moderne')}
												>
													<Printer class="size-3.5 text-brand" />
													Fiche Bravaux
												</button>
												<button
													type="button"
													class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-glass-2 hover:text-foreground"
													onclick={(event) => openPairPicker(contact, event)}
												>
													<Printer class="size-3.5" />
													2 fiches sur une A4…
												</button>
											</PopoverContent>
										</Popover>
										{#if contact.statut === 'traité' && canWrite}
											<button
												type="button"
												onclick={(event) => untreatContact(contact, event)}
												class="inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-glass-3 hover:text-foreground"
												title="Annuler le traitement — le contact retrouve son état principal"
											>
												<Undo2 class="size-3.5" strokeWidth={1.7} />
												Annuler
											</button>
										{/if}
									</div>
								</TableCell>
							</TableRow>
						{/each}
						{#if filtered.length === 0}
							<TableRow class="border-0 hover:bg-transparent">
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
	{#if printModel === 'classique'}
		<ContactPrintSheetClassic contact={printTarget} answers={printAnswers} />
	{:else}
		<ContactPrintSheet
			contact={printTarget}
			answers={printAnswers}
			second={printSecond}
			secondAnswers={printSecondAnswers}
		/>
	{/if}
{/if}

<!-- Choix du 2ᵉ contact à imprimer sur l'autre moitié de la feuille -->
<Dialog bind:open={pairOpen}>
	<DialogContent class="sm:max-w-md">
		<DialogHeader>
			<DialogTitle>Imprimer 2 fiches</DialogTitle>
			<DialogDescription>
				La fiche de <b>{pairFirst?.name ?? 'ce contact'}</b> occupera la moitié gauche. Choisis le contact
				qui ira sur la moitié droite. Seules les fiches jamais imprimées sont proposées.
			</DialogDescription>
		</DialogHeader>
		<Input bind:value={pairSearch} placeholder="Rechercher un contact…" />
		<div class="max-h-80 overflow-y-auto">
			{#each pairCandidates as candidate (candidate._id)}
				<button
					type="button"
					class="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-glass-2"
					onclick={() => choosePair(candidate)}
				>
					<span class="text-[13px] font-medium text-foreground">{candidate.name}</span>
					<span class="truncate text-[11.5px] text-muted-foreground">{candidate.projet ?? ''}</span>
				</button>
			{:else}
				<p class="px-2.5 py-6 text-center text-[12.5px] text-muted-foreground">
					{hasOtherUnprinted
						? 'Aucun contact non imprimé ne correspond.'
						: 'Toutes les autres fiches ont déjà été imprimées.'}
				</p>
			{/each}
		</div>
	</DialogContent>
</Dialog>
