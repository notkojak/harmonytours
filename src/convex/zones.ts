import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { canManageAgency, getCurrentUser } from './permissions';

// Zones de prospection (carte Mapbox), liées à l'agence du créateur.
// L'identifiant métier est `externalId` (UUID généré côté client) : il reste
// stable et cohérent avec les features dessinées sur la carte, indépendamment
// du `_id` Convex. Chaque agence ne voit que ses propres zones (les managers
// multi-agences voient toutes les agences qu'ils gèrent).

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
		const zones = await ctx.db.query('zones').withIndex('by_createdAt').order('asc').collect();
		return zones.filter((z) => (z.agencyId ? visibleIds.has(z.agencyId) : false));
	}
});

export const upsert = mutation({
	args: {
		id: v.string(),
		name: v.string(),
		lastProspected: v.optional(v.string()),
		createdAt: v.number(),
		geometry: v.any(),
		// Couleur personnalisée (hex) + option « vert automatique après 6 mois ».
		color: v.optional(v.string()),
		greenWhenOld: v.optional(v.boolean()),
		// Commercial affecté à la zone.
		commercialId: v.optional(v.id('users'))
	},
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		const existing = await ctx.db
			.query('zones')
			.withIndex('by_externalId', (q) => q.eq('externalId', args.id))
			.first();
		if (existing) {
			// Mise à jour : on conserve l'agence d'origine de la zone.
			await ctx.db.patch(existing._id, {
				name: args.name,
				lastProspected: args.lastProspected,
				createdAt: args.createdAt,
				geometry: args.geometry,
				color: args.color,
				greenWhenOld: args.greenWhenOld,
				commercialId: args.commercialId
			});
		} else {
			// Création : la zone appartient à l'agence de l'utilisateur connecté.
			await ctx.db.insert('zones', {
				externalId: args.id,
				name: args.name,
				lastProspected: args.lastProspected,
				createdAt: args.createdAt,
				color: args.color,
				greenWhenOld: args.greenWhenOld,
				commercialId: args.commercialId,
				agencyId: user.agencyId ?? undefined,
				geometry: args.geometry
			});
		}
	}
});

export const remove = mutation({
	args: { id: v.string() },
	handler: async (ctx, args) => {
		await getCurrentUser(ctx);
		const existing = await ctx.db
			.query('zones')
			.withIndex('by_externalId', (q) => q.eq('externalId', args.id))
			.first();
		if (existing) {
			await ctx.db.delete(existing._id);
		}
	}
});
