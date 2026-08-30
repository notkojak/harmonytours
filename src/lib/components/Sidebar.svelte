<script lang="ts">
	import type { Component } from 'svelte';
	import {
		Bot,
		BarChart3,
		CalendarDays,
		Clock,
		Contact,
		KeyRound,
		LayoutDashboard,
		Library,
		LogIn,
		LogOut,
		Map,
		Plus,
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
	import { navSections, quickLinks } from '$lib/data/dashboard';
	import { page } from '$app/state';
	import { authState } from '$lib/auth-state.svelte';
	import { signOut } from '$lib/convex-auth';
	import { canAccessAdministration, capitalizeRole } from '$lib/data/roles';
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
		library: Library,
		clock: Clock,
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
	const contacts = useQuery(api.contacts.list, () => (authState.isAuthenticated ? {} : 'skip'));
	const contactsCount = $derived(contacts.data?.length ?? 0);

	const clients = useQuery(api.ventes.listClients, () => (authState.isAuthenticated ? {} : 'skip'));
	const clientsCount = $derived(clients.data?.length ?? 0);

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
		'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-hidden bg-base px-3 py-4 transition-transform duration-200 lg:static lg:z-auto lg:w-64 lg:max-w-none lg:translate-x-0 lg:overflow-hidden',
		mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
	].join(' ')}
>
	<!-- Switcher d'agence -->
	<AgencySwitcher />

	<div class="mt-5 min-h-0 flex-1 space-y-4 overflow-y-auto">
		{#each navSections as section}
			{#if section.label === 'Gestion' && !canAccessAdministration(profile.data?.role)}
				<!-- Section « Gestion » (Administration) : visible uniquement pour
				     l'administrateur, le directeur de zone et le directeur d'agence. -->
			{:else}
				<div>
					{#if section.label}
						<p
							class="mb-2 px-2 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase"
						>
							{section.label}
						</p>
					{/if}
					<nav class="space-y-0.5">
						{#each section.items as item}
							{@const ItemIcon = icons[item.icon]}
							{#if item.href === '/administration' && !canAccessAdministration(profile.data?.role)}
								<!-- Administration : réservé aux managers -->
							{:else}
								<a
									href={item.href}
									class={[
										'flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13.5px] font-medium transition-colors',
										isActive(item.href)
											? 'bg-glass-3 text-foreground'
											: 'text-muted-foreground hover:bg-glass-2 hover:text-foreground'
									].join(' ')}
								>
									<ItemIcon class="size-4" strokeWidth={1.7} />
									<span class="min-w-0 flex-1">{item.label}</span>
									{#if item.href === '/contacts' && contactsCount > 0}
										<span
											class="rounded-full bg-glass-3 px-1.5 py-0.5 text-[10.5px] font-semibold text-foreground"
										>
											{contactsCount}
										</span>
									{/if}
									{#if item.href === '/clients' && clientsCount > 0}
										<span
											class="rounded-full bg-glass-3 px-1.5 py-0.5 text-[10.5px] font-semibold text-foreground"
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
			<div class="mt-4 space-y-0.5 border-t border-line pt-4">
				{#each quickLinks as item}
					{@const ItemIcon = icons[item.icon]}
					<a
						href={item.href}
						class="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13.5px] font-medium text-muted-foreground transition-colors hover:bg-glass-2 hover:text-foreground"
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
			class="flex w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-primary px-2.5 py-2 text-[13px] font-semibold text-primary-foreground shadow-md shadow-primary/10 transition-all hover:bg-primary/90"
		>
			<UserPlus class="size-4" strokeWidth={1.7} />
			<span>Nouveau Contact</span>
		</button>

		{#if authState.isAuthenticated}
			<div class="rounded-xl border border-line bg-card p-3">
				{#if profile.data}
					<div class="flex items-center gap-2.5">
						<Avatar
							photo={profile.data.photo}
							label={(profile.data.firstName ?? profile.data.email ?? '')[0]?.toUpperCase()}
							class="size-9 shrink-0 bg-muted text-sm font-bold text-muted-foreground"
						/>
						<div class="min-w-0 flex-1 leading-tight">
							<p class="truncate text-[13px] font-semibold text-foreground">
								Bonjour, {profile.data.firstName ?? profile.data.email} 😊
							</p>
							<p class="mt-0.5 truncate text-[11.5px] font-medium text-muted-foreground">
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
					<p class="text-[13px] font-semibold text-foreground">Bonjour 😊</p>
				{/if}

				<button
					type="button"
					onclick={handleSignOut}
					class="mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-base px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
				>
					<LogOut class="size-3.5" strokeWidth={1.7} />
					<span>Déconnexion</span>
				</button>
			</div>
		{:else}
			<a
				href="/connexion"
				class="flex items-center gap-2.5 rounded-xl border border-line bg-card px-2.5 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-glass-2 hover:text-foreground"
			>
				<LogIn class="size-4" strokeWidth={1.7} />
				<span>Connexion</span>
			</a>
		{/if}
	</div>
</aside>

<NewContactDialog bind:open={contactOpen} />
