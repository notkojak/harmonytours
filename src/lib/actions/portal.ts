// Action Svelte : déplace un nœud à la racine du document (sous <body>).
//
// Utilisée par les fiches imprimables : rendues dans l'arbre de l'application,
// elles seraient positionnées en absolu par rapport au premier ancêtre
// positionné (carte, dialogue, conteneur scrollable…), ce qui décalait la
// feuille vers le bas et faisait basculer le pied de page sur une 2ᵉ page.
// Sous <body>, la feuille repart toujours du coin supérieur gauche de la page
// imprimée, quel que soit l'endroit d'où l'impression est déclenchée.
export function portal(node: HTMLElement) {
	if (typeof document === 'undefined') return;
	document.body.appendChild(node);
}
