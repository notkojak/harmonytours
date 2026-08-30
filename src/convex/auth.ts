import { convexAuth } from '@convex-dev/auth/server';
import { Password } from '@convex-dev/auth/providers/Password';
import type { Value } from 'convex/values';

// Convex Auth — authentification par e-mail + mot de passe.
// Flows disponibles sur l'action `signIn` : "signUp", "signIn",
// "reset", "reset-verification" et "email-verification".
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
	// Durée de vie du JWT. Par défaut, Convex Auth signe des tokens valables
	// 1 h seulement. Le web renouvelle le sien automatiquement via le client
	// Convex (storeToken) ; l'app mobile, elle, garde le même token stocké et
	// n'a aucun rafraîchissement — du coup elle était déconnectée ~1 h après
	// chaque connexion. On allonge la validité (30 jours) pour que la session
	// de la tablette survive à une journée de terrain sans re-connexion.
	jwt: {
		durationMs: 1000 * 60 * 60 * 24 * 30
	},
	providers: [
		Password({
			// Profil métier stocké sur le document `users` à l'inscription.
			profile: (params) => {
				const profile: Record<string, Value> = { email: params.email as string };
				if (typeof params.firstName === 'string') profile.firstName = params.firstName;
				if (typeof params.lastName === 'string') profile.lastName = params.lastName;
				if (typeof params.birthDate === 'string') profile.birthDate = params.birthDate;
				if (typeof params.role === 'string') profile.role = params.role;
				return profile as unknown as Record<string, Value> & { email: string };
			}
		})
	]
});
