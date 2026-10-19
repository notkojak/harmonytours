<script lang="ts">
	import { onDestroy } from 'svelte';
	import {
		ArrowLeft,
		ArrowRight,
		BadgeCheck,
		CalendarDays,
		Check,
		Clock,
		Lock,
		LockOpen,
		MapPin,
		PartyPopper,
		PhoneCall,
		Route,
		Search,
		ShieldCheck,
		Sparkles,
		TriangleAlert
	} from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		CARTE_ALERTE,
		CARTE_SUCCES,
		FOCUS_CHAMP,
		SUCCES_PLEIN,
		TEXTE_ALERTE,
		TEXTE_SUCCES
	} from '$lib/chiffrage-style';
	import {
		Dialog,
		DialogContent,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog/index.js';
	import { euro } from '$lib/data/book';
	import AddressInput from '$lib/components/AddressInput.svelte';
	import Anneau from './Anneau.svelte';
	import CarteChantiers from './CarteChantiers.svelte';
	import {
		CONDITIONS,
		DUREE_OBJECTIONS_MIN,
		MAX_CHANTIERS_REGROUPES,
		REMISE_PAR_CHANTIER,
		SEUIL_SUPERVISION,
		SECTEURS,
		THEMES,
		centreDe,
		chantiersProches,
		conditionsOk,
		opportunitePrete,
		remiseDe,
		rondDeDate,
		secteurDe,
		supervisionRequise,
		type CleCondition,
		type Opportunite
	} from '$lib/data/opportunite';

	let {
		open = $bindable(false),
		projet = '',
		adresseInitiale = '',
		totalTTC = 0,
		onValider
	}: {
		open?: boolean;
		/** désignation de la ligne principale du devis, pour pré-remplir le script */
		projet?: string;
		/** adresse validée devant le client, pour ne pas la saisir deux fois */
		adresseInitiale?: string;
		/** total TTC du devis, pour chiffrer l'effort demandé au responsable */
		totalTTC?: number;
		onValider: (o: Opportunite) => void;
	} = $props();

	// -------------------------------------------------------------- Étapes
	const ETAPES = ['Conditions', 'Regroupement', 'L’appel', 'Opportunité'];
	let etape = $state(1);

	// -------------------------------------------------------- Étape 1 · conditions
	let conditions = $state<Record<CleCondition, boolean>>({
		pasPresse: false,
		panneau: false,
		discretion: false
	});
	/** minutes d'objections faites avant d'ouvrir l'outil */
	let objectionsAvant = $state(0);
	/** secondes du chrono en cours */
	let chrono = $state(0);
	let chronoActif = $state(false);

	const objectionsTotal = $derived(objectionsAvant + Math.floor(chrono / 60));
	const chronoOk = $derived(objectionsTotal >= DUREE_OBJECTIONS_MIN);
	const conditionsRemplies = $derived(conditionsOk(conditions) && chronoOk);

	const secondes = $derived(chrono % 60);
	const chronoTexte = $derived(
		`${String(objectionsTotal).padStart(2, '0')}:${String(secondes).padStart(2, '0')}`
	);

	$effect(() => {
		if (!chronoActif) return;
		const t = setInterval(() => (chrono += 1), 1000);
		return () => clearInterval(t);
	});

	// ------------------------------------------------------ Étape 2 · regroupement
	let adresse = $state('');
	let secteur = $state('');
	let recherche = $state(false);
	let chargement = $state(false);
	let trouve = $state(false);
	let retenus = $state<string[]>([]);
	let minuteurRecherche: ReturnType<typeof setTimeout> | null = null;

	const dispo = $derived(trouve ? chantiersProches(secteur || null) : []);
	const retenusChantiers = $derived(dispo.filter((c) => retenus.includes(c.id)));
	const centre = $derived(centreDe(dispo));

	function chercher() {
		if (!adresse.trim()) return;
		chargement = true;
		trouve = false;
		retenus = [];
		// Petite latence : le temps de "chercher" dans le planning de la zone.
		minuteurRecherche = setTimeout(() => {
			secteur = secteurDe(adresse) ?? '';
			trouve = true;
			chargement = false;
		}, 520);
	}

	function choisirSecteur(nom: string) {
		adresse = `${adresse.trim() || 'Chantier'} — ${nom}`;
		secteur = nom;
		recherche = true;
		trouve = true;
		retenus = [];
	}

	function basculerChantier(id: string) {
		if (retenus.includes(id)) {
			retenus = retenus.filter((x) => x !== id);
			return;
		}
		if (retenus.length >= MAX_CHANTIERS_REGROUPES) return;
		retenus = [...retenus, id];
	}

	// ------------------------------------------------------------ Étape 3 · la DO
	let themes = $state<string[]>([]);
	let responsable = $state('');
	let signature = $state('');
	let secoue = $state(0);
	let jalon = $state(-1);
	let appelFini = $state(false);
	let minuteurAppel: ReturnType<typeof setInterval> | null = null;

	const remise = $derived(remiseDe(themes, retenus.length));
	const supervision = $derived(supervisionRequise(remise));
	const decode = $derived(opportunitePrete({ remise, valideePar: signature, responsable }));
	const effort = $derived((totalTTC * remise) / 100);

	const JALONS: { client: string; resp: string }[] = [
		{ client: 'Nom du client + ville annoncés', resp: 'Il répond de façon positive' },
		{ client: 'Ambiance positive', resp: 'Il répète mot pour mot' },
		{ client: 'Projet identifié', resp: 'Il se lève à l’annonce du prix' },
		{ client: 'Solution de financement présentée', resp: 'Attaque de vente, il tend la main' },
		{ client: 'Bagarre pour obtenir un geste', resp: 'Il rappelle pour la décision' },
		{
			client: 'Tu répètes que les clients veulent travailler avec nous',
			resp: 'Le dossier passe en DO'
		}
	];

	const ENTRE_APPELS = [
		'Dire que tu espères avoir 400-500 € — « ce serait génial ! »',
		'Demander un verre d’eau',
		'Stresser légèrement et espérer avec le client',
		'Vivre la situation : DYNAMISME, THÉÂTRE, PERSUASIF, ÉMOTION'
	];

	const ville = $derived(adresse.split('—').pop()?.trim() || secteur || '[VILLE]');
	const typeProjet = $derived(projet || '[TYPE]');

	function basculerTheme(id: string) {
		if (id === 'regroupement' && !retenus.length) return;
		themes = themes.includes(id) ? themes.filter((x) => x !== id) : [...themes, id];
	}

	function decrocher() {
		if (jalon >= 0 || !responsable.trim()) return;
		jalon = 0;
		minuteurAppel = setInterval(() => {
			if (jalon >= JALONS.length - 1) {
				if (minuteurAppel) clearInterval(minuteurAppel);
				minuteurAppel = null;
				appelFini = true;
				return;
			}
			jalon += 1;
		}, 620);
	} /**
	 * Dernier verrou : au-delà du seuil, c'est la signature du responsable qui
	 * ouvre l'étape 4 — sans elle, la carte bloque (et le mouvement le dit).
	 */
	function signer() {
		if (supervision && signature.trim().length < 2) {
			secoue += 1;
			return;
		}
		etape = 4;
	}

	// ------------------------------------------------------------- Navigation
	const prochaine = $derived(
		etape === 1 ? conditionsRemplies : etape === 2 ? retenus.length > 0 : decode
	);
	/** Étape 3 : l'appel doit être passé et le responsable nommé avant de sortir. */
	const peutContinuer = $derived(
		etape === 3 ? appelFini && responsable.trim().length > 1 : prochaine
	);
	const libelleFin = $derived(
		!appelFini
			? 'Passer l’appel d’abord'
			: !decode
				? 'Faire signer le responsable'
				: 'Créer l’opportunité'
	);

	function continuer() {
		if (etape === 3) return signer();
		if (prochaine) etape += 1;
	}

	function appliquer() {
		onValider({
			conditions: { ...conditions },
			objections: Math.round(objectionsAvant + chrono / 60),
			adresse: adresse.trim(),
			secteur,
			chantiers: [...retenus],
			themes: [...themes],
			responsable: responsable.trim(),
			remise,
			valideePar: supervision ? signature.trim() : null,
			le: Date.now()
		});
		open = false;
	}

	// Repartir d'une DO vierge à chaque ouverture, et couper les minuteurs.
	$effect(() => {
		if (open) {
			etape = 1;
			conditions = { pasPresse: false, panneau: false, discretion: false };
			objectionsAvant = 0;
			chrono = 0;
			chronoActif = false;
			adresse = adresseInitiale;
			secteur = '';
			recherche = false;
			chargement = false;
			trouve = false;
			retenus = [];
			themes = [];
			responsable = '';
			signature = '';
			jalon = -1;
			appelFini = false;
		} else {
			chronoActif = false;
			if (minuteurAppel) clearInterval(minuteurAppel);
			minuteurAppel = null;
			if (minuteurRecherche) clearTimeout(minuteurRecherche);
			minuteurRecherche = null;
		}
	});

	onDestroy(() => {
		if (minuteurAppel) clearInterval(minuteurAppel);
		if (minuteurRecherche) clearTimeout(minuteurRecherche);
	});
</script>

<Dialog bind:open>
	<DialogContent class="gap-4 sm:max-w-3xl">
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2 text-[15px]">
				<PhoneCall class="size-4 text-brand" strokeWidth={1.9} />
				DO — Demande d’Opportunité
			</DialogTitle>
			<p class="text-[11.5px] text-muted-foreground">
				Le coup de téléphone qui fait pencher la balance. La DO est obligatoire : c’est elle qui
				verrouille le RDV et fait signer en R1.
			</p>
		</DialogHeader>

		<!-- Progression -->
		<div class="flex items-center gap-1.5">
			{#each ETAPES as nom, i (nom)}
				{@const n = i + 1}
				{@const atteint = n <= etape}
				<button
					type="button"
					onclick={() => (etape = n)}
					disabled={n > etape && !prochaine}
					class="flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold transition-colors disabled:opacity-45 {n ===
					etape
						? 'bg-primary text-primary-foreground'
						: atteint
							? 'bg-brand/15 text-brand'
							: 'bg-glass-2 text-muted-foreground'}"
				>
					<span
						class="grid size-4 place-items-center rounded-full text-[9.5px] {n === etape
							? 'bg-primary-foreground/25'
							: ''}"
					>
						{atteint && n < etape ? '✓' : n}
					</span>
					<span class="hidden sm:inline">{nom}</span>
				</button>
				{#if n < ETAPES.length}
					<span class="h-px flex-1 rounded-full bg-line"></span>
				{/if}
			{/each}
		</div>

		<div class="max-h-[62vh] min-h-[22rem] space-y-3 overflow-y-auto pr-1">
			{#key etape}
				<!-- ------------------------------------------------- 1 · CONDITIONS -->
				{#if etape === 1}
					<div class="space-y-3">
						<p
							class="flex animate-in items-start gap-2 rounded-2xl border border-line bg-card2 px-3 py-2 text-[11.5px] leading-snug text-ink-soft duration-300 fade-in slide-in-from-bottom-1"
						>
							<TriangleAlert class="mt-0.5 size-3.5 shrink-0 text-ink-mute" strokeWidth={2} />
							<span>
								Aucune DO ne doit être faite tant que toutes les objections n’ont pas été traitées
								pendant au moins 1/4 d’heure — sinon elle n’a aucun impact.
							</span>
						</p>

						<div
							class="flex animate-in items-center gap-3 rounded-2xl border border-line bg-card2 px-3 py-2.5 duration-300 fade-in slide-in-from-bottom-1"
							style="animation-delay:60ms;animation-fill-mode:both"
						>
							<Anneau
								progres={Math.min(1, objectionsTotal / DUREE_OBJECTIONS_MIN)}
								taille={54}
								epaisseur={4}
								ton={chronoOk ? 'brand' : 'primary'}
							>
								<span class="text-[11px] font-bold text-ink tabular-nums">{chronoTexte}</span>
							</Anneau>
							<div class="min-w-0 flex-1">
								<p class="text-[12.5px] font-semibold text-ink">Chrono d’objections</p>
								<p class="text-[11px] text-ink-soft">
									{chronoOk
										? 'Le quart d’heure est fait : tu peux appeler.'
										: `Encore ${DUREE_OBJECTIONS_MIN - objectionsTotal} min avant l’appel.`}
								</p>
							</div>
							<div class="flex shrink-0 items-center gap-1.5">
								<label class="flex items-center gap-1 text-[11px] text-ink-soft">
									déjà
									<input
										type="number"
										min="0"
										max="60"
										bind:value={objectionsAvant}
										class="w-14 rounded-full border border-input bg-card px-2 py-0.5 text-right font-semibold text-ink tabular-nums {FOCUS_CHAMP}"
									/>
									min
								</label>
								<Button variant="outline" size="xs" onclick={() => (chronoActif = !chronoActif)}>
									<Clock strokeWidth={1.9} />
									{chronoActif ? 'Pause' : chrono ? 'Reprendre' : 'Démarrer'}
								</Button>
							</div>
						</div>

						<div class="grid gap-2 sm:grid-cols-3">
							{#each CONDITIONS as c, i (c.id)}
								{@const actif = conditions[c.id]}
								<button
									type="button"
									onclick={() => (conditions[c.id] = !conditions[c.id])}
									class="animate-in rounded-2xl border p-3 text-left transition-all duration-300 fade-in slide-in-from-bottom-2 {actif
										? CARTE_SUCCES
										: 'border-line bg-card2/60 hover:border-line-strong'}"
									style="animation-delay:{120 + i * 70}ms;animation-fill-mode:both"
								>
									<div class="flex items-center justify-between">
										<span class="text-lg">{c.emoji}</span>
										<span
											class="grid size-5 place-items-center rounded-full border transition-colors {actif
												? 'border-brand bg-brand text-white'
												: 'border-line-strong text-transparent'}"
										>
											<Check class="size-3.5" strokeWidth={3} />
										</span>
									</div>
									<p class="mt-1.5 text-[12.5px] font-semibold text-ink">{c.nom}</p>
									<p class="mt-0.5 text-[11px] leading-snug text-ink-soft">{c.aide}</p>
								</button>
							{/each}
						</div>
					</div>

					<!-- ---------------------------------------------- 2 · REGROUPEMENT -->
				{:else if etape === 2}
					<div class="space-y-3">
						<div
							class="animate-in space-y-2 rounded-2xl border border-line bg-card2 px-3 py-2.5 duration-300 fade-in slide-in-from-bottom-1"
						>
							<p class="flex items-center gap-2 text-[12.5px] font-semibold text-ink">
								<MapPin class="size-4 text-primary" strokeWidth={1.9} />
								Adresse du client
							</p>
							<div class="flex flex-wrap gap-2">
								<div class="min-w-52 flex-1">
									<AddressInput
										bind:value={adresse}
										max={6}
										placeholder="12 rue des Acacias, Tours Nord"
										onPick={() => chercher()}
										onEnter={chercher}
									/>
								</div>
								<Button size="sm" onclick={chercher} disabled={chargement || !adresse.trim()}>
									<Search class="size-3.5" strokeWidth={2} />
									{chargement ? 'Recherche…' : 'Chercher les chantiers'}
								</Button>
								{#if recherche}
									<Button
										size="sm"
										variant="outline"
										onclick={() => {
											recherche = !recherche;
										}}
									>
										{recherche ? 'Masquer' : 'Chantiers de la zone'}
									</Button>
								{/if}
							</div>
							<p class="text-[11px] text-ink-soft">
								Regrouper les poses du secteur fait baisser le prix : un seul déplacement au lieu de {retenus.length ||
									2}.
							</p>
						</div>

						{#if chargement}
							<div class="flex items-center gap-2 px-1 py-6 text-[12px] text-ink-soft">
								<Sparkles class="size-4 animate-pulse text-primary" strokeWidth={1.9} />
								Scan du planning de la zone…
							</div>
						{:else if trouve}
							{#if !secteur}
								<div
									class="animate-in space-y-2 rounded-2xl border border-line bg-card2 px-3 py-2.5 duration-300 fade-in slide-in-from-bottom-1"
								>
									<p class="text-[12px] text-ink-soft">
										Adresse hors des secteurs connus. Choisis le secteur du chantier :
									</p>
									<div class="flex flex-wrap gap-1.5">
										{#each SECTEURS as s (s.nom)}
											<button
												type="button"
												onclick={() => choisirSecteur(s.nom)}
												class="rounded-full border border-line bg-base px-2.5 py-1 text-[11px] font-medium text-ink-soft transition-colors hover:border-brand/50 hover:text-ink"
											>
												{s.nom}
											</button>
										{/each}
									</div>
								</div>
							{:else}
								<div class="flex flex-wrap items-center gap-2">
									<span
										class="flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-semibold text-primary"
									>
										<Route class="size-3.5" strokeWidth={2} /> Secteur {secteur}
									</span>
									<span class="text-[11px] text-ink-soft">
										{dispo.length} chantier{dispo.length > 1 ? 's prévus' : ' prévu'} · {retenus.length}/{MAX_CHANTIERS_REGROUPES}
										regroupés
									</span>
								</div>

								<CarteChantiers
									chantiers={dispo}
									{retenus}
									{adresse}
									{centre}
									onBasculer={basculerChantier}
								/>

								<div class="grid gap-1.5 sm:grid-cols-2">
									{#each dispo as c, i (c.id)}
										{@const rond = rondDeDate(c)}
										{@const pris = retenus.includes(c.id)}
										<button
											type="button"
											onclick={() => basculerChantier(c.id)}
											class="flex animate-in items-center gap-2.5 rounded-2xl border p-2.5 text-left transition-all duration-300 fade-in slide-in-from-bottom-2 {pris
												? 'border-brand bg-brand/10'
												: 'border-line bg-card2/60 hover:border-line-strong'}"
											style="animation-delay:{i * 55}ms;animation-fill-mode:both"
										>
											<Anneau
												progres={rond.arc}
												taille={46}
												epaisseur={3}
												ton={pris
													? 'primary'
													: rond.arc > 0.65
														? 'brand'
														: rond.arc > 0.3
															? 'brand-soft'
															: 'muted'}
											>
												<span class="text-center leading-none">
													<span class="block text-[12px] font-bold text-ink">{rond.jour}</span>
													<span class="block text-[8px] font-semibold text-ink-mute"
														>{rond.mois}</span
													>
												</span>
											</Anneau>
											<span class="min-w-0 flex-1">
												<span class="block truncate text-[12px] font-semibold text-ink"
													>{c.client}</span
												>
												<span class="block truncate text-[10.5px] text-ink-soft">{c.projet}</span>
												<span class="mt-0.5 block text-[10px] text-ink-mute">
													{c.commune} · dans {rond.jours} j
												</span>
											</span>
											{#if pris}
												<BadgeCheck class="size-4 shrink-0 {TEXTE_SUCCES}" strokeWidth={2} />
											{/if}
										</button>
									{/each}
								</div>

								{#if retenusChantiers.length}
									<div
										class="animate-in rounded-2xl border {CARTE_SUCCES} px-3 py-2.5 duration-300 fade-in slide-in-from-bottom-1"
									>
										<p class="text-[12px] font-semibold text-ink">
											Tournée regroupée · {retenusChantiers.length} chantier{retenusChantiers.length >
											1
												? 's'
												: ''} sur la même route
										</p>
										<div class="mt-2 flex items-center gap-0 overflow-x-auto pb-1">
											{#each retenusChantiers as c, i (c.id)}
												{@const rond = rondDeDate(c)}
												{#if i > 0}
													<span
														class="mx-1 h-px w-5 shrink-0 border-t border-dashed border-brand/50"
													></span>
												{/if}
												<div class="flex shrink-0 flex-col items-center gap-1">
													<Anneau progres={rond.arc} taille={40} epaisseur={3} ton="brand">
														<span class="text-[11px] font-bold text-ink">{rond.jour}</span>
													</Anneau>
													<span class="max-w-16 truncate text-[9.5px] text-ink-mute"
														>{c.client.split(' ').pop()}</span
													>
												</div>
											{/each}
										</div>
										<p class="mt-1 text-[11px] font-semibold {TEXTE_SUCCES}">
											+{REMISE_PAR_CHANTIER * retenusChantiers.length} % de remise à négocier
										</p>
									</div>
								{/if}
							{/if}
						{/if}
					</div>

					<!-- ---------------------------------------------------- 3 · L'APPEL -->
				{:else if etape === 3}
					<div class="space-y-3">
						<div
							class="animate-in rounded-2xl border border-line bg-card2 px-3 py-2.5 duration-300 fade-in slide-in-from-bottom-1"
						>
							<p class="text-[11px] font-semibold tracking-wide text-ink-mute uppercase">
								Script du vendeur
							</p>
							<p class="mt-1.5 text-[12px] leading-relaxed text-ink italic">
								« Bonjour {responsable.trim() || '[Responsable]'}, je ne vous dérange pas ? Je vous
								appelle car je suis chez M. X à {ville}, on est sur un projet {typeProjet} avec un transfert
								de charge à hauteur de [X €/mois]. Les clients sont prêts à nous faire travailler, mais
								la seule chose qui les fait hésiter c’est le prix. Je voulais voir avec vous s’il est
								possible de faire quelque chose pour eux ? »
							</p>
							<div class="mt-2 flex flex-wrap gap-1.5">
								{#each ENTRE_APPELS as a (a)}
									<span
										class="rounded-full bg-glass-2 px-2 py-0.5 text-[10.5px] font-medium text-ink-soft"
										>{a}</span
									>
								{/each}
							</div>
						</div>

						<div class="grid gap-2 sm:grid-cols-2">
							<label class="space-y-1">
								<span class="text-[11px] font-semibold text-ink-soft">Responsable appelé</span>
								<input
									bind:value={responsable}
									placeholder="Nom du responsable"
									class="h-11 w-full rounded-full border border-input bg-card px-5 text-[15px] text-ink placeholder:text-ink-mute {FOCUS_CHAMP}"
								/>
							</label>
							<div class="space-y-1">
								<span class="text-[11px] font-semibold text-ink-soft">Ce que tu demandes</span>
								<div
									class="flex h-11 items-center gap-2 rounded-full border border-line bg-card2 px-5"
								>
									<span class="text-[15px] font-bold text-brand tabular-nums">−{remise} %</span>
									<span class="text-[11px] text-ink-soft">
										soit {euro.format(effort)} pour le client
									</span>
								</div>
							</div>
						</div>

						<div class="space-y-1.5">
							<p class="text-[11px] font-semibold tracking-wide text-ink-mute uppercase">
								Thèmes de DO — la monnaie d’échange
							</p>
							<div class="flex flex-wrap gap-1.5">
								{#each THEMES as t, i (t.id)}
									{@const actif = themes.includes(t.id)}
									{@const bloque = t.id === 'regroupement' && !retenus.length}
									<button
										type="button"
										onclick={() => basculerTheme(t.id)}
										disabled={bloque}
										title={t.aide}
										class="flex animate-in items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11.5px] font-medium transition-colors duration-300 zoom-in-95 fade-in disabled:opacity-40 {actif
											? 'border-brand bg-brand/15 text-brand'
											: 'border-line bg-card2 text-ink-soft hover:border-line-strong hover:text-ink'}"
										style="animation-delay:{i * 45}ms;animation-fill-mode:both"
									>
										<span>{t.emoji}</span>
										{t.nom}
										<span class="tabular-nums {actif ? 'font-bold' : 'text-ink-mute'}">
											{t.id === 'regroupement'
												? `+${REMISE_PAR_CHANTIER * retenus.length} %`
												: `+${t.remise} %`}
										</span>
									</button>
								{/each}
							</div>
						</div>

						<div class="rounded-2xl border border-line bg-card2 px-3 py-2.5">
							<div class="flex items-center justify-between text-[12px]">
								<span class="font-semibold text-ink">Remise négociée</span>
								<span class="font-bold text-brand tabular-nums">{remise} %</span>
							</div>
							<div class="relative mt-2 h-2 overflow-hidden rounded-full bg-glass-3">
								<div
									class="h-full rounded-full transition-all duration-500 {supervision
										? 'bg-destructive'
										: 'bg-brand'}"
									style="width:{Math.min(100, (remise / 40) * 100)}%"
								></div>
								<span
									class="absolute inset-y-0 w-px bg-foreground/50"
									style="left:{(SEUIL_SUPERVISION / 40) * 100}%"
									title="Seuil de supervision : {SEUIL_SUPERVISION} %"
								></span>
							</div>
							<p class="mt-1.5 text-[11px] text-ink-soft">
								{supervision
									? `Au-delà de ${SEUIL_SUPERVISION} %, la remise sort de ton périmètre : le responsable doit l’assumer.`
									: `Le technicien conseil peut engager jusqu’à ${SEUIL_SUPERVISION - 1} % ; au-delà, un responsable doit valider.`}
							</p>
						</div>

						{#if appelFini}
							<div
								class="flex h-11 items-center justify-center gap-2 rounded-full border {CARTE_SUCCES} text-[13px] font-bold tracking-[0.07em] uppercase {TEXTE_SUCCES}"
							>
								<Check class="size-4" strokeWidth={2.6} />
								Appel terminé
							</div>
						{:else}
							<Button
								onclick={decrocher}
								disabled={!responsable.trim() || jalon >= 0}
								class="w-full"
							>
								<PhoneCall class="size-4" strokeWidth={1.9} />
								{jalon < 0 ? 'Décrocher' : 'Appel en cours…'}
							</Button>
						{/if}

						{#if jalon >= 0}
							<div class="space-y-1.5">
								{#each JALONS as j, i (j.client)}
									{@const atteint = i <= jalon}
									<div
										class="flex items-start gap-2.5 rounded-2xl border px-2.5 py-1.5 text-[11.5px] transition-all duration-300 {atteint
											? 'border-brand/45 bg-brand/10 opacity-100'
											: 'border-line bg-card2/40 opacity-35'}"
									>
										<span
											class="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full text-[9px] font-bold {atteint
												? SUCCES_PLEIN
												: 'bg-glass-3 text-ink-mute'}"
										>
											{i + 1}
										</span>
										<span class="min-w-0 flex-1">
											<span class="block text-ink">{j.client}</span>
											<span class="block text-[10.5px] text-ink-mute">→ {j.resp}</span>
										</span>
									</div>
								{/each}
							</div>
						{/if}

						{#if appelFini}
							{#if supervision}
								{#key secoue}
									<div
										class="animate-in rounded-2xl border {CARTE_ALERTE} px-3 py-2.5 duration-300 fade-in slide-in-from-bottom-2 {secoue >
										0
											? 'secouer'
											: ''}"
									>
										<p class="flex items-center gap-2 text-[12.5px] font-bold {TEXTE_ALERTE}">
											<Lock class="size-4" strokeWidth={2.2} />
											{remise} % — au-delà du périmètre du technicien conseil
										</p>
										<p class="mt-1 text-[11.5px] leading-snug text-ink-soft">
											Aucune remise ne peut être décidée par le technicien conseil. Pour débloquer,
											le responsable doit signer la remise de son nom.
										</p>
										<input
											bind:value={signature}
											placeholder="Nom du responsable qui assume la remise"
											class="mt-2 h-11 w-full rounded-full border border-destructive/45 bg-card px-5 text-[15px] text-ink transition-[border-color,box-shadow] outline-none placeholder:text-ink-mute focus-visible:border-destructive focus-visible:ring-4 focus-visible:ring-destructive/15"
										/>
										{#if signature.trim().length < 2}
											<p class="mt-1 flex items-center gap-1 text-[10.5px] {TEXTE_ALERTE}">
												<TriangleAlert class="size-3" strokeWidth={2.2} /> Signature manquante : la remise
												reste bloquée.
											</p>
										{:else}
											<p
												class="mt-1 flex items-center gap-1 text-[10.5px] font-semibold {TEXTE_SUCCES}"
											>
												<LockOpen class="size-3" strokeWidth={2.2} /> Signature posée — la remise peut
												être engagée.
											</p>
										{/if}
									</div>
								{/key}
							{:else}
								<div
									class="animate-in rounded-2xl border {CARTE_SUCCES} px-3 py-2.5 duration-300 fade-in slide-in-from-bottom-2"
								>
									<p class="flex items-center gap-2 text-[12.5px] font-bold {TEXTE_SUCCES}">
										<ShieldCheck class="size-4" strokeWidth={2.2} />
										{remise} % — dans ton périmètre
									</p>
									<p class="mt-1 text-[11.5px] leading-snug text-ink-soft">
										Le responsable a donné son accord : le geste commercial peut être engagé au nom
										de {responsable.trim()}.
									</p>
								</div>
							{/if}
						{/if}
					</div>

					<!-- -------------------------------------------------- 4 · OPPORTUNITÉ -->
				{:else}
					<div class="space-y-3">
						<div class="flex items-center gap-3">
							<span
								class="tampon grid size-14 shrink-0 place-items-center rounded-2xl border-2 border-brand text-[15px] font-black text-brand"
							>
								DO
							</span>
							<div class="min-w-0 flex-1">
								<p class="flex items-center gap-1.5 text-[13.5px] font-bold text-ink">
									<PartyPopper class="size-4 text-brand" strokeWidth={1.9} />
									Opportunité créée · −{remise} %
								</p>
								<p class="text-[11.5px] text-ink-soft">
									{adresse.trim() || 'Adresse non renseignée'}
								</p>
							</div>
						</div>

						<div class="grid gap-2 sm:grid-cols-3">
							<div class="rounded-2xl border border-line bg-card2 px-3 py-2">
								<p class="text-[10.5px] font-semibold tracking-wide text-ink-mute uppercase">
									Conditions
								</p>
								<ul class="mt-1 space-y-0.5 text-[11.5px] text-ink-soft">
									{#each CONDITIONS as c (c.id)}
										<li class="flex items-center gap-1.5">
											<Check class="size-3 {TEXTE_SUCCES}" strokeWidth={3} />
											{c.nom}
										</li>
									{/each}
									<li class="flex items-center gap-1.5">
										<Clock class="size-3 {TEXTE_SUCCES}" strokeWidth={2.6} />
										{DUREE_OBJECTIONS_MIN} min d’objections
									</li>
								</ul>
							</div>
							<div class="rounded-2xl border border-line bg-card2 px-3 py-2">
								<p class="text-[10.5px] font-semibold tracking-wide text-ink-mute uppercase">
									Regroupement
								</p>
								<p class="mt-1 flex items-center gap-1.5 text-[11.5px] text-ink-soft">
									<Route class="size-3.5 text-primary" strokeWidth={2} />
									{retenusChantiers.length} chantier{retenusChantiers.length > 1 ? 's' : ''} ·
									{secteur || '—'}
								</p>
								<ul class="mt-1 space-y-0.5 text-[11px] text-ink-mute">
									{#each retenusChantiers as c (c.id)}
										<li class="flex items-center gap-1.5">
											<CalendarDays class="size-3" strokeWidth={2} />
											{rondDeDate(c).jour}
											{rondDeDate(c).mois} — {c.client}
										</li>
									{/each}
								</ul>
							</div>
							<div class="rounded-2xl border border-line bg-card2 px-3 py-2">
								<p class="text-[10.5px] font-semibold tracking-wide text-ink-mute uppercase">
									Contreparties
								</p>
								<ul class="mt-1 space-y-0.5 text-[11.5px] text-ink-soft">
									{#each THEMES.filter((t) => themes.includes(t.id)) as t (t.id)}
										<li class="flex items-center gap-1.5">
											<span>{t.emoji}</span>
											{t.nom}
										</li>
									{/each}
								</ul>
							</div>
						</div>

						<div class="rounded-2xl border border-line bg-card2 px-3 py-2.5">
							<div class="flex items-center justify-between text-[12px]">
								<span class="text-ink-soft">Nouveau total pour le client</span>
								<span class="font-bold text-ink tabular-nums">
									{euro.format(totalTTC * (1 - remise / 100))} TTC
								</span>
							</div>
							<div class="mt-0.5 flex items-center justify-between text-[11px]">
								<span class="text-ink-mute">Geste commercial</span>
								<span class="font-semibold text-primary tabular-nums">−{euro.format(effort)}</span>
							</div>
						</div>

						<p
							class="flex items-start gap-2 rounded-2xl border border-line bg-card2/60 px-2.5 py-2 text-[11px] leading-snug text-ink-soft"
						>
							<ShieldCheck class="mt-0.5 size-3.5 shrink-0 text-primary" strokeWidth={2} />
							<span>
								Rappel : aucune remise ou offre de prix ne peut être décidée par le technicien
								conseil. Elle doit être validée par un responsable hiérarchique —
								{supervision
									? `${signature.trim()} l’assume.`
									: `${responsable.trim()} l’a accordée.`}
							</span>
						</p>
					</div>
				{/if}
			{/key}
		</div>

		<DialogFooter class="gap-2">
			{#if etape > 1}
				<Button variant="outline" onclick={() => (etape -= 1)}>
					<ArrowLeft class="size-4" strokeWidth={2} /> Retour
				</Button>
			{/if}
			{#if etape < 4}
				<Button onclick={continuer} disabled={!peutContinuer}>
					{etape === 3 ? libelleFin : 'Continuer'}
					<ArrowRight class="size-4" strokeWidth={2} />
				</Button>
			{:else}
				<Button onclick={appliquer}>
					<BadgeCheck class="size-4" strokeWidth={2} />
					Appliquer −{remise} % au devis
				</Button>
			{/if}
		</DialogFooter>
	</DialogContent>
</Dialog>

<style>
	/* Secousse quand on tente de signer sans nom : rappelle que le blocage tient. */
	@keyframes secouer {
		0%,
		100% {
			transform: translateX(0);
		}
		20% {
			transform: translateX(-5px);
		}
		40% {
			transform: translateX(5px);
		}
		60% {
			transform: translateX(-3px);
		}
		80% {
			transform: translateX(3px);
		}
	}
	.secouer {
		animation: secouer 420ms ease-in-out;
	}

	/* Le tampon DO s'applique sur l'opportunité créée. */
	@keyframes tampon {
		0% {
			transform: scale(1.7) rotate(-14deg);
			opacity: 0;
		}
		60% {
			transform: scale(0.95) rotate(-4deg);
			opacity: 1;
		}
		100% {
			transform: scale(1) rotate(-3deg);
			opacity: 1;
		}
	}
	.tampon {
		animation: tampon 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
	}
</style>
