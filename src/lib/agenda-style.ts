// Palette unique de l'agenda — types d'événement, statuts de RDV et créneaux
// fixes — alignée sur la charte bravaux.fr : bleu de marque, encre et neutres,
// rouge de la charte pour l'annulation. Partagée par la page Agenda, son aperçu
// et le planning du tableau de bord pour qu'une même puce ait le même aspect
// partout (avant, chacun avait sa copie en violet / jaune / rose).

export const EVENT_EMOJI: Record<string, string> = {
	réunion: '👨‍🏫',
	formation: '🎓',
	prospection: '🔎',
	gestion: '📁'
};

export const EVENT_TYPE_LABEL: Record<string, string> = {
	réunion: 'Réunion',
	formation: 'Formation',
	prospection: 'Prospection',
	gestion: 'Gestion dossier'
};

// Réunion : bleu de marque (rendez-vous collectif). Formation : bleu plus dense
// (l'événement occupe la journée). Prospection : encre (sortie terrain).
// Gestion dossier : neutre (tâche administrative).
export const EVENT_STYLE: Record<string, string> = {
	réunion:
		'bg-brand/12 text-brand hover:bg-brand/20 light:bg-brand/10 light:text-ink light:hover:bg-brand/18',
	formation:
		'bg-brand/22 text-brand hover:bg-brand/30 light:bg-brand/18 light:text-ink light:hover:bg-brand/26',
	prospection: 'bg-ink/10 text-ink-soft hover:bg-ink/16 light:text-ink light:hover:bg-ink/14',
	gestion: 'bg-glass-2 text-muted-foreground hover:bg-glass-3'
};

// Créneau fixe « Réunion » (lundi et vendredi matin) : non déplaçable. Un
// anneau plutôt qu'une bordure, pour que la puce garde exactement la même
// hauteur que les RDV voisins.
export const REUNION_FIXED_SLOT =
	'bg-brand/10 text-brand ring-1 ring-brand/40 ring-inset light:text-ink';

const RDV_NEUTRAL = 'bg-glass-2 text-muted-foreground hover:bg-glass-3';
const RDV_PENDING =
	'bg-brand/15 text-brand hover:bg-brand/25 light:bg-brand/12 light:text-ink light:hover:bg-brand/20';
const RDV_SOLD = 'bg-brand text-white hover:bg-brand/85';
const RDV_CANCELLED =
	'bg-destructive/10 text-destructive line-through hover:bg-destructive/16 light:bg-destructive/8 light:hover:bg-destructive/14';
// RDV à replacer : orange, la couleur d'alerte déjà utilisée pour les erreurs.
const RDV_RESCHEDULE =
	'bg-orange-500/15 text-orange-700 hover:bg-orange-500/25 dark:text-orange-300';

// Statut du RDV : bleu (programmé), neutre (déballé, ou confortation / gestion
// dossier encore programmés), rouge barré (annulé), bleu plein (vendu).
export function rdvStatusClass(
	status: string | null | undefined,
	motif?: string | null | undefined
): string {
	if (status === 'annulé') return RDV_CANCELLED;
	if (status === 'à reprogrammer') return RDV_RESCHEDULE;
	if (status === 'vendu') return RDV_SOLD;
	if (status === 'déballé' || motif === 'confortation' || motif === 'gestion') return RDV_NEUTRAL;
	return RDV_PENDING;
}

// Même code couleur en pointillés : l'ombre affichée pendant un glisser-déposer.
export function rdvGhostClass(
	status: string | null | undefined,
	motif?: string | null | undefined
): string {
	if (status === 'annulé') {
		return 'border-destructive/60 bg-destructive/8 text-destructive/70 light:bg-destructive/6 light:text-destructive/80';
	}
	if (status === 'à reprogrammer')
		return 'border-orange-500/60 bg-orange-500/10 text-orange-700 dark:text-orange-300';
	if (status === 'vendu') return 'border-brand bg-brand/20 text-brand light:text-ink';
	if (status === 'déballé' || motif === 'confortation' || motif === 'gestion') {
		return 'border-line-strong bg-glass-1 text-muted-foreground';
	}
	return 'border-brand/60 bg-brand/10 text-brand light:text-ink';
}

export function rdvStatusLabel(
	status: string | null | undefined,
	motif?: string | null | undefined
): string {
	if (status === 'déballé') return 'Déballé';
	if (status === 'à reprogrammer') return 'À reprogrammer';
	if (status === 'annulé') return 'Annulé';
	if (status === 'vendu') return 'Vendu';
	if (motif === 'confortation') return 'Confortation';
	if (motif === 'gestion') return 'Gestion dossier';
	return 'Programmé';
}
