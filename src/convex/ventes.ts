import {
	internalMutation,
	mutation,
	query,
	type MutationCtx,
	type QueryCtx
} from './_generated/server';
import { v } from 'convex/values';
import { assertCanWriteCrm, canManageEmployes, getCurrentUser } from './permissions';
import { canViewAllCrm, isUserInScope, visibleAgencyIds } from './access';
import type { Doc, Id } from './_generated/dataModel';

const produitValidator = v.object({
	produit: v.string(),
	// Taux effectif de la ligne (5,5 / 10 / 20, ou taux moyen pour une vente
	// saisie en montants de TVA).
	tva: v.number(),
	montantHT: v.number()
});

// Répartition de la TVA saisie, un montant par taux : conservée pour l'affichage
// et la modification, les totaux restant calculés depuis `produits`.
const tvaDetailValidator = v.optional(
	v.array(
		v.object({
			taux: v.number(),
			montant: v.number()
		})
	)
);

// Mode de paiement d'une vente : comptant, ou financement (dossier FI).
const paiementValidator = v.optional(v.union(v.literal('comptant'), v.literal('financement')));

// Avancement du dossier après la vente (case « Suivi » du tableau).
// Seuls les deux états finaux se choisissent ; ils se déduisent des dates.
const suiviValidator = v.union(v.literal('métrée'), v.literal('posée'));

// Nom affiché d'un utilisateur (même format que celui stocké dans vendeurName).
function userName(u: { firstName?: string; lastName?: string; email?: string }): string {
	return `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email || 'Commercial';
}

// Index des utilisateurs, pour afficher « Vendu par X et Y » et retrouver un
// commercial rattaché à partir du nom historique stocké dans le contact.
type People = {
	names: Map<Id<'users'>, string>;
	byName: Map<string, Id<'users'>>;
};

async function loadPeople(ctx: QueryCtx): Promise<People> {
	const users = await ctx.db.query('users').collect();
	const names = new Map<Id<'users'>, string>();
	const byName = new Map<string, Id<'users'>>();
	for (const u of users) {
		const nom = userName(u);
		names.set(u._id, nom);
		byName.set(nom.trim().toLowerCase(), u._id);
		if (u.email) byName.set(u.email.trim().toLowerCase(), u._id);
	}
	return { names, byName };
}

// Binôme d'une vente : les personnes figées sur la vente (`binomeIds`). Pour les
// ventes antérieures à ce champ, on retombe sur l'ancien binôme (commercial
// rattaché au RDV, à défaut vendeur + créateur du contact), mais toujours limité
// à deux personnes. On n'agrège jamais les vendeurs des autres ventes du même
// client : c'est ce qui affichait un troisième « associé ».
function binomeIdsOf(
	vente: Doc<'ventes'>,
	contact: Doc<'contacts'> | undefined,
	byName?: Map<string, Id<'users'>>
): Id<'users'>[] {
	const stored = (vente.binomeIds ?? []).filter((id): id is Id<'users'> => !!id);
	if (stored.length > 0) return [...new Set(stored)].slice(0, 2);

	const nomRattache = contact?.followUp?.commercial?.trim().toLowerCase();
	const rattache =
		contact?.followUp?.commercialId ?? (nomRattache ? byName?.get(nomRattache) : undefined);
	const principal = rattache ?? vente.vendeurId;
	const ids = [principal, contact?.createdBy].filter((id): id is Id<'users'> => !!id);
	return [...new Set(ids)].slice(0, 2);
}

function binomeNamesOf(
	vente: Doc<'ventes'>,
	contact: Doc<'contacts'> | undefined,
	people: People
): string[] {
	const noms = binomeIdsOf(vente, contact, people.byName)
		.map((id) => people.names.get(id))
		.filter((nom): nom is string => !!nom);
	return noms.length > 0 ? noms : [vente.vendeurName];
}

// Binôme à enregistrer sur une vente. Le binôme choisi dans le formulaire fait
// foi ; sinon on fige le binôme courant du dossier : le commercial rattaché au
// RDV, à défaut le vendeur, avec le créateur du contact. Deux personnes maximum.
async function binomePourVente(
	ctx: MutationCtx,
	contact: Doc<'contacts'>,
	vendeurId: Id<'users'>,
	demande?: Id<'users'>[]
): Promise<Id<'users'>[]> {
	if (demande && demande.length > 0) {
		const choisis = [...new Set(demande)].slice(0, 2);
		for (const id of choisis) {
			if (!(await ctx.db.get(id))) throw new Error('Membre du binôme introuvable.');
		}
		const ids = choisis.includes(vendeurId) ? choisis : [vendeurId, ...choisis];
		return [...new Set(ids)].slice(0, 2);
	}

	const users = await ctx.db.query('users').collect();
	const byName = new Map<string, Id<'users'>>();
	for (const u of users) {
		const nom = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
		if (nom) byName.set(nom.toLowerCase(), u._id);
		if (u.email) byName.set(u.email.toLowerCase(), u._id);
	}
	const nomRattache = contact.followUp?.commercial?.trim().toLowerCase();
	const rattache =
		contact.followUp?.commercialId ?? (nomRattache ? byName.get(nomRattache) : undefined);
	const principal = rattache ?? vendeurId;
	const ids = [principal, contact.createdBy].filter((id): id is Id<'users'> => !!id);
	return [...new Set(ids)].slice(0, 2);
}

// Ajoute une vente à un contact : le contact devient un client.
// Le vendeur est l'utilisateur connecté par défaut, ou le commercial choisi (vendeurId).
// État du dossier de financement : en attente, accepté par l'organisme ou refusé.
const fiStatutValidator = v.union(
	v.literal('en attente'),
	v.literal('accepté'),
	v.literal('refusé')
);

export const addVente = mutation({
	args: {
		contactId: v.id('contacts'),
		produits: v.array(produitValidator),
		tvaDetail: tvaDetailValidator,
		vendeurId: v.optional(v.id('users')),
		// Binôme crédité de la vente (1 ou 2 personnes). Absent, le serveur fige
		// le binôme courant du dossier.
		binomeIds: v.optional(v.array(v.id('users'))),
		// Date de la vente (ms) : par défaut maintenant, modifiable pour saisir
		// une vente plus ancienne.
		date: v.optional(v.number()),
		// Suivi commercial : vente confortée, mode de paiement et acceptation du
		// financement (FI) quand le paiement est un financement.
		confortee: v.optional(v.boolean()),
		suivi: v.optional(suiviValidator),
		paiement: paiementValidator,
		fiStatut: v.optional(fiStatutValidator),
		fiAccepte: v.optional(v.boolean())
	},
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		assertCanWriteCrm(user);
		const contact = await ctx.db.get(args.contactId);
		if (!contact) {
			throw new Error('Contact introuvable.');
		}

		let vendeurId = user._id;
		let vendeurName =
			`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email || 'Commercial';
		if (args.vendeurId) {
			const vendeur = await ctx.db.get(args.vendeurId);
			if (!vendeur) {
				throw new Error('Vendeur introuvable.');
			}
			vendeurId = vendeur._id;
			vendeurName =
				`${vendeur.firstName ?? ''} ${vendeur.lastName ?? ''}`.trim() ||
				vendeur.email ||
				'Commercial';
		}

		const totalHT = args.produits.reduce((sum, p) => sum + p.montantHT, 0);
		const totalTVA = args.produits.reduce((sum, p) => sum + (p.montantHT * p.tva) / 100, 0);
		const totalTTC = totalHT + totalTVA;

		// Dossier de financement : `fiStatut` fait foi, `fiAccepte` reste écrit pour
		// les lectures historiques (statistiques, anciens écrans).
		const fiStatut =
			args.paiement === 'financement'
				? (args.fiStatut ?? (args.fiAccepte ? 'accepté' : 'en attente'))
				: undefined;

		const binomeIds = await binomePourVente(ctx, contact, vendeurId, args.binomeIds);

		await ctx.db.insert('ventes', {
			statutChangedAt: Date.now(),
			contactId: args.contactId,
			vendeurId,
			vendeurName,
			binomeIds,
			// Une vente est validée dès sa saisie : plus de statut « en attente ».
			statut: 'valide',
			// Le suivi métrage / pose se remplit ensuite, depuis les dates du dossier.
			...(args.suivi ? { suivi: args.suivi } : {}),
			date: args.date ?? Date.now(),
			produits: args.produits,
			...(args.tvaDetail ? { tvaDetail: args.tvaDetail } : {}),
			totalHT,
			totalTVA,
			totalTTC,
			...(args.confortee !== undefined ? { confortee: args.confortee } : {}),
			...(args.paiement ? { paiement: args.paiement } : {}),
			// Le FI n'a de sens que pour un financement : au comptant, rien à stocker.
			...(fiStatut ? { fiStatut, fiAccepte: fiStatut === 'accepté' } : {}),
			agencyId: user.agencyId
		});

		if (!contact.isClient) {
			await ctx.db.patch(args.contactId, { isClient: true });
		}
		// Le RDV devient « vendu » (vert) dès qu'une vente est enregistrée.
		if (contact.followUp?.type === 'rdv' && contact.followUp?.status !== 'vendu') {
			await ctx.db.patch(args.contactId, {
				followUp: { ...contact.followUp, status: 'vendu' }
			});
		}
	}
});

// Change le statut d'une vente : en attente (non validée), valide, erreur ou
// annulée. Le vendeur de la vente, le créateur du contact lié ou un manager
// (administrateur, directeur de zone, directeur d'agence) peut le modifier —
// mêmes droits que la modification de la vente (`updateVente`).
export const updateStatut = mutation({
	args: {
		venteId: v.id('ventes'),
		statut: v.union(
			v.literal('en attente'),
			v.literal('valide'),
			v.literal('erreur'),
			v.literal('annulée')
		)
	},
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		assertCanWriteCrm(user);
		const vente = await ctx.db.get(args.venteId);
		if (!vente) {
			throw new Error('Vente introuvable.');
		}
		const contact = await ctx.db.get(vente.contactId);
		const allowed =
			vente.vendeurId === user._id ||
			(vente.binomeIds ?? []).includes(user._id) ||
			(contact && contact.createdBy === user._id) ||
			canManageEmployes(user);
		if (!allowed) {
			throw new Error('Non autorisé.');
		}
		// Sortir de l'erreur efface aussi le dossier d'erreur : sinon la fiche
		// garderait les documents manquants d'un dossier désormais validé.
		await ctx.db.patch(args.venteId, {
			statut: args.statut,
			statutChangedAt: Date.now(),
			...(args.statut === 'erreur' ? {} : { erreur: undefined })
		});
	}
});

// Ventes visibles par l'utilisateur connecté, triées de la plus récente à la
// plus ancienne.
//
// Un commercial ne voit que les ventes qui lui sont liées (vendeur, créateur du
// contact, ou commercial lié au RDV). Les managers (animateur, directeur d'agence,
// directeur de zone, administrateur) voient toutes les ventes de leur périmètre et
// peuvent les filtrer par personne (personId, un commercial du périmètre).
export const listVentes = query({
	args: {
		personId: v.optional(v.id('users'))
	},
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);

		const allContacts = await ctx.db.query('contacts').collect();
		const contactMap = new Map(allContacts.map((c) => [c._id, c]));
		// Les ventes archivées — et celles d'une fiche archivée — sortent des
		// listes, des totaux et des exports.
		const allVentes = (await ctx.db.query('ventes').collect()).filter(
			(v) => !v.deletedAt && !contactMap.get(v.contactId)?.deletedAt
		);
		const people = await loadPeople(ctx);

		const build = (ventes: Doc<'ventes'>[]) =>
			ventes
				.map((v) => {
					const contact = contactMap.get(v.contactId);
					const binomeNames = binomeNamesOf(v, contact, people);
					return {
						...v,
						vendeurDisplay: binomeNames.join(' et '),
						binomeNames,
						contactName: contact?.name ?? '—',
						contact: contact
							? {
									...contact,
									createdByName: contact.createdBy ? people.names.get(contact.createdBy) : undefined
								}
							: null
					};
				})
				.sort((a, b) => b.date - a.date);

		// Périmètre manager : toutes les ventes de l'agence/zone, filtrées par personne.
		if (canViewAllCrm(user)) {
			const scopeIds = await visibleAgencyIds(ctx, user);
			let target: Doc<'users'> | null = null;
			let targetName = '';
			if (args.personId) {
				if (!(await isUserInScope(ctx, user, args.personId))) {
					throw new Error('Non autorisé.');
				}
				target = await ctx.db.get(args.personId);
				targetName = target ? `${target.firstName ?? ''} ${target.lastName ?? ''}`.trim() : '';
			}

			const ventes = allVentes.filter((v) => {
				const contact = contactMap.get(v.contactId);
				const agencyId = contact?.agencyId ?? v.agencyId;
				if (!agencyId) return false;
				if (scopeIds !== null && !scopeIds.has(agencyId as Id<'agences'>)) return false;
				if (target) {
					const linked =
						v.vendeurId === target._id ||
						(v.binomeIds ?? []).includes(target._id) ||
						(contact != null && contact.createdBy === target._id) ||
						(!!targetName &&
							!!contact?.followUp?.commercial &&
							contact.followUp.commercial.trim().toLowerCase() === targetName.toLowerCase());
					if (!linked) return false;
				}
				return true;
			});
			return build(ventes);
		}

		// Commercial : uniquement ses ventes (vendeur, créateur du contact, ou
		// commercial lié au RDV).
		const myName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
		const visibleContactIds = new Set<string>();
		for (const c of allContacts) {
			if (c.deletedAt) continue;
			if (c.createdBy === user._id) visibleContactIds.add(c._id);
			if (myName && c.followUp?.commercial === myName) visibleContactIds.add(c._id);
		}
		const ventes = allVentes.filter(
			(v) =>
				v.vendeurId === user._id ||
				(v.binomeIds ?? []).includes(user._id) ||
				visibleContactIds.has(v.contactId)
		);
		return build(ventes);
	}
});

// Met une vente en erreur (statut « erreur ») avec les documents manquants et
// une note argumentée. Réservé aux managers (admin, directeur de zone, directeur d'agence).
export const setErreur = mutation({
	args: {
		venteId: v.id('ventes'),
		manquants: v.array(v.string()),
		note: v.string()
	},
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		if (!canManageEmployes(user)) {
			throw new Error('Non autorisé : réservé à l’administration.');
		}
		const vente = await ctx.db.get(args.venteId);
		if (!vente) {
			throw new Error('Vente introuvable.');
		}
		const managerName =
			`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email || 'Manager';
		await ctx.db.patch(args.venteId, {
			statut: 'erreur',
			statutChangedAt: Date.now(),
			erreur: {
				manquants: args.manquants,
				note: args.note,
				at: Date.now(),
				par: managerName
			}
		});
	}
});

// Supprime l'erreur d'une vente : la vente repasse en « valide » et l'erreur est effacée.
export const removeErreur = mutation({
	args: { venteId: v.id('ventes') },
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		if (!canManageEmployes(user)) {
			throw new Error('Non autorisé : réservé à l’administration.');
		}
		const vente = await ctx.db.get(args.venteId);
		if (!vente) {
			throw new Error('Vente introuvable.');
		}
		await ctx.db.patch(args.venteId, {
			statut: 'valide',
			statutChangedAt: Date.now(),
			erreur: undefined
		});
	}
});

// Suppression d'une vente, réservée aux managers (admin, directeur de zone,
// directeur d'agence). Si c'était la dernière vente du contact, il redevient
// un simple contact (isClient à false).
export const removeVente = mutation({
	args: { venteId: v.id('ventes') },
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		if (!canManageEmployes(user)) {
			throw new Error('Non autorisé : réservé à l’administration.');
		}
		const vente = await ctx.db.get(args.venteId);
		if (!vente) {
			throw new Error('Vente introuvable.');
		}
		// Suppression douce : la vente sort des totaux mais reste auditable. Le
		// contact redevient un simple contact seulement s'il n'a plus aucune vente
		// active.
		await ctx.db.patch(args.venteId, { deletedAt: Date.now(), deletedBy: user._id });
		const remaining = await ctx.db
			.query('ventes')
			.withIndex('by_contact', (q) => q.eq('contactId', vente.contactId))
			.collect();
		if (!remaining.some((v) => !v.deletedAt)) {
			await ctx.db.patch(vente.contactId, { isClient: false });
		}
	}
});

// Modifie une vente existante : produits (produit, TVA, montant HT) et
// éventuellement le commercial accompagnateur. Les totaux sont recalculés.
// Autorisé au vendeur, au créateur du contact ou aux managers.
export const updateVente = mutation({
	args: {
		venteId: v.id('ventes'),
		produits: v.array(produitValidator),
		tvaDetail: tvaDetailValidator,
		vendeurId: v.optional(v.id('users')),
		// Binôme de la vente : le formulaire l'envoie tel quel. Absent, il n'est
		// pas modifié (sauf changement de vendeur, où le nouveau vendeur prend la
		// place de l'ancien dans le binôme).
		binomeIds: v.optional(v.array(v.id('users'))),
		// Date de la vente (ms) : corrigeable (la vente se déplace alors dans les
		// statistiques du mois correspondant).
		date: v.optional(v.number()),
		confortee: v.optional(v.boolean()),
		paiement: paiementValidator,
		fiStatut: v.optional(fiStatutValidator),
		fiAccepte: v.optional(v.boolean())
	},
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		assertCanWriteCrm(user);
		const vente = await ctx.db.get(args.venteId);
		if (!vente) {
			throw new Error('Vente introuvable.');
		}
		const contact = await ctx.db.get(vente.contactId);
		const allowed =
			vente.vendeurId === user._id ||
			(vente.binomeIds ?? []).includes(user._id) ||
			(contact && contact.createdBy === user._id) ||
			canManageEmployes(user);
		if (!allowed) {
			throw new Error('Non autorisé.');
		}
		if (args.produits.length === 0) {
			throw new Error('Ajoute au moins un produit.');
		}

		const totalHT = args.produits.reduce((sum, p) => sum + p.montantHT, 0);
		const totalTVA = args.produits.reduce((sum, p) => sum + (p.montantHT * p.tva) / 100, 0);
		const totalTTC = totalHT + totalTVA;

		const patch: {
			produits: typeof args.produits;
			tvaDetail?: { taux: number; montant: number }[];
			totalHT: number;
			totalTVA: number;
			totalTTC: number;
			vendeurId?: Id<'users'>;
			vendeurName?: string;
			binomeIds?: Id<'users'>[];
			date?: number;
			confortee?: boolean;
			paiement?: 'comptant' | 'financement';
			fiStatut?: 'en attente' | 'accepté' | 'refusé' | undefined;
			fiAccepte?: boolean | undefined;
		} = {
			produits: args.produits,
			...(args.tvaDetail !== undefined ? { tvaDetail: args.tvaDetail } : {}),
			totalHT,
			totalTVA,
			totalTTC
		};

		if (args.date !== undefined) patch.date = args.date;
		if (args.confortee !== undefined) patch.confortee = args.confortee;
		if (args.paiement !== undefined) {
			patch.paiement = args.paiement;
			// Repasser au comptant efface le suivi de financement ; sinon `fiStatut`
			// fait foi et `fiAccepte` reste écrit pour les lectures historiques.
			const fiStatut =
				args.paiement === 'financement'
					? (args.fiStatut ?? (args.fiAccepte ? 'accepté' : 'en attente'))
					: undefined;
			patch.fiStatut = fiStatut;
			patch.fiAccepte = fiStatut ? fiStatut === 'accepté' : undefined;
		}

		let vendeurId = vente.vendeurId;
		if (args.vendeurId && args.vendeurId !== vente.vendeurId) {
			const vendeur = await ctx.db.get(args.vendeurId);
			if (!vendeur) {
				throw new Error('Vendeur introuvable.');
			}
			vendeurId = vendeur._id;
			patch.vendeurId = vendeur._id;
			patch.vendeurName =
				`${vendeur.firstName ?? ''} ${vendeur.lastName ?? ''}`.trim() ||
				vendeur.email ||
				'Commercial';
		}

		if (contact) {
			if (args.binomeIds !== undefined) {
				// Le formulaire envoie le binôme complet : il fait foi.
				patch.binomeIds = await binomePourVente(ctx, contact, vendeurId, args.binomeIds);
			} else if (vendeurId !== vente.vendeurId) {
				// Changement de vendeur sans choix explicite : le nouveau vendeur
				// remplace l'ancien, le partenaire reste le même.
				const partenaire = binomeIdsOf(vente, contact).find((id) => id !== vente.vendeurId);
				patch.binomeIds = [...new Set([vendeurId, ...(partenaire ? [partenaire] : [])])].slice(
					0,
					2
				);
			}
		}

		await ctx.db.patch(args.venteId, patch);
	}
});

// Change l'avancement du dossier d'une vente (case « Suivi » du tableau).
// Mêmes droits que la modification de la vente.
export const updateSuivi = mutation({
	args: { venteId: v.id('ventes'), suivi: suiviValidator },
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		assertCanWriteCrm(user);
		const vente = await ctx.db.get(args.venteId);
		if (!vente) throw new Error('Vente introuvable.');
		const contact = await ctx.db.get(vente.contactId);
		const allowed =
			vente.vendeurId === user._id ||
			(vente.binomeIds ?? []).includes(user._id) ||
			(contact && contact.createdBy === user._id) ||
			canManageEmployes(user);
		if (!allowed) throw new Error('Non autorisé.');
		await ctx.db.patch(args.venteId, { suivi: args.suivi });
	}
});

// Confortation : le client a confirmé la vente. Case séparée du suivi
// métrage / pose, modifiable à tout moment depuis la fiche.
export const setConfortation = mutation({
	args: { venteId: v.id('ventes'), confortee: v.boolean() },
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		assertCanWriteCrm(user);
		const vente = await ctx.db.get(args.venteId);
		if (!vente || vente.deletedAt) throw new Error('Vente introuvable.');
		const contact = await ctx.db.get(vente.contactId);
		const allowed =
			vente.vendeurId === user._id ||
			(vente.binomeIds ?? []).includes(user._id) ||
			(contact && contact.createdBy === user._id) ||
			canManageEmployes(user);
		if (!allowed) throw new Error('Non autorisé.');
		await ctx.db.patch(args.venteId, { confortee: args.confortee });
	}
});

// Dates du dossier d'une vente : métrage technique et pose, saisies après coup
// depuis la fiche client/vente. Renseigner une pose avance le suivi en « posée »
// et recopie la date dans `datesPoses` pour l'agenda ; vider une date revient en
// arrière. Mêmes droits que la modification de la vente.
export const setDatesVente = mutation({
	args: {
		venteId: v.id('ventes'),
		dateMetrage: v.optional(v.string()),
		datePose: v.optional(v.string())
	},
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		assertCanWriteCrm(user);
		const vente = await ctx.db.get(args.venteId);
		if (!vente || vente.deletedAt) throw new Error('Vente introuvable.');
		const contact = await ctx.db.get(vente.contactId);
		const allowed =
			vente.vendeurId === user._id ||
			(vente.binomeIds ?? []).includes(user._id) ||
			(contact && contact.createdBy === user._id) ||
			canManageEmployes(user);
		if (!allowed) throw new Error('Non autorisé.');

		const isIsoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
		const patch: Record<string, unknown> = {};
		// Les autres dates de pose (posées depuis l'ancien agenda) sont conservées.
		const autresPoses = (vente.datesPoses ?? []).filter((d) => d.id !== 'fiche');

		if (args.dateMetrage !== undefined) {
			if (args.dateMetrage && !isIsoDate(args.dateMetrage)) {
				throw new Error('Date de métrage invalide.');
			}
			patch.dateMetrage = args.dateMetrage || undefined;
		}

		if (args.datePose !== undefined) {
			if (args.datePose && !isIsoDate(args.datePose)) {
				throw new Error('Date de pose invalide.');
			}
			patch.datePose = args.datePose || undefined;
			patch.datesPoses = args.datePose
				? [...autresPoses, { id: 'fiche', date: args.datePose }]
				: autresPoses;
		}

		// Le suivi se déduit des dates et du calendrier : une pose encore à venir
		// est « pose programmée », du jour ou passée c'est « posée » (état final).
		// Même règle pour le métrage. Aucune date ⇒ pas de suivi.
		const metrage = args.dateMetrage !== undefined ? args.dateMetrage : vente.dateMetrage;
		const pose = args.datePose !== undefined ? args.datePose : vente.datePose;
		const jour = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
		patch.suivi = pose
			? pose > jour
				? 'pose programmée'
				: 'posée'
			: metrage
				? metrage > jour
					? 'métré programmé'
					: 'métrée'
				: undefined;

		await ctx.db.patch(args.venteId, patch as never);
	}
});

// Dates de pose (installation / livraison) d'une vente : elles vivent sur la
// vente et s'affichent dans l'agenda. Autorisé au vendeur, au créateur du
// contact ou à un manager — même règle que la modification de la vente.
export const addDatePose = mutation({
	args: {
		venteId: v.id('ventes'),
		date: v.string(),
		time: v.optional(v.string()),
		note: v.optional(v.string())
	},
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		assertCanWriteCrm(user);
		const vente = await ctx.db.get(args.venteId);
		if (!vente || vente.deletedAt) {
			throw new Error('Vente introuvable.');
		}
		const contact = await ctx.db.get(vente.contactId);
		const allowed =
			vente.vendeurId === user._id ||
			(vente.binomeIds ?? []).includes(user._id) ||
			(contact && contact.createdBy === user._id) ||
			canManageEmployes(user);
		if (!allowed) {
			throw new Error('Non autorisé.');
		}
		if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
			throw new Error('Date de pose invalide.');
		}
		const datePoseId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
		await ctx.db.patch(args.venteId, {
			datesPoses: [
				...(vente.datesPoses ?? []),
				{
					id: datePoseId,
					date: args.date,
					...(args.time ? { time: args.time } : {}),
					...(args.note?.trim() ? { note: args.note.trim() } : {})
				}
			]
		});
		return datePoseId;
	}
});

export const removeDatePose = mutation({
	args: { venteId: v.id('ventes'), datePoseId: v.string() },
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		assertCanWriteCrm(user);
		const vente = await ctx.db.get(args.venteId);
		if (!vente) {
			throw new Error('Vente introuvable.');
		}
		const contact = await ctx.db.get(vente.contactId);
		const allowed =
			vente.vendeurId === user._id ||
			(vente.binomeIds ?? []).includes(user._id) ||
			(contact && contact.createdBy === user._id) ||
			canManageEmployes(user);
		if (!allowed) {
			throw new Error('Non autorisé.');
		}
		await ctx.db.patch(args.venteId, {
			datesPoses: (vente.datesPoses ?? []).filter((d) => d.id !== args.datePoseId)
		});
	}
});

// Ventes en erreur visibles par l'utilisateur connecté (tableau de bord).
// Les managers voient toutes les ventes en erreur de leur périmètre ;
// les autres ne voient que les ventes qui leur sont liées.
export const listVentesEnErreur = query({
	args: {},
	handler: async (ctx) => {
		const user = await getCurrentUser(ctx);
		const allVentes = await ctx.db.query('ventes').collect();
		const ventesErreur = allVentes.filter((v) => v.statut === 'erreur' && !v.deletedAt);
		if (ventesErreur.length === 0) return [];

		const allContacts = await ctx.db.query('contacts').collect();
		const contactMap = new Map(allContacts.map((c) => [c._id, c]));
		const myName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
		const isManager = canManageEmployes(user);
		const scopeAll = user.role === 'administrateur' || user.role === 'directeur de zone';

		const visible = ventesErreur.filter((v) => {
			const contact = contactMap.get(v.contactId);
			if (contact?.deletedAt) return false;
			if (isManager) {
				if (scopeAll) return true;
				// Directeur d'agence : uniquement les ventes de son agence.
				return (contact?.agencyId ?? v.agencyId) === user.agencyId;
			}
			return (
				v.vendeurId === user._id ||
				(v.binomeIds ?? []).includes(user._id) ||
				(contact !== undefined && contact.createdBy === user._id) ||
				(!!myName && contact?.followUp?.commercial === myName)
			);
		});
		const people = await loadPeople(ctx);

		return visible
			.map((v) => {
				const contact = contactMap.get(v.contactId);
				const binomeNames = binomeNamesOf(v, contact, people);
				return {
					...v,
					vendeurDisplay: binomeNames.join(' et '),
					binomeNames,
					contactName: contact?.name ?? '—',
					contactPhone: contact?.phone ?? null,
					contactProjet: contact?.projet ?? null
				};
			})
			.sort((a, b) => (b.erreur?.at ?? b.date) - (a.erreur?.at ?? a.date));
	}
});

// Ventes d'un contact précis (pour la fiche).
export const getVentes = query({
	args: { contactId: v.id('contacts') },
	handler: async (ctx, { contactId }) => {
		const user = await getCurrentUser(ctx);
		const contact = await ctx.db.get(contactId);
		if (!contact) return [];

		const ventes = (
			await ctx.db
				.query('ventes')
				.withIndex('by_contact', (q) => q.eq('contactId', contactId))
				.collect()
		).filter((v) => !v.deletedAt);
		const myName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();

		// Visibilité : je suis vendeur d'une vente, ou le RDV du contact m'est lié,
		// ou je suis créateur du contact — ou je suis manager avec accès à l'agence
		// du contact (donc à ses ventes).
		let canSee = false;
		if (canViewAllCrm(user) && contact.agencyId) {
			const scopeIds = await visibleAgencyIds(ctx, user);
			canSee = scopeIds === null || scopeIds.has(contact.agencyId as Id<'agences'>);
		}
		const isMine =
			canSee ||
			ventes.some((v) => v.vendeurId === user._id || (v.binomeIds ?? []).includes(user._id)) ||
			(!!myName && contact.followUp?.commercial === myName) ||
			contact.createdBy === user._id;
		if (!isMine) return [];

		// Chaque vente porte son propre binôme : le libellé ne dépend que d'elle.
		const people = await loadPeople(ctx);
		return ventes
			.map((v) => {
				const binomeNames = binomeNamesOf(v, contact, people);
				return {
					...v,
					vendeurDisplay: binomeNames.join(' et '),
					binomeNames
				};
			})
			.sort((a, b) => b.date - a.date);
	}
});

// Clients visibles par l'utilisateur connecté, triés par nom.
//
// Pour un commercial : contacts ayant au moins une vente dont il est le vendeur,
// ou dont un RDV lui est lié (followUp.commercial = son nom), ou qu'il a créés
// et vendus en binôme. En binôme, le client appartient aux deux commerciaux.
//
// Pour un manager (animateur, directeur d'agence, directeur de zone,
// administrateur) : tous les clients de son périmètre, filtrés par personne
// (personId) quand un commercial est sélectionné.
export const listClients = query({
	args: {
		personId: v.optional(v.id('users'))
	},
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);

		const allVentes = (await ctx.db.query('ventes').collect()).filter((v) => !v.deletedAt);
		const ventesByContact = new Map<string, Doc<'ventes'>[]>();
		for (const v of allVentes) {
			const list = ventesByContact.get(v.contactId) ?? [];
			list.push(v);
			ventesByContact.set(v.contactId, list);
		}

		const allContacts = await ctx.db.query('contacts').collect();
		const contactMap = new Map(allContacts.map((c) => [c._id, c]));
		const people = await loadPeople(ctx);

		const buildClients = (contactIds: Set<string>) => {
			const clients: Array<{
				contact: Doc<'contacts'> & { createdByName?: string };
				ventes: Array<Doc<'ventes'> & { vendeurDisplay: string; binomeNames: string[] }>;
				totalTTC: number;
			}> = [];
			for (const id of contactIds) {
				const contact = contactMap.get(id as Id<'contacts'>);
				if (!contact || contact.deletedAt) continue;
				const ventesList = ventesByContact.get(id) ?? [];
				if (ventesList.length === 0) continue;
				const totalTTC = ventesList.reduce((sum, v) => sum + v.totalTTC, 0);
				clients.push({
					contact: {
						...contact,
						createdByName: contact.createdBy ? people.names.get(contact.createdBy) : undefined
					},
					ventes: ventesList.map((v) => {
						const binomeNames = binomeNamesOf(v, contact, people);
						return {
							...v,
							vendeurDisplay: binomeNames.join(' et '),
							binomeNames
						};
					}),
					totalTTC
				});
			}
			return clients.sort((a, b) => (a.contact.name ?? '').localeCompare(b.contact.name ?? ''));
		};

		// Périmètre manager : tous les clients de l'agence/zone, filtrés par personne.
		if (canViewAllCrm(user)) {
			const scopeIds = await visibleAgencyIds(ctx, user);
			let target: Doc<'users'> | null = null;
			let targetName = '';
			if (args.personId) {
				if (!(await isUserInScope(ctx, user, args.personId))) {
					throw new Error('Non autorisé.');
				}
				target = await ctx.db.get(args.personId);
				targetName = target ? `${target.firstName ?? ''} ${target.lastName ?? ''}`.trim() : '';
			}

			const contactIds = new Set<string>();
			for (const contact of allContacts) {
				if (!contact.agencyId) continue;
				if (scopeIds !== null && !scopeIds.has(contact.agencyId as Id<'agences'>)) {
					continue;
				}
				if ((ventesByContact.get(contact._id)?.length ?? 0) === 0) continue;
				if (target) {
					const linked =
						contact.createdBy === target._id ||
						(ventesByContact
							.get(contact._id)
							?.some(
								(v) => v.vendeurId === target._id || (v.binomeIds ?? []).includes(target._id)
							) ??
							false) ||
						(!!targetName &&
							!!contact.followUp?.commercial &&
							contact.followUp.commercial.trim().toLowerCase() === targetName.toLowerCase());
					if (!linked) continue;
				}
				contactIds.add(contact._id);
			}
			return buildClients(contactIds);
		}

		// Commercial : contacts qui lui sont liés (vendeur, créateur, RDV partagé).
		const myName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
		const contactIds = new Set<string>();

		// 1) Contacts ayant une vente signée par moi, seul ou en binôme.
		for (const v of allVentes) {
			if (v.vendeurId === user._id || (v.binomeIds ?? []).includes(user._id)) {
				contactIds.add(v.contactId);
			}
		}

		// 2) Contacts dont le RDV est lié à moi (commercial partagé).
		if (myName) {
			const shared = await ctx.db
				.query('contacts')
				.filter((q) => q.eq(q.field('followUp.commercial'), myName))
				.collect();
			for (const c of shared) contactIds.add(c._id);
		}

		// 3) Contacts que j'ai créés ayant au moins une vente : en binôme, le
		// client appartient aussi au commercial qui a pris le contact.
		const myContacts = await ctx.db
			.query('contacts')
			.withIndex('by_createdBy', (q) => q.eq('createdBy', user._id))
			.collect();
		for (const c of myContacts) {
			if ((ventesByContact.get(c._id)?.length ?? 0) > 0) contactIds.add(c._id);
		}

		return buildClients(contactIds);
	}
});

// Migration : fige le binôme sur chaque vente existante.
//
// Le binôme était jusqu'ici recalculé depuis le contact et l'ensemble des
// ventes du client : deux ventes signées par deux commerciaux différents
// finissaient avec trois noms sur chaque ligne. On enregistre désormais, pour
// chaque vente, le couple « commercial rattaché au RDV (à défaut le vendeur) +
// créateur du contact » — deux personnes maximum. Le `vendeurId` reste intact.
export const migrateBinomeVentes = internalMutation({
	args: { dryRun: v.optional(v.boolean()) },
	handler: async (ctx, { dryRun }) => {
		const users = await ctx.db.query('users').collect();
		const byName = new Map<string, Id<'users'>>();
		for (const u of users) {
			const nom = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
			if (nom) byName.set(nom.toLowerCase(), u._id);
			if (u.email) byName.set(u.email.toLowerCase(), u._id);
		}

		const ventes = await ctx.db.query('ventes').collect();
		let updated = 0;
		const details: Array<{
			venteId: Id<'ventes'>;
			avant: Id<'users'>[];
			apres: Id<'users'>[];
		}> = [];

		for (const vente of ventes) {
			const contact = await ctx.db.get(vente.contactId);
			const nomRattache = (contact?.followUp?.commercial ?? '').trim().toLowerCase();
			const rattache =
				contact?.followUp?.commercialId ?? (nomRattache ? byName.get(nomRattache) : undefined);
			const principal = rattache ?? vente.vendeurId;
			const ids = [
				...new Set([principal, contact?.createdBy].filter((id): id is Id<'users'> => !!id))
			].slice(0, 2);

			const avant = vente.binomeIds ?? [];
			if (avant.length === ids.length && avant.every((id, i) => id === ids[i])) continue;

			updated++;
			if (details.length < 100) details.push({ venteId: vente._id, avant, apres: ids });
			if (!dryRun) await ctx.db.patch(vente._id, { binomeIds: ids });
		}

		return { total: ventes.length, updated, dryRun: !!dryRun, details };
	}
});
