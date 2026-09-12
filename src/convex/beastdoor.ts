import { action, httpAction, internalMutation, mutation, query } from './_generated/server';
import type { ActionCtx } from './_generated/server';
import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import { api } from './_generated/api';
import { getCurrentUser } from './permissions';
import type { Doc, Id } from './_generated/dataModel';

// Endpoint public de synchronisation BeastDoor : avec `lastSyncAt: 0` il renvoie
// `serverChanges` = toutes les tables (portes, visites, RDV, stats), sans clé.
const BEASTDOOR_SYNC_URL =
	process.env.BEASTDOOR_SYNC_URL ??
	'https://gallant-marlin-237.eu-west-1.convex.site/beastdoor/sync';

// Nom complet de l'employé à qui lier les données importées (Pierre Torres).
const PIERRE_FIRST_NAME = 'Pierre';
const PIERRE_LAST_NAME = 'Torres';

// Tablette de Pierre Torres dans l'app mobile BeastDoor. Chaque doc poussé porte
// ce `device_id` ; on filtre dessus pour lier les données au bon employé.
const BEASTDOOR_DEVICE_PIERRE =
	process.env.BEASTDOOR_DEVICE_PIERRE ?? 'tablet-b70f3fcd-f5de-4487-bddf-59a4f3ed0759';

function num(v: unknown): number | undefined {
	if (typeof v === 'number') return v;
	if (typeof v === 'string') {
		const n = Number(v);
		return Number.isFinite(n) ? n : undefined;
	}
	return undefined;
}
function str(v: unknown): string | undefined {
	return typeof v === 'string' ? v : undefined;
}

type RawChange = Record<string, unknown>;

// Upsert idempotent d'une porte importée dans les tables dédiées Harmony, liée
// au `userId` de la ligne (poussé par l'app) ou au `fallbackUserId` pour les
// lignes héritées (sans user_id). Ne touche jamais les tables métier principales.
async function upsertPorte(ctx: any, porte: RawChange, fallbackUserId: any): Promise<void> {
	const id = str(porte.id);
	if (!id) return;
	const userId = str(porte.user_id) ?? fallbackUserId;
	const existing = await ctx.db
		.query('portesBeastdoor')
		.withIndex('by_doc_id', (q: any) => q.eq('id', id))
		.first();
	const deleted = num(porte.deleted_at);
	const payload = {
		id,
		label: str(porte.label) ?? 'Porte',
		street: str(porte.street),
		postalCode: str(porte.postal_code),
		city: str(porte.city) ?? 'À renseigner',
		latitude: num(porte.latitude),
		longitude: num(porte.longitude),
		status: str(porte.status),
		notes: str(porte.notes),
		contactName: str(porte.contact_name),
		phone: str(porte.phone),
		email: str(porte.email),
		createdAt: num(porte.created_at) ?? Date.now(),
		updatedAt: num(porte.updated_at) ?? Date.now(),
		deletedAt: deleted,
		userId
	};
	if (existing) {
		await ctx.db.patch(existing._id, payload);
	} else {
		await ctx.db.insert('portesBeastdoor', payload);
	}
}

async function upsertVisite(ctx: any, visite: RawChange, fallbackUserId: any): Promise<void> {
	const id = str(visite.id);
	if (!id) return;
	const userId = str(visite.user_id) ?? fallbackUserId;
	const existing = await ctx.db
		.query('visitesBeastdoor')
		.withIndex('by_doc_id', (q: any) => q.eq('id', id))
		.first();
	const payload = {
		id,
		addressId: str(visite.address_id) ?? '',
		status: str(visite.status),
		note: str(visite.note),
		productType: str(visite.sale_product_type),
		revenueCents: num(visite.sale_revenue_cents),
		splitWithPartner:
			typeof visite.sale_split_with_partner === 'boolean'
				? visite.sale_split_with_partner
				: undefined,
		source: str(visite.source),
		score: num(visite.score),
		visitedAt: num(visite.visited_at) ?? Date.now(),
		createdAt: num(visite.created_at) ?? Date.now(),
		updatedAt: num(visite.updated_at) ?? Date.now(),
		deletedAt: num(visite.deleted_at),
		userId
	};
	if (existing) {
		await ctx.db.patch(existing._id, payload);
	} else {
		await ctx.db.insert('visitesBeastdoor', payload);
	}
}

// Upsert idempotent d'un compteur GMS quotidien importé, par `date` (une seule
// ligne par employé + jour). Alimente le « Bilan GMS » de la page.
async function upsertGmsStat(ctx: any, stat: RawChange, fallbackUserId: any): Promise<void> {
	const date = str(stat.date) ?? str(stat.id);
	if (!date) return;
	const userId = str(stat.user_id) ?? fallbackUserId;
	const existing = await ctx.db
		.query('gmsStatsBeastdoor')
		.withIndex('by_user_date', (q: any) => q.eq('userId', userId).eq('date', date))
		.first();
	const payload = {
		id: str(stat.id) ?? date,
		date,
		salutation: num(stat.salutation) ?? 0,
		flyer: num(stat.flyer) ?? 0,
		question: num(stat.question) ?? 0,
		createdAt: num(stat.created_at) ?? Date.now(),
		updatedAt: num(stat.updated_at) ?? Date.now(),
		deletedAt: num(stat.deleted_at),
		userId
	};
	if (existing) {
		await ctx.db.patch(existing._id, payload);
	} else {
		await ctx.db.insert('gmsStatsBeastdoor', payload);
	}
}

// Mutation interne appelée par l'action `importPortes` : applique les lignes
// filtrées de BeastDoor dans les tables dédiées. Chaque ligne est liée à son
// `user_id` (poussé par l'app) ; les lignes héritées (sans user_id) retombent
// sur l'employé de repli (Pierre Torres, résolu par nom).
export const upsertPortes = mutation({
	args: {
		portes: v.array(v.any()),
		visites: v.array(v.any()),
		gmsStats: v.array(v.any())
	},
	handler: async (ctx, args) => {
		const users = await ctx.db.query('users').collect();
		const pierre = users.find(
			(u) => u.firstName === PIERRE_FIRST_NAME && u.lastName === PIERRE_LAST_NAME
		);
		if (!pierre) {
			throw new Error(`Employé « ${PIERRE_FIRST_NAME} ${PIERRE_LAST_NAME} » introuvable.`);
		}
		for (const p of args.portes) await upsertPorte(ctx, p, pierre._id);
		for (const v of args.visites) await upsertVisite(ctx, v, pierre._id);
		for (const g of args.gmsStats) await upsertGmsStat(ctx, g, pierre._id);
		return {
			portes: args.portes.length,
			visites: args.visites.length,
			gms: args.gmsStats.length
		};
	}
});

// Action déclenchée depuis la page Bilan : interroge l'endpoint BeastDoor et
// importe (upsert) dans Harmony. Chaque ligne est liée à son `user_id` (l'app
// le pousse depuis que les portes sont scopées par utilisateur) ; les lignes
// héritées (sans user_id) retombent sur la tablette de Pierre Torres.
export const importPortes = action({
	args: {},
	handler: async (ctx): Promise<{ portes: number; visites: number; gms: number }> => {
		// Connexion requise : seul un utilisateur connecté peut lancer le bilan.
		// (Action = pas de `ctx.db` ; on n'authentifie que via l'id de session.)
		if (!(await getAuthUserId(ctx))) {
			throw new Error('Non connecté.');
		}

		const res = await fetch(BEASTDOOR_SYNC_URL, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ deviceId: 'harmony-bilan', lastSyncAt: 0, changes: [] })
		});
		if (!res.ok) throw new Error(`BeastDoor a répondu ${res.status}.`);
		const body = (await res.json()) as {
			serverChanges?: {
				doorAddresses?: RawChange[];
				doorVisits?: RawChange[];
				gmsDailyStats?: RawChange[];
			};
		};
		const sc = body.serverChanges ?? {};
		const allAddresses: RawChange[] = sc.doorAddresses ?? [];
		const allVisits: RawChange[] = sc.doorVisits ?? [];
		const allGmsDaily: RawChange[] = sc.gmsDailyStats ?? [];

		// Lignes portant un `user_id` (propriétaire) + lignes héritées de la
		// tablette de Pierre (sans user_id).
		const hasOwner = (r: RawChange) =>
			typeof r.user_id === 'string' && (r.user_id as string).length > 0;
		const portes = allAddresses.filter(
			(a) => hasOwner(a) || a.device_id === BEASTDOOR_DEVICE_PIERRE
		);
		const portesIds = new Set(portes.map((p) => p.id));
		const visites = allVisits.filter(
			(v) => portesIds.has(v.address_id) && (hasOwner(v) || v.device_id === BEASTDOOR_DEVICE_PIERRE)
		);
		const gmsStats = allGmsDaily.filter(
			(g) => hasOwner(g) || g.device_id === BEASTDOOR_DEVICE_PIERRE
		);

		await ctx.runMutation(api.beastdoor.upsertPortes, { portes, visites, gmsStats });
		return { portes: portes.length, visites: visites.length, gms: gmsStats.length };
	}
});

// Query : portes + visites associées aux employés demandés (personIds). L'accès est
// filtré côté front par rôle (managers → équipe, commercial → ses propres lignes).
// Sans `personIds`, on cible la personne à qui les données sont importées (Pierre
// Torres) — comportement historique de la page Bilan.
export const list = query({
	args: { personIds: v.optional(v.array(v.id('users'))) },
	handler: async (ctx, args) => {
		// Connexion requise.
		await getCurrentUser(ctx);

		// Par défaut, on cible la personne à qui les données sont importées
		// (Pierre Torres). Un manager peut passer des `personIds` explicites
		// (« Tous » = toute l'équipe, ou un seul membre).
		let targetUserIds = args.personIds ?? [];
		if (targetUserIds.length === 0) {
			const users = await ctx.db.query('users').collect();
			const pierre = users.find(
				(u) => u.firstName === PIERRE_FIRST_NAME && u.lastName === PIERRE_LAST_NAME
			);
			// Si Pierre n'existe pas encore (import jamais fait), on renvoie vide.
			if (pierre) targetUserIds = [pierre._id];
		}
		if (targetUserIds.length === 0) return { portes: [], visites: [], gmsStats: [] };

		// Union des données des utilisateurs demandés (une ligne n'appartient
		// qu'à un seul utilisateur : pas de doublon possible entre les `by_user`).
		const portes: Doc<'portesBeastdoor'>[] = [];
		const visites: Doc<'visitesBeastdoor'>[] = [];
		const gmsStats: Doc<'gmsStatsBeastdoor'>[] = [];
		for (const targetUserId of targetUserIds) {
			portes.push(
				...(await ctx.db
					.query('portesBeastdoor')
					.withIndex('by_user', (q) => q.eq('userId', targetUserId))
					.collect())
			);
			visites.push(
				...(await ctx.db
					.query('visitesBeastdoor')
					.withIndex('by_user', (q) => q.eq('userId', targetUserId))
					.collect())
			);
			gmsStats.push(
				...(await ctx.db
					.query('gmsStatsBeastdoor')
					.withIndex('by_user', (q) => q.eq('userId', targetUserId))
					.collect())
			);
		}
		return { portes, visites, gmsStats };
	}
});

// ---------------------------------------------------------------------------
// SYNC UNIFIÉ : l'app écrit maintenant DIRECTEMENT dans la BDD Harmony (plus
// de backend BeastDoor séparé). L'app pousse ses changements (7 entités) avec
// son token Harmony ; chaque ligne est liée à l'utilisateur connecté.
// ---------------------------------------------------------------------------

// Entité poussée par l'app → table Harmony correspondante.
const ENTITY_TABLE: Record<string, string> = {
	doorAddresses: 'portesBeastdoor',
	doorContacts: 'doorContactsBeastdoor',
	doorVisits: 'visitesBeastdoor',
	doorAppointments: 'doorAppointmentsBeastdoor',
	calendarNotes: 'calendarNotesBeastdoor',
	gmsDailyStats: 'gmsStatsBeastdoor',
	porteDailyStats: 'porteStatsBeastdoor'
};

// Entités « carte » partagées au niveau de l'agence : tout membre de l'agence
// voit les portes/contacts/visites/RDV de ses collègues (chacune garde son
// `userId` = créateur). Les compteurs (gms/porte) et notes restent par
// utilisateur.
const SHARED_ENTITY_TYPES = new Set([
	'doorAddresses',
	'doorContacts',
	'doorVisits',
	'doorAppointments'
]);

// Champs snake_case (app) → camelCase (tables Harmony).
const SNAKE_TO_CAMEL: Record<string, string> = {
	area_id: 'areaId',
	address_id: 'addressId',
	contact_id: 'contactId',
	first_name: 'firstName',
	last_name: 'lastName',
	postal_code: 'postalCode',
	contact_name: 'contactName',
	created_by_name: 'createdByName',
	next_action_at: 'nextActionAt',
	sale_product_type: 'productType',
	sale_revenue_cents: 'revenueCents',
	sale_split_with_partner: 'splitWithPartner',
	harmony_contact_id: 'harmonyContactId',
	visited_at: 'visitedAt',
	created_at: 'createdAt',
	updated_at: 'updatedAt',
	deleted_at: 'deletedAt',
	synced_at: 'syncedAt',
	device_id: 'deviceId',
	user_id: 'userId',
	agency_id: 'agencyId',
	date_day: 'dateDay',
	time_str: 'timeStr',
	color_value: 'colorValue',
	reminder_minutes: 'reminderMinutes',
	duration_minutes: 'durationMinutes',
	scheduled_at: 'scheduledAt',
	non_present: 'nonPresent'
};

function toCamel(row: RawChange): RawChange {
	const out: RawChange = {};
	for (const [k, val] of Object.entries(row)) {
		const key = SNAKE_TO_CAMEL[k] ?? k;
		// L'ancien backend stockait le partage partenaire en nombre (0/1) ;
		// Harmony attend un booléen.
		const value = key === 'splitWithPartner' && typeof val === 'number' ? val !== 0 : val;
		out[key] = value;
	}
	return out;
}

function toSnake(row: RawChange): RawChange {
	const out: RawChange = {};
	for (const [k, val] of Object.entries(row)) {
		const snake = Object.entries(SNAKE_TO_CAMEL).find(([, camel]) => camel === k)?.[0] ?? k;
		out[snake] = val;
	}
	return out;
}

function stripNulls(obj: Record<string, unknown>): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(obj)) {
		if (v !== null && v !== undefined) result[k] = v;
	}
	return result;
}

// Mutation unique d'upsert d'un changement de l'app dans les tables Harmony.
// L'utilisateur est l'utilisateur connecté (identité propagée depuis l'endpoint
// HTTP) ; `userId` peut être passé explicitement pour les transferts internes
// (CLI, sans session).
export const upsertBeastdoorChange = mutation({
	args: {
		entityType: v.string(),
		entityId: v.string(),
		operation: v.string(),
		payload: v.any(),
		userId: v.optional(v.id('users'))
	},
	handler: async (ctx, { entityType, entityId, operation, payload, userId: explicitUserId }) => {
		const userId = explicitUserId ?? (await getAuthUserId(ctx));
		if (!userId) throw new Error('Non connecté.');
		// Accès DB par nom de table dynamique (string) : on élargit le typage pour
		// les lookups génériques, comme les helpers `(ctx: any)` ci-dessus.
		const db = ctx.db as any;
		const table = ENTITY_TABLE[entityType];
		if (!table) return;
		// Rôle et agence de l'utilisateur connecté (pour les portes partagées :
		// l'agence est estampillée à l'écriture, le rôle gouverne les règles).
		const user = await db.get(userId);
		const isShared = SHARED_ENTITY_TYPES.has(entityType);
		const isManager = await isDoorManager(user?.role);
		const agencyId = user?.agencyId as (Id<'agences'> | undefined) | undefined;
		const cleaned = stripNulls(payload as Record<string, unknown>);
		// Champs internes Convex de l'ancien backend : jamais stockés ici.
		delete cleaned['_id'];
		delete cleaned['_creationTime'];
		const existing = await db
			.query(table)
			.withIndex('by_doc_id', (q: any) => q.eq('id', entityId))
			.first();
		if (operation === 'delete') {
			// Règle « qui a créé peut supprimer » : seule la personne qui a créé la
			// porte / l'état peut la supprimer (les managers de la carte passent).
			if (existing && existing.userId && existing.userId !== userId && !isManager) {
				throw new Error(
					operation === 'delete' && entityType === 'doorAddresses'
						? 'Action refusée : seule la personne qui a créé ce point peut le supprimer.'
						: 'Action refusée : vous ne pouvez pas supprimer l\u2019état d\u2019un collègue.'
				);
			}
			const deletedAt = num(cleaned.deleted_at) ?? Date.now();
			// Horodatage serveur (jamais inférieur à celui de l'appareil) : sinon le
			// pull incrémental (`updatedAt >= lastSyncAt`) peut rater la suppression
			// quand l'horloge d'un appareil est en retard sur celle du serveur.
			const updatedAt = Math.max(num(cleaned.updated_at) ?? 0, Date.now());
			if (existing) {
				await db.patch(existing._id, { deletedAt, updatedAt });
			}
			return;
		}
		const doc = toCamel(cleaned);
		doc.id = entityId;
		doc.userId = userId;
		if (isShared) doc.agencyId = agencyId;
		// Estampille `updatedAt` à l'heure du serveur (au moins celle de l'appareil) :
		// garantit que la ligne progresse avec l'horloge serveur, donc que le pull
		// incrémental des autres appareils (`updatedAt >= lastSyncAt`) la retrouvera
		// toujours — évite les lignes « perdues » quand l'horloge d'un appareil est
		// en retard (visites visibles sur le web mais jamais reçues par le téléphone).
		doc.updatedAt = Math.max(num(doc.updatedAt) ?? 0, Date.now());
		// Verrou RDV : un non-créateur (ni manager) ne peut pas faire passer une
		// porte « catalogue / traité / non présent » si un RDV a déjà été pris.
		if (entityType === 'doorVisits') {
			const status = str(doc.status);
			const addressId = str(doc.addressId);
			if (status && addressId && AFTER_RDV_DOWNGRADE_STATUSES.has(status)) {
				const owner = await db
					.query('portesBeastdoor')
					.withIndex('by_doc_id', (q: any) => q.eq('id', addressId))
					.first();
				const isCreator = Boolean(owner && owner.userId && owner.userId === userId);
				if (!isManager && !isCreator && (await doorHasRdv(db, addressId))) {
					throw new Error(
						'RDV déjà pris sur cette porte : seuls son créateur ou un manager peuvent la modifier.'
					);
				}
			}
		}
		// Même verrou au niveau de la porte elle-même : empêche un non-créateur de
		// rétrograder le statut d'une porte qui a déjà pris RDV.
		if (entityType === 'doorAddresses') {
			const status = str(doc.status);
			if (status && AFTER_RDV_DOWNGRADE_STATUSES.has(status)) {
				const isCreator = Boolean(
					existing && existing.userId && existing.userId === userId
				);
				if (!isManager && !isCreator && (await doorHasRdv(db, entityId))) {
					throw new Error(
						'RDV déjà pris sur cette porte : seuls son créateur ou un manager peuvent la modifier.'
					);
				}
			}
		}
		if (existing) {
			await db.patch(existing._id, doc as any);
		} else {
			// Identifie clairement le créateur (portes partagées de l'agence).
			if (entityType === 'doorAddresses') {
				const name = [user?.firstName, user?.lastName]
					.filter(Boolean)
					.join(' ')
					.trim();
				if (name) doc.createdByName = name;
			}
			await db.insert(table, doc as any);
		}
	}
});

// Une porte a « déjà pris un RDV » dès qu'un RDV est posé (statut rdv), un RDV
// est planifié (appointment actif), ou un passage RDV existe.
async function doorHasRdv(db: any, addressId: string): Promise<boolean> {
	const door = await db
		.query('portesBeastdoor')
		.withIndex('by_doc_id', (q: any) => q.eq('id', addressId))
		.first();
	const doorRdv = door && !door.deletedAt && door.status === 'rdv';
	const appointment = await db
		.query('doorAppointmentsBeastdoor')
		.filter((q: any) => q.eq(q.field('addressId'), addressId))
		.first();
	const activeAppointment = appointment && !appointment.deletedAt;
	const visit = await db
		.query('visitesBeastdoor')
		.filter((q: any) =>
			q.and(
				q.eq(q.field('addressId'), addressId),
				q.eq(q.field('status'), 'rdv')
			)
		)
		.first();
	const activeRdvVisit = visit && !visit.deletedAt;
	return Boolean(doorRdv || activeAppointment || activeRdvVisit);
}

// Statuts « rétrogrades » qu'on n'autorise pas à poser sur une porte qui a
// déjà pris RDV, sauf créateur/manager : catalogue (etude), traité (refus),
// non présent (non_present).
const AFTER_RDV_DOWNGRADE_STATUSES = new Set(['etude', 'refus', 'non_present']);

// Rôles autorisés à gérer les portes des collègues (supprimer / déverrouiller
// l'état après RDV). Aligné sur les managers de la carte.
function isDoorManager(role: unknown): boolean {
	return ['administrateur', "directeur de zone", "directeur d'agence", 'animateur', 'animateur de zone'].includes(
		String(role ?? '')
	);
}

// Pull des changements pour l'utilisateur connecté : renvoie les 7 entités au
// format snake_case attendu par l'app (mêmes clés que l'ancien backend).
export const listBeastdoorChanges = query({
	args: { lastSyncAt: v.number(), userId: v.optional(v.id('users')) },
	handler: async (ctx, { lastSyncAt, userId: explicitUserId }) => {
		const userId = explicitUserId ?? (await getAuthUserId(ctx));
		if (!userId) return {};
		// Accès DB par nom de table dynamique (string) : on élargit le typage.
		const db = ctx.db as any;
		const user = await db.get(userId);
		const agencyId = user?.agencyId as (Id<'agences'> | undefined) | undefined;
		const result: Record<string, unknown[]> = {};
		for (const [entityType, table] of Object.entries(ENTITY_TABLE)) {
			// Portes/contacts/visites/RDV : partagés au niveau de l'agence, donc le
			// pull renvoie les lignes de TOUS les membres de l'agence (chacune avec
			// son `userId` = créateur). Compteurs et notes : par utilisateur.
			const isShared = SHARED_ENTITY_TYPES.has(entityType);
			const docs = (isShared && agencyId
				? await db
						.query(table)
						.withIndex('by_agency', (q: any) => q.eq('agencyId', agencyId))
						.collect()
				: await db
						.query(table)
						.withIndex('by_user', (q: any) => q.eq('userId', userId))
						.collect()) as RawChange[];
			result[entityType] = docs
				.filter((d) => (num(d.updatedAt) ?? 0) >= lastSyncAt)
				.map((d) => toSnake(d));
		}
		return result;
	}
});

// Migration : relie toutes les portes existantes (et leurs visites / contacts /
// RDV) à l'utilisateur « Pierre Torres », pour qu'il en soit propriétaire et
// identifié comme créateur. À lancer une fois après déploiement.
export const linkPortesToPierre = internalMutation({
	args: {},
	handler: async (ctx) => {
		const users = await ctx.db.query('users').collect();
		const pierre = users.find(
			(u) => u.firstName === PIERRE_FIRST_NAME && u.lastName === PIERRE_LAST_NAME
		);
		if (!pierre) {
			throw new Error(`Employé « ${PIERRE_FIRST_NAME} ${PIERRE_LAST_NAME} » introuvable.`);
		}
		const db = ctx.db as any;
		const name = [pierre.firstName, pierre.lastName].filter(Boolean).join(' ').trim();
		const target = [
			['portesBeastdoor', 'status'],
			['doorContactsBeastdoor', null],
			['visitesBeastdoor', null],
			['doorAppointmentsBeastdoor', null]
		] as const;
		const counts: Record<string, number> = {};
		for (const [table, hasCreator] of target) {
			const docs = (await db.query(table).collect()) as Doc<'portesBeastdoor'>[];
			for (const doc of docs) {
				const patch: Record<string, unknown> = {
					userId: pierre._id,
					agencyId: pierre.agencyId
				};
				// Bump updatedAt obligatoire : le pull de la tablette (par `updatedAt >=
				// lastSyncAt`) et le « last-write-wins » de l'app ont besoin d'un
				// updatedAt supérieur pour répercuter createdByName/owner en local.
				patch.updatedAt = Date.now();
				patch.syncedAt = patch.updatedAt;
				if (hasCreator) patch.createdByName = name;
				await db.patch(doc._id, patch);
			}
			counts[table] = docs.length;
		}
		return { ...counts };
	}
});

// --- Endpoint HTTP POST /api/mobile/beastdoor-sync (token Harmony requis) ---
function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'content-type': 'application/json',
			'access-control-allow-origin': '*',
			'access-control-allow-methods': 'POST, OPTIONS',
			'access-control-allow-headers': 'content-type, authorization'
		}
	});
}

async function getIdentity(ctx: ActionCtx) {
	try {
		return await ctx.auth.getUserIdentity();
	} catch {
		return null;
	}
}

export const beastdoorSync = httpAction(async (ctx, request) => {
	if (request.method === 'OPTIONS') return json({ ok: true }, 204);
	if (request.method !== 'POST') {
		return json({ ok: false, error: 'Méthode non autorisée.' }, 405);
	}
	const identity = await getIdentity(ctx);
	if (!identity) {
		return json({ ok: false, error: 'Session expirée. Reconnecte-toi.' }, 401);
	}
	let body: Record<string, unknown> | null = null;
	try {
		const parsed = await request.json();
		body = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
	} catch {
		body = null;
	}
	const changes = (body?.changes as Array<Record<string, unknown>> | undefined) ?? [];
	const lastSyncAt = typeof body?.lastSyncAt === 'number' ? body.lastSyncAt : 0;
	const accepted: number[] = [];

	for (const c of changes) {
		const localQueueId = c.localQueueId;
		const entityType = c.entityType;
		const entityId = c.entityId;
		const operation = c.operation;
		if (
			typeof localQueueId !== 'number' ||
			typeof entityType !== 'string' ||
			typeof entityId !== 'string' ||
			typeof operation !== 'string'
		) {
			continue;
		}
		try {
			await ctx.runMutation(api.beastdoor.upsertBeastdoorChange, {
				entityType,
				entityId,
				operation,
				payload: c.payload
			});
			accepted.push(localQueueId);
		} catch {
			// retry next sync
		}
	}

	let serverChanges: Record<string, unknown[]> = {};
	try {
		serverChanges = await ctx.runQuery(api.beastdoor.listBeastdoorChanges, {
			lastSyncAt
		});
	} catch {
		// pull non bloquant — la tablette récupérera au prochain sync
	}

	return json({
		ok: true,
		serverTime: Date.now(),
		acceptedQueueIds: accepted,
		serverChanges
	});
});

// --- Endpoint HTTP POST /api/mobile/portes (écriture directe d'une porte) ---
// Enregistre immédiatement une porte dans la BDD Harmony, sans passer par la
// file de synchronisation de l'app. Mêmes règles que le sync unifié (agence
// estampillée, verrous RDV, créateur). L'app garde sa file locale en filet de
// sécurité hors-ligne.
export const upsertPorteDirect = httpAction(async (ctx, request) => {
	if (request.method === 'OPTIONS') return json({ ok: true }, 204);
	if (request.method !== 'POST') {
		return json({ ok: false, error: 'Méthode non autorisée.' }, 405);
	}
	const identity = await getIdentity(ctx);
	if (!identity) {
		return json({ ok: false, error: 'Session expirée. Reconnecte-toi.' }, 401);
	}
	let body: Record<string, unknown> | null = null;
	try {
		const parsed = await request.json();
		body =
			parsed && typeof parsed === 'object'
				? (parsed as Record<string, unknown>)
				: null;
	} catch {
		body = null;
	}
	const entityId = typeof body?.id === 'string' ? body.id : '';
	const operation = body?.operation === 'delete' ? 'delete' : 'upsert';
	const payload = body?.payload;
	if (!entityId || typeof payload !== 'object' || payload === null) {
		return json({ ok: false, error: 'Champs manquants (id, payload).' }, 400);
	}
	try {
		await ctx.runMutation(api.beastdoor.upsertBeastdoorChange, {
			entityType: 'doorAddresses',
			entityId,
			operation,
			payload
		});
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Erreur serveur.';
		return json({ ok: false, error: message }, 400);
	}
	return json({ ok: true, id: entityId });
});

// Id de l'employé cible du transfert (Pierre Torres).
export const pierreUserId = query({
	args: {},
	handler: async (ctx) => {
		const users = await ctx.db.query('users').collect();
		const pierre = users.find(
			(u) => u.firstName === PIERRE_FIRST_NAME && u.lastName === PIERRE_LAST_NAME
		);
		return pierre?._id ?? null;
	}
});

// --- Transfert unique des données de l'ancien backend BeastDoor → Harmony ---
// Récupère TOUTES les données (7 tables) depuis gallant-marlin et les upsert
// dans les tables Harmony, liées à Pierre Torres (user_id forcé). Idempotent.
export const transferBeastdoorData = action({
	args: {},
	handler: async (ctx): Promise<{ count: number; pierreId: string }> => {
		const pierreId = await ctx.runQuery(api.beastdoor.pierreUserId);
		if (!pierreId) {
			throw new Error(`Employé « ${PIERRE_FIRST_NAME} ${PIERRE_LAST_NAME} » introuvable.`);
		}
		const res = await fetch(BEASTDOOR_SYNC_URL, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ deviceId: 'harmony-transfert', lastSyncAt: 0, changes: [] })
		});
		if (!res.ok) throw new Error(`BeastDoor a répondu ${res.status}.`);
		const body = (await res.json()) as {
			serverChanges?: Record<string, RawChange[]>;
		};
		const sc = body.serverChanges ?? {};
		const rows: Array<{
			entityType: string;
			entityId: string;
			operation: string;
			payload: RawChange;
		}> = [
			...(sc.doorAddresses ?? []).map((p) => ({
				entityType: 'doorAddresses',
				entityId: str(p.id) ?? '',
				operation: 'upsert',
				payload: p
			})),
			...(sc.doorVisits ?? []).map((p) => ({
				entityType: 'doorVisits',
				entityId: str(p.id) ?? '',
				operation: 'upsert',
				payload: p
			})),
			...(sc.doorContacts ?? []).map((p) => ({
				entityType: 'doorContacts',
				entityId: str(p.id) ?? '',
				operation: 'upsert',
				payload: p
			})),
			...(sc.doorAppointments ?? []).map((p) => ({
				entityType: 'doorAppointments',
				entityId: str(p.id) ?? '',
				operation: 'upsert',
				payload: p
			})),
			...(sc.calendarNotes ?? []).map((p) => ({
				entityType: 'calendarNotes',
				entityId: str(p.id) ?? '',
				operation: 'upsert',
				payload: p
			})),
			...(sc.gmsDailyStats ?? []).map((p) => ({
				entityType: 'gmsDailyStats',
				entityId: str(p.id) ?? str(p.date) ?? '',
				operation: 'upsert',
				payload: p
			})),
			...(sc.porteDailyStats ?? []).map((p) => ({
				entityType: 'porteDailyStats',
				entityId: str(p.id) ?? str(p.date) ?? '',
				operation: 'upsert',
				payload: p
			}))
		].filter((r) => r.entityId.length > 0);

		let count = 0;
		for (const row of rows) {
			await ctx.runMutation(api.beastdoor.upsertBeastdoorChange, {
				entityType: row.entityType,
				entityId: row.entityId,
				operation: row.operation,
				payload: row.payload
			});
			count++;
		}
		return { count, pierreId };
	}
});
