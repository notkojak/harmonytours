<script lang="ts">
	import { goto } from '$app/navigation';
	import { useQuery } from 'convex-svelte';
	import { CornerDownLeft, Search, X } from '@lucide/svelte';
	import { api } from '../../convex/_generated/api.js';
	import { authState } from '$lib/auth-state.svelte';
	import { FAMILLES, grillesVendables, produitsDeFamille } from '$lib/data/book';

	type Groupe = 'client' | 'contact' | 'vente' | 'produit';

	// « dark » : barre posée sur le fond noir de la fenêtre (chrome).
	let { variant = 'light' }: { variant?: 'light' | 'dark' } = $props();
	const sombre = $derived(variant === 'dark');

	type Resultat = {
		id: string;
		groupe: Groupe;
		emoji: string;
		label: string;
		detail: string;
		href: string;
	};

	let recherche = $state('');
	let requete = $state('');
	let ouvert = $state(false);
	let index = $state(0);
	let champ = $state<HTMLInputElement | null>(null);
	let conteneur = $state<HTMLDivElement | null>(null);
	let timer: ReturnType<typeof setTimeout> | undefined;

	// Petite temporisation pour ne pas interroger Convex à chaque frappe.
	$effect(() => {
		const valeur = recherche.trim();
		clearTimeout(timer);
		timer = setTimeout(() => (requete = valeur), 180);
		return () => clearTimeout(timer);
	});

	const actif = $derived(requete.length >= 2);

	// Contacts et clients : la recherche serveur applique déjà le périmètre du
	// commercial (il ne voit que ses fiches, les managers voient leur agence/zone).
	const contacts = useQuery(api.contacts.search, () =>
		authState.isAuthenticated && actif ? { q: requete, limit: 20 } : 'skip'
	);

	// Ventes : listClients renvoie les clients du périmètre avec leurs ventes.
	const clients = useQuery(api.ventes.listClients, () =>
		authState.isAuthenticated && actif ? {} : 'skip'
	);

	// Catalogue du book : mêmes entrées que la recherche de la page Chiffrage.
	const produits = $derived.by(() => {
		const q = requete.toLowerCase();
		if (q.length < 2) return [];
		const entrees: { label: string; detail: string }[] = [];
		const vus = new Set<string>();
		const ajouter = (label: string, detail: string) => {
			if (vus.has(label)) return;
			vus.add(label);
			entrees.push({ label, detail });
		};
		for (const famille of FAMILLES) {
			for (const p of produitsDeFamille(famille.id)) {
				ajouter(p.nom, `${famille.nom} · ${p.categorie}`);
			}
			for (const g of grillesVendables(famille.id)) {
				ajouter(g.nom, `${famille.nom} · ${g.categorie}`);
			}
		}
		return entrees.filter((e) => `${e.label} ${e.detail}`.toLowerCase().includes(q)).slice(0, 6);
	});

	const resultats = $derived.by(() => {
		if (!actif) return [];
		const items: Resultat[] = [];

		// Contacts et clients.
		for (const c of contacts.data ?? []) {
			if (c.isClient) {
				items.push({
					id: `client:${c._id}`,
					groupe: 'client',
					emoji: '👥',
					label: c.name,
					detail: [c.phone, c.address].filter(Boolean).join(' · ') || 'Client',
					href: `/clients?q=${encodeURIComponent(c.name)}`
				});
			} else {
				items.push({
					id: `contact:${c._id}`,
					groupe: 'contact',
					emoji: '🤝',
					label: c.name,
					detail: [c.phone, c.address].filter(Boolean).join(' · ') || 'Contact',
					href: `/contacts?q=${encodeURIComponent(c.name)}`
				});
			}
		}

		// Ventes : on cherche dans le client, les produits et le commercial.
		const terme = requete.toLowerCase();
		const ventes: Resultat[] = [];
		for (const client of clients.data ?? []) {
			for (const vente of client.ventes) {
				const nomsProduits = [...new Set(vente.produits.map((p) => p.produit))].join(', ');
				const commercial = vente.vendeurDisplay ?? vente.vendeurName ?? '';
				const haystack = `${client.contact.name} ${nomsProduits} ${commercial}`.toLowerCase();
				if (!haystack.includes(terme)) continue;
				ventes.push({
					id: `vente:${vente._id}`,
					groupe: 'vente',
					emoji: '🧾',
					label: client.contact.name,
					detail: [nomsProduits, commercial].filter(Boolean).join(' · ') || 'Vente',
					href: `/ventes?q=${encodeURIComponent(client.contact.name)}`
				});
				if (ventes.length >= 6) break;
			}
			if (ventes.length >= 6) break;
		}
		items.push(...ventes);

		// Produits du book.
		for (const [i, p] of produits.entries()) {
			items.push({
				id: `produit:${i}:${p.label}`,
				groupe: 'produit',
				emoji: '📦',
				label: p.label,
				detail: p.detail,
				href: `/chiffrage?q=${encodeURIComponent(p.label)}`
			});
		}

		return items;
	});

	const groupes = $derived.by(() => {
		const ordre: { groupe: Groupe; titre: string }[] = [
			{ groupe: 'client', titre: 'Clients' },
			{ groupe: 'contact', titre: 'Contacts' },
			{ groupe: 'vente', titre: 'Ventes' },
			{ groupe: 'produit', titre: 'Produits' }
		];
		return ordre
			.map((o) => ({ ...o, items: resultats.filter((r) => r.groupe === o.groupe) }))
			.filter((g) => g.items.length > 0);
	});

	const plat = $derived(groupes.flatMap((g) => g.items));

	$effect(() => {
		if (index >= plat.length) index = Math.max(0, plat.length - 1);
	});

	function reinitialiser() {
		recherche = '';
		requete = '';
		ouvert = false;
		index = 0;
	}

	function ouvrirResultat(resultat: Resultat) {
		reinitialiser();
		champ?.blur();
		goto(resultat.href);
	}

	function surTouche(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			ouvert = false;
			champ?.blur();
			return;
		}
		if (!ouvert || plat.length === 0) return;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			index = (index + 1) % plat.length;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			index = (index - 1 + plat.length) % plat.length;
		} else if (e.key === 'Enter') {
			e.preventDefault();
			const resultat = plat[index];
			if (resultat) ouvrirResultat(resultat);
		}
	}

	function surClicFenetre(e: MouseEvent) {
		if (!ouvert) return;
		if (conteneur && !conteneur.contains(e.target as Node)) ouvert = false;
	}

	function surToucheFenetre(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			champ?.focus();
			ouvert = true;
		}
	}
</script>

<svelte:window onclick={surClicFenetre} onkeydown={surToucheFenetre} />

<div class="relative w-full" bind:this={conteneur}>
	<div
		class={[
			'flex h-10 items-center gap-2.5 rounded-full px-4 transition-[box-shadow] focus-within:ring-2',
			sombre ? 'bg-white/8 focus-within:ring-white/15' : 'bg-card2 focus-within:ring-ink/10'
		].join(' ')}
	>
		<Search
			class={['size-4 shrink-0', sombre ? 'text-white/40' : 'text-muted-foreground'].join(' ')}
			strokeWidth={1.7}
		/>
		<input
			bind:this={champ}
			type="search"
			placeholder="Rechercher un client, une vente, un produit…"
			bind:value={recherche}
			onfocus={() => (ouvert = true)}
			onkeydown={surTouche}
			class={[
				'h-full w-full min-w-0 bg-transparent text-[13px] outline-none [&::-webkit-search-cancel-button]:hidden',
				sombre
					? 'text-white placeholder:text-white/35'
					: 'text-foreground placeholder:text-muted-foreground'
			].join(' ')}
		/>
		{#if recherche}
			<button
				type="button"
				onclick={reinitialiser}
				class={[
					'shrink-0 rounded-full p-1 transition-colors',
					sombre ? 'text-white/40 hover:text-white' : 'text-muted-foreground hover:text-foreground'
				].join(' ')}
				aria-label="Effacer la recherche"
			>
				<X class="size-3.5" strokeWidth={2} />
			</button>
		{:else}
			<kbd
				class={[
					'hidden shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium sm:block',
					sombre ? 'bg-white/10 text-white/40' : 'bg-card text-muted-foreground'
				].join(' ')}
			>
				Ctrl K
			</kbd>
		{/if}
	</div>

	{#if ouvert && actif}
		<div
			class="absolute top-full right-0 left-0 z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-2xl bg-popover p-1.5 shadow-[var(--ombre-forte)]"
		>
			{#each groupes as groupe (groupe.groupe)}
				<p
					class="px-2 pt-1.5 pb-1 text-[10.5px] font-semibold tracking-wider text-muted-foreground uppercase"
				>
					{groupe.titre}
				</p>
				{#each groupe.items as resultat (resultat.id)}
					{@const actifItem = plat.indexOf(resultat) === index}
					<button
						type="button"
						onclick={() => ouvrirResultat(resultat)}
						onmouseenter={() => (index = plat.indexOf(resultat))}
						class={[
							'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors',
							actifItem ? 'bg-glass-3' : 'hover:bg-glass-2'
						].join(' ')}
					>
						<span
							class="grid size-7 shrink-0 place-items-center rounded-xl bg-card2 text-[13px]"
							aria-hidden="true">{resultat.emoji}</span
						>
						<span class="min-w-0 flex-1">
							<span class="block truncate text-[12.5px] font-semibold text-foreground">
								{resultat.label}
							</span>
							<span class="block truncate text-[11px] text-muted-foreground">
								{resultat.detail}
							</span>
						</span>
						{#if actifItem}
							<CornerDownLeft class="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.7} />
						{/if}
					</button>
				{/each}
			{/each}

			{#if plat.length === 0}
				<p class="px-3 py-4 text-center text-[12px] text-muted-foreground">
					{#if contacts.isLoading || clients.isLoading}
						Recherche…
					{:else}
						Aucun résultat pour « {requete} ».
					{/if}
				</p>
			{/if}
		</div>
	{/if}
</div>
