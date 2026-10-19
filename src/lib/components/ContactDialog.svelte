<script lang="ts" module>
	export type ContactRow = {
		_id: string;
		name: string;
		civilites?: ('M.' | 'Mme' | 'Melle')[] | null;
		qualif?: Record<string, unknown> | null;
		civilite?: 'M.' | 'Mme' | 'Melle' | null;
		printedAt?: number | null;
		address?: string | null;
		phone?: string | null;
		projet?: string | null;
		source?: string | null;
		note?: string | null;
		statut?: string | null;
		recontacts?: { date: number; response: string }[] | null;
		followUp?: {
			type: 'rappel' | 'rdv';
			date: string;
			time?: string | null;
			commercial?: string | null;
			status?: string | null;
			motif?: 'confortation' | 'gestion' | null;
			nonVenteReason?: string | null;
			annulationReason?: string | null;
			annulationDate?: number | null;
		} | null;
		rdvHistory?: { at: number; reason?: string }[] | null;
		// Date et raison du marquage « traité » : rejouées dans l'historique.
		treatedAt?: number | null;
		treatedReason?: string | null;
		isClient?: boolean | null;
		agencyId?: string | null;
		createdBy?: string | null;
		createdByName?: string | null;
		_creationTime?: number;
		// Date du contact corrigée depuis la fiche (ms) : remplace la date de création.
		dateContact?: number | null;
	};
</script>

<script lang="ts">
	import {
		AlertTriangle,
		CalendarDays,
		Check,
		CheckCircle2,
		Copy,
		Ellipsis,
		LoaderCircle,
		MapPin,
		Megaphone,
		Pencil,
		PhoneCall,
		Plus,
		Printer,
		Trash2,
		Undo2,
		UserRound,
		X
	} from '@lucide/svelte';
	import { CalendarDate, getLocalTimeZone, type DateValue } from '@internationalized/date';
	import { useMutation, useQuery } from 'convex-svelte';
	import { api } from '../../convex/_generated/api.js';
	import { authState } from '$lib/auth-state.svelte';
	import type { Id } from '../../convex/_generated/dataModel.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Calendar } from '$lib/components/ui/calendar/index.js';
	import Avatar from './Avatar.svelte';
	import {
		Dialog,
		DialogContent,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover/index.js';
	import {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger
	} from '$lib/components/ui/select/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { contactSources, sourceClass, type ContactSource } from '$lib/data/sources';
	import { FAMILLES } from '$lib/data/catalogue';
	import { formatPhone, onPhoneInput } from '$lib/data/phone';
	import AddressInput from './AddressInput.svelte';
	import ErreurVenteDialog from './ErreurVenteDialog.svelte';
	import SaleDialog from './SaleDialog.svelte';
	import AgendaApercuDialog from './agenda-apercu-dialog.svelte';
	import { canAccessAdministration, canReassignContact } from '$lib/data/roles';
	import { dateInputToMs, msToDateInput } from '$lib/data/dates';
	import {
		contactQualif,
		foyerLabel,
		initialQualification,
		qualifAnswered,
		stripQualificationBlock,
		toQualifDoc
	} from '$lib/data/qualification';
	import QualificationQuestions from './QualificationQuestions.svelte';
	import ContactPrintSheet from './ContactPrintSheet.svelte';

	let {
		contact = $bindable(null),
		open = $bindable(false)
	}: { contact?: ContactRow | null; open?: boolean } = $props();

	const updateContact = useMutation(api.contacts.update);
	const removeContact = useMutation(api.contacts.remove);
	const recontactContact = useMutation(api.contacts.recontact);
	const markContactTreated = useMutation(api.contacts.markTreated);
	const markContactPrinted = useMutation(api.contacts.markPrinted);
	const setFollowUpFields = useMutation(api.contacts.setFollowUpFields);
	const updateVenteStatut = useMutation(api.ventes.updateStatut);
	const removeVenteErreur = useMutation(api.ventes.removeErreur);
	const removeVente = useMutation(api.ventes.removeVente);

	const profile = useQuery(api.users.getProfile, () => (authState.isAuthenticated ? {} : 'skip'));
	const isManager = $derived(canAccessAdministration(profile.data?.role));
	const myId = $derived((profile.data?._id as string | undefined) ?? undefined);
	// Suppression possible pour le créateur du contact ou pour un manager.
	const canDelete = $derived(!!contact && (isManager || myId === contact.createdBy));
	// « Qui a pris le contact » : réservé au directeur de zone et au directeur
	// d'agence (le serveur applique la même règle).
	const canReassign = $derived(canReassignContact(profile.data?.role));

	let deleteOpen = $state(false);
	let deleteBusy = $state(false);
	let deleteError = $state('');

	async function handleDeleteContact() {
		if (!contact) return;
		deleteBusy = true;
		deleteError = '';
		try {
			await removeContact({ contactId: contact._id as Id<'contacts'> });
			deleteOpen = false;
			contact = null;
			open = false;
		} catch (e) {
			deleteError = e instanceof Error ? e.message : 'Suppression impossible.';
		} finally {
			deleteBusy = false;
		}
	}

	// Ventes du contact affiché (fiche).
	const ventes = useQuery(api.ventes.getVentes, () =>
		contact?._id && open ? { contactId: contact._id as Id<'contacts'> } : 'skip'
	);
	// Commerciaux liés au client : le créateur du contact + les vendeurs des
	// ventes (le binôme), sans doublons.
	const commerciauxLies = $derived.by(() => {
		const set = new Set<string>();
		if (contact?.createdByName) set.add(contact.createdByName);
		for (const v of ventes.data ?? []) if (v.vendeurName) set.add(v.vendeurName);
		return [...set];
	});

	let saleOpen = $state(false);
	let saleEditOpen = $state(false);
	let editingVente = $state<{
		_id: string;
		vendeurId?: string | null;
		produits: { produit: string; tva: number; montantHT: number }[];
		tvaDetail?: { taux: number; montant: number }[] | null;
		date?: number | null;
	} | null>(null);
	let erreurOpen = $state(false);
	let erreurVente = $state<{
		_id: string;
		vendeurName?: string;
		vendeurDisplay?: string;
		totalTTC?: number;
	} | null>(null);

	type VenteStatut = 'en attente' | 'valide' | 'erreur' | 'annulée';
	const venteStatutLabel = (s: string | undefined | null): string => {
		if (s === 'erreur') return 'Erreur';
		if (s === 'annulée') return 'Annulée';
		if (s === 'en attente') return 'En attente';
		return 'Valide';
	};
	const venteStatutClass = (s: string | undefined | null): string => {
		if (s === 'erreur') return 'bg-orange-500/15 text-orange-700 dark:text-orange-300';
		if (s === 'annulée') return 'bg-red-500/15 text-red-700 dark:text-red-300';
		if (s === 'en attente') return 'bg-sky-500/15 text-sky-700 dark:text-sky-300';
		return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
	};
	// Émojis et couleurs pour mettre en évidence les ventes dans la fiche.
	const venteEmoji = (s: string | undefined | null): string =>
		s === 'erreur' ? '⚠️' : s === 'annulée' ? '❌' : s === 'en attente' ? '⏳' : '✅';
	const venteCardClass = (s: string | undefined | null): string =>
		s === 'erreur'
			? 'border-orange-500/30'
			: s === 'annulée'
				? 'border-red-500/30'
				: s === 'en attente'
					? 'border-sky-500/30'
					: 'border-emerald-500/30';
	const venteTotalClass = (s: string | undefined | null): string =>
		s === 'erreur'
			? 'text-orange-700 dark:text-orange-300'
			: s === 'annulée'
				? 'text-red-700 dark:text-red-300'
				: s === 'en attente'
					? 'text-sky-700 dark:text-sky-300'
					: 'text-emerald-700 dark:text-emerald-300';
	// Montant lisible partout dans la fiche (TTC, HT, TVA).
	const fmtMoney = (n: number | null | undefined): string =>
		(n ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	async function changeVenteStatut(venteId: string, statut: VenteStatut) {
		try {
			await updateVenteStatut({ venteId: venteId as Id<'ventes'>, statut });
		} catch (e) {
			console.error(e);
		}
	}

	// Le statut « erreur » passe par une popup de documents manquants (managers uniquement).
	function onVenteStatutChange(
		vente: { _id: string; vendeurName?: string; vendeurDisplay?: string; totalTTC?: number },
		value: string
	) {
		if (value === 'erreur') {
			if (!isManager) return;
			erreurVente = vente;
			erreurOpen = true;
			return;
		}
		changeVenteStatut(vente._id, value as VenteStatut);
	}

	async function handleRemoveErreur(venteId: string) {
		try {
			await removeVenteErreur({ venteId: venteId as Id<'ventes'> });
		} catch (e) {
			console.error(e);
		}
	}

	// Suppression d'une vente (managers uniquement), avec confirmation.
	async function handleRemoveVente(vente: { _id: string }) {
		if (!confirm(`Supprimer cette vente ? Le client perdra ce dossier.`)) return;
		try {
			await removeVente({ venteId: vente._id as Id<'ventes'> });
		} catch (e) {
			console.error(e);
		}
	}

	function openEditVente(vente: {
		_id: string;
		vendeurId?: string | null;
		produits: { produit: string; tva: number; montantHT: number }[];
		tvaDetail?: { taux: number; montant: number }[] | null;
		date?: number | null;
	}) {
		editingVente = vente;
		saleEditOpen = true;
	}

	// Commerciaux disponibles pour rattacher un RDV (autres que le connecté).
	const commerciaux = useQuery(api.employes.listRdvCommerciaux, () =>
		authState.isAuthenticated ? {} : 'skip'
	);

	// Employés du périmètre pour corriger « qui a pris le contact » (utilisé
	// seulement par l'administrateur, le directeur de zone et le directeur
	// d'agence) : actifs et rattachés à une agence, comme l'exige le serveur.
	const preneurs = useQuery(api.access.listAssignables, () =>
		authState.isAuthenticated && canReassign ? {} : 'skip'
	);
	// Options du select « Pris par » : les employés du périmètre, plus le
	// créateur actuel s'il n'y figure pas (contact venu d'une autre zone).
	const preneurOptions = $derived.by(() => {
		const list = (preneurs.data ?? []).map((v) => ({
			_id: v._id as string,
			name: v.name,
			isMe: v.isMe
		}));
		const creatorId = contact?.createdBy;
		const creatorName = contact?.createdByName;
		if (creatorId && creatorName && !list.some((o) => o._id === creatorId)) {
			list.unshift({ _id: creatorId, name: creatorName, isMe: false });
		}
		return list;
	});

	// Photos des commerciaux (nom complet → photo) pour les avatars de la fiche.
	const membresPhotos = useQuery(api.evenements.listMembres, () =>
		authState.isAuthenticated ? {} : 'skip'
	);
	const photoByName = $derived.by(() => {
		const map = new Map<string, string>();
		for (const m of membresPhotos.data ?? []) {
			const key = `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim().toLowerCase();
			if (m.photo && key) map.set(key, m.photo);
		}
		return map;
	});

	const NONE = '__none__';
	const commercialName = (c: { firstName?: string; lastName?: string } | null | undefined) =>
		`${c?.firstName ?? ''} ${c?.lastName ?? ''}`.trim();

	// Commerciaux rattachables en binôme : tous sauf celui qui a pris le RDV
	// (le créateur du contact ne peut pas être son propre binôme).
	const rattachables = $derived.by(() => {
		const creator = (contact?.createdByName ?? '').trim().toLowerCase();
		return (commerciaux.data ?? []).filter(
			(c) => commercialName(c).trim().toLowerCase() !== creator
		);
	});

	// Initiales d'un nom (secours des avatars quand aucune photo n'est trouvée).
	const initialsOf = (name: string | null | undefined): string =>
		(name ?? '')
			.trim()
			.split(/\s+/)
			.map((w) => w[0] ?? '')
			.slice(0, 2)
			.join('')
			.toUpperCase();

	const suiviTimes = [
		'10:00',
		'10:30',
		'11:00',
		'11:30',
		'14:00',
		'14:30',
		'15:00',
		'15:30',
		'16:00',
		'16:30',
		'17:00',
		'17:30',
		'18:00',
		'18:30',
		'19:00',
		'19:30'
	];

	let mode = $state<'view' | 'edit' | 'recontact'>('view');
	let copied = $state('');
	let annonceCopied = $state(false);
	let editBusy = $state(false);
	let editError = $state('');
	let editSwitchReason = $state('');

	let recontactResponse = $state('');
	let recontactFollowUpType = $state<'rappel' | 'rdv'>('rappel');
	let recontactFollowUpTime = $state('10:00');
	let recontactRdvCommercial = $state(NONE);
	let recontactRdvStatus = $state(NONE);
	let recontactFollowUpDate = $state(
		(() => {
			const d = new Date();
			return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
		})()
	);
	let recontactBusy = $state(false);
	let recontactError = $state('');
	let recontactSwitchReason = $state('');

	let editAgendaOpen = $state(false);
	let editName = $state('');
	// Civilités cochées dans la fiche (choix multiple : un couple = M. + Mme).
	let editCivilites = $state<string[]>([]);
	const CIVILITES = ['M.', 'Mme', 'Melle'] as const;
	function toggleEditCivilite(value: string) {
		editCivilites = editCivilites.includes(value)
			? editCivilites.filter((c) => c !== value)
			: [...editCivilites, value];
	}
	function civChipClass(active: boolean): string {
		return [
			'rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-all',
			active
				? 'border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/25'
				: 'border-line bg-card2 text-muted-foreground hover:border-primary/40 hover:text-foreground'
		].join(' ');
	}
	let editAddress = $state('');
	let editPhone = $state('');
	let editProjet = $state('');
	let editSource = $state('');
	let editNote = $state('');
	// Date du contact (AAAA-MM-JJ) et « qui a pris le contact ».
	let editDateContact = $state('');
	let editCreatedBy = $state<string | undefined>(undefined);
	let editFollowUpType = $state<'rappel' | 'rdv'>('rappel');
	let editFollowUpTime = $state('10:00');
	let editRdvCommercial = $state(NONE);
	let editRdvStatus = $state(NONE);
	// Type du RDV : '' (classique), 'confortation' ou 'gestion' (gestion dossier).
	let editRdvMotif = $state<'confortation' | 'gestion' | ''>('');
	// Réponses du questionnaire « Questions découverte » (lues depuis / réécrites dans la note).
	let editQualif = $state(initialQualification());
	const today = new Date();
	let editFollowUpDate = $state(
		new CalendarDate(today.getFullYear(), today.getMonth() + 1, today.getDate())
	);

	// L'agenda (web et mobile) affiche du lundi au samedi : un RDV un dimanche
	// serait invisible. On interdit la saisie d'un dimanche pour un RDV (le cas
	// hérité — RDV déjà posé un dimanche — reste modifiable sans changer la date).
	const isSunday = (date: DateValue) => date.toDate(getLocalTimeZone()).getDay() === 0;
	const keepsLegacySunday = (date: CalendarDate) =>
		contact?.followUp?.type === 'rdv' && date.toString() === (contact.followUp?.date ?? '');

	$effect(() => {
		if (contact) {
			mode = 'view';
			copied = '';
			editName = contact.name;
			editCivilites = Array.isArray(contact.civilites)
				? [...contact.civilites]
				: contact.civilite
					? [contact.civilite]
					: [];
			editAddress = contact.address ?? '';
			editPhone = contact.phone ?? '';
			editProjet = contact.projet ?? '';
			editSource = contact.source ?? '';
			// Date affichée : la date corrigée, sinon la date de création du contact.
			editDateContact = msToDateInput(contact.dateContact ?? contact._creationTime);
			editCreatedBy = contact.createdBy ?? undefined;
			// Le bloc « Questions découverte » est extrait de la note pour pré-remplir le
			// questionnaire ; la note éditée ne garde que le texte libre (le bloc est
			// régénéré à l'enregistrement depuis les réponses du formulaire).
			// Réponses structurées du contact ; repli sur l'ancien bloc dans la note.
			const parsed = contactQualif(contact);
			editQualif = parsed ?? initialQualification();
			editNote = stripQualificationBlock(contact.note ?? '');
			editFollowUpType = contact.followUp?.type ?? 'rappel';
			editFollowUpTime = contact.followUp?.time ?? '10:00';
			editRdvCommercial = contact.followUp?.commercial ?? NONE;
			editRdvStatus = contact.followUp?.status ?? NONE;
			editRdvMotif = contact.followUp?.motif ?? '';
			editSwitchReason = '';
			if (contact.followUp?.date) {
				const [y, m, d] = contact.followUp.date.split('-').map(Number);
				editFollowUpDate = new CalendarDate(y, m, d);
			}
		}
	});

	function openRecontact() {
		if (!contact) return;
		mode = 'recontact';
		recontactResponse = '';
		recontactFollowUpType = contact.followUp?.type ?? 'rappel';
		recontactFollowUpTime = contact.followUp?.time ?? '10:00';
		recontactRdvCommercial = contact.followUp?.commercial ?? NONE;
		recontactRdvStatus = contact.followUp?.status ?? NONE;
		if (contact.followUp?.date) {
			const [y, m, d] = contact.followUp.date.split('-').map(Number);
			recontactFollowUpDate = new CalendarDate(y, m, d);
		}
		recontactSwitchReason = '';
		recontactError = '';
	}

	async function handleRecontact() {
		if (!contact) return;
		if (!recontactResponse.trim()) {
			recontactError = 'Écris une réponse au recontact.';
			return;
		}
		if (
			recontactFollowUpType === 'rappel' &&
			contact.followUp?.type === 'rdv' &&
			!recontactSwitchReason.trim()
		) {
			recontactError = 'Renseigne la raison du passage en rappel.';
			return;
		}
		if (
			recontactFollowUpType === 'rdv' &&
			isSunday(recontactFollowUpDate) &&
			!keepsLegacySunday(recontactFollowUpDate)
		) {
			recontactError = 'Les RDV ne peuvent pas être planifiés un dimanche.';
			return;
		}
		recontactBusy = true;
		recontactError = '';
		try {
			await recontactContact({
				contactId: contact._id as Id<'contacts'>,
				response: recontactResponse.trim(),
				rdvSwitchReason:
					recontactFollowUpType === 'rappel' && contact.followUp?.type === 'rdv'
						? recontactSwitchReason.trim()
						: undefined,
				followUp: {
					type: recontactFollowUpType,
					date: recontactFollowUpDate.toString(),
					time: recontactFollowUpType === 'rdv' ? recontactFollowUpTime : undefined,
					// On conserve le type du RDV existant quand on le repositionne.
					motif:
						recontactFollowUpType === 'rdv' && contact.followUp?.type === 'rdv'
							? (contact.followUp?.motif ?? undefined)
							: undefined,
					...(recontactFollowUpType === 'rdv'
						? {
								commercial: recontactRdvCommercial !== NONE ? recontactRdvCommercial : undefined,
								status:
									recontactRdvStatus !== NONE
										? (recontactRdvStatus as 'annulé' | 'déballé' | 'vendu' | 'à reprogrammer')
										: undefined
							}
						: {})
				}
			});
			contact = {
				...contact,
				recontacts: [
					...(contact.recontacts ?? []),
					{ date: Date.now(), response: recontactResponse.trim() }
				],
				followUp: {
					type: recontactFollowUpType,
					date: recontactFollowUpDate.toString(),
					time: recontactFollowUpType === 'rdv' ? recontactFollowUpTime : null,
					motif:
						recontactFollowUpType === 'rdv' && contact.followUp?.type === 'rdv'
							? (contact.followUp?.motif ?? null)
							: null,
					...(recontactFollowUpType === 'rdv'
						? {
								commercial: recontactRdvCommercial !== NONE ? recontactRdvCommercial : null,
								status:
									recontactRdvStatus !== NONE
										? (recontactRdvStatus as 'annulé' | 'déballé' | 'vendu' | 'à reprogrammer')
										: null
							}
						: {})
				},
				rdvHistory:
					recontactFollowUpType === 'rdv'
						? [...(contact.rdvHistory ?? []), { at: Date.now() }]
						: contact.followUp?.type === 'rdv'
							? (contact.rdvHistory ?? []).map((entry, i, arr) =>
									i === arr.length - 1
										? { ...entry, reason: recontactSwitchReason.trim() || undefined }
										: entry
								)
							: (contact.rdvHistory ?? [])
			};
			mode = 'view';
		} catch (e) {
			recontactError = e instanceof Error ? e.message : 'Recontact impossible.';
		} finally {
			recontactBusy = false;
		}
	}

	// treated = false : on annule le marquage, le contact revient dans son état
	// principal (RDV, rappel ou actif) — son suivi est conservé tel quel.
	// La raison du traitement est conservée sur le contact pour l'historique.
	// Renvoie false quand le serveur refuse : l'erreur est affichée, on ne masque
	// plus un refus (sinon le clic semble sans effet).
	async function handleMarkTreated(treated = true, reason?: string): Promise<boolean> {
		if (!contact) return false;
		const at = Date.now();
		const motif = reason?.trim() || contact.treatedReason || null;
		traiteError = '';
		try {
			await markContactTreated({
				contactId: contact._id as Id<'contacts'>,
				treated,
				reason: treated ? (motif ?? undefined) : undefined
			});
			contact = {
				...contact,
				statut: treated ? 'traité' : 'actif',
				treatedAt: treated ? at : (contact.treatedAt ?? null),
				treatedReason: motif
			};
			return true;
		} catch (e) {
			traiteError = e instanceof Error ? e.message : 'Marquage impossible.';
			return false;
		}
	}

	// Popup de saisie de la raison du traitement (marquage « traité »).
	function openTraiteDialog() {
		traiteReason = contact?.treatedReason ?? '';
		traiteError = '';
		traiteOpen = true;
	}

	async function confirmTraite() {
		quickBusy = true;
		const ok = await handleMarkTreated(true, traiteReason.trim());
		quickBusy = false;
		// En cas de refus, la popup reste ouverte avec le message du serveur.
		if (!ok) return;
		traiteOpen = false;
		traiteReason = '';
	}

	// Mise à jour rapide depuis la fiche (sans ouvrir « Modifier ») : le statut du
	// RDV et/ou le commercial rattaché.
	let quickBusy = $state(false);
	// Popup de saisie de la raison de non-vente (statut « déballé »).
	let nonVenteOpen = $state(false);
	let nonVenteReason = $state('');
	// Popup de saisie de la raison du marquage « traité ».
	let traiteOpen = $state(false);
	let traiteReason = $state('');
	// Message du serveur quand le marquage « traité » est refusé.
	let traiteError = $state('');
	// Popup de saisie de la raison d'annulation (statut « annulé »).
	let annulationOpen = $state(false);
	let annulationReason = $state('');

	function patchFollowUp(patch: {
		commercial?: string | null;
		status?: string | null;
		nonVenteReason?: string | null;
		annulationReason?: string | null;
	}) {
		if (!contact?.followUp) return;
		const fu = contact.followUp;
		contact = {
			...contact,
			followUp: {
				type: fu.type ?? 'rdv',
				date: fu.date ?? '',
				time: fu.time ?? null,
				commercial: patch.commercial !== undefined ? patch.commercial : (fu.commercial ?? null),
				status: patch.status !== undefined ? patch.status : (fu.status ?? null),
				// On conserve le type du RDV (confortation / gestion dossier).
				motif: fu.motif ?? null,
				nonVenteReason:
					patch.nonVenteReason !== undefined ? patch.nonVenteReason : (fu.nonVenteReason ?? null),
				annulationReason:
					patch.annulationReason !== undefined
						? patch.annulationReason
						: (fu.annulationReason ?? null),
				// Date d'annulation : posée à la première mise en « annulé », conservée
				// ensuite (même logique que le serveur).
				annulationDate:
					patch.status === 'annulé'
						? fu.status === 'annulé'
							? fu.annulationDate
							: Date.now()
						: (fu.annulationDate ?? null)
			}
		};
	}

	// Passe le RDV en « déballé » (non vendu) : on demande toujours une raison de
	// non-vente avant d'enregistrer, via une popup shadcn.
	function quickSetDeballe() {
		if (!contact) return;
		nonVenteReason = contact.followUp?.nonVenteReason ?? '';
		nonVenteOpen = true;
	}

	async function confirmNonVente() {
		if (!contact) return;
		quickBusy = true;
		try {
			await setFollowUpFields({
				contactId: contact._id as Id<'contacts'>,
				status: 'déballé',
				nonVenteReason: nonVenteReason.trim() || undefined
			});
			patchFollowUp({ status: 'déballé', nonVenteReason: nonVenteReason.trim() || null });
			nonVenteOpen = false;
		} catch (e) {
			console.error(e);
		} finally {
			quickBusy = false;
		}
	}

	// Passe le RDV en « annulé » : on demande toujours une raison d'annulation.
	function quickSetAnnule() {
		if (!contact) return;
		annulationReason = contact.followUp?.annulationReason ?? '';
		annulationOpen = true;
	}

	async function confirmAnnulation() {
		if (!contact) return;
		quickBusy = true;
		try {
			await setFollowUpFields({
				contactId: contact._id as Id<'contacts'>,
				status: 'annulé',
				annulationReason: annulationReason.trim() || undefined
			});
			patchFollowUp({ status: 'annulé', annulationReason: annulationReason.trim() || null });
			annulationOpen = false;
		} catch (e) {
			console.error(e);
		} finally {
			quickBusy = false;
		}
	}

	async function quickSetStatus(value: string) {
		if (value === 'déballé') {
			quickSetDeballe();
			return;
		}
		if (value === 'annulé') {
			quickSetAnnule();
			return;
		}
		if (!contact) return;
		quickBusy = true;
		try {
			await setFollowUpFields({
				contactId: contact._id as Id<'contacts'>,
				status: value === NONE ? '' : (value as 'annulé' | 'déballé' | 'vendu' | 'à reprogrammer')
			});
			patchFollowUp({ status: value === NONE ? null : value });
		} catch (e) {
			console.error(e);
		} finally {
			quickBusy = false;
		}
	}

	async function quickSetCommercial(value: string) {
		if (!contact) return;
		quickBusy = true;
		try {
			await setFollowUpFields({
				contactId: contact._id as Id<'contacts'>,
				commercial: value === NONE ? '' : value
			});
			patchFollowUp({ commercial: value === NONE ? '' : value });
		} catch (e) {
			console.error(e);
		} finally {
			quickBusy = false;
		}
	}

	// Suivi « tram » : historique chronologique du contact — prises de RDV,
	// rappels (recontacts) et ventes, puis le suivi planifié quand il est en attente.
	// Date locale d'un horodatage ms en « YYYY-MM-DD » (pour comparer à fu.date).
	function dateKey(ms: number): string {
		const d = new Date(ms);
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${d.getFullYear()}-${m}-${day}`;
	}
	// Réponses du questionnaire « Questions découverte », relues depuis la note
	// pour l'affichage structuré dans la fiche (vue consultation).
	const viewQualif = $derived(contact ? contactQualif(contact) : null);
	const viewQualifItems = $derived.by(() => {
		const a = viewQualif;
		if (!a) return [];
		const items: { emoji: string; text: string }[] = [];
		if (a.foyer) items.push({ emoji: '👥', text: `Foyer : ${foyerLabel(a.foyer)}` });
		if (a.habite) items.push({ emoji: '🏠', text: `Depuis ${a.habite}` });
		if (a.plait)
			items.push({
				emoji: a.plait === 'oui' ? '😊' : '😕',
				text: a.plait === 'oui' ? 'Se plaît chez eux' : "N'aime pas son logement"
			});
		if (a.achat) {
			const detail =
				(a.achat === 'Rénovation' || a.achat === 'Autre…') && a.achatDetail.trim()
					? ` (${a.achatDetail.trim()})`
					: '';
			items.push({ emoji: '🛒', text: `Dernier achat : ${a.achat}${detail}` });
		}
		if (a.metierMme.trim()) items.push({ emoji: '💼', text: `Mme : ${a.metierMme.trim()}` });
		if (a.metierM.trim()) items.push({ emoji: '💼', text: `M. : ${a.metierM.trim()}` });
		if (a.imposable)
			items.push({ emoji: '🧾', text: a.imposable === 'oui' ? 'Imposable' : 'Non imposable' });
		if (a.chauffage)
			items.push({
				emoji: '🔥',
				text: `Chauffage : ${a.chauffage}${a.chauffageCout.trim() ? ` — ${a.chauffageCout.trim()} €/mois` : ''}`
			});
		if (a.connait)
			items.push({
				emoji: '🎯',
				text: a.connait === 'oui' ? 'Connaît le produit' : 'Ne connaît pas le produit'
			});
		if (a.connait === 'oui' && a.concurrence)
			items.push({ emoji: '💶', text: `Concurrence : ${a.concurrence}` });
		if (a.age) items.push({ emoji: '🎂', text: a.age });
		if (a.changer)
			items.push({
				emoji: '🛠️',
				text: `Veut changer : ${a.changer}${a.pourQuand ? ` — ${a.pourQuand}` : ''}`
			});
		if (a.soncas.length > 0) items.push({ emoji: '🧲', text: `SONCAS : ${a.soncas.join(', ')}` });
		return items;
	});

	const timeline = $derived.by(() => {
		const entries: {
			at: number;
			label: string;
			detail?: string;
			dotClass: string;
		}[] = [];

		// Quand un RDV est encore « planifié » (date posée, sans statut final),
		// la mention historique « RDV pris » posée le même jour est redondante avec
		// l'entrée « RDV planifié … à hh:mm » : on ne la réaffiche pas.
		const plannedRdvDate =
			contact?.followUp?.type === 'rdv' && !contact.followUp.status && contact.followUp.date
				? contact.followUp.date
				: null;

		for (const h of contact?.rdvHistory ?? []) {
			if (plannedRdvDate && dateKey(h.at) === plannedRdvDate) continue;
			entries.push({
				at: h.at,
				label: '📅 RDV pris',
				detail: h.reason ? `→ passage en rappel : ${h.reason}` : undefined,
				dotClass: 'bg-blue-400'
			});
		}
		for (const r of contact?.recontacts ?? []) {
			entries.push({
				at: r.date,
				label: '📞 Recontact',
				detail: r.response,
				dotClass: 'bg-amber-400'
			});
		}
		for (const v of ventes.data ?? []) {
			entries.push({
				at: v.date,
				label: '💰 Vente',
				detail: `${v.totalTTC.toLocaleString('fr-FR', {
					minimumFractionDigits: 2,
					maximumFractionDigits: 2
				})} € TTC · ${v.vendeurDisplay ?? v.vendeurName}`,
				dotClass:
					v.statut === 'erreur'
						? 'bg-orange-400'
						: v.statut === 'annulée'
							? 'bg-red-400'
							: v.statut === 'en attente'
								? 'bg-sky-400'
								: 'bg-emerald-400'
			});
		}

		const fu = contact?.followUp;
		if (fu?.date) {
			const [y, m, d] = fu.date.split('-').map(Number);
			const at = new Date(y, m - 1, d).getTime();
			const motif = rdvMotifLabel(fu.motif);
			const rdvDot = motif ? 'bg-violet-400' : 'bg-blue-400';
			// Un suivi encore ouvert est déjà affiché dans la carte d'identité
			// (ligne « RDV » / « Rappel ») : inutile de le répéter ici.
			const suiviOuvert = !fu.status;
			if (fu.type === 'rdv' && !suiviOuvert) {
				// Le RDV clos garde sa date dans l'historique (annulé / déballé / vendu).
				entries.push({
					at,
					label: motif ? `📅 RDV ${motif}` : '📅 RDV',
					detail: fu.time ? `à ${fu.time}` : undefined,
					dotClass: rdvDot
				});
				// L'issue du RDV reste dans l'historique, avec sa raison quand il y en a une.
				// Annulation : date d'annulation, repli sur la date du RDV pour les cas
				// antérieurs à ce champ.
				if (fu.status === 'annulé') {
					entries.push({
						at: fu.annulationDate ?? at,
						label: '❌ Annulé',
						detail: fu.annulationReason ?? undefined,
						dotClass: 'bg-red-400'
					});
				} else if (fu.status === 'déballé') {
					entries.push({
						at,
						label: '📦 Déballé',
						detail: fu.nonVenteReason ?? undefined,
						dotClass: 'bg-violet-400'
					});
				} else if (fu.status === 'vendu') {
					entries.push({
						at,
						label: '💰 Vendu',
						dotClass: 'bg-emerald-400'
					});
				} else if (fu.status === 'à reprogrammer') {
					entries.push({
						at,
						label: '🔁 À reprogrammer',
						dotClass: 'bg-orange-400'
					});
				}
			} else if (fu.type === 'rappel' && !suiviOuvert) {
				entries.push({
					at,
					label: '🔔 Rappel planifié',
					dotClass: 'bg-amber-400'
				});
			}
		}

		// Marquage « traité » : la trace reste dans l'historique, avec sa raison,
		// comme les autres issues du dossier.
		if (contact?.statut === 'traité') {
			entries.push({
				at: contact.treatedAt ?? contact.dateContact ?? contact._creationTime ?? Date.now(),
				label: '✅ Traité',
				detail: contact.treatedReason ?? undefined,
				dotClass: 'bg-emerald-400'
			});
		}

		return entries.sort((a, b) => a.at - b.at);
	});

	const formattedDate = $derived(
		editFollowUpDate.toDate(getLocalTimeZone()).toLocaleDateString('fr-FR', {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		})
	);

	const formattedRecontactDate = $derived(
		recontactFollowUpDate.toDate(getLocalTimeZone()).toLocaleDateString('fr-FR', {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		})
	);

	function formatTs(ts: number): string {
		return new Date(ts).toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	function rdvMotifLabel(motif: string | null | undefined): string | null {
		if (motif === 'confortation') return 'Confortation';
		if (motif === 'gestion') return 'Gestion dossier';
		return null;
	}

	// ---------------------------------------------- Bandeau de gestion (fiche)
	// Une seule ligne pour lire l'essentiel d'un contact : son état, son prochain
	// pas et qui le suit. Les changements d'état se font directement ici.

	/** Prochain pas encore à faire (un RDV clos n'est plus un prochain pas). */
	const prochainPas = $derived.by(() => {
		const fu = contact?.followUp;
		if (!fu?.date || fu.status) return null;
		const [y, m, d] = fu.date.split('-').map(Number);
		const jour = new Date(y, m - 1, d);
		const auj = new Date();
		auj.setHours(0, 0, 0, 0);
		const jours = Math.round((jour.getTime() - auj.getTime()) / 86_400_000);
		const quand =
			jours === 0
				? "aujourd'hui"
				: jours === 1
					? 'demain'
					: jours > 0
						? `dans ${jours} j`
						: `${-jours} j de retard`;
		return { rdv: fu.type === 'rdv', jour, jours, quand, heure: fu.time ?? null };
	});

	/** Date du contact corrigée, sinon date de création. */
	const dateContact = $derived(
		contact ? (contact.dateContact ?? contact._creationTime ?? null) : null
	);

	/** Dernier échange connu : recontact, prise de RDV ou vente. */
	const dernierEchange = $derived.by(() => {
		const dates = [
			...(contact?.recontacts ?? []).map((r) => r.date),
			...(contact?.rdvHistory ?? []).map((h) => h.at),
			...(ventes.data ?? []).map((v) => v.date)
		];
		return dates.length ? Math.max(...dates) : null;
	});

	/** Ancienneté lisible : « aujourd'hui », « hier », « il y a 4 j ». */
	function depuis(ms: number): string {
		const auj = new Date();
		auj.setHours(0, 0, 0, 0);
		const j = new Date(ms);
		j.setHours(0, 0, 0, 0);
		const jours = Math.round((auj.getTime() - j.getTime()) / 86_400_000);
		return jours <= 0 ? "aujourd'hui" : jours === 1 ? 'hier' : `il y a ${jours} j`;
	}

	/** Ancienneté du dossier, sans répéter deux fois la même date. */
	const resumeSuivi = $derived.by(() => {
		if (!dateContact) return dernierEchange ? `Échangé ${depuis(dernierEchange)}` : '';
		const pris = `Contact pris ${depuis(dateContact)}`;
		if (!dernierEchange) return pris;
		if (depuis(dernierEchange) === depuis(dateContact)) return pris;
		return `${pris} · échangé ${depuis(dernierEchange)}`;
	});

	/** L'action la plus utile maintenant, selon l'état du contact. */
	const actionPrincipale = $derived.by(
		(): { id: 'annonce' | 'recontact'; label: string } | null => {
			const c = contact;
			if (!c || c.isClient) return null;
			if (c.followUp?.type === 'rdv' && !c.followUp.status) {
				return { id: 'annonce', label: 'Annoncer le RDV' };
			}
			return { id: 'recontact', label: 'Recontacter' };
		}
	);

	/** Menu des actions secondaires de la fiche. */
	let actionsOuvertes = $state(false);
	const itemAction =
		'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] font-medium text-foreground transition-colors hover:bg-glass-2';

	function statusLabel(contact: ContactRow): string {
		// Dès qu'une vente existe, le contact est un client — c'est son statut principal.
		if (contact.isClient) return '👤 Client';
		if (contact.statut === 'traité') return '✅ Traité';
		if (contact.followUp?.type === 'rdv') {
			// Le statut reflète l'état réel du RDV (vendu, déballé…) plutôt que « RDV ».
			const s = contact.followUp.status;
			if (s === 'vendu') return '💰 Vendu';
			if (s === 'déballé') return '📦 Déballé';
			if (s === 'à reprogrammer') return '🔁 À reprogrammer';
			if (s === 'annulé') return '❌ Annulé';
			const motif = rdvMotifLabel(contact.followUp.motif);
			if (motif) return `📅 ${motif}`;
			return '📅 RDV';
		}
		if (contact.followUp?.type === 'rappel') return '🔔 Rappel';
		return '✨ Actif';
	}

	function statusClass(contact: ContactRow): string {
		// Style teinté (fond translucide + texte coloré) comme les autres badges
		// de l'app (source, statut de vente) — jamais de fond plein.
		if (contact.isClient) return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
		if (contact.statut === 'traité')
			return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
		if (contact.followUp?.type === 'rdv') {
			const s = contact.followUp.status;
			if (s === 'vendu') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
			if (s === 'déballé') return 'bg-violet-500/15 text-violet-700 dark:text-violet-300';
			if (s === 'à reprogrammer') return 'bg-orange-500/15 text-orange-700 dark:text-orange-300';
			if (s === 'annulé') return 'bg-red-500/15 text-red-700 dark:text-red-300';
			// RDV « Confortation » / « Gestion dossier » : violet comme une réunion.
			if (rdvMotifLabel(contact.followUp.motif))
				return 'bg-violet-500/15 text-violet-700 dark:text-violet-300';
			return 'bg-blue-500/15 text-blue-700 dark:text-blue-300';
		}
		if (contact.followUp?.type === 'rappel')
			return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
		return 'bg-glass-3 text-muted-foreground';
	}

	function rdvStatusLabel(
		status: string | null | undefined,
		motif?: string | null | undefined
	): string {
		if (status === 'déballé') return 'Déballé';
		if (status === 'à reprogrammer') return 'À reprogrammer';
		if (status === 'annulé') return 'Annulé';
		if (status === 'vendu') return 'Vendu';
		const motifLabel = rdvMotifLabel(motif);
		if (motifLabel) return motifLabel;
		return 'Programmé';
	}

	// Bloc teinté du statut de RDV : une couleur par état, comme les autres badges.
	function rdvStatusClass(
		status: string | null | undefined,
		motif?: string | null | undefined
	): string {
		if (status === 'déballé') return 'bg-violet-500/15 text-violet-700 dark:text-violet-300';
		if (status === 'à reprogrammer') return 'bg-orange-500/15 text-orange-700 dark:text-orange-300';
		if (status === 'annulé') return 'bg-red-500/15 text-red-700 dark:text-red-300';
		if (status === 'vendu') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
		// RDV « Confortation » / « Gestion dossier » : violet comme une réunion.
		if (rdvMotifLabel(motif)) return 'bg-violet-500/15 text-violet-700 dark:text-violet-300';
		return 'bg-blue-500/15 text-blue-700 dark:text-blue-300';
	}

	async function copyValue(key: 'address' | 'phone' | 'date') {
		if (!contact) return;
		const value =
			key === 'address'
				? contact.address
				: key === 'phone'
					? contact.phone
					: (contact.followUp?.date ?? null);
		if (!value) return;
		try {
			await navigator.clipboard.writeText(value);
			copied = key;
			setTimeout(() => {
				if (copied === key) copied = '';
			}, 1500);
		} catch {
			// Presse-papiers indisponible.
		}
	}

	// Formattage de l'annonce du RDV à copier (même format que l'app mobile).
	function annonceDdMm(input: string | number | null | undefined): string {
		if (input == null) return '';
		const d =
			typeof input === 'number'
				? new Date(input)
				: (() => {
						const [y, m, day] = String(input).split('-').map(Number);
						return new Date(y, (m ?? 1) - 1, day ?? 1);
					})();
		return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
	}
	function annonceHeure(time: string | null | undefined): string {
		if (!time) return '';
		const [h, m] = time.split(':');
		const hour = Number(h);
		if (Number.isNaN(hour)) return '';
		return m && m !== '00' ? `${hour}h${m}` : `${hour}h`;
	}
	function annonceSourceEmoji(source: string | null | undefined): string {
		const s = (source ?? '').toUpperCase();
		if (s === 'TAP') return '🚪';
		if (s === 'GMS') return '🏬';
		if (s === 'INTERNET' || s === 'WEB') return '🌐';
		if (s === 'RÉSEAU' || s === 'RESEAU') return '🤝';
		if (s === 'STANDARD') return '📞';
		return '📌';
	}
	function buildAnnonceRdv(c: ContactRow): string {
		const prenom = (c.followUp?.commercial ?? c.createdByName ?? '').trim().split(/\s+/)[0] ?? '';
		const lines: string[] = [];
		if (prenom) lines.push(`🔔 Contact: ${prenom.toUpperCase()}`);
		if (c.source) lines.push(`${annonceSourceEmoji(c.source)} Source : ${c.source.toUpperCase()}`);
		if (c.name) lines.push(`👤 Nom du client : ${c.name}`);
		// Date du contact corrigée si elle a été renseignée, sinon date de création.
		const dateContact = c.dateContact ?? c._creationTime;
		if (dateContact) lines.push(`🕐 Date de prise du rdv : ${annonceDdMm(dateContact)}`);
		if (c.projet) lines.push(`💰 Produit : ${c.projet}`);
		if (c.followUp?.date) {
			const heure = annonceHeure(c.followUp.time);
			lines.push(`🕐 Rdv le : ${annonceDdMm(c.followUp.date)}${heure ? ` à ${heure}` : ''}`);
		}
		return lines.join('\n');
	}
	async function copyAnnonceRdv() {
		if (!contact) return;
		try {
			await navigator.clipboard.writeText(buildAnnonceRdv(contact));
			annonceCopied = true;
			setTimeout(() => (annonceCopied = false), 2000);
		} catch {
			// Presse-papiers indisponible.
		}
	}

	// Impression de la fiche : la feuille A4 paysage est déjà rendue (masquée)
	// dans le dialogue. Après l'impression, le contact est marqué comme imprimé
	// pour que le bouton reste vert et que la liste sache lesquelles sont faites.
	const isPrinted = $derived(!!contact?.printedAt);
	async function printContactSheet() {
		if (!contact) return;
		window.print();
		try {
			await markContactPrinted({ contactId: contact._id as Id<'contacts'> });
			contact = { ...contact, printedAt: Date.now() };
		} catch (e) {
			console.error(e);
		}
	}

	async function handleSave() {
		if (!contact) return;
		if (!editName.trim()) {
			editError = 'Le nom est requis.';
			return;
		}
		if (
			editFollowUpType === 'rappel' &&
			contact.followUp?.type === 'rdv' &&
			!editSwitchReason.trim()
		) {
			editError = 'Renseigne la raison du passage en rappel.';
			return;
		}
		if (
			editFollowUpType === 'rdv' &&
			isSunday(editFollowUpDate) &&
			!keepsLegacySunday(editFollowUpDate)
		) {
			editError = 'Les RDV ne peuvent pas être planifiés un dimanche.';
			return;
		}
		editBusy = true;
		editError = '';
		try {
			await updateContact({
				contactId: contact._id as Id<'contacts'>,
				name: editName.trim(),
				civilites: editCivilites as ('M.' | 'Mme' | 'Melle')[],
				address: editAddress.trim() || undefined,
				phone: editPhone.trim() || undefined,
				projet: editProjet || undefined,
				source: (editSource || undefined) as ContactSource | undefined,
				dateContact: dateInputToMs(editDateContact),
				...(canReassign && editCreatedBy && editCreatedBy !== contact.createdBy
					? { createdBy: editCreatedBy as Id<'users'> }
					: {}),
				// La note reste du texte libre ; les questions découverte partent dans
				// leur champ structuré `qualif`.
				note: editNote.trim() || undefined,
				qualif: qualifAnswered(editQualif) > 0 ? toQualifDoc(editQualif) : {},
				rdvSwitchReason:
					editFollowUpType === 'rappel' && contact.followUp?.type === 'rdv'
						? editSwitchReason.trim()
						: undefined,
				followUp: {
					type: editFollowUpType,
					date: editFollowUpDate.toString(),
					time: editFollowUpType === 'rdv' ? editFollowUpTime : undefined,
					// Type du RDV (confortation / gestion dossier) : uniquement pour un RDV.
					motif: editFollowUpType === 'rdv' ? editRdvMotif || undefined : undefined,
					...(editFollowUpType === 'rdv'
						? {
								commercial: editRdvCommercial !== NONE ? editRdvCommercial : undefined,
								status:
									editRdvStatus !== NONE
										? (editRdvStatus as 'annulé' | 'déballé' | 'vendu' | 'à reprogrammer')
										: undefined
							}
						: {})
				}
			});
			mode = 'view';
		} catch (e) {
			editError = e instanceof Error ? e.message : 'Enregistrement impossible.';
		} finally {
			editBusy = false;
		}
	}
</script>

<Dialog bind:open>
	<DialogContent
		class="max-h-[90vh] overflow-y-auto rounded-xl border-line bg-card sm:max-w-lg md:max-w-4xl lg:max-w-5xl xl:max-w-6xl"
	>
		<DialogHeader>
			<DialogTitle class="text-[15px] font-semibold">
				{mode === 'view' ? 'Fiche contact' : `Modifier ${contact?.name}`}
			</DialogTitle>
		</DialogHeader>

		{#if contact}
			{#if mode === 'view'}
				<!-- Fiche consultable : infos à gauche, recontacts/ventes à droite sur PC -->

				<div class="grid gap-3 md:grid-cols-2">
					<div class="space-y-3">
						<div class="overflow-hidden rounded-lg border border-line bg-card2/60">
							<div
								class="flex flex-wrap items-center gap-x-2.5 gap-y-2 border-b border-line/70 bg-glass-1 px-3 py-2.5"
							>
								<span
									class="grid size-8 shrink-0 place-items-center rounded-full bg-brand/10 text-[10.5px] font-bold text-brand"
									aria-hidden="true"
								>
									{initialsOf(contact.name)}
								</span>
								<p class="min-w-0 flex-1 truncate text-[14.5px] font-semibold text-foreground">
									{contact.name}
								</p>

								{#if !contact.isClient && contact.followUp?.type === 'rdv'}
									<Select
										type="single"
										value={contact.followUp?.status ?? NONE}
										onValueChange={(v: string) => quickSetStatus(v)}
									>
										<SelectTrigger
											class={[
												'h-7 w-fit gap-1 rounded-sm border-0 pr-1.5 pl-2 text-[12px] font-semibold shadow-none focus-visible:ring-2 focus-visible:ring-brand/40 data-[size=default]:h-7 [&>svg]:size-3.5 [&>svg]:text-current',
												rdvStatusClass(contact.followUp?.status, contact.followUp?.motif)
											].join(' ')}
											aria-label="Changer le statut du RDV"
										>
											<span data-slot="select-value">
												{rdvStatusLabel(contact.followUp?.status, contact.followUp?.motif)}
											</span>
										</SelectTrigger>
										<SelectContent>
											<SelectItem value={NONE}>📅 Programmé</SelectItem>
											<SelectItem value="déballé">📦 Déballé</SelectItem>
											<SelectItem value="à reprogrammer">🔁 À reprogrammer</SelectItem>
											<SelectItem value="annulé">❌ Annulé</SelectItem>
											<SelectItem value="vendu">💰 Vendu</SelectItem>
										</SelectContent>
									</Select>
								{:else}
									<Badge
										class={[
											'gap-1.5 rounded-sm px-2 py-0.5 text-[11.5px] font-semibold',
											statusClass(contact)
										].join(' ')}
									>
										{statusLabel(contact)}
									</Badge>
								{/if}
							</div>

							<div class="flex items-center gap-2 px-3 py-2">
								<PhoneCall class="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.7} />
								{#if contact.phone}
									<a
										href="tel:{contact.phone.replace(/\s/g, '')}"
										class="min-w-0 flex-1 truncate font-mono text-[13.5px] font-medium text-foreground hover:text-brand"
									>
										{formatPhone(contact.phone)}
									</a>
									<Button
										variant="ghost"
										size="icon-sm"
										onclick={() => copyValue('phone')}
										aria-label="Copier le téléphone"
										class="text-muted-foreground hover:text-foreground"
									>
										{#if copied === 'phone'}
											<Check class="size-3.5" />
										{:else}
											<Copy class="size-3.5" />
										{/if}
									</Button>
								{:else}
									<span class="flex-1 text-[13.5px] text-muted-foreground">Aucun numéro</span>
								{/if}
							</div>

							<div class="flex items-start gap-2 border-t border-line/70 px-3 py-2">
								<MapPin class="mt-0.5 size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.7} />
								<p class="min-w-0 flex-1 text-[13px] leading-snug text-foreground">
									{contact.address ?? 'Adresse non renseignée'}
								</p>
								{#if contact.address}
									<Button
										variant="ghost"
										size="icon-sm"
										onclick={() => copyValue('address')}
										aria-label="Copier l'adresse"
										class="text-muted-foreground hover:text-foreground"
									>
										{#if copied === 'address'}
											<Check class="size-3.5" />
										{:else}
											<Copy class="size-3.5" />
										{/if}
									</Button>
								{/if}
							</div>

							<dl class="border-t border-line/70">
								<div class="flex items-baseline gap-3 px-3 py-1.5">
									<dt class="w-28 shrink-0 text-[10.5px] font-medium text-muted-foreground">
										Projet
									</dt>
									<dd class="min-w-0 flex-1 text-[13px] text-foreground">
										{contact.projet ?? '—'}
									</dd>
								</div>
								<div class="flex items-center gap-3 border-t border-line/70 px-3 py-1.5">
									<dt class="w-28 shrink-0 text-[10.5px] font-medium text-muted-foreground">
										Source
									</dt>
									<dd class="min-w-0 flex-1">
										{#if contact.source}
											<Badge
												class={[
													'rounded-md px-1.5 py-0 text-[10.5px] font-medium',
													sourceClass(contact.source)
												].join(' ')}
											>
												{contact.source}
											</Badge>
										{:else}
											<span class="text-[13px] text-muted-foreground">—</span>
										{/if}
									</dd>
								</div>
								{#if prochainPas}
									<div class="flex items-center gap-3 border-t border-line/70 px-3 py-1.5">
										<dt class="w-28 shrink-0 text-[10.5px] font-medium text-muted-foreground">
											{prochainPas.rdv ? 'RDV' : 'Rappel'}
										</dt>
										<dd class="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
											<span class="text-[13px] text-foreground tabular-nums">
												{prochainPas.jour.toLocaleDateString('fr-FR', {
													weekday: 'short',
													day: 'numeric',
													month: 'short'
												})}{prochainPas.heure ? ` · ${prochainPas.heure}` : ''}
											</span>
											<span
												class={[
													'rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold',
													prochainPas.jours < 0
														? 'bg-destructive/15 text-destructive'
														: prochainPas.jours === 0
															? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
															: 'bg-glass-3 text-muted-foreground'
												].join(' ')}
											>
												{prochainPas.quand}
											</span>
										</dd>
									</div>
								{/if}

								<div class="flex items-center gap-3 border-t border-line/70 px-3 py-1.5">
									<dt class="w-28 shrink-0 text-[10.5px] font-medium text-muted-foreground">
										Commercial
									</dt>
									<dd class="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
										{#if commerciauxLies.length > 0}
											{#each commerciauxLies as name (name)}
												<span class="flex items-center gap-1.5">
													<Avatar
														photo={photoByName.get(name.trim().toLowerCase())}
														label={initialsOf(name)}
														alt={name}
														class="size-5 bg-muted text-[9px] font-bold text-muted-foreground"
													/>
													<span class="text-[13px] text-foreground">{name}</span>
												</span>
											{/each}
										{:else}
											<span class="text-[13px] text-muted-foreground">—</span>
										{/if}
									</dd>
								</div>

								{#if !contact.isClient && contact.followUp?.type === 'rdv'}
									<div class="flex items-center gap-3 border-t border-line/70 px-3 py-1.5">
										<dt class="w-28 shrink-0 text-[10.5px] font-medium text-muted-foreground">
											Commercial rattaché
										</dt>
										<dd class="flex min-w-0 flex-1 flex-wrap items-center">
											<Select
												type="single"
												value={contact.followUp?.commercial ?? NONE}
												onValueChange={(v: string) => quickSetCommercial(v)}
											>
												<SelectTrigger
													class="-my-1 h-7 w-fit gap-1.5 rounded-sm border border-transparent bg-transparent px-1 text-[13px] hover:border-line hover:bg-card"
												>
													{#if contact.followUp?.commercial}
														<Avatar
															photo={photoByName.get(
																contact.followUp.commercial.trim().toLowerCase()
															)}
															label={initialsOf(contact.followUp.commercial)}
															alt={contact.followUp.commercial}
															class="size-5 bg-muted text-[9px] font-bold text-muted-foreground"
														/>
													{:else}
														<UserRound class="size-3.5 text-muted-foreground" strokeWidth={1.8} />
													{/if}
													<span
														data-slot="select-value"
														class={contact.followUp?.commercial ? '' : 'text-muted-foreground'}
													>
														{contact.followUp?.commercial || 'Attribuer à…'}
													</span>
												</SelectTrigger>
												<SelectContent>
													<SelectItem value={NONE}>Personne</SelectItem>
													{#each rattachables as c}
														<SelectItem value={commercialName(c)}>
															<span class="flex items-center gap-2">
																<Avatar
																	photo={photoByName.get(commercialName(c).trim().toLowerCase())}
																	label={initialsOf(commercialName(c))}
																	class="size-5 bg-muted text-[9px] font-bold text-muted-foreground"
																/>
																{commercialName(c)}
															</span>
														</SelectItem>
													{/each}
												</SelectContent>
											</Select>
										</dd>
									</div>
								{/if}
							</dl>

							{#if resumeSuivi}
								<p class="border-t border-line/70 px-3 py-1.5 text-[10.5px] text-muted-foreground">
									{resumeSuivi}
								</p>
							{/if}
						</div>

						{#if contact.followUp?.status === 'déballé' && contact.followUp?.nonVenteReason}
							<div class="rounded-lg border border-violet-500/30 bg-violet-500/5 px-3 py-2.5">
								<p
									class="mb-1 text-[10px] font-semibold tracking-wider text-violet-700 uppercase dark:text-violet-300"
								>
									🛑 Raison de non-vente
								</p>
								<p class="text-[13px] whitespace-pre-wrap text-foreground">
									{contact.followUp.nonVenteReason}
								</p>
							</div>
						{/if}

						{#if contact.followUp?.status === 'annulé' && contact.followUp?.annulationReason}
							<div class="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2.5">
								<p
									class="mb-1 text-[10px] font-semibold tracking-wider text-red-700 uppercase dark:text-red-300"
								>
									❌ Raison d'annulation
								</p>
								<p class="text-[13px] whitespace-pre-wrap text-foreground">
									{contact.followUp.annulationReason}
								</p>
							</div>
						{/if}

						<div class="rounded-lg border border-line bg-card2/60 px-3 py-2.5">
							<div class="relative pl-4">
								<div
									class="absolute top-[6px] bottom-1 left-[4px] w-px bg-line/70"
									aria-hidden="true"
								></div>
								<span
									class="absolute top-[4px] left-0 size-2.5 rounded-full bg-muted-foreground/40 ring-2 ring-card"
									aria-hidden="true"
								>
								</span>
								<p
									class="mb-3 flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase"
								>
									Historique
									{#if timeline.length > 0}
										<span class="rounded-full bg-glass-3 px-1.5 py-0.5 text-[9.5px] tabular-nums">
											{timeline.length}
										</span>
									{/if}
								</p>
								{#if timeline.length > 0}
									<div class="space-y-3">
										{#each timeline as entry}
											<div class="relative flex items-start gap-2.5">
												<span
													class={[
														'absolute top-[5px] -left-4 size-2.5 rounded-full ring-2 ring-card',
														entry.dotClass
													].join(' ')}
												></span>
												<div class="min-w-0 flex-1">
													<div class="flex items-center gap-x-2 text-[12px]">
														<span
															class="min-w-0 truncate text-[12px] font-semibold text-foreground"
														>
															{entry.label}
														</span>
														<span class="shrink-0 text-[11px] text-muted-foreground tabular-nums">
															{formatTs(entry.at)}
														</span>
													</div>
													{#if entry.detail}
														<p
															class="mt-0.5 text-[11.5px] leading-snug whitespace-pre-wrap text-muted-foreground"
														>
															{entry.detail}
														</p>
													{/if}
												</div>
											</div>
										{/each}
									</div>
								{:else}
									<p class="text-[13px] text-muted-foreground">—</p>
								{/if}
							</div>
						</div>
					</div>

					<div class="space-y-3">
						{#if viewQualifItems.length > 0}
							<div class="rounded-lg border border-line bg-card2/60 px-3 py-2.5">
								<p
									class="mb-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase"
								>
									🧠 Questions découverte
								</p>
								<div class="flex flex-wrap gap-1.5">
									{#each viewQualifItems as item}
										<span
											class="rounded-md border border-line bg-card2 px-2 py-1 text-[11px] text-foreground"
										>
											<span class="mr-1">{item.emoji}</span>{item.text}
										</span>
									{/each}
								</div>
							</div>
						{/if}

						<div class="rounded-lg border border-line bg-card2/60 px-3 py-2.5">
							<p
								class="mb-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase"
							>
								Informations sur le contact
							</p>
							<p class="text-[13.5px] whitespace-pre-wrap text-foreground">
								{contact.note ? stripQualificationBlock(contact.note) || '—' : '—'}
							</p>
						</div>

						<div class="rounded-lg border border-line bg-card2/60 px-3 py-2.5">
							<div class="mb-1 flex items-center justify-between gap-2">
								<p class="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
									💰 Ventes
									{#if (ventes.data?.length ?? 0) > 0}
										<span
											class="ml-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9.5px] font-semibold text-emerald-700 dark:text-emerald-300"
										>
											{ventes.data?.length}
										</span>
									{/if}
								</p>
								<!-- Sans vente, le bouton est plein : c'est l'action à faire. -->
								<Button
									variant={(ventes.data?.length ?? 0) > 0 ? 'outline' : 'default'}
									size="sm"
									onclick={() => (saleOpen = true)}
								>
									<Plus class="size-3.5" />
									Ajouter une vente
								</Button>
							</div>
							{#if (ventes.data?.length ?? 0) > 0}
								<div class="space-y-2">
									{#each ventes.data ?? [] as vente}
										{@const venteHT = vente.produits.reduce((s, p) => s + p.montantHT, 0)}
										{@const familles = [...new Set(vente.produits.map((p) => p.produit))].join(
											' · '
										)}
										{@const taux = (
											vente.tvaDetail && vente.tvaDetail.length > 0
												? vente.tvaDetail.map((d) => d.taux)
												: vente.produits.map((p) => Number(p.tva))
										)
											.filter((t, i, all) => all.indexOf(t) === i)
											.sort((a, b) => a - b)
											.map((t) => String(t).replace('.', ','))
											.join(' + ')}
										<div
											class={[
												'rounded-xl border bg-card2/60 px-3 py-2.5 transition-colors hover:bg-card2',
												venteCardClass(vente.statut)
											].join(' ')}
										>
											<!-- Le montant de la vente et la famille, sur une seule ligne. -->
											<div class="flex items-start justify-between gap-3">
												<div class="min-w-0">
													<p
														class="flex items-center gap-1.5 text-[13px] font-semibold text-foreground"
													>
														<span
															class="grid size-6 shrink-0 place-items-center rounded-md bg-glass-2 text-[11px]"
														>
															🛍️
														</span>
														<span class="truncate">{familles}</span>
													</p>
													<p class="mt-1 truncate text-[10.5px] text-muted-foreground">
														{new Date(vente.date).toLocaleDateString('fr-FR', {
															day: 'numeric',
															month: 'short',
															year: 'numeric'
														})} · {fmtMoney(venteHT)} € HT · TVA {taux} %
													</p>
												</div>
												<div class="shrink-0 text-right">
													<p
														class={[
															'text-[18px] leading-none font-bold tabular-nums',
															venteTotalClass(vente.statut)
														].join(' ')}
													>
														{fmtMoney(vente.totalTTC)} €
													</p>
													<p
														class="mt-1 text-[9px] font-semibold tracking-[0.16em] text-muted-foreground uppercase"
													>
														TTC
													</p>
												</div>
											</div>

											<!-- Statut (menu) à gauche, auteur de la vente à droite. -->
											<div
												class="mt-2 flex items-center justify-between gap-2 border-t border-line/50 pt-1.5"
											>
												<div class="flex min-w-0 items-center gap-1.5">
													<Select
														type="single"
														value={vente.statut ?? 'valide'}
														onValueChange={(v) => onVenteStatutChange(vente, v)}
													>
														<SelectTrigger
															class={[
																'h-6 w-fit shrink-0 gap-0.5 rounded-full border-0 px-2 text-[10.5px] font-semibold shadow-none [&>svg]:size-3 [&>svg]:opacity-60',
																venteStatutClass(vente.statut)
															].join(' ')}
														>
															<span data-slot="select-value">
																{venteEmoji(vente.statut)}
																{venteStatutLabel(vente.statut)}
															</span>
														</SelectTrigger>
														<SelectContent>
															<SelectItem value="valide">Valide</SelectItem>
															<SelectItem value="en attente">En attente</SelectItem>
															{#if isManager}
																<SelectItem value="erreur">Erreur</SelectItem>
															{/if}
															<SelectItem value="annulée">Annulée</SelectItem>
														</SelectContent>
													</Select>
													<span class="truncate text-[10.5px] text-muted-foreground">
														Vendu par {vente.vendeurDisplay ?? vente.vendeurName}
													</span>
												</div>
												<div class="flex shrink-0 items-center gap-0.5">
													<button
														type="button"
														onclick={() => openEditVente(vente)}
														class="rounded-md p-1 text-muted-foreground transition-colors hover:bg-glass-2 hover:text-foreground"
														aria-label="Modifier la vente"
													>
														<Pencil class="size-3.5" strokeWidth={1.7} />
													</button>
													{#if isManager}
														<button
															type="button"
															onclick={() => handleRemoveVente(vente)}
															class="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
															aria-label="Supprimer la vente"
														>
															<Trash2 class="size-3.5" strokeWidth={1.7} />
														</button>
													{/if}
												</div>
											</div>

											{#if vente.statut === 'erreur' && vente.erreur}
												<div class="mt-2 rounded-md bg-orange-500/5 px-2.5 py-2">
													<div class="flex flex-wrap items-center justify-between gap-2">
														<p
															class="flex items-center gap-1.5 text-[10.5px] font-semibold tracking-wider text-orange-700 uppercase dark:text-orange-300"
														>
															<AlertTriangle class="size-3.5" />
															Dossier en erreur
															{#if vente.erreur.par}
																<span class="font-medium normal-case">— {vente.erreur.par}</span>
															{/if}
														</p>
														{#if isManager}
															<button
																type="button"
																onclick={() => handleRemoveErreur(vente._id)}
																class="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium text-orange-700 transition-colors hover:bg-orange-500/10 dark:text-orange-300"
															>
																<X class="size-3" />
																Supprimer l'erreur
															</button>
														{/if}
													</div>
													{#if (vente.erreur.manquants?.length ?? 0) > 0}
														<div class="mt-1.5 flex flex-wrap gap-1">
															{#each vente.erreur.manquants ?? [] as manquant}
																<span
																	class="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-medium text-orange-700 dark:text-orange-300"
																>
																	{manquant}
																</span>
															{/each}
														</div>
													{/if}
													{#if vente.erreur.note}
														<p class="mt-1.5 text-[11.5px] whitespace-pre-wrap text-foreground/80">
															{vente.erreur.note}
														</p>
													{/if}
												</div>
											{/if}
										</div>
									{/each}
								</div>
							{:else}
								<div class="rounded-lg border border-dashed border-line px-3 py-4 text-center">
									<p class="text-[12.5px] text-muted-foreground">Aucune vente pour l'instant.</p>
									<p class="mt-0.5 text-[11px] text-muted-foreground/80">
										Un produit, un montant HT, la TVA : le TTC se calcule seul.
									</p>
								</div>
							{/if}
						</div>
					</div>
				</div>
			{:else if mode === 'edit'}
				<!-- Édition : même structure que Nouveau Contact (infos / suivi sur PC) -->
				<form onsubmit={handleSave} class="space-y-4">
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div class="space-y-1.5">
							<div class="flex flex-wrap items-center justify-between gap-2">
								<Label for="editContactName">Nom</Label>
								<div class="flex flex-wrap gap-1.5">
									{#each CIVILITES as c}
										<button
											type="button"
											onclick={() => toggleEditCivilite(c)}
											class={civChipClass(editCivilites.includes(c))}
										>
											{c}
										</button>
									{/each}
								</div>
							</div>
							<Input
								id="editContactName"
								required
								bind:value={editName}
								class="border-input bg-base"
							/>
						</div>

						<div class="space-y-1.5">
							<Label for="editContactAddress">Adresse</Label>
							<AddressInput bind:value={editAddress} />
						</div>

						<div class="space-y-1.5">
							<Label for="editContactPhone">Téléphone</Label>
							<Input
								id="editContactPhone"
								type="tel"
								value={formatPhone(editPhone)}
								oninput={(e) => {
									editPhone = formatPhone(e.currentTarget.value);
									onPhoneInput(e);
								}}
								class="border-input bg-base"
							/>
						</div>

						<div class="space-y-1.5">
							<Label for="editContactSource">Source</Label>
							<Select type="single" bind:value={editSource}>
								<SelectTrigger id="editContactSource" class="w-full border-input bg-base">
									<span data-slot="select-value">
										{editSource ? editSource : 'Choisir une source'}
									</span>
								</SelectTrigger>
								<SelectContent>
									{#each contactSources as item}
										<SelectItem value={item}>{item}</SelectItem>
									{/each}
								</SelectContent>
							</Select>
						</div>

						<div class="space-y-1.5">
							<Label for="editContactDate">Date du contact</Label>
							<Input
								id="editContactDate"
								type="date"
								bind:value={editDateContact}
								class="border-input bg-base"
							/>
						</div>

						<div class="space-y-1.5 md:col-span-2">
							<Label for="editContactProjet">Projet</Label>
							<Select type="single" bind:value={editProjet}>
								<SelectTrigger id="editContactProjet" class="w-full border-input bg-base">
									<span data-slot="select-value">
										{editProjet ? editProjet : 'Choisir une famille'}
									</span>
								</SelectTrigger>
								<SelectContent>
									{#each FAMILLES as item}
										<SelectItem value={item}>{item}</SelectItem>
									{/each}
								</SelectContent>
							</Select>
						</div>

						{#if canReassign}
							<div class="space-y-1.5 md:col-span-2">
								<Label for="editContactCreatedBy">Pris par</Label>
								<Select type="single" bind:value={editCreatedBy}>
									<SelectTrigger id="editContactCreatedBy" class="w-full border-input bg-base">
										<span data-slot="select-value">
											{preneurOptions.find((o) => o._id === editCreatedBy)?.name ??
												'Choisir qui a pris le contact'}
										</span>
									</SelectTrigger>
									<SelectContent>
										{#each preneurOptions as o (o._id)}
											<SelectItem value={o._id}>{o.name}{o.isMe ? ' (moi)' : ''}</SelectItem>
										{/each}
									</SelectContent>
								</Select>
								<p class="text-[11.5px] text-muted-foreground">
									Réservé à l'administrateur, au directeur de zone et au directeur d'agence. Le
									contact est ensuite rattaché à cette personne (technicien conseil de la fiche).
								</p>
							</div>
						{/if}
					</div>

					{#snippet suiviBlock()}
						<div class="space-y-2">
							<Label>Suivi</Label>
							<div
								class="relative inline-grid grid-cols-2 gap-1 rounded-xl border border-line bg-card2/60 p-0.5"
							>
								<button
									type="button"
									onclick={() => (editFollowUpType = 'rdv')}
									class={[
										'flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-[12px] font-medium transition-all',
										editFollowUpType === 'rdv'
											? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
											: 'text-muted-foreground hover:bg-brand/10 hover:text-brand light:hover:text-brand'
									].join(' ')}
								>
									<span class="text-[13px] leading-none">📅</span>
									Ajouter un RDV
								</button>
								<button
									type="button"
									onclick={() => (editFollowUpType = 'rappel')}
									class={[
										'flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-[12px] font-medium transition-all',
										editFollowUpType === 'rappel'
											? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
											: 'text-muted-foreground hover:bg-brand/10 hover:text-brand light:hover:text-brand'
									].join(' ')}
								>
									<span class="text-[13px] leading-none">🔔</span>
									Ajouter un rappel
								</button>
							</div>

							{#if editFollowUpType === 'rdv'}
								<Button
									type="button"
									variant="outline"
									size="sm"
									class="w-full border-line text-[12px]"
									onclick={() => (editAgendaOpen = true)}
								>
									<CalendarDays class="size-3.5" />
									Voir l'agenda
								</Button>
								<!-- Sélecteur « Type de RDV » (RDV / Confortation / Gestion dossier)
								     masqué pour l'instant : un RDV créé ici est un RDV classique.
								     Le motif d'un RDV existant reste conservé à l'enregistrement
								     (editRdvMotif est pré-rempli depuis le contact). -->
							{/if}

							{#if editFollowUpType === 'rappel' && contact?.followUp?.type === 'rdv'}
								<div class="space-y-1.5">
									<Label for="editSwitchReason">Raison du passage en rappel</Label>
									<Input
										id="editSwitchReason"
										placeholder="Ex : client injoignable, reporté…"
										bind:value={editSwitchReason}
										class="border-input bg-base"
									/>
								</div>
							{/if}

							<div class="flex gap-3">
								<div class="flex-1 space-y-1.5">
									<Label>Date</Label>
									<Popover>
										<PopoverTrigger
											class="flex h-9 w-full items-center gap-2 rounded-md border border-line bg-base px-3 text-[12.5px] font-medium text-foreground transition-colors hover:bg-card2"
										>
											<CalendarDays class="size-3.5 text-muted-foreground" strokeWidth={1.7} />
											{formattedDate}
										</PopoverTrigger>
										<PopoverContent class="w-auto rounded-xl border-line bg-card p-0" align="start">
											<Calendar
												locale="fr-FR"
												type="single"
												value={editFollowUpDate}
												isDateDisabled={(date) =>
													editFollowUpType === 'rdv' &&
													isSunday(date) &&
													!keepsLegacySunday(date as CalendarDate)}
												onValueChange={(value: DateValue | undefined) => {
													if (value) editFollowUpDate = value as CalendarDate;
												}}
											/>
										</PopoverContent>
									</Popover>
								</div>
								{#if editFollowUpType === 'rdv'}
									<div class="w-28 space-y-1.5">
										<Label>Heure</Label>
										<Select type="single" bind:value={editFollowUpTime}>
											<SelectTrigger class="w-full border-input bg-base">
												<span data-slot="select-value">{editFollowUpTime}</span>
											</SelectTrigger>
											<SelectContent>
												{#each suiviTimes as time}
													<SelectItem value={time}>{time}</SelectItem>
												{/each}
											</SelectContent>
										</Select>
									</div>
								{/if}
							</div>

							{#if editFollowUpType === 'rdv'}
								<div class="grid grid-cols-2 gap-3">
									<div class="space-y-1.5">
										<Label>Commercial rattaché</Label>
										<Select type="single" bind:value={editRdvCommercial}>
											<SelectTrigger class="w-full border-input bg-base">
												{#if editRdvCommercial !== NONE}
													<Avatar
														photo={photoByName.get(editRdvCommercial.trim().toLowerCase())}
														label={initialsOf(editRdvCommercial)}
														alt={editRdvCommercial}
														class="size-5 bg-muted text-[9px] font-bold text-muted-foreground"
													/>
												{/if}
												<span data-slot="select-value">
													{editRdvCommercial !== NONE ? editRdvCommercial : 'Aucun'}
												</span>
											</SelectTrigger>
											<SelectContent>
												<SelectItem value={NONE}>Aucun</SelectItem>
												{#each rattachables as c}
													<SelectItem value={commercialName(c)}>
														<span class="flex items-center gap-2">
															<Avatar
																photo={photoByName.get(commercialName(c).trim().toLowerCase())}
																label={initialsOf(commercialName(c))}
																class="size-5 bg-muted text-[9px] font-bold text-muted-foreground"
															/>
															{commercialName(c)}
														</span>
													</SelectItem>
												{/each}
											</SelectContent>
										</Select>
									</div>
									<div class="space-y-1.5">
										<Label>Statut</Label>
										<Select type="single" bind:value={editRdvStatus}>
											<SelectTrigger class="w-full border-input bg-base">
												<span data-slot="select-value">
													{editRdvStatus !== NONE ? rdvStatusLabel(editRdvStatus) : 'Programmé'}
												</span>
											</SelectTrigger>
											<SelectContent>
												<SelectItem value={NONE}>Programmé</SelectItem>
												<SelectItem value="déballé">Déballé</SelectItem>
												<SelectItem value="à reprogrammer">À reprogrammer</SelectItem>
												<SelectItem value="annulé">Annulé</SelectItem>
												<SelectItem value="vendu">Vendu</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>
							{/if}
						</div>
					{/snippet}

					<!-- Prise de contact (RDV / rappel) -->
					{@render suiviBlock()}

					<QualificationQuestions bind:answers={editQualif} />

					<!-- Informations sur le contact : la note, sous le questionnaire -->
					<div class="space-y-1.5">
						<Label for="editContactNote">Informations sur le contact</Label>
						<Textarea
							id="editContactNote"
							rows={4}
							bind:value={editNote}
							class="min-h-28 border-input bg-base"
						/>
					</div>

					{#if editError}
						<p class="text-[12px] text-destructive">{editError}</p>
					{/if}
				</form>
			{:else}
				<!-- Recontact -->
				<form onsubmit={handleRecontact} class="space-y-4">
					<div class="space-y-1.5">
						<Label for="recontactResponse">Réponse au recontact</Label>
						<Textarea
							id="recontactResponse"
							rows={4}
							required
							placeholder="Réponse du contact…"
							bind:value={recontactResponse}
							class="min-h-28 border-input bg-base"
						/>
					</div>

					<div class="space-y-2">
						<Label>Nouveau suivi</Label>
						<div
							class="relative inline-grid grid-cols-2 gap-1 rounded-xl border border-line bg-card2/60 p-0.5"
						>
							<button
								type="button"
								onclick={() => (recontactFollowUpType = 'rdv')}
								class={[
									'flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-[12px] font-medium transition-all',
									recontactFollowUpType === 'rdv'
										? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
										: 'text-muted-foreground hover:bg-brand/10 hover:text-brand light:hover:text-brand'
								].join(' ')}
							>
								<span class="text-[13px] leading-none">📅</span>
								Ajouter un RDV
							</button>
							<button
								type="button"
								onclick={() => (recontactFollowUpType = 'rappel')}
								class={[
									'flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-[12px] font-medium transition-all',
									recontactFollowUpType === 'rappel'
										? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
										: 'text-muted-foreground hover:bg-brand/10 hover:text-brand light:hover:text-brand'
								].join(' ')}
							>
								<span class="text-[13px] leading-none">🔔</span>
								Ajouter un rappel
							</button>
						</div>

						{#if recontactFollowUpType === 'rappel' && contact.followUp?.type === 'rdv'}
							<div class="space-y-1.5">
								<Label for="recontactSwitchReason">Raison du passage en rappel</Label>
								<Input
									id="recontactSwitchReason"
									placeholder="Ex : client injoignable, reporté…"
									bind:value={recontactSwitchReason}
									class="border-input bg-base"
								/>
							</div>
						{/if}

						<div class="flex gap-3">
							<div class="flex-1 space-y-1.5">
								<Label>Date</Label>
								<Popover>
									<PopoverTrigger
										class="flex h-9 w-full items-center gap-2 rounded-md border border-line bg-base px-3 text-[12.5px] font-medium text-foreground transition-colors hover:bg-card2"
									>
										<CalendarDays class="size-3.5 text-muted-foreground" strokeWidth={1.7} />
										{formattedRecontactDate}
									</PopoverTrigger>
									<PopoverContent class="w-auto rounded-xl border-line bg-card p-0" align="start">
										<Calendar
											locale="fr-FR"
											type="single"
											value={recontactFollowUpDate}
											isDateDisabled={(date) =>
												recontactFollowUpType === 'rdv' &&
												isSunday(date) &&
												!keepsLegacySunday(date as CalendarDate)}
											onValueChange={(value: DateValue | undefined) => {
												if (value) recontactFollowUpDate = value as CalendarDate;
											}}
										/>
									</PopoverContent>
								</Popover>
							</div>
							{#if recontactFollowUpType === 'rdv'}
								<div class="w-28 space-y-1.5">
									<Label>Heure</Label>
									<Select type="single" bind:value={recontactFollowUpTime}>
										<SelectTrigger class="w-full border-input bg-base">
											<span data-slot="select-value">{recontactFollowUpTime}</span>
										</SelectTrigger>
										<SelectContent>
											{#each suiviTimes as time}
												<SelectItem value={time}>{time}</SelectItem>
											{/each}
										</SelectContent>
									</Select>
								</div>
							{/if}
						</div>

						{#if recontactFollowUpType === 'rdv'}
							<div class="grid grid-cols-2 gap-3">
								<div class="space-y-1.5">
									<Label>Commercial rattaché</Label>
									<Select type="single" bind:value={recontactRdvCommercial}>
										<SelectTrigger class="w-full border-input bg-base">
											{#if recontactRdvCommercial !== NONE}
												<Avatar
													photo={photoByName.get(recontactRdvCommercial.trim().toLowerCase())}
													label={initialsOf(recontactRdvCommercial)}
													alt={recontactRdvCommercial}
													class="size-5 bg-muted text-[9px] font-bold text-muted-foreground"
												/>
											{/if}
											<span data-slot="select-value">
												{recontactRdvCommercial !== NONE ? recontactRdvCommercial : 'Aucun'}
											</span>
										</SelectTrigger>
										<SelectContent>
											<SelectItem value={NONE}>Aucun</SelectItem>
											{#each rattachables as c}
												<SelectItem value={commercialName(c)}>
													<span class="flex items-center gap-2">
														<Avatar
															photo={photoByName.get(commercialName(c).trim().toLowerCase())}
															label={initialsOf(commercialName(c))}
															class="size-5 bg-muted text-[9px] font-bold text-muted-foreground"
														/>
														{commercialName(c)}
													</span>
												</SelectItem>
											{/each}
										</SelectContent>
									</Select>
								</div>
								<div class="space-y-1.5">
									<Label>Statut</Label>
									<Select type="single" bind:value={recontactRdvStatus}>
										<SelectTrigger class="w-full border-input bg-base">
											<span data-slot="select-value">
												{recontactRdvStatus !== NONE
													? rdvStatusLabel(recontactRdvStatus)
													: 'Programmé'}
											</span>
										</SelectTrigger>
										<SelectContent>
											<SelectItem value={NONE}>Programmé</SelectItem>
											<SelectItem value="déballé">Déballé</SelectItem>
											<SelectItem value="annulé">Annulé</SelectItem>
											<SelectItem value="vendu">Vendu</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>
						{/if}
					</div>

					{#if recontactError}
						<p class="text-[12px] text-destructive">{recontactError}</p>
					{/if}
				</form>
			{/if}
		{/if}

		<!-- Barre d'actions : l'action utile maintenant, le reste rangé dans « Plus ».
		     Trois éléments au lieu de six, et rien qui déborde de la fenêtre. -->
		<!-- Refus du serveur (ex. marquage « traité » non autorisé) : visible au pied de la fiche. -->
		{#if traiteError && !traiteOpen}
			<p class="rounded-md bg-destructive/10 px-2.5 py-2 text-[12px] font-medium text-destructive">
				{traiteError}
			</p>
		{/if}
		<DialogFooter class="flex flex-col gap-2 sm:flex-row sm:items-center">
			{#if mode === 'view'}
				<Popover bind:open={actionsOuvertes}>
					<PopoverTrigger
						class="order-1 inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-line-strong px-3.5 text-[12.5px] font-bold tracking-[0.06em] text-foreground uppercase transition-colors hover:border-brand hover:text-brand aria-expanded:border-brand aria-expanded:text-brand sm:order-none sm:mr-auto"
					>
						<Ellipsis class="size-4" />
						Plus
					</PopoverTrigger>
					<PopoverContent align="start" class="w-60 gap-0.5 p-1.5">
						{#if !contact?.isClient}
							{#if actionPrincipale?.id === 'annonce'}
								<button
									type="button"
									class={itemAction}
									onclick={() => {
										actionsOuvertes = false;
										openRecontact();
									}}
								>
									<PhoneCall class="size-3.5 text-muted-foreground" />
									Recontacter
								</button>
							{:else if contact?.followUp?.type === 'rdv'}
								<button
									type="button"
									class={itemAction}
									onclick={() => {
										actionsOuvertes = false;
										copyAnnonceRdv();
									}}
								>
									<Megaphone class="size-3.5 text-muted-foreground" />
									{annonceCopied ? 'Annonce copiée !' : "Copier l'annonce du RDV"}
								</button>
							{/if}
						{/if}
						<button
							type="button"
							class={itemAction}
							onclick={() => {
								actionsOuvertes = false;
								printContactSheet();
							}}
						>
							{#if isPrinted}
								<Check class="size-3.5 text-emerald-700 dark:text-emerald-300" />
								Fiche imprimée
							{:else}
								<Printer class="size-3.5 text-muted-foreground" />
								Imprimer la fiche
							{/if}
						</button>
						{#if !contact?.isClient}
							<button
								type="button"
								class={itemAction}
								onclick={() => {
									actionsOuvertes = false;
									// Traiter demande une raison (journalisée) ; retirer le marquage
									// se fait directement.
									if (contact?.statut === 'traité') handleMarkTreated(false);
									else openTraiteDialog();
								}}
							>
								{#if contact?.statut === 'traité'}
									<Undo2 class="size-3.5 text-muted-foreground" />
									Remettre dans le suivi
								{:else}
									<CheckCircle2 class="size-3.5 text-muted-foreground" />
									Marquer comme traité
								{/if}
							</button>
						{/if}
						{#if canDelete}
							<div class="my-1 h-px bg-line"></div>
							<button
								type="button"
								class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] font-medium text-destructive transition-colors hover:bg-destructive/10"
								onclick={() => {
									actionsOuvertes = false;
									deleteOpen = true;
								}}
							>
								<Trash2 class="size-3.5" />
								Supprimer
							</button>
						{/if}
					</PopoverContent>
				</Popover>

				{#if actionPrincipale}
					<Button
						onclick={() => (actionPrincipale.id === 'annonce' ? copyAnnonceRdv() : openRecontact())}
						class="order-3 gap-1.5 sm:order-none"
					>
						{#if actionPrincipale.id === 'annonce'}
							{#if annonceCopied}
								<Check class="size-4" />
								Copié !
							{:else}
								<Megaphone class="size-4" strokeWidth={1.8} />
								{actionPrincipale.label}
							{/if}
						{:else}
							<PhoneCall class="size-4" strokeWidth={1.7} />
							{actionPrincipale.label}
						{/if}
					</Button>
				{/if}

				<Button variant="outline" onclick={() => (mode = 'edit')} class="order-2 sm:order-none">
					<Pencil class="size-4" strokeWidth={1.7} />
					Modifier
				</Button>
			{:else if mode === 'edit'}
				<Button variant="ghost" onclick={() => (mode = 'view')} disabled={editBusy}>Annuler</Button>
				<div class="flex-1"></div>
				<Button onclick={handleSave} disabled={editBusy}>
					{#if editBusy}
						<LoaderCircle class="size-4 animate-spin" />
					{/if}
					Enregistrer
				</Button>
			{:else}
				<Button variant="ghost" onclick={() => (mode = 'view')} disabled={recontactBusy}>
					Annuler
				</Button>
				<div class="flex-1"></div>
				<Button onclick={handleRecontact} disabled={recontactBusy}>
					{#if recontactBusy}
						<LoaderCircle class="size-4 animate-spin" />
					{/if}
					Enregistrer le recontact
				</Button>
			{/if}
		</DialogFooter>
	</DialogContent>

	<SaleDialog
		bind:open={saleOpen}
		contactId={contact?._id}
		commercialName={contact?.followUp?.commercial ?? undefined}
	/>

	<SaleDialog
		bind:open={saleEditOpen}
		contactId={contact?._id}
		venteId={editingVente?._id}
		initialVente={editingVente}
	/>

	<ErreurVenteDialog bind:open={erreurOpen} vente={erreurVente} />

	<!-- Confirmation de suppression du contact / client -->
	<Dialog bind:open={deleteOpen}>
		<DialogContent class="max-w-sm rounded-xl border-line bg-card">
			<DialogHeader>
				<DialogTitle class="flex items-center gap-2 text-[14px] font-semibold">
					<span
						class="grid size-8 place-items-center rounded-lg border border-line bg-card2 text-destructive"
					>
						<Trash2 class="size-4" strokeWidth={1.7} />
					</span>
					Supprimer {contact?.isClient ? 'le client' : 'le contact'}
				</DialogTitle>
			</DialogHeader>

			<p class="text-[13px] leading-relaxed text-muted-foreground">
				Supprimer <strong class="text-foreground">{contact?.name}</strong> ?
				{#if contact?.isClient}
					Les ventes liées seront supprimées aussi.
				{:else}
					Le RDV / rappel lié sera supprimé.
				{/if}
				Cette action est irréversible.
			</p>

			{#if deleteError}
				<p class="text-[12px] text-destructive">{deleteError}</p>
			{/if}

			<DialogFooter class="gap-2">
				<Button variant="ghost" onclick={() => (deleteOpen = false)} disabled={deleteBusy}>
					Annuler
				</Button>
				<Button variant="destructive" onclick={handleDeleteContact} disabled={deleteBusy}>
					{#if deleteBusy}
						<LoaderCircle class="size-4 animate-spin" />
					{/if}
					Supprimer définitivement
				</Button>
			</DialogFooter>
		</DialogContent>
	</Dialog>

	<!-- Popup de saisie de la raison de non-vente (RDV passé en déballé) -->
	<Dialog bind:open={nonVenteOpen}>
		<DialogContent
			class="max-w-sm rounded-xl border-line bg-card"
			onInteractOutside={(event) => event.preventDefault()}
		>
			<DialogHeader>
				<DialogTitle class="flex items-center gap-2 text-[14px] font-semibold">
					<span
						class="grid size-8 place-items-center rounded-lg border border-line bg-card2 text-muted-foreground"
					>
						📦
					</span>
					Raison de la non-vente
				</DialogTitle>
			</DialogHeader>

			<div class="space-y-1.5">
				<Label for="nonVenteReason">Pourquoi ce RDV n'aboutit-il pas à une vente ?</Label>
				<Textarea
					id="nonVenteReason"
					rows={3}
					placeholder="Ex : prix trop élevé, besoin pas prioritaire, dossier reporté…"
					bind:value={nonVenteReason}
					class="min-h-20 border-input bg-base"
					autofocus
				/>
			</div>

			<DialogFooter class="gap-2">
				<Button
					variant="ghost"
					onclick={() => {
						nonVenteReason = '';
						nonVenteOpen = false;
					}}
				>
					Annuler
				</Button>
				<Button onclick={confirmNonVente} disabled={quickBusy || !nonVenteReason.trim()}>
					{#if quickBusy}
						<LoaderCircle class="size-4 animate-spin" />
					{/if}
					Valider
				</Button>
			</DialogFooter>
		</DialogContent>
	</Dialog>

	<!-- Popup de saisie de la raison d'annulation (RDV passé en annulé) -->
	<Dialog bind:open={annulationOpen}>
		<DialogContent
			class="max-w-sm rounded-xl border-line bg-card"
			onInteractOutside={(event) => event.preventDefault()}
		>
			<DialogHeader>
				<DialogTitle class="flex items-center gap-2 text-[14px] font-semibold">
					<span
						class="grid size-8 place-items-center rounded-lg border border-line bg-card2 text-muted-foreground"
					>
						❌
					</span>
					Raison d'annulation
				</DialogTitle>
			</DialogHeader>

			<div class="space-y-1.5">
				<Label for="annulationReason">Pourquoi ce RDV est-il annulé ?</Label>
				<Textarea
					id="annulationReason"
					rows={3}
					placeholder="Ex : client absent, reporté, plus intéressé…"
					bind:value={annulationReason}
					class="min-h-20 border-input bg-base"
					autofocus
				/>
			</div>

			<DialogFooter class="gap-2">
				<Button
					variant="ghost"
					onclick={() => {
						annulationReason = '';
						annulationOpen = false;
					}}
				>
					Annuler
				</Button>
				<Button onclick={confirmAnnulation} disabled={quickBusy || !annulationReason.trim()}>
					{#if quickBusy}
						<LoaderCircle class="size-4 animate-spin" />
					{/if}
					Valider
				</Button>
			</DialogFooter>
		</DialogContent>
	</Dialog>

	<!-- Popup de saisie de la raison du marquage « traité » -->
	<Dialog bind:open={traiteOpen}>
		<DialogContent
			class="max-w-sm rounded-xl border-line bg-card"
			onInteractOutside={(event) => event.preventDefault()}
		>
			<DialogHeader>
				<DialogTitle class="flex items-center gap-2 text-[14px] font-semibold">
					<span
						class="grid size-8 place-items-center rounded-lg border border-line bg-card2 text-muted-foreground"
					>
						✅
					</span>
					Pourquoi ce contact est-il traité ?
				</DialogTitle>
			</DialogHeader>

			{#if traiteError}
				<p
					class="rounded-md bg-destructive/10 px-2.5 py-2 text-[12px] font-medium text-destructive"
				>
					{traiteError}
				</p>
			{/if}

			<div class="space-y-1.5">
				<Label for="traiteReason">Raison du traitement</Label>
				<Textarea
					id="traiteReason"
					rows={3}
					placeholder="Ex : dossier clos, client déjà équipé, hors cible…"
					bind:value={traiteReason}
					class="min-h-20 border-input bg-base"
					autofocus
				/>
			</div>

			<DialogFooter class="gap-2">
				<Button
					variant="ghost"
					onclick={() => {
						traiteReason = '';
						traiteOpen = false;
					}}
				>
					Annuler
				</Button>
				<Button onclick={confirmTraite} disabled={quickBusy || !traiteReason.trim()}>
					{#if quickBusy}
						<LoaderCircle class="size-4 animate-spin" />
					{/if}
					Valider
				</Button>
			</DialogFooter>
		</DialogContent>
	</Dialog>

	<AgendaApercuDialog bind:open={editAgendaOpen} />

	{#if contact}
		<ContactPrintSheet {contact} answers={viewQualif} />
	{/if}
</Dialog>
