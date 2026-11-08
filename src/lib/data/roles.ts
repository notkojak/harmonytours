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
 * Vue Direction : managers de périmètre (l'animateur de zone voit les chiffres
 * de son agence, sans pouvoir administrer les comptes).
 */
export const PILOTAGE_ROLES = [
	'administrateur',
	'directeur de zone',
	'animateur de zone',
	"directeur d'agence"
] as const;

export function canViewPilotage(role: string | null | undefined): boolean {
	return !!role && (PILOTAGE_ROLES as readonly string[]).includes(role);
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

/**
 * Rôles qui peuvent ÉCRIRE dans le CRM (créer/modifier/supprimer contacts,
 * clients et ventes, changer un statut). Le commercial est en consultation
 * seule : il voit ses fiches et ses ventes, il ne les modifie pas.
 * Même liste que CRM_WRITE_ROLES côté serveur (convex/permissions.ts).
 */
export const CRM_WRITE_ROLES = [
	'administrateur',
	'directeur de zone',
	'animateur de zone',
	"directeur d'agence",
	"animateur d'équipe",
	'animateur'
] as const;

export function canWriteCrm(role: string | null | undefined): boolean {
	return !!role && (CRM_WRITE_ROLES as readonly string[]).includes(role);
}

/**
 * L'administrateur seul ouvre le regroupement de chantier depuis le chiffrage
 * (et donc le déblocage d'une place par le responsable des poses).
 */
export function isAdministrateur(role: string | null | undefined): boolean {
	return role === 'administrateur';
}

export function capitalizeRole(role: string | null | undefined): string {
	if (!role) return '';
	return role.charAt(0).toUpperCase() + role.slice(1);
}
