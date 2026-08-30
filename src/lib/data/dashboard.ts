export const navSections = [
	{
		label: 'Accueil',
		items: [
			{ label: 'Tableau de bord', icon: 'dashboard', href: '/' },
			{ label: 'Agenda', icon: 'calendar', href: '/agenda' }
		]
	},
	{
		label: 'Prospection',
		items: [
			{ label: 'Zones', icon: 'map', href: '/zones' },
			{ label: 'Bilan', icon: 'chart', href: '/bilan' }
		]
	},
	{
		label: 'Fichiers clients',
		items: [
			{ label: 'Clients', icon: 'users', href: '/clients' },
			{ label: 'Contacts', icon: 'contact', href: '/contacts' }
		]
	},
	{
		label: 'Formation',
		items: [
			{ label: 'Progression', icon: 'sprout', href: '/progression' },
			{ label: 'Books', icon: 'library', href: '/books' }
		]
	},
	{
		label: 'Gestion',
		items: [{ label: 'Administration', icon: 'shield', href: '/administration' }]
	}
];

export const quickLinks: { label: string; icon: string; href: string }[] = [];

export type Agence = {
	name: string;
	short: string;
	members: number;
};

export const agences: Agence[] = [
	{ name: 'Agence de Tours', short: 'Tours', members: 6 },
	{ name: 'Agence de Nantes', short: 'Nantes', members: 4 },
	{ name: 'Agence de Rennes', short: 'Rennes', members: 3 },
	{ name: 'Agence de Bordeaux', short: 'Bordeaux', members: 5 }
];

export const statTabs = ['Aujourd’hui', 'Hier', 'Ce mois-ci'];

export const statColumns = [
	'Token',
	'Clics',
	'Inscrits',
	'Essais',
	'Essais (€)',
	'Bills',
	'Bills (€)',
	'Upsell (€)',
	'Ribell (€)',
	'Impayés',
	'Total'
];

export const skeletonRows = [1, 2, 3, 4, 5];

export const rangeLabel = '23/08/2026 - 23/08/2026';

// --- Données d'exemple du tableau de bord (design) ---

export type TeamMember = {
	_id?: string;
	firstName: string;
	lastName: string;
	objectiveCa: number;
	objectiveRdv: number;
	rdvTap: number;
	rdvGms: number;
	total: number;
	rdvTraites: number;
	ventes: number;
	caPeriode: number;
	caErreur: number;
	caAnnulations: number;
	caTotal: number;
};

export type DayEvent = {
	time: string;
	label: string;
	type: 'tap' | 'gms' | 'autre';
};

export const dayEvents: DayEvent[] = [
	{ time: '08:00', label: 'Préparation de la journée', type: 'autre' },
	{ time: '09:00', label: 'RDV GMS — Carrefour', type: 'gms' },
	{ time: '10:30', label: 'RDV TAP — BNP Paribas', type: 'tap' },
	{ time: '12:00', label: 'Déjeuner', type: 'autre' },
	{ time: '14:00', label: 'RDV GMS — Leclerc', type: 'gms' },
	{ time: '15:30', label: 'RDV TAP — Société Générale', type: 'tap' },
	{ time: '17:00', label: 'Compte-rendu & relances', type: 'autre' }
];

export type ClientMonth = {
	name: string;
	company: string;
	amount: number;
	date: string;
};

export const clientsMonth: ClientMonth[] = [
	{ name: 'Marie Dupont', company: 'Boulangerie Dupont', amount: 2450, date: '03/08' },
	{ name: 'Jean Bernard', company: 'Garage Bernard', amount: 1890, date: '06/08' },
	{ name: 'Claire Petit', company: 'Cabinet Petit', amount: 3200, date: '11/08' },
	{ name: 'Lucas Robert', company: 'Auto École Robert', amount: 980, date: '14/08' },
	{ name: 'Camille Moreau', company: 'Coiffure Moreau', amount: 4150, date: '18/08' },
	{ name: 'Paul Lemoine', company: 'Restaurant Lemoine', amount: 1560, date: '21/08' }
];

export type ContactWeek = {
	name: string;
	company: string;
	reason: string;
	phone: string;
};

export const contactsWeek: ContactWeek[] = [
	{
		name: 'Paul Lemoine',
		company: 'Restaurant Lemoine',
		reason: 'Relance devis',
		phone: '06 12 34 56 78'
	},
	{
		name: 'Emma Girard',
		company: 'Boutique Girard',
		reason: 'Proposition à envoyer',
		phone: '06 98 76 54 32'
	},
	{
		name: 'Nathan Dubois',
		company: 'Fleuriste Dubois',
		reason: 'Suite au premier RDV',
		phone: '07 11 22 33 44'
	},
	{
		name: 'Sarah Leroy',
		company: 'Optique Leroy',
		reason: 'Appel de bienvenue',
		phone: '06 55 44 33 22'
	}
];
