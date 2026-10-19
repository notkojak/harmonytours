<script lang="ts">
	import {
		Check,
		Copy,
		PhoneCall,
		RefreshCw,
		RotateCcw,
		Route,
		ShoppingCart,
		Sparkles,
		X
	} from '@lucide/svelte';
	import {
		euro,
		familleDeGrille,
		nombre,
		PRODUIT_BY_ID,
		recapTexte,
		totauxDevis,
		TVA_COURT,
		TVA_LABEL,
		type LigneDevis
	} from '$lib/data/book';
	import { supervisionRequise, type Opportunite } from '$lib/data/opportunite';
	import { effacerChantiers } from '$lib/data/regroupement';
	import { CARTE_SUCCES, TEXTE_ALERTE, TEXTE_SUCCES } from '$lib/chiffrage-style';
	import { Button } from '$lib/components/ui/button/index.js';
	import DialogOpportunite from './DialogOpportunite.svelte';
	import RegroupementClient from './RegroupementClient.svelte';
	import Anneau from './Anneau.svelte';

	let {
		lignes = $bindable<LigneDevis[]>([]),
		remise = $bindable(0),
		opportunite = $bindable<Opportunite | null>(null),
		flash = null,
		onQte,
		onSupprimer,
		onVider
	}: {
		lignes: LigneDevis[];
		/** remise effective du devis, toujours issue d'une DO négociée */
		remise: number;
		/** DO validée qui débloque la remise, ou null tant qu'aucune DO n'est faite */
		opportunite: Opportunite | null;
		/** uid de la dernière ligne ajoutée, mise en avant quelques instants. */
		flash?: string | null;
		onQte: (uid: string, q: number) => void;
		onSupprimer: (uid: string) => void;
		onVider: () => void;
	} = $props();

	const totaux = $derived(totauxDevis(lignes, remise));
	const rates = $derived([...totaux.parTva.keys()].sort((a, b) => a - b));
	let copied = $state(false);
	let doOuverte = $state(false);
	/** visuel client (points à valider puis chantiers programmés) */
	let visuelOuvert = $state(false);
	/** le regroupement a été présenté : la DO peut alors être engagée */
	let visuelFait = $state(false);
	let adresseClient = $state('');

	// Vider le panier remet le regroupement à zéro : le visuel présenté, l'adresse
	// retenue et les maisons mémorisées ne survivent pas à un devis vidé. On ne
	// réagit qu'au passage « il y avait des lignes → il n'y en a plus » pour ne
	// pas effacer la mémoire pendant le chargement initial du devis.
	let avaitDesLignes = lignes.length > 0;
	$effect(() => {
		const aDesLignes = lignes.length > 0;
		if (!aDesLignes && avaitDesLignes) {
			visuelFait = false;
			adresseClient = '';
			effacerChantiers();
		}
		avaitDesLignes = aDesLignes;
	});

	const projet = $derived(lignes[0]?.designation ?? '');

	/**
	 * Famille du book du premier article du devis. Les chantiers programmés
	 * montrés au client en seront les cousins : un client volets voit des volets,
	 * des fenêtres et des portes d'entrée.
	 */
	const familleClient = $derived.by(() => {
		const ref = lignes[0]?.ref;
		if (!ref) return '';
		return PRODUIT_BY_ID.get(ref)?.famille ?? familleDeGrille(ref) ?? '';
	});

	function recevoirDo(o: Opportunite) {
		opportunite = o;
		remise = o.remise;
	}

	/** L'adresse validée devant le client resert à la DO : une seule saisie. */
	function finirVisuel(adresse: string) {
		adresseClient = adresse;
		visuelFait = true;
	}

	function retirerDo() {
		opportunite = null;
		remise = 0;
	}

	const jourDo = (ms: number) =>
		new Date(ms).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

	async function copier() {
		if (!lignes.length) return;
		try {
			await navigator.clipboard.writeText(recapTexte(lignes, remise));
			copied = true;
			setTimeout(() => (copied = false), 1800);
		} catch {
			copied = false;
		}
	}

	const uniteLabel = (u: string) => (u === 'u' ? '' : u === 'm2' ? ' m²' : ' ml');
</script>

<div class="flex flex-col gap-3 rounded-2xl border border-line bg-card p-3.5 shadow-[var(--ombre)]">
	<div class="flex items-center gap-2">
		<ShoppingCart class="size-4 text-ink-soft" strokeWidth={1.7} />
		<p class="text-[13px] font-semibold text-ink">Devis</p>
		{#if lignes.length}
			<span class="rounded-full bg-glass-3 px-2 py-0.5 text-[11px] font-semibold text-ink">
				{lignes.length} ligne{lignes.length > 1 ? 's' : ''}
			</span>
			<Button
				variant="ghost"
				size="xs"
				class="ml-auto hover:text-destructive"
				onclick={onVider}
				title="Vider le devis"
			>
				<RotateCcw class="size-3.5" strokeWidth={1.7} /> Vider
			</Button>
		{/if}
	</div>

	{#if lignes.length === 0}
		<div
			class="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-[12.5px] text-ink-soft"
		>
			Ton devis est vide.<br />
			Choisis une gamme, règle les cotes, puis ajoute : le total se met à jour en direct.
		</div>
	{:else}
		<div class="max-h-[42vh] space-y-2 overflow-y-auto pr-0.5 lg:max-h-[46vh]">
			{#each lignes as l (l.uid)}
				<div
					class={[
						'rounded-2xl border bg-base px-2.5 py-2 transition-colors duration-500',
						l.uid === flash ? 'border-brand/60 bg-brand/5' : 'border-line'
					].join(' ')}
				>
					<div class="flex items-start gap-2">
						<div class="min-w-0 flex-1">
							<p class="text-[12px] leading-snug font-medium text-ink">{l.designation}</p>
							{#if l.detail}
								<p class="mt-0.5 text-[10.5px] leading-snug text-ink-soft">{l.detail}</p>
							{/if}
							<p class="mt-0.5 text-[10.5px] text-ink-mute">
								{euro.format(l.prixUnitaireHT)} HT /
								{l.unite === 'u' ? 'unité' : l.unite === 'm2' ? 'm²' : 'ml'} · {TVA_COURT[l.tva]}
							</p>
						</div>
						<button
							type="button"
							onclick={() => onSupprimer(l.uid)}
							title="Retirer la ligne"
							class="shrink-0 rounded-full p-1 text-ink-mute transition-colors hover:text-destructive"
						>
							<X class="size-3.5" strokeWidth={2} />
						</button>
					</div>
					<div class="mt-1.5 flex items-center justify-between gap-2">
						<div
							class="flex items-center gap-1 rounded-full border border-line bg-card2 p-0.5 transition-[border-color,box-shadow] focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15"
						>
							<button
								type="button"
								onclick={() => onQte(l.uid, l.quantite - 1)}
								class="grid size-6 place-items-center rounded-full text-ink-soft transition-colors hover:bg-glass-3 hover:text-ink"
							>
								−
							</button>
							<input
								type="number"
								min="0"
								step="any"
								value={l.quantite}
								onchange={(e) => onQte(l.uid, Number(e.currentTarget.value) || 0)}
								class="w-14 bg-transparent text-center text-[12.5px] font-semibold text-ink tabular-nums outline-none"
							/>
							<button
								type="button"
								onclick={() => onQte(l.uid, l.quantite + 1)}
								class="grid size-6 place-items-center rounded-full text-ink-soft transition-colors hover:bg-glass-3 hover:text-ink"
							>
								+
							</button>
						</div>
						<span class="text-[10.5px] font-medium text-ink-mute"
							>{nombre.format(l.quantite)}{uniteLabel(l.unite)}</span
						>
						<div class="text-right">
							<p class="text-[11.5px] font-semibold text-ink">
								{euro.format(l.prixUnitaireHT * l.quantite * (1 - remise / 100))} HT
							</p>
							<p class="text-[11px] text-ink-soft">
								{euro.format(l.prixUnitaireHT * l.quantite * (1 - remise / 100) * (1 + l.tva))} TTC
							</p>
						</div>
					</div>
				</div>
			{/each}
		</div>

		<!-- La remise ne se saisit pas : elle se négocie par la DO, contre des contreparties. -->
		{#if opportunite}
			<div class={['rounded-2xl border px-2.5 py-2', CARTE_SUCCES].join(' ')}>
				<div class="flex items-center gap-2">
					<Anneau
						progres={opportunite.remise / 40}
						taille={40}
						epaisseur={3}
						ton={supervisionRequise(opportunite.remise) ? 'danger' : 'brand'}
					>
						<span class="text-[11px] font-black {TEXTE_SUCCES}">DO</span>
					</Anneau>
					<div class="min-w-0 flex-1">
						<p class="text-[12.5px] font-bold text-ink">
							−{opportunite.remise} % négociés
						</p>
						<p class="truncate text-[10.5px] text-ink-soft">
							{opportunite.secteur || opportunite.adresse || 'Opportunité créée'} ·
							{jourDo(opportunite.le)}
						</p>
					</div>
					<button
						type="button"
						onclick={() => (doOuverte = true)}
						title="Refaire la DO"
						class="shrink-0 rounded-full p-1 text-ink-soft transition-colors hover:text-brand"
					>
						<RefreshCw class="size-3.5" strokeWidth={2} />
					</button>
					<button
						type="button"
						onclick={retirerDo}
						title="Retirer la DO"
						class="shrink-0 rounded-full p-1 text-ink-mute transition-colors hover:text-destructive"
					>
						<X class="size-3.5" strokeWidth={2} />
					</button>
				</div>
				<p class="mt-1.5 text-[10.5px] leading-snug text-ink-mute">
					{opportunite.chantiers.length} chantier{opportunite.chantiers.length > 1 ? 's' : ''} regroupé{opportunite
						.chantiers.length > 1
						? 's'
						: ''}
					{#if opportunite.valideePar}
						· assumée par <span class="font-semibold {TEXTE_ALERTE}">{opportunite.valideePar}</span>
					{:else}
						· accordée par <span class="font-semibold text-ink-soft">{opportunite.responsable}</span
						>
					{/if}
				</p>
			</div>
		{:else if visuelFait}
			<!-- Le visuel client a été montré : la DO peut être engagée, hors de sa vue. -->
			<div class="space-y-1.5">
				<div class={['rounded-2xl border px-2.5 py-2', CARTE_SUCCES].join(' ')}>
					<p class="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
						<Check class="size-3.5 {TEXTE_SUCCES}" strokeWidth={2.8} /> Regroupement présenté au client
					</p>
					<p class="mt-0.5 truncate text-[10.5px] text-ink-mute">
						{adresseClient || 'Adresse non renseignée'}
					</p>
				</div>
				<div class="flex gap-1.5">
					<Button class="flex-1" onclick={() => (doOuverte = true)}>
						<PhoneCall class="size-4" strokeWidth={2} /> Appeler le responsable
					</Button>
					<Button
						variant="outline"
						size="icon"
						title="Revoir le visuel client"
						onclick={() => (visuelOuvert = true)}
					>
						<Route class="size-4" strokeWidth={1.9} />
					</Button>
				</div>
			</div>
		{:else}
			<Button class="w-full" onclick={() => (visuelOuvert = true)}>
				<Sparkles class="size-4" strokeWidth={2.1} /> Valider le devis
			</Button>
		{/if}

		<!--
			Un seul récapitulatif : le détail par taux doublonnait HT, TVA et TTC
			avec les totaux dès qu'un devis ne portait qu'une TVA. Chaque taux garde
			sa ligne de TVA ; le total par taux n'apparaît que s'il y en a plusieurs.
		-->
		<div class="space-y-1 rounded-2xl border border-line bg-card2 px-3 py-2.5">
			<div class="flex items-center justify-between text-[12.5px]">
				<span class="font-medium text-ink-soft">Total HT</span>
				<span class="font-bold text-ink tabular-nums">{euro.format(totaux.totalHT)}</span>
			</div>
			{#each rates as rate (rate)}
				{@const g = totaux.parTva.get(rate)!}
				<div class="flex items-center justify-between text-[12.5px]">
					<span class="pl-3 text-ink-mute">{TVA_LABEL[rate]}</span>
					<span class="text-ink-soft tabular-nums">{euro.format(g.tva)}</span>
				</div>
			{/each}
			{#if rates.length > 1}
				<div class="flex items-center justify-between text-[12.5px]">
					<span class="font-medium text-ink-soft">Total TVA</span>
					<span class="font-semibold text-ink-soft tabular-nums"
						>{euro.format(totaux.totalTVA)}</span
					>
				</div>
			{/if}
			<div class="flex items-center justify-between border-t border-line pt-1.5 text-[14px]">
				<span class="font-semibold text-ink">Total TTC</span>
				<span class="font-bold text-primary tabular-nums">{euro.format(totaux.totalTTC)}</span>
			</div>
		</div>

		<Button variant="outline" class="w-full" onclick={copier}>
			{#if copied}
				<Check class="size-4" strokeWidth={2.4} /> Récap copié !
			{:else}
				<Copy class="size-4" strokeWidth={1.9} /> Copier le récapitulatif
			{/if}
		</Button>
	{/if}
</div>
<RegroupementClient
	bind:open={visuelOuvert}
	bind:adresse={adresseClient}
	famille={familleClient}
	onTerminer={finirVisuel}
/>

<DialogOpportunite
	bind:open={doOuverte}
	{projet}
	adresseInitiale={adresseClient}
	totalTTC={totaux.totalTTC}
	onValider={recevoirDo}
/>
