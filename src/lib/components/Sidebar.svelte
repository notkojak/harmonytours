<script lang="ts">
	import type { Component } from 'svelte';
	import {
		Bot,
		BarChart3,
		Calculator,
		CalendarDays,
		Contact,
		KeyRound,
		LayoutDashboard,
		Library,
		LogIn,
		LogOut,
		Map,
		Plus,
		Receipt,
		Send,
		Server,
		ShieldCheck,
		Sprout,
		Terminal,
		UserPlus,
		Users
	} from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { useQuery } from 'convex-svelte';
	import { api } from '../../convex/_generated/api.js';
	import { navSections, quickLinks, pageEmojis } from '$lib/data/dashboard';
	import { page } from '$app/state';
	import { authState } from '$lib/auth-state.svelte';
	import { signOut } from '$lib/convex-auth';
	import { canAccessAdministration, canViewPilotage, capitalizeRole } from '$lib/data/roles';
	import AgencySwitcher from './AgencySwitcher.svelte';
	import NewContactDialog from './NewContactDialog.svelte';
	import Avatar from './Avatar.svelte';

	// Tiroir mobile : sur écran < lg, la sidebar devient un panneau coulissant.
	let { mobileOpen = $bindable(false) }: { mobileOpen?: boolean } = $props();

	// Ferme le tiroir après une navigation (le contenu desktop reste inchangé).
	// On compare le chemin précédent : ne pas lire `mobileOpen` ici, sinon l'effet
	// se re-déclencherait à l'ouverture et refermerait le tiroir aussitôt.
	let lastPath = $state(page.url.pathname);
	$effect(() => {
		const current = page.url.pathname;
		if (current !== lastPath) {
			lastPath = current;
			mobileOpen = false;
		}
	});

	const icons: Record<string, Component> = {
		dashboard: LayoutDashboard,
		calendar: CalendarDays,
		calculator: Calculator,
		agents: Bot,
		backend: Server,
		telegram: Send,
		key: KeyRound,
		users: Users,
		contact: Contact,
		shield: ShieldCheck,
		sprout: Sprout,
		map: Map,
		chart: BarChart3,
		plus: Plus,
		receipt: Receipt,
		library: Library,
		terminal: Terminal,
		logIn: LogIn
	};

	function isActive(href: string) {
		const path = href.split('#')[0];
		if (path === '/') return page.url.pathname === '/' && !href.includes('#');
		return page.url.pathname === path;
	}

	async function handleSignOut() {
		await signOut();
		authState.isAuthenticated = false;
		goto('/connexion');
	}

	const profile = useQuery(api.users.getProfile, () => (authState.isAuthenticated ? {} : 'skip'));

	// Nom affiché dans la pastille de profil : « Prénom Nom » (repli e-mail).
	const nomComplet = $derived.by(() => {
		const p = profile.data;
		if (!p) return '';
		return [p.firstName, p.lastName].filter(Boolean).join(' ').trim() || p.email || '';
	});

	// Employé licencié : déconnexion immédiate, même si son JWT est encore
	// valable. La session est révoquée côté serveur et il revient à /connexion.
	let expelled = false;
	$effect(() => {
		if (expelled || profile.data?.statut !== 'viré') return;
		expelled = true;
		handleSignOut();
	});

	// Deux compteurs, une requête : la barre latérale ne charge plus toutes les
	// fiches et tous les clients à chaque page.
	const counts = useQuery(api.contacts.counts, () => (authState.isAuthenticated ? {} : 'skip'));
	const contactsCount = $derived(counts.data?.contacts ?? 0);
	const clientsCount = $derived(counts.data?.clients ?? 0);

	let contactOpen = $state(false);
</script>

{#if mobileOpen}
	<div
		class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
		role="button"
		tabindex="-1"
		aria-label="Fermer le menu"
		onclick={() => (mobileOpen = false)}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') mobileOpen = false;
		}}
	></div>
{/if}

<aside
	class={[
		'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-hidden bg-sidebar px-3 pt-4 pb-4 text-sidebar-foreground transition-transform duration-200 lg:static lg:z-auto lg:my-2 lg:ml-2 lg:w-64 lg:max-w-none lg:translate-x-0 lg:overflow-hidden lg:rounded-[20px] lg:pt-2',
		mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
	].join(' ')}
>
	<!-- Switcher d'agence -->
	<AgencySwitcher />

	<div
		class="mt-5 min-h-0 flex-1 [scrollbar-width:none] space-y-4 overflow-y-auto [&::-webkit-scrollbar]:hidden"
	>
		{#each navSections as section}
			{#if section.label === 'Gestion' && !canAccessAdministration(profile.data?.role)}
				<!-- Section « Gestion » (Administration) : visible uniquement pour
				     l'administrateur, le directeur de zone et le directeur d'agence. -->
			{:else}
				<div>
					{#if section.label}
						<p
							class="mb-2 px-2 text-[10px] font-semibold tracking-[0.16em] text-white/35 uppercase"
						>
							{section.label}
						</p>
					{/if}
					<nav class="space-y-0.5">
						{#each section.items as item}
							{@const ItemIcon = icons[item.icon]}
							{#if (item as { managerOnly?: boolean }).managerOnly && !canViewPilotage(profile.data?.role)}
								<!-- Direction : réservée aux managers de périmètre -->
							{:else if item.href === '/administration' && !canAccessAdministration(profile.data?.role)}
								<!-- Administration : réservé aux managers -->
							{:else}
								<a
									href={item.href}
									class={[
										'relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors',
										isActive(item.href)
											? 'bg-[#222224] font-semibold text-white'
											: 'font-medium text-white/60 hover:bg-[#222224] hover:text-white'
									].join(' ')}
								>
									{#if pageEmojis[item.href]}
										<span class="w-4 shrink-0 text-center text-[14px] leading-none"
											>{pageEmojis[item.href]}</span
										>
									{:else}
										<ItemIcon class="size-4" strokeWidth={1.7} />
									{/if}
									<span class="min-w-0 flex-1">{item.label}</span>
									{#if item.href === '/contacts' && contactsCount > 0}
										<span
											class="rounded-full bg-white/10 px-1.5 py-0.5 text-[10.5px] font-semibold text-white/80"
										>
											{contactsCount}
										</span>
									{/if}
									{#if item.href === '/clients' && clientsCount > 0}
										<span
											class="rounded-full bg-white/10 px-1.5 py-0.5 text-[10.5px] font-semibold text-white/80"
										>
											{clientsCount}
										</span>
									{/if}
								</a>
							{/if}
						{/each}
					</nav>
				</div>
			{/if}
		{/each}

		<!-- Liens rapides -->
		{#if quickLinks.length > 0}
			<div class="mt-4 space-y-0.5 border-t border-white/10 pt-4">
				{#each quickLinks as item}
					{@const ItemIcon = icons[item.icon]}
					<a
						href={item.href}
						class="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-white/60 transition-colors hover:bg-[#222224] hover:text-white"
					>
						<ItemIcon class="size-4" strokeWidth={1.7} />
						<span>{item.label}</span>
					</a>
				{/each}
			</div>
		{/if}
	</div>

	<div class="mt-auto space-y-2 pt-4">
		<button
			type="button"
			onclick={() => (contactOpen = true)}
			class="flex h-11 w-full items-center justify-center gap-2.5 rounded-full bg-white px-4 text-[12.5px] font-bold tracking-[0.06em] text-black uppercase transition-all hover:bg-white/90"
		>
			<UserPlus class="size-4" strokeWidth={1.7} />
			<span>Nouveau Contact</span>
		</button>

		{#if authState.isAuthenticated}
			<div class="rounded-xl bg-white/5 p-3">
				{#if profile.data}
					<div class="flex items-center gap-2.5">
						<Avatar
							photo={profile.data.photo}
							label={(profile.data.firstName ?? profile.data.email ?? '')[0]?.toUpperCase()}
							class="size-9 shrink-0 bg-white/15 text-sm font-bold text-white"
						/>
						<div class="min-w-0 flex-1 leading-tight">
							<p class="truncate text-[13px] font-semibold text-white">
								{nomComplet}
							</p>
							<p class="mt-0.5 truncate text-[11.5px] font-medium text-white/45">
								{capitalizeRole(profile.data.role)}
							</p>
						</div>
					</div>
				{:else if profile.isLoading}
					<div class="flex items-center gap-2.5">
						<span class="size-9 shrink-0 animate-pulse rounded-full bg-muted"></span>
						<div class="flex-1 space-y-1.5">
							<div class="skeleton h-3 w-28 rounded-full"></div>
							<div class="skeleton h-2.5 w-20 rounded-full"></div>
						</div>
					</div>
				{:else}
					<p class="text-[13px] font-semibold text-white">Bonjour 😊</p>
				{/if}

				<button
					type="button"
					onclick={handleSignOut}
					class="mt-2.5 flex w-full items-center justify-center gap-2 rounded-full bg-white/5 px-3 py-2 text-[11.5px] font-bold tracking-[0.06em] text-white/55 uppercase transition-colors hover:bg-red-500/15 hover:text-red-300"
				>
					<LogOut class="size-3.5" strokeWidth={1.7} />
					<span>Déconnexion</span>
				</button>
			</div>
		{:else}
			<a
				href="/connexion"
				class="flex items-center gap-2.5 rounded-lg bg-white/5 px-2.5 py-2 text-[13px] font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white"
			>
				<LogIn class="size-4" strokeWidth={1.7} />
				<span>Connexion</span>
			</a>
		{/if}
	</div>
</aside>

<NewContactDialog bind:open={contactOpen} />
