import { query, type QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { getCurrentUser, isAdmin, isZoneManager } from './permissions';

// Rôles qui ont une vue « équipe/agence » sur le CRM (tous les contacts, clients
// et ventes du périmètre), par opposition aux commerciaux qui ne voient que les
// leurs. L'animateur de zone voit son agence comme le directeur d'agence.
export const CRM_MANAGER_ROLES = [
	'animateur de zone',
	'animateur', // ancien libellé (alias) en attendant la migration
	"directeur d'agence",
	'directeur de zone',
	'administrateur'
] as const;

export function canViewAllCrm(user: Doc<'users'>): boolean {
	return !!user.role && (CRM_MANAGER_ROLES as readonly string[]).includes(user.role);
}

function userName(u: { firstName?: string; lastName?: string; email?: string }): string {
	return `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email || 'Commercial';
}

/**
 * Agences visibles pour le CRM par l'utilisateur connecté.
 * @returns un Set d'ids d'agences, ou `null` = toutes les agences (admin).
 * - administrateur : toutes.
 * - directeur de zone : toutes les agences de sa zone.
 * - animateur / directeur d'agence / commercial : son agence.
 */ export async function visibleAgencyIds(
	ctx: QueryCtx,
	user: Doc<'users'>
): Promise<Set<Id<'agences'>> | null> {
	// Admin et directeur de zone : mêmes droits — vue sur toutes les agences.
	if (isAdmin(user)) return null;

	if (user.role === 'directeur de zone') {
		// Zone du directeur : champ `zone` du profil, sinon celle de son agence.
		let zone = (user as Doc<'users'>).zone ?? undefined;
		if (!zone && user.agencyId) {
			const agence = await ctx.db.get(user.agencyId);
			zone = agence?.zone ?? undefined;
		}
		if (zone) {
			const agences = await ctx.db
				.query('agences')
				.withIndex('by_zone', (q) => q.eq('zone', zone))
				.collect();
			const set = new Set<Id<'agences'>>();
			for (const a of agences) set.add(a._id);
			return set;
		}
		const fallback = new Set<Id<'agences'>>();
		if (user.agencyId) fallback.add(user.agencyId);
		return fallback;
	}

	const set = new Set<Id<'agences'>>();
	if (user.agencyId) set.add(user.agencyId);
	return set;
}

/** Personne (utilisateur) visible dans le périmètre CRM de l'utilisateur connecté. */
export async function isUserInScope(
	ctx: QueryCtx,
	user: Doc<'users'>,
	targetId: Id<'users'>
): Promise<boolean> {
	const target = await ctx.db.get(targetId);
	if (!target) return false;
	if (!canViewAllCrm(user)) return targetId === user._id;
	if (!target.agencyId) return false;
	const agencyIds = await visibleAgencyIds(ctx, user);
	if (agencyIds === null) return true;
	return agencyIds.has(target.agencyId as Id<'agences'>);
}

// Personnes affichées dans les onglets « par personne » du CRM : les utilisateurs
// actifs rattachés à une agence du périmètre. Pour un commercial, uniquement lui.
export const listPeople = query({
	args: {},
	handler: async (ctx) => {
		const user = await getCurrentUser(ctx);

		if (!canViewAllCrm(user)) {
			return [
				{
					_id: user._id,
					firstName: user.firstName ?? '',
					lastName: user.lastName ?? '',
					name: userName(user),
					photo: user.photo ?? null,
					isMe: true
				}
			];
		}

		const agencyIds = await visibleAgencyIds(ctx, user);
		const users = await ctx.db.query('users').collect();
		return users
			.filter((u) => {
				if (u.statut === 'viré') return false;
				if (!u.agencyId) return false;
				// Superviseurs de zone (animateur, directeur de zone) : exclus des
				// onglets par personne — même rattachés à un RDV, ils n'apparaissent
				// ni dans les tabs du bilan ni dans la progression.
				if (isZoneManager(u)) return false;
				if (agencyIds === null) return true;
				return agencyIds.has(u.agencyId as Id<'agences'>);
			})
			.map((u) => ({
				_id: u._id,
				firstName: u.firstName ?? '',
				lastName: u.lastName ?? '',
				name: userName(u),
				photo: u.photo ?? null,
				isMe: u._id === user._id
			}))
			.sort((a, b) => (a.isMe ? -1 : b.isMe ? 1 : a.name.localeCompare(b.name)));
	}
});
