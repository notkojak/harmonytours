import { mutation, query, type QueryCtx } from './_generated/server';
import { v } from 'convex/values';
import { canManageEmployes, getCurrentUser } from './permissions';
import { canViewAllCrm, isUserInScope, visibleAgencyIds } from './access';
import type { Doc, Id } from './_generated/dataModel';

const produitValidator = v.object({
	produit: v.string(),
	tva: v.union(v.literal(5.5), v.literal(10), v.literal(20)),
	montantHT: v.number()
});

// Nom affiché d'un utilisateur (même format que celui stocké dans vendeurName).
function userName(u: { firstName?: string; lastName?: string; email?: string }): string {
	return `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email || 'Commercial';
}

// Noms des créateurs des contacts (commercial qui a pris le contact), pour
// l'affichage « Vendu par X et Y » et la fiche client.
async function creatorNames(
	ctx: QueryCtx,
	contacts: Doc<'contacts'>[]
): Promise<Map<Id<'users'>, string>> {
	const ids = new Set<Id<'users'>>();
	for (const c of contacts) if (c.createdBy) ids.add(c.createdBy);
	const names = new Map<Id<'users'>, string>();
	for (const id of ids) {
		const u = await ctx.db.get(id);
		if (u) names.set(id, userName(u));
	}
	return names;
}

// Nom affiché du vendeur d'une vente : « X » seul, ou « X et Y » quand la vente
// est conclue en binôme (le vendeur diffère du commercial qui a créé le contact).
function vendeurLabel(
	vente: Doc<'ventes'>,
	contact: Doc<'contacts'> | undefined,
	userNames: Map<Id<'users'>, string>
): string {
	if (contact?.createdBy && contact.createdBy !== vente.vendeurId) {
		const binomeName = userNames.get(contact.createdBy);
		if (binomeName) return `${vente.vendeurName} et ${binomeName}`;
	}
	return vente.vendeurName;
}

// Ajoute une vente à un contact : le contact devient un client.
// Le vendeur est l'utilisateur connecté par défaut, ou le commercial choisi (vendeurId).
export const addVente = mutation({
	args: {
		contactId: v.id('contacts'),
		produits: v.array(produitValidator),
		vendeurId: v.optional(v.id('users'))
	},
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
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

		await ctx.db.insert('ventes', {
			contactId: args.contactId,
			vendeurId,
			vendeurName,
			// Par défaut « en attente » : la vente n'est comptée dans le CA que
			// lorsqu'elle passe en « valide » (validation du dossier).
			statut: 'en attente',
			date: Date.now(),
			produits: args.produits,
			totalHT,
			totalTVA,
			totalTTC,
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
// annulée. Seul le vendeur de la vente ou le créateur du contact lié peut le
// modifier.
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
		const vente = await ctx.db.get(args.venteId);
		if (!vente) {
			throw new Error('Vente introuvable.');
		}
		const contact = await ctx.db.get(vente.contactId);
		const allowed = vente.vendeurId === user._id || (contact && contact.createdBy === user._id);
		if (!allowed) {
			throw new Error('Non autorisé.');
		}
		await ctx.db.patch(args.venteId, { statut: args.statut });
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
		const userNames = await creatorNames(ctx, allContacts);

		const build = (ventes: Doc<'ventes'>[]) =>
			ventes
				.map((v) => {
					const contact = contactMap.get(v.contactId);
					return {
						...v,
						vendeurDisplay: vendeurLabel(v, contact, userNames),
						contactName: contact?.name ?? '—',
						contact: contact
							? {
									...contact,
									createdByName: contact.createdBy ? userNames.get(contact.createdBy) : undefined
								}
							: null
					};
				})
				.sort((a, b) => b.date - a.date);

		const allVentes = await ctx.db.query('ventes').collect();

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
			if (c.createdBy === user._id) visibleContactIds.add(c._id);
			if (myName && c.followUp?.commercial === myName) visibleContactIds.add(c._id);
		}
		const ventes = allVentes.filter(
			(v) => v.vendeurId === user._id || visibleContactIds.has(v.contactId)
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
		await ctx.db.patch(args.venteId, { statut: 'valide', erreur: undefined });
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
		await ctx.db.delete(args.venteId);
		const remaining = await ctx.db
			.query('ventes')
			.withIndex('by_contact', (q) => q.eq('contactId', vente.contactId))
			.collect();
		if (remaining.length === 0) {
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
		vendeurId: v.optional(v.id('users'))
	},
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		const vente = await ctx.db.get(args.venteId);
		if (!vente) {
			throw new Error('Vente introuvable.');
		}
		const contact = await ctx.db.get(vente.contactId);
		const allowed =
			vente.vendeurId === user._id ||
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

		let patch: {
			produits: typeof args.produits;
			totalHT: number;
			totalTVA: number;
			totalTTC: number;
			vendeurId?: Id<'users'>;
			vendeurName?: string;
		} = { produits: args.produits, totalHT, totalTVA, totalTTC };

		if (args.vendeurId && args.vendeurId !== vente.vendeurId) {
			const vendeur = await ctx.db.get(args.vendeurId);
			if (!vendeur) {
				throw new Error('Vendeur introuvable.');
			}
			patch.vendeurId = vendeur._id;
			patch.vendeurName =
				`${vendeur.firstName ?? ''} ${vendeur.lastName ?? ''}`.trim() ||
				vendeur.email ||
				'Commercial';
		}

		await ctx.db.patch(args.venteId, patch);
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
		const ventesErreur = allVentes.filter((v) => v.statut === 'erreur');
		if (ventesErreur.length === 0) return [];

		const allContacts = await ctx.db.query('contacts').collect();
		const contactMap = new Map(allContacts.map((c) => [c._id, c]));
		const myName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
		const isManager = canManageEmployes(user);
		const scopeAll = user.role === 'administrateur' || user.role === 'directeur de zone';

		const visible = ventesErreur.filter((v) => {
			const contact = contactMap.get(v.contactId);
			if (isManager) {
				if (scopeAll) return true;
				// Directeur d'agence : uniquement les ventes de son agence.
				return (contact?.agencyId ?? v.agencyId) === user.agencyId;
			}
			return (
				v.vendeurId === user._id ||
				(contact !== undefined && contact.createdBy === user._id) ||
				(!!myName && contact?.followUp?.commercial === myName)
			);
		});
		const userNames = await creatorNames(ctx, allContacts);

		return visible
			.map((v) => {
				const contact = contactMap.get(v.contactId);
				return {
					...v,
					vendeurDisplay: vendeurLabel(v, contact, userNames),
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

		const ventes = await ctx.db
			.query('ventes')
			.withIndex('by_contact', (q) => q.eq('contactId', contactId))
			.collect();
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
			ventes.some((v) => v.vendeurId === user._id) ||
			(!!myName && contact.followUp?.commercial === myName) ||
			contact.createdBy === user._id;
		if (!isMine) return [];

		const userNames = await creatorNames(ctx, [contact]);
		return ventes
			.map((v) => ({
				...v,
				vendeurDisplay: vendeurLabel(v, contact, userNames)
			}))
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

		const allVentes = await ctx.db.query('ventes').collect();
		const ventesByContact = new Map<string, Doc<'ventes'>[]>();
		for (const v of allVentes) {
			const list = ventesByContact.get(v.contactId) ?? [];
			list.push(v);
			ventesByContact.set(v.contactId, list);
		}

		const allContacts = await ctx.db.query('contacts').collect();
		const contactMap = new Map(allContacts.map((c) => [c._id, c]));
		const userNames = await creatorNames(ctx, allContacts);

		const buildClients = (contactIds: Set<string>) => {
			const clients: Array<{
				contact: Doc<'contacts'> & { createdByName?: string };
				ventes: Array<Doc<'ventes'> & { vendeurDisplay: string }>;
				totalTTC: number;
			}> = [];
			for (const id of contactIds) {
				const contact = contactMap.get(id as Id<'contacts'>);
				if (!contact) continue;
				const ventesList = ventesByContact.get(id) ?? [];
				if (ventesList.length === 0) continue;
				const totalTTC = ventesList.reduce((sum, v) => sum + v.totalTTC, 0);
				clients.push({
					contact: {
						...contact,
						createdByName: contact.createdBy ? userNames.get(contact.createdBy) : undefined
					},
					ventes: ventesList.map((v) => ({
						...v,
						vendeurDisplay: vendeurLabel(v, contactMap.get(v.contactId), userNames)
					})),
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
						(ventesByContact.get(contact._id)?.some((v) => v.vendeurId === target._id) ?? false) ||
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

		// 1) Contacts ayant une vente signée par moi.
		const myVentes = await ctx.db
			.query('ventes')
			.withIndex('by_vendeur', (q) => q.eq('vendeurId', user._id))
			.collect();
		for (const v of myVentes) contactIds.add(v.contactId);

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
