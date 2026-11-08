import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import { canManageEmployes, getCurrentUser } from './permissions';
import { canViewAllCrm, visibleAgencyIds } from './access';

// Pièces jointes : devis signé, plan, photo de chantier, justificatif de
// financement… Le flux « documents manquants » d'un dossier en erreur trouve
// enfin où stocker les pièces.

// Catégories proposées dans l'interface (le champ reste libre côté base).
export const CATEGORIES = [
	{ key: 'devis', label: 'Devis signé' },
	{ key: 'plan', label: 'Plan / croquis' },
	{ key: 'photo', label: 'Photo de chantier' },
	{ key: 'justificatif', label: 'Justificatif (FI, avis d’imposition…)' },
	{ key: 'contrat', label: 'Contrat' },
	{ key: 'autre', label: 'Autre' }
] as const;

/** Écriture autorisée : créateur de la fiche, commercial du RDV, ou manager. */
async function canWriteForContact(
	ctx: Parameters<typeof getCurrentUser>[0],
	user: Doc<'users'>,
	contact: Doc<'contacts'> | null
): Promise<boolean> {
	if (!contact) return true;
	if (contact.createdBy === user._id) return true;
	if (contact.followUp?.commercialId === user._id) return true;
	if (!canViewAllCrm(user)) return false;
	if (!contact.agencyId) return true;
	const scopeIds = await visibleAgencyIds(ctx, user);
	return scopeIds === null || scopeIds.has(contact.agencyId);
}

export const generateUploadUrl = mutation({
	args: {},
	handler: async (ctx) => {
		await getCurrentUser(ctx);
		return await ctx.storage.generateUploadUrl();
	}
});

export const attach = mutation({
	args: {
		name: v.string(),
		storageId: v.string(),
		mimeType: v.optional(v.string()),
		size: v.optional(v.number()),
		category: v.string(),
		contactId: v.optional(v.id('contacts')),
		venteId: v.optional(v.id('ventes')),
		devisId: v.optional(v.id('devis'))
	},
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		const name = args.name.trim();
		if (!name) throw new Error('Nom du fichier manquant.');
		const url = await ctx.storage.getUrl(args.storageId);
		if (!url) throw new Error('Fichier introuvable.');

		let contact: Doc<'contacts'> | null = null;
		if (args.contactId) {
			contact = await ctx.db.get(args.contactId);
			if (!contact || contact.deletedAt) throw new Error('Contact introuvable.');
			if (!(await canWriteForContact(ctx, user, contact))) throw new Error('Non autorisé.');
		}

		const id = await ctx.db.insert('documents', {
			name,
			storageId: args.storageId,
			...(args.mimeType ? { mimeType: args.mimeType } : {}),
			...(args.size !== undefined ? { size: args.size } : {}),
			category: args.category,
			...(args.contactId ? { contactId: args.contactId } : {}),
			...(args.venteId ? { venteId: args.venteId } : {}),
			...(args.devisId ? { devisId: args.devisId } : {}),
			uploadedBy: user._id,
			uploadedAt: Date.now()
		});
		return id;
	}
});

export const listForContact = query({
	args: { contactId: v.id('contacts') },
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		const contact = await ctx.db.get(args.contactId);
		if (!contact) return [];
		if (!(await canWriteForContact(ctx, user, contact))) {
			throw new Error('Non autorisé.');
		}
		const documents = await ctx.db
			.query('documents')
			.withIndex('by_contact', (q) => q.eq('contactId', args.contactId))
			.collect();
		return Promise.all(
			documents
				.filter((d) => !d.deletedAt)
				.map(async (d) => ({
					...d,
					url: await ctx.storage.getUrl(d.storageId)
				}))
		);
	}
});

export const remove = mutation({
	args: { documentId: v.id('documents') },
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		const doc = await ctx.db.get(args.documentId);
		if (!doc) return;
		const contact = doc.contactId ? await ctx.db.get(doc.contactId) : null;
		if (doc.uploadedBy !== user._id && !canManageEmployes(user)) {
			if (!(await canWriteForContact(ctx, user, contact))) {
				throw new Error('Non autorisé.');
			}
		}
		await ctx.db.patch(args.documentId, { deletedAt: Date.now() });
	}
});
