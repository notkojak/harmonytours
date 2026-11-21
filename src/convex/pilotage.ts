import { query } from './_generated/server';
import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { getCurrentUser, isZoneManager } from './permissions';
import { canViewAllCrm, visibleAgencyIds } from './access';

// Pilotage de l'agence : une vue consolidée par agence, un entonnoir de
// conversion et les alertes du jour. Les calculs restent volontairement
// lisibles : CA au vendeur, RDV au preneur de contact (pas de partage 0,5 ici),
// pour que la somme d'une agence soit exactement la somme de ses commerciaux.

function localMonthBounds(mois: string): { start: number; end: number; days: number } {
	const [y, m] = mois.split('-').map(Number);
	const start = new Date(y, m - 1, 1).getTime();
	const end = new Date(y, m, 1).getTime();
	const days = new Date(y, m, 0).getDate();
	return { start, end, days };
}

function shiftMonth(mois: string, delta: number): string {
	const [y, m] = mois.split('-').map(Number);
	const d = new Date(y, m - 1 + delta, 1);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function isoDay(ts: number): string {
	const d = new Date(ts);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
		d.getDate()
	).padStart(2, '0')}`;
}

function currentMonth(): string {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function displayName(u: { firstName?: string; lastName?: string; email?: string }): string {
	return `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email || 'Commercial';
}

// Date du jour en France : les dates du dossier sont des dates civiles.
function jourParis(): string {
	return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
}

function joursDepuisIso(iso: string | null | undefined, aujourdHui: string): number | null {
	if (!iso) return null;
	const jours = Math.round((Date.parse(aujourdHui) - Date.parse(iso)) / 86_400_000);
	return Number.isFinite(jours) ? Math.max(0, jours) : null;
}

function ageJours(ms: number): number {
	return Math.max(0, Math.floor((Date.now() - ms) / 86_400_000));
}

function fiStatutDe(v: Doc<'ventes'>): 'en attente' | 'accepté' | 'refusé' {
	if (v.fiStatut === 'accepté' || v.fiStatut === 'refusé' || v.fiStatut === 'en attente') {
		return v.fiStatut;
	}
	return v.fiAccepte ? 'accepté' : 'en attente';
}

// Centre d'actions : une seule liste triée par urgence, plutôt qu'une alerte par
// sujet. Chaque entrée porte de quoi ouvrir la fiche et, pour les étapes
// techniques, confirmer directement.
type ActionKind =
	| 'pose'
	| 'metrage'
	| 'fiRefuse'
	| 'rdvAReprogrammer'
	| 'nonConfortee'
	| 'fiEnAttente'
	| 'sansAction'
	| 'clientSansSuite';

type ActionItem = {
	key: string;
	kind: ActionKind;
	titre: string;
	date: string | null;
	jours: number | null;
	montantHT: number | null;
	contactId: Id<'contacts'>;
	venteId: Id<'ventes'> | null;
	commercial: string | null;
};

const ACTIONS_PAR_CATEGORIE = 8;
const ACTIONS_MAX = 40;
const NON_CONFORTEE_MIN_JOURS = 7;
const NON_CONFORTEE_MAX_JOURS = 120;
const CLIENT_SANS_SUITE_JOURS = 21;

export const direction = query({
	args: { mois: v.optional(v.string()) },
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		if (!canViewAllCrm(user)) {
			throw new Error('Non autorisé : vue réservée aux managers.');
		}
		const mois = /^\d{4}-\d{2}$/.test(args.mois ?? '') ? (args.mois as string) : currentMonth();
		const scopeIds = await visibleAgencyIds(ctx, user);

		const agences = (await ctx.db.query('agences').collect())
			.filter((a) => scopeIds === null || scopeIds.has(a._id))
			.sort((a, b) => a.name.localeCompare(b.name));
		const users = (await ctx.db.query('users').collect()).filter(
			(u) => u.statut !== 'viré' && !!u.agencyId
		);
		const allContacts = await ctx.db.query('contacts').collect();
		const contacts = allContacts.filter(
			(c) => !c.deletedAt && (scopeIds === null || (!!c.agencyId && scopeIds.has(c.agencyId)))
		);
		const archivedContactIds = new Set(
			allContacts.filter((c) => c.deletedAt).map((c) => c._id as string)
		);
		const ventes = (await ctx.db.query('ventes').collect()).filter(
			(v) => !v.deletedAt && !archivedContactIds.has(v.contactId)
		);
		const objectifs = (await ctx.db.query('objectifs').collect()).filter(
			(o) => o.mois === mois || o.mois === shiftMonth(mois, -1)
		);

		const { start, end, days } = localMonthBounds(mois);
		const prev = localMonthBounds(shiftMonth(mois, -1));
		const now = Date.now();
		const isCurrent = mois === currentMonth();
		const elapsedDays = isCurrent ? Math.min(days, Math.max(1, new Date().getDate())) : days;

		const usersByAgency = new Map<string, Doc<'users'>[]>();
		for (const u of users) {
			if (!u.agencyId) continue;
			const list = usersByAgency.get(u.agencyId) ?? [];
			list.push(u);
			usersByAgency.set(u.agencyId, list);
		}

		const rdvPrisAt = (c: Doc<'contacts'>): number => {
			const last = c.rdvHistory?.[c.rdvHistory.length - 1];
			return last?.at ?? c.dateContact ?? c._creationTime;
		};

		const contactIdsOfAgency = new Map<string, Set<string>>();
		for (const c of contacts) {
			if (!c.agencyId) continue;
			const set = contactIdsOfAgency.get(c.agencyId) ?? new Set<string>();
			set.add(c._id);
			contactIdsOfAgency.set(c.agencyId, set);
		}

		const statsFor = (agencyId: Id<'agences'> | null) => {
			const agencyContacts = agencyId ? contacts.filter((c) => c.agencyId === agencyId) : contacts;
			const agencyVentes = agencyId
				? ventes.filter(
						(v) =>
							v.agencyId === agencyId ||
							(contactIdsOfAgency.get(agencyId)?.has(v.contactId) ?? false)
					)
				: ventes;
			const agencyUsers = agencyId ? (usersByAgency.get(agencyId) ?? []) : users;

			const ca = { valide: 0, attente: 0, erreur: 0, annulee: 0, ventes: 0 };
			for (const v of agencyVentes) {
				if (v.date < start || v.date >= end) continue;
				if (v.statut === 'valide') {
					ca.valide += v.totalHT;
					ca.ventes += 1;
				} else if (v.statut === 'en attente' || v.statut === undefined) {
					ca.attente += v.totalHT;
				} else if (v.statut === 'erreur') {
					ca.erreur += v.totalHT;
				} else if (v.statut === 'annulée') {
					ca.annulee += v.totalHT;
				}
			}
			let caPrev = 0;
			for (const v of agencyVentes) {
				if (v.statut !== 'valide') continue;
				if (v.date >= prev.start && v.date < prev.end) caPrev += v.totalHT;
			}

			let contactsCrees = 0;
			let rdvPris = 0;
			let rdvTraites = 0;
			for (const c of agencyContacts) {
				const d = c.dateContact ?? c._creationTime;
				if (d >= start && d < end) contactsCrees++;
				const taken = rdvPrisAt(c);
				if (taken >= start && taken < end) rdvPris++;
				const fu = c.followUp;
				if (
					fu?.type === 'rdv' &&
					fu.motif !== 'confortation' &&
					(fu.status === 'vendu' || fu.status === 'déballé') &&
					fu.date >= isoDay(start) &&
					fu.date < isoDay(end)
				) {
					rdvTraites++;
				}
			}

			const objectifCa = objectifs
				.filter((o) => o.mois === mois && agencyUsers.some((u) => u._id === o.userId))
				.reduce((s, o) => s + o.ca, 0);
			const objectifRdv = objectifs
				.filter((o) => o.mois === mois && agencyUsers.some((u) => u._id === o.userId))
				.reduce((s, o) => s + o.rdv, 0);

			const enAttente = agencyVentes.filter(
				(v) =>
					v.date >= start && v.date < end && (v.statut === 'en attente' || v.statut === undefined)
			);
			const attenteAge = enAttente.length
				? Math.max(
						...enAttente.map((v) => Math.floor((now - (v.statutChangedAt ?? v.date)) / 86_400_000))
					)
				: 0;

			return {
				caValide: Math.round(ca.valide * 100) / 100,
				caAttente: Math.round(ca.attente * 100) / 100,
				caErreur: Math.round(ca.erreur * 100) / 100,
				caAnnulee: Math.round(ca.annulee * 100) / 100,
				caPrecedent: Math.round(caPrev * 100) / 100,
				ventes: ca.ventes,
				panierMoyen: ca.ventes ? Math.round((ca.valide / ca.ventes) * 100) / 100 : 0,
				contactsCrees,
				rdvPris,
				rdvTraites,
				objectifCa,
				objectifRdv,
				tauxObjectif: objectifCa > 0 ? Math.round((ca.valide / objectifCa) * 100) : null,
				tauxContactRdv: contactsCrees ? Math.round((rdvPris / contactsCrees) * 100) : null,
				tauxRdvTraite: rdvPris ? Math.round((rdvTraites / rdvPris) * 100) : null,
				ventesEnAttente: enAttente.length,
				attenteAge,
				projection:
					isCurrent && elapsedDays > 0
						? Math.round((ca.valide / elapsedDays) * days * 100) / 100
						: null
			};
		};

		const parAgence = agences.map((a) => ({
			_id: a._id,
			name: a.name,
			zone: a.zone ?? null,
			effectif: (usersByAgency.get(a._id) ?? []).filter((u) => !isZoneManager(u)).length,
			...statsFor(a._id)
		}));

		// Par commercial (CA et ventes partagés entre le binôme de la vente, RDV au
		// preneur de contact).
		const parPersonne = users
			.filter((u) => (scopeIds === null ? true : !!u.agencyId && scopeIds.has(u.agencyId)))
			.map((u) => {
				const mine = contacts.filter((c) => c.createdBy === u._id);
				let contactsCrees = 0;
				let rdvPris = 0;
				for (const c of mine) {
					const d = c.dateContact ?? c._creationTime;
					if (d >= start && d < end) contactsCrees++;
					const taken = rdvPrisAt(c);
					if (taken >= start && taken < end) rdvPris++;
				}
				let ca = 0;
				let nbVentes = 0;
				for (const v of ventes) {
					const binome = v.binomeIds && v.binomeIds.length > 0 ? v.binomeIds : [v.vendeurId];
					if (!binome.includes(u._id) || v.statut !== 'valide') continue;
					if (v.date < start || v.date >= end) continue;
					const part = 1 / binome.length;
					ca += v.totalHT * part;
					nbVentes += part;
				}
				const obj = objectifs.find((o) => o.userId === u._id && o.mois === mois);
				return {
					_id: u._id,
					name: displayName(u),
					role: u.role ?? null,
					agencyId: u.agencyId ?? null,
					caValide: Math.round(ca * 100) / 100,
					ventes: Math.round(nbVentes * 100) / 100,
					contactsCrees,
					rdvPris,
					objectifCa: obj?.ca ?? 0,
					tauxObjectif: obj?.ca ? Math.round((ca / obj.ca) * 100) : null
				};
			})
			.sort((a, b) => b.caValide - a.caValide);

		// Raisons de non-vente les plus fréquentes du mois (codes normalisés).
		const raisons = new Map<string, number>();
		for (const c of contacts) {
			const fu = c.followUp;
			if (!fu) continue;
			if (fu.date < isoDay(start) || fu.date >= isoDay(end)) continue;
			const code = fu.status === 'annulé' ? fu.annulationCode : fu.nonVenteCode;
			if (!code) continue;
			raisons.set(code, (raisons.get(code) ?? 0) + 1);
		}
		const topRaisons = [...raisons.entries()]
			.map(([code, count]) => ({ code, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 6);

		return {
			mois,
			moisPrecedent: shiftMonth(mois, -1),
			isCurrent,
			joursDuMois: days,
			joursEcoules: elapsedDays,
			parAgence,
			parPersonne,
			total: statsFor(null),
			topRaisons
		};
	}
});

// Alertes du jour : ce qui demande une action maintenant. Aucun cron n'est
// nécessaire, la requête est recalculée à chaque écriture et à l'ouverture.
export const alertes = query({
	args: {},
	handler: async (ctx) => {
		const user = await getCurrentUser(ctx);
		const agencyIds = await visibleAgencyIds(ctx, user);
		const manager = canViewAllCrm(user);

		const allContacts = await ctx.db.query('contacts').collect();
		const contacts = allContacts.filter(
			(c) => !c.deletedAt && (agencyIds === null || (!!c.agencyId && agencyIds.has(c.agencyId)))
		);
		const mine = (c: Doc<'contacts'>) =>
			manager ||
			c.createdBy === user._id ||
			(!!c.followUp?.commercialId && c.followUp.commercialId === user._id);

		const today = jourParis();
		const myName = displayName(user).trim().toLowerCase();

		const rappels = contacts
			.filter(
				(c) =>
					mine(c) &&
					c.statut !== 'traité' &&
					c.followUp?.type === 'rappel' &&
					!c.followUp.status &&
					(c.followUp.date ?? '') < today
			)
			.sort((a, b) => (a.followUp?.date ?? '').localeCompare(b.followUp?.date ?? ''))
			.slice(0, 8)
			.map((c) => ({
				_id: c._id,
				name: c.name,
				phone: c.phone ?? null,
				date: c.followUp?.date ?? null,
				joursDeRetard: Math.max(
					0,
					Math.round((Date.parse(today) - Date.parse(c.followUp?.date ?? today)) / 86_400_000)
				)
			}));

		const rdvDuJour = contacts
			.filter(
				(c) =>
					mine(c) &&
					c.followUp?.type === 'rdv' &&
					c.followUp.date === today &&
					c.followUp.status !== 'annulé'
			)
			.sort((a, b) => (a.followUp?.time ?? '').localeCompare(b.followUp?.time ?? ''))
			.slice(0, 8)
			.map((c) => ({
				_id: c._id,
				name: c.name,
				time: c.followUp?.time ?? null,
				commercial: c.followUp?.commercial ?? null,
				statut: c.followUp?.status ?? null
			}));

		const ventes = (await ctx.db.query('ventes').collect()).filter((v) => !v.deletedAt);
		const contactById = new Map(allContacts.map((c) => [c._id, c]));

		// Ventes réellement visibles : un commercial ne voit que les siennes, un
		// manager celles de son périmètre (l'agence du contact prime sur celle de la
		// vente, qui peut manquer sur les anciens dossiers).
		const visibleVentes = ventes.filter((v) => {
			const contact = contactById.get(v.contactId);
			if (!contact || contact.deletedAt) return false;
			if (manager) {
				const agencyId = contact.agencyId ?? v.agencyId;
				return !!agencyId && (agencyIds === null || agencyIds.has(agencyId));
			}
			return (
				v.vendeurId === user._id ||
				(v.binomeIds ?? []).includes(user._id) ||
				contact.createdBy === user._id ||
				(!!myName &&
					!!contact.followUp?.commercial &&
					contact.followUp.commercial.trim().toLowerCase() === myName)
			);
		});
		const ventesByContact = new Map<string, Doc<'ventes'>[]>();
		for (const v of visibleVentes) {
			const list = ventesByContact.get(v.contactId) ?? [];
			list.push(v);
			ventesByContact.set(v.contactId, list);
		}
		const contactName = (v: Doc<'ventes'>) => contactById.get(v.contactId)?.name ?? '—';

		// 1) Poses et métrages dont la date est passée sans confirmation.
		const toutesPoses = visibleVentes.filter(
			(v) => v.statut === 'valide' && !!v.datePose && v.datePose <= today && !v.poseConfirmeAt
		);
		const tousMetrages = visibleVentes.filter(
			(v) =>
				v.statut === 'valide' &&
				!v.datePose &&
				!!v.dateMetrage &&
				v.dateMetrage <= today &&
				!v.metrageConfirmeAt
		);
		const poses = toutesPoses
			.sort((a, b) => (a.datePose ?? '').localeCompare(b.datePose ?? ''))
			.slice(0, ACTIONS_PAR_CATEGORIE)
			.map<ActionItem>((v) => ({
				key: `pose:${v._id}`,
				kind: 'pose',
				titre: contactName(v),
				date: v.datePose ?? null,
				jours: joursDepuisIso(v.datePose, today),
				montantHT: Math.round(v.totalHT * 100) / 100,
				contactId: v.contactId,
				venteId: v._id,
				commercial: v.vendeurName
			}));
		const metrages = tousMetrages
			.sort((a, b) => (a.dateMetrage ?? '').localeCompare(b.dateMetrage ?? ''))
			.slice(0, ACTIONS_PAR_CATEGORIE)
			.map<ActionItem>((v) => ({
				key: `metrage:${v._id}`,
				kind: 'metrage',
				titre: contactName(v),
				date: v.dateMetrage ?? null,
				jours: joursDepuisIso(v.dateMetrage, today),
				montantHT: Math.round(v.totalHT * 100) / 100,
				contactId: v.contactId,
				venteId: v._id,
				commercial: v.vendeurName
			}));

		// 2) Financements en attente ou refusés.
		const tousFiAttente = visibleVentes.filter(
			(v) => v.statut === 'valide' && v.paiement === 'financement' && fiStatutDe(v) === 'en attente'
		);
		const tousFiRefuses = visibleVentes.filter(
			(v) => v.statut !== 'annulée' && v.paiement === 'financement' && fiStatutDe(v) === 'refusé'
		);
		const fiAttente = tousFiAttente
			.sort((a, b) => a.date - b.date)
			.slice(0, ACTIONS_PAR_CATEGORIE)
			.map<ActionItem>((v) => ({
				key: `fiAttente:${v._id}`,
				kind: 'fiEnAttente',
				titre: contactName(v),
				date: isoDay(v.date),
				jours: ageJours(v.date),
				montantHT: Math.round(v.totalHT * 100) / 100,
				contactId: v.contactId,
				venteId: v._id,
				commercial: v.vendeurName
			}));
		const fiRefuses = tousFiRefuses
			.sort((a, b) => a.date - b.date)
			.slice(0, ACTIONS_PAR_CATEGORIE)
			.map<ActionItem>((v) => ({
				key: `fiRefuse:${v._id}`,
				kind: 'fiRefuse',
				titre: contactName(v),
				date: isoDay(v.date),
				jours: ageJours(v.date),
				montantHT: Math.round(v.totalHT * 100) / 100,
				contactId: v.contactId,
				venteId: v._id,
				commercial: v.vendeurName
			}));

		// 3) Ventes validées non confortées depuis plus d'une semaine.
		const toutesNonConfortees = visibleVentes.filter((v) => {
			if (v.statut !== 'valide' || v.confortee === true) return false;
			const age = ageJours(v.date);
			return age >= NON_CONFORTEE_MIN_JOURS && age <= NON_CONFORTEE_MAX_JOURS;
		});
		const nonConfortees = toutesNonConfortees
			.sort((a, b) => a.date - b.date)
			.slice(0, ACTIONS_PAR_CATEGORIE)
			.map<ActionItem>((v) => ({
				key: `nonConfortee:${v._id}`,
				kind: 'nonConfortee',
				titre: contactName(v),
				date: isoDay(v.date),
				jours: ageJours(v.date),
				montantHT: Math.round(v.totalHT * 100) / 100,
				contactId: v.contactId,
				venteId: v._id,
				commercial: v.vendeurName
			}));

		// 4) RDV « à reprogrammer » sans nouvelle date.
		const tousRdvAReprogrammer = contacts.filter(
			(c) => mine(c) && c.followUp?.type === 'rdv' && c.followUp.status === 'à reprogrammer'
		);
		const rdvAReprogrammer = tousRdvAReprogrammer
			.sort((a, b) => (a.followUp?.date ?? '').localeCompare(b.followUp?.date ?? ''))
			.slice(0, ACTIONS_PAR_CATEGORIE)
			.map<ActionItem>((c) => ({
				key: `rdv:${c._id}`,
				kind: 'rdvAReprogrammer',
				titre: c.name,
				date: c.followUp?.date ?? null,
				jours: joursDepuisIso(c.followUp?.date, today),
				montantHT: null,
				contactId: c._id,
				venteId: null,
				commercial: c.followUp?.commercial ?? null
			}));

		// 5) Contacts sans prochaine action planifiée (hors clients et dossiers clos).
		const sansActionContacts = contacts.filter((c) => {
			if (!mine(c) || c.isClient || c.statut === 'traité') return false;
			const fu = c.followUp;
			if (fu?.status === 'à reprogrammer') return false; // déjà dans sa catégorie
			const aUneEcheance = !!fu && !fu.status && !!fu.date;
			return !aUneEcheance;
		});
		const sansAction = sansActionContacts
			.sort((a, b) => {
				const da = a.followUp?.date ?? '';
				const db = b.followUp?.date ?? '';
				return da.localeCompare(db);
			})
			.slice(0, ACTIONS_PAR_CATEGORIE)
			.map<ActionItem>((c) => ({
				key: `sansAction:${c._id}`,
				kind: 'sansAction',
				titre: c.name,
				date: c.followUp?.date ?? null,
				jours: joursDepuisIso(c.followUp?.date, today),
				montantHT: null,
				contactId: c._id,
				venteId: null,
				commercial: c.followUp?.commercial ?? null
			}));

		// 6) Clients dont la vente validée n'a ni pose ni métrage planifiés.
		const clientsSansSuite: Array<{ contact: Doc<'contacts'>; vente: Doc<'ventes'> }> = [];
		for (const contact of contacts) {
			if (!mine(contact) || !contact.isClient) continue;
			const fu = contact.followUp;
			if (fu && !fu.status && fu.date >= today) continue; // un suivi est déjà prévu
			const vente = (ventesByContact.get(contact._id) ?? [])
				.filter((v) => v.statut === 'valide')
				.sort((a, b) => b.date - a.date)[0];
			if (!vente) continue;
			if (vente.datePose || vente.dateMetrage) continue;
			if (ageJours(vente.date) < CLIENT_SANS_SUITE_JOURS) continue;
			clientsSansSuite.push({ contact, vente });
		}
		clientsSansSuite.sort((a, b) => a.vente.date - b.vente.date);
		const clientsSansSuiteItems = clientsSansSuite
			.slice(0, ACTIONS_PAR_CATEGORIE)
			.map<ActionItem>(({ contact, vente }) => ({
				key: `clientSansSuite:${contact._id}`,
				kind: 'clientSansSuite',
				titre: contact.name,
				date: isoDay(vente.date),
				jours: ageJours(vente.date),
				montantHT: Math.round(vente.totalHT * 100) / 100,
				contactId: contact._id,
				venteId: vente._id,
				commercial: vente.vendeurName
			}));

		// Ordre de la liste : ce qui bloque un chantier ou un encaissement d'abord.
		const items: ActionItem[] = [
			...poses,
			...metrages,
			...fiRefuses,
			...rdvAReprogrammer,
			...nonConfortees,
			...fiAttente,
			...sansAction,
			...clientsSansSuiteItems
		].slice(0, ACTIONS_MAX);

		const counts = {
			pose: toutesPoses.length,
			metrage: tousMetrages.length,
			fiEnAttente: tousFiAttente.length,
			fiRefuse: tousFiRefuses.length,
			nonConfortee: toutesNonConfortees.length,
			rdvAReprogrammer: tousRdvAReprogrammer.length,
			sansAction: sansActionContacts.length,
			clientSansSuite: clientsSansSuite.length
		};
		const actionsTotal = Object.values(counts).reduce((sum, n) => sum + n, 0);

		const enAttente = manager
			? visibleVentes
					.filter(
						(v) =>
							(v.statut === 'en attente' || v.statut === undefined) &&
							Date.now() - (v.statutChangedAt ?? v.date) > 3 * 86_400_000
					)
					.sort((a, b) => a.date - b.date)
					.slice(0, 8)
					.map((v) => ({
						_id: v._id,
						contactId: v.contactId,
						contactName: contactById.get(v.contactId)?.name ?? '—',
						totalHT: v.totalHT,
						jours: Math.floor((Date.now() - (v.statutChangedAt ?? v.date)) / 86_400_000)
					}))
			: [];
		const enErreur = visibleVentes.filter((v) => v.statut === 'erreur').length;

		return {
			rappels,
			rdvDuJour,
			enAttente,
			enErreur,
			actions: {
				items,
				counts,
				total: actionsTotal
			},
			// Un chiffre unique pour la pastille de la cloche.
			total: rappels.length + rdvDuJour.length + enAttente.length + enErreur + actionsTotal
		};
	}
});
