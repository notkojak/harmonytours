<script lang="ts">
	import { coteProche, prixGrille, type Grille } from '$lib/data/book';
	import { FOCUS_CHAMP } from '$lib/chiffrage-style';

	let {
		grille,
		h = $bindable(0),
		l = $bindable(0)
	}: { grille: Grille; h: number; l: number } = $props();

	const hauteurs = $derived([...new Set(grille.lignes.map((x) => x.d.v))].sort((a, b) => a - b));
	const largeurs = $derived(grille.cols.map((c) => c.v));
	const libH = $derived(new Map(grille.lignes.map((x) => [x.d.v, x.d.l] as const)));
	const libL = $derived(new Map(grille.cols.map((c) => [c.v, c.l] as const)));

	const court = (v: number) => v.toLocaleString('fr-FR');
	const lib = (v: number, m: Map<number, string | undefined>) => m.get(v) ?? `${court(v)} mm`;

	// Échelle de teinte : la carte de chaleur montre d'un coup d'œil où le prix
	// décolle (grandes largeurs) et où la grille s'arrête (cases « — »).
	const bornes = $derived.by(() => {
		let min = Infinity;
		let max = -Infinity;
		for (const lg of grille.lignes) {
			for (const p of lg.p) {
				if (p == null) continue;
				if (p < min) min = p;
				if (p > max) max = p;
			}
		}
		return { min, max };
	});

	function teinte(p: number | null) {
		if (p == null) return '';
		const t = bornes.max === bornes.min ? 0.5 : (p - bornes.min) / (bornes.max - bornes.min);
		return `background: color-mix(in srgb, var(--brand) ${(4 + t * 30).toFixed(1)}%, transparent)`;
	}

	const iH = $derived(Math.max(0, hauteurs.indexOf(h)));
	const iL = $derived(Math.max(0, largeurs.indexOf(l)));
	const prixSel = $derived(prixGrille(grille, { v: h }, { v: l }));

	function saisirH(v: string) {
		h = coteProche(Number(v.replace(',', '.')) || hauteurs[0], hauteurs);
	}
	function saisirL(v: string) {
		l = coteProche(Number(v.replace(',', '.')) || largeurs[0], largeurs);
	}
</script>

{#snippet curseur(
	nom: string,
	cotes: number[],
	index: number,
	libelles: Map<number, string | undefined>,
	set: (v: number) => void
)}
	<div class="flex items-center gap-2">
		<span class="w-3 shrink-0 text-[10px] font-bold text-ink-mute">{nom}</span>
		<input
			type="range"
			min="0"
			max={Math.max(0, cotes.length - 1)}
			value={index}
			oninput={(e) => set(cotes[Number(e.currentTarget.value)])}
			class="h-1.5 min-w-0 flex-1 cursor-pointer"
			style="accent-color: var(--brand)"
		/>
		<span class="w-20 shrink-0 truncate text-right text-[10.5px] font-medium text-ink-soft">
			{lib(cotes[index], libelles)}
		</span>
	</div>
{/snippet}

<div class="space-y-3">
	<div class="grid gap-2 sm:grid-cols-2">
		<label class="block">
			<span class="mb-1 block text-[10px] font-semibold tracking-wide text-ink-mute uppercase">
				Hauteur mesurée
			</span>
			<div class="flex items-center gap-2">
				<input
					type="number"
					value={h}
					onchange={(e) => saisirH(e.currentTarget.value)}
					class="h-11 min-w-0 flex-1 rounded-full border border-input bg-card px-5 text-[15px] font-semibold text-ink tabular-nums {FOCUS_CHAMP}"
				/>
				<span class="shrink-0 text-[11px] text-ink-mute">mm</span>
			</div>
			<p class="mt-1 truncate text-[10.5px] text-ink-mute">calé sur {lib(h, libH)}</p>
		</label>
		<label class="block">
			<span class="mb-1 block text-[10px] font-semibold tracking-wide text-ink-mute uppercase">
				Largeur mesurée
			</span>
			<div class="flex items-center gap-2">
				<input
					type="number"
					value={l}
					onchange={(e) => saisirL(e.currentTarget.value)}
					class="h-11 min-w-0 flex-1 rounded-full border border-input bg-card px-5 text-[15px] font-semibold text-ink tabular-nums {FOCUS_CHAMP}"
				/>
				<span class="shrink-0 text-[11px] text-ink-mute">mm</span>
			</div>
			<p class="mt-1 truncate text-[10.5px] text-ink-mute">calé sur {lib(l, libL)}</p>
		</label>
	</div>

	<div class="rounded-2xl border border-line bg-card2/60 p-2.5">
		<div class="flex items-center justify-between gap-3">
			<p class="text-[10.5px] font-semibold text-ink-soft">
				Clique une case, ou glisse pour balayer la grille
			</p>
			<p class="shrink-0 text-[11px] font-bold text-ink tabular-nums">
				{prixSel == null ? 'hors grille' : `${court(Math.round(prixSel))} € HT`}
			</p>
		</div>

		<div class="mt-2 space-y-1.5">
			{@render curseur('H', hauteurs, iH, libH, (v) => (h = v))}
			{@render curseur('L', largeurs, iL, libL, (v) => (l = v))}
		</div>

		<div class="-mx-0.5 mt-2.5 overflow-x-auto pb-1">
			<table class="border-separate border-spacing-[2px]">
				<thead>
					<tr>
						<th class="sticky left-0 z-10 bg-card2">
							<span class="block w-12 text-[9px] font-semibold text-ink-mute">H \ L</span>
						</th>
						{#each largeurs as lv (lv)}
							<th>
								<button
									type="button"
									onclick={() => (l = lv)}
									title={lib(lv, libL)}
									class={[
										'w-9 rounded-full py-1 text-[9.5px] font-semibold tabular-nums transition-colors',
										lv === l ? 'bg-brand text-white' : 'text-ink-soft hover:text-ink'
									].join(' ')}
								>
									{court(lv)}
								</button>
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each hauteurs as hv (hv)}
						<tr>
							<th class="sticky left-0 z-10 bg-card2">
								<button
									type="button"
									onclick={() => (h = hv)}
									title={lib(hv, libH)}
									class={[
										'w-12 rounded-full py-1 text-[9.5px] font-semibold tabular-nums transition-colors',
										hv === h ? 'bg-brand text-white' : 'text-ink-soft hover:text-ink'
									].join(' ')}
								>
									{court(hv)}
								</button>
							</th>
							{#each largeurs as lv (lv)}
								{@const p = prixGrille(grille, { v: hv }, { v: lv })}
								{@const actif = hv === h && lv === l}
								<td>
									<button
										type="button"
										disabled={p == null}
										onclick={() => {
											h = hv;
											l = lv;
										}}
										title={p == null
											? `${court(hv)} × ${court(lv)} — hors grille`
											: `${lib(hv, libH)} × ${lib(lv, libL)} — ${court(p)} € HT`}
										style={teinte(p)}
										class={[
											'w-9 rounded-full py-[3px] text-[9px] tabular-nums transition-all',
											actif
												? 'font-bold text-ink ring-2 ring-brand ring-inset'
												: p == null
													? 'cursor-not-allowed bg-glass-1 text-ink-mute/50'
													: 'text-ink-soft hover:text-ink'
										].join(' ')}
									>
										{p == null ? '—' : court(Math.round(p))}
									</button>
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div class="mt-1.5 flex items-center gap-2">
			<span class="text-[9.5px] text-ink-mute">{court(Math.round(bornes.min))} €</span>
			<span
				class="h-1.5 flex-1 rounded-full"
				style="background: linear-gradient(90deg, color-mix(in srgb, var(--brand) 4%, transparent), color-mix(in srgb, var(--brand) 34%, transparent))"
			></span>
			<span class="text-[9.5px] text-ink-mute">{court(Math.round(bornes.max))} €</span>
		</div>
	</div>

	{#if grille.notes}
		<p class="text-[10.5px] leading-snug text-ink-mute">{grille.notes}</p>
	{/if}
</div>
