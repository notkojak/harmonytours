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
// commercial rattaché au RDV) et les vendeurs des ventes, sans doublons.
export function commerciauxLies(
	base: string | null | undefined,
	contact: ContactAvecRdv | null | undefined,
	vendeurs: (string | null | undefined)[]
): string[] {
	const noms = new Set<string>();
	if (base) noms.add(base);
	const rattache = commercialRattache(contact);
	if (rattache) noms.add(rattache);
	for (const v of vendeurs) if (v) noms.add(v);
	return [...noms];
}
