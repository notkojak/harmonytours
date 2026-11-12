// Commercial rattaché au RDV d'un contact.
//
// Le suivi courant (`followUp`) porte le nom du commercial tant que le RDV est
// en cours. Quand le RDV repasse en rappel, ce nom quitte le suivi mais reste
// tracé dans `rdvHistory` : on le reprend là, pour que la fiche continue de
// montrer qui suivait le rendez-vous au lieu de l'effacer.
type ContactAvecRdv = {
	followUp?: { type?: string | null; commercial?: string | null } | null;
	rdvHistory?:
		| ({ at: number; commercial?: string | null } | { at: number } | number)[]
		| null;
};

export function commercialRattache(contact: ContactAvecRdv | null | undefined): string | null {
	const direct = contact?.followUp?.commercial?.trim();
	if (direct) return direct;
	if (contact?.followUp?.type !== 'rappel') return null;
	const history = contact.rdvHistory ?? [];
	for (let i = history.length - 1; i >= 0; i--) {
		const entree = history[i];
		const nom =
			typeof entree === 'object' ? ((entree as { commercial?: string | null }).commercial ?? '').trim() : '';
		if (nom) return nom;
	}
	return null;
}

// Noms des commerciaux liés à un client : le binôme (créateur du contact +
// commercial rattaché au RDV), sans doublons. Les vendeurs des ventes ne sont
// plus agrégés ici : chaque vente affiche son propre binôme (deux personnes
// maximum), sinon un client vendu par deux binômes différents finissait avec
// trois noms sur la fiche.
export function commerciauxLies(
	base: string | null | undefined,
	contact: ContactAvecRdv | null | undefined,
	vendeurs: (string | null | undefined)[] = []
): string[] {
	const noms = new Set<string>();
	if (base) noms.add(base);
	const rattache = commercialRattache(contact);
	if (rattache) noms.add(rattache);
	for (const v of vendeurs) if (v) noms.add(v);
	return [...noms];
}

// Binôme affiché pour un client : celui de sa vente la plus récente. Une vente
// porte un binôme de deux personnes maximum ; plusieurs ventes peuvent avoir
// des binômes différents, on n'en mélange pas les membres sur une même ligne.
export function binomeClient(
	base: string | null | undefined,
	contact: ContactAvecRdv | null | undefined,
	ventes: { date?: number | null; binomeNames?: (string | null)[] | null }[]
): string[] {
	const derniere = [...ventes].sort((a, b) => (b.date ?? 0) - (a.date ?? 0))[0];
	const noms = (derniere?.binomeNames ?? []).filter((nom): nom is string => !!nom);
	if (noms.length > 0) return [...new Set(noms)];
	return commerciauxLies(base, contact);
}
