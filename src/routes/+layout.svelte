<script lang="ts">
	import './layout.css';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { env } from '$env/dynamic/public';
	import { setupConvex } from 'convex-svelte';
	import { authState } from '$lib/auth-state.svelte';
	import { applyAuthToClient, getStoredToken, startSessionRefresh } from '$lib/convex-auth';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Topbar from '$lib/components/Topbar.svelte';

	let { children } = $props();

	// Le client Convex ne démarre que si l'URL de déploiement est renseignée,
	// afin que l'interface reste utilisable tant que le backend n'est pas configuré.
	if (env.PUBLIC_CONVEX_URL) {
		setupConvex(env.PUBLIC_CONVEX_URL);
	}

	// Session : initialise l'authentification UNE SEULE fois (application du token
	// stocké + renouvellement périodique du JWT). C'est un flag non réactif, donc
	// l'effect ne se re-déclenche pas à chaque changement d'état d'auth — sinon on
	// relançait un rafraîchissement de session à chaque navigation, ce qui casse la
	// chaîne de refresh tokens (usage simultané → invalidation).
	let authBooted = false;
	$effect(() => {
		if (!env.PUBLIC_CONVEX_URL || authBooted) return;
		authBooted = true;
		applyAuthToClient();
		startSessionRefresh().then((ok) => {
			authState.isAuthenticated = ok ? true : getStoredToken() !== null;
		});
	});

	// Garde d'accès : redirige vers /connexion tant que l'utilisateur n'est pas
	// authentifié. Effect en lecture seule (n'écrit pas authState → pas de boucle
	// de re-déclenchement).
	$effect(() => {
		if (!authState.isAuthenticated && page.url.pathname !== '/connexion') {
			goto('/connexion');
		}
	});

	const pathname = $derived(page.url.pathname);

	// Ouverture du tiroir de navigation sur mobile (bouton hamburger de la Topbar).
	let mobileNavOpen = $state(false);
</script>

{#if pathname === '/connexion'}
	<div class="relative flex min-h-screen items-center justify-center bg-base px-4">
		{@render children()}
	</div>
{:else}
	<div class="flex h-screen overflow-hidden bg-base text-ink">
		<Sidebar bind:mobileOpen={mobileNavOpen} />

		<main class="flex min-w-0 flex-1 flex-col py-2 pr-2 sm:py-3 sm:pr-3">
			<div
				class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-surface"
			>
				<Topbar
					onMenu={() => (mobileNavOpen = true)}
					showPeriod={pathname !== '/agenda'}
					title={pathname === '/administration'
						? 'Administration'
						: pathname === '/contacts'
							? 'Contacts'
							: pathname === '/clients'
								? 'Clients'
								: pathname === '/agenda'
									? 'Agenda'
									: pathname === '/zones'
										? 'Zones de prospection'
										: pathname === '/bilan'
											? 'Bilan de prospection'
											: pathname === '/chiffrage'
												? 'Chiffrage'
												: 'Tableau de bord'}
				/>
				<div
					class={[
						'min-h-0 flex-1 overflow-y-auto',
						// Agenda : pleine largeur sur mobile (padding 0), valeurs PC conservées.
						pathname === '/agenda'
							? 'px-0 py-0 sm:px-6 sm:py-6'
							: 'px-4 py-4 sm:px-6 sm:py-6'
					].join(' ')}
				>
					{@render children()}
				</div>
			</div>
		</main>
	</div>
{/if}
