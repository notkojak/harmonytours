import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { canManageEvenements, getCurrentUser } from './permissions';

// Événements de l'agenda partagé (réunion, formation, prospection, gestion
// dossier). Créés par les managers : administrateur, animateur, directeur d'agence.

const typeValidator = v.union(
	v.literal('réunion'),
	v.literal('formation'),
	v.literal('prospection'),
	v.literal('gestion')
);

// Section de prospection : nom d'équipe (optionnel) + secteur + membres.
const sectionValidator = v.object({
	nom: v.optional(v.string()),
	secteur: v.string(),
	membres: v.array(v.id('users'))
});

const sectionValidatorArg = v.optional(v.array(sectionValidator));

// Événements de l'agence de l'utilisateur connecté, avec les noms des membres liés.
export const list = query({
	args: {},
	handler: async (ctx) => {
		const user = await getCurrentUser(ctx);
		if (!user.agencyId) return [];
		const events = await ctx.db
			.query('evenements')
			.withIndex('by_agency', (q) => q.eq('agencyId', user.agencyId))
			.collect();

		const memberIds = [
			...new Set(
				events.flatMap((e) => [
					...(e.membres ?? []),
					...(e.sections ?? []).flatMap((s) => s.membres)
				])
			)
		];
		const users = await Promise.all(memberIds.map((id) => ctx.db.get(id)));
		const nameById = new Map<string, string>();
		for (const u of users) {
			if (!u) continue;
			nameById.set(u._id, `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim());
		}

		return events
			.map((e) => ({
				...e,
				membreNames: (e.membres ?? []).map((id) => nameById.get(id) ?? '').filter(Boolean),
				sections: (e.sections ?? []).map((s) => ({
					...s,
					membreNames: s.membres.map((id) => nameById.get(id) ?? '').filter(Boolean)
				}))
			}))
			.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
	}
});

// Membres de l'équipe liables à un événement (même périmètre que le connecté).
export const listMembres = query({
	args: {},
	handler: async (ctx) => {
		const user = await getCurrentUser(ctx);
		const users = await ctx.db.query('users').collect();
		const scopeAll = user.role === 'administrateur' || user.role === 'directeur de zone';
		return users
			.filter((u) => {
				if (u.statut === 'viré') return false;
				if (!scopeAll && u.agencyId !== user.agencyId) return false;
				return true;
			})
			.map((u) => ({
				_id: u._id,
				firstName: u.firstName ?? '',
				lastName: u.lastName ?? '',
				photo: u.photo ?? null
			}));
	}
});

export const create = mutation({
	args: {
		type: typeValidator,
		titre: v.string(),
		date: v.string(),
		start: v.string(),
		end: v.string(),
		secteur: v.optional(v.string()),
		membres: v.optional(v.array(v.id('users'))),
		sections: sectionValidatorArg
	},
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		if (!canManageEvenements(user)) {
			throw new Error('Non autorisé.');
		}
		return await ctx.db.insert('evenements', {
			...args,
			agencyId: user.agencyId ?? undefined,
			createdBy: user._id
		});
	}
});

export const remove = mutation({
	args: { eventId: v.id('evenements') },
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		if (!canManageEvenements(user)) {
			throw new Error('Non autorisé.');
		}
		const event = await ctx.db.get(args.eventId);
		if (!event) return;
		// Directeur d'agence / animateur : uniquement les événements de son agence.
		const scopeAll = user.role === 'administrateur' || user.role === 'directeur de zone';
		if (!scopeAll && event.agencyId && event.agencyId !== user.agencyId) {
			throw new Error('Non autorisé.');
		}
		await ctx.db.delete(args.eventId);
	}
});

// Mise à jour d'un événement : déplacement par glisser-déposer (date, horaires)
// ou édition complète (type, intitulé, secteur, membres) — réservé aux managers.
// Seuls les champs fournis sont modifiés ; un secteur/membres vidé est retiré.
export const update = mutation({
	args: {
		eventId: v.id('evenements'),
		type: v.optional(typeValidator),
		titre: v.optional(v.string()),
		date: v.optional(v.string()),
		start: v.optional(v.string()),
		end: v.optional(v.string()),
		secteur: v.optional(v.string()),
		membres: v.optional(v.array(v.id('users'))),
		sections: sectionValidatorArg
	},
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		if (!canManageEvenements(user)) {
			throw new Error('Non autorisé.');
		}
		const event = await ctx.db.get(args.eventId);
		if (!event) return;
		// Directeur d'agence / animateur : uniquement les événements de son agence.
		const scopeAll = user.role === 'administrateur' || user.role === 'directeur de zone';
		if (!scopeAll && event.agencyId && event.agencyId !== user.agencyId) {
			throw new Error('Non autorisé.');
		}
		const patch: Record<string, unknown> = {};
		if (args.type !== undefined) patch.type = args.type;
		if (args.titre !== undefined) patch.titre = args.titre;
		if (args.date !== undefined) patch.date = args.date;
		if (args.start !== undefined) patch.start = args.start;
		if (args.end !== undefined) patch.end = args.end;
		// Secteur vide → champ retiré (permet de l'effacer en changeant de type).
		if (args.secteur !== undefined) patch.secteur = args.secteur || undefined;
		if (args.membres !== undefined) patch.membres = args.membres;
		if (args.sections !== undefined) patch.sections = args.sections;
		await ctx.db.patch(args.eventId, patch as never);
	}
});
