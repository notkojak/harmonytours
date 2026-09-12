export const roles = [
	'administrateur',
	'directeur de zone',
	'animateur de zone',
	"directeur d'agence",
	"animateur d'équipe",
	'commercial'
] as const;

export type Role = (typeof roles)[number];

export const ADMIN_ROLES = ['administrateur', 'directeur de zone', "directeur d'agence"] as const;

export function canAccessAdministration(role: string | null | undefined): boolean {
	return !!role && (ADMIN_ROLES as readonly string[]).includes(role);
}

/**
 * Qui peut corriger « qui a pris le contact » : l'administrateur, le directeur
 * de zone et le directeur d'agence (même règle que côté serveur, permissions.ts).
 */
export const REASSIGN_ROLES = [
	'administrateur',
	'directeur de zone',
	"directeur d'agence"
] as const;

export function canReassignContact(role: string | null | undefined): boolean {
	return !!role && (REASSIGN_ROLES as readonly string[]).includes(role);
}

export function capitalizeRole(role: string | null | undefined): string {
	if (!role) return '';
	return role.charAt(0).toUpperCase() + role.slice(1);
}
