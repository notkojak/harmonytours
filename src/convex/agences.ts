import { internalQuery, mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { canManageAgency, getCurrentUser, isAdmin } from './permissions';

export const get = internalQuery({
	args: { id: v.id('agences') },
	handler: async (ctx, { id }) => {
		return await ctx.db.get(id);
	}
});

// Agences visibles par l'utilisateur connecté (avec nombre de membres actifs).
export const list = query({
	args: {},
	handler: async (ctx) => {
		const user = await getCurrentUser(ctx);
		const agences = await ctx.db.query('agences').collect();
		const users = await ctx.db.query('users').collect();

		const visible = agences.filter((agence) => {
			if (canManageAgency(user, agence)) return true;
			return user.agencyId === agence._id;
		});

		return visible.map((agence) => ({
			_id: agence._id,
			name: agence.name,
			zone: agence.zone ?? null,
			membres: users.filter((u) => u.agencyId === agence._id && u.statut !== 'viré').length
		}));
	}
});

// Création d'agence réservée à l'administrateur.
export const create = mutation({
	args: {
		name: v.string(),
		zone: v.optional(v.string())
	},
	handler: async (ctx, { name, zone }) => {
		const user = await getCurrentUser(ctx);
		if (!isAdmin(user)) {
			throw new Error('Seul un administrateur peut créer une agence.');
		}
		return await ctx.db.insert('agences', {
			name,
			zone,
			createdBy: user._id
		});
	}
});
