import { getAuthUserId } from '@convex-dev/auth/server';
import type { Doc } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';

export const ROLE_ADMIN = 'administrateur';
export const ROLE_ZONE = 'directeur de zone';
export const ROLE_AGENCE = "directeur d'agence";
export const ROLE_ANIMATEUR_ZONE = 'animateur de zone';

/**
 * Superviseurs de zone : exclus du tableau de stats (sauf s'ils ont du CA),
 * des onglets du bilan et de la liste de progression.
 */
export const ZONE_MANAGER_ROLES = [ROLE_ANIMATEUR_ZONE, ROLE_ZONE];

// L'ancien libellé « animateur » reste accepté comme alias d'« animateur de zone »
// tant que la migration migrateAnimateurRole n'a pas renommé les comptes existants.
export function isAnimateurZone(role: string | null | undefined): boolean {
	return role === ROLE_ANIMATEUR_ZONE || role === 'animateur';
}

export function isZoneManager(user: Doc<'users'>): boolean {
	return isAnimateurZone(user.role ?? '') || user.role === ROLE_ZONE;
}

/**
 * Renvoie l'utilisateur connecté et refuse l'accès si son compte est bloqué.
 */
export async function getCurrentUser(ctx: QueryCtx | MutationCtx): Promise<Doc<'users'>> {
	const userId = await getAuthUserId(ctx);
	if (userId === null) {
		throw new Error('Non connecté.');
	}
	const user = await ctx.db.get(userId);
	if (!user) {
		throw new Error('Utilisateur introuvable.');
	}
	if (user.statut === 'viré') {
		throw new Error('Accès bloqué.');
	}
	return user;
}

/**
 * Qui peut corriger « qui a pris le contact » (le commercial créateur) :
 * l'administrateur, le directeur de zone et le directeur d'agence — ni
 * l'animateur, ni le commercial qui a créé le contact.
 */
export function canReassignContact(user: Doc<'users'>): boolean {
	return user.role === ROLE_ADMIN || user.role === ROLE_ZONE || user.role === ROLE_AGENCE;
}

/**
 * Admin et directeur de zone : mêmes droits (gestion des agences, employés,
 * objectifs, événements, vue sur tout le périmètre).
 */
export function isAdmin(user: Doc<'users'>): boolean {
	return user.role === ROLE_ADMIN || user.role === ROLE_ZONE;
}

/** Admin, directeur de zone et directeur d'agence gèrent les employés. */
export function canManageEmployes(user: Doc<'users'>): boolean {
	return isAdmin(user) || user.role === ROLE_AGENCE;
}

/** Création d'événements d'agenda : admin/zone, animateur de zone et directeur d'agence. */
export function canManageEvenements(user: Doc<'users'>): boolean {
	return isAdmin(user) || isAnimateurZone(user.role) || user.role === ROLE_AGENCE;
}

/**
 * Un directeur d'agence ne gère que son agence ; admin et directeur de zone
 * gèrent toutes les agences.
 */
export function canManageAgency(
	user: Doc<'users'>,
	agence: Doc<'agences'> | null | undefined
): boolean {
	if (user.role === ROLE_ADMIN || user.role === ROLE_ZONE) {
		return true;
	}
	if (user.role === ROLE_AGENCE) {
		return !!agence && user.agencyId === agence._id;
	}
	return false;
}
