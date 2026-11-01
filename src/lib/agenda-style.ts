// Palette de l'agenda : chaque famille d'événement a sa teinte, pour se
// repérer d'un coup d'œil dans la semaine et le mois (vue claire et sombre).

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

// Teintes de base : un fond translucide et une encre de la même famille, sans
// contour. Le hover éclaircit légèrement le bloc.
const VIOLET =
	'bg-violet-500/15 text-violet-700 hover:bg-violet-500/25 dark:bg-violet-400/15 dark:text-violet-200';
const EMERAUDE =
	'bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:bg-emerald-400/15 dark:text-emerald-200';
const AMBRE =
	'bg-amber-500/20 text-amber-800 hover:bg-amber-500/30 dark:bg-amber-400/15 dark:text-amber-200';
const CIEL =
	'bg-sky-500/15 text-sky-700 hover:bg-sky-500/25 dark:bg-sky-400/15 dark:text-sky-200';
const ORANGE =
	'bg-orange-500/15 text-orange-700 hover:bg-orange-500/25 dark:bg-orange-400/15 dark:text-orange-200';
const INDIGO =
	'bg-indigo-500/15 text-indigo-700 hover:bg-indigo-500/25 dark:bg-indigo-400/15 dark:text-indigo-200';
const FUCHSIA =
	'bg-fuchsia-500/15 text-fuchsia-700 hover:bg-fuchsia-500/25 dark:bg-fuchsia-400/15 dark:text-fuchsia-200';
const NEUTRE =
	'bg-slate-500/12 text-slate-700 hover:bg-slate-500/20 dark:bg-slate-400/15 dark:text-slate-200';
const ROUGE =
	'bg-red-500/12 text-red-700 hover:bg-red-500/20 dark:bg-red-400/15 dark:text-red-300';
const BRAND = 'bg-brand/15 text-brand hover:bg-brand/22';

// Type d'événement : violet réunion, vert formation, ambre prospection,
// bleu gestion de dossier.
export const EVENT_STYLE: Record<string, string> = {
	réunion: VIOLET,
	formation: EMERAUDE,
	prospection: AMBRE,
	gestion: CIEL
};

// Créneau fixe « Réunion » (lundi et vendredi matin) : même teinte que les
// réunions posées à la main.
export const REUNION_FIXED_SLOT = VIOLET;

// Dates de pose : orange, pour ne pas les confondre avec une gestion de dossier.
export const DATE_POSE_STYLE = ORANGE;

// RDV de confortation : il s'annonce dans l'agenda comme une date de pose, avec
// son intitulé (« Confortation · client ») en plus de sa teinte.
export const CONFORTATION_EMOJI = '✓';

export function rdvBlockTitle(name: string, motif?: string | null | undefined): string {
	return motif === 'confortation' ? `Confortation · ${name}` : name;
}

// Statut du RDV : la couleur porte l'avancement (programmé, déballé, vendu…),
// la confortation et la gestion de dossier ont leur propre teinte.
export function rdvStatusClass(
	status: string | null | undefined,
	motif?: string | null | undefined
): string {
	if (status === 'annulé') return `${ROUGE} line-through opacity-80`;
	if (status === 'vendu') return EMERAUDE;
	if (status === 'déballé') return INDIGO;
	if (status === 'à reprogrammer') return AMBRE;
	if (motif === 'confortation') return FUCHSIA;
	if (motif === 'gestion') return NEUTRE;
	return BRAND;
}

// Même aspect en pointillés : l'ombre affichée pendant un glisser-déposer.
export function rdvGhostClass(
	status: string | null | undefined,
	motif?: string | null | undefined
): string {
	return `${rdvStatusClass(status, motif)} opacity-70 outline-1 outline-dashed outline-brand/60`;
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
