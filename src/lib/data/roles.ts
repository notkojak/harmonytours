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

export function capitalizeRole(role: string | null | undefined): string {
	if (!role) return '';
	return role.charAt(0).toUpperCase() + role.slice(1);
}
