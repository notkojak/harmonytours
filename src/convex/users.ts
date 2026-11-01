import { internalQuery, mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { getAuthUserId } from '@convex-dev/auth/server';
import { canManageEmployes, getCurrentUser } from './permissions';

function profileOf(user: {
	_id: unknown;
	firstName?: string;
	lastName?: string;
	email?: string;
	birthDate?: string;
	role?: string;
	name?: string;
	photo?: string;
	statut?: string;
	firedAt?: number;
}) {
	return {
		_id: user._id,
		firstName: user.firstName ?? null,
		lastName: user.lastName ?? null,
		email: user.email ?? null,
		birthDate: user.birthDate ?? null,
		role: user.role ?? null,
		name: user.name ?? null,
		photo: user.photo ?? null,
		// Statut du compte : permet au client de déconnecter un employé viré
		// dès qu'il est licencié (et aux endpoints mobiles de refuser l'accès).
		statut: user.statut ?? 'actif',
		firedAt: user.firedAt ?? null
	};
}

// Génère une URL d'upload pour la photo d'un employé (stockage Convex).
export const generatePhotoUploadUrl = mutation({
	args: {},
	handler: async (ctx) => {
		await getCurrentUser(ctx);
		return await ctx.storage.generateUploadUrl();
	}
});

// Enregistre la photo d'un employé (soi-même, ou un manager autorisé).
export const setPhoto = mutation({
	args: {
		userId: v.id('users'),
		storageId: v.string()
	},
	handler: async (ctx, args) => {
		const caller = await getCurrentUser(ctx);
		const target = await ctx.db.get(args.userId);
		if (!target) {
			throw new Error('Employé introuvable.');
		}
		const isSelf = caller._id === args.userId;
		if (!isSelf && !canManageEmployes(caller)) {
			throw new Error('Non autorisé.');
		}
		// Un client ne peut modifier que sa propre photo, jamais celle des autres.
		const url = await ctx.storage.getUrl(args.storageId);
		if (!url) {
			throw new Error('Fichier introuvable.');
		}
		await ctx.db.patch(args.userId, { photo: url });
		return url;
	}
});

// Retire la photo d'un employé (soi-même, ou un manager autorisé).
export const removePhoto = mutation({
	args: { userId: v.id('users') },
	handler: async (ctx, args) => {
		const caller = await getCurrentUser(ctx);
		const target = await ctx.db.get(args.userId);
		if (!target) {
			throw new Error('Employé introuvable.');
		}
		const isSelf = caller._id === args.userId;
		if (!isSelf && !canManageEmployes(caller)) {
			throw new Error('Non autorisé.');
		}
		await ctx.db.patch(args.userId, { photo: undefined });
	}
});

// Profil de l'utilisateur connecté (ou null).
export const getProfile = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (userId === null) {
			return null;
		}
		const user = await ctx.db.get(userId);
		if (!user) {
			return null;
		}
		return profileOf(user as any);
	}
});

// Profil complet par identifiant : réservé au serveur (endpoints mobiles et
// vérifications d'identité). Aucun client web ne peut l'appeler.
export const getByIdInternal = internalQuery({
	args: { userId: v.id('users') },
	handler: async (ctx, args) => {
		const user = await ctx.db.get(args.userId);
		if (!user) {
			return null;
		}
		return profileOf(user as any);
	}
});

// Profil complet par e-mail : réservé au serveur (connexion mobile). Le web
// n'obtient plus que l'existence et le statut du compte (voir `getByEmail`),
// pour ne pas exposer le rôle et l'identité d'un salarié à partir d'un e-mail.
export const getByEmailInternal = internalQuery({
	args: { email: v.string() },
	handler: async (ctx, args) => {
		const user = await ctx.db
			.query('users')
			.withIndex('email', (q) => q.eq('email', args.email))
			.first();
		if (!user) {
			return null;
		}
		return profileOf(user as any);
	}
});

/**
 * Indice de connexion public : un compte existe-t-il, et est-il encore actif ?
 * C'est tout ce dont la page de connexion a besoin pour distinguer « compte
 * désactivé », « mot de passe incorrect » et « e-mail inconnu ». Le profil
 * complet reste côté serveur.
 */
export const getByEmail = query({
	args: { email: v.string() },
	handler: async (ctx, args) => {
		const user = await ctx.db
			.query('users')
			.withIndex('email', (q) => q.eq('email', args.email))
			.first();
		if (!user) {
			return null;
		}
		return { _id: user._id, statut: user.statut ?? 'actif' };
	}
});
