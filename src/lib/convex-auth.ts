import { getConvexClient } from 'convex-svelte';
import { api } from '../convex/_generated/api.js';

const TOKEN_KEY = 'harmony-auth-token';
const REFRESH_TOKEN_KEY = 'harmony-auth-refresh';

// Intervalle de rafraîchissement du JWT. Le JWT est signé pour `jwt.durationMs`
// (30 jours après l'ajustement) ; on le renouvelle bien avant son expiration
// avec le store token, pour qu'un onglet laissé ouvert ne perde jamais la
// session en cours.
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000; // toutes les 6 h

export type SignUpProfile = {
	firstName?: string;
	lastName?: string;
	birthDate?: string;
	role?: string;
};

export function getStoredToken(): string | null {
	if (typeof localStorage === 'undefined') return null;
	return localStorage.getItem(TOKEN_KEY);
}

function getStoredRefreshToken(): string | null {
	if (typeof localStorage === 'undefined') return null;
	return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function storeToken(token: string | null): void {
	if (typeof localStorage === 'undefined') return;
	if (token) {
		localStorage.setItem(TOKEN_KEY, token);
	} else {
		localStorage.removeItem(TOKEN_KEY);
	}
}

function storeRefreshToken(token: string | null): void {
	if (typeof localStorage === 'undefined') return;
	if (token) {
		localStorage.setItem(REFRESH_TOKEN_KEY, token);
	} else {
		localStorage.removeItem(REFRESH_TOKEN_KEY);
	}
}

/** Applique le token stocké au client Convex (à appeler après `setupConvex`). */
export function applyAuthToClient(): void {
	const client = getConvexClient();
	const token = getStoredToken();
	if (token) {
		client.setAuth(async () => token);
	} else {
		client.setAuth(async () => null);
	}
}

/**
 * Connexion / inscription par e-mail + mot de passe via Convex Auth.
 * L'action `auth.signIn` renvoie le JWT court (`token`) ET le store token de
 * session (`refreshToken`), qu'on garde tous les deux pour pouvoir renouveler
 * la session sans redemander le mot de passe.
 */
export async function signInWithPassword(
	email: string,
	password: string,
	flow: 'signIn' | 'signUp',
	profile: SignUpProfile = {}
): Promise<void> {
	const client = getConvexClient();
	const result = await client.action(api.auth.signIn, {
		provider: 'password',
		params: {
			flow,
			email,
			password,
			...profile
		}
	}) as { tokens?: { token?: string; refreshToken?: string } | null } | null;

	const tokens = result?.tokens;
	if (!tokens?.token) {
		throw new Error("L'authentification a échoué.");
	}

	storeToken(tokens.token);
	if (tokens.refreshToken) storeRefreshToken(tokens.refreshToken);
	client.setAuth(async () => tokens.token ?? null);
}

/**
 * Renouvelle la session à partir du store token : échange le refresh token
 * contre un nouveau JWT (+ un nouveau refresh token roté), et ré-applique le
 * résultat au client Convex. Renvoie true en cas de succès.
 * Retourne false (sans déconnecter) si aucun refresh token n'existe ou si
 * l'échange échoue de manière transitoire — le JWT courant reste valable.
 */
// Convex Auth utilise des refresh tokens à usage UNIQUE avec rotation. Deux
// échanges simultanés du même token (timers, onglets, re-déclenchement d'effect)
// peuvent invalider toute la sous-étendue de refresh tokens de la session, ce qui
// coupe définitivement la capacité à se reconnecter sans mot de passe. On
// s'assure donc qu'un seul rafraîchissement tourne à la fois.
let _refreshing = false;

export async function refreshSession(): Promise<boolean> {
	if (_refreshing) return getStoredToken() !== null;
	const client = getConvexClient();
	const refreshToken = getStoredRefreshToken();
	if (!refreshToken) return false;
	_refreshing = true;
	try {
		const result = (await client.action(api.auth.signIn, {
			refreshToken
		})) as { tokens?: { token?: string; refreshToken?: string } | null } | null;
		const tokens = result?.tokens;
		if (!tokens?.token) return false;
		storeToken(tokens.token);
		if (tokens.refreshToken) storeRefreshToken(tokens.refreshToken);
		client.setAuth(async () => tokens.token ?? null);
		return true;
	} catch {
		// Échec transitoire (réseau, service) : on garde la session actuelle.
		return getStoredToken() !== null;
	} finally {
		_refreshing = false;
	}
}

let _refreshStarted = false;

/**
 * Démarre la gestion de session sur la durée : un rafraîchissement immédiat au
 * chargement (renouvelle le JWT d'une session stockée) puis un renouvellement
 * périodique en arrière-plan pour qu'un onglet ouvert ne perde jamais la
 * session. Idempotent (un seul timer global).
 */
export async function startSessionRefresh(): Promise<boolean> {
	const initial = await refreshSession();
	if (!_refreshStarted) {
		_refreshStarted = true;
		const timer = setInterval(() => {
			refreshSession().catch(() => {});
		}, REFRESH_INTERVAL_MS);
		if (typeof window !== 'undefined') {
			// On arrête le timer si la page se décharge (inutile de rafraîchir).
			window.addEventListener('beforeunload', () => clearInterval(timer));
		}
	}
	return initial;
}

export async function signOut(): Promise<void> {
	const client = getConvexClient();
	try {
		await client.action(api.auth.signOut, {});
	} catch {
		// Déconnexion locale même si l'action échoue.
	}
	storeToken(null);
	storeRefreshToken(null);
	client.setAuth(async () => null);
}