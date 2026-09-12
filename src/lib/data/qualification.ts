// Questionnaire de qualification « Questions découverte » : rempli pendant
// l'échange commercial, sérialisé dans la note du contact (bloc « 🧠 Questions
// rapides ») et relisible à l'édition. Les valeurs sont pensées pour rester
// lisibles dans la note et re-parseables (voir parseQualification).

export type QualifAnswers = {
	foyer: string;
	habite: string;
	plait: '' | 'oui' | 'non';
	achat: string;
	achatDetail: string;
	metierMme: string;
	metierM: string;
	imposable: '' | 'oui' | 'non';
	chauffage: string;
	chauffageCout: string;
	connait: '' | 'oui' | 'non';
	concurrence: string;
	age: string;
	changer: string;
	pourQuand: string;
	// SONCAS (leviers d'achat) : plusieurs catégories sélectionnables.
	soncas: string[];
};

export const foyerOptions = ['1', '2', '3', '4', '5', '6+'];
export const habiteOptions = ['< 1 an', '1-5 ans', '5-10 ans', '10-20 ans', '+ 20 ans'];
export const achatOptions = ['Voiture', 'Rénovation', 'Électroménager', 'Voyage', 'Autre…'];
export const chauffageOptions = ['Électrique', 'Gaz', 'Fioul', 'Bois', 'PAC', 'Autre'];
export const concurrenceOptions = ['< 5 k€', '5-10 k€', '10-20 k€', '+ 20 k€'];
// Tranches d'âge jusqu'à 80+ (financement possible jusqu'à 80 ans et 11 mois).
export const ageOptions = [
	'18-25 ans',
	'25-35 ans',
	'35-45 ans',
	'45-55 ans',
	'55-65 ans',
	'65-70 ans',
	'70-80 ans',
	'80 ans et +'
];
export const pourQuandOptions = ['2 mois', '6 mois', '1 an', '2 ans', '10 ans'];

// SONCAS : les 7 leviers d'achat (Sécurité, Orgueil, Nouveauté, Confort,
// Argent, Sympathie, Environnement) — choix multiple dans le questionnaire.
export const soncasOptions = [
	{ lettre: 'S', label: 'Sécurité' },
	{ lettre: 'O', label: 'Orgueil' },
	{ lettre: 'N', label: 'Nouveauté' },
	{ lettre: 'C', label: 'Confort' },
	{ lettre: 'A', label: 'Argent' },
	{ lettre: 'S', label: 'Sympathie' },
	{ lettre: 'E', label: 'Environnement' }
];

export const BLOCK_TITLE = '🧠 Questions découverte';

// Ancien titre (notes existantes) : toujours lu, mais plus écrit.
export const LEGACY_BLOCK_TITLE = '🧠 Questions rapides';

function blockStart(lines: string[]): number {
	return lines.findIndex((l) => {
		const t = l.trim();
		return t.startsWith(BLOCK_TITLE) || t.startsWith(LEGACY_BLOCK_TITLE);
	});
}

export function initialQualification(): QualifAnswers {
	return {
		foyer: '',
		habite: '',
		plait: '',
		achat: '',
		achatDetail: '',
		metierMme: '',
		metierM: '',
		imposable: '',
		chauffage: '',
		chauffageCout: '',
		connait: '',
		concurrence: '',
		age: '',
		changer: '',
		pourQuand: '',
		soncas: []
	};
}

export function qualifAnswered(a: QualifAnswers): number {
	return [
		a.foyer,
		a.habite,
		a.plait,
		a.achat,
		a.metierMme,
		a.metierM,
		a.imposable,
		a.chauffage,
		a.connait,
		a.age,
		a.changer,
		a.connait === 'oui' ? a.concurrence : '',
		a.soncas.length > 0 ? '1' : ''
	].filter(Boolean).length;
}

// Réponses structurées stockées sur le contact (champ `qualif`) : plus de bloc
// dans la note. Les chaînes vides et les listes vides sont retirées.
export function toQualifDoc(a: QualifAnswers): Record<string, unknown> {
	const doc: Record<string, unknown> = {};
	const txt = (key: string, value: string) => {
		if (value.trim()) doc[key] = value.trim();
	};
	txt('foyer', a.foyer);
	txt('habite', a.habite);
	txt('plait', a.plait);
	txt('achat', a.achat);
	txt('achatDetail', a.achatDetail);
	txt('metierMme', a.metierMme);
	txt('metierM', a.metierM);
	txt('imposable', a.imposable);
	txt('chauffage', a.chauffage);
	txt('chauffageCout', a.chauffageCout);
	txt('connait', a.connait);
	txt('concurrence', a.concurrence);
	txt('age', a.age);
	txt('changer', a.changer);
	txt('pourQuand', a.pourQuand);
	if (a.soncas.length > 0) doc.soncas = [...a.soncas];
	return doc;
}

// Relit les réponses depuis le champ structuré du contact (inverse de toQualifDoc).
export function fromQualifDoc(doc: unknown): QualifAnswers | null {
	if (!doc || typeof doc !== 'object') return null;
	const d = doc as Record<string, unknown>;
	const s = (key: string): string => {
		const v = d[key];
		return typeof v === 'string' ? v : '';
	};
	const ouiNon = (key: string): '' | 'oui' | 'non' => {
		const v = s(key);
		return v === 'oui' || v === 'non' ? v : '';
	};
	return {
		foyer: s('foyer'),
		habite: s('habite'),
		plait: ouiNon('plait'),
		achat: s('achat'),
		achatDetail: s('achatDetail'),
		metierMme: s('metierMme'),
		metierM: s('metierM'),
		imposable: ouiNon('imposable'),
		chauffage: s('chauffage'),
		chauffageCout: s('chauffageCout'),
		connait: ouiNon('connait'),
		concurrence: s('concurrence'),
		age: s('age'),
		changer: s('changer'),
		pourQuand: s('pourQuand'),
		soncas: Array.isArray(d.soncas)
			? d.soncas.filter((x): x is string => typeof x === 'string')
			: []
	};
}

// Réponses du contact : champ structuré s'il existe, sinon relues depuis la note
// (ancien format « 🧠 Questions découverte ») pour les fiches déjà saisies.
export function contactQualif(contact: {
	qualif?: unknown;
	note?: string | null;
}): QualifAnswers | null {
	return fromQualifDoc(contact.qualif) ?? parseQualification(contact.note ?? '');
}

// Libellé du foyer pour l'affichage : « 1 personne », « 3 personnes »,
// « 6+ personnes ». Jamais « 3 pers. » ni « 3 personne(s) ».
export function foyerLabel(value: string | number): string {
	const v = String(value).trim();
	return v === '1' ? '1 personne' : `${v} personnes`;
}

// Sérialise les réponses en un bloc lisible, prêt à être ajouté à la note.
export function answersToNote(a: QualifAnswers): string {
	const lines: string[] = [];
	if (a.foyer) lines.push(`👥 Foyer : ${foyerLabel(a.foyer)}`);
	if (a.habite) lines.push(`🏠 Habitent ici depuis ${a.habite}`);
	if (a.plait)
		lines.push(a.plait === 'oui' ? '😊 Se plaisent chez eux' : "😕 N'aiment pas leur logement");
	if (a.achat) {
		let v = a.achat;
		if ((a.achat === 'Rénovation' || a.achat === 'Autre…') && a.achatDetail.trim()) {
			v = `${a.achat} (${a.achatDetail.trim()})`;
		}
		lines.push(`🛒 Dernier investissement : ${v}`);
	}
	if (a.metierMme.trim()) lines.push(`💼 Métier madame : ${a.metierMme.trim()}`);
	if (a.metierM.trim()) lines.push(`💼 Métier monsieur : ${a.metierM.trim()}`);
	if (a.imposable) lines.push(`🧾 ${a.imposable === 'oui' ? 'Imposable' : 'Non imposable'}`);
	if (a.chauffage) {
		let v = `🔥 Chauffage : ${a.chauffage}`;
		if (a.chauffageCout.trim()) v += ` — ${a.chauffageCout.trim()} €/mois`;
		lines.push(v);
	}
	if (a.connait)
		lines.push(
			a.connait === 'oui'
				? '🎯 Connaît le produit / a déjà vu la concurrence'
				: '🎯 Ne connaît pas le produit'
		);
	if (a.connait === 'oui' && a.concurrence) lines.push(`💶 Concurrence : ${a.concurrence}`);
	if (a.age) lines.push(`🎂 ${a.age}`);
	if (a.changer) {
		let v = `🛠️ Veut changer : ${a.changer}`;
		if (a.pourQuand) v += ` — pour quand : ${a.pourQuand}`;
		lines.push(v);
	}
	if (a.soncas.length > 0) lines.push(`🧲 SONCAS : ${a.soncas.join(', ')}`);
	if (lines.length === 0) return '';
	return `${BLOCK_TITLE}\n${lines.map((l) => `• ${l}`).join('\n')}`;
}

// Retire le bloc « Questions découverte » d'une note (il est généré en fin de note).
export function stripQualificationBlock(note: string): string {
	if (!note) return '';
	const lines = note.split('\n');
	const start = blockStart(lines);
	if (start === -1) return note;
	// Le bloc est toujours en fin de note : on coupe à partir de sa première
	// ligne, en retirant aussi la ligne vide qui le précédait.
	return lines
		.slice(0, Math.max(0, start - 1))
		.join('\n')
		.replace(/\s+$/, '');
}

// Relit les réponses depuis une note existante. Renvoie null si aucun bloc.
export function parseQualification(note: string): QualifAnswers | null {
	if (!note) return null;
	const lines = note.split('\n').map((l) => l.trim());
	const start = blockStart(lines);
	if (start === -1) return null;
	const a = initialQualification();
	for (const raw of lines.slice(start + 1)) {
		const l = raw.replace(/^•\s*/, '').trim();
		if (!l) continue;
		let m: RegExpMatchArray | null;
		if (
			(m = l.match(/^👥 Foyer : (.+?) personnes?$/)) ||
			(m = l.match(/^👥 Foyer : (.+?) personne\(s\)$/)) ||
			(m = l.match(/^👥 Foyer : (.+?) pers\.$/))
		)
			a.foyer = m[1];
		else if ((m = l.match(/^🏠 Habitent ici depuis (.+)$/)) && habiteOptions.includes(m[1]))
			a.habite = m[1];
		else if (l.startsWith('😊')) a.plait = 'oui';
		else if (l.startsWith('😕')) a.plait = 'non';
		else if ((m = l.match(/^🛒 Dernier investissement : (.+)$/))) {
			const detail = m[1].match(/^(.+?) \((.+)\)$/);
			if (detail) {
				a.achat = detail[1];
				a.achatDetail = detail[2];
			} else {
				a.achat = achatOptions.includes(m[1]) ? m[1] : '';
			}
		} else if ((m = l.match(/^💼 Métier madame : (.+)$/))) a.metierMme = m[1];
		else if ((m = l.match(/^💼 Métier monsieur : (.+)$/))) a.metierM = m[1];
		// Ancien format (un seul métier) : on le garde côté monsieur.
		else if ((m = l.match(/^💼 Métier : (.+)$/))) a.metierM = m[1];
		else if (l === '🧾 Imposable') a.imposable = 'oui';
		else if (l === '🧾 Non imposable') a.imposable = 'non';
		else if ((m = l.match(/^🔥 Chauffage : (.+?)(?: — (.+?) €\/mois)?$/))) {
			a.chauffage = m[1];
			if (m[2]) a.chauffageCout = m[2];
		} else if (l.startsWith('🎯 Connaît')) a.connait = 'oui';
		else if (l.startsWith('🎯 Ne connaît')) a.connait = 'non';
		else if ((m = l.match(/^💶 Concurrence : (.+)$/))) a.concurrence = m[1];
		else if ((m = l.match(/^🎂 (.+)$/))) a.age = m[1];
		else if ((m = l.match(/^🛠️ Veut changer : (.+)$/))) {
			const parts = m[1].split(' — pour quand : ');
			a.changer = parts[0];
			a.pourQuand = parts[1] ?? '';
		} else if ((m = l.match(/^🧲 SONCAS : (.+)$/))) {
			const labels = soncasOptions.map((o) => o.label);
			a.soncas = m[1]
				.split(',')
				.map((s) => s.trim())
				.filter((s) => labels.includes(s));
		}
	}
	return a;
}
