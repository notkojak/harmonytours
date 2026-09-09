import { type MutationCtx, mutation, query } from './_generated/server';
import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { canManageEmployes, getCurrentUser } from './permissions';
import { canViewAllCrm, isUserInScope, visibleAgencyIds } from './access';

// Suivi (rappel / RDV) avec les infos du RDV : commercial rattaché et statut.
const followUpValidator = v.object({
	type: v.union(v.literal('rappel'), v.literal('rdv')),
	date: v.string(),
	time: v.optional(v.string()),
	commercial: v.optional(v.string()),
	status: v.optional(v.union(v.literal('annulé'), v.literal('déballé'), v.literal('vendu'))),
	// Type de RDV placé : confortation (validation client) ou gestion dossier.
	motif: v.optional(v.union(v.literal('confortation'), v.literal('gestion'))),
	nonVenteReason: v.optional(v.string()),
	annulationReason: v.optional(v.string())
});

// Un RDV ne peut pas être planifié un dimanche : l'agenda (web et mobile)
// affiche du lundi au samedi, un RDV du dimanche y serait invisible.
// En édition, on tolère le cas hérité : un RDV déjà posé un dimanche reste
// modifiable tant qu'on ne change pas sa date.
function assertRdvNotOnSunday(
	followUp: { type: 'rappel' | 'rdv'; date: string } | undefined,
	current?: { type: 'rappel' | 'rdv'; date: string } | undefined
) {
	if (!followUp || followUp.type !== 'rdv') return;
	const [y, m, d] = followUp.date.split('-').map((p) => Number(p));
	if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return;
	const isSunday = new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0;
	if (!isSunday) return;
	// Cas hérité : le RDV était déjà posé ce dimanche-là (même type, même
	// date) → on laisse modifier le reste sans forcer à changer la date.
	if (current?.type === 'rdv' && current.date === followUp.date) return;
	throw new Error('Les RDV ne peuvent pas être planifiés un dimanche.');
}

// Le commercial rattaché (binôme) ne peut pas être celui qui a pris le RDV :
// le créateur du contact ne peut pas être son propre binôme. On tolère le cas
// hérité où le commercial déjà enregistré est le créateur (aucun changement).
async function assertCommercialNotCreator(
	ctx: MutationCtx,
	contact: { createdBy?: Id<'users'> | null; followUp?: { commercial?: string } | null },
	commercial: string | undefined
) {
	if (!commercial || !commercial.trim()) return;
	if (commercial === contact.followUp?.commercial) return;
	const creator = contact.createdBy ? await ctx.db.get(contact.createdBy) : null;
	const creatorName = creator
		? `${creator.firstName ?? ''} ${creator.lastName ?? ''}`.trim().toLowerCase()
		: '';
	if (creatorName && commercial.trim().toLowerCase() === creatorName) {
		throw new Error('Le commercial rattaché ne peut pas être celui qui a pris le RDV.');
	}
}

// Création d'un contact (client potentiel) par l'utilisateur connecté.
export const create = mutation({
	args: {
		name: v.string(),
		address: v.optional(v.string()),
		phone: v.optional(v.string()),
		projet: v.optional(v.string()),
		source: v.optional(v.union(v.literal('TAP'), v.literal('GMS'), v.literal('PHONE'))),
		note: v.optional(v.string()),
		followUp: v.optional(followUpValidator)
	},
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		assertRdvNotOnSunday(args.followUp);
		return await ctx.db.insert('contacts', {
			...args,
			statut: 'actif',
			agencyId: user.agencyId,
			createdBy: user._id,
			rdvHistory: args.followUp?.type === 'rdv' ? [{ at: Date.now() }] : undefined
		});
	}
});

// Enregistre un recontact (réponse) et repositionne éventuellement le suivi.
export const recontact = mutation({
	args: {
		contactId: v.id('contacts'),
		response: v.string(),
		rdvSwitchReason: v.optional(v.string()),
		followUp: v.optional(followUpValidator)
	},
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		const contact = await ctx.db.get(args.contactId);
		if (!contact) {
			throw new Error('Contact introuvable.');
		}
		if (contact.createdBy !== user._id) {
			throw new Error('Non autorisé.');
		}
		assertRdvNotOnSunday(args.followUp, contact.followUp);
		if (args.followUp) await assertCommercialNotCreator(ctx, contact, args.followUp.commercial);
		// Historique RDV : un nouveau RDV est compté, ou la raison du passage en rappel
		// est enregistrée sur le dernier RDV lorsqu'on le remplace par un rappel.
		let rdvHistory: { at: number; reason?: string }[] | undefined;
		if (args.followUp?.type === 'rdv') {
			rdvHistory = [...(contact.rdvHistory ?? []), { at: Date.now() }];
		} else if (args.followUp?.type === 'rappel' && contact.followUp?.type === 'rdv') {
			const history = contact.rdvHistory ?? [];
			if (history.length > 0) {
				const last = history[history.length - 1];
				const lastAt = typeof last === 'number' ? last : last.at;
				rdvHistory = [
					...history.slice(0, -1),
					{ at: lastAt, reason: args.rdvSwitchReason || undefined }
				];
			}
		}

		await ctx.db.patch(args.contactId, {
			recontacts: [...(contact.recontacts ?? []), { date: Date.now(), response: args.response }],
			...(args.followUp ? { followUp: args.followUp } : {}),
			...(rdvHistory ? { rdvHistory } : {})
		});
	}
});

// Mise à jour rapide du suivi depuis la fiche (mode consultation) : change le
// statut du RDV et/ou le commercial rattaché, sans ouvrir le formulaire de
// modification. Permissions : le créateur du contact, le commercial lié au RDV,
// ou un manager CRM (administrateur, directeur de zone/agence, animateur) — qui
// voit déjà tous les contacts de son périmètre.
export const setFollowUpFields = mutation({
	args: {
		contactId: v.id('contacts'),
		commercial: v.optional(v.string()),
		status: v.optional(
			v.union(v.literal('annulé'), v.literal('déballé'), v.literal('vendu'), v.literal(''))
		),
		nonVenteReason: v.optional(v.string()),
		annulationReason: v.optional(v.string())
	},
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		const contact = await ctx.db.get(args.contactId);
		if (!contact) {
			throw new Error('Contact introuvable.');
		}
		const isCreator = contact.createdBy === user._id;
		const myName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim().toLowerCase();
		const isLinked =
			!!contact.followUp?.commercial && contact.followUp.commercial.trim().toLowerCase() === myName;
		// Les managers CRM voient tous les contacts de leur périmètre : ils doivent
		// pouvoir passer un RDV en annulé/déballé (avec raison) ou vendu, même sur
		// un RDV qu'ils n'ont ni créé ni suivi.
		if (!isCreator && !isLinked && !canViewAllCrm(user)) {
			throw new Error('Non autorisé.');
		}

		const fu = contact.followUp;
		if (!fu || fu.type !== 'rdv') {
			throw new Error('Aucun RDV à mettre à jour sur ce contact.');
		}
		const patch: { followUp: typeof fu } = {
			followUp: {
				type: fu.type,
				date: fu.date,
				time: fu.time,
				commercial: args.commercial !== undefined ? args.commercial : fu.commercial,
				status: args.status == null || args.status === '' ? undefined : args.status,
				// On conserve le type de RDV (confortation / gestion dossier).
				motif: fu.motif,
				nonVenteReason: args.nonVenteReason !== undefined ? args.nonVenteReason : fu.nonVenteReason,
				annulationReason:
					args.annulationReason !== undefined ? args.annulationReason : fu.annulationReason
			}
		};
		if (args.commercial) {
			await assertCommercialNotCreator(ctx, contact, args.commercial);
			// Rejette un commercial hors de l'agence du contact (même périmètre que list).
			const users = await ctx.db.query('users').collect();
			const target =
				users.find(
					(u) =>
						`${u.firstName ?? ''} ${u.lastName ?? ''}`.trim().toLowerCase() ===
						args.commercial?.toLowerCase()
				) ?? null;
			if (target && contact.agencyId && target.agencyId !== contact.agencyId) {
				throw new Error('Non autorisé pour cette agence.');
			}
		}
		await ctx.db.patch(args.contactId, patch);
	}
});

// Marque le contact comme traité.
export const markTreated = mutation({
	args: { contactId: v.id('contacts') },
	handler: async (ctx, { contactId }) => {
		const user = await getCurrentUser(ctx);
		const contact = await ctx.db.get(contactId);
		if (!contact) {
			throw new Error('Contact introuvable.');
		}
		if (contact.createdBy !== user._id) {
			throw new Error('Non autorisé.');
		}
		await ctx.db.patch(contactId, { statut: 'traité' });
	}
});

// Contacts visibles par l'utilisateur connecté, triés par date de suivi (rappel / RDV).
// Les contacts devenus clients (isClient) sont exclus par défaut — ils n'apparaissent
// que dans l'onglet Clients. L'agenda passe includeClients pour garder leurs RDV visibles.
//
// Accès : un commercial ne voit que ses propres contacts. Les managers (animateur,
// directeur d'agence, directeur de zone, administrateur) voient tous les contacts de
// leur périmètre et peuvent les filtrer par personne (personId, un commercial du périmètre).
export const list = query({
	args: {
		includeClients: v.optional(v.boolean()),
		personId: v.optional(v.id('users'))
	},
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);

		if (canViewAllCrm(user)) {
			const scopeIds = await visibleAgencyIds(ctx, user);
			// Si un commercial est sélectionné, on ne garde que ses contacts. On refuse
			// de filtrer par une personne hors du périmètre.
			let filterUser: Doc<'users'> | null = null;
			if (args.personId) {
				if (!(await isUserInScope(ctx, user, args.personId))) {
					throw new Error('Non autorisé.');
				}
				const u = await ctx.db.get(args.personId);
				if (u) filterUser = u;
			}

			const contacts = await ctx.db.query('contacts').collect();
			const scoped = contacts.filter((c) => {
				if (!c.agencyId) return false;
				if (scopeIds !== null && !scopeIds.has(c.agencyId)) return false;
				if (args.includeClients || !c.isClient) {
					// ok
				} else return false;
				if (filterUser && c.createdBy !== filterUser._id) return false;
				return true;
			});

			const creatorIds = [
				...new Set(scoped.map((c) => c.createdBy).filter((id): id is Id<'users'> => !!id))
			];
			const creators = await Promise.all(creatorIds.map((id) => ctx.db.get(id)));
			const nameById = new Map<string, string>();
			for (const u of creators) {
				if (!u) continue;
				nameById.set(u._id, `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim());
			}

			return scoped
				.map((contact) => ({
					...contact,
					createdByName: contact.createdBy ? (nameById.get(contact.createdBy) ?? '') : ''
				}))
				.sort((a, b) => {
					const dateA = a.followUp?.date ?? '9999-99-99';
					const dateB = b.followUp?.date ?? '9999-99-99';
					return (
						dateA.localeCompare(dateB) ||
						(a.followUp?.time ?? '').localeCompare(b.followUp?.time ?? '')
					);
				});
		}

		const contacts = await ctx.db
			.query('contacts')
			.withIndex('by_createdBy', (q) => q.eq('createdBy', user._id))
			.collect();
		// Tous ces contacts ont été créés par l'utilisateur connecté : le commercial
		// lié est donc son nom.
		const createdByName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
		return contacts
			.filter((c) => args.includeClients || !c.isClient)
			.map((contact) => ({ ...contact, createdByName }))
			.sort((a, b) => {
				const dateA = a.followUp?.date ?? '9999-99-99';
				const dateB = b.followUp?.date ?? '9999-99-99';
				return (
					dateA.localeCompare(dateB) ||
					(a.followUp?.time ?? '').localeCompare(b.followUp?.time ?? '')
				);
			});
	}
});

// Renvoie un contact par id (créateur ou commercial lié au RDV uniquement).
export const getById = query({
	args: { contactId: v.id('contacts') },
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		const contact = await ctx.db.get(args.contactId);
		if (!contact) {
			throw new Error('Contact introuvable.');
		}
		const isCreator = contact.createdBy === user._id;
		const myName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim().toLowerCase();
		const isLinked =
			!!contact.followUp?.commercial && contact.followUp.commercial.trim().toLowerCase() === myName;
		if (!isCreator && !isLinked) {
			throw new Error('Non autorisé.');
		}
		return contact;
	}
});

// Supprime un contact (créateur ou manager). Le RDV/rappel lié (followUp) part
// avec le contact ; si le contact est client, ses ventes sont supprimées aussi.
export const remove = mutation({
	args: { contactId: v.id('contacts') },
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		const contact = await ctx.db.get(args.contactId);
		if (!contact) {
			throw new Error('Contact introuvable.');
		}
		// Le créateur du contact ou un manager (admin / directeur de zone /
		// directeur d'agence) peut supprimer.
		if (contact.createdBy !== user._id && !canManageEmployes(user)) {
			throw new Error('Non autorisé.');
		}
		// Supprime aussi les ventes liées (client) pour ne pas laisser d'orphelins.
		const ventes = await ctx.db
			.query('ventes')
			.withIndex('by_contact', (q) => q.eq('contactId', args.contactId))
			.collect();
		for (const vente of ventes) {
			await ctx.db.delete(vente._id);
		}
		await ctx.db.delete(args.contactId);
	}
});

// Agenda partagé : contacts de toute l'agence de l'utilisateur connecté (avec
// le nom du créateur de chaque contact, pour l'affichage et les permissions).
export const listAgenda = query({
	args: { includeClients: v.optional(v.boolean()) },
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		if (!user.agencyId) return [];
		const contacts = await ctx.db
			.query('contacts')
			.withIndex('by_agency', (q) => q.eq('agencyId', user.agencyId))
			.collect();

		// Noms des créateurs (pour afficher et vérifier le propriétaire du RDV).
		const creatorIds = [
			...new Set(contacts.map((c) => c.createdBy).filter((id): id is Id<'users'> => !!id))
		];
		const creators = await Promise.all(creatorIds.map((id) => ctx.db.get(id)));
		const nameById = new Map<string, string>();
		for (const u of creators) {
			if (!u) continue;
			nameById.set(u._id, `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim());
		}

		return contacts
			.filter((c) => args.includeClients || !c.isClient)
			.map((contact) => ({
				...contact,
				createdByName: contact.createdBy ? (nameById.get(contact.createdBy) ?? '') : ''
			}))
			.sort((a, b) => {
				const dateA = a.followUp?.date ?? '9999-99-99';
				const dateB = b.followUp?.date ?? '9999-99-99';
				return (
					dateA.localeCompare(dateB) ||
					(a.followUp?.time ?? '').localeCompare(b.followUp?.time ?? '')
				);
			});
	}
});

// Modification d'un contact : le créateur peut tout modifier, le commercial lié
// au RDV (binôme) ne peut que déplacer le RDV (mise à jour du suivi).
export const update = mutation({
	args: {
		contactId: v.id('contacts'),
		name: v.optional(v.string()),
		address: v.optional(v.string()),
		phone: v.optional(v.string()),
		projet: v.optional(v.string()),
		source: v.optional(v.union(v.literal('TAP'), v.literal('GMS'), v.literal('PHONE'))),
		note: v.optional(v.string()),
		rdvSwitchReason: v.optional(v.string()),
		followUp: v.optional(followUpValidator)
	},
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		const contact = await ctx.db.get(args.contactId);
		if (!contact) {
			throw new Error('Contact introuvable.');
		}
		const isCreator = contact.createdBy === user._id;
		const myName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim().toLowerCase();
		const isLinked =
			!!contact.followUp?.commercial && contact.followUp.commercial.trim().toLowerCase() === myName;
		if (!isCreator && !isLinked) {
			throw new Error('Non autorisé.');
		}
		assertRdvNotOnSunday(args.followUp, contact.followUp);
		if (args.followUp) await assertCommercialNotCreator(ctx, contact, args.followUp.commercial);
		if (!isCreator) {
			// Commercial lié au RDV : autorisé uniquement à déplacer le RDV.
			const keys = Object.keys(args).filter((k) => k !== 'contactId');
			if (keys.some((k) => k !== 'followUp')) {
				throw new Error('Non autorisé.');
			}
		}

		const patch: {
			name?: string;
			address?: string;
			phone?: string;
			projet?: string;
			source?: 'TAP' | 'GMS' | 'PHONE';
			note?: string;
			followUp?: {
				type: 'rappel' | 'rdv';
				date: string;
				time?: string;
				commercial?: string;
				status?: 'annulé' | 'déballé' | 'vendu';
			};
			rdvHistory?: { at: number; reason?: string }[];
		} = {};
		if (args.name !== undefined) patch.name = args.name;
		if (args.address !== undefined) patch.address = args.address;
		if (args.phone !== undefined) patch.phone = args.phone;
		if (args.projet !== undefined) patch.projet = args.projet;
		if (args.source !== undefined) patch.source = args.source;
		if (args.note !== undefined) patch.note = args.note;
		if (args.followUp !== undefined) patch.followUp = args.followUp;
		// Historique RDV : un nouveau RDV est compté quand le suivi passe de rappel à RDV,
		// et la raison du passage en rappel est enregistrée sur le dernier RDV sinon.
		// Un simple passage en rappel ne supprime jamais l'historique des RDV.
		if (args.followUp?.type === 'rdv' && contact.followUp?.type !== 'rdv') {
			patch.rdvHistory = [...(contact.rdvHistory ?? []), { at: Date.now() }];
		} else if (args.followUp?.type === 'rappel' && contact.followUp?.type === 'rdv') {
			const history = contact.rdvHistory ?? [];
			if (history.length > 0) {
				const last = history[history.length - 1];
				const lastAt = typeof last === 'number' ? last : last.at;
				patch.rdvHistory = [
					...history.slice(0, -1),
					{ at: lastAt, reason: args.rdvSwitchReason || undefined }
				];
			}
		}

		await ctx.db.patch(args.contactId, patch);
	}
});
