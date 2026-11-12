import {
	internalMutation,
	type MutationCtx,
	type QueryCtx,
	mutation,
	query
} from './_generated/server';
import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { assertCanWriteCrm, canManageEmployes, canReassignContact, canWriteCrm, getCurrentUser } from './permissions';
import { canViewAllCrm, isUserInScope, visibleAgencyIds } from './access';
import { qualifValidator } from './schema';

/** Téléphone réduit aux chiffres : sert de clé de détection des doublons. */
export function phoneKeyOf(phone: string | undefined | null): string | undefined {
	const digits = (phone ?? '').replace(/\D/g, '');
	return digits.length >= 8 ? digits : undefined;
}

function displayName(u: { firstName?: string; lastName?: string; email?: string }): string {
	return `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email || 'Commercial';
}

/**
 * Le commercial d'un RDV est stocké deux fois : son nom (affichage historique)
 * et son id (clé de calcul). On complète toujours l'un à partir de l'autre pour
 * que les fiches existantes, qui n'ont qu'un nom, gagnent un id à la première
 * écriture.
 */
async function resolveCommercial<T extends { commercial?: string; commercialId?: Id<'users'> }>(
	ctx: MutationCtx,
	followUp: T
): Promise<T> {
	if (followUp.commercialId) {
		const u = await ctx.db.get(followUp.commercialId);
		if (u) return { ...followUp, commercial: displayName(u) };
		return followUp;
	}
	const name = followUp.commercial?.trim();
	if (!name) return followUp;
	const users = await ctx.db.query('users').collect();
	const target = users.find(
		(u) => displayName(u).toLowerCase() === name.toLowerCase()
	);
	return target ? { ...followUp, commercialId: target._id } : followUp;
}

// Suivi (rappel / RDV) avec les infos du RDV : commercial rattaché et statut.
const followUpValidator = v.object({
	type: v.union(v.literal('rappel'), v.literal('rdv')),
	date: v.string(),
	time: v.optional(v.string()),
	commercial: v.optional(v.string()),
	commercialId: v.optional(v.id('users')),
	status: v.optional(
		v.union(
			v.literal('annulé'),
			v.literal('déballé'),
			v.literal('vendu'),
			v.literal('à reprogrammer')
		)
	),
	// Type de RDV placé : confortation (validation client) ou gestion dossier.
	motif: v.optional(v.union(v.literal('confortation'), v.literal('gestion'))),
	nonVenteReason: v.optional(v.string()),
	nonVenteCode: v.optional(v.string()),
	annulationReason: v.optional(v.string()),
	annulationCode: v.optional(v.string()),
	// Horodatage (ms) de la mise en « annulé » du RDV.
	annulationDate: v.optional(v.number())
});

type Suivi = NonNullable<Doc<'contacts'>['followUp']>;

// Trace laissée dans l'historique quand un RDV passe en rappel : l'issue du RDV
// (statut, raisons, motif, commercial, date planifiée) est recopiée sur l'entrée
// d'historique. Le passage en rappel ne l'efface donc pas : un RDV déballé garde
// sa raison de non-vente, un RDV annulé sa raison d'annulation.
function traceRdvClos(fu: Suivi | undefined) {
	const trace: {
		status?: Suivi['status'];
		nonVenteReason?: string;
		annulationReason?: string;
		annulationDate?: number;
		motif?: Suivi['motif'];
		commercial?: string;
		date?: string;
	} = {};
	if (!fu) return trace;
	if (fu.status) trace.status = fu.status;
	if (fu.nonVenteReason) trace.nonVenteReason = fu.nonVenteReason;
	if (fu.annulationReason) trace.annulationReason = fu.annulationReason;
	if (fu.annulationDate != null) trace.annulationDate = fu.annulationDate;
	if (fu.motif) trace.motif = fu.motif;
	if (fu.commercial) trace.commercial = fu.commercial;
	if (fu.date) trace.date = fu.date;
	return trace;
}

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

// Création d'un contact (client potentiel) par l'utilisateur connecté.
export const create = mutation({
	args: {
		name: v.string(),
		civilites: v.optional(v.array(v.union(v.literal('M.'), v.literal('Mme'), v.literal('Melle')))),
		address: v.optional(v.string()),
		addressStreet: v.optional(v.string()),
		addressPostalCode: v.optional(v.string()),
		addressCity: v.optional(v.string()),
		latitude: v.optional(v.number()),
		longitude: v.optional(v.number()),
		phone: v.optional(v.string()),
		projet: v.optional(v.string()),
		source: v.optional(v.union(v.literal('TAP'), v.literal('GMS'), v.literal('PHONE'))),
		note: v.optional(v.string()),
		// Questions découverte : structuré, stocké hors de la note.
		qualif: v.optional(qualifValidator),
		followUp: v.optional(followUpValidator)
	},
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		assertRdvNotOnSunday(args.followUp);
		const followUp = args.followUp ? await resolveCommercial(ctx, args.followUp) : undefined;
		const contactId = await ctx.db.insert('contacts', {
			...args,
			...(followUp ? { followUp } : {}),
			phoneKey: phoneKeyOf(args.phone),
			statut: 'actif',
			agencyId: user.agencyId,
			createdBy: user._id,
			rdvHistory: followUp?.type === 'rdv' ? [{ at: Date.now() }] : undefined
		});
		return contactId;
	}
});

// Journalise un recontact (réponse) sans toucher au suivi du contact : le
// rendez-vous ou le rappel en cours reste tel quel, même si la personne n'a
// pas répondu. Le prochain RDV se pose explicitement (fiche ou agenda).
export const recontact = mutation({
	args: {
		contactId: v.id('contacts'),
		response: v.string()
	},
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		const contact = await ctx.db.get(args.contactId);
		if (!contact || contact.deletedAt) {
			throw new Error('Contact introuvable.');
		}
		const myName = displayName(user).trim().toLowerCase();
		const isCreator = contact.createdBy === user._id;
		const isLinked =
			contact.followUp?.commercialId === user._id ||
			(contact.followUp?.commercial ?? '').trim().toLowerCase() === myName;
		const canEditScope =
			canReassignContact(user) && (await canReadAsManager(ctx, user, contact));
		if (!isCreator && !isLinked && !canEditScope) {
			throw new Error('Non autorisé.');
		}
		const response = args.response.trim();
		if (!response) {
			throw new Error('Renseigne la réponse au recontact.');
		}
		// La date fait foi côté serveur : on la renvoie pour que le client puisse
		// ensuite supprimer exactement cette ligne.
		const entry = { date: Date.now(), response };
		await ctx.db.patch(args.contactId, {
			recontacts: [...(contact.recontacts ?? []), entry]
		});
		return entry;
	}
});

// Supprime une ligne du journal de recontact (erreur de saisie, doublon).
// Mêmes droits que la consignation.
export const removeRecontact = mutation({
	args: {
		contactId: v.id('contacts'),
		date: v.number()
	},
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		const contact = await ctx.db.get(args.contactId);
		if (!contact || contact.deletedAt) {
			throw new Error('Contact introuvable.');
		}
		const myName = displayName(user).trim().toLowerCase();
		const isCreator = contact.createdBy === user._id;
		const isLinked =
			contact.followUp?.commercialId === user._id ||
			(contact.followUp?.commercial ?? '').trim().toLowerCase() === myName;
		const canEditScope =
			canReassignContact(user) && (await canReadAsManager(ctx, user, contact));
		if (!isCreator && !isLinked && !canEditScope) {
			throw new Error('Non autorisé.');
		}
		const recontacts = contact.recontacts ?? [];
		let next = recontacts.filter((r) => r.date !== args.date);
		if (next.length === recontacts.length) {
			// Les fiches créées avant ce correctif portent des dates décalées de
			// quelques millisecondes : on retombe sur l'échange le plus proche.
			const target = recontacts.reduce<(typeof recontacts)[number] | null>((best, r) => {
				if (Math.abs(r.date - args.date) > 10_000) return best;
				return !best || Math.abs(r.date - args.date) < Math.abs(best.date - args.date) ? r : best;
			}, null);
			if (!target) {
				throw new Error('Recontact introuvable.');
			}
			next = recontacts.filter((r) => r !== target);
		}
		await ctx.db.patch(args.contactId, { recontacts: next });
	}
});

// RDV de confortation sur une fiche client / une vente : un rendez-vous de
// suivi qui ne compte pas comme un RDV dans les statistiques. Il ne touche pas
// à `rdvHistory` (aucune prise de RDV commercial) et ne crée ni vente ni rappel.
// Autorisé au créateur, au commercial lié au suivi, ou à un manager du périmètre.
export const scheduleConfortation = mutation({
	args: {
		contactId: v.id('contacts'),
		date: v.string(),
		time: v.optional(v.string()),
		commercial: v.optional(v.string()),
		commercialId: v.optional(v.id('users'))
	},
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		const contact = await ctx.db.get(args.contactId);
		if (!contact || contact.deletedAt) {
			throw new Error('Contact introuvable.');
		}
		const myName = displayName(user).trim().toLowerCase();
		const isCreator = contact.createdBy === user._id;
		const isLinked =
			contact.followUp?.commercialId === user._id ||
			(contact.followUp?.commercial ?? '').trim().toLowerCase() === myName;
		const canEditScope =
			canReassignContact(user) && (await canReadAsManager(ctx, user, contact));
		if (!isCreator && !isLinked && !canEditScope) {
			throw new Error('Non autorisé.');
		}
		assertRdvNotOnSunday({ type: 'rdv', date: args.date });
		const followUp = await resolveCommercial(ctx, {
			type: 'rdv' as const,
			date: args.date,
			...(args.time ? { time: args.time } : {}),
			motif: 'confortation' as const,
			...(args.commercial ? { commercial: args.commercial } : {}),
			...(args.commercialId ? { commercialId: args.commercialId } : {})
		});
		await ctx.db.patch(args.contactId, { followUp });
		return followUp;
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
			v.union(
				v.literal('annulé'),
				v.literal('déballé'),
				v.literal('vendu'),
				v.literal('à reprogrammer'),
				v.literal('')
			)
		),
		nonVenteReason: v.optional(v.string()),
		nonVenteCode: v.optional(v.string()),
		annulationReason: v.optional(v.string()),
		annulationCode: v.optional(v.string())
	},
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		assertCanWriteCrm(user);
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
		// Statut absent de l'appel = on n'y touche pas : l'attribution d'un RDV à un
		// commercial (« Attribuer à… ») ne doit pas effacer son statut vendu /
		// déballé / annulé, sinon le RDV traité disparaît des chiffres.
		const status =
			args.status === undefined
				? fu.status
				: args.status === ''
					? undefined
					: args.status;
		const target = args.commercial
			? ((await ctx.db.query('users').collect()).find(
					(u) => displayName(u).toLowerCase() === args.commercial?.trim().toLowerCase()
				) ?? null)
			: null;
		const patch: { followUp: typeof fu } = {
			followUp: {
				type: fu.type,
				date: fu.date,
				time: fu.time,
				commercial: args.commercial !== undefined ? args.commercial : fu.commercial,
				// Le nom affiché et l'id du commercial restent synchronisés.
				commercialId:
					args.commercial !== undefined
						? (target?._id as Id<'users'> | undefined)
						: fu.commercialId,
				status,
				// On conserve le type de RDV (confortation / gestion dossier).
				motif: fu.motif,
				nonVenteReason: args.nonVenteReason !== undefined ? args.nonVenteReason : fu.nonVenteReason,
				nonVenteCode: args.nonVenteCode !== undefined ? args.nonVenteCode : fu.nonVenteCode,
				annulationReason:
					args.annulationReason !== undefined ? args.annulationReason : fu.annulationReason,
				annulationCode:
					args.annulationCode !== undefined ? args.annulationCode : fu.annulationCode,
				// Date d'annulation : posée à la première mise en « annulé », conservée
				// ensuite (y compris si le RDV repasse programmé puis est ré-annulé).
				annulationDate:
					status === 'annulé'
						? fu.status === 'annulé'
							? fu.annulationDate
							: Date.now()
						: fu.annulationDate
			}
		};
		if (args.commercial) {
			// Rejette un commercial hors de l'agence du contact (même périmètre que list).
			if (target && contact.agencyId && target.agencyId !== contact.agencyId) {
				throw new Error('Non autorisé pour cette agence.');
			}
		}
		await ctx.db.patch(args.contactId, patch);
	}
});

// Marque le contact comme traité, ou annule ce marquage (treated: false) : le
// contact retrouve alors son suivi principal (RDV, rappel ou actif). Le suivi
// n'est pas touché ; la date et la raison du traitement sont conservées sur le
// contact pour que la fiche puisse les rejouer dans son historique.
export const markTreated = mutation({
	args: {
		contactId: v.id('contacts'),
		// false = on retire le marquage « traité ».
		treated: v.optional(v.boolean()),
		// Raison du traitement : journalisée dans l'historique de la fiche.
		reason: v.optional(v.string())
	},
	handler: async (ctx, { contactId, treated, reason }) => {
		const user = await getCurrentUser(ctx);
		assertCanWriteCrm(user);
		const contact = await ctx.db.get(contactId);
		if (!contact) {
			throw new Error('Contact introuvable.');
		}
		// Même périmètre que le reste de la fiche : le créateur, le commercial
		// rattaché au RDV, ou un manager CRM de l'agence peuvent clore ou
		// rouvrir le dossier.
		const myName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim().toLowerCase();
		const isLinked =
			!!contact.followUp?.commercial && contact.followUp.commercial.trim().toLowerCase() === myName;
		if (contact.createdBy !== user._id && !isLinked) {
			if (!canViewAllCrm(user)) {
				throw new Error('Non autorisé.');
			}
			if (contact.agencyId) {
				const scopeIds = await visibleAgencyIds(ctx, user);
				if (scopeIds !== null && !scopeIds.has(contact.agencyId as Id<'agences'>)) {
					throw new Error('Non autorisé pour cette agence.');
				}
			}
		}
		if (treated === false) {
			// La date et la raison restent en base : un nouveau marquage les remplace.
			await ctx.db.patch(contactId, { statut: 'actif' });
			return;
		}
		const treatedReason = reason?.trim() || contact.treatedReason;
		await ctx.db.patch(contactId, {
			statut: 'traité',
			treatedAt: Date.now(),
			...(treatedReason ? { treatedReason } : {})
		});
	}
});

// Marque la fiche contact comme imprimée (ou annule la marque) : sert à savoir
// quelles fiches ont déjà été sorties. Autorise le créateur, le commercial lié
// au RDV et les managers du périmètre.
export const markPrinted = mutation({
	args: {
		contactId: v.id('contacts'),
		// false = on retire la marque (impression annulée / à refaire).
		printed: v.optional(v.boolean())
	},
	handler: async (ctx, { contactId, printed }) => {
		const user = await getCurrentUser(ctx);
		const contact = await ctx.db.get(contactId);
		if (!contact) {
			throw new Error('Contact introuvable.');
		}
		const myName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim().toLowerCase();
		const isLinked =
			!!contact.followUp?.commercial && contact.followUp.commercial.trim().toLowerCase() === myName;
		const sameAgency = !!contact.agencyId && contact.agencyId === user.agencyId;
		if (contact.createdBy !== user._id && !isLinked && !sameAgency && !canViewAllCrm(user)) {
			throw new Error('Non autorisé.');
		}
		await ctx.db.patch(contactId, {
			printedAt: printed === false ? undefined : Date.now()
		});
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
		personId: v.optional(v.id('users')),
		// Archive : fiches supprimées (suppression douce), visibles par les managers.
		archived: v.optional(v.boolean())
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

			// Lecture par agence plutôt que de collecter toute la table : un
			// directeur d'agence ne lit plus les contacts des autres agences.
			const contacts =
				scopeIds === null
					? await ctx.db.query('contacts').collect()
					: (
							await Promise.all(
								[...scopeIds].map((agencyId) =>
									ctx.db
										.query('contacts')
										.withIndex('by_agency', (q) => q.eq('agencyId', agencyId))
										.collect()
								)
							)
						).flat();
			const scoped = contacts.filter((c) => {
				if (!c.agencyId) return false;
				if (scopeIds !== null && !scopeIds.has(c.agencyId)) return false;
				// Une fiche supprimée n'apparaît que dans l'onglet Archives.
				if (args.archived ? !c.deletedAt : !!c.deletedAt) return false;
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
		// Un commercial n'a pas accès aux archives (réservées aux managers).
		if (args.archived) return [];
		return contacts
			.filter((c) => !c.deletedAt)
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

// Renvoie un contact par id : créateur, commercial lié au RDV, ou manager
// (animateur, directeur d'agence, directeur de zone, administrateur) dont le
// périmètre couvre l'agence du contact — mêmes règles de lecture que la liste
// du CRM, pour que la fiche et la pré-remplissage d'édition mobile (impression
// de la fiche, modification) fonctionnent aussi sur le RDV d'un collègue.
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
		if (!isCreator && !isLinked && !(await canReadAsManager(ctx, user, contact))) {
			throw new Error('Non autorisé.');
		}
		// Le « Technicien conseil » de la fiche imprimée est le créateur du contact :
		// on renvoie son prénom + nom (les listes le font déjà, getById non).
		const creator = contact.createdBy ? await ctx.db.get(contact.createdBy) : null;
		const createdByName = creator
			? `${creator.firstName ?? ''} ${creator.lastName ?? ''}`.trim()
			: '';
		return { ...contact, createdByName };
	}
});

/**
 * Lecture autorisée pour un manager : le contact doit appartenir à une agence
 * visible par l'utilisateur (toutes pour un administrateur).
 */
async function canReadAsManager(
	ctx: QueryCtx,
	user: Doc<'users'>,
	contact: Doc<'contacts'>
): Promise<boolean> {
	if (!canViewAllCrm(user)) return false;
	if (!contact.agencyId) return false;
	const scopeIds = await visibleAgencyIds(ctx, user);
	return scopeIds === null || scopeIds.has(contact.agencyId);
}

// Supprime un contact (créateur ou manager). Le RDV/rappel lié (followUp) part
// avec le contact ; si le contact est client, ses ventes sont supprimées aussi.
export const remove = mutation({
	args: { contactId: v.id('contacts') },
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		assertCanWriteCrm(user);
		const contact = await ctx.db.get(args.contactId);
		if (!contact) {
			throw new Error('Contact introuvable.');
		}
		// Le créateur du contact ou un manager (admin / directeur de zone /
		// directeur d'agence) peut archiver la fiche.
		if (contact.createdBy !== user._id && !canManageEmployes(user)) {
			throw new Error('Non autorisé.');
		}
		if (contact.deletedAt) return;
		// Suppression douce : les ventes restent rattachées et aucune donnée n'est
		// perdue. Une fiche archivée disparaît des listes et des statistiques et
		// peut être restaurée par un manager.
		await ctx.db.patch(args.contactId, {
			deletedAt: Date.now(),
			deletedBy: user._id
		});
	}
});

/**
 * Restaure une fiche archivée. Réservé aux managers du périmètre : c'est la
 * sécurité qui manquait à la suppression en cascade des ventes.
 */
export const restore = mutation({
	args: { contactId: v.id('contacts') },
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		assertCanWriteCrm(user);
		const contact = await ctx.db.get(args.contactId);
		if (!contact) {
			throw new Error('Contact introuvable.');
		}
		if (!canManageEmployes(user)) {
			throw new Error('Non autorisé.');
		}
		if (contact.agencyId) {
			const scopeIds = await visibleAgencyIds(ctx, user);
			if (scopeIds !== null && !scopeIds.has(contact.agencyId)) {
				throw new Error('Non autorisé pour cette agence.');
			}
		}
		await ctx.db.patch(args.contactId, { deletedAt: undefined, deletedBy: undefined });
	}
});

// Doublons potentiels : même téléphone normalisé, ou même nom sur la même
// agence. Utilisé à la création de fiche pour éviter de compter deux fois le
// même client (et de payer deux fois la même vente).
export const findDoublons = query({
	args: {
		phone: v.optional(v.string()),
		name: v.optional(v.string()),
		excludeId: v.optional(v.id('contacts'))
	},
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		const agencyIds = await visibleAgencyIds(ctx, user);
		const phoneKey = phoneKeyOf(args.phone);
		const name = args.name?.trim().toLowerCase() ?? '';
		if (!phoneKey && name.length < 3) return [];

		const contacts = await ctx.db.query('contacts').collect();
		return contacts
			.filter((c) => {
				if (c.deletedAt) return false;
				if (c._id === args.excludeId) return false;
				if (agencyIds !== null && (!c.agencyId || !agencyIds.has(c.agencyId))) return false;
				const samePhone = !!phoneKey && phoneKeyOf(c.phone) === phoneKey;
				const sameName = name.length >= 3 && c.name.trim().toLowerCase() === name;
				return samePhone || sameName;
			})
			.slice(0, 8)
			.map((c) => ({
				_id: c._id,
				name: c.name,
				phone: c.phone ?? null,
				address: c.address ?? null,
				isClient: !!c.isClient,
				createdAt: c.dateContact ?? c._creationTime
			}));
	}
});

// Recherche serveur (nom, téléphone, adresse) limitée au périmètre : le
// navigateur n'a plus besoin de charger toutes les fiches pour filtrer.
export const search = query({
	args: { q: v.string(), limit: v.optional(v.number()) },
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		const term = args.q.trim().toLowerCase();
		const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);
		if (term.length < 2) return [];

		const agencyIds = await visibleAgencyIds(ctx, user);
		const contacts = await ctx.db.query('contacts').collect();
		return contacts
			.filter((c) => {
				if (c.deletedAt) return false;
				if (agencyIds !== null && (!c.agencyId || !agencyIds.has(c.agencyId))) return false;
				if (!canViewAllCrm(user) && c.createdBy !== user._id) {
					const myName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
					if (!myName || c.followUp?.commercial !== myName) return false;
				}
				const haystack = `${c.name} ${c.phone ?? ''} ${c.address ?? ''} ${c.addressCity ?? ''} ${
					c.addressPostalCode ?? ''
				}`.toLowerCase();
				return haystack.includes(term);
			})
			.slice(0, limit)
			.map((c) => ({
				_id: c._id,
				name: c.name,
				phone: c.phone ?? null,
				address: c.address ?? null,
				isClient: !!c.isClient,
				followUp: c.followUp ?? null
			}));
	}
});

// Compteurs de la navigation : deux nombres, au lieu de charger toutes les
// fiches et tous les clients à chaque page.
export const counts = query({
	args: {},
	handler: async (ctx) => {
		const user = await getCurrentUser(ctx);
		const agencyIds = await visibleAgencyIds(ctx, user);
		const contacts = await ctx.db.query('contacts').collect();
		let actifs = 0;
		let clients = 0;
		for (const c of contacts) {
			if (c.deletedAt) continue;
			if (agencyIds !== null && (!c.agencyId || !agencyIds.has(c.agencyId))) continue;
			if (!canViewAllCrm(user) && c.createdBy !== user._id) continue;
			if (c.isClient) clients++;
			else actifs++;
		}
		return { contacts: actifs, clients };
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
			.filter((c) => !c.deletedAt)
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
		civilites: v.optional(v.array(v.union(v.literal('M.'), v.literal('Mme'), v.literal('Melle')))),
		address: v.optional(v.string()),
		addressStreet: v.optional(v.string()),
		addressPostalCode: v.optional(v.string()),
		addressCity: v.optional(v.string()),
		latitude: v.optional(v.number()),
		longitude: v.optional(v.number()),
		phone: v.optional(v.string()),
		projet: v.optional(v.string()),
		source: v.optional(v.union(v.literal('TAP'), v.literal('GMS'), v.literal('PHONE'))),
		note: v.optional(v.string()),
		// Questions découverte : structuré, stocké hors de la note.
		qualif: v.optional(qualifValidator),
		// Date du contact corrigée depuis la fiche (ms).
		dateContact: v.optional(v.number()),
		// « Qui a pris le contact » : réservé au directeur de zone et au directeur
		// d'agence (voir canReassignContact).
		createdBy: v.optional(v.id('users')),
		rdvSwitchReason: v.optional(v.string()),
		followUp: v.optional(followUpValidator)
	},
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		const contact = await ctx.db.get(args.contactId);
		if (!contact) {
			throw new Error('Contact introuvable.');
		}
		// Le commercial peut corriger sa fiche (coordonnées, note, questions
		// découverte) mais pas changer l'issue du RDV : le statut (vendu, déballé,
		// annulé, à reprogrammer) est réservé aux rôles qui écrivent dans le CRM.
		if (
			!canWriteCrm(user) &&
			args.followUp !== undefined &&
			args.followUp.status !== contact.followUp?.status
		) {
			throw new Error('Non autorisé : ton rôle est en consultation seule sur le CRM.');
		}
		const isCreator = contact.createdBy === user._id;
		const myName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim().toLowerCase();
		const isLinked =
			!!contact.followUp?.commercial && contact.followUp.commercial.trim().toLowerCase() === myName;
		// Le directeur de zone / directeur d'agence peut corriger la fiche d'un
		// contact de son périmètre (dont la date et « qui a pris le contact »),
		// même s'il n'en est pas le créateur.
		const canEditScope = canReassignContact(user) && (await canReadAsManager(ctx, user, contact));
		if (!isCreator && !isLinked && !canEditScope) {
			throw new Error('Non autorisé.');
		}
		assertRdvNotOnSunday(args.followUp, contact.followUp);
		if (!isCreator && !canEditScope) {
			// Commercial lié au RDV : autorisé uniquement à déplacer le RDV.
			const keys = Object.keys(args).filter((k) => k !== 'contactId');
			if (keys.some((k) => k !== 'followUp')) {
				throw new Error('Non autorisé.');
			}
		}

		const patch: {
			name?: string;
			civilites?: ('M.' | 'Mme' | 'Melle')[];
			qualif?: Record<string, unknown>;
			address?: string;
			addressStreet?: string;
			addressPostalCode?: string;
			addressCity?: string;
			latitude?: number;
			longitude?: number;
			phone?: string;
			phoneKey?: string;
			projet?: string;
			source?: 'TAP' | 'GMS' | 'PHONE';
			note?: string;
			followUp?: {
				type: 'rappel' | 'rdv';
				date: string;
				time?: string;
				commercial?: string;
				commercialId?: Id<'users'>;
				status?: 'annulé' | 'déballé' | 'vendu' | 'à reprogrammer';
				motif?: 'confortation' | 'gestion';
				nonVenteReason?: string;
				nonVenteCode?: string;
				annulationReason?: string;
				annulationCode?: string;
				annulationDate?: number;
			};
			rdvHistory?: { at: number; reason?: string }[];
			dateContact?: number;
			createdBy?: Id<'users'>;
		} = {};
		if (args.name !== undefined) patch.name = args.name;
		if (args.civilites !== undefined) patch.civilites = args.civilites;
		if (args.qualif !== undefined) patch.qualif = args.qualif;
		if (args.address !== undefined) patch.address = args.address;
		if (args.addressStreet !== undefined) patch.addressStreet = args.addressStreet;
		if (args.addressPostalCode !== undefined) patch.addressPostalCode = args.addressPostalCode;
		if (args.addressCity !== undefined) patch.addressCity = args.addressCity;
		if (args.latitude !== undefined) patch.latitude = args.latitude;
		if (args.longitude !== undefined) patch.longitude = args.longitude;
		if (args.phone !== undefined) {
			patch.phone = args.phone;
			patch.phoneKey = phoneKeyOf(args.phone);
		}
		if (args.projet !== undefined) patch.projet = args.projet;
		if (args.source !== undefined) patch.source = args.source;
		if (args.note !== undefined) patch.note = args.note;
		if (args.dateContact !== undefined) patch.dateContact = args.dateContact;
		// « Qui a pris le contact » : seulement le directeur de zone ou le
		// directeur d'agence, et uniquement vers une personne de son périmètre.
		if (args.createdBy !== undefined && args.createdBy !== contact.createdBy) {
			if (!canReassignContact(user)) {
				throw new Error(
					'Non autorisé : seuls l’administrateur, le directeur de zone et le directeur d’agence peuvent changer qui a pris le contact.'
				);
			}
			const preneur = await ctx.db.get(args.createdBy);
			if (!preneur) {
				throw new Error('Employé introuvable.');
			}
			if (preneur.statut === 'viré') {
				throw new Error('Cet employé n’est plus actif.');
			}
			if (!(await isUserInScope(ctx, user, args.createdBy))) {
				throw new Error('Non autorisé : cet employé n’est pas dans ton périmètre.');
			}
			patch.createdBy = preneur._id;
		}
		if (args.followUp !== undefined) {
			// La modification ne fournit pas les raisons/date d'annulation : on les
			// conserve depuis le suivi existant (sinon éditer le RDV les effacerait).
			// Un rappel, lui, n'a pas d'issue de RDV : les raisons restent dans
			// l'historique (traceRdvClos) et ne sont pas recopiées sur le rappel,
			// comme lors d'un recontact.
			const followUp = await resolveCommercial(ctx, args.followUp);
			patch.followUp =
				followUp.type === 'rdv'
					? {
							...followUp,
							nonVenteReason: followUp.nonVenteReason ?? contact.followUp?.nonVenteReason,
							nonVenteCode: followUp.nonVenteCode ?? contact.followUp?.nonVenteCode,
							annulationReason: followUp.annulationReason ?? contact.followUp?.annulationReason,
							annulationCode: followUp.annulationCode ?? contact.followUp?.annulationCode,
							annulationDate: followUp.annulationDate ?? contact.followUp?.annulationDate
						}
					: followUp;
		}
		// Historique RDV : un nouveau RDV est compté quand le suivi passe de rappel à RDV,
		// et la raison du passage en rappel est enregistrée sur le dernier RDV sinon.
		// Un simple passage en rappel ne supprime jamais l'historique des RDV.
		if (
			args.followUp?.type === 'rdv' &&
			args.followUp.motif !== 'confortation' &&
			contact.followUp?.type !== 'rdv'
		) {
			patch.rdvHistory = [...(contact.rdvHistory ?? []), { at: Date.now() }];
		} else if (args.followUp?.type === 'rappel' && contact.followUp?.type === 'rdv') {
			const history = contact.rdvHistory ?? [];
			if (history.length > 0) {
				const last = history[history.length - 1];
				const lastAt = typeof last === 'number' ? last : last.at;
				patch.rdvHistory = [
					...history.slice(0, -1),
					{
						at: lastAt,
						reason: args.rdvSwitchReason || undefined,
						...traceRdvClos(contact.followUp)
					}
				];
			}
		}

		await ctx.db.patch(args.contactId, patch);
	}
});

// Migration : complète le lien fiable (`followUp.commercialId`) des contacts
// existants à partir du nom historique (`followUp.commercial`). Sans cette clé,
// le binôme d'une vente dépendait d'une comparaison de noms, fragile en cas de
// renommage. Le nom affiché reste inchangé tant que l'id est valide.
export const migrateCommercialIds = internalMutation({
	args: { dryRun: v.optional(v.boolean()) },
	handler: async (ctx, { dryRun }) => {
		const users = await ctx.db.query('users').collect();
		const byName = new Map<string, Id<'users'>>();
		for (const u of users) {
			byName.set(displayName(u).toLowerCase(), u._id);
			if (u.email) byName.set(u.email.toLowerCase(), u._id);
		}

		const contacts = await ctx.db.query('contacts').collect();
		let updated = 0;
		let sansCorrespondance = 0;
		const details: Array<{
			contactId: Id<'contacts'>;
			commercial: string;
			commercialId: Id<'users'>;
		}> = [];

		for (const contact of contacts) {
			const fu = contact.followUp;
			const nom = fu?.commercial?.trim();
			if (!fu || !nom || fu.commercialId) continue;
			const target = byName.get(nom.toLowerCase());
			if (!target) {
				sansCorrespondance++;
				continue;
			}
			updated++;
			if (details.length < 100) {
				details.push({ contactId: contact._id, commercial: nom, commercialId: target });
			}
			if (!dryRun) {
				await ctx.db.patch(contact._id, { followUp: { ...fu, commercialId: target } });
			}
		}

		return {
			total: contacts.length,
			updated,
			sansCorrespondance,
			dryRun: !!dryRun,
			details
		};
	}
});
