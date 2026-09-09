import { action, internalMutation, internalQuery, mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { createAccount, getAuthUserId, invalidateSessions } from '@convex-dev/auth/server';
import { internal } from './_generated/api';
import {
	canManageAgency,
	canManageEmployes,
	getCurrentUser,
	isAdmin,
	isZoneManager
} from './permissions';
import type { Doc, Id } from './_generated/dataModel';

const ROLES = [
	'administrateur',
	'directeur de zone',
	'animateur de zone',
	"directeur d'agence",
	"animateur d'équipe",
	'commercial'
] as const;

type Role = (typeof ROLES)[number];

export const getUser = internalQuery({
	args: { id: v.id('users') },
	handler: async (ctx, { id }) => {
		return await ctx.db.get(id);
	}
});

export const getByEmail = internalQuery({
	args: { email: v.string() },
	handler: async (ctx, { email }) => {
		return await ctx.db
			.query('users')
			.withIndex('email', (q) => q.eq('email', email))
			.first();
	}
});

export const fireDoc = internalMutation({
	args: { employeId: v.id('users') },
	handler: async (ctx, { employeId }) => {
		await ctx.db.patch(employeId, { statut: 'viré', firedAt: Date.now() });
	}
});

// Migration : renomme le poste « animateur » (ancien libellé) en « animateur de
// zone » dans les comptes déjà créés.
export const migrateAnimateurRole = internalMutation({
	args: {},
	handler: async (ctx) => {
		const users = await ctx.db.query('users').collect();
		let migrated = 0;
		for (const u of users) {
			// Cast : l'ancien libellé « animateur » n'est plus dans le type du schéma.
			if ((u as { role?: unknown }).role === 'animateur') {
				await ctx.db.patch(u._id, { role: 'animateur de zone' });
				migrated++;
			}
		}
		return { migrated };
	}
});

// Liste des employés pour la page Administration (selon les droits).
export const list = query({
	args: {},
	handler: async (ctx) => {
		const user = await getCurrentUser(ctx);
		const agences = await ctx.db.query('agences').collect();
		const users = await ctx.db.query('users').collect();
		const agenceName = (id: Doc<'agences'>['_id'] | undefined) =>
			id ? (agences.find((a) => a._id === id)?.name ?? null) : null;

		const visible = users.filter((u) => {
			// Seuls l'admin et le directeur de zone voient les comptes administrateurs.
			if (u.role === 'administrateur') return isAdmin(user);
			// Tous les managers (dont le directeur d'agence) voient tous les employés,
			// tous postes et toutes agences confondues (y compris soi-même).
			return true;
		});

		return visible.map((u) => ({
			_id: u._id,
			firstName: u.firstName ?? null,
			lastName: u.lastName ?? null,
			email: u.email ?? null,
			role: u.role ?? null,
			agencyId: u.agencyId ?? null,
			agencyName: agenceName(u.agencyId),
			dateEntree: u.dateEntree ?? null,
			birthDate: u.birthDate ?? null,
			photo: u.photo ?? null,
			statut: u.statut ?? 'actif',
			firedAt: u.firedAt ?? null,
			roleHistory: u.roleHistory ?? []
		}));
	}
});

// Création d'un employé par l'admin, le directeur de zone ou le directeur
// d'agence (uniquement pour son agence).
export const create = action({
	args: {
		firstName: v.string(),
		lastName: v.string(),
		email: v.string(),
		birthDate: v.optional(v.string()),
		dateEntree: v.number(),
		role: v.string(),
		agencyId: v.id('agences'),
		password: v.string()
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (userId === null) {
			throw new Error('Non connecté.');
		}
		const user = await ctx.runQuery(internal.employes.getUser, { id: userId });
		if (!user || user.statut === 'viré') {
			throw new Error('Accès bloqué.');
		}
		if (!canManageEmployes(user)) {
			throw new Error('Non autorisé.');
		}
		const agence = await ctx.runQuery(internal.agences.get, { id: args.agencyId });
		if (!agence) {
			throw new Error('Agence introuvable.');
		}
		if (!canManageAgency(user, agence)) {
			throw new Error('Non autorisé pour cette agence.');
		}
		if (!(ROLES as readonly string[]).includes(args.role)) {
			throw new Error('Rôle invalide.');
		}
		const existing = await ctx.runQuery(internal.employes.getByEmail, {
			email: args.email
		});
		if (existing) {
			throw new Error('Un compte existe déjà avec cet e-mail.');
		}

		await createAccount(ctx, {
			provider: 'password',
			account: { id: args.email, secret: args.password },
			profile: {
				email: args.email,
				firstName: args.firstName,
				lastName: args.lastName,
				birthDate: args.birthDate,
				role: args.role as Role,
				agencyId: args.agencyId,
				dateEntree: args.dateEntree,
				statut: 'actif',
				roleHistory: [{ role: args.role, at: Date.now() }]
			}
		});
	}
});

// Changement de poste : le rôle est mis à jour et l'historique est conservé.
export const updateRole = mutation({
	args: {
		employeId: v.id('users'),
		role: v.string()
	},
	handler: async (ctx, { employeId, role }) => {
		const user = await getCurrentUser(ctx);
		if (!canManageEmployes(user)) {
			throw new Error('Non autorisé.');
		}
		if (!(ROLES as readonly string[]).includes(role)) {
			throw new Error('Rôle invalide.');
		}
		const target = await ctx.db.get(employeId);
		if (!target) {
			throw new Error('Employé introuvable.');
		}
		const agence = target.agencyId ? await ctx.db.get(target.agencyId) : null;
		if (!canManageAgency(user, agence)) {
			throw new Error('Non autorisé pour cette agence.');
		}
		await ctx.db.patch(employeId, {
			role: role as Role,
			roleHistory: [...(target.roleHistory ?? []), { role, at: Date.now() }]
		});
	}
});

// Modification du profil d'un employé (nom, prénom, date de naissance,
// date d'entrée, agence, rôle). Le changement de rôle est historisé.
export const update = mutation({
	args: {
		employeId: v.id('users'),
		firstName: v.optional(v.string()),
		lastName: v.optional(v.string()),
		birthDate: v.optional(v.string()),
		dateEntree: v.optional(v.number()),
		agencyId: v.optional(v.id('agences')),
		role: v.optional(v.string())
	},
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		if (!canManageEmployes(user)) {
			throw new Error('Non autorisé.');
		}
		const target = await ctx.db.get(args.employeId);
		if (!target) {
			throw new Error('Employé introuvable.');
		}
		const currentAgency = target.agencyId ? await ctx.db.get(target.agencyId) : null;
		if (!canManageAgency(user, currentAgency)) {
			throw new Error('Non autorisé pour cette agence.');
		}
		if (args.agencyId && args.agencyId !== target.agencyId) {
			const newAgency = await ctx.db.get(args.agencyId);
			if (!canManageAgency(user, newAgency)) {
				throw new Error('Non autorisé pour cette agence.');
			}
		}

		const patch: {
			firstName?: string;
			lastName?: string;
			birthDate?: string;
			dateEntree?: number;
			agencyId?: Doc<'agences'>['_id'];
			role?: Role;
			roleHistory?: { role: string; at: number }[];
		} = {};
		if (args.firstName !== undefined) patch.firstName = args.firstName;
		if (args.lastName !== undefined) patch.lastName = args.lastName;
		if (args.birthDate !== undefined) patch.birthDate = args.birthDate;
		if (args.dateEntree !== undefined) patch.dateEntree = args.dateEntree;
		if (args.agencyId !== undefined) patch.agencyId = args.agencyId;
		if (args.role !== undefined) {
			if (!(ROLES as readonly string[]).includes(args.role)) {
				throw new Error('Rôle invalide.');
			}
			patch.role = args.role as Role;
			patch.roleHistory = [...(target.roleHistory ?? []), { role: args.role, at: Date.now() }];
		}

		await ctx.db.patch(args.employeId, patch);
	}
});

// Licenciement : accès bloqué + sessions révoquées.
// L'employé reste visible dans le tableau jusqu'à la fin du mois en cours.
export const fire = action({
	args: { employeId: v.id('users') },
	handler: async (ctx, { employeId }) => {
		const userId = await getAuthUserId(ctx);
		if (userId === null) {
			throw new Error('Non connecté.');
		}
		const user = await ctx.runQuery(internal.employes.getUser, { id: userId });
		if (!user || user.statut === 'viré') {
			throw new Error('Accès bloqué.');
		}
		if (!canManageEmployes(user)) {
			throw new Error('Non autorisé.');
		}
		const target = await ctx.runQuery(internal.employes.getUser, { id: employeId });
		if (!target) {
			throw new Error('Employé introuvable.');
		}
		const agence = target.agencyId
			? await ctx.runQuery(internal.agences.get, { id: target.agencyId })
			: null;
		if (!canManageAgency(user, agence)) {
			throw new Error('Non autorisé pour cette agence.');
		}
		await ctx.runMutation(internal.employes.fireDoc, { employeId });
		await invalidateSessions(ctx, { userId: employeId });
	}
});

// Commerciaux disponibles pour rattacher un RDV : même périmètre que le connecté,
// actifs, hors administrateurs et hors l'utilisateur lui-même.
export const listRdvCommerciaux = query({
	args: {},
	handler: async (ctx) => {
		const user = await getCurrentUser(ctx);
		const users = await ctx.db.query('users').collect();
		const scopeAll = user.role === 'administrateur' || user.role === 'directeur de zone';
		return users
			.filter((u) => {
				if (u._id === user._id) return false;
				if (u.statut === 'viré') return false;
				if (u.role === 'administrateur') return false;
				if (!scopeAll && u.agencyId !== user.agencyId) return false;
				return true;
			})
			.map((u) => ({
				_id: u._id,
				firstName: u.firstName ?? '',
				lastName: u.lastName ?? '',
				role: u.role ?? null,
				photo: u.photo ?? null
			}));
	}
});

// Commerciaux pouvant être vendeur d'une vente : même périmètre que le connecté,
// actifs, hors administrateurs (sauf soi-même). L'utilisateur connecté est en premier.
export const listVendeurs = query({
	args: {},
	handler: async (ctx) => {
		const user = await getCurrentUser(ctx);
		const users = await ctx.db.query('users').collect();
		const scopeAll = user.role === 'administrateur' || user.role === 'directeur de zone';
		return users
			.filter((u) => {
				if (u._id === user._id) return true;
				if (u.statut === 'viré') return false;
				if (u.role === 'administrateur') return false;
				if (!scopeAll && u.agencyId !== user.agencyId) return false;
				return true;
			})
			.map((u) => ({
				_id: u._id,
				firstName: u.firstName ?? '',
				lastName: u.lastName ?? '',
				name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email || 'Commercial',
				isMe: u._id === user._id
			}))
			.sort((a, b) => (a.isMe ? -1 : b.isMe ? 1 : 0));
	}
});

// Membres visibles dans le tableau : actifs + virés pendant la période choisie.
// Statistiques réelles : objectifs fixes (CA 30 000 €, 40 RDV), RDV par source,
// RDV traités (vendu + déballé), ventes et CA (HT) de la période sélectionnée
// (jour / semaine / mois autour de la date), plus le CA total de la période.
// Quand 2 commerciaux sont liés à un RDV / une vente (créateur + commercial
// rattaché), chacun compte 0,5 et le montant HT est divisé par 2.
export const listTeamMembers = query({
	args: {
		period: v.union(v.literal('mois'), v.literal('semaine'), v.literal('jour')),
		date: v.string()
	},
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);

		// Bornes de la période : [startISO, endISO[ pour les RDV (date string),
		// [startTs, endTs[ pour les ventes (timestamp).
		let [y, m, d] = args.date.split('-').map(Number);
		if (!y || !m || !d) {
			const now = new Date();
			y = now.getFullYear();
			m = now.getMonth() + 1;
			d = now.getDate();
		}
		const iso = (dt: Date) =>
			`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
				dt.getDate()
			).padStart(2, '0')}`;
		const ts = (s: string) => {
			const [yy, mm, dd] = s.split('-').map(Number);
			return new Date(yy, mm - 1, dd).getTime();
		};
		let startISO: string;
		let endISO: string;
		if (args.period === 'jour') {
			startISO = iso(new Date(y, m - 1, d));
			endISO = iso(new Date(y, m - 1, d + 1));
		} else if (args.period === 'semaine') {
			// Semaine du lundi au dimanche contenant la date.
			const dow = (new Date(y, m - 1, d).getDay() + 6) % 7;
			startISO = iso(new Date(y, m - 1, d - dow));
			endISO = iso(new Date(y, m - 1, d - dow + 7));
		} else {
			startISO = `${y}-${String(m).padStart(2, '0')}-01`;
			endISO = iso(new Date(y, m, 1));
		}
		const startTs = ts(startISO);
		const endTs = ts(endISO);

		const users = await ctx.db.query('users').collect();

		// Toutes les personnes liées à une agence apparaissent dans le tableau,
		// quelle que soit l'agence du connecté (y compris les administrateurs
		// rattachés à une agence, comme Pierre).
		const visible = users.filter((u) => {
			if (!u.agencyId) return false;
			if (u.statut === 'viré') {
				return (u.firedAt ?? 0) >= startTs;
			}
			return true;
		});
		const visibleIds = new Set(visible.map((u) => u._id));

		// Nom complet -> id utilisateur (followUp.commercial stocke le nom affiché).
		const byName = new Map<string, Id<'users'>>();
		for (const u of users) {
			const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
			if (name) byName.set(name, u._id);
		}

		const contacts = await ctx.db.query('contacts').collect();
		const ventes = await ctx.db.query('ventes').collect();

		type Stats = {
			rdvTap: number;
			rdvGms: number;
			total: number;
			rdvTraites: number;
			ventes: number;
			caPeriode: number;
			caAttente: number;
			caErreur: number;
			caAnnulations: number;
			caTotal: number;
		};
		const empty = (): Stats => ({
			rdvTap: 0,
			rdvGms: 0,
			total: 0,
			rdvTraites: 0,
			ventes: 0,
			caPeriode: 0,
			caAttente: 0,
			caErreur: 0,
			caAnnulations: 0,
			caTotal: 0
		});
		const stats = new Map<string, Stats>();
		const get = (id: string): Stats => {
			let s = stats.get(id);
			if (!s) {
				s = empty();
				stats.set(id, s);
			}
			return s;
		};

		// Les 2 personnes liées à un élément, parmi les membres visibles.
		// S'il y en a 2, chacun compte pour 0,5 ; sinon 1 pour le seul visible.
		const partners = (...ids: Array<Id<'users'> | undefined>) => {
			const uniq = [...new Set(ids.filter((id): id is Id<'users'> => id !== undefined))];
			const visiblePartners = uniq.filter((id) => visibleIds.has(id));
			return { ids: visiblePartners, share: visiblePartners.length >= 2 ? 0.5 : 1 };
		};

		// RDV : suivi courant de type RDV, contacts non traités. Les compteurs
		// RDV TAP / GMS / total sont rattachés à la DATE DE PLANIFICATION du RDV
		// (fu.date). Le RDV compte 1 pour le créateur du contact uniquement (son
		// pipeline). Le RDV traité (déballé / vendu) est partagé : 0,5 pour le
		// créateur et 0,5 pour le commercial du RDV / vendeur de la vente
		// (binôme). Les ventes et le CA sont partagés dans la boucle ventes
		// ci-dessous.
		for (const c of contacts) {
			const fu = c.followUp;
			if (!fu || fu.type !== 'rdv' || c.statut === 'traité') continue;
			const treated = fu.status === 'vendu' || fu.status === 'déballé';
			const plannedInPeriod = fu.date >= startISO && fu.date < endISO;

			// RDV complet : 1 pour le créateur du contact, à la date de planification.
			if (plannedInPeriod && c.createdBy && visibleIds.has(c.createdBy)) {
				const s = get(c.createdBy);
				if (c.source === 'TAP') s.rdvTap += 1;
				else if (c.source === 'GMS') s.rdvGms += 1;
				s.total += 1;
			}

			// RDV traité : partagé 0,5 / 0,5 avec le commercial du RDV ou le
			// vendeur de la vente (un RDV « vendu » peut n'avoir aucun commercial
			// renseigné, le binôme se voit alors via la vente).
			if (treated && plannedInPeriod) {
				// Le vendeur de la vente sert de binôme ; on préfère une vente valide,
				// mais une vente annulée compte quand même (elle a été conclue).
				const saleVendeur = (
					ventes.find((v) => v.contactId === c._id && v.statut !== 'annulée') ??
					ventes.find((v) => v.contactId === c._id)
				)?.vendeurId;
				const { ids, share } = partners(c.createdBy, byName.get(fu.commercial ?? ''), saleVendeur);
				for (const id of ids) {
					get(id).rdvTraites += share;
				}
			}
		}

		// Le CA est basé sur le HT. Quand un commercial accompagnateur est ajouté à la vente,
		// ça crée un binôme : la vente est divisée par 2 entre le vendeur et la personne
		// qui a pris le contact (createdBy). Sans accompagnateur, le vendeur compte pour 1.
		const contactById = new Map(contacts.map((c) => [c._id, c]));

		// CA total de la période sélectionnée (colonne TOTAL HT) : seules les ventes
		// VALIDÉES comptent. Les ventes « en attente » (pas encore validées), « erreur »
		// et « annulée » sont exclues et suivies à part (caAttente / caErreur /
		// caAnnulations). Suit le jour / semaine / mois.
		for (const v of ventes) {
			if (v.statut !== 'valide') continue;
			if (v.date < startTs || v.date >= endTs) continue;
			const { ids, share } = partners(v.vendeurId, contactById.get(v.contactId)?.createdBy);
			for (const id of ids) get(id).caTotal += v.totalHT * share;
		}

		// Période : ventes et CA de la période sélectionnée. Les ventes annulées
		// comptent toujours (le CA mois ne retombe pas à 0) ; les ventes en erreur
		// sont déduites du CA mois et suivies à part dans caErreur ; les ventes en
		// attente (non validées) sont suivies à part dans caAttente.
		for (const v of ventes) {
			if (v.date < startTs || v.date >= endTs) continue;
			const { ids, share } = partners(v.vendeurId, contactById.get(v.contactId)?.createdBy);
			for (const id of ids) {
				const s = get(id);
				s.ventes += share;
				if (v.statut === 'erreur') s.caErreur += v.totalHT * share;
				else if (v.statut === 'en attente') s.caAttente += v.totalHT * share;
				else s.caPeriode += v.totalHT * share;
			}
		}

		// Annulations de la période : CA (HT) des ventes annulées, partagé comme le CA.
		for (const v of ventes) {
			if (v.statut !== 'annulée' || v.date < startTs || v.date >= endTs) continue;
			const { ids, share } = partners(v.vendeurId, contactById.get(v.contactId)?.createdBy);
			for (const id of ids) get(id).caAnnulations += v.totalHT * share;
		}

		// Objectifs mensuels de la période sélectionnée (toujours le mois, même en
		// vue semaine / jour). Valeurs par défaut si non renseignés.
		const objectifMois = `${y}-${String(m).padStart(2, '0')}`;
		const objectifs = await ctx.db
			.query('objectifs')
			.withIndex('by_mois', (q) => q.eq('mois', objectifMois))
			.collect();
		const objectifByUser = new Map<string, { ca: number; rdv: number }>();
		for (const o of objectifs) objectifByUser.set(o.userId, { ca: o.ca, rdv: o.rdv });

		// Superviseurs de zone (animateur de zone, directeur de zone) : absents du
		// tableau par défaut — ils n'apparaissent que s'ils ont du CA sur la
		// période (même rattachés à un RDV).
		const hasCa = (s: Stats) => s.caTotal > 0;

		return visible
			.filter((u) => !isZoneManager(u) || hasCa(stats.get(u._id) ?? empty()))
			.map((u) => {
				const s = stats.get(u._id) ?? empty();
				const obj = objectifByUser.get(u._id);
				return {
					_id: u._id,
					firstName: u.firstName ?? '',
					lastName: u.lastName ?? '',
					email: u.email ?? '',
					role: u.role ?? null,
					statut: u.statut ?? 'actif',
					objectiveCa: obj?.ca ?? 30000,
					objectiveRdv: obj?.rdv ?? 40,
					rdvTap: s.rdvTap,
					rdvGms: s.rdvGms,
					total: s.total,
					rdvTraites: s.rdvTraites,
					ventes: s.ventes,
					caPeriode: s.caPeriode,
					caAttente: s.caAttente,
					caErreur: s.caErreur,
					caAnnulations: s.caAnnulations,
					caTotal: s.caTotal
				};
			});
	}
});
