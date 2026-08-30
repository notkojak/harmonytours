import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { getCurrentUser } from './permissions';
import { visibleAgencyIds } from './access';
import { ROLE_ADMIN, ROLE_ZONE } from './permissions';

// Fixent les objectifs mensuels (CA + RDV) : le directeur d'agence (son agence)
// et l'administrateur / directeur de zone (toutes les agences).
const ROLE_DIRECTEUR = "directeur d'agence";

function canSetObjectifs(user: Doc<'users'>): boolean {
	return user.role === ROLE_DIRECTEUR || user.role === ROLE_ADMIN || user.role === ROLE_ZONE;
}

// Enregistre (crée ou met à jour) l'objectif mensuel d'un employé.
export const set = mutation({
	args: {
		userId: v.id('users'),
		mois: v.string(), // « YYYY-MM »
		ca: v.number(),
		rdv: v.number()
	},
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		if (!canSetObjectifs(user)) {
			throw new Error('Non autorisé : réservé au directeur d’agence ou à l’administration.');
		}
		const target = await ctx.db.get(args.userId);
		if (!target) {
			throw new Error('Employé introuvable.');
		}
		if (!target.agencyId) {
			throw new Error('Cet employé n’est rattaché à aucune agence.');
		}
		// Le directeur d'agence ne cible que les employés de son agence ;
		// l'administrateur peut cibler tous les employés.
		if (user.role === ROLE_DIRECTEUR && target.agencyId !== user.agencyId) {
			throw new Error('Non autorisé pour cet employé.');
		}
		if (!/^\d{4}-\d{2}$/.test(args.mois)) {
			throw new Error('Mois invalide.');
		}
		if (args.ca < 0 || args.rdv < 0) {
			throw new Error('Objectifs invalides.');
		}

		const existing = await ctx.db
			.query('objectifs')
			.withIndex('by_user_mois', (q) => q.eq('userId', args.userId).eq('mois', args.mois))
			.first();
		if (existing) {
			await ctx.db.patch(existing._id, { ca: args.ca, rdv: args.rdv });
		} else {
			await ctx.db.insert('objectifs', {
				userId: args.userId,
				mois: args.mois,
				ca: args.ca,
				rdv: args.rdv
			});
		}
	}
});

// Objectifs enregistrés pour un mois, limités au périmètre de l'utilisateur connecté.
// Utilisé par le tableau de bord (listTeamMembers) et par le dialogue de saisie.
export const listByMonth = query({
	args: { mois: v.string() },
	handler: async (ctx, { mois }) => {
		const user = await getCurrentUser(ctx);
		if (!/^\d{4}-\d{2}$/.test(mois)) return [];
		const agencyIds = await visibleAgencyIds(ctx, user);
		const all = await ctx.db
			.query('objectifs')
			.withIndex('by_mois', (q) => q.eq('mois', mois))
			.collect();
		const agencyByUser = new Map<string, Id<'agences'> | undefined>();
		const ids = [...new Set(all.map((o) => o.userId))];
		const users = await Promise.all(ids.map((id) => ctx.db.get(id)));
		for (const u of users) if (u) agencyByUser.set(u._id, u.agencyId);

		return all
			.filter((o) => {
				if (agencyIds === null) return true;
				const a = agencyByUser.get(o.userId);
				return a != null && agencyIds.has(a);
			})
			.map((o) => ({ userId: o.userId, ca: o.ca, rdv: o.rdv }));
	}
});

// Employés de l'agence du directeur (cibles des objectifs), actifs.
export const listTargets = query({
	args: {},
	handler: async (ctx) => {
		const user = await getCurrentUser(ctx);
		if (!canSetObjectifs(user)) {
			return [];
		}
		// Périmètre : toutes les agences pour l'administrateur, son agence pour le
		// directeur d'agence.
		const agencyIds = await visibleAgencyIds(ctx, user);
		const users = await ctx.db.query('users').collect();
		return users
			.filter((u) => {
				if (u.statut === 'viré') return false;
				if (!u.agencyId) return false;
				if (agencyIds === null) return true;
				return agencyIds.has(u.agencyId as Id<'agences'>);
			})
			.map((u) => ({
				_id: u._id,
				firstName: u.firstName ?? '',
				lastName: u.lastName ?? '',
				role: u.role ?? null,
				isMe: u._id === user._id
			}))
			.sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`));
	}
});
