import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { authTables } from '@convex-dev/auth/server';

// Table `users` étendue avec le profil métier de Harmony.
// Tous les nouveaux champs sont optionnels pour préserver la compatibilité.
const users = defineTable({
	name: v.optional(v.string()),
	email: v.optional(v.string()),
	phone: v.optional(v.string()),
	image: v.optional(v.string()),
	emailVerificationTime: v.optional(v.number()),
	phoneVerificationTime: v.optional(v.number()),
	isAnonymous: v.optional(v.boolean()),
	firstName: v.optional(v.string()),
	lastName: v.optional(v.string()),
	birthDate: v.optional(v.string()),
	role: v.optional(
		v.union(
			v.literal('administrateur'),
			v.literal('directeur de zone'),
			v.literal('animateur de zone'),
			v.literal('animateur'), // ancien libellé, accepté pour les comptes existants
			v.literal("directeur d'agence"),
			v.literal("animateur d'équipe"),
			v.literal('commercial')
		)
	),
	agencyId: v.optional(v.id('agences')),
	dateEntree: v.optional(v.number()),
	statut: v.optional(v.union(v.literal('actif'), v.literal('viré'))),
	firedAt: v.optional(v.number()),
	roleHistory: v.optional(v.array(v.object({ role: v.string(), at: v.number() }))),
	zone: v.optional(v.string()),
	photo: v.optional(v.string())
})
	.index('email', ['email'])
	.index('phone', ['phone'])
	.index('by_agency', ['agencyId']);

// Agences de l'entreprise (créées par l'administrateur uniquement).
const agences = defineTable({
	name: v.string(),
	zone: v.optional(v.string()),
	createdBy: v.optional(v.id('users'))
})
	.index('by_name', ['name'])
	.index('by_zone', ['zone']);

// Réponses des « Questions découverte » : stockées dans un champ structuré du
// contact (et plus dans la note, qui reste du texte libre).
export const qualifValidator = v.object({
	foyer: v.optional(v.string()),
	habite: v.optional(v.string()),
	plait: v.optional(v.string()),
	achat: v.optional(v.string()),
	achatDetail: v.optional(v.string()),
	metierMme: v.optional(v.string()),
	metierM: v.optional(v.string()),
	imposable: v.optional(v.string()),
	chauffage: v.optional(v.string()),
	chauffageCout: v.optional(v.string()),
	connait: v.optional(v.string()),
	concurrence: v.optional(v.string()),
	age: v.optional(v.string()),
	changer: v.optional(v.string()),
	pourQuand: v.optional(v.string()),
	soncas: v.optional(v.array(v.string()))
});

// Contacts (clients potentiels) créés par les employés.
const contacts = defineTable({
	// Questions découverte : structuré, hors note.
	qualif: v.optional(qualifValidator),
	name: v.string(),
	// Civilité du contact pour la fiche contact imprimable : choix multiple
	// possible (un couple = « M. » + « Mme »).
	civilites: v.optional(v.array(v.union(v.literal('M.'), v.literal('Mme'), v.literal('Melle')))),
	// Ancien champ mono-valeur : conservé pour les données déjà saisies.
	civilite: v.optional(v.union(v.literal('M.'), v.literal('Mme'), v.literal('Melle'))),
	address: v.optional(v.string()),
	phone: v.optional(v.string()),
	projet: v.optional(v.string()),
	source: v.optional(v.union(v.literal('TAP'), v.literal('GMS'), v.literal('PHONE'))),
	note: v.optional(v.string()),
	statut: v.optional(v.union(v.literal('actif'), v.literal('traité'))),
	recontacts: v.optional(v.array(v.object({ date: v.number(), response: v.string() }))),
	followUp: v.optional(
		v.object({
			type: v.union(v.literal('rappel'), v.literal('rdv')),
			date: v.string(),
			time: v.optional(v.string()),
			// Commercial rattaché au RDV (nom affiché), autre que le créateur du contact.
			commercial: v.optional(v.string()), // Statut du RDV : non renseigné = en attente (bleu).
			status: v.optional(v.union(v.literal('annulé'), v.literal('déballé'), v.literal('vendu'))),
			// Type de RDV placé : confortation (validation client) ou gestion dossier.
			motif: v.optional(v.union(v.literal('confortation'), v.literal('gestion'))),
			// Raison de non-vente renseignée quand le RDV est passé en « déballé ».
			nonVenteReason: v.optional(v.string()),
			// Raison d'annulation renseignée quand le RDV est passé en « annulé ».
			annulationReason: v.optional(v.string()),
			// Horodatage (ms) de la mise en « annulé » du RDV.
			annulationDate: v.optional(v.number())
		})
	),
	// Historique des RDV placés : conservé même si le suivi courant repasse en rappel.
	// Chaque entrée peut garder la raison du passage en rappel.
	rdvHistory: v.optional(v.array(v.object({ at: v.number(), reason: v.optional(v.string()) }))),
	// Le contact devient un client dès qu'une vente lui est rattachée.
	isClient: v.optional(v.boolean()),
	// Horodatage (ms) de la dernière impression de la fiche contact : permet de
	// savoir en un coup d'œil quelles fiches ont déjà été imprimées.
	printedAt: v.optional(v.number()),
	// Date du contact, corrigeable depuis la fiche web. Quand elle est renseignée,
	// elle remplace la date de création (`_creationTime`, non modifiable) partout
	// où le contact est daté : fiche contact, annonce de RDV, impression.
	dateContact: v.optional(v.number()),
	agencyId: v.optional(v.id('agences')),
	createdBy: v.optional(v.id('users'))
})
	.index('by_agency', ['agencyId'])
	.index('by_createdBy', ['createdBy']); // Ventes : un contact devient client via une ou plusieurs ventes. Chaque vente
// contient plusieurs produits (TVA + montant HT) et son vendeur.
// Le statut de la vente peut être : en attente (défaut — pas encore
// validée), valide, erreur ou annulée.
const ventes = defineTable({
	contactId: v.id('contacts'),
	vendeurId: v.id('users'),
	vendeurName: v.string(),
	statut: v.optional(
		v.union(v.literal('en attente'), v.literal('valide'), v.literal('erreur'), v.literal('annulée'))
	),
	// Erreur de dossier liée à la vente (posée par un manager) : documents
	// manquants, note argumentée, date et auteur.
	erreur: v.optional(
		v.object({
			manquants: v.array(v.string()),
			note: v.string(),
			at: v.number(),
			par: v.optional(v.string())
		})
	),
	date: v.number(),
	produits: v.array(
		v.object({
			produit: v.string(),
			// Conservé optionnel pour les ventes existantes ; plus utilisé dans l'UI.
			famille: v.optional(v.string()),
			tva: v.union(v.literal(5.5), v.literal(10), v.literal(20)),
			montantHT: v.number()
		})
	),
	totalHT: v.number(),
	totalTVA: v.number(),
	totalTTC: v.number(),
	agencyId: v.optional(v.id('agences'))
})
	.index('by_contact', ['contactId'])
	.index('by_vendeur', ['vendeurId']);

// Schéma final du projet Harmony. Les tables d'authentification (users,
// authAccounts, authSessions, authVerifiers) sont fournies par Convex Auth.
export default defineSchema({
	...authTables,
	users,
	agences,
	contacts,
	ventes,

	// Événements de l'agenda (réunion, formation, prospection, gestion dossier),
	// créés par les managers (admin, animateur, directeur d'agence).
	evenements: defineTable({
		type: v.union(
			v.literal('réunion'),
			v.literal('formation'),
			v.literal('prospection'),
			v.literal('gestion')
		),
		titre: v.string(),
		date: v.string(),
		start: v.string(),
		end: v.string(),
		secteur: v.optional(v.string()),
		membres: v.optional(v.array(v.id('users'))),
		// Sections de prospection : plusieurs secteurs + équipes dans un même
		// événement. Chaque section = nom d'équipe (optionnel) + secteur + membres.
		sections: v.optional(
			v.array(
				v.object({
					nom: v.optional(v.string()),
					secteur: v.string(),
					membres: v.array(v.id('users'))
				})
			)
		),
		agencyId: v.optional(v.id('agences')),
		createdBy: v.optional(v.id('users'))
	})
		.index('by_agency', ['agencyId'])
		.index('by_date', ['date']),

	// Pins « GMS » (grandes surfaces en cours) posés sur la carte : un point
	// avec un intitulé, lié à l'agence.
	gms: defineTable({
		externalId: v.string(),
		label: v.string(),
		latitude: v.number(),
		longitude: v.number(),
		agencyId: v.optional(v.id('agences')),
		createdAt: v.number()
	})
		.index('by_externalId', ['externalId'])
		.index('by_createdAt', ['createdAt'])
		.index('by_agency', ['agencyId']),

	// Zones de prospection (carte Mapbox) : polygones dessinés sur la carte,
	// avec la date de dernière prospection pour le suivi.
	zones: defineTable({
		// Identifiant externe (UUID généré côté client), utilisé par les features
		// dessinées sur la carte. Le `_id` Convex reste interne.
		externalId: v.string(),
		name: v.string(),
		lastProspected: v.optional(v.string()),
		createdAt: v.number(),
		// Couleur personnalisée du polygone (hex). Optionnel : les zones créées
		// avant l'ajout utilisent la couleur par défaut côté client.
		color: v.optional(v.string()),
		// Option « repasser en vert après 6 mois » : la zone perd sa couleur
		// personnalisée et devient verte une fois la dernière prospection
		// vieille de plus de 6 mois.
		greenWhenOld: v.optional(v.boolean()),
		// Agence propriétaire de la zone : chaque agence ne voit que ses zones.
		agencyId: v.optional(v.id('agences')),
		geometry: v.any()
	})
		.index('by_externalId', ['externalId'])
		.index('by_createdAt', ['createdAt'])
		.index('by_agency', ['agencyId']),

	// Arbres de progression (gamification) : étapes validées par employé, du bas
	// vers le haut. Chaque arbre (`tree`) est un parcours distinct (intégration,
	// tram de prospection…), avec ses propres étapes validées par les managers.
	progressions: defineTable({
		userId: v.id('users'),
		tree: v.optional(v.string()),
		validated: v.array(v.string()),
		updatedAt: v.number()
	})
		// by_user : docs créés avant l'ajout du champ `tree` (traités comme
		// l'arbre d'intégration) — conservé pour la compatibilité.
		.index('by_user', ['userId'])
		.index('by_user_tree', ['userId', 'tree']),

	// Objectifs mensuels (CA + RDV) fixés par le directeur d'agence pour ses
	// employés. `mois` est au format « YYYY-MM ».
	objectifs: defineTable({
		userId: v.id('users'),
		mois: v.string(),
		ca: v.number(),
		rdv: v.number()
	})
		.index('by_user_mois', ['userId', 'mois'])
		.index('by_mois', ['mois']),

	// Portes de prospection (BeastDoor) importées depuis l'app mobile, liées à
	// l'employé propriétaire (Pierre Torres via son `deviceId` de tablette).
	// Tables isolées : la BDD métier principale (contacts, ventes, zones) reste
	// intacte. Chaque ligne est un upsert idempotent par `id` (UUID mobile).
	portesBeastdoor: defineTable({
		id: v.string(),
		areaId: v.optional(v.string()),
		label: v.string(),
		street: v.optional(v.string()),
		postalCode: v.optional(v.string()),
		city: v.string(),
		latitude: v.optional(v.number()),
		longitude: v.optional(v.number()),
		status: v.optional(v.string()),
		score: v.optional(v.number()),
		notes: v.optional(v.string()),
		contactName: v.optional(v.string()),
		phone: v.optional(v.string()),
		email: v.optional(v.string()),
		nextActionAt: v.optional(v.number()),
		createdByName: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number(),
		deletedAt: v.optional(v.number()),
		syncedAt: v.optional(v.number()),
		deviceId: v.optional(v.string()),
		userId: v.id('users'),
		agencyId: v.optional(v.id('agences'))
	})
		.index('by_doc_id', ['id'])
		.index('by_user', ['userId'])
		.index('by_user_status', ['userId', 'status'])
		.index('by_agency', ['agencyId'])
		// Pull incrémental de l'app (§ coût Convex) : on ne lit que les lignes
		// modifiées depuis `lastSyncAt` au lieu de toute l'agence.
		.index('by_agency_updated', ['agencyId', 'updatedAt'])
		.index('by_user_updated', ['userId', 'updatedAt']),

	// Compteurs GMS quotidiens importés depuis l'app mobile (tablette BeastDoor) :
	// salutations, flyers, questions, contacts et RDV par jour. Alimente le
	// « Bilan GMS ».
	gmsStatsBeastdoor: defineTable({
		id: v.string(),
		date: v.string(), // 'YYYY-MM-DD'
		salutation: v.number(),
		flyer: v.number(),
		question: v.number(),
		contact: v.optional(v.number()),
		rdv: v.optional(v.number()),
		createdAt: v.number(),
		updatedAt: v.number(),
		deletedAt: v.optional(v.number()),
		syncedAt: v.optional(v.number()),
		deviceId: v.optional(v.string()),
		userId: v.id('users')
	})
		.index('by_doc_id', ['id'])
		.index('by_user', ['userId'])
		.index('by_user_date', ['userId', 'date'])
		.index('by_user_updated', ['userId', 'updatedAt']),

	// Passages (visites) sur les portes importées : chaque passage porte un
	// statut (non présent, traité/refus, RDV, contact, étude…) et une date
	// `visitedAt` (timestamp ms), source du bilan par jour et par mois.
	visitesBeastdoor: defineTable({
		id: v.string(),
		addressId: v.string(),
		status: v.optional(v.string()),
		note: v.optional(v.string()),
		productType: v.optional(v.string()),
		revenueCents: v.optional(v.number()),
		splitWithPartner: v.optional(v.boolean()),
		source: v.optional(v.string()),
		score: v.optional(v.number()),
		harmonyContactId: v.optional(v.string()),
		visitedAt: v.number(),
		createdAt: v.number(),
		updatedAt: v.number(),
		deletedAt: v.optional(v.number()),
		syncedAt: v.optional(v.number()),
		deviceId: v.optional(v.string()),
		userId: v.id('users'),
		agencyId: v.optional(v.id('agences'))
	})
		.index('by_doc_id', ['id'])
		.index('by_user', ['userId'])
		.index('by_user_visited', ['userId', 'visitedAt'])
		.index('by_agency', ['agencyId'])
		.index('by_agency_updated', ['agencyId', 'updatedAt'])
		.index('by_user_updated', ['userId', 'updatedAt'])
		// Vérification « cette porte a-t-elle déjà un RDV ? » sans scan complet.
		.index('by_address_status', ['addressId', 'status']),

	// Contacts liés aux portes (tablette) : copie miroir du backend BeastDoor,
	// liés à l'utilisateur. Chaque ligne est un upsert idempotent par `id`.
	doorContactsBeastdoor: defineTable({
		id: v.string(),
		addressId: v.string(),
		firstName: v.optional(v.string()),
		lastName: v.optional(v.string()),
		phone: v.optional(v.string()),
		email: v.optional(v.string()),
		role: v.optional(v.string()),
		notes: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number(),
		deletedAt: v.optional(v.number()),
		syncedAt: v.optional(v.number()),
		deviceId: v.optional(v.string()),
		userId: v.id('users'),
		agencyId: v.optional(v.id('agences'))
	})
		.index('by_doc_id', ['id'])
		.index('by_user', ['userId'])
		.index('by_agency', ['agencyId'])
		.index('by_agency_updated', ['agencyId', 'updatedAt'])
		.index('by_user_updated', ['userId', 'updatedAt']),

	// RDV liés aux portes (tablette) : copie miroir du backend BeastDoor.
	doorAppointmentsBeastdoor: defineTable({
		id: v.string(),
		addressId: v.string(),
		contactId: v.optional(v.string()),
		title: v.string(),
		scheduledAt: v.number(),
		status: v.string(),
		notes: v.optional(v.string()),
		phone: v.optional(v.string()),
		reminderMinutes: v.number(),
		durationMinutes: v.number(),
		createdAt: v.number(),
		updatedAt: v.number(),
		deletedAt: v.optional(v.number()),
		syncedAt: v.optional(v.number()),
		deviceId: v.optional(v.string()),
		userId: v.id('users'),
		agencyId: v.optional(v.id('agences'))
	})
		.index('by_doc_id', ['id'])
		.index('by_user', ['userId'])
		.index('by_agency', ['agencyId'])
		.index('by_agency_updated', ['agencyId', 'updatedAt'])
		.index('by_user_updated', ['userId', 'updatedAt'])
		.index('by_address', ['addressId']),

	// Notes de calendrier (tablette) : copie miroir du backend BeastDoor.
	calendarNotesBeastdoor: defineTable({
		id: v.string(),
		title: v.string(),
		dateDay: v.number(),
		timeStr: v.optional(v.string()),
		colorValue: v.optional(v.number()),
		notes: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number(),
		deletedAt: v.optional(v.number()),
		syncedAt: v.optional(v.number()),
		deviceId: v.optional(v.string()),
		userId: v.id('users')
	})
		.index('by_doc_id', ['id'])
		.index('by_user', ['userId'])
		.index('by_user_updated', ['userId', 'updatedAt']),

	// Stats quotidiennes des portes (tablette) : refus / non présent par jour.
	porteStatsBeastdoor: defineTable({
		id: v.string(),
		date: v.string(), // 'YYYY-MM-DD'
		refus: v.number(),
		nonPresent: v.number(),
		createdAt: v.number(),
		updatedAt: v.number(),
		deletedAt: v.optional(v.number()),
		syncedAt: v.optional(v.number()),
		deviceId: v.optional(v.string()),
		userId: v.id('users')
	})
		.index('by_doc_id', ['id'])
		.index('by_user', ['userId'])
		.index('by_user_date', ['userId', 'date'])
		.index('by_user_updated', ['userId', 'updatedAt']),

	// Tables métier du projet.
	stats: defineTable({
		token: v.string(),
		date: v.string(),
		clicks: v.number(),
		signups: v.number(),
		trials: v.number(),
		trialsAmount: v.number(),
		bills: v.number(),
		billsAmount: v.number(),
		upsellAmount: v.number(),
		unpaid: v.number(),
		totalAmount: v.number()
	})
		.index('by_date', ['date'])
		.index('by_token', ['token'])
});
