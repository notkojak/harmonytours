<script lang="ts">
	import {
		Check,
		Copy,
		PhoneCall,
		RotateCcw,
		Route,
		ShoppingCart,
		Sparkles,
		X
	} from '@lucide/svelte';
	import {
		euro,
		FAMILLE_BY_ID,
		familleDeGrille,
		nombre,
		PRODUIT_BY_ID,
		recapTexte,
		totauxDevis,
		TVA_COURT,
		TVA_LABEL,
		type LigneDevis
	} from '$lib/data/book';
	import { REMISE_MAX, RESPONSABLE_POSES, type Deblocage } from '$lib/data/deblocage';
	import { effacerChantiers } from '$lib/data/regroupement';
	import { TEXTE_SUCCES } from '$lib/chiffrage-style';
	import { Button } from '$lib/components/ui/button/index.js';
	import { useQuery } from 'convex-svelte';
	import { api } from '../../../convex/_generated/api.js';
	import { authState } from '$lib/auth-state.svelte';
	import { isAdministrateur } from '$lib/data/roles';
	import RegroupementClient from './RegroupementClient.svelte';
	import Anneau from './Anneau.svelte';

	let {
		lignes = $bindable<LigneDevis[]>([]),
		remise = $bindable(0),
		deblocage = $bindable<Deblocage | null>(null),
		flash = null,
		onQte,
		onSupprimer,
		onVider
	}: {
		lignes: LigneDevis[];
		/** remise effective du devis, toujours issue d'un déblocage */
		remise: number;
		/** place ouverte par le responsable (code saisi), ou null tant qu'aucune */
		deblocage: Deblocage | null;
		/** uid de la dernière ligne ajoutée, mise en avant quelques instants. */
		flash?: string | null;
		onQte: (uid: string, q: number) => void;
		onSupprimer: (uid: string) => void;
		onVider: () => void;
	} = $props();

	// Le regroupement (et donc le déblocage d'une place) reste réservé aux
	// administrateurs : les autres rôles chiffrent sans l'ouvrir.
	const profile = useQuery(api.users.getProfile, () => (authState.isAuthenticated ? {} : 'skip'));
	const peutValider = $derived(isAdministrateur(profile.data?.role));

	const totaux = $derived(totauxDevis(lignes, remise));
	/** Les totaux pleins, pour montrer d'où part la remise. */
	const totauxPlein = $derived(totauxDevis(lignes, 0));
	/** Le chiffre final avant remise : c'est lui que le code remise. */
	const totalPlein = $derived(totauxPlein.totalTTC);
	const montantOffert = $derived((totalPlein * (deblocage?.remise ?? 0)) / 100);
	const remiseHT = $derived(totauxPlein.totalHT - totaux.totalHT);
	const rates = $derived([...totaux.parTva.keys()].sort((a, b) => a - b));
	let copied = $state(false);
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

	/** Gamme lisible du produit du devis, pour le message de DO copié. */
	const gammeClient = $derived(FAMILLE_BY_ID.get(familleClient)?.nom ?? familleClient);

	/** Le code a ouvert une place dans le regroupement : la remise s'applique. */
	function debloquer(taux: number) {
		deblocage = { remise: taux, le: Date.now() };
		remise = taux;
	}

	/** L'adresse validée devant le client resert à la DO : une seule saisie. */
	function finirVisuel(adresse: string) {
		adresseClient = adresse;
		visuelFait = true;
	}

	function retirerDeblocage() {
		deblocage = null;
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

<div class="flex flex-col gap-3 rounded-2xl bg-card2 p-3.5">
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
		<div class="rounded-2xl bg-card px-4 py-8 text-center text-[12.5px] text-ink-soft">
			Ton devis est vide.<br />
			Choisis une gamme, règle les cotes, puis ajoute : le total se met à jour en direct.
		</div>
	{:else}
		<div class="max-h-[42vh] space-y-2 overflow-y-auto pr-0.5 lg:max-h-[46vh]">
			{#each lignes as l (l.uid)}
				<div
					class={[
						'rounded-2xl px-2.5 py-2 transition-colors duration-500',
						l.uid === flash ? 'bg-brand/10' : 'bg-card'
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
							class="flex items-center gap-1 rounded-full bg-card2 p-0.5 transition-[box-shadow] focus-within:ring-2 focus-within:ring-ink/10"
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

		<!-- La remise ne se saisit pas : elle s'ouvre avec le code du responsable
		     des poses, saisi dans le regroupement présenté au client. -->
		{#if deblocage}
			<div class="rounded-2xl bg-brand/10 px-2.5 py-2">
				<div class="flex items-center gap-2">
					<Anneau progres={deblocage.remise / REMISE_MAX} taille={40} epaisseur={3} ton="brand">
						<span class="text-[10.5px] font-black {TEXTE_SUCCES}">−{deblocage.remise}%</span>
					</Anneau>
					<div class="min-w-0 flex-1">
						<p class="text-[12.5px] font-bold text-ink">Place de pose débloquée</p>
						<p class="truncate text-[10.5px] text-ink-soft">
							{euro.format(montantOffert)} offerts · {jourDo(deblocage.le)}
						</p>
					</div>
					<button
						type="button"
						onclick={retirerDeblocage}
						title="Retirer la remise"
						class="shrink-0 rounded-full p-1 text-ink-mute transition-colors hover:text-destructive"
					>
						<X class="size-3.5" strokeWidth={2} />
					</button>
				</div>
				<p class="mt-1.5 text-[10.5px] leading-snug text-ink-mute">
					Ouverte par {RESPONSABLE_POSES.nom}, {RESPONSABLE_POSES.role.toLowerCase()}
				</p>
			</div>
		{/if}

		<!-- Le regroupement se revoit à tout moment une fois présenté. Sans place
		     ouverte, le numéro du responsable est rappelé à côté. -->
		{#if peutValider && (visuelFait || deblocage)}
			<div class="space-y-1.5">
				{#if !deblocage}
					<div class="rounded-2xl bg-card px-3 py-2.5">
						<a href={RESPONSABLE_POSES.telLien} class="group flex items-center gap-2.5">
							<span class="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-white">
								<PhoneCall class="size-4" strokeWidth={2.2} />
							</span>
							<span class="min-w-0 flex-1">
								<span class="block text-[9.5px] font-bold tracking-wider text-ink-mute uppercase">
									{RESPONSABLE_POSES.role}
								</span>
								<span class="block truncate text-[12.5px] font-semibold text-ink">
									{RESPONSABLE_POSES.nom}
								</span>
							</span>
							<span
								class="shrink-0 text-[13px] font-black text-ink tabular-nums underline decoration-brand/40 decoration-2 underline-offset-4 transition-colors group-hover:text-brand"
							>
								{RESPONSABLE_POSES.tel}
							</span>
						</a>
					</div>
				{/if}
				<Button variant="outline" class="w-full" onclick={() => (visuelOuvert = true)}>
					<Route class="size-4" strokeWidth={1.9} /> Revoir le regroupement
				</Button>
			</div>
		{:else if peutValider}
			<Button class="w-full" onclick={() => (visuelOuvert = true)}>
				<Sparkles class="size-4" strokeWidth={2.1} /> Valider le devis
			</Button>
		{/if}

		<!--
			Un seul récapitulatif : le détail par taux doublonnait HT, TVA et TTC
			avec les totaux dès qu'un devis ne portait qu'une TVA. Chaque taux garde
			sa ligne de TVA ; le total par taux n'apparaît que s'il y en a plusieurs.
		-->
		<div class="space-y-1 rounded-2xl bg-card px-3 py-2.5">
			<div class="flex items-center justify-between text-[12.5px]">
				<span class="font-medium text-ink-soft">Total HT</span>
				<span class="flex items-baseline gap-1.5 tabular-nums">
					{#if remise > 0}
						<span class="text-[11.5px] font-medium text-ink-mute line-through">
							{euro.format(totauxPlein.totalHT)}
						</span>
					{/if}
					<span class="font-bold text-ink">{euro.format(totaux.totalHT)}</span>
				</span>
			</div>
			{#if remise > 0}
				<div class="flex items-center justify-between text-[12.5px]">
					<span class="font-semibold {TEXTE_SUCCES}">Remise −{remise} %</span>
					<span class="font-bold {TEXTE_SUCCES} tabular-nums">−{euro.format(remiseHT)}</span>
				</div>
			{/if}
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
			<div class="flex items-center justify-between pt-1.5 text-[14px]">
				<span class="font-semibold text-ink">Total TTC</span>
				<span class="flex items-baseline gap-1.5 tabular-nums">
					{#if remise > 0}
						<span class="text-[12px] font-medium text-ink-mute line-through">
							{euro.format(totauxPlein.totalTTC)}
						</span>
					{/if}
					<span class="font-bold text-primary">{euro.format(totaux.totalTTC)}</span>
				</span>
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
	gamme={gammeClient}
	totalTTC={totalPlein}
	debloque={deblocage !== null}
	remiseDebloquee={deblocage?.remise ?? null}
	reprendre={visuelFait || deblocage !== null}
	onTerminer={finirVisuel}
	onDebloquer={debloquer}
/>
