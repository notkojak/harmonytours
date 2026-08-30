import { httpAction } from './_generated/server';
import type { ActionCtx } from './_generated/server';
import { api } from './_generated/api';

// Endpoints HTTP de l'app mobile (BeastDoor) pour écrire dans la BDD métier
// Harmony : mêmes mutations que le web (api.contacts.create, api.employes
// .listRdvCommerciaux), authentifiées par le token de session (Bearer).

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

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
	try {
		const body = await request.json();
		return body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
	} catch {
		return null;
	}
}

function text(v: unknown): string | undefined {
	return typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
}

// Sections de prospection envoyées par l'app : array de { nom?, secteur,
// membres[] }. Filtre et normalise les entrées invalides.
function parseSections(
	raw: unknown
): { nom?: string; secteur: string; membres: string[] }[] | undefined {
	if (!Array.isArray(raw)) return undefined;
	const out: { nom?: string; secteur: string; membres: string[] }[] = [];
	for (const item of raw) {
		if (!item || typeof item !== 'object') continue;
		const o = item as Record<string, unknown>;
		const secteur = typeof o.secteur === 'string' ? o.secteur.trim() : '';
		const membres = Array.isArray(o.membres)
			? o.membres.filter((m): m is string => typeof m === 'string')
			: [];
		const nom = typeof o.nom === 'string' ? o.nom.trim() : '';
		if (!secteur && membres.length === 0 && !nom) continue; // section vide
		out.push({ ...(nom ? { nom } : {}), secteur, membres });
	}
	return out.length > 0 ? out : undefined;
}

// Identité de l'utilisateur connecté, ou null si non authentifié. Quand le
// token est expiré/invalide, Convex lève « Could not verify OIDC token claim »
// au lieu de renvoyer null : on la convertit en null pour que l'endpoint
// réponde 401 proprement et que l'app coupe la session (et non l'erreur brute).
async function getIdentity(ctx: ActionCtx) {
	try {
		return await ctx.auth.getUserIdentity();
	} catch {
		return null;
	}
}

// POST /api/mobile/contacts — crée un contact Harmony (même structure que le
// web : statut actif, agence et créateur = utilisateur connecté, suivi RDV/rappel).
export const createContact = httpAction(async (ctx, request) => {
	if (request.method === 'OPTIONS') return json({ ok: true }, 204);
	if (request.method !== 'POST') {
		return json({ ok: false, error: 'Méthode non autorisée.' }, 405);
	}

	const identity = await getIdentity(ctx);
	if (!identity) return json({ ok: false, error: 'Session expirée. Reconnecte-toi.' }, 401);

	const body = await readJson(request);
	const name = text(body?.name);
	if (!name) return json({ ok: false, error: 'Le nom est requis.' }, 400);

	const source = text(body?.source);
	if (source && !['TAP', 'GMS', 'PHONE'].includes(source)) {
		return json({ ok: false, error: 'Source invalide.' }, 400);
	}

	const fu = body?.followUp;
	let followUp: Record<string, unknown> | undefined;
	if (fu && typeof fu === 'object') {
		const f = fu as Record<string, unknown>;
		followUp = {
			type: f.type === 'rappel' ? 'rappel' : 'rdv',
			date: typeof f.date === 'string' ? f.date : '',
			...(text(f.time) ? { time: text(f.time) } : {}),
			...(text(f.commercial) ? { commercial: text(f.commercial) } : {}),
			...(text(f.status) ? { status: text(f.status) } : {})
		};
	}

	try {
		const contactId = await ctx.runMutation(api.contacts.create, {
			name,
			...(text(body?.address) ? { address: text(body?.address) } : {}),
			...(text(body?.phone) ? { phone: text(body?.phone) } : {}),
			...(text(body?.projet) ? { projet: text(body?.projet) } : {}),
			...(source ? { source: source as 'TAP' | 'GMS' | 'PHONE' } : {}),
			...(text(body?.note) ? { note: text(body?.note) } : {}),
			...(followUp ? { followUp: followUp as never } : {})
		});
		return json({ ok: true, contactId });
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Création impossible.';
		return json({ ok: false, error: message }, 400);
	}
});

// POST /api/mobile/commerciaux — liste des commerciaux rattachables à un RDV
// (même périmètre que le web : hors soi-même, hors admin, agence si manager).
export const listCommerciaux = httpAction(async (ctx, request) => {
	if (request.method === 'OPTIONS') return json({ ok: true }, 204);
	if (request.method !== 'POST') {
		return json({ ok: false, error: 'Méthode non autorisée.' }, 405);
	}

	const identity = await getIdentity(ctx);
	if (!identity) return json({ ok: false, error: 'Session expirée. Reconnecte-toi.' }, 401);

	const commerciaux = await ctx.runQuery(api.employes.listRdvCommerciaux, {});
	return json({ ok: true, commerciaux });
});

// POST /api/mobile/contacts/get — renvoie un contact Harmony par id (pour
// préremplir le formulaire d'édition depuis la carte).
export const getContact = httpAction(async (ctx, request) => {
	if (request.method === 'OPTIONS') return json({ ok: true }, 204);
	if (request.method !== 'POST') {
		return json({ ok: false, error: 'Méthode non autorisée.' }, 405);
	}

	const identity = await getIdentity(ctx);
	if (!identity) return json({ ok: false, error: 'Session expirée. Reconnecte-toi.' }, 401);

	const body = await readJson(request);
	const contactId = text(body?.contactId);
	if (!contactId) return json({ ok: false, error: 'contactId requis.' }, 400);

	try {
		const contact = await ctx.runQuery(api.contacts.getById, {
			contactId: contactId as never
		});
		return json({ ok: true, contact });
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Contact introuvable.';
		return json({ ok: false, error: message }, 400);
	}
});

// POST /api/mobile/contacts/update — modifie un contact Harmony (mêmes champs
// et mêmes règles que le web : créateur ou commercial lié au RDV).
export const updateContact = httpAction(async (ctx, request) => {
	if (request.method === 'OPTIONS') return json({ ok: true }, 204);
	if (request.method !== 'POST') {
		return json({ ok: false, error: 'Méthode non autorisée.' }, 405);
	}

	const identity = await getIdentity(ctx);
	if (!identity) return json({ ok: false, error: 'Session expirée. Reconnecte-toi.' }, 401);

	const body = await readJson(request);
	const contactId = text(body?.contactId);
	if (!contactId) return json({ ok: false, error: 'contactId requis.' }, 400);

	const source = text(body?.source);
	if (source && !['TAP', 'GMS', 'PHONE'].includes(source)) {
		return json({ ok: false, error: 'Source invalide.' }, 400);
	}

	const fu = body?.followUp;
	let followUp: Record<string, unknown> | undefined;
	if (fu && typeof fu === 'object') {
		const f = fu as Record<string, unknown>;
		followUp = {
			type: f.type === 'rappel' ? 'rappel' : 'rdv',
			date: typeof f.date === 'string' ? f.date : '',
			...(text(f.time) ? { time: text(f.time) } : {}),
			...(text(f.commercial) ? { commercial: text(f.commercial) } : {}),
			...(text(f.status) ? { status: text(f.status) } : {})
		};
	}

	try {
		await ctx.runMutation(api.contacts.update, {
			contactId: contactId as never,
			...(body?.name !== undefined && body?.name !== null ? { name: text(body.name) } : {}),
			...(body?.address !== undefined && body?.address !== null
				? { address: text(body.address) }
				: {}),
			...(body?.phone !== undefined && body?.phone !== null ? { phone: text(body.phone) } : {}),
			...(body?.projet !== undefined && body?.projet !== null ? { projet: text(body.projet) } : {}),
			...(source !== undefined ? { source: source as 'TAP' | 'GMS' | 'PHONE' } : {}),
			...(body?.note !== undefined && body?.note !== null ? { note: text(body.note) } : {}),
			...(followUp ? { followUp: followUp as never } : {})
		});
		return json({ ok: true });
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Mise à jour impossible.';
		return json({ ok: false, error: message }, 400);
	}
});

// POST /api/mobile/contacts/delete — supprime un contact Harmony (créateur
// uniquement). Le RDV/rappel lié est supprimé avec le contact.
export const deleteContact = httpAction(async (ctx, request) => {
	if (request.method === 'OPTIONS') return json({ ok: true }, 204);
	if (request.method !== 'POST') {
		return json({ ok: false, error: 'Méthode non autorisée.' }, 405);
	}

	const identity = await getIdentity(ctx);
	if (!identity) return json({ ok: false, error: 'Session expirée. Reconnecte-toi.' }, 401);

	const body = await readJson(request);
	const contactId = text(body?.contactId);
	if (!contactId) return json({ ok: false, error: 'contactId requis.' }, 400);

	try {
		await ctx.runMutation(api.contacts.remove, {
			contactId: contactId as never
		});
		return json({ ok: true });
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Suppression impossible.';
		return json({ ok: false, error: message }, 400);
	}
});

// POST /api/mobile/contacts/follow-up — mise à jour rapide du RDV depuis la
// fiche : statut (avec raisons pour déballé/annulé) et commercial (binôme).
// Mêmes règles que le web : créateur ou commercial lié, RDV existant.
export const setFollowUp = httpAction(async (ctx, request) => {
	if (request.method === 'OPTIONS') return json({ ok: true }, 204);
	if (request.method !== 'POST') {
		return json({ ok: false, error: 'Méthode non autorisée.' }, 405);
	}

	const identity = await getIdentity(ctx);
	if (!identity) return json({ ok: false, error: 'Session expirée. Reconnecte-toi.' }, 401);

	const body = await readJson(request);
	const contactId = text(body?.contactId);
	if (!contactId) return json({ ok: false, error: 'contactId requis.' }, 400);

	const status = typeof body?.status === 'string' ? body.status : undefined;
	const commercial = typeof body?.commercial === 'string' ? body.commercial : undefined;
	const nonVenteReason = typeof body?.nonVenteReason === 'string' ? body.nonVenteReason : undefined;
	const annulationReason =
		typeof body?.annulationReason === 'string' ? body.annulationReason : undefined;

	try {
		await ctx.runMutation(api.contacts.setFollowUpFields, {
			contactId: contactId as never,
			...(status !== undefined ? { status: status as never } : {}),
			...(commercial !== undefined ? { commercial } : {}),
			...(nonVenteReason !== undefined ? { nonVenteReason } : {}),
			...(annulationReason !== undefined ? { annulationReason } : {})
		});
		return json({ ok: true });
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Mise à jour impossible.';
		return json({ ok: false, error: message }, 400);
	}
});

// POST /api/mobile/agenda — données complètes de l'agenda partagé (même
// logique que le web) : RDV des contacts de l'agence (clients inclus), les
// événements (réunion, formation, prospection, gestion), les membres de
// l'équipe liables, et le profil (pour les permissions).
export const agenda = httpAction(async (ctx, request) => {
	if (request.method === 'OPTIONS') return json({ ok: true }, 204);
	if (request.method !== 'POST') {
		return json({ ok: false, error: 'Méthode non autorisée.' }, 405);
	}

	const identity = await getIdentity(ctx);
	if (!identity) return json({ ok: false, error: 'Session expirée. Reconnecte-toi.' }, 401);

	const rdvs = await ctx.runQuery(api.contacts.listAgenda, { includeClients: true });
	const evenements = await ctx.runQuery(api.evenements.list, {});
	const membres = await ctx.runQuery(api.evenements.listMembres, {});
	const profile = await ctx.runQuery(api.users.getProfile, {});
	return json({ ok: true, rdvs, evenements, membres, profile });
});

// POST /api/mobile/evenements — crée un événement d'agenda (mêmes champs et
// règles que le web : managers uniquement).
export const createEvenement = httpAction(async (ctx, request) => {
	if (request.method === 'OPTIONS') return json({ ok: true }, 204);
	if (request.method !== 'POST') {
		return json({ ok: false, error: 'Méthode non autorisée.' }, 405);
	}

	const identity = await getIdentity(ctx);
	if (!identity) return json({ ok: false, error: 'Session expirée. Reconnecte-toi.' }, 401);

	const body = await readJson(request);
	const type = text(body?.type);
	const titre = text(body?.titre);
	const date = text(body?.date);
	const start = text(body?.start);
	const end = text(body?.end);
	if (!type || !titre || !date || !start || !end) {
		return json({ ok: false, error: 'Champs requis : type, titre, date, start, end.' }, 400);
	}
	const secteur = text(body?.secteur);
	const membresRaw = body?.membres;
	const membres = Array.isArray(membresRaw)
		? membresRaw.filter((m): m is string => typeof m === 'string')
		: undefined;
	const sectionsRaw = body?.sections;
	const sections = parseSections(sectionsRaw);

	try {
		await ctx.runMutation(api.evenements.create, {
			type: type as never,
			titre,
			date,
			start,
			end,
			...(secteur ? { secteur } : {}),
			...(membres && membres.length > 0 ? { membres: membres as never } : {}),
			...(sections && sections.length > 0 ? { sections: sections as never } : {})
		});
		return json({ ok: true });
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Création impossible.';
		return json({ ok: false, error: message }, 400);
	}
});

// POST /api/mobile/evenements/update — modifie/déplace un événement (date,
// horaires, type, intitulé, secteur, membres). Seuls les champs fournis sont
// mis à jour ; un secteur/membres vidé est retiré.
export const updateEvenement = httpAction(async (ctx, request) => {
	if (request.method === 'OPTIONS') return json({ ok: true }, 204);
	if (request.method !== 'POST') {
		return json({ ok: false, error: 'Méthode non autorisée.' }, 405);
	}

	const identity = await getIdentity(ctx);
	if (!identity) return json({ ok: false, error: 'Session expirée. Reconnecte-toi.' }, 401);

	const body = await readJson(request);
	const eventId = text(body?.eventId);
	if (!eventId) return json({ ok: false, error: 'eventId requis.' }, 400);

	const type = text(body?.type);
	const titre = text(body?.titre);
	const date = text(body?.date);
	const start = text(body?.start);
	const end = text(body?.end);
	const secteurRaw = body?.secteur;
	const secteur = typeof secteurRaw === 'string' ? secteurRaw.trim() || undefined : undefined;
	const membresRaw = body?.membres;
	const membres = Array.isArray(membresRaw)
		? membresRaw.filter((m): m is string => typeof m === 'string')
		: undefined;
	const sectionsRaw = body?.sections;
	const sections = body?.sections !== undefined ? parseSections(sectionsRaw) : undefined;

	try {
		await ctx.runMutation(api.evenements.update, {
			eventId: eventId as never,
			...(type ? { type: type as never } : {}),
			...(titre ? { titre } : {}),
			...(date ? { date } : {}),
			...(start ? { start } : {}),
			...(end ? { end } : {}),
			...(secteurRaw !== undefined ? { secteur: secteur as never } : {}),
			...(membresRaw !== undefined ? { membres: (membres ?? []) as never } : {}),
			...(sections !== undefined ? { sections: (sections ?? []) as never } : {})
		});
		return json({ ok: true });
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Mise à jour impossible.';
		return json({ ok: false, error: message }, 400);
	}
});

// POST /api/mobile/evenements/delete — supprime un événement (managers
// uniquement, même périmètre que le web).
export const deleteEvenement = httpAction(async (ctx, request) => {
	if (request.method === 'OPTIONS') return json({ ok: true }, 204);
	if (request.method !== 'POST') {
		return json({ ok: false, error: 'Méthode non autorisée.' }, 405);
	}

	const identity = await getIdentity(ctx);
	if (!identity) return json({ ok: false, error: 'Session expirée. Reconnecte-toi.' }, 401);

	const body = await readJson(request);
	const eventId = text(body?.eventId);
	if (!eventId) return json({ ok: false, error: 'eventId requis.' }, 400);

	try {
		await ctx.runMutation(api.evenements.remove, {
			eventId: eventId as never
		});
		return json({ ok: true });
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Suppression impossible.';
		return json({ ok: false, error: message }, 400);
	}
});
