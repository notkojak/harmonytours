import { mutation, query, type QueryCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { v } from 'convex/values';
import { getCurrentUser, isAnimateurZone } from './permissions';
import { canViewAllCrm, isUserInScope } from './access';

// Arbres de progression (gamification). Chaque arbre est un parcours avec ses
// propres étapes, du bas (premier élément) vers le haut. Le parcours
// d'intégration (4 étapes) précède la tram de prospection (7 étapes).
export const TREES = [
	{
		key: 'integration',
		label: "Parcours d'intégration",
		steps: [
			{ key: 'integration', label: 'Intégration' },
			{ key: 'qualification', label: 'Points de qualification' },
			{ key: 'decouverte', label: 'Points de découverte' },
			{ key: 'baseline', label: 'Produits du catalogue' }
		]
	},
	{
		key: 'tram',
		label: 'Tram de prospection',
		steps: [
			{ key: 'ambiance', label: 'Ambiance' },
			{ key: 'presentation', label: 'Présentation' },
			{ key: 'decouverte', label: 'Découverte' },
			{ key: 'adresse', label: "Prise d'adresse" },
			{ key: 'prix', label: 'Notion de prix' },
			{ key: 'rdv', label: 'Prise de RDV' },
			{ key: 'confirmation', label: 'Confirmation' }
		]
	},
	{
		key: 'attitude',
		label: 'Attitude',
		steps: [
			{ key: 'ciblage', label: 'Ciblage de secteurs' },
			{ key: 'porte', label: 'Attitude devant une porte' },
			{ key: 'client', label: 'Attitude devant un client' },
			{ key: 'gms', label: 'Attitude en GMS' }
		]
	},
	{
		key: 'performances',
		label: 'Performances',
		steps: [
			{ key: 'rdv15', label: '15 RDV en 1 mois' },
			{ key: 'ca15', label: '15 000 € de CA en 1 mois' },
			{ key: 'rdv30', label: '30 RDV en 1 mois' },
			{ key: 'ca30', label: '30 000 € de CA en 1 mois' }
		]
	}
] as const;

export type TreeKey = (typeof TREES)[number]['key'];

function treeDef(tree: string) {
	return TREES.find((t) => t.key === tree);
}

/**
 * Doc de progression d'un employé pour un arbre, avec repli sur les docs
 * créés avant l'ajout du champ `tree` (traités comme l'arbre d'intégration).
 */
async function findDoc(ctx: QueryCtx, userId: Id<'users'>, tree: string) {
	const doc = await ctx.db
		.query('progressions')
		.withIndex('by_user_tree', (q) => q.eq('userId', userId).eq('tree', tree))
		.first();
	if (doc) return doc;
	if (tree === 'integration') {
		const legacy = await ctx.db
			.query('progressions')
			.withIndex('by_user', (q) => q.eq('userId', userId))
			.first();
		if (legacy && !legacy.tree) return legacy;
	}
	return null;
}

/**
 * Progression d'un employé pour un arbre : la sienne pour un commercial, ou
 * celle d'un employé du périmètre pour un manager (onglets « par personne »).
 */
export const get = query({
	args: { userId: v.optional(v.id('users')), tree: v.optional(v.string()) },
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		const tree = args.tree ?? 'integration';
		if (!treeDef(tree)) {
			throw new Error('Arbre inconnu.');
		}
		const targetId = args.userId ?? user._id;
		if (targetId !== user._id && !canViewAllCrm(user)) {
			throw new Error('Non autorisé.');
		}
		if (targetId !== user._id && !(await isUserInScope(ctx, user, targetId))) {
			throw new Error('Non autorisé.');
		}
		const doc = await findDoc(ctx, targetId, tree);
		return { userId: targetId, tree, validated: doc?.validated ?? [] };
	}
});

/**
 * Valide (ou retire) une étape de l'arbre d'un employé du périmètre.
 * Réservé aux managers : animateur, directeur d'agence, directeur de zone,
 * administrateur. Clic = toggle (valide / dévalide).
 */
/**
 * Progressions de TOUS les arbres d'un employé en une seule requête (pour
 * afficher l'avancement de chaque catégorie dans les onglets).
 */
export const getAll = query({
	args: { userId: v.optional(v.id('users')) },
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		const targetId = args.userId ?? user._id;
		if (targetId !== user._id && !canViewAllCrm(user)) {
			throw new Error('Non autorisé.');
		}
		if (targetId !== user._id && !(await isUserInScope(ctx, user, targetId))) {
			throw new Error('Non autorisé.');
		}
		const docs = await ctx.db
			.query('progressions')
			.withIndex('by_user', (q) => q.eq('userId', targetId))
			.collect();
		const byTree = new Map<string, string[]>();
		for (const d of docs) {
			// Docs créés avant l'ajout du champ `tree` : traités comme intégration.
			byTree.set(d.tree ?? 'integration', d.validated);
		}
		return TREES.map((t) => ({ tree: t.key, validated: byTree.get(t.key) ?? [] }));
	}
});

export const toggle = mutation({
	args: { userId: v.id('users'), tree: v.string(), step: v.string() },
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		if (!canViewAllCrm(user)) {
			throw new Error('Réservé aux managers.');
		}
		// L'animateur de zone visualise la progression mais ne peut pas la valider.
		if (isAnimateurZone(user.role)) {
			throw new Error("L'animateur de zone ne peut pas valider les étapes.");
		}
		if (!(await isUserInScope(ctx, user, args.userId))) {
			throw new Error('Non autorisé.');
		}
		const tree = treeDef(args.tree);
		if (!tree) {
			throw new Error('Arbre inconnu.');
		}
		if (!tree.steps.some((s) => s.key === args.step)) {
			throw new Error('Étape inconnue.');
		}
		const existing = await findDoc(ctx, args.userId, args.tree);
		const validated = new Set(existing?.validated ?? []);
		if (validated.has(args.step)) {
			validated.delete(args.step);
		} else {
			validated.add(args.step);
		}
		const values = [...validated];
		if (existing) {
			await ctx.db.patch(existing._id, {
				validated: values,
				tree: args.tree,
				updatedAt: Date.now()
			});
		} else {
			await ctx.db.insert('progressions', {
				userId: args.userId,
				tree: args.tree,
				validated: values,
				updatedAt: Date.now()
			});
		}
	}
});
