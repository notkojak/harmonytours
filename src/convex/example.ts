import { query, mutation } from './_generated/server';
import { v } from 'convex/values';
import { getAuthUserId } from '@convex-dev/auth/server';

// Exemple de requête Convex : lecture des statistiques.
export const getStats = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query('stats').order('desc').collect();
	}
});

// Exemple de mutation Convex : création d'une statistique.
export const createStats = mutation({
	args: {
		token: v.string(),
		date: v.string(),
		clicks: v.number(),
		signups: v.number()
	},
	handler: async (ctx, args) => {
		return await ctx.db.insert('stats', {
			...args,
			trials: 0,
			trialsAmount: 0,
			bills: 0,
			billsAmount: 0,
			upsellAmount: 0,
			unpaid: 0,
			totalAmount: 0
		});
	}
});

// Exemple de requête protégée : renvoie l'utilisateur connecté (ou null).
export const getMe = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (userId === null) {
			return null;
		}
		return await ctx.db.get(userId);
	}
});
