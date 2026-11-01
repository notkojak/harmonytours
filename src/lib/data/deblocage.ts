// DÉBLOCAGE D'UNE POSE — le regroupement présenté au client est complet.
//
// Aucune remise ne se décide seul chez le client : quand toutes les places du
// regroupement sont prises, on appelle le responsable des poses, il ouvre une
// place et dicte un code. Le taux de remise est porté par le code lui-même :
// le responsable ajoute 10 ou 20 à la fin de « 9FVR ».

/** Le responsable qu'on appelle quand le regroupement est complet. */
export const RESPONSABLE_POSES = {
	nom: 'Yannick Sahli',
	role: 'Responsable des poses',
	tel: '06 59 99 35 80',
	telLien: 'tel:+33659993580'
};

/** Base du code de déblocage (fictif) : le responsable y ajoute le taux. */
export const CODE_DEBLOCAGE = '9FVR';

/** Plafond du geste : un déblocage ne peut jamais porter plus. */
export const REMISE_MAX = 20;

/**
 * Taux de remise porté par le code saisi, ou null si le code n'est pas un code
 * de déblocage. Le code se dicte au téléphone : on ignore espaces, tirets et
 * casse, et le taux se lit dans les deux derniers chiffres.
 */
export function remiseDuCode(code: string): number | null {
	const propre = code.replace(/[\s-]/g, '').toUpperCase();
	if (!propre.startsWith(CODE_DEBLOCAGE)) return null;
	const taux = Number(propre.slice(CODE_DEBLOCAGE.length));
	return taux === 10 || taux === 20 ? taux : null;
}

/**
 * Ce qu'un déblocage laisse dans le devis : la remise obtenue et l'instant où
 * elle a été ouverte. C'est cette trace — et pas une saisie libre — qui
 * justifie la remise du devis.
 */
export type Deblocage = { remise: number; le: number };

const euro = new Intl.NumberFormat('fr-FR', {
	style: 'currency',
	currency: 'EUR',
	maximumFractionDigits: 0
});

/**
 * Message prêt à coller dans WhatsApp pour préparer une DO de regroupement.
 * Rien ne s'applique au devis : c'est une demande, pas une remise accordée.
 */
export function texteDemandeDo(o: { gamme: string; totalTTC: number; remise: number }): string {
	return [
		"==== DEMANDE D'OPPORTUNITÉ ====",
		`🏷️ Gamme produit : ${o.gamme}`,
		`💶 Prix de départ : ${euro.format(o.totalTTC)}`,
		`🎯 Remise souhaitée : ${o.remise} %`,
		`💰 Prix final : ${euro.format(o.totalTTC * (1 - o.remise / 100))}`,
		`📍 Type de DO : Place dans un regroupement`,
		'================================'
	].join('\n');
}
