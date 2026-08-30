import { httpAction } from './_generated/server';
import { api } from './_generated/api';

// Endpoints HTTP utilisés par l'app mobile (BeastDoor) pour se connecter au
// même backend que le web (Convex Auth, provider password). Le token de session
// renvoyé est le même JWT que celui utilisé par le web : il peut ensuite être
// envoyé en `Authorization: Bearer` sur les autres endpoints (HTTP actions,
// client Convex) pour être identifié par Convex Auth.

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'content-type': 'application/json',
			'access-control-allow-origin': '*',
			'access-control-allow-methods': 'POST, OPTIONS',
			'access-control-allow-headers': 'content-type, authorization'
		}
	});
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
	try {
		const body = await request.json();
		return body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
	} catch {
		return null;
	}
}

// Identité Convex sans exception : un token expiré/invalide fait lever à
// getUserIdentity() « Could not verify OIDC token claim » — on renvoie null
// pour répondre 401 proprement (l'app coupe alors la session).
async function getUserIdentitySafe(ctx: Parameters<Parameters<typeof httpAction>[0]>[0]) {
	try {
		return await ctx.auth.getUserIdentity();
	} catch {
		return null;
	}
}

function userPayload(
	user: {
		_id: unknown;
		email?: string;
		firstName?: string;
		lastName?: string;
		role?: string;
		name?: string;
		photo?: string;
	} | null
) {
	if (!user) return null;
	return {
		id: user._id,
		email: user.email ?? null,
		firstName: user.firstName ?? null,
		lastName: user.lastName ?? null,
		role: user.role ?? null,
		name: user.name ?? null,
		photo: user.photo ?? null
	};
}

// POST /api/auth-mobile/signin  { email, password } → { ok, token, user }
// Connecte un utilisateur avec le même provider password que le web (flow
// « signIn » de Convex Auth) et renvoie le token de session + le profil.
export const signin = httpAction(async (ctx, request) => {
	if (request.method === 'OPTIONS') return json({ ok: true }, 204);
	if (request.method !== 'POST') {
		return json({ ok: false, error: 'Méthode non autorisée.' }, 405);
	}

	const body = await readJson(request);
	const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
	const password = typeof body?.password === 'string' ? body.password : '';
	if (!email || !password) {
		return json({ ok: false, error: 'Adresse e-mail et mot de passe requis.' }, 400);
	}

	try {
		const result = (await ctx.runAction(api.auth.signIn, {
			provider: 'password',
			params: { flow: 'signIn', email, password }
		})) as { tokens?: { token?: string }; userId?: string } | null;

		const token = result?.tokens?.token;
		if (!token) throw new Error("L'authentification a échoué.");

		let user = null;
		if (result?.userId) {
			user = await ctx.runQuery(api.users.getById, {
				userId: result.userId as any
			});
		}
		if (!user) {
			user = await ctx.runQuery(api.users.getByEmail, { email });
		}
		return json({ ok: true, token, user: userPayload(user as any) });
	} catch (e) {
		const message = e instanceof Error ? e.message : '';
		// Convex Auth masque volontairement la cause (« Invalid credentials »)
		// pour ne pas révéler l'existence d'un compte : on distingue côté
		// serveur un e-mail inconnu d'un mot de passe incorrect.
		if (/invalid credentials/i.test(message)) {
			const existing = await ctx.runQuery(api.users.getByEmail, { email }).catch(() => null);
			if (!existing) {
				return json({ ok: false, error: 'Aucun compte associé à cette adresse e-mail.' }, 401);
			}
			return json({ ok: false, error: 'Mot de passe incorrect.' }, 401);
		}
		if (/too many|rate\s?limit/i.test(message)) {
			return json({ ok: false, error: 'Trop de tentatives. Réessaie dans quelques minutes.' }, 429);
		}
		return json({ ok: false, error: 'Connexion impossible. Vérifie tes identifiants.' }, 401);
	}
});

// POST /api/auth-mobile/me  (Authorization: Bearer <token>) → { ok, user }
// Valide le token de session (via l'identité Convex) et renvoie le profil.
export const me = httpAction(async (ctx, request) => {
	if (request.method === 'OPTIONS') return json({ ok: true }, 204);
	if (request.method !== 'POST') {
		return json({ ok: false, error: 'Méthode non autorisée.' }, 405);
	}

	const header = request.headers.get('authorization') ?? '';
	const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
	if (!token) return json({ ok: false, error: 'Non authentifié.' }, 401);

	const identity = await getUserIdentitySafe(ctx);
	if (!identity) return json({ ok: false, error: 'Session invalide ou expirée.' }, 401);

	// subject = « userId|sessionId » (séparateur « | » de Convex Auth).
	const userId = identity.subject.split('|')[0];
	const user = await ctx.runQuery(api.users.getById, {
		userId: userId as any
	});
	return json({ ok: true, user: userPayload(user as any) });
});
