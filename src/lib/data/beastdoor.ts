// Helpers métier pour le bilan de prospection (portes importées depuis
// l'app mobile BeastDoor). Statuts et couleurs miroirs de l'app mobile pour
// rester cohérents avec la carte et le tableau de bord BeastDoor.

export type PorteRow = {
	id: string;
	label: string;
	street?: string | null;
	postalCode?: string | null;
	city: string;
	latitude?: number | null;
	longitude?: number | null;
	status?: string | null;
	notes?: string | null;
	contactName?: string | null;
	phone?: string | null;
	email?: string | null;
	createdAt: number;
	updatedAt: number;
	deletedAt?: number | null;
};

export type VisiteRow = {
	id: string;
	addressId: string;
	status?: string | null;
	note?: string | null;
	productType?: string | null;
	revenueCents?: number | null;
	splitWithPartner?: boolean | null;
	source?: string | null;
	score?: number | null;
	visitedAt: number;
	createdAt: number;
	updatedAt: number;
	deletedAt?: number | null;
};

// Statuts porte à porte (messages de l'app BeastDoor).
export type DoorStatus =
	| 'refus' // Traité
	| 'non_present' // Non présent
	| 'etude' // Catalogue
	| 'deballe' // Déballe
	| 'rdv' // RDV
	| 'contact' // Contact
	| 'vente' // Vente
	| 'vente_echouee'; // Vente annulée

const STATUS_LABELS: Record<string, string> = {
	refus: 'Traité',
	non_present: 'Non présent',
	etude: 'Catalogue',
	deballe: 'Déballe',
	rdv: 'RDV',
	contact: 'Contact',
	vente: 'Vente',
	vente_echouee: 'Vente annulée'
};

const STATUS_COLORS: Record<string, { dot: string; badge: string }> = {
	refus: { dot: 'bg-red-400', badge: 'bg-red-500/15 text-red-400' },
	non_present: { dot: 'bg-blue-400', badge: 'bg-blue-500/15 text-blue-400' },
	etude: { dot: 'bg-emerald-400', badge: 'bg-emerald-500/15 text-emerald-400' },
	deballe: { dot: 'bg-amber-400', badge: 'bg-amber-500/15 text-amber-400' },
	rdv: { dot: 'bg-sky-400', badge: 'bg-sky-500/15 text-sky-400' },
	contact: { dot: 'bg-fuchsia-400', badge: 'bg-fuchsia-500/15 text-fuchsia-400' },
	vente: { dot: 'bg-green-400', badge: 'bg-green-500/15 text-green-400' },
	vente_echouee: { dot: 'bg-rose-400', badge: 'bg-rose-500/15 text-rose-400' }
};

// Couleur de la pastille (marqueur Mapbox) sur la carte du bilan.
const STATUS_PIN: Record<string, string> = {
	refus: '#ef4444', // rouge
	non_present: '#60a5fa', // bleu
	etude: '#34d399', // émeraude
	deballe: '#fbbf24', // ambre
	rdv: '#38bdf8', // sky
	contact: '#e879f9', // fuchsia
	vente: '#4ade80', // vert
	vente_echouee: '#fb7185' // rose
};

const STATUS_RGB: Record<string, string> = {
	refus: 'rgba(239,68,68,0.85)',
	non_present: 'rgba(96,165,250,0.85)',
	etude: 'rgba(52,211,153,0.85)',
	deballe: 'rgba(251,191,36,0.9)',
	rdv: 'rgba(56,189,248,0.85)',
	contact: 'rgba(232,121,249,0.9)',
	vente: 'rgba(74,222,128,0.9)',
	vente_echouee: 'rgba(251,113,133,0.9)'
};

export function doorStatusLabel(status: string | null | undefined): string {
	if (!status) return '—';
	return STATUS_LABELS[status] ?? status;
}

export function doorStatusDot(status: string | null | undefined): string {
	if (!status) return 'bg-glass-3';
	return STATUS_COLORS[status]?.dot ?? 'bg-glass-3';
}

export function doorStatusBadge(status: string | null | undefined): string {
	if (!status) return 'bg-glass-3 text-foreground';
	return STATUS_COLORS[status]?.badge ?? 'bg-glass-3 text-foreground';
}

export function doorStatusPin(status: string | null | undefined): string {
	if (!status) return '#94a3b8';
	return STATUS_PIN[status] ?? '#94a3b8';
}

export function doorStatusRgb(status: string | null | undefined): string {
	if (!status) return 'rgba(148,163,184,0.85)';
	return STATUS_RGB[status] ?? 'rgba(148,163,184,0.85)';
}

// Ordre d'affichage des lignes du bilan tap (même logique que le mobile).
// `key` = clé de l'agrégat (camelCase dans BilanStats / JourStat) ;
// `status` = statut BeastDoor (snake_case), utilisé pour le filtre et la couleur.
export const PIPELINE_ORDER: { key: string; status: string | null; label: string }[] = [
	{ key: 'portesSonnees', status: null, label: 'Portes sonnées' },
	{ key: 'nonPresent', status: 'non_present', label: 'Non présent' },
	{ key: 'refus', status: 'refus', label: 'Traité' },
	{ key: 'rdv', status: 'rdv', label: 'RDV' },
	{ key: 'contact', status: 'contact', label: 'Contact' }
];

export type JourStat = {
	date: string; // 'YYYY-MM-DD'
	sonnees: number;
	nonPresent: number;
	refus: number;
	rdv: number;
	contact: number;
	deballe: number;
	vente: number;
	etude: number;
	venteEchouee: number;
	caCents: number;
};

export type BilanStats = {
	portesSonnees: number;
	nonPresent: number;
	refus: number;
	rdv: number;
	contact: number;
	deballe: number;
	vente: number;
	etude: number;
	venteEchouee: number;
	caCents: number;
};

export function emptyBilan(): BilanStats {
	return {
		portesSonnees: 0,
		nonPresent: 0,
		refus: 0,
		rdv: 0,
		contact: 0,
		deballe: 0,
		vente: 0,
		etude: 0,
		venteEchouee: 0,
		caCents: 0
	};
}

function addStatus(b: BilanStats, status: string | null | undefined, ca?: number) {
	switch (status) {
		case 'non_present':
			b.nonPresent++;
			break;
		case 'refus':
			b.refus++;
			break;
		case 'rdv':
			b.rdv++;
			break;
		case 'contact':
			b.contact++;
			break;
		case 'deballe':
			b.deballe++;
			break;
		case 'vente':
			b.vente++;
			b.caCents += ca ?? 0;
			break;
		case 'etude':
			b.etude++;
			break;
		case 'vente_echouee':
			b.venteEchouee++;
			break;
	}
}

// Agrège les visites d'une liste sur une période [startISO, endISO[ (jours inclus).
export function bilanSurPeriode(
	visites: VisiteRow[],
	startISO: string,
	endISOExclusive: string
): BilanStats {
	const b = emptyBilan();
	const start = Date.parse(startISO);
	const end = Date.parse(endISOExclusive);
	for (const v of visites) {
		if (v.visitedAt < start || v.visitedAt >= end) continue;
		if (v.deletedAt != null) continue;
		b.portesSonnees++;
		addStatus(b, v.status, v.revenueCents ?? 0);
	}
	return b;
}

// Détail jour par jour couvrant tous les jours de [startISO, monthsEnd[.
// Les jours sans visite sont présentés avec des zéros (pour le tableau).
export function detailParJour(
	visites: VisiteRow[],
	startISO: string,
	endISOExclusive: string
): JourStat[] {
	const out: JourStat[] = [];
	let cursor = Date.parse(startISO);
	const end = Date.parse(endISOExclusive);
	const row = new Map<number, JourStat>();
	for (const v of visites) {
		if (v.visitedAt < cursor || v.visitedAt >= end) continue;
		if (v.deletedAt != null) continue;
		const day = new Date(v.visitedAt).getDate();
		let stat = row.get(day);
		if (!stat) {
			stat = {
				date: '',
				sonnees: 0,
				nonPresent: 0,
				refus: 0,
				rdv: 0,
				contact: 0,
				deballe: 0,
				vente: 0,
				etude: 0,
				venteEchouee: 0,
				caCents: 0
			};
			row.set(day, stat);
		}
		stat.sonnees++;
		switch (v.status) {
			case 'non_present':
				stat.nonPresent++;
				break;
			case 'refus':
				stat.refus++;
				break;
			case 'rdv':
				stat.rdv++;
				break;
			case 'contact':
				stat.contact++;
				break;
			case 'deballe':
				stat.deballe++;
				break;
			case 'vente':
				stat.vente++;
				stat.caCents += v.revenueCents ?? 0;
				break;
			case 'etude':
				stat.etude++;
				break;
			case 'vente_echouee':
				stat.venteEchouee++;
				break;
		}
	}

	const d = new Date(cursor);
	while (cursor < end) {
		const stat = row.get(d.getDate());
		out.push({
			date: d.toISOString().slice(0, 10),
			sonnees: stat?.sonnees ?? 0,
			nonPresent: stat?.nonPresent ?? 0,
			refus: stat?.refus ?? 0,
			rdv: stat?.rdv ?? 0,
			contact: stat?.contact ?? 0,
			deballe: stat?.deballe ?? 0,
			vente: stat?.vente ?? 0,
			etude: stat?.etude ?? 0,
			venteEchouee: stat?.venteEchouee ?? 0,
			caCents: stat?.caCents ?? 0
		});
		d.setDate(d.getDate() + 1);
		cursor = d.getTime();
	}
	return out;
}

export function dayStartISO(date: Date): string {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	return isoOf(d);
}

export function todayISO(): string {
	return isoOf(new Date());
}

function isoOf(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

export function addDaysISO(iso: string, days: number): string {
	const d = new Date(iso + 'T12:00:00');
	d.setDate(d.getDate() + days);
	return isoOf(d);
}

export function monthStartISO(iso: string): string {
	return iso.slice(0, 7) + '-01';
}

export function firstDayOfMonth(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

export function fmtEuros(cents: number): string {
	return (cents / 100).toLocaleString('fr-FR', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	});
}

// ---------------------------------------------------------------------------
// Bilan GMS (soigne la distinction avec le bilan « portes »)
// ---------------------------------------------------------------------------

// Compteur GMS quotidien (importé depuis la tablette) : salutations, flyers et
// questions posées sur les grandes surfaces, par jour.
export type GmsStatRow = {
	id: string;
	date: string; // 'YYYY-MM-DD'
	salutation: number;
	flyer: number;
	question: number;
	createdAt: number;
	updatedAt: number;
	deletedAt?: number | null;
};

export type GmsBilan = {
	salutation: number;
	flyer: number;
	question: number;
	// Dérivés des visites GMS (source = 'gms') : catalogues envoyés, contacts, RDV.
	catalogues: number;
	contact: number;
	rdv: number;
};

export function emptyGms(): GmsBilan {
	return { salutation: 0, flyer: 0, question: 0, catalogues: 0, contact: 0, rdv: 0 };
}

// Agrège les stats GMS de la période [startISO, endISOExclusive[. Les compteurs
// quotidiens (salutation/flyer/question) sont sommés jour par jour ; catalogues
// / contact / rdv sont comptés depuis les visites marquées source 'gms'.
export function bilangmsSurPeriode(
	gmsDaily: GmsStatRow[],
	visites: VisiteRow[],
	startISO: string,
	endISOExclusive: string
): GmsBilan {
	const b = emptyGms();
	const start = Date.parse(startISO);
	const end = Date.parse(endISOExclusive);
	for (const g of gmsDaily) {
		if (!g.date) continue;
		const t = Date.parse(g.date);
		if (t < start || t >= end) continue;
		if (g.deletedAt != null) continue;
		b.salutation += g.salutation;
		b.flyer += g.flyer;
		b.question += g.question;
	}
	for (const v of visites) {
		if (v.source !== 'gms') continue;
		if (v.visitedAt < start || v.visitedAt >= end) continue;
		if (v.deletedAt != null) continue;
		switch (v.status) {
			case 'etude':
				b.catalogues++;
				break;
			case 'contact':
				b.contact++;
				break;
			case 'rdv':
				b.rdv++;
				break;
		}
	}
	return b;
}