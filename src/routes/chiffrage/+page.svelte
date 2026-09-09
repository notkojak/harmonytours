<script lang="ts">
	import {
		Check,
		Copy,
		Plus,
		RotateCcw,
		Ruler,
		Search,
		ShoppingBasket,
		ShoppingCart,
		Sun,
		X
	} from '@lucide/svelte';
	import { TARIF, TARIF_CATEGORIES, TVA_LABEL, type TarifProduct } from '$lib/data/tarif';
	import { GRILLES, MENUISERIES_FIXES, VARIANTS_PF, type GrilleMenuiserie } from '$lib/data/menuiseries';
	import {
		GRILLES_FENETRES,
		FENETRE_OPTIONS,
		FENETRE_SURPLUS,
		FENETRE_VITRAGES
	} from '$lib/data/fenetres';
	import {
		VOLETS_BATTANTS,
		GRID_PRECADRE_BLANC,
		GRID_PRECADRE_RAL,
		VOLET_OPTIONS,
		VARIANTS_VOLETS
	} from '$lib/data/volets-battants';
	import { BANNES, BANNE_OPTIONS } from '$lib/data/bannes';
	import {
		PERGOLA_LARGEURS,
		PERGOLA_AVANCEES,
		PERGOLA_M2,
		PERGOLA_SPOTS,
		PERGOLA_TVA
	} from '$lib/data/pergola';

	const euro = new Intl.NumberFormat('fr-FR', {
		style: 'currency',
		currency: 'EUR',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	});
	const euro0 = new Intl.NumberFormat('fr-FR', {
		style: 'currency',
		currency: 'EUR',
		minimumFractionDigits: 0,
		maximumFractionDigits: 0
	});

	const pct = (v: number) =>
		`${(v * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;

	let query = $state('');
	let categorie = $state('Toutes');
	// « Menuiseries » et « Pergola solaire » sont des onglets au même niveau que
	// les familles de produits : quand ils sont actifs, on affiche l'outil
	// correspondant au lieu du catalogue.
	let onglet = $state<'menuiseries' | 'pergola' | null>(null);
	function setOnglet(o: 'menuiseries' | 'pergola') {
		onglet = o;
	}

	// Sous-onglets : structure de la page « travaux » du book (Toiture & façade =
	// TRAVAUX / LA TOITURE / LES COMBLES / LA FACADE + Terrasses & vérandas).
	const SOUS_ORDRE = ['Travaux', 'La toiture', 'Les combles', 'La façade', 'Terrasses & vérandas'];
	let sous = $state('');
	const sousOptions = $derived(
		categorie === 'Toutes'
			? []
			: SOUS_ORDRE.filter((s) => TARIF.some((p) => p.categorie === categorie && p.sous === s))
	);
	function setCat(c: string) {
		categorie = c;
		sous = '';
		onglet = null;
	}

	const filtered = $derived(
		TARIF.filter((p) => {
			if (categorie !== 'Toutes' && p.categorie !== categorie) return false;
			if (sous && p.sous !== sous) return false;
			const q = query.trim().toLowerCase();
			if (!q) return true;
			return (
				p.nom.toLowerCase().includes(q) ||
				(p.detail ?? '').toLowerCase().includes(q) ||
				p.categorie.toLowerCase().includes(q)
			);
		})
	);

	// Panier : id produit -> quantité. Les produits à l'unité ont des quantités
	// entières ; les produits au m² / ml pourront être décimaux.
	// Le panier stocke toujours un prix HT figé (snapshot au moment de l'ajout).
	type CartProduct = TarifProduct & { prixHT: number };
	type CartLine = { product: CartProduct; qty: number };
	let cart = $state<Record<string, CartLine>>({});

	// Prix effectif : les produits « au point » (colonne POINTS du book) sont
	// facturés points × valeur du point, comme les menuiseries.
	const prodPrix = (p: TarifProduct) => ('points' in p ? p.points * euroPoint : p.prixHT);

	// Tarif au point dégressif selon la surface (ex. hydrofuge façade :
	// 0,88 pt/m² ≤ 99 m² → 0,65 pt/m² > 250 m²) : le prix unitaire de la ligne
	// dépend de la quantité saisie dans le panier.
	const ptsUnitaire = (p: CartProduct, qty: number): number | null => {
		if (!('points' in p) || !p.tiers) return null;
		for (const t of p.tiers) if (qty <= t.jusque) return t.points;
		return p.tiers[p.tiers.length - 1].points;
	};

	function add(product: TarifProduct) {
		const line = cart[product.id];
		cart = {
			...cart,
			[product.id]: {
				product: { ...product, prixHT: prodPrix(product) } as CartProduct,
				qty: (line?.qty ?? 0) + (product.unite === 'u' ? 1 : 1)
			}
		};
	}
	function setQty(id: string, qty: number) {
		if (qty <= 0) {
			const next = { ...cart };
			delete next[id];
			cart = next;
			return;
		}
		const line = cart[id];
		const pts = ptsUnitaire(line.product, qty);
		cart = {
			...cart,
			[id]: {
				...line,
				qty,
				product:
					pts != null ? { ...line.product, prixHT: pts * euroPoint } : line.product
			}
		};
	}
	function remove(id: string) {
		const next = { ...cart };
		delete next[id];
		cart = next;
	}
	function reset() {
		cart = {};
	}

	const lines = $derived(Object.values(cart));
	const tvaRates = $derived([...new Set(lines.map((l) => l.product.tva))].sort((a, b) => a - b));

	const totals = $derived.by(() => {
		let totalHT = 0;
		let totalTVA = 0;
		let totalTTC = 0;
		const byTva = new Map<
			number,
			{ ht: number; tva: number; ttc: number }
		>();
		for (const l of lines) {
			const ht = l.product.prixHT * l.qty;
			const tva = ht * l.product.tva;
			const ttc = ht + tva;
			totalHT += ht;
			totalTVA += tva;
			totalTTC += ttc;
			const g = byTva.get(l.product.tva) ?? { ht: 0, tva: 0, ttc: 0 };
			g.ht += ht;
			g.tva += tva;
			g.ttc += ttc;
			byTva.set(l.product.tva, g);
		}
		return { totalHT, totalTVA, totalTTC, byTva };
	});

	// --- Menuiseries au point ---
	type MOption =
		| {
				kind: 'grille';
				id: string;
				nom: string;
				categorie: string;
				grid: GrilleMenuiserie;
				mult: number;
			}
		| {
				kind: 'vantaux';
				id: string;
				nom: string;
				categorie: string;
				tva: 0.055 | 0.1;
				mult: number;
				vantails: { label: string; grid: GrilleMenuiserie }[];
			}
		| { kind: 'fixe'; id: string; nom: string; categorie: string; tva: 0.055 | 0.1; points: number };

	const ALL_GRILLES = [...GRILLES, ...GRILLES_FENETRES];

	const M_OPTIONS: MOption[] = [
		...ALL_GRILLES.map((g): MOption => ({
			kind: 'grille',
			id: g.id,
			nom: g.nom,
			categorie: g.categorie,
			grid: g,
			mult: 1
		})),
		...VARIANTS_PF.map((v): MOption => {
			const grid = ALL_GRILLES.find((g) => g.id === v.gridId)!;
			return { kind: 'grille', id: v.id, nom: v.nom, categorie: 'Fenêtres PVC', grid, mult: v.mult };
		}),
		...VOLETS_BATTANTS.map((v): MOption => ({
			kind: 'vantaux',
			id: v.id,
			nom: v.nom,
			categorie: v.categorie,
			tva: v.tva,
			mult: 1,
			vantails: v.vantails
		})),
		...VARIANTS_VOLETS.map((v): MOption => {
			const base = VOLETS_BATTANTS.find((b) => b.id === v.baseId)!;
			return {
				kind: 'vantaux',
				id: v.id,
				nom: v.nom,
				categorie: 'Volets battants',
				tva: 0.1,
				mult: v.mult,
				vantails: base.vantails
			};
		}),
		{ kind: 'grille', id: GRID_PRECADRE_BLANC.id, nom: GRID_PRECADRE_BLANC.nom, categorie: 'Volets battants', grid: GRID_PRECADRE_BLANC, mult: 1 },
		{ kind: 'grille', id: GRID_PRECADRE_RAL.id, nom: GRID_PRECADRE_RAL.nom, categorie: 'Volets battants', grid: GRID_PRECADRE_RAL, mult: 1 },
		...BANNES.map((g): MOption => ({
			kind: 'grille',
			id: g.id,
			nom: g.nom,
			categorie: g.categorie,
			grid: g,
			mult: 1
		})),
		...MENUISERIES_FIXES.filter((f) => f.categorie !== 'Volets').map((f): MOption => ({
			kind: 'fixe',
			id: f.id,
			nom: f.nom,
			categorie: f.categorie,
			tva: f.tva,
			points: f.points
		}))
	];

	const M_CATEGORIES = [...new Set(M_OPTIONS.map((o) => o.categorie))];
	let mSelId = $state(M_OPTIONS[0].id);
	const mSel = $derived(M_OPTIONS.find((o) => o.id === mSelId)!);
	let euroPoint = $state(100);
	let mH = $state('');
	let mL = $state('');
	let mMan = $state('RADIO');
	let mVan = $state(0);
	let mVitrage = $state('standard');
	let mSurplus = $state('aucun');
	let mOpts = $state<string[]>([]);

	const isFenetre = $derived(
		mSel.kind === 'grille' && (mSel.categorie === 'Fenêtres PVC' || mSel.categorie === 'Fenêtres ALU')
	);
	const vitrageMult = $derived(
		isFenetre ? (FENETRE_VITRAGES.find((v) => v.id === mVitrage)?.mult ?? 1) : 1
	);
	const surplusPct = $derived(
		isFenetre ? (FENETRE_SURPLUS.find((s) => s.id === mSurplus)?.pct ?? 0) : 0
	);
	const vitrageLabel = $derived(
		isFenetre ? (FENETRE_VITRAGES.find((v) => v.id === mVitrage)?.nom ?? '') : ''
	);
	const surplusLabel = $derived(
		isFenetre && surplusPct > 0
			? `+${Math.round(surplusPct * 100)} %`
			: ''
	);
	const mSurplusList = $derived(
		isFenetre
			? FENETRE_SURPLUS.filter(
					(s) =>
						s.id === 'aucun' ||
						s.id.startsWith('doublage') ||
						s.id === 'renforcement' ||
						s.id.startsWith(mSel.categorie === 'Fenêtres PVC' ? 'pvc-' : 'alu-')
			  )
			: []
	);
	const mOptsList = $derived(
		isFenetre
			? FENETRE_OPTIONS.filter((o) =>
					o.id.startsWith(mSel.categorie === 'Fenêtres PVC' ? 'f-pvc-' : 'f-alu-')
			  )
			: mSel.categorie === 'Volets battants'
				? VOLET_OPTIONS
				: mSel.categorie === 'Volets'
					? MENUISERIES_FIXES.filter((f) => f.categorie === 'Volets')
					: mSel.categorie === 'Stores extérieurs'
						? BANNE_OPTIONS
						: []
	);
	const mOptsPts = $derived(
		mOptsList.filter((o) => mOpts.includes(o.id)).reduce((s, o) => s + o.points, 0)
	);
	const optShort = (nom: string) => nom.replace(/^(Fenêtre (PVC|ALU)|Volet) — /, '');
	function toggleOpt(id: string) {
		mOpts = mOpts.includes(id) ? mOpts.filter((x) => x !== id) : [...mOpts, id];
	}

	const mGrid = $derived(
		mSel.kind === 'grille'
			? mSel.grid
			: mSel.kind === 'vantaux'
				? mSel.vantails[Math.min(mVan, mSel.vantails.length - 1)]?.grid ?? null
				: null
	);
	const hasMan = $derived(mGrid ? mGrid.lignes.some((l) => l.m) : false);
	const mHeights = $derived(
		mGrid ? [...new Set(mGrid.lignes.map((l) => l.d.v))].sort((a, b) => a - b) : []
	);

	const snap = (v: number, list: number[]) =>
		list.reduce((best, x) => (Math.abs(x - v) < Math.abs(best - v) ? x : best), list[0]);
	const mHsnap = $derived(
		mGrid && mHeights.length > 0 ? snap(parseInt(mH, 10) || mHeights[0], mHeights) : null
	);
	const mLsnap = $derived(
		mGrid && mGrid.cols.length > 0
			? snap(parseInt(mL, 10) || mGrid.cols[0].v, mGrid.cols.map((c) => c.v))
			: null
	);
	const dimLabel = (v: number | null, liste: { v: number; l?: string }[]) => {
		const d = liste.find((x) => x.v === v);
		return d?.l ?? (v == null ? '' : `${v} mm`);
	};
	const mPts = $derived.by(() => {
		if (mSel.kind === 'fixe') return mSel.points;
		if (!mGrid || mHsnap == null || mLsnap == null) return null;
		const ligne = mGrid.lignes.find((l) => l.d.v === mHsnap && (!hasMan || l.m === mMan));
		if (!ligne) return null;
		const col = mGrid.cols.findIndex((c) => c.v === mLsnap);
		return col < 0 ? null : ligne.p[col];
	});
	const mTva = $derived(
		mSel.kind === 'grille'
			? (mGrid?.tva ?? 0.055)
			: mSel.kind === 'vantaux'
				? mSel.tva
				: mSel.tva
	);
	const mVanLabel = $derived(
		mSel.kind === 'vantaux' ? mSel.vantails[Math.min(mVan, mSel.vantails.length - 1)]?.label ?? '' : ''
	);
	const mPrix = $derived(
		mPts == null
			? null
			: mPts * ('mult' in mSel ? mSel.mult : 1) * euroPoint * vitrageMult * (1 + surplusPct) +
					mOptsPts * euroPoint
	);

	const fmtLabel = (l: string) => l.replace(/à/g, ' à ').replace(/\s+/g, ' ').trim();
	function mInit(grid: GrilleMenuiserie | null) {
		if (!grid) return;
		const hs = [...new Set(grid.lignes.map((l) => l.d.v))].sort((a, b) => a - b);
		mH = String(hs[Math.floor(hs.length / 2)]);
		mL = String(grid.cols[Math.floor(grid.cols.length / 2)].v);
		if (grid.lignes.some((l) => l.m)) mMan = 'RADIO';
	}
	$effect(() => {
		mSelId;
		mVan = 0;
		mOpts = [];
		mSurplus = 'aucun';
		mInit(mGrid);
	});

	const fmtPts = (v: number) =>
		v.toLocaleString('fr-FR', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
	let mCounter = $state(0);
	function addMenuiserie() {
		if (mPrix == null) return;
		if (mSel.kind === 'fixe') {
			add({
				id: `m-${mCounter++}`,
				nom: mSel.nom,
				categorie: 'Menuiseries',
				prixHT: mPrix,
				unite: 'u',
				tva: mSel.tva
			});
			return;
		}
		const dimsH = fmtLabel(dimLabel(mHsnap, mGrid!.lignes.map((l) => l.d)));
		const dimsL = fmtLabel(dimLabel(mLsnap, mGrid!.cols));
		const vanPart = mVanLabel ? ` — ${mVanLabel}` : '';
		const vitrageShort =
			isFenetre && vitrageMult !== 1
				? ` · vitrage ${vitrageLabel.split('—').pop()!.trim()}`
				: '';
		const surplusShort = surplusLabel ? ` · ${surplusLabel}` : '';
		const optsShort =
			mOpts.length > 0
				? mOptsList
						.filter((o) => mOpts.includes(o.id))
						.map((o) => `${o.points >= 0 ? '+' : '-'} ${optShort(o.nom)} ${fmtPts(Math.abs(o.points))} pts`)
						.join(' · ')
				: '';
		const nom = `${mSel.nom}${vanPart} — ${dimsH} × ${dimsL}${hasMan ? ` (${mMan.toLowerCase()})` : ''} · ${fmtPts(mPts!)} pts${vitrageShort}${surplusShort}${optsShort ? ` · ${optsShort}` : ''}`;
		add({
			id: `m-${mCounter++}`,
			nom,
			categorie: 'Menuiseries',
			prixHT: mPrix,
			unite: 'u',
			tva: mTva
		});
	}

	// --- Pergola solaire (prix HT au m²) ---
	let pL = $state('4000');
	let pA = $state('3000');
	let pSpots = $state(0);
	const pLsnap = $derived(snap(parseInt(pL, 10) || PERGOLA_LARGEURS[0], PERGOLA_LARGEURS));
	const pAsnap = $derived(snap(parseInt(pA, 10) || PERGOLA_AVANCEES[0], PERGOLA_AVANCEES));
	const pM2 = $derived((pLsnap / 1000) * (pAsnap / 1000));
	const pEurM2 = $derived.by(() => {
		const ri = PERGOLA_AVANCEES.indexOf(pAsnap);
		const ci = PERGOLA_LARGEURS.indexOf(pLsnap);
		if (ri < 0 || ci < 0) return null;
		return PERGOLA_M2[ri][ci];
	});
	const pSpotsPrix = $derived(PERGOLA_SPOTS.find((s) => s.n === pSpots)?.prixHT ?? 0);
	const pPrix = $derived(pEurM2 == null ? null : pM2 * pEurM2 + pSpotsPrix);
	let pCounter = $state(0);
	function addPergola() {
		if (pPrix == null) return;
		add({
			id: `p-${pCounter++}`,
			nom: `Pergola solaire — ${pLsnap} × ${pAsnap} mm (${pM2.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} m²)${pSpots > 0 ? ` + ${pSpots} spots LED` : ''}`,
			categorie: 'Énergies nouvelles',
			prixHT: pPrix,
			unite: 'u',
			tva: PERGOLA_TVA
		});
	}

	let copied = $state(false);
	function copyRecap() {
		if (lines.length === 0) return;
		const parts = lines.map(
			(l) =>
				`- ${l.product.nom} × ${l.qty} : ${euro.format(l.product.prixHT * l.qty)} HT — ${euro.format(
					l.product.prixHT * l.qty * (1 + l.product.tva)
				)} TTC`
		);
		for (const rate of tvaRates) {
			const g = totals.byTva.get(rate)!;
			parts.push(
				`TVA ${pct(rate)} : ${euro.format(g.ht)} HT — ${euro.format(g.tva)} TVA — ${euro.format(
					g.ttc
				)} TTC`
			);
		}
		parts.push(
			`TOTAL : ${euro.format(totals.totalHT)} HT — ${euro.format(totals.totalTVA)} TVA — ${euro.format(
				totals.totalTTC
			)} TTC`
		);
		navigator.clipboard.writeText(parts.join('\n')).then(() => {
			copied = true;
			setTimeout(() => (copied = false), 1500);
		});
	}
</script>

<div class="mx-auto max-w-6xl space-y-4">
	<!-- En-tête -->
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div class="flex items-center gap-2.5">
			<span
				class="grid size-9 place-items-center rounded-xl border border-line bg-primary/15 text-primary"
			>
				<ShoppingBasket class="size-4.5" strokeWidth={1.7} />
			</span>
			<div>
				<h1 class="text-[17px] font-bold text-foreground">Chiffrage express</h1>
				<p class="text-[12.5px] text-muted-foreground">
					Panier avec HT / TTC séparés par taux de TVA — tarif Bravaux 2026
				</p>
			</div>
		</div>
		{#if lines.length > 0}
			<button
				type="button"
				onclick={reset}
				class="flex items-center gap-1.5 rounded-lg border border-line bg-card2 px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-destructive"
			>
				<RotateCcw class="size-3.5" strokeWidth={1.7} />
				Réinitialiser
			</button>
		{/if}
	</div>

	<div class="grid gap-4 lg:grid-cols-[1fr_360px]">			<!-- Catalogue -->
			<div class="min-w-0 space-y-3">
			<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
				<div
					class="flex flex-1 items-center gap-2 rounded-xl border border-line bg-card2 px-3"
				>
					<Search class="size-4 shrink-0 text-muted-foreground" strokeWidth={1.7} />
					<input
						type="search"
						placeholder="Rechercher un produit…"
						bind:value={query}
						class="h-9 w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
					/>
				</div>
			</div>

			<div class="flex flex-wrap gap-1.5">
				<button
					type="button"						onclick={() => setCat('Toutes')}
						class={[
							'rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors',
							onglet === null && categorie === 'Toutes'
								? 'bg-foreground text-background'
								: 'bg-card2 text-muted-foreground hover:text-foreground'
						].join(' ')}
				>
					Toutes
				</button>
				{#each TARIF_CATEGORIES as c}
					<button
						type="button"
						onclick={() => setCat(c)}
						class={[
							'rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors',
							onglet === null && categorie === c
								? 'bg-foreground text-background'
								: 'bg-card2 text-muted-foreground hover:text-foreground'
						].join(' ')}
					>
						{c}
					</button>
				{/each}
				<button
					type="button"
					onclick={() => setOnglet('menuiseries')}
					class={[
						'rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors',
						onglet === 'menuiseries'
							? 'bg-foreground text-background'
							: 'bg-card2 text-muted-foreground hover:text-foreground'
					].join(' ')}
				>
					Menuiseries
				</button>
				<button
					type="button"
					onclick={() => setOnglet('pergola')}
					class={[
						'rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors',
						onglet === 'pergola'
							? 'bg-foreground text-background'
							: 'bg-card2 text-muted-foreground hover:text-foreground'
					].join(' ')}
				>
					Pergola solaire
				</button>
			</div>

			{#if onglet === null}
			{#if sousOptions.length > 0}
				<div class="flex flex-wrap gap-1.5 border-t border-line pt-2.5">
					<button
						type="button"
						onclick={() => (sous = '')}
						class={[
							'rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors',
							sous === ''
								? 'bg-foreground text-background'
								: 'bg-card2 text-muted-foreground hover:text-foreground'
						].join(' ')}
					>
						Tous
					</button>
					{#each sousOptions as s}
						<button
							type="button"
							onclick={() => (sous = sous === s ? '' : s)}
							class={[
								'rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors',
								sous === s
									? 'bg-foreground text-background'
									: 'bg-card2 text-muted-foreground hover:text-foreground'
							].join(' ')}
						>
							{s}
						</button>
					{/each}
				</div>
			{/if}

			<div class="space-y-1.5">
				{#each filtered as p}
					<div
						class="flex items-center gap-3 rounded-xl border border-line bg-card2/60 px-3 py-2.5"
					>
						<div class="min-w-0 flex-1">
							<div class="flex flex-wrap items-center gap-1.5">
								<p class="text-[13px] leading-snug font-semibold text-foreground">{p.nom}</p>
								<span
									class={[
										'rounded-md px-1.5 py-0.5 text-[9.5px] font-bold whitespace-nowrap',
										p.tva === 0.055
											? 'bg-emerald-500/15 text-emerald-400 light:text-emerald-600'
											: p.tva === 0.1
												? 'bg-amber-500/15 text-amber-500 light:text-amber-600'
												: 'bg-violet-500/15 text-violet-400 light:text-violet-600'
									].join(' ')}
								>
									{TVA_LABEL[p.tva]}
								</span>
							</div>
							{#if p.detail}
								<p class="mt-0.5 text-[11px] text-muted-foreground">{p.detail}</p>
							{/if}
						</div>
						<p class="shrink-0 text-right text-[13px] font-bold whitespace-nowrap text-foreground">
							{euro0.format(prodPrix(p))}
						</p>
						<span class="shrink-0 text-[10px] font-semibold text-muted-foreground">
							{p.unite === 'u' ? 'l’unité' : p.unite === 'm2' ? '/ m²' : '/ ml'}
						</span>
						<button
							type="button"
							onclick={() => add(p)}
							title={`Ajouter « ${p.nom} » — ${euro0.format(prodPrix(p))} HT`}
							class="grid size-7 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
						>
							<Plus class="size-4" strokeWidth={2.2} />
						</button>
					</div>
				{/each}
				{#if filtered.length === 0}
					<p class="rounded-xl border border-line bg-card2/60 px-4 py-8 text-center text-[13px] text-muted-foreground">
						Aucun produit trouvé.
					</p>					{/if}
			</div>
			{/if}

			{#if onglet === 'menuiseries'}
			<!-- Menuiseries au point -->
			<div class="rounded-2xl border border-line bg-card p-3.5">
				<div class="flex flex-wrap items-center justify-between gap-2">
					<div class="flex items-center gap-2">
						<Ruler class="size-4 shrink-0 text-muted-foreground" strokeWidth={1.7} />
						<div>
							<p class="text-[13px] font-semibold text-foreground">Menuiseries — au point</p>
							<p class="text-[10.5px] text-muted-foreground">
								Prix = points × valeur du point (book de tarifs 2026)
							</p>
						</div>
					</div>
					<label class="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
						Point
						<input
							type="number"
							min="1"
							step="0.5"
							bind:value={euroPoint}
							class="w-16 rounded-lg border border-line bg-card2 px-2 py-1 text-right text-[12px] font-bold tabular-nums text-foreground outline-none"
						/>
						€
					</label>
				</div>

				<div class="mt-3 grid gap-2 sm:grid-cols-2">
					<select
						bind:value={mSelId}
						class="col-span-full h-9 rounded-lg border border-line bg-card2 px-2.5 text-[12.5px] font-medium text-foreground outline-none"
					>
						{#each M_CATEGORIES as cat}
							<optgroup label={cat}>
								{#each M_OPTIONS.filter((o) => o.categorie === cat) as o}
									<option value={o.id}>{o.nom}</option>
								{/each}
							</optgroup>
						{/each}
					</select>

					{#if mSel.kind === 'vantaux'}
						<label class="block">
							<span class="mb-1 block text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">
								Nombre de vantaux
							</span>
							<select
								bind:value={mVan}
								class="h-8 w-full rounded-lg border border-line bg-card2 px-2 text-[12.5px] font-medium text-foreground outline-none"
							>
								{#each mSel.vantails as v, vi}
									<option value={vi}>{v.label}</option>
								{/each}
							</select>
						</label>
					{/if}

					{#if isFenetre}
						<label class="block">
							<span class="mb-1 block text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">
								Vitrage
							</span>
							<select
								bind:value={mVitrage}
								class="h-8 w-full rounded-lg border border-line bg-card2 px-2 text-[12.5px] font-medium text-foreground outline-none"
							>
								{#each FENETRE_VITRAGES as v}
									<option value={v.id}>{v.nom}</option>
								{/each}
							</select>
						</label>
						<label class="block">
							<span class="mb-1 block text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">
								Couleur / surplus
							</span>
							<select
								bind:value={mSurplus}
								class="h-8 w-full rounded-lg border border-line bg-card2 px-2 text-[12.5px] font-medium text-foreground outline-none"
							>
								{#each mSurplusList as s}
									<option value={s.id}>{s.nom}</option>
								{/each}
							</select>
						</label>
					{/if}

					{#if mOptsList.length > 0}
						<label class="block sm:col-span-2">
								<span class="mb-1 block text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">
									Options — à toggler
								</span>
								<div class="flex flex-wrap gap-1.5">
									{#each mOptsList as o}
										<button
											type="button"
											onclick={() => toggleOpt(o.id)}
											class={[
												'rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors',
												mOpts.includes(o.id)
													? 'border-primary bg-primary/15 text-primary'
													: 'border-line bg-card2 text-muted-foreground hover:text-foreground'
											].join(' ')}
										>
											{optShort(o.nom)} · {fmtPts(o.points)} pts
										</button>
									{/each}
								</div>
							</label>
						{/if}

					{#if mGrid}
						<label class="block">
							<span class="mb-1 block text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">
								Hauteur (mm)
							</span>
							<input
								type="number"
								bind:value={mH}
								placeholder="ex. 1250"
								class="h-8 w-full rounded-lg border border-line bg-card2 px-2 text-[12.5px] font-semibold tabular-nums text-foreground outline-none"
							/>
						</label>
						<label class="block">
							<span class="mb-1 block text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">
								Largeur (mm)
							</span>
							<input
								type="number"
								bind:value={mL}
								placeholder="ex. 900"
								class="h-8 w-full rounded-lg border border-line bg-card2 px-2 text-[12.5px] font-semibold tabular-nums text-foreground outline-none"
							/>
						</label>
						{#if hasMan}
							<label class="block">
								<span class="mb-1 block text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">
									Manœuvre
								</span>
								<select
									bind:value={mMan}
									class="h-8 w-full rounded-lg border border-line bg-card2 px-2 text-[12.5px] font-medium text-foreground outline-none"
								>
									<option value="RADIO">Radio</option>
									<option value="FILAIRE">Filaire</option>
									<option value="TREUIL">Treuil</option>
								</select>
							</label>
						{/if}
					{:else}
						<p class="rounded-lg bg-card2 px-2.5 py-2 text-[11px] text-muted-foreground sm:col-span-2">
							Porte vendue à points fixes — aucune dimension requise.
						</p>
					{/if}
				</div>

				<div class="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-card2 px-3 py-2">
					<div class="text-[12px]">
						<p class="font-semibold text-foreground">
							{mPts == null
								? 'Hors grille'
								: `${fmtPts(mPts * ('mult' in mSel ? mSel.mult : 1))} pts`}
						</p>
						{#if mGrid && mHsnap != null && mLsnap != null}
						<p class="text-[10.5px] text-muted-foreground">
							{fmtLabel(dimLabel(mHsnap, mGrid.lignes.map((l) => l.d)))} ×{' '}
							{fmtLabel(dimLabel(mLsnap, mGrid.cols))}{hasMan ? ` · ${mMan.toLowerCase()}` : ''}
							{mVanLabel ? ` · ${mVanLabel}` : ''} — {TVA_LABEL[mTva]}
						</p>
						{#if isFenetre && (vitrageMult !== 1 || surplusPct > 0)}
						<p class="text-[10px] text-primary">
							{vitrageMult !== 1 ? `Vitrage ${vitrageLabel.split('—').pop()!.trim()}` : ''}
							{surplusPct > 0 ? `${vitrageMult !== 1 ? ' · ' : ''}Surplus ${surplusLabel}` : ''}
						</p>
						{/if}
						{#if mOpts.length > 0}
						<p class="text-[10px] text-primary">
							{mOptsPts >= 0 ? '+' : '-'} {fmtPts(Math.abs(mOptsPts))} pts d'options
						</p>
						{/if}
						{/if}
					</div>
					<div class="flex items-center gap-2">
						<p class="text-[13px] font-bold tabular-nums text-foreground">
							{mPrix == null ? '—' : euro.format(mPrix)} HT
						</p>
						<button
							type="button"
							onclick={addMenuiserie}
							disabled={mPrix == null}
							title="Ajouter au panier"
							class={[
								'grid size-8 place-items-center rounded-lg shadow-sm transition-colors',
								mPrix == null
									? 'cursor-not-allowed bg-card2 text-muted-foreground/50'
									: 'bg-primary text-primary-foreground hover:bg-primary/90'
							].join(' ')}
						>
							<Plus class="size-4" strokeWidth={2.2} />
						</button>
					</div>
				</div>
			</div>
			{/if}

			{#if onglet === 'pergola'}
			<!-- Pergola solaire -->
			<div class="rounded-2xl border border-line bg-card p-3.5">
				<div class="flex items-center gap-2">
					<Sun class="size-4 shrink-0 text-muted-foreground" strokeWidth={1.7} />
					<div>
						<p class="text-[13px] font-semibold text-foreground">Pergola solaire</p>
						<p class="text-[10.5px] text-muted-foreground">
							Prix HT au m² dégressif selon largeur × avancée (book 2026, TVA 10 %)
						</p>
					</div>
				</div>

				<div class="mt-3 grid gap-2 sm:grid-cols-3">
					<label class="block">
						<span class="mb-1 block text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">
							Largeur (mm)
						</span>
						<input
							type="number"
							bind:value={pL}
							placeholder="ex. 4000"
							class="h-8 w-full rounded-lg border border-line bg-card2 px-2 text-[12.5px] font-semibold tabular-nums text-foreground outline-none"
						/>
					</label>
					<label class="block">
						<span class="mb-1 block text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">
							Avancée (mm)
						</span>
						<input
							type="number"
							bind:value={pA}
							placeholder="ex. 3000"
							class="h-8 w-full rounded-lg border border-line bg-card2 px-2 text-[12.5px] font-semibold tabular-nums text-foreground outline-none"
						/>
					</label>
					<label class="block">
						<span class="mb-1 block text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">
							Spots LED (option)
						</span>
						<select
							bind:value={pSpots}
							class="h-8 w-full rounded-lg border border-line bg-card2 px-2 text-[12.5px] font-medium text-foreground outline-none"
						>
							<option value={0}>Aucun</option>
							{#each PERGOLA_SPOTS as s}
								<option value={s.n}>{s.n} spots — {euro0.format(s.prixHT)}</option>
							{/each}
						</select>
					</label>
				</div>

				<div class="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-card2 px-3 py-2">
					<div class="text-[12px]">
						<p class="font-semibold text-foreground">
							{pEurM2 == null
								? 'Hors grille'
								: `${euro0.format(pEurM2)} / m² · ${pM2.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} m²`}
						</p>
						<p class="text-[10.5px] text-muted-foreground">
							{pLsnap} × {pAsnap} mm — {TVA_LABEL[PERGOLA_TVA]}
							{pSpots > 0 ? ` · +${euro0.format(pSpotsPrix)} spots` : ''}
						</p>
					</div>
					<div class="flex items-center gap-2">
						<p class="text-[13px] font-bold tabular-nums text-foreground">
							{pPrix == null ? '—' : euro.format(pPrix)} HT
						</p>
						<button
							type="button"
							onclick={addPergola}
							disabled={pPrix == null}
							title="Ajouter au panier"
							class={[
								'grid size-8 place-items-center rounded-lg shadow-sm transition-colors',
								pPrix == null
									? 'cursor-not-allowed bg-card2 text-muted-foreground/50'
									: 'bg-primary text-primary-foreground hover:bg-primary/90'
							].join(' ')}
						>
							<Plus class="size-4" strokeWidth={2.2} />
						</button>
					</div>
				</div>
			</div>
			{/if}
		</div>

		<!-- Panier -->
		<div class="min-w-0">
			<div
				class="sticky top-0 flex flex-col gap-3 rounded-2xl border border-line bg-card p-3.5 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto"
			>
				<div class="flex items-center gap-2">
					<ShoppingCart class="size-4 text-muted-foreground" strokeWidth={1.7} />
					<p class="text-[13px] font-semibold text-foreground">Panier</p>
					{#if lines.length > 0}
						<span
							class="ml-auto rounded-full bg-glass-3 px-2 py-0.5 text-[11px] font-semibold text-foreground"
						>
							{lines.length} ligne{lines.length > 1 ? 's' : ''}
						</span>
					{/if}
				</div>

				{#if lines.length === 0}
					<p class="rounded-xl border border-dashed border-line px-4 py-8 text-center text-[12.5px] text-muted-foreground">
						Ton panier est vide. Ajoute des produits du catalogue.
					</p>
				{:else}
					<div class="space-y-2">
						{#each lines as line (line.product.id)}
							<div class="rounded-xl border border-line bg-base px-2.5 py-2">
								<div class="flex items-start gap-2">
									<div class="min-w-0 flex-1">
										<p class="text-[12px] leading-snug font-medium text-foreground">
											{line.product.nom}
										</p>
										<p class="mt-0.5 text-[10.5px] text-muted-foreground">
											{euro.format(line.product.prixHT)} HT / unité · {TVA_LABEL[line.product.tva]}
										</p>
									</div>
									<button
										type="button"
										onclick={() => remove(line.product.id)}
										class="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-destructive"
										title="Retirer"
									>
										<X class="size-3.5" strokeWidth={2} />
									</button>
								</div>
								<div class="mt-1.5 flex items-center justify-between gap-2">
									<div
										class="flex items-center gap-1 rounded-lg border border-line bg-card2 p-0.5"
									>
										<button
											type="button"
											onclick={() => setQty(line.product.id, line.qty - 1)}
											class="grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-glass-3 hover:text-foreground"
										>
											−
										</button>
										<input
											type="number"
											min="1"
											value={line.qty}
											onchange={(e) =>
												setQty(line.product.id, Number(e.currentTarget.value) || 0)}
											class="w-12 bg-transparent text-center text-[12.5px] font-semibold text-foreground outline-none"
										/>
										<button
											type="button"
											onclick={() => setQty(line.product.id, line.qty + 1)}
											class="grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-glass-3 hover:text-foreground"
										>
											+
										</button>
									</div>
									<div class="text-right">
										<p class="text-[11.5px] font-semibold text-foreground">
											{euro.format(line.product.prixHT * line.qty)} HT
										</p>
										<p class="text-[11.5px] text-muted-foreground">
											{euro.format(line.product.prixHT * line.qty * (1 + line.product.tva))} TTC
										</p>
									</div>
								</div>
							</div>
						{/each}
					</div>

					<div class="space-y-1.5 border-t border-line pt-2.5">
						{#each tvaRates as rate}
							{@const g = totals.byTva.get(rate)!}
							<div class="flex items-center justify-between text-[12px]">
								<span class="font-medium text-muted-foreground">HT {pct(rate)}</span>
								<span class="tabular-nums text-foreground">{euro.format(g.ht)}</span>
							</div>
							<div class="flex items-center justify-between text-[12px]">
								<span class="pl-4 font-medium text-muted-foreground">dont TVA {pct(rate)}</span>
								<span class="tabular-nums text-muted-foreground">{euro.format(g.tva)}</span>
							</div>
							<div class="flex items-center justify-between text-[12px]">
								<span class="pl-4 font-medium text-muted-foreground">TTC {pct(rate)}</span>
								<span class="tabular-nums text-foreground">{euro.format(g.ttc)}</span>
							</div>
						{/each}
					</div>

					<div class="space-y-1 rounded-xl border border-line bg-card2 px-3 py-2.5">
						<div class="flex items-center justify-between text-[12.5px]">
							<span class="font-medium text-muted-foreground">Total HT</span>
							<span class="font-bold text-foreground">{euro.format(totals.totalHT)}</span>
						</div>
						<div class="flex items-center justify-between text-[12.5px]">
							<span class="font-medium text-muted-foreground">Total TVA</span>
							<span class="font-semibold text-muted-foreground">{euro.format(totals.totalTVA)}</span>
						</div>
						<div class="flex items-center justify-between border-t border-line pt-1.5 text-[14px]">
							<span class="font-semibold text-foreground">Total TTC</span>
							<span class="font-bold text-primary">{euro.format(totals.totalTTC)}</span>
						</div>
					</div>

					<button
						type="button"
						onclick={copyRecap}
						class="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-[13px] font-semibold text-primary-foreground shadow-md shadow-primary/10 transition-colors hover:bg-primary/90"
					>
						{#if copied}
							<Check class="size-4" strokeWidth={2.4} />
							Récap copié !
						{:else}
							<Copy class="size-4" strokeWidth={1.9} />
							Copier le récapitulatif
						{/if}
					</button>
				{/if}
			</div>
		</div>
	</div>

	<p class="px-1 text-[11px] text-muted-foreground">
		Prix HT annoncés du book de tarifs 2026 (colonne « prix annoncé », avant remise -20 %). TVA
		selon le récapitulatif bâtiment 2026. Menuiseries, volets battants et bannes : vendus au
		« point » (valeur du point réglable). Toiture & façade et Terrasses & vérandas : page
		« travaux » du book — la colonne POINTS (toiture, combles, façade, terrasse, véranda) est
		facturée points × valeur du point (hydrofuge façade : dégressif selon la surface) ; ardoise
		et pergola, imprimées en €/m², restent en €. Portails/portillons/clôtures exclus (hors
		catalogue demandé).
	</p>
</div>
