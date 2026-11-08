<script lang="ts">
	import { goto } from '$app/navigation';
	import { env } from '$env/dynamic/public';
	import { LoaderCircle, Moon, Sun } from '@lucide/svelte';
	import { getTheme, setTheme, type Theme } from '$lib/theme';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { getConvexClient } from 'convex-svelte';
	import { api } from '../../convex/_generated/api.js';
	import { authState } from '$lib/auth-state.svelte';
	import { signInWithPassword } from '$lib/convex-auth';

	let email = $state('');
	let password = $state('');
	let sending = $state(false);
	let error = $state('');
	let theme = $state<Theme>(getTheme());

	function toggleTheme() {
		theme = theme === 'dark' ? 'light' : 'dark';
		setTheme(theme);
	}

	// En production, Convex MASQUE le détail des erreurs côté client : le
	// navigateur ne reçoit jamais « Invalid credentials », seulement un message
	// générique `[CONVEX A(auth:signIn)] Server Error` + un Request ID. On ne
	// peut donc pas parser la cause. On distingue un e-mail inconnu d'un mauvais
	// mot de passe en vérifiant simplement l'existence de l'e-mail saisi — et on
	// ne montre jamais le message brut de Convex à l'utilisateur.
	async function friendlyError(e: unknown, email: string): Promise<string> {
		const message = e instanceof Error ? e.message : '';
		// Problème purement réseau / client (hors authentification).
		if (/fetch|network|ECONN|load failed|offline|connexion au serveur|resolve/i.test(message)) {
			return 'Connexion impossible (réseau). Vérifie ta connexion puis réessaie.';
		}
		// Erreur liée à l'authentification : on classe selon l'e-mail. Un compte
		// licencié est refusé même avec le bon mot de passe (session coupée côté
		// serveur) : on le dit clairement plutôt que d'accuser le mot de passe.
		try {
			const existing = await getConvexClient().query(api.users.getByEmail, { email });
			if (existing?.statut === 'viré') {
				return 'Compte désactivé. Contactez votre superviseur.';
			}
			return existing ? 'Mot de passe incorrect.' : 'Aucun compte associé à cette adresse e-mail.';
		} catch {
			return 'Connexion impossible. Vérifie tes identifiants.';
		}
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (!env.PUBLIC_CONVEX_URL) {
			error = 'Backend Convex non configuré : renseigne PUBLIC_CONVEX_URL dans .env.';
			return;
		}

		sending = true;
		error = '';
		try {
			await signInWithPassword(email, password, 'signIn');
			authState.isAuthenticated = true;
			goto('/');
		} catch (e) {
			error = await friendlyError(e, email);
		} finally {
			sending = false;
		}
	}
</script>

<button
	type="button"
	class="absolute top-5 right-5 grid size-10 place-items-center rounded-full bg-card2 text-muted-foreground transition-colors hover:bg-glass-3 hover:text-foreground"
	onclick={toggleTheme}
	aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
	title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
>
	{#if theme === 'dark'}
		<Sun class="size-4" strokeWidth={1.7} />
	{:else}
		<Moon class="size-4" strokeWidth={1.7} />
	{/if}
</button>

<!-- Carte de connexion : sans contour, dans le langage visuel du reste de l'app. -->
<Card class="w-full max-w-[400px] gap-0 rounded-2xl border-0 py-0 shadow-none">
	<CardHeader class="items-center gap-0 px-7 pt-8 pb-0 text-center">
		<img
			src="/favicon.png"
			alt="Bravaux"
			class="mx-auto size-12 rounded-2xl object-cover"
		/>
		<CardTitle class="mt-4 font-display text-[18px] leading-none font-semibold tracking-[-0.02em]">
			Bravaux
		</CardTitle>
		<CardDescription class="mt-2 text-[12.5px] text-muted-foreground">
			Connecte-toi à ton tableau de bord
		</CardDescription>
	</CardHeader>

	<CardContent class="px-7 pt-6 pb-7">
		<form onsubmit={handleSubmit} class="space-y-4">
			<div class="space-y-1.5">
				<Label for="email" class="text-[12px] font-medium text-foreground">Adresse e-mail</Label>
				<Input
					id="email"
					type="email"
					required
					autocomplete="email"
					placeholder="toi@exemple.fr"
					bind:value={email}
					class="h-12 rounded-full border-0 bg-card2 px-5 shadow-none"
				/>
			</div>

			<div class="space-y-1.5">
				<Label for="password" class="text-[12px] font-medium text-foreground">Mot de passe</Label>
				<Input
					id="password"
					type="password"
					required
					autocomplete="current-password"
					placeholder="••••••••"
					bind:value={password}
					class="h-12 rounded-full border-0 bg-card2 px-5 shadow-none"
				/>
			</div>

			<Button type="submit" size="lg" disabled={sending} class="w-full">
				{#if sending}
					<LoaderCircle class="size-4 animate-spin" />
				{/if}
				{sending ? 'Connexion…' : 'Se connecter'}
			</Button>

			{#if error}
				<p
					class="rounded-xl bg-destructive/10 px-3 py-2 text-center text-[12px] font-medium text-destructive"
				>
					{error}
				</p>
			{/if}
		</form>

		<p class="mt-6 text-center text-[11px] font-medium text-muted-foreground">
			Accès réservé à l'équipe Bravaux
		</p>
	</CardContent>
</Card>
