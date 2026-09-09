<script lang="ts">
	import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Plus, Trash2 } from '@lucide/svelte';
	import { useMutation, useQuery } from 'convex-svelte';
	import { api } from '../../convex/_generated/api.js';
	import type { Id } from '../../convex/_generated/dataModel.js';
	import { authState } from '$lib/auth-state.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import { Tabs, TabsList, TabsTrigger } from '$lib/components/ui/tabs/index.js';
	import {
		Dialog,
		DialogContent,
		DialogClose,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog/index.js';
	import ContactDialog, { type ContactRow } from '$lib/components/ContactDialog.svelte';
	import AgendaEventDialog, { type MembreRow } from '$lib/components/AgendaEventDialog.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import { formatPhone } from '$lib/data/phone';

	// Agenda partagé : RDV de toute l'agence (includeClients : les RDV des
	// contacts devenus clients restent visibles).
	const contacts = useQuery(api.contacts.listAgenda, () =>
		authState.isAuthenticated ? { includeClients: true } : 'skip'
	);
	const profile = useQuery(api.users.getProfile, () => (authState.isAuthenticated ? {} : 'skip'));
	const updateContact = useMutation(api.contacts.update);

	// Seul le créateur du RDV (ou le commercial lié, en binôme) peut le déplacer.
	const myName = $derived(
		`${profile.data?.firstName ?? ''} ${profile.data?.lastName ?? ''}`.trim().toLowerCase()
	);
	const myId = $derived(profile.data?._id ?? null);

	function canMoveRdv(contact: ContactRow): boolean {
		return (
			(!!contact.createdBy && myId !== null && contact.createdBy === myId) ||
			(!!contact.followUp?.commercial &&
				contact.followUp.commercial.trim().toLowerCase() === myName)
		);
	}

	// --- Événements d'agenda (réunion, formation, prospection, gestion) ---
	const evenements = useQuery(api.evenements.list, () => (authState.isAuthenticated ? {} : 'skip'));
	const membresEquipe = useQuery(api.evenements.listMembres, () =>
		authState.isAuthenticated ? {} : 'skip'
	);
	const createEvenement = useMutation(api.evenements.create);
	const removeEvenement = useMutation(api.evenements.remove);
	const updateEvenement = useMutation(api.evenements.update);
	// La catégorie « Gestion » n'est visible (ni créable) que par l'administrateur
	// et le directeur de zone : on filtre les événements de type gestion sinon.
	const canSeeGestion = $derived(
		['administrateur', 'directeur de zone'].includes(profile.data?.role ?? '')
	);
	const events = $derived(
		(evenements.data ?? []).filter((e) => canSeeGestion || e.type !== 'gestion')
	);
	const canCreateEvents = $derived(
		[
			'administrateur',
			'directeur de zone',
			'animateur de zone',
			'animateur',
			"directeur d'agence"
		].includes(profile.data?.role ?? '')
	);

	type EventRow = {
		_id: string;
		type: 'réunion' | 'formation' | 'prospection' | 'gestion';
		titre: string;
		date: string;
		start: string;
		end: string;
		secteur?: string | null;
		membres?: string[] | null;
		membreNames?: string[] | null;
		sections?:
			| {
					nom?: string | null;
					secteur: string;
					membres: string[];
					membreNames?: string[];
			  }[]
			| null;
	};

	const EVENT_STYLE: Record<string, string> = {
		réunion: 'bg-violet-500/20 text-violet-300 light:bg-violet-500/15 light:text-violet-700',
		formation: 'bg-yellow-500/20 text-yellow-300 light:bg-yellow-500/15 light:text-yellow-700',
		prospection: 'bg-rose-500/20 text-rose-300 light:bg-rose-500/15 light:text-rose-700',
		gestion: 'bg-violet-500/20 text-violet-300 light:bg-violet-500/15 light:text-violet-700'
	};

	// Émoji affiché dans la puce selon le type.
	const EVENT_EMOJI: Record<string, string> = {
		réunion: '👨‍🏫',
		formation: '🎓',
		prospection: '🔎',
		gestion: '📁'
	};
	const RDV_EMOJI = '💼';

	const eventsByDate = $derived.by(() => {
		const map = new Map<string, EventRow[]>();
		for (const e of events) {
			const list = map.get(e.date) ?? [];
			list.push(e);
			map.set(e.date, list);
		}
		for (const list of map.values()) {
			list.sort((a, b) => a.start.localeCompare(b.start));
		}
		return map;
	});

	// Réunion : créneau fixe lundi et vendredi matin 8h30–9h30.
	function isReunionDay(day: Date): boolean {
		const d = day.getDay();
		return d === 1 || d === 5;
	}

	type AgendaBlock = {
		id: string;
		kind: 'rdv' | 'evenement' | 'gestion' | 'reunion';
		startSlot: number;
		endSlot: number;
		lane: number;
		totalLanes: number;
		rdv?: ContactRow;
		evenement?: EventRow;
	};

	// Répartit les blocs d'un jour en « lanes », par cluster d'overlap : seuls
	// les blocs qui se chevauchent sont divisés en colonnes. Un blocs isolé (qui
	// ne chevauche personne) prend TOUTE la largeur, quelles que soient les
	// colonnes nécessaires ailleurs dans la journée.
	function layoutBlocks(
		blocks: { id: string; startSlot: number; endSlot: number }[]
	): Map<string, { lane: number; total: number }> {
		// Union-find des blocs qui se chevauchent (overlap d'intervalles).
		const parent = blocks.map((_, i) => i);
		const find = (x: number): number => {
			while (parent[x] !== x) {
				parent[x] = parent[parent[x]];
				x = parent[x];
			}
			return x;
		};
		const union = (a: number, b: number) => {
			parent[find(a)] = find(b);
		};
		for (let i = 0; i < blocks.length; i++) {
			for (let j = i + 1; j < blocks.length; j++) {
				const a = blocks[i];
				const b = blocks[j];
				if (a.startSlot < b.endSlot && b.startSlot < a.endSlot) union(i, j);
			}
		}
		// Groupes (clusters) de blocs connectés.
		const groups = new Map<number, number[]>();
		for (let i = 0; i < blocks.length; i++) {
			const r = find(i);
			groups.set(r, [...(groups.get(r) ?? []), i]);
		}
		const positions = new Map<string, { lane: number; total: number }>();
		for (const idxs of groups.values()) {
			const sorted = [...idxs].sort(
				(a, b) => blocks[a].startSlot - blocks[b].startSlot || blocks[b].endSlot - blocks[a].endSlot
			);
			const laneEnds: number[] = [];
			for (const idx of sorted) {
				const b = blocks[idx];
				let lane = laneEnds.findIndex((end) => end <= b.startSlot);
				if (lane === -1) {
					lane = laneEnds.length;
					laneEnds.push(0);
				}
				laneEnds[lane] = b.endSlot;
				positions.set(b.id, { lane, total: Math.max(1, laneEnds.length) });
			}
		}
		return positions;
	}

	const blocksByDate = $derived.by(() => {
		const map = new Map<string, AgendaBlock[]>();
		for (const [date, list] of rdvsByDate) {
			map.set(
				date,
				list.map((rdv) => {
					const startSlot = timeToSlot(rdv.followUp?.time);
					return {
						id: rdv._id,
						kind: 'rdv',
						startSlot,
						endSlot: Math.min(timeSlots.length, startSlot + 4),
						lane: 0,
						totalLanes: 1,
						rdv
					};
				})
			);
		}
		for (const [date, list] of eventsByDate) {
			const blocks: AgendaBlock[] = list.map((e) => {
				const startSlot = timeToSlot(e.start);
				return {
					id: e._id,
					kind: 'evenement',
					startSlot,
					endSlot: Math.max(startSlot + 1, timeToSlot(e.end)),
					lane: 0,
					totalLanes: 1,
					evenement: e
				};
			});
			map.set(date, [...(map.get(date) ?? []), ...blocks]);
		}
		// Créneau fixe « Réunion » (lundi et vendredi matin 8h30–9h30).
		for (const day of gridDays) {
			if (isReunionDay(day)) {
				const date = toISO(day);
				map.set(date, [
					...(map.get(date) ?? []),
					{
						id: `reunion-${date}-1`,
						kind: 'reunion',
						startSlot: timeToSlot('08:30'),
						endSlot: timeToSlot('09:30'),
						lane: 0,
						totalLanes: 1
					}
				]);
			}
		}
		for (const [date, blocks] of map) {
			const positions = layoutBlocks(blocks);
			map.set(
				date,
				blocks.map((b) => {
					const p = positions.get(b.id) ?? { lane: 0, total: 1 };
					return { ...b, lane: p.lane, totalLanes: p.total };
				})
			);
		}
		return map;
	});

	function blockStyle(b: { startSlot: number; endSlot: number; lane: number; totalLanes: number }) {
		const top = b.startSlot * ROW_H;
		const height = Math.min((b.endSlot - b.startSlot) * ROW_H, GRID_H - top);
		const widthPct = 100 / b.totalLanes;
		const leftPct = b.lane * widthPct;
		return `top:${top}px;height:${height}px;left:calc(${leftPct}% + 2px);width:calc(${widthPct}% - 4px);`;
	}

	// --- Création / édition d'événement ---
	let createOpen = $state(false);
	let createDate = $state('');
	let createStart = $state('09:00');
	let createEnd = $state('10:00');
	let editOpen = $state(false);
	let editEvent = $state<EventRow | null>(null);
	let previewOpen = $state(false);
	let previewEvent = $state<EventRow | null>(null);

	function openEditEvent(ev: EventRow) {
		if (!canCreateEvents) return;
		editEvent = ev;
		editOpen = true;
	}

	// Aperçu d'un événement (au clic) ; le bouton « Modifier » ouvre l'édition.
	function openEventPreview(ev: EventRow) {
		previewEvent = ev;
		previewOpen = true;
	}

	function startEditFromPreview() {
		const ev = previewEvent;
		if (!ev || !canCreateEvents) return;
		previewOpen = false;
		openEditEvent(ev);
	}

	function openCreateDialog(date: string, startTime?: string) {
		createDate = date;
		createStart = startTime ?? '09:00';
		const [h, m] = createStart.split(':').map(Number);
		const d = new Date(2000, 0, 1, (h || 9) + 1, m || 0);
		createEnd = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
		createOpen = true;
	}

	let deleteOpen = $state(false);
	let deleteTarget = $state<EventRow | null>(null);

	// Ouvre la popup de confirmation de suppression (shadcn).
	function askDelete(e: EventRow) {
		deleteTarget = e;
		deleteOpen = true;
	}

	async function confirmDelete() {
		const e = deleteTarget;
		if (!e) return;
		try {
			await removeEvenement({ eventId: e._id as Id<'evenements'> });
		} catch (err) {
			console.error('Suppression événement', err);
		} finally {
			previewOpen = false;
			deleteOpen = false;
			deleteTarget = null;
		}
	}

	// RDV du connecté : suivi courant de type RDV, contacts non traités.
	const rdvs = $derived(
		(contacts.data ?? []).filter((c) => c.followUp?.type === 'rdv' && c.statut !== 'traité')
	);

	const rdvsByDate = $derived.by(() => {
		const map = new Map<string, ContactRow[]>();
		for (const c of rdvs) {
			const date = c.followUp?.date;
			if (!date) continue;
			map.set(date, [...(map.get(date) ?? []), c]);
		}
		for (const list of map.values()) {
			list.sort((a, b) => (a.followUp?.time ?? '').localeCompare(b.followUp?.time ?? ''));
		}
		return map;
	});

	// --- Navigation de période ---
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	let anchor = $state(new Date(today));
	let view = $state<'jour' | 'mois'>('mois');

	const monday = $derived.by(() => {
		const d = new Date(anchor);
		d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
		return d;
	});

	const weekDays = $derived.by(() =>
		Array.from({ length: 6 }, (_, i) => {
			const d = new Date(monday);
			d.setDate(monday.getDate() + i);
			return d;
		})
	);

	// Colonnes affichées : un seul jour en vue « jour », lundi → samedi sinon.
	const gridDays = $derived(view === 'jour' ? [anchor] : weekDays);

	// Grille (colonne heures + N colonnes jour) adaptée à la vue.
	const gridColsClass = $derived(
		view === 'jour' ? 'grid-cols-[52px_1fr]' : 'grid-cols-[52px_repeat(6,1fr)]'
	);
	const gridMinW = $derived(view === 'jour' ? 'min-w-[300px]' : 'min-w-[880px] max-md:min-w-0');

	const monthCells = $derived.by(() => {
		const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
		const start = new Date(first);
		start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
		// 6 semaines × 6 jours (lundi → samedi), sans les dimanches.
		return Array.from({ length: 42 }, (_, i) => {
			const d = new Date(start);
			d.setDate(start.getDate() + i);
			return d;
		}).filter((d) => d.getDay() !== 0);
	});

	// Vue mois : fusion RDV + événements + créneaux fixes Gestion dossier, triés
	// par heure pour chaque jour.
	type MonthItem =
		| { id: string; kind: 'rdv'; time: string; rdv: ContactRow }
		| { id: string; kind: 'evenement'; time: string; evenement: EventRow }
		| { id: string; kind: 'gestion'; time: string }
		| { id: string; kind: 'reunion'; time: string };

	const monthItemsByDate = $derived.by(() => {
		const map = new Map<string, MonthItem[]>();
		for (const [date, list] of rdvsByDate) {
			map.set(
				date,
				list.map((rdv) => ({
					id: rdv._id,
					kind: 'rdv' as const,
					time: rdv.followUp?.time ?? '',
					rdv
				}))
			);
		}
		for (const [date, list] of eventsByDate) {
			const items: MonthItem[] = list.map((e) => ({
				id: e._id,
				kind: 'evenement' as const,
				time: e.start,
				evenement: e
			}));
			map.set(date, [...(map.get(date) ?? []), ...items]);
		}
		for (const cell of monthCells) {
			if (isReunionDay(cell)) {
				const date = toISO(cell);
				map.set(date, [
					...(map.get(date) ?? []),
					{ id: `reunion-${date}`, kind: 'reunion' as const, time: '08:30' }
				]);
			}
		}
		for (const list of map.values()) {
			list.sort((a, b) => a.time.localeCompare(b.time));
		}
		return map;
	});

	// Créneaux à la demi-heure, de 08:00 à 20:00 inclus.
	const timeSlots = Array.from({ length: 25 }, (_, i) => {
		const total = 8 * 60 + i * 30; // minutes depuis minuit
		return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
	});
	const ROW_H = 26; // hauteur d'un créneau demi-heure (px)
	const GRID_H = timeSlots.length * ROW_H; // hauteur totale de la grille semaine

	// Position (en créneaux demi-heure) d'une heure « HH:MM » dans la grille (08:00 → 20:00).
	function timeToSlot(time: string | null | undefined): number {
		if (!time) return 6; // 11:00 par défaut (6 demi-heures après 08:00)
		const [h, m] = time.split(':').map(Number);
		if (Number.isNaN(h)) return 6;
		const minutes = (h || 0) * 60 + (Number.isNaN(m) ? 0 : m || 0);
		return Math.max(0, Math.min(24, Math.round((minutes - 8 * 60) / 30)));
	}

	// Pas de dimanche : la semaine de travail va du lundi au samedi.
	const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
	// Indexé par Date.getDay() (0 = dimanche) pour les en-têtes de colonne.
	const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

	const label = $derived(
		view === 'jour'
			? anchor.toLocaleDateString('fr-FR', {
					weekday: 'long',
					day: 'numeric',
					month: 'long',
					year: 'numeric'
				})
			: anchor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
	);

	function toISO(date: Date): string {
		return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
			date.getDate()
		).padStart(2, '0')}`;
	}

	function sameDay(a: Date, b: Date): boolean {
		return (
			a.getFullYear() === b.getFullYear() &&
			a.getMonth() === b.getMonth() &&
			a.getDate() === b.getDate()
		);
	}

	function prev() {
		if (view === 'jour') anchor = new Date(anchor.getTime() - 86400000);
		else anchor = new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1);
	}

	function next() {
		if (view === 'jour') anchor = new Date(anchor.getTime() + 86400000);
		else anchor = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
	}

	// --- Glisser-déposer (pointer events) : déplace la date (et l'heure en vue
	// jour/semaine) d'un RDV ou d'un événement. On calcule nous-mêmes la cellule
	// survolée via elementFromPoint : pas de dépendance au hit-test du drag natif.
	type DragPayload = { kind: 'rdv'; rdv: ContactRow } | { kind: 'evenement'; evenement: EventRow };
	let dragBlock = $state<DragPayload | null>(null);
	// Cible de dépôt survolée — sert à afficher l'ombre pendant le glissement.
	// `slot` est l'index du créneau demi-heure (0 = 08:00), `time` l'heure précise.
	let dragTarget = $state<{ date: string; slot?: number; time?: string } | null>(null);
	// Position de départ du pointeur — pour distinguer un clic d'un vrai glissement.
	let dragStart = $state<{ x: number; y: number } | null>(null);
	let didDrag = $state(false);

	let gridRoot: HTMLElement | undefined = $state();
	let weekHoursEl: HTMLElement | undefined = $state();
	let monthCellsEl: HTMLElement | undefined = $state();

	// RDV : créateur ou commercial lié (binôme). Événements : managers uniquement.
	function canDrag(payload: DragPayload): boolean {
		return payload.kind === 'rdv' ? canMoveRdv(payload.rdv) : canCreateEvents;
	}

	function startDrag(
		e: PointerEvent,
		payload: { kind: 'rdv'; rdv: ContactRow } | { kind: 'evenement'; evenement: EventRow }
	) {
		if (e.button !== 0 || !canDrag(payload)) return;
		dragBlock = payload;
		dragTarget = null;
		didDrag = false;
		dragStart = { x: e.clientX, y: e.clientY };
		// On capture le pointeur : tous les pointermove suivants arrivent sur la puce,
		// même quand le curseur sort de ses limites pendant le glissement.
		(e.currentTarget as HTMLElement | null)?.setPointerCapture?.(e.pointerId);
		e.preventDefault();
	}

	function isTarget(date: string, slot?: number): boolean {
		return !!dragTarget && dragTarget.date === date && dragTarget.slot === slot;
	}

	function updateDragTarget(e: PointerEvent) {
		if (!dragBlock) return;
		// Un simple clic (sans déplacement) ne doit pas être traité comme un drag.
		const start = dragStart;
		if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 6) {
			didDrag = false;
			return;
		}
		didDrag = true;
		const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
		if (!el) return;
		if (view !== 'mois' && weekHoursEl && gridRoot) {
			// On remonte à la colonne jour (porteur de data-date), puis on calcule
			// le créneau demi-heure précis depuis la position verticale.
			const col = el.closest('[data-date]') as HTMLElement | null;
			if (!col) return;
			const gridRect = gridRoot.getBoundingClientRect();
			const y = Math.max(0, e.clientY - gridRect.top);
			const slot = Math.min(timeSlots.length - 1, Math.round(y / ROW_H));
			dragTarget = {
				date: col.dataset.date!,
				slot,
				time: timeSlots[slot]
			};
		} else if (view === 'mois' && monthCellsEl) {
			const cell = el.closest('[data-date]') as HTMLElement | null;
			if (!cell) return;
			dragTarget = { date: cell.dataset.date! };
		}
	}

	function moveRdv(contactId: string, date: string, time?: string) {
		const contact = rdvs.find((c) => c._id === contactId);
		if (!contact) return;
		updateContact({
			contactId: contactId as Id<'contacts'>,
			followUp: {
				type: 'rdv',
				date,
				time: time ?? contact.followUp?.time ?? undefined,
				// On conserve le commercial rattaché, le type (motif) et le statut du
				// RDV déplacé.
				commercial: contact.followUp?.commercial ?? undefined,
				motif: contact.followUp?.motif ?? undefined,
				status:
					(contact.followUp?.status as 'annulé' | 'déballé' | 'vendu' | undefined) ?? undefined
			}
		});
	}

	async function moveEvent(ev: EventRow, date: string, time?: string) {
		try {
			await updateEvenement({
				eventId: ev._id as Id<'evenements'>,
				date,
				start: time ?? ev.start,
				end: ev.end
			});
		} catch (err) {
			console.error('Déplacement événement', err);
		}
	}

	function endDrag() {
		if (dragBlock && dragTarget) {
			const t = dragTarget;
			if (dragBlock.kind === 'rdv') {
				moveRdv(
					dragBlock.rdv._id,
					t.date,
					view === 'mois' ? (dragBlock.rdv.followUp?.time ?? undefined) : t.time
				);
			} else {
				moveEvent(dragBlock.evenement, t.date, view === 'mois' ? undefined : t.time);
			}
		}
		dragBlock = null;
		dragTarget = null;
		dragStart = null;
		// NB : `didDrag` n'est PAS remis à zéro ici — le click déclenché après le
		// pointerup doit encore savoir qu'un glissement a eu lieu pour l'ignorer.
	}

	// --- Fiche contact ---
	let selected = $state<ContactRow | null>(null);
	let dialogOpen = $state(false);

	function openFiche(contact: ContactRow) {
		selected = contact;
		dialogOpen = true;
	}

	const chipBase = 'overflow-hidden rounded-md text-left text-[11px] font-medium transition-colors';
	const chipWeek = `${chipBase} absolute right-1 left-1 z-10 flex flex-col items-start gap-1 px-2 py-1.5 max-md:gap-0 max-md:px-1 max-md:py-1 max-md:text-[10px]`;
	const chipMonth = `${chipBase} flex w-full items-start gap-1.5 px-2 py-1 max-md:gap-0.5 max-md:px-1 max-md:py-0.5 max-md:text-[9.5px]`;
	// Curseur : main (glisser-déposer) si on peut déplacer le RDV, sinon flèche
	// normale (lecture seule).
	const chipCursor = (rdv: ContactRow) =>
		canMoveRdv(rdv) ? 'cursor-grab touch-none active:cursor-grabbing' : 'cursor-default';
	// Idem pour les événements : main (glisser-déposer) pour les managers, sinon
	// pointeur (un clic ouvre la prévisualisation).
	const eventCursor = () =>
		canCreateEvents ? 'cursor-grab touch-none active:cursor-grabbing' : 'cursor-pointer';

	// Couleurs du RDV selon son statut : bleu (en attente), violet (déballé),
	// rouge (annulé), vert (vendu). Un RDV « Confortation » ou « Gestion
	// dossier » encore programmé s'affiche en violet comme une réunion.
	const rdvStatusClass = (status: string | null | undefined, motif?: string | null | undefined) =>
		status === 'déballé'
			? 'bg-violet-500/15 text-violet-400 hover:bg-violet-500/25 light:bg-violet-500/15 light:text-violet-700 light:hover:bg-violet-500/25'
			: status === 'annulé'
				? 'bg-red-500/15 text-red-400 hover:bg-red-500/25 light:bg-red-500/15 light:text-red-700 light:hover:bg-red-500/25'
				: status === 'vendu'
					? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 light:bg-emerald-500/15 light:text-emerald-700 light:hover:bg-emerald-500/25'
					: motif === 'confortation' || motif === 'gestion'
						? 'bg-violet-500/15 text-violet-400 hover:bg-violet-500/25 light:bg-violet-500/15 light:text-violet-700 light:hover:bg-violet-500/25'
						: 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 light:bg-blue-500/15 light:text-blue-700 light:hover:bg-blue-500/25';

	const rdvGhostClass = (status: string | null | undefined, motif?: string | null | undefined) =>
		status === 'déballé'
			? 'border-violet-500/60 bg-violet-500/10 text-violet-400/70 light:text-violet-700/80'
			: status === 'annulé'
				? 'border-red-500/60 bg-red-500/10 text-red-400/70 light:text-red-700/80'
				: status === 'vendu'
					? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-400/70 light:text-emerald-700/80'
					: motif === 'confortation' || motif === 'gestion'
						? 'border-violet-500/60 bg-violet-500/10 text-violet-400/70 light:text-violet-700/80'
						: 'border-blue-500/60 bg-blue-500/10 text-blue-400/70 light:text-blue-700/80';

	const rdvStatusLabel = (status: string | null | undefined, motif?: string | null | undefined) =>
		status === 'déballé'
			? 'Déballé'
			: status === 'annulé'
				? 'Annulé'
				: status === 'vendu'
					? 'Vendu'
					: motif === 'confortation'
						? 'Confortation'
						: motif === 'gestion'
							? 'Gestion dossier'
							: 'En attente';

	// Prénoms des commerciaux liés (la valeur peut contenir plusieurs noms,
	// séparés par « et » ou par une virgule).
	function commercialFirstNames(commercial: string | null | undefined): string[] {
		if (!commercial) return [];
		return commercial
			.split(/\s*,\s*|\s+et\s+/i)
			.map((n) => n.trim().split(/\s+/)[0])
			.filter(Boolean);
	}

	// Noms complets (prénom + nom) des commerciaux liés, séparés par « et ».
	function commercialNamesLabel(commercial: string | null | undefined): string {
		if (!commercial) return '';
		const names = commercial
			.split(/\s*,\s*|\s+et\s+/i)
			.map((n) => n.trim())
			.filter(Boolean);
		if (names.length === 0) return '';
		if (names.length === 1) return names[0];
		return `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`;
	}

	// Commerciaux liés à un RDV : le créateur du contact (commercial de base) plus
	// le commercial rattaché au RDV quand il diffère (binôme), sans doublon.
	function rdvCommercialLabel(rdv: ContactRow): string {
		const parts: string[] = [];
		if (rdv.createdByName) parts.push(commercialNamesLabel(rdv.createdByName));
		if (rdv.followUp?.commercial) parts.push(commercialNamesLabel(rdv.followUp.commercial));
		return parts.filter((n, i, a) => a.indexOf(n) === i).join(', ');
	}

	// Bulle avatar : initiale du commercial rattaché, ou de la personne connectée
	// à défaut. La photo sera ajoutée plus tard.
	function commercialInitial(commercial: string | null | undefined): string {
		const first = commercialFirstNames(commercial)[0];
		return (first ?? profile.data?.firstName ?? '').charAt(0).toUpperCase();
	}

	// Initiales (Prénom + Nom) pour les avatars des membres liés à un événement.
	const initials = (name: string) =>
		name
			.trim()
			.split(/\s+/)
			.map((w) => w.charAt(0))
			.slice(0, 2)
			.join('')
			.toUpperCase();

	// Carte « nom complet → photo » des membres de l'agence (pour afficher la
	// photo dans les bulles à la place de l'initiale quand elle est disponible).
	const photoByName = $derived.by(() => {
		const map = new Map<string, string>();
		for (const m of membresEquipe.data ?? []) {
			const key = `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim().toLowerCase();
			if (m.photo && key) map.set(key, m.photo);
		}
		const me = `${profile.data?.firstName ?? ''} ${profile.data?.lastName ?? ''}`
			.trim()
			.toLowerCase();
		if (profile.data?.photo && me) map.set(me, profile.data.photo);
		return map;
	});
	const photoFor = (name: string | null | undefined): string | undefined =>
		name ? photoByName.get(name.trim().toLowerCase()) : undefined;

	// Sections affichables d'un événement prospection : les sections stockées,
	// ou une section unique reconstruite depuis secteur/membres (rétro-compat).
	function sectionsOf(ev: EventRow): {
		nom?: string;
		secteur?: string;
		membreNames: string[];
	}[] {
		if (ev.sections && ev.sections.length > 0) {
			return ev.sections.map((s) => ({
				nom: s.nom ?? undefined,
				secteur: s.secteur,
				membreNames: (s.membreNames ?? []).filter(Boolean)
			}));
		}
		return [
			{
				secteur: ev.secteur ?? undefined,
				membreNames: (ev.membreNames ?? []).filter(Boolean)
			}
		];
	}

	const EVENT_TYPE_LABEL: Record<string, string> = {
		réunion: 'Réunion',
		formation: 'Formation',
		prospection: 'Prospection',
		gestion: 'Gestion dossier'
	};

	function fmtDate(iso: string): string {
		return new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}

	// Titre (tooltip) d'un événement : une ligne par section (équipe · secteur · membres).
	function eventTitle(ev: EventRow): string {
		const lines = [`${ev.titre} — ${ev.start}–${ev.end}`];
		for (const s of sectionsOf(ev)) {
			if (!s.nom && !s.secteur && s.membreNames.length === 0) continue;
			const parts = [s.nom, s.secteur].filter(Boolean);
			if (s.membreNames.length > 0) parts.push(`avec ${s.membreNames.join(', ')}`);
			if (parts.length > 0) lines.push(parts.join(' · '));
		}
		return lines.join('\n');
	}
</script>

<div class="space-y-5">
	<Card class="gap-0 rounded-xl border-line py-0 shadow-none">
		<CardHeader
			class="flex flex-wrap items-center justify-between gap-3 px-3 pt-4 pb-0 sm:px-5 sm:pt-5"
		>
			<CardTitle class="flex items-center gap-2.5 text-[14px] font-semibold">
				<span
					class="grid size-8 place-items-center rounded-lg border border-line bg-card2 text-muted-foreground"
				>
					<CalendarDays class="size-4" strokeWidth={1.7} />
				</span>
				Agenda
			</CardTitle>
			<Tabs value={view} onValueChange={(v) => (view = v as 'jour' | 'mois')} class="w-fit">
				<TabsList>
					<TabsTrigger value="jour">Jour</TabsTrigger>
					<TabsTrigger value="mois">Mois</TabsTrigger>
				</TabsList>
			</Tabs>
		</CardHeader>

		<CardContent class="px-2 pt-3 pb-4 sm:px-5 sm:pb-5">
			<div class="mb-3 flex flex-wrap items-center gap-2 sm:mb-4">
				<Button variant="outline" size="icon-sm" onclick={prev} aria-label="Période précédente">
					<ChevronLeft class="size-4" />
				</Button>
				<Button variant="outline" size="icon-sm" onclick={next} aria-label="Période suivante">
					<ChevronRight class="size-4" />
				</Button>
				{#if view !== 'jour'}
					<span class="text-[13px] font-medium text-foreground">{label}</span>
				{/if}
				{#if canCreateEvents}
					<Button
						variant="default"
						size="sm"
						class="ml-auto rounded-xl px-3 shadow-md shadow-primary/10"
						onclick={() => openCreateDialog(toISO(today), '09:00')}
					>
						<Plus class="size-3.5" />
						Nouvel événement
					</Button>
				{/if}
			</div>

			{#if view === 'jour'}
				<!-- Vue jour (1 colonne) ou semaine (lundi → samedi) : créneaux horaires -->
				<div class="overflow-x-auto rounded-lg border border-line">
					<div class={['grid border-b border-line bg-card2/50', gridMinW, gridColsClass].join(' ')}>
						<div></div>
						{#each gridDays as day}
							<div class="border-l border-line/50 px-2 py-2 text-center">
								<p class="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
									{DAY_LABELS[day.getDay()]}
								</p>
								<p
									class={[
										'text-[13px] font-semibold',
										sameDay(day, today) ? 'text-primary' : 'text-foreground'
									].join(' ')}
								>
									{day.getDate()}
								</p>
							</div>
						{/each}
					</div>

					<div bind:this={gridRoot} class={['grid', gridMinW, gridColsClass].join(' ')}>
						<div bind:this={weekHoursEl} class="relative">
							{#each timeSlots as slot}
								<div
									class="flex h-[26px] items-start justify-end border-b border-line/50 px-2 pt-1 font-mono text-[9.5px] leading-none text-muted-foreground last:border-b-0"
								>
									{slot.endsWith(':00') ? slot : ''}
								</div>
							{/each}
						</div>

						{#each gridDays as day}
							{@const dateISO = toISO(day)}
							<div class="relative border-l border-line/50" data-date={dateISO}>
								{#each timeSlots as slot, i}
									<div
										role="gridcell"
										tabindex="-1"
										onclick={() => {
											if (!canCreateEvents || didDrag) return;
											openCreateDialog(dateISO, slot);
										}}
										onkeydown={(e) => {
											if (e.key !== 'Enter' && e.key !== ' ') return;
											e.preventDefault();
											if (!canCreateEvents || didDrag) return;
											openCreateDialog(dateISO, slot);
										}}
										class={[
											'h-[26px] border-b border-line/50 transition-colors last:border-b-0',
											isTarget(dateISO, i) ? 'bg-blue-500/10' : 'hover:bg-glass-1',
											canCreateEvents ? 'cursor-pointer' : ''
										].join(' ')}
									></div>
								{/each}

								{#if dragTarget?.date === dateISO && dragTarget.slot !== undefined && dragBlock}
									<div
										class={[
											'pointer-events-none absolute right-1 left-1 z-0 flex flex-col items-start gap-1 overflow-hidden rounded-md border border-dashed px-2 py-1.5',
											dragBlock.kind === 'rdv'
												? rdvGhostClass(
														dragBlock.rdv.followUp?.status,
														dragBlock.rdv.followUp?.motif
													)
												: (EVENT_STYLE[dragBlock.evenement.type] ?? EVENT_STYLE.gestion)
										].join(' ')}
										style={`top:${dragTarget.slot * ROW_H}px;height:${Math.min(
											4 * ROW_H,
											GRID_H - dragTarget.slot * ROW_H
										)}px;`}
									>
										<span class="font-mono text-[10px] leading-none opacity-70">
											{dragTarget.time ?? timeSlots[dragTarget.slot]}
										</span>
										<span class="min-w-0 flex-1 truncate">
											{#if dragBlock.kind === 'rdv'}
												{dragBlock.rdv.name}{dragBlock.rdv.projet
													? ` · ${dragBlock.rdv.projet}`
													: ''}
											{:else}
												{dragBlock.evenement.titre}
											{/if}
										</span>
									</div>
								{/if}

								{#each blocksByDate.get(dateISO) ?? [] as block (block.id)}
									{#if block.kind === 'rdv' && block.rdv}
										{@const rdv = block.rdv}
										<button
											type="button"
											onpointerdown={(e) => startDrag(e, { kind: 'rdv', rdv })}
											onpointermove={(e) => updateDragTarget(e)}
											onpointerup={endDrag}
											onpointercancel={endDrag}
											onclick={() => {
												if (didDrag) return;
												openFiche(rdv);
											}}
											class={[
												chipWeek,
												rdvStatusClass(rdv.followUp?.status, rdv.followUp?.motif),
												chipCursor(rdv),
												dragBlock?.kind === 'rdv' && dragBlock.rdv._id === rdv._id
													? 'opacity-40'
													: ''
											].join(' ')}
											style={blockStyle(block)}
											title={`${rdv.name}${rdv.projet ? ` — ${rdv.projet}` : ''}${
												rdv.followUp?.commercial && !canMoveRdv(rdv)
													? ` · ${rdv.followUp.commercial}`
													: ''
											}`}
										>
											{#if block.totalLanes <= 1}
												<div class="flex w-full items-start justify-between gap-1.5">
													<div class="flex min-w-0 flex-col gap-1">
														<span
															class="hidden font-mono text-[10px] leading-none opacity-70 sm:block"
														>
															{rdv.followUp?.time ?? ''}
														</span>
														<span
															class="min-w-0 overflow-hidden text-[11px] font-medium text-ellipsis whitespace-nowrap max-md:overflow-visible max-md:text-[9.5px] max-md:whitespace-normal"
														>
															<span class="hidden sm:inline">{RDV_EMOJI}</span>
															{rdv.name}
														</span>
													</div>
													<Avatar
														photo={photoFor(rdvCommercialLabel(rdv))}
														label={commercialInitial(rdvCommercialLabel(rdv))}
														title={rdv.followUp?.commercial ?? undefined}
														class="hidden size-[18px] bg-muted text-[9px] font-semibold text-muted-foreground sm:grid"
													/>
												</div>
												{#if rdv.projet}
													<span
														class="hidden w-full truncate text-[10px] font-normal opacity-80 sm:block"
													>
														{rdv.projet}
													</span>
												{/if}
												{#if rdv.phone}
													<span
														class="hidden w-full truncate font-mono text-[10px] font-normal opacity-80 sm:block"
													>
														{formatPhone(rdv.phone)}
													</span>
												{/if}
												{#if rdvCommercialLabel(rdv)}
													<span
														class="hidden w-full truncate text-[10px] font-normal opacity-80 sm:block"
													>
														{rdvCommercialLabel(rdv)}
													</span>
												{/if}
												{#if rdv.followUp?.status || rdv.followUp?.motif}
													<span
														class="hidden w-full truncate text-[10px] font-normal opacity-80 sm:block"
													>
														{rdvStatusLabel(rdv.followUp?.status, rdv.followUp?.motif)}
													</span>
												{/if}
											{:else}
												<div class="flex w-full min-w-0 items-center gap-1 overflow-hidden">
													<span class="hidden shrink-0 sm:inline">{RDV_EMOJI}</span>
													<span
														class="min-w-0 overflow-hidden text-[10.5px] font-semibold text-ellipsis whitespace-nowrap"
													>
														{rdv.name}
													</span>
												</div>
												<span class="font-mono text-[9px] leading-none opacity-70">
													{rdv.followUp?.time ?? ''}
												</span>
											{/if}
										</button>
									{:else if block.kind === 'evenement' && block.evenement}
										{@const ev = block.evenement}
										<div
											role="button"
											tabindex="-1"
											onpointerdown={(e) => startDrag(e, { kind: 'evenement', evenement: ev })}
											onpointermove={(e) => updateDragTarget(e)}
											onpointerup={endDrag}
											onpointercancel={endDrag}
											onclick={() => {
												if (didDrag) return;
												openEventPreview(ev);
											}}
											onkeydown={(e) => {
												if (e.key !== 'Enter' && e.key !== ' ') return;
												e.preventDefault();
												if (didDrag) return;
												openEventPreview(ev);
											}}
											class={[
												'group absolute z-10 flex flex-col items-start gap-0.5 overflow-hidden rounded-md px-2 py-1 text-[11px] font-medium',
												EVENT_STYLE[ev.type] ?? EVENT_STYLE.gestion,
												eventCursor(),
												dragBlock?.kind === 'evenement' && dragBlock.evenement._id === ev._id
													? 'opacity-40'
													: ''
											].join(' ')}
											style={blockStyle(block)}
											title={eventTitle(ev)}
										>
											<span
												class="w-full overflow-hidden font-semibold text-ellipsis whitespace-nowrap max-md:overflow-visible max-md:text-[9.5px] max-md:whitespace-normal"
											>
												<span class="hidden sm:inline">{EVENT_EMOJI[ev.type] ?? ''}</span>
												{ev.titre}
											</span>
											{#if ev.type !== 'formation'}
												{#each sectionsOf(ev) as sec}
													<div class="mt-1 hidden w-full min-w-0 flex-col gap-1 sm:flex">
														<span
															class="flex w-fit max-w-full items-center gap-1.5 rounded-full bg-black/40 px-2 py-[3px] text-[11px] leading-normal font-semibold ring-1 ring-white/15"
															title={[sec.nom, sec.secteur].filter(Boolean).join(' — ')}
														>
															<span class="truncate">
																{#if sec.nom}<span class="font-bold">{sec.nom}</span
																	>{#if sec.secteur}
																		—
																	{/if}{/if}{sec.secteur}
															</span>
														</span>
														{#if sec.membreNames.length > 0}
															{#each sec.membreNames as n}
																<span class="flex min-w-0 items-center gap-1.5">
																	<Avatar
																		photo={photoFor(n)}
																		label={initials(n)}
																		class="size-5 bg-black/45 text-[9px] font-bold text-white ring-1 ring-white/25"
																	/>
																	<span class="truncate text-[11px] font-semibold opacity-95"
																		>{n}</span
																	>
																</span>
															{/each}
														{/if}
													</div>
												{/each}
											{/if}
											{#if canCreateEvents}
												<button
													type="button"
													class="absolute top-1 right-1 hidden size-4 place-items-center rounded bg-black/40 group-hover:grid hover:bg-black/70"
													title="Supprimer l'événement"
													onpointerdown={(e) => e.stopPropagation()}
													onclick={(e) => {
														e.stopPropagation();
														askDelete(ev);
													}}
												>
													<Trash2 class="size-3" />
												</button>
											{/if}
										</div>
									{:else if block.kind === 'reunion'}
										<div
											class="absolute z-10 flex flex-col items-start gap-0.5 overflow-hidden rounded-md bg-violet-500/20 px-2 py-1 text-[11px] font-medium text-violet-300 max-md:text-[9.5px] light:bg-violet-500/15 light:text-violet-700"
											style={blockStyle(block)}
											title="Réunion — créneau fixe (lundi et vendredi 8h30–9h30)"
										>
											<span
												class="w-full overflow-hidden font-semibold text-ellipsis whitespace-nowrap max-md:overflow-visible max-md:whitespace-normal"
												>📋 Réunion</span
											>
											<span class="hidden font-mono text-[10px] leading-none opacity-80 sm:block"
												>08:30–09:30</span
											>
										</div>
									{/if}
								{/each}
							</div>
						{/each}
					</div>
				</div>
			{:else}
				<!-- Vue mois -->
				<div class="overflow-x-auto rounded-lg border border-line">
					<div
						class="grid min-w-[660px] grid-cols-6 border-b border-line bg-card2/50 max-md:min-w-0"
					>
						{#each WEEKDAYS as wd}
							<div
								class="px-2 py-2 text-center text-[10px] font-semibold tracking-wider text-muted-foreground uppercase"
							>
								{wd}
							</div>
						{/each}
					</div>
					<div bind:this={monthCellsEl} class="grid min-w-[660px] grid-cols-6 max-md:min-w-0">
						{#each monthCells as cell, i}
							{@const inMonth = cell.getMonth() === anchor.getMonth()}
							{@const dateISO = toISO(cell)}
							<div
								role="gridcell"
								tabindex="-1"
								data-date={dateISO}
								onclick={(e) => {
									if (didDrag) return;
									if ((e.target as HTMLElement | null)?.closest('button, [data-static-chip]'))
										return;
									// Clic sur un jour de la vue mois → bascule en vue jour.
									const [yy, mm, dd] = dateISO.split('-').map(Number);
									anchor = new Date(yy, mm - 1, dd);
									view = 'jour';
								}}
								onkeydown={(e) => {
									if (e.key !== 'Enter' && e.key !== ' ') return;
									e.preventDefault();
									if (didDrag) return;
									const [yy, mm, dd] = dateISO.split('-').map(Number);
									anchor = new Date(yy, mm - 1, dd);
									view = 'jour';
								}}
								class={[
									'min-h-[92px] p-1.5 transition-colors max-md:min-h-[64px] max-md:p-1',
									isTarget(dateISO) ? 'bg-blue-500/10' : 'hover:bg-glass-1',
									canCreateEvents ? 'cursor-pointer' : '',
									i % 6 !== 0 ? 'border-l border-line/50' : '',
									i < 30 ? 'border-b border-line/50' : ''
								].join(' ')}
							>
								<p
									class={[
										'mb-1 flex size-6 items-center justify-center rounded-full text-[12px] font-semibold',
										sameDay(cell, today)
											? 'bg-primary text-primary-foreground'
											: inMonth
												? 'text-foreground'
												: 'text-muted-foreground/40'
									].join(' ')}
								>
									{cell.getDate()}
								</p>
								<div class="space-y-1">
									{#each monthItemsByDate.get(dateISO) ?? [] as item (item.id)}
										{#if item.kind === 'rdv' && item.rdv}
											{@const rdv = item.rdv}
											<button
												type="button"
												onpointerdown={(e) => startDrag(e, { kind: 'rdv', rdv })}
												onpointermove={(e) => updateDragTarget(e)}
												onpointerup={endDrag}
												onpointercancel={endDrag}
												onclick={(e) => {
													e.stopPropagation();
													if (didDrag) return;
													openFiche(rdv);
												}}
												class={[
													chipMonth,
													'flex-col',
													rdvStatusClass(rdv.followUp?.status, rdv.followUp?.motif),
													chipCursor(rdv)
												].join(' ')}
												title={`${rdv.name}${rdv.projet ? ` — ${rdv.projet}` : ''}${
													rdv.followUp?.commercial && !canMoveRdv(rdv)
														? ` · ${rdv.followUp.commercial}`
														: ''
												}`}
											>
												<div class="flex w-full items-center gap-1.5">
													<span class="hidden font-mono text-[10px] opacity-70 sm:block">
														{rdv.followUp?.time ?? ''}
													</span>
													<span
														class="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap max-md:overflow-visible max-md:text-[9.5px] max-md:whitespace-normal"
													>
														<span class="hidden sm:inline">{RDV_EMOJI}</span>
														{rdv.name}
													</span>
													<Avatar
														photo={photoFor(rdvCommercialLabel(rdv))}
														label={commercialInitial(rdvCommercialLabel(rdv))}
														title={rdv.followUp?.commercial ?? undefined}
														class="hidden size-[16px] bg-muted text-[8px] font-semibold text-muted-foreground sm:grid"
													/>
												</div>
												{#if rdv.projet}
													<span
														class="hidden w-full truncate text-[10px] font-normal opacity-80 sm:block"
													>
														{rdv.projet}
													</span>
												{/if}
												{#if rdv.phone}
													<span
														class="hidden w-full truncate font-mono text-[10px] font-normal opacity-80 sm:block"
													>
														{formatPhone(rdv.phone)}
													</span>
												{/if}
												{#if rdvCommercialLabel(rdv)}
													<span
														class="hidden w-full truncate text-[10px] font-normal opacity-80 sm:block"
													>
														{rdvCommercialLabel(rdv)}
													</span>
												{/if}
											</button>
										{:else if item.kind === 'evenement' && item.evenement}
											{@const ev = item.evenement}
											<div
												data-static-chip
												role="button"
												tabindex="-1"
												onpointerdown={(e) => startDrag(e, { kind: 'evenement', evenement: ev })}
												onpointermove={(e) => updateDragTarget(e)}
												onpointerup={endDrag}
												onpointercancel={endDrag}
												onclick={() => {
													if (didDrag) return;
													openEventPreview(ev);
												}}
												onkeydown={(e) => {
													if (e.key !== 'Enter' && e.key !== ' ') return;
													e.preventDefault();
													if (didDrag) return;
													openEventPreview(ev);
												}}
												class={[
													chipBase,
													'flex w-full flex-col items-start gap-0.5 px-2 py-1 max-md:gap-0.5 max-md:px-1 max-md:py-0.5 max-md:text-[9.5px]',
													EVENT_STYLE[ev.type] ?? EVENT_STYLE.gestion,
													eventCursor(),
													dragBlock?.kind === 'evenement' && dragBlock.evenement._id === ev._id
														? 'opacity-40'
														: ''
												].join(' ')}
												title={eventTitle(ev)}
											>
												<span class="flex w-full min-w-0 items-center gap-1.5">
													<span class="hidden sm:inline">{EVENT_EMOJI[ev.type] ?? ''}</span>
													<span
														class="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap max-md:overflow-visible max-md:text-[9.5px] max-md:whitespace-normal"
													>
														{ev.titre}
													</span>
												</span>
												<span class="hidden font-mono text-[10px] opacity-70 sm:block"
													>{ev.start}</span
												>
												{#if ev.type !== 'formation'}
													{#each sectionsOf(ev) as sec}
														<div class="mt-0.5 hidden min-w-0 flex-col items-start gap-0.5 sm:flex">
															<span
																class="flex w-fit max-w-full items-center gap-1 rounded-full bg-black/30 px-1.5 py-[1.5px] text-[10.5px] font-semibold ring-1 ring-white/10"
																title={[sec.nom, sec.secteur].filter(Boolean).join(' — ')}
															>
																<span class="truncate">
																	{#if sec.nom}<span class="font-bold">{sec.nom}</span
																		>{#if sec.secteur}
																			—
																		{/if}{/if}{sec.secteur}
																</span>
															</span>
															{#if sec.membreNames.length > 0}
																{#each sec.membreNames as n}
																	<span class="flex min-w-0 items-center gap-1.5">
																		<Avatar
																			photo={photoFor(n)}
																			label={initials(n)}
																			class="size-[18px] bg-black/45 text-[8.5px] font-bold text-white ring-1 ring-white/25"
																		/>
																		<span
																			class="min-w-0 truncate text-[10.5px] font-semibold opacity-95"
																			>{n}</span
																		>
																	</span>
																{/each}
															{/if}
														</div>
													{/each}
												{/if}
												{#if canCreateEvents}
													<button
														type="button"
														class="grid size-3.5 shrink-0 place-items-center rounded bg-black/40 text-[9px] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/70"
														title="Supprimer l'événement"
														onpointerdown={(e) => e.stopPropagation()}
														onclick={(e) => {
															e.stopPropagation();
															askDelete(ev);
														}}
													>
														<Trash2 class="size-2.5" />
													</button>
												{/if}
											</div>
										{:else if item.kind === 'reunion'}
											<div
												data-static-chip
												class="flex w-full items-start gap-1.5 overflow-hidden rounded-md bg-violet-500/20 px-2 py-1 text-[11px] font-medium text-violet-300 max-md:gap-0.5 max-md:px-1 max-md:py-0.5 max-md:text-[9.5px] light:bg-violet-500/15 light:text-violet-700"
												title="Réunion — créneau fixe (lundi et vendredi 8h30–9h30)"
											>
												<span class="hidden font-mono text-[10px] opacity-70 sm:block">08:30</span>
												<span
													class="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap max-md:overflow-visible max-md:text-[9.5px] max-md:whitespace-normal"
													>📋 Réunion</span
												>
											</div>
										{/if}
									{/each}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</CardContent>
	</Card>
</div>

<Dialog bind:open={deleteOpen}>
	<DialogContent class="max-w-md rounded-xl border-line bg-card">
		<DialogHeader>
			<DialogTitle>Supprimer l'événement</DialogTitle>
		</DialogHeader>
		<p class="text-[13px] leading-relaxed text-muted-foreground">
			Tu t'apprêtes à supprimer « <span class="font-semibold text-foreground"
				>{deleteTarget?.titre}</span
			>
			» {#if deleteTarget}du {fmtDate(deleteTarget.date)}{/if}. Cette action est irréversible.
		</p>
		<DialogFooter class="gap-2">
			<Button variant="outline" onclick={() => (deleteOpen = false)}>Annuler</Button>
			<Button variant="destructive" onclick={confirmDelete}>
				<Trash2 class="size-4" />
				Supprimer définitivement
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
<ContactDialog bind:contact={selected} bind:open={dialogOpen} />

{#if previewEvent}
	<Dialog bind:open={previewOpen}>
		<DialogContent class="max-w-md rounded-xl border-line bg-card">
			<DialogHeader>
				<DialogTitle class="flex items-center gap-2 text-[15px] font-semibold">
					<span
						class="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-card2 text-[15px]"
					>
						{EVENT_EMOJI[previewEvent.type] ?? ''}
					</span>
					{previewEvent.titre}
				</DialogTitle>
			</DialogHeader>

			<div class="space-y-3 text-[13px]">
				<span
					class="inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${EVENT_STYLE[
						previewEvent.type
					] ?? EVENT_STYLE.gestion}"
				>
					{EVENT_TYPE_LABEL[previewEvent.type] ?? previewEvent.type}
				</span>

				<div class="space-y-1.5">
					<p class="font-medium text-muted-foreground capitalize">
						📅 {fmtDate(previewEvent.date)}
					</p>
					<p class="font-medium text-muted-foreground">
						🕘 {previewEvent.start} – {previewEvent.end}
					</p>
				</div>

				{#if previewEvent.type === 'prospection' && sectionsOf(previewEvent).length > 0}
					<div class="space-y-2">
						<p class="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
							Sections / équipes
						</p>
						{#each sectionsOf(previewEvent) as sec}
							<div class="rounded-lg border border-line bg-base p-2.5">
								<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
									{#if sec.nom}
										<span class="text-[13px] font-bold">{sec.nom}</span>
									{/if}
									{#if sec.secteur}
										<span
											class="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground"
										>
											<MapPin class="size-3.5 shrink-0" strokeWidth={2.2} />
											{sec.secteur}
										</span>
									{/if}
								</div>
								{#if sec.membreNames.length > 0}
									<div class="mt-2 flex flex-wrap gap-1.5">
										{#each sec.membreNames as n}
											<span
												class="inline-flex items-center gap-1.5 rounded-full bg-glass-2 px-2 py-0.5 text-[11.5px] font-medium text-foreground"
											>
												<Avatar
													photo={photoFor(n)}
													label={initials(n)}
													class="size-5 bg-black/45 text-[8.5px] font-bold text-white"
												/>
												{n}
											</span>
										{/each}
									</div>
								{:else}
									<p class="mt-1.5 text-[11.5px] text-muted-foreground">Aucun membre</p>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<DialogFooter class="gap-2">
				<DialogClose>
					<Button variant="outline">Fermer</Button>
				</DialogClose>
				{#if canCreateEvents}
					<Button variant="destructive" onclick={() => askDelete(previewEvent!)}>
						<Trash2 class="size-4" />
						Supprimer
					</Button>
					<Button onclick={startEditFromPreview} class="bg-white text-black hover:bg-white/90">
						Modifier
					</Button>
				{/if}
			</DialogFooter>
		</DialogContent>
	</Dialog>
{/if}
<AgendaEventDialog
	bind:open={createOpen}
	initialDate={createDate}
	initialStart={createStart}
	initialEnd={createEnd}
	membres={membresEquipe.data ?? []}
	{canSeeGestion}
/>
<AgendaEventDialog
	bind:open={editOpen}
	editing={editEvent}
	membres={membresEquipe.data ?? []}
	{canSeeGestion}
/>
