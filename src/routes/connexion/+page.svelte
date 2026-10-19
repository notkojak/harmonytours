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
	class="absolute top-5 right-5 grid size-10 place-items-center rounded-full border border-line bg-card text-ink-soft shadow-[var(--ombre)] transition-colors hover:border-brand/40 hover:text-brand"
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

<!-- Carte de connexion : même langage que les encadrés de bravaux.fr
     (fond blanc, rayon généreux, ombre portée). -->
<Card
	class="w-full max-w-[430px] gap-0 rounded-[28px] border-line py-0 shadow-[var(--ombre-forte)]"
>
	<CardHeader class="items-center gap-0 px-10 pt-10 pb-0 text-center">
		<span
			class="mx-auto grid size-14 place-items-center overflow-hidden rounded-full ring-1 ring-line"
		>
			<img src="/favicon.png" alt="Bravaux" class="size-14 object-cover" />
		</span>
		<CardTitle class="mt-5 font-display text-[26px] leading-none font-semibold tracking-[-0.02em]">
			Bravaux
		</CardTitle>
		<CardDescription class="mt-2 text-[14px] text-ink-soft">
			Connecte-toi à ton tableau de bord
		</CardDescription>
	</CardHeader>

	<CardContent class="px-10 pt-8 pb-10">
		<form onsubmit={handleSubmit} class="space-y-5">
			<div class="space-y-2">
				<!-- Libellé décalé comme sur bravaux.fr, aligné sur la pilule du champ. -->
				<Label for="email" class="pl-5">Adresse e-mail</Label>
				<Input
					id="email"
					type="email"
					required
					autocomplete="email"
					placeholder="toi@exemple.fr"
					bind:value={email}
					class="h-14 px-6"
				/>
			</div>

			<div class="space-y-2">
				<Label for="password" class="pl-5">Mot de passe</Label>
				<Input
					id="password"
					type="password"
					required
					autocomplete="current-password"
					placeholder="••••••••"
					bind:value={password}
					class="h-14 px-6"
				/>
			</div>

			<Button type="submit" size="lg" disabled={sending} class="w-full">
				{#if sending}
					<LoaderCircle class="size-4 animate-spin" />
				{/if}
				{sending ? 'Connexion…' : 'Se connecter'}
			</Button>

			{#if error}
				<p class="text-center text-[12.5px] text-destructive">{error}</p>
			{/if}
		</form>
	</CardContent>
</Card>
