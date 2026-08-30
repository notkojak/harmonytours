import { getStoredToken } from './convex-auth';

// État réactif d'authentification, partagé entre les composants.
export const authState = $state({
	isAuthenticated: typeof localStorage !== 'undefined' ? !!getStoredToken() : false
});
