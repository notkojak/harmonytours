<script lang="ts">
	import {
		ArrowLeft,
		CircleCheck,
		Percent,
		Plus,
		Search,
		Sparkles,
		TriangleAlert,
		X
	} from '@lucide/svelte';
	import {
		chiffrer,
		cotesMedianes,
		estInclus,
		FAMILLE_BY_ID,
		FAMILLES,
		familleDeGrille,
		grillesVendables,
		nombre,
		optionsDeArticle,
		prixMiniGrille,
		produitsDeFamille,
		sectionDe,
		sectionsDoptions,
		TVA_ALERTE,
		TVA_COURT,
		TVA_LABEL,
		TVA_RECAP,
		euro,
		euro0,
		type Article,
		type LigneDevis,
		type OptionTarif
	} from '$lib/data/book';
	import { onMount } from 'svelte';
	import GrillePicker from '$lib/components/chiffrage/GrillePicker.svelte';
	import PanneauDevis from '$lib/components/chiffrage/PanneauDevis.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { FOCUS_CHAMP } from '$lib/chiffrage-style';
	import { chargerDevis, prochainNumeroLigne, sauverDevis } from '$lib/devis-local';
	import type { Opportunite } from '$lib/data/opportunite';

	// ---------------------------------------------------------------- Articles
	// Un article du book est soit un forfait du catalogue (prix affiché), soit
	// une grille (prix lu au couple hauteur × largeur). Le type vient du moteur.
	type Entree = { famille: string; article: Article; libelle: string; extra: string };

	const TOUS: Entree[] = FAMILLES.flatMap((f) => [
		...produitsDeFamille(f.id).map((p): Entree => ({
			famille: f.id,
			article: { kind: 'produit', p },
			libelle: p.nom,
			extra: `${p.categorie} · ${p.detail ?? ''}`
		})),
		...grillesVendables(f.id).map((g): Entree => ({
			famille: f.id,
			article: { kind: 'grille', g },
			libelle: g.nom,
			extra: `${g.categorie} · ${g.notes ?? ''}`
		}))
	]);

	const prixAffiche = (a: Article) =>
		a.kind === 'grille'
			? `dès ${euro0.format(prixMiniGrille(a.g))}`
			: a.p.unite === 'u'
				? euro0.format(a.p.prixHT)
				: `${euro0.format(a.p.prixHT)} / ${a.p.unite === 'm2' ? 'm²' : 'ml'}`;

	// ------------------------------------------------------------ État écran
	let familleId = $state<string | null>(null);
	let article = $state<Article | null>(null);
	let query = $state('');

	let h = $state(0);
	let l = $state(0);
	let choix = $state<string[]>([]);
	let qte = $state(1);
	let imposteH = $state(600);
	let carreaux = $state(4);
	let vantauxForce = $state<number | null>(null);

	let lignes = $state<LigneDevis[]>([]);
	// Le book s'annonce en prix HT sans remise : la remise commerciale se décide
	// après, jamais par défaut.
	let remise = $state(0);
	// La DO validée : c'est elle qui porte la remise, jamais une saisie directe.
	let opportunite = $state<Opportunite | null>(null);
	let flash = $state<string | null>(null);
	let compteur = 0;
	// Le devis est relu depuis l'appareil une fois l'hydratation faite (jamais au
	// rendu serveur) : tant qu'il ne l'est pas, on n'écrit rien dans le stockage
	// pour ne pas écraser un panier existant avec le devis vide du premier rendu.
	let devisRepris = $state(false);

	onMount(() => {
		const sauve = chargerDevis();
		if (sauve) {
			lignes = sauve.lignes;
			remise = sauve.remise;
			opportunite = sauve.opportunite;
			compteur = prochainNumeroLigne(sauve.lignes);
		}
		devisRepris = true;
	});

	// Toute modification du panier (ajout, quantité, suppression, remise) est
	// aussitôt conservée : vider le devis efface la sauvegarde.
	$effect(() => {
		if (!devisRepris) return;
		sauverDevis(lignes, remise, opportunite);
	});

	const famille = $derived(familleId ? (FAMILLE_BY_ID.get(familleId) ?? null) : null);
	const grille = $derived(article?.kind === 'grille' ? article.g : null);
	const produit = $derived(article?.kind === 'produit' ? article.p : null);

	const libH = $derived(
		new Map<number, string | undefined>(grille ? grille.lignes.map((x) => [x.d.v, x.d.l]) : [])
	);
	const libL = $derived(
		new Map<number, string | undefined>(grille ? grille.cols.map((c) => [c.v, c.l]) : [])
	);
	const coteH = $derived(grille ? (libH.get(h) ?? `${nombre.format(h)} mm`) : '');
	const coteL = $derived(grille ? (libL.get(l) ?? `${nombre.format(l)} mm`) : '');

	const resultats = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (q.length < 2) return [];
		return TOUS.filter(
			(e) =>
				e.libelle.toLowerCase().includes(q) ||
				e.extra.toLowerCase().includes(q) ||
				(FAMILLE_BY_ID.get(e.famille)?.nom ?? '').toLowerCase().includes(q)
		).slice(0, 10);
	});

	// ------------------------------------------------- Moteur de chiffrage
	// Toutes les règles du book (grille, barèmes de traverse, options, TVA)
	// vivent dans le moteur : l'écran ne fait que lui donner les cotes saisies et
	// les options cochées.
	const optionsDispo = $derived(article ? optionsDeArticle(article) : []);
	const sections = $derived(sectionsDoptions(optionsDispo));

	const chiffrage = $derived(
		article ? chiffrer({ article, h, l, qte, choix, imposteH, carreaux, vantauxForce }) : null
	);

	const montantPlusValue = (o: OptionTarif) => chiffrage?.plusValues.get(o.id) ?? null;
	const nbVantaux = $derived(chiffrage?.vantaux ?? 1);
	const prixUnitaire = $derived(chiffrage?.calcul ?? null);
	const tva = $derived(chiffrage?.tva ?? 0.055);
	const page = $derived(chiffrage?.page);

	// Une plus-value de dimension peut sortir de la grille après un changement de
	// cote (moustiquaire d'un volet trop large, imposte hors barème) : on la retire
	// pour ne jamais facturer un montant inventé.
	$effect(() => {
		const mortes = [...(chiffrage?.plusValues ?? [])]
			.filter(([, m]) => m == null)
			.map(([id]) => id);
		if (mortes.some((id) => choix.includes(id))) {
			choix = choix.filter((id) => !mortes.includes(id));
		}
	});

	function basculer(o: OptionTarif) {
		if (estInclus(o)) return;
		if (choix.includes(o.id)) {
			choix = choix.filter((x) => x !== o.id);
			return;
		}
		if (sectionDe(o).exclusif) {
			const ids = optionsDispo.filter((x) => sectionDe(x).id === sectionDe(o).id).map((x) => x.id);
			choix = [...choix.filter((x) => !ids.includes(x)), o.id];
			return;
		}
		choix = [...choix, o.id];
	}

	const nomCourt = (o: OptionTarif) =>
		o.nom.replace(/^(Fenêtre (PVC|ALU)|Volet|Plus-value)\s*[—·-]\s*/, '').trim();

	function effetOption(o: OptionTarif) {
		switch (o.type) {
			case 'pct':
				return `+${Math.round(o.valeur * 100)} %`;
			case 'coef':
				return `× ${o.valeur.toLocaleString('fr-FR')}`;
			case 'eur':
				return `+${euro0.format(o.valeur)}`;
			case 'eur_m2':
				return `+${euro0.format(o.valeur)}/m²`;
			case 'eur_ml':
				return `+${euro0.format(o.valeur)}/ml`;
			case 'eur_vantail':
				return `+${euro0.format(o.valeur)}/vantail`;
			case 'eur_carrea':
				return `+${euro0.format(o.valeur)}/carreau`;
			case 'grille': {
				const m = montantPlusValue(o);
				return m == null ? 'hors grille' : `+${euro0.format(m)}`;
			}
			default:
				return 'inclus';
		}
	}

	// ---------------------------------------------------------- Parcours écran
	function choisirFamille(id: string) {
		familleId = id;
		article = null;
		query = '';
	}

	function retourGammes() {
		familleId = null;
		article = null;
	}

	/**
	 * Un seul bouton retour, qui remonte le parcours d'un cran : d'un article vers
	 * la liste des modèles, puis de la liste vers le choix des gammes.
	 */
	function retour() {
		if (article) {
			article = null;
			return;
		}
		retourGammes();
	}

	function familleDe(art: Article): string | null {
		return art.kind === 'grille' ? familleDeGrille(art.g.id) : art.p.famille;
	}

	function ouvrir(art: Article, fam?: string) {
		familleId = fam ?? familleDe(art);
		article = art;
		choix = [];
		query = '';
		vantauxForce = null;
		carreaux = 4;
		imposteH = 600;
		if (art.kind === 'grille') {
			const c = cotesMedianes(art.g);
			h = c.h;
			l = c.l;
			qte = 1;
		} else {
			qte = art.p.unite === 'u' ? 1 : art.p.unite === 'm2' ? 10 : 5;
		}
	}

	/** Modèles d'une famille, regroupés par catégorie du book. */
	const articlesFamille = $derived.by(() => {
		if (!famille) return [] as [string, Article[]][];
		const groupes: [string, Article[]][] = [];
		const push = (cat: string, a: Article) => {
			const groupe = groupes.find((x) => x[0] === cat);
			if (groupe) groupe[1].push(a);
			else groupes.push([cat, [a]]);
		};
		for (const p of produitsDeFamille(famille.id)) push(p.categorie, { kind: 'produit', p });
		for (const g of grillesVendables(famille.id)) push(g.categorie, { kind: 'grille', g });
		return groupes;
	});

	const designation = $derived.by(() => {
		if (grille) return `${grille.nom} — H ${coteH} × L ${coteL}`;
		if (produit) return produit.nom;
		return '';
	});

	const detailLigne = $derived.by(() => {
		const parts: string[] = [];
		const opts = (chiffrage?.retenues ?? []).map((r) => nomCourt(r.option));
		if (opts.length) parts.push(opts.join(' · '));
		parts.push(TVA_LABEL[tva]);
		return parts.join(' · ');
	});

	function ajouter() {
		if (!article || prixUnitaire == null) return;
		const uid = `l${compteur++}`;
		lignes = [
			...lignes,
			{
				uid,
				ref: grille ? grille.id : (produit?.id ?? ''),
				designation,
				detail: detailLigne,
				prixUnitaireHT: prixUnitaire.total,
				quantite: qte,
				unite: grille ? 'u' : (produit?.unite ?? 'u'),
				tva,
				page
			}
		];
		flash = uid;
		setTimeout(() => {
			if (flash === uid) flash = null;
		}, 1400);
	}

	function majQte(uid: string, q: number) {
		if (q <= 0) {
			supprimer(uid);
			return;
		}
		lignes = lignes.map((x) => (x.uid === uid ? { ...x, quantite: q } : x));
	}
	function supprimer(uid: string) {
		lignes = lignes.filter((x) => x.uid !== uid);
	}

	const totalTTC = $derived(
		lignes.reduce((s, x) => s + x.prixUnitaireHT * x.quantite * (1 + x.tva) * (1 - remise / 100), 0)
	);
</script>

<div class="mx-auto max-w-6xl space-y-4">
	<!-- En-tête -->
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div class="flex items-center gap-2.5">
			<span
				class="grid size-9 place-items-center rounded-full border border-brand/20 bg-brand/10 text-brand"
			>
				<Sparkles class="size-4.5" strokeWidth={1.7} />
			</span>
			<div>
				<h1 class="text-[17px] font-bold text-foreground">Chiffrage</h1>
				<p class="text-[12.5px] text-muted-foreground">
					Book tarifaire 2026 · prix HT à l'annonce, fourniture et pose comprises
				</p>
			</div>
		</div>
		{#if lignes.length}
			<div class="flex items-center gap-2 rounded-full border border-line bg-card2 px-3.5 py-1.5">
				<span class="text-[11px] font-medium text-muted-foreground">Devis</span>
				<span class="text-[13px] font-bold text-brand tabular-nums"
					>{euro.format(totalTTC)} TTC</span
				>
			</div>
		{/if}
	</div>

	<div class="grid gap-4 lg:grid-cols-[1fr_360px]">
		<!-- Parcours -->
		<div class="min-w-0 space-y-3">
			<!-- Recherche -->
			<div class="relative">
				<div
					class="flex h-11 items-center gap-2.5 rounded-full border border-input bg-card px-5 transition-[border-color,box-shadow] focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15"
				>
					<Search class="size-4 shrink-0 text-ink-mute" strokeWidth={1.7} />
					<input
						type="search"
						placeholder="Rechercher : fenêtre PVC, PAC 10 kW, volet 41, pergola…"
						bind:value={query}
						class="h-full w-full bg-transparent text-[15px] text-foreground outline-none placeholder:text-ink-mute [&::-webkit-search-cancel-button]:hidden"
					/>
					{#if query}
						<button
							type="button"
							onclick={() => (query = '')}
							class="shrink-0 rounded-full p-1 text-ink-mute transition-colors hover:text-ink"
						>
							<X class="size-3.5" strokeWidth={2} />
						</button>
					{/if}
				</div>
				{#if query.trim().length >= 2}
					<div
						class="absolute inset-x-0 top-12 z-30 max-h-80 overflow-y-auto rounded-2xl border border-line bg-popover p-1.5 shadow-[var(--ombre-forte)]"
					>
						{#each resultats as r (r.famille + r.libelle)}
							<button
								type="button"
								onclick={() => ouvrir(r.article, r.famille)}
								class="flex w-full items-center gap-3 rounded-full px-3 py-2 text-left transition-colors hover:bg-glass-3"
							>
								<span class="text-base">{FAMILLE_BY_ID.get(r.famille)?.emoji}</span>
								<span class="min-w-0 flex-1">
									<span class="block truncate text-[12.5px] font-medium text-foreground"
										>{r.libelle}</span
									>
									<span class="block truncate text-[10.5px] text-muted-foreground">
										{FAMILLE_BY_ID.get(r.famille)?.nom} · {r.extra}
									</span>
								</span>
								<span class="shrink-0 text-[11.5px] font-bold text-foreground"
									>{prixAffiche(r.article)}</span
								>
							</button>
						{/each}
						{#if resultats.length === 0}
							<p class="px-3 py-4 text-center text-[12px] text-muted-foreground">
								Rien dans le book à ce nom.
							</p>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Étape 1 : la gamme -->
			{#if !famille}
				<div class="space-y-2">
					<p
						class="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
					>
						<span
							class="grid size-4.5 place-items-center rounded-full bg-brand/10 text-[9.5px] text-brand"
							>1</span
						>
						Choisis la gamme
					</p>
					<div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
						{#each FAMILLES as f (f.id)}
							{@const n = produitsDeFamille(f.id).length + grillesVendables(f.id).length}
							<button
								type="button"
								onclick={() => choisirFamille(f.id)}
								disabled={n === 0}
								class="group flex items-start gap-3 rounded-2xl border border-line bg-card2/60 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-brand/50 hover:bg-glass-2 disabled:opacity-40"
							>
								<span class="text-xl leading-none">{f.emoji}</span>
								<span class="min-w-0 flex-1">
									<span class="block text-[13px] leading-snug font-semibold text-foreground"
										>{f.nom}</span
									>
									<span class="mt-0.5 block text-[11px] leading-snug text-muted-foreground"
										>{f.accroche}</span
									>
								</span>
								<span
									class="shrink-0 rounded-full bg-glass-3 px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground"
								>
									{n}
								</span>
							</button>
						{/each}
					</div>
				</div>
			{:else}
				<!-- Fil d'ariane + modèles -->
				<div class="flex flex-wrap items-center gap-2">
					<Button
						variant="outline"
						size="xs"
						onclick={retour}
						title={article ? 'Revenir à la liste des modèles' : 'Revenir au choix des gammes'}
					>
						<ArrowLeft class="size-3" strokeWidth={2} /> Retour
					</Button>
					<span
						class="flex items-center gap-1.5 rounded-full bg-glass-2 px-3 py-1.5 text-[11.5px] font-semibold text-foreground"
					>
						{famille.emoji}
						{famille.nom}
					</span>
				</div>
			{/if}

			{#if famille && !article}
				<div class="space-y-3">
					<p
						class="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
					>
						<span
							class="grid size-4.5 place-items-center rounded-full bg-brand/10 text-[9.5px] text-brand"
							>2</span
						>
						Choisis le modèle
					</p>
					{#each articlesFamille as [cat, arts] (cat)}
						<div class="space-y-1.5">
							<p class="text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">
								{cat}
							</p>
							<div class="grid gap-1.5 sm:grid-cols-2">
								{#each arts as a (a.kind === 'grille' ? a.g.id : a.p.id)}
									<button
										type="button"
										onclick={() => ouvrir(a, famille.id)}
										class="flex items-center gap-3 rounded-2xl border border-line bg-card2/60 px-3 py-2.5 text-left transition-all hover:border-brand/50 hover:bg-glass-2"
									>
										<span class="min-w-0 flex-1">
											<span class="block text-[12.5px] leading-snug font-semibold text-foreground">
												{a.kind === 'grille' ? a.g.nom : a.p.nom}
											</span>
											{#if a.kind === 'produit' && a.p.detail}
												<span
													class="mt-0.5 line-clamp-2 block text-[10.5px] leading-snug text-muted-foreground"
												>
													{a.p.detail}
												</span>
											{:else if a.kind === 'grille' && a.g.notes}
												<span
													class="mt-0.5 line-clamp-2 block text-[10.5px] leading-snug text-muted-foreground"
												>
													{a.g.notes}
												</span>
											{/if}
										</span>
										<span class="shrink-0 text-right">
											<span class="block text-[12px] font-bold text-foreground tabular-nums"
												>{prixAffiche(a)}</span
											>
											<span class="block text-[9.5px] font-semibold text-muted-foreground">
												{TVA_COURT[a.kind === 'grille' ? a.g.tva : a.p.tva]}
											</span>
										</span>
									</button>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			{/if}

			{#if article}
				<!-- Étape 3 : cotes -->
				<div class="space-y-2 rounded-2xl border border-line bg-card p-3.5">
					<p
						class="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
					>
						<span
							class="grid size-4.5 place-items-center rounded-full bg-brand/10 text-[9.5px] text-brand"
							>3</span
						>
						{grille ? 'Règle les cotes' : 'Règle la quantité'}
					</p>

					{#if grille}
						<GrillePicker {grille} bind:h bind:l />
					{/if}

					{#if produit}
						{#if produit.detail}
							<p
								class="rounded-2xl bg-card2 px-3.5 py-2.5 text-[11.5px] leading-snug text-ink-soft"
							>
								{produit.detail}
							</p>
						{/if}
						<div class="flex flex-wrap items-center gap-3">
							<div
								class="flex items-center gap-1 rounded-full border border-line bg-card2 p-0.5 transition-[border-color,box-shadow] focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15"
							>
								<button
									type="button"
									onclick={() => (qte = Math.max(0.5, qte - (produit.unite === 'u' ? 1 : 0.5)))}
									class="grid size-7 place-items-center rounded-full text-ink-soft transition-colors hover:bg-glass-3 hover:text-ink"
								>
									−
								</button>
								<input
									type="number"
									min="0.5"
									step="any"
									bind:value={qte}
									class="w-16 bg-transparent text-center text-[13px] font-semibold text-ink tabular-nums outline-none"
								/>
								<button
									type="button"
									onclick={() => (qte = qte + (produit.unite === 'u' ? 1 : 0.5))}
									class="grid size-7 place-items-center rounded-full text-ink-soft transition-colors hover:bg-glass-3 hover:text-ink"
								>
									+
								</button>
							</div>
							<span class="text-[12px] font-semibold text-ink-soft">
								{produit.unite === 'u' ? 'unité' : produit.unite === 'm2' ? 'm²' : 'ml'} ·
								{prixAffiche({ kind: 'produit', p: produit })}
							</span>
						</div>
					{/if}
				</div>

				<!-- Étape 4 : options -->
				{#if sections.length}
					<div class="space-y-3 rounded-2xl border border-line bg-card p-3.5">
						<div class="flex flex-wrap items-center gap-2">
							<p
								class="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
							>
								<span
									class="grid size-4.5 place-items-center rounded-full bg-brand/10 text-[9.5px] text-brand"
									>4</span
								>
								Ajoute les options
							</p>
							{#if choix.length}
								<button
									type="button"
									onclick={() => (choix = [])}
									class="ml-auto text-[11px] font-medium text-muted-foreground transition-colors hover:text-destructive"
								>
									tout décocher ({choix.length})
								</button>
							{/if}
						</div>

						{#each sections as s (s.section.id)}
							{@const actives = s.options.filter((o) => choix.includes(o.id))}
							<div class="space-y-1.5">
								<div class="flex flex-wrap items-baseline gap-2">
									<p class="text-[11.5px] font-semibold text-ink">{s.section.nom}</p>
									{#if s.section.exclusif}
										<span class="text-[10px] font-medium text-ink-mute">un seul choix</span>
									{/if}
									{#if s.section.aide}
										<span class="text-[10px] text-ink-mute">{s.section.aide}</span>
									{/if}
									{#if actives.length && !s.section.exclusif && s.section.id !== 'inclus'}
										<button
											type="button"
											onclick={() =>
												(choix = choix.filter((x) => !s.options.some((o) => o.id === x)))}
											class="ml-auto flex items-center gap-1 text-[10.5px] font-medium text-ink-mute transition-colors hover:text-destructive"
										>
											<X class="size-3" strokeWidth={2} /> retirer
										</button>
									{/if}
								</div>
								<div class="flex flex-wrap gap-1.5">
									{#each s.options as o (o.id)}
										{@const actif = choix.includes(o.id)}
										{@const inclus = estInclus(o)}
										{@const bloque = o.type === 'grille' && montantPlusValue(o) == null}
										<button
											type="button"
											onclick={() => basculer(o)}
											disabled={inclus || bloque}
											title={bloque ? 'Cette cote sort de la grille du book' : (o.detail ?? o.nom)}
											class={[
												'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium',
												FOCUS_CHAMP,
												inclus
													? 'cursor-default border-dashed border-line bg-card2 text-ink-mute'
													: bloque
														? 'cursor-not-allowed border-line bg-card2 text-ink-mute/60'
														: actif
															? 'border-brand bg-brand/15 text-brand'
															: 'border-line bg-card2 text-ink-soft hover:border-brand/50 hover:text-ink'
											].join(' ')}
										>
											{#if inclus}
												<CircleCheck class="size-3" strokeWidth={2.4} />
											{:else if actif}
												<CircleCheck class="size-3" strokeWidth={2.4} />
											{:else}
												<Plus class="size-3" strokeWidth={2.4} />
											{/if}
											{nomCourt(o)}
											<span
												class={['tabular-nums', actif ? 'font-bold' : 'text-ink-mute'].join(' ')}
											>
												{effetOption(o)}
											</span>
										</button>
									{/each}
								</div>

								<!-- Champs requis par certaines plus-values -->
								{#if s.options.some((o) => choix.includes(o.id) && o.type === 'eur_carrea')}
									<label class="flex items-center gap-2 text-[11.5px] text-ink-soft">
										carreaux par ouvrant
										<input
											type="number"
											min="1"
											max="9"
											bind:value={carreaux}
											class="w-14 rounded-full border border-input bg-card px-3 py-1 text-right font-semibold text-ink tabular-nums {FOCUS_CHAMP}"
										/>
									</label>
								{/if}
								{#if s.options.some((o) => choix.includes(o.id) && o.type === 'eur_vantail')}
									<label class="flex items-center gap-2 text-[11.5px] text-ink-soft">
										vantaux ouvrants
										<input
											type="number"
											min="1"
											max="4"
											value={nbVantaux}
											onchange={(e) => (vantauxForce = Number(e.currentTarget.value) || 1)}
											class="w-14 rounded-full border border-input bg-card px-3 py-1 text-right font-semibold text-ink tabular-nums {FOCUS_CHAMP}"
										/>
									</label>
								{/if}
								{#if s.options.some((o) => choix.includes(o.id) && o.type === 'grille' && o.addon && o.addon.autoLignes === 'l')}
									<label class="flex items-center gap-2 text-[11.5px] text-ink-soft">
										hauteur d'imposte
										<input
											type="number"
											min="400"
											max="1000"
											step="50"
											value={imposteH}
											onchange={(e) =>
												(imposteH = Math.min(
													1000,
													Math.max(400, Number(e.currentTarget.value) || 600)
												))}
											class="w-20 rounded-full border border-input bg-card px-3 py-1 text-right font-semibold text-ink tabular-nums {FOCUS_CHAMP}"
										/>
										mm
									</label>
								{/if}
							</div>
						{/each}
					</div>
				{/if}

				<!-- Barre de prix -->
				<div
					class="sticky bottom-0 z-20 rounded-2xl border border-line-strong bg-card p-3 shadow-[var(--ombre-forte)]"
				>
					<div class="flex flex-wrap items-center justify-between gap-3">
						<div class="min-w-0 flex-1">
							<p class="truncate text-[12.5px] font-semibold text-ink">{designation}</p>
							<p class="mt-0.5 text-[10.5px] text-ink-mute">{detailLigne}</p>
						</div>

						<div class="flex flex-wrap items-center gap-2">
							{#if grille}
								<div
									class="flex items-center gap-1 rounded-full border border-line bg-card2 p-0.5 transition-[border-color,box-shadow] focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15"
								>
									<button
										type="button"
										onclick={() => (qte = Math.max(0.5, Number((qte - 1).toFixed(1))))}
										class="grid size-7 place-items-center rounded-full text-ink-soft transition-colors hover:bg-glass-3 hover:text-ink"
									>
										−
									</button>
									<input
										type="number"
										min="0.5"
										step="any"
										bind:value={qte}
										class="w-14 bg-transparent text-center text-[13px] font-semibold text-ink tabular-nums outline-none"
									/>
									<button
										type="button"
										onclick={() => (qte = Number((qte + 1).toFixed(1)))}
										class="grid size-7 place-items-center rounded-full text-ink-soft transition-colors hover:bg-glass-3 hover:text-ink"
									>
										+
									</button>
								</div>
							{:else}
								<p class="text-[12px] font-semibold text-ink-soft">
									{nombre.format(qte)}
									{produit?.unite === 'm2' ? 'm²' : produit?.unite === 'ml' ? 'ml' : 'unité'}
								</p>
							{/if}
							<div class="text-right">
								<p class="text-[15px] leading-tight font-bold text-foreground tabular-nums">
									{prixUnitaire == null ? 'hors grille' : euro.format(prixUnitaire.total)}
									<span class="text-[11px] font-semibold text-muted-foreground">HT</span>
								</p>
								<p class="text-[10.5px] text-muted-foreground">
									{prixUnitaire == null
										? 'change de cotes'
										: `soit ${euro.format(prixUnitaire.total * qte)} HT × ${nombre.format(qte)}`}
								</p>
							</div>
							<Button onclick={ajouter} disabled={prixUnitaire == null} class="flex-1 sm:flex-none">
								<Plus class="size-4" strokeWidth={2.4} /> Ajouter au devis
							</Button>
						</div>
					</div>
				</div>
			{/if}

			<!-- Aide TVA -->
			<details class="rounded-2xl border border-line bg-card2/60 px-3.5 py-2.5">
				<summary
					class="flex cursor-pointer items-center gap-2 text-[12px] font-semibold text-ink-soft"
				>
					<Percent class="size-3.5" strokeWidth={1.9} /> Aide : quel taux de TVA ?
				</summary>
				<div class="mt-2.5 space-y-2.5">
					<p
						class="flex items-start gap-2 rounded-2xl border border-line bg-card px-3 py-2.5 text-[11px] leading-snug text-ink-soft"
					>
						<TriangleAlert class="mt-0.5 size-3.5 shrink-0 text-ink-mute" strokeWidth={2} />
						<span>{TVA_ALERTE}</span>
					</p>
					<div class="grid gap-x-4 gap-y-1 sm:grid-cols-2">
						{#each TVA_RECAP as t (t.gamme)}
							<div
								class="flex items-center justify-between gap-2 border-b border-line/60 py-0.5 text-[11.5px]"
							>
								<span class="truncate text-ink-soft">{t.gamme}</span>
								<span class="shrink-0 font-semibold text-ink tabular-nums">{t.tva}</span>
							</div>
						{/each}
					</div>
				</div>
			</details>
		</div>

		<!-- Devis -->
		<div class="min-w-0">
			<div class="lg:sticky lg:top-0">
				<PanneauDevis
					bind:lignes
					bind:remise
					bind:opportunite
					{flash}
					onQte={majQte}
					onSupprimer={supprimer}
					onVider={() => {
						lignes = [];
						// La remise vient de la DO, qui dépend du regroupement : vider le
						// panier efface les deux (le visuel est réinitialisé dans le panneau).
						remise = 0;
						opportunite = null;
					}}
				/>
			</div>
		</div>
	</div>
</div>
