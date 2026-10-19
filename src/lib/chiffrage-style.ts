// Palette du chiffrage, alignée sur la charte bravaux.fr : le bleu de marque,
// l'encre et ses neutres, le rouge de la charte pour ce qui bloque. Le module
// existe parce que les écrans de chiffrage parlaient trois langues à la fois
// — indigo / ciel pour les actions, ambre pour l'attention, émeraude pour la
// réussite — alors que le reste de l'application n'en parle qu'une.
//
// Règle de lecture : le bleu veut dire « acquis, validé, dans le périmètre »,
// le rouge « bloque, à corriger, hors périmètre », l'encre « neutre ».
//
// La charte ne se limite pas aux couleurs : les FORMES comptent autant. Trois
// règles, valables dans tous les écrans de chiffrage :
//   1. un bouton d'action passe par le composant `Button` de l'application
//      (pilule, 13 px gras, majuscules espacées, focus bleu). On ne recopie
//      pas sa forme à la main ;
//   2. un champ écrit à la main (parce qu'il vit dans une grille ou un
//      compteur) reçoit le focus de marque `FOCUS_CHAMP`, le même que `Input` ;
//   3. les ombres passent par les jetons `--ombre` / `--ombre-forte`.

/** Remplissage plein d'un marqueur ou d'une pastille acquise. */
export const SUCCES_PLEIN = 'bg-brand text-white';

/** Cadre et fond d'un bloc « c'est fait / c'est bon ». */
export const CARTE_SUCCES = 'border-brand/45 bg-brand/10';

/** Texte d'un état acquis (titre d'un bloc de réussite, coche). */
export const TEXTE_SUCCES = 'text-brand';

/** Cadre et fond d'un bloc qui bloque ou sort du périmètre. */
export const CARTE_ALERTE = 'border-destructive/45 bg-destructive/10';

/** Texte d'une alerte : signature manquante, adresse introuvable, hors seuil. */
export const TEXTE_ALERTE = 'text-destructive';

/**
 * Couleur d'une action principale. La forme vient du composant `Button` : ces
 * trois classes ne servent qu'aux rares boutons dont la mise en page impose la
 * silhouette (pleine largeur d'une carte, pilule maison).
 */
export const CTA = 'bg-primary text-primary-foreground hover:bg-primary/85';

/** La même action, tant qu'elle n'est pas disponible : éteinte, jamais cachée. */
export const CTA_MUET = 'cursor-not-allowed bg-glass-2 text-ink-mute';

/**
 * Focus de marque d'un champ écrit à la main : bordure bleue + halo bleu.
 * C'est le contrat du champ bravaux.fr, identique à `$lib/components/ui/input`.
 */
export const FOCUS_CHAMP =
	'outline-none transition-[border-color,box-shadow] focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-brand/15';

/** Le bleu de marque et son ombre, pour ce qui doit être peint en JS (Mapbox). */
export const BLEU_MARQUE = '#24a2b3';
export const OMBRE_BLEUE = 'rgba(36, 162, 179, 0.45)';
