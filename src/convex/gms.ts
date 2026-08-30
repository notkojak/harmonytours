import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { canManageAgency, getCurrentUser } from './permissions';

// Pins « GMS » posés sur la carte de prospection : un point (lat/lng) avec un
// intitulé, lié à l'agence du créateur. Même visibilité que les zones : chaque
// agence ne voit que ses pins (les managers multi-agences voient tout leur périmètre).

export const list = query({
	args: {},
	handler: async (ctx) => {
		const user = await getCurrentUser(ctx);
		const agences = await ctx.db.query('agences').collect();
		const visibleIds = new Set(
			agences
				.filter((agence) => canManageAgency(user, agence) || user.agencyId === agence._id)
				.map((agence) => agence._id)
		);
		const pins = await ctx.db.query('gms').withIndex('by_createdAt').order('asc').collect();
		return pins.filter((p) => (p.agencyId ? visibleIds.has(p.agencyId) : false));
	}
});

export const upsert = mutation({
	args: {
		id: v.string(),
		label: v.string(),
		latitude: v.number(),
		longitude: v.number(),
		createdAt: v.number()
	},
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		if (!args.label.trim()) {
			throw new Error("L'intitulé est obligatoire.");
		}
		const existing = await ctx.db
			.query('gms')
			.withIndex('by_externalId', (q) => q.eq('externalId', args.id))
			.first();
		if (existing) {
			await ctx.db.patch(existing._id, { label: args.label.trim() });
		} else {
			await ctx.db.insert('gms', {
				externalId: args.id,
				label: args.label.trim(),
				latitude: args.latitude,
				longitude: args.longitude,
				agencyId: user.agencyId ?? undefined,
				createdAt: args.createdAt
			});
		}
	}
});

export const remove = mutation({
	args: { id: v.string() },
	handler: async (ctx, args) => {
		await getCurrentUser(ctx);
		const existing = await ctx.db
			.query('gms')
			.withIndex('by_externalId', (q) => q.eq('externalId', args.id))
			.first();
		if (existing) {
			await ctx.db.delete(existing._id);
		}
	}
});
