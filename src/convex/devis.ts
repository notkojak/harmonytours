import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { canManageEmployes, getCurrentUser } from './permissions';
import { canViewAllCrm, visibleAgencyIds } from './access';

// Devis : le chiffrage quitte le stockage local du navigateur. Un devis est
// enregistré côté serveur, rattachable à une fiche, partageable dans l'agence
// et convertible en vente sans ressaisir les lignes.

const ligneValidator = v.object({
	uid: v.string(),
	ref: v.string(),
	designation: v.string(),
	detail: v.optional(v.string()),
	prixUnitaireHT: v.number(),
	quantite: v.number(),
	unite: v.string(),
	tva: v.number() // taux décimal : 0.055, 0.1, 0.2
});

export const statutValidator = v.union(
	v.literal('brouillon'),
	v.literal('envoyé'),
	v.literal('accepté'),
	v.literal('refusé')
);

type Ligne = { prixUnitaireHT: number; quantite: number; tva: number };

/** Totaux HT/TVA/TTC après remise, arrondis au centime. */
export function totauxDevis(lignes: Ligne[], remise: number) {
	const coef = 1 - Math.min(Math.max(remise, 0), 100) / 100;
	let totalHT = 0;
	let totalTVA = 0;
	for (const l of lignes) {
		const ht = l.prixUnitaireHT * l.quantite * coef;
		totalHT += ht;
		totalTVA += ht * l.tva;
	}
	const arrondi = (n: number) => Math.round(n * 100) / 100;
	return {
		totalHT: arrondi(totalHT),
		totalTVA: arrondi(totalTVA),
		totalTTC: arrondi(totalHT + totalTVA)
	};
}

async function canRead(
	ctx: Parameters<typeof getCurrentUser>[0],
	user: Doc<'users'>,
	devis: Doc<'devis'>
): Promise<boolean> {
	if (devis.createdBy === user._id) return true;
	if (!canViewAllCrm(user)) return false;
	if (!devis.agencyId) return true;
	const scopeIds = await visibleAgencyIds(ctx, user);
	return scopeIds === null || scopeIds.has(devis.agencyId);
}

function numero(n: number): string {
	const now = new Date();
	return `DEV-${now.getFullYear()}-${String(n).padStart(4, '0')}`;
}

export const save = mutation({
	args: {
		devisId: v.optional(v.id('devis')),
		clientName: v.string(),
		contactId: v.optional(v.id('contacts')),
		lignes: v.array(ligneValidator),
		remise: v.number(),
		opportunite: v.optional(v.any()),
		statut: v.optional(statutValidator)
	},
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		const clientName = args.clientName.trim();
		if (!clientName) throw new Error('Renseigne le nom du client.');
		if (args.lignes.length === 0) throw new Error('Le devis est vide.');
		const remise = Math.min(Math.max(args.remise, 0), 100);
		const totaux = totauxDevis(args.lignes, remise);

		let contact: Doc<'contacts'> | null = null;
		if (args.contactId) {
			contact = await ctx.db.get(args.contactId);
			if (!contact || contact.deletedAt) throw new Error('Contact introuvable.');
			const scopeIds = await visibleAgencyIds(ctx, user);
			if (scopeIds !== null && contact.agencyId && !scopeIds.has(contact.agencyId)) {
				throw new Error('Non autorisé pour cette agence.');
			}
		}

		if (args.devisId) {
			const existing = await ctx.db.get(args.devisId);
			if (!existing) throw new Error('Devis introuvable.');
			if (!(await canRead(ctx, user, existing))) throw new Error('Non autorisé.');
			await ctx.db.patch(args.devisId, {
				contactId: args.contactId ?? existing.contactId,
				clientName,
				lignes: args.lignes,
				remise,
				...totaux,
				...(args.opportunite !== undefined ? { opportunite: args.opportunite as never } : {}),
				...(args.statut ? { statut: args.statut } : {}),
				updatedAt: Date.now()
			});
			return args.devisId;
		}

		// Numérotation simple et lisible : compteur par agence.
		const agence = contact?.agencyId ?? user.agencyId;
		const existants = await ctx.db.query('devis').collect();
		const n =
			existants.filter((d) => (d.agencyId ?? undefined) === (agence ?? undefined)).length + 1;

		const id = await ctx.db.insert('devis', {
			numero: numero(n),
			clientName,
			...(args.contactId ? { contactId: args.contactId } : {}),
			lignes: args.lignes,
			remise,
			...totaux,
			...(args.opportunite !== undefined ? { opportunite: args.opportunite as never } : {}),
			statut: args.statut ?? 'brouillon',
			createdBy: user._id,
			agencyId: agence,
			createdAt: Date.now(),
			updatedAt: Date.now()
		});
		return id;
	}
});

// Devis visibles : les siens pour un commercial, ceux de son périmètre pour un
// manager, les plus récents d'abord.
export const list = query({
	args: { contactId: v.optional(v.id('contacts')), limit: v.optional(v.number()) },
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		const limit = Math.min(Math.max(args.limit ?? 40, 1), 200);
		const all = (await ctx.db.query('devis').collect()).filter((d) => !d.deletedAt);
		const visible: Doc<'devis'>[] = [];
		for (const d of all) {
			if (await canRead(ctx, user, d)) visible.push(d);
		}
		const contactIds = [...new Set(visible.map((d) => d.contactId).filter((id): id is Id<'contacts'> => !!id))];
		const contacts = await Promise.all(contactIds.map((id) => ctx.db.get(id)));
		const names = new Map<string, string>();
		for (const c of contacts) if (c) names.set(c._id, c.name);
		return visible
			.filter((d) => (args.contactId ? d.contactId === args.contactId : true))
			.sort((a, b) => b.updatedAt - a.updatedAt)
			.slice(0, limit)
			.map((d) => ({
				...d,
				contactName: d.contactId ? (names.get(d.contactId) ?? null) : null
			}));
	}
});

export const setStatut = mutation({
	args: { devisId: v.id('devis'), statut: statutValidator },
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		const devis = await ctx.db.get(args.devisId);
		if (!devis) throw new Error('Devis introuvable.');
		if (!(await canRead(ctx, user, devis))) throw new Error('Non autorisé.');
		await ctx.db.patch(args.devisId, { statut: args.statut, updatedAt: Date.now() });
	}
});

export const remove = mutation({
	args: { devisId: v.id('devis') },
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		const devis = await ctx.db.get(args.devisId);
		if (!devis) return;
		if (devis.createdBy !== user._id && !canManageEmployes(user)) {
			throw new Error('Non autorisé.');
		}
		await ctx.db.patch(args.devisId, { deletedAt: Date.now() });
	}
});

/**
 * Convertit un devis accepté en vente : les lignes deviennent des produits,
 * la remise est répartie au prorata pour que le total HT de la vente
 * corresponde exactement au devis. La fiche devient cliente.
 */
export const convertirEnVente = mutation({
	args: { devisId: v.id('devis'), vendeurId: v.optional(v.id('users')) },
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		const devis = await ctx.db.get(args.devisId);
		if (!devis) throw new Error('Devis introuvable.');
		if (!(await canRead(ctx, user, devis))) throw new Error('Non autorisé.');
		if (!devis.contactId) {
			throw new Error('Rattache le devis à une fiche client avant de le convertir.');
		}
		if (devis.venteId) throw new Error('Ce devis a déjà été converti en vente.');
		const contact = await ctx.db.get(devis.contactId);
		if (!contact || contact.deletedAt) throw new Error('Contact introuvable.');

		let vendeurId: Id<'users'> = user._id;
		let vendeurName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email || 'Commercial';
		if (args.vendeurId && args.vendeurId !== user._id) {
			if (!canViewAllCrm(user)) throw new Error('Non autorisé à choisir un autre vendeur.');
			const vendeur = await ctx.db.get(args.vendeurId);
			if (!vendeur) throw new Error('Vendeur introuvable.');
			vendeurId = vendeur._id;
			vendeurName = `${vendeur.firstName ?? ''} ${vendeur.lastName ?? ''}`.trim() || vendeur.email || 'Commercial';
		}

		const coef = 1 - Math.min(Math.max(devis.remise, 0), 100) / 100;
		const produits = devis.lignes.map((l) => ({
			produit: l.designation,
			tva: Math.round(l.tva * 1000) / 10,
			montantHT: Math.round(l.prixUnitaireHT * l.quantite * coef * 100) / 100
		}));
		const totalHT = Math.round(produits.reduce((s, p) => s + p.montantHT, 0) * 100) / 100;
		const totalTVA =
			Math.round(produits.reduce((s, p) => s + (p.montantHT * p.tva) / 100, 0) * 100) / 100;
		const totalTTC = Math.round((totalHT + totalTVA) * 100) / 100;

		const venteId = await ctx.db.insert('ventes', {
			contactId: contact._id,
			vendeurId,
			vendeurName,
			statut: 'en attente',
			statutChangedAt: Date.now(),
			date: Date.now(),
			produits,
			totalHT,
			totalTVA,
			totalTTC,
			agencyId: contact.agencyId ?? devis.agencyId
		});
		await ctx.db.patch(devis._id, { statut: 'accepté', venteId, updatedAt: Date.now() });
		if (!contact.isClient) await ctx.db.patch(contact._id, { isClient: true });
		return venteId;
	}
});
