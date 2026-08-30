import { mutation, query } from './_generated/server';
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
}) {
	return {
		_id: user._id,
		firstName: user.firstName ?? null,
		lastName: user.lastName ?? null,
		email: user.email ?? null,
		birthDate: user.birthDate ?? null,
		role: user.role ?? null,
		name: user.name ?? null,
		photo: user.photo ?? null
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

// Profil public par identifiant — utilisé par les endpoints de connexion
// mobiles (HTTP actions) qui ne passent pas par le client Convex.
export const getById = query({
	args: { userId: v.id('users') },
	handler: async (ctx, args) => {
		const user = await ctx.db.get(args.userId);
		if (!user) {
			return null;
		}
		return profileOf(user as any);
	}
});

// Profil public par e-mail (fallback quand le sign-in ne renvoie pas l'id).
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
		return profileOf(user as any);
	}
});
