<script lang="ts">
	import { CalendarDays, LoaderCircle, UserPlus } from '@lucide/svelte';
	import { CalendarDate, getLocalTimeZone, type DateValue } from '@internationalized/date';
	import { useMutation } from 'convex-svelte';
	import { api } from '../../convex/_generated/api.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Calendar } from '$lib/components/ui/calendar/index.js';
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
	import { FAMILLES } from '$lib/data/catalogue';
	import { contactSources, type ContactSource } from '$lib/data/sources';
	import { formatPhone, onPhoneInput } from '$lib/data/phone';
	import { useQuery } from 'convex-svelte';
	import { initialQualification, qualifAnswered, toQualifDoc } from '$lib/data/qualification';
	import AddressInput from './AddressInput.svelte';
	import AgendaApercuDialog from './agenda-apercu-dialog.svelte';
	import QualificationQuestions from './QualificationQuestions.svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	const createContact = useMutation(api.contacts.create);

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

	let name = $state('');
	// Civilités (M. / Mme / Melle) : choix multiple possible (couple), reprises
	// sur la fiche contact imprimable.
	let civilites = $state<string[]>([]);

	const CIVILITES = ['M.', 'Mme', 'Melle'] as const;
	function toggleCivilite(value: string) {
		civilites = civilites.includes(value)
			? civilites.filter((c) => c !== value)
			: [...civilites, value];
	}
	function chipClass(active: boolean): string {
		return [
			'rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-all',
			active
				? 'bg-primary text-primary-foreground'
				: 'bg-card2 text-muted-foreground hover:bg-glass-3 hover:text-foreground'
		].join(' ');
	}
	let address = $state('');
	// Composantes BAN de l'adresse, pour les zones, la carte et les doublons.
	let addressStreet = $state('');
	let addressPostalCode = $state('');
	let addressCity = $state('');
	let latitude = $state<number | undefined>();
	let longitude = $state<number | undefined>();
	let phone = $state('');
	let projet = $state('');
	let source = $state('');
	let note = $state('');

	// Doublons probables : même téléphone dans l'agence (mise en garde, pas blocage —
	// un couple peut partager une ligne).
	const doublons = useQuery(api.contacts.findDoublons, () =>
		phone.replace(/\D/g, '').length >= 8 ? { phone } : 'skip'
	);
	let followUpType = $state<'rappel' | 'rdv'>('rdv');
	let followUpTime = $state('10:00');
	let busy = $state(false);
	let error = $state('');
	let agendaOpen = $state(false);

	// Réponses du questionnaire « Questions découverte » (sérialisées dans la note).
	let qualif = $state(initialQualification());

	const now = new Date();
	let followUpDate = $state(new CalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate()));

	// L'agenda (web et mobile) affiche du lundi au samedi : un RDV un dimanche
	// serait invisible. On interdit la saisie d'un dimanche pour un RDV.
	const isSunday = (date: DateValue) => date.toDate(getLocalTimeZone()).getDay() === 0;

	const formattedDate = $derived(
		followUpDate.toDate(getLocalTimeZone()).toLocaleDateString('fr-FR', {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		})
	);

	function reset() {
		name = '';
		civilites = [];
		address = '';
		addressStreet = '';
		addressPostalCode = '';
		addressCity = '';
		latitude = undefined;
		longitude = undefined;
		phone = '';
		projet = '';
		source = '';
		note = '';
		followUpType = 'rdv';
		followUpTime = '10:00';
		qualif = initialQualification();
		error = '';
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (!name.trim()) {
			error = 'Le nom du contact est requis.';
			return;
		}
		if (!source) {
			error = 'La source est requise.';
			return;
		}
		if (!address.trim()) {
			error = "L'adresse est requise.";
			return;
		}
		if (!phone.trim()) {
			error = 'Le numéro de téléphone est requis.';
			return;
		}
		if (!projet) {
			error = 'Le projet est requis.';
			return;
		}
		if (followUpType === 'rdv' && isSunday(followUpDate)) {
			error = 'Les RDV ne peuvent pas être planifiés un dimanche.';
			return;
		}
		busy = true;
		error = '';
		try {
			await createContact({
				name: name.trim(),
				civilites: civilites.length > 0 ? (civilites as ('M.' | 'Mme' | 'Melle')[]) : undefined,
				address: address.trim() || undefined,
				addressStreet: addressStreet || undefined,
				addressPostalCode: addressPostalCode || undefined,
				addressCity: addressCity || undefined,
				latitude,
				longitude,
				phone: phone.trim() || undefined,
				projet: projet || undefined,
				source: (source || undefined) as ContactSource | undefined,
				// Les réponses des questions découverte sont stockées à part : la note
				// reste du texte libre (plus de bloc sérialisé dedans).
				note: note.trim() || undefined,
				qualif: qualifAnswered(qualif) > 0 ? toQualifDoc(qualif) : undefined,
				followUp: {
					type: followUpType,
					date: followUpDate.toString(),
					time: followUpType === 'rdv' ? followUpTime : undefined
				}
			});
			open = false;
			reset();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Enregistrement impossible.';
		} finally {
			busy = false;
		}
	}
</script>

<Dialog bind:open>
	<DialogContent
		class="max-h-[90vh] overflow-y-auto rounded-2xl border-0 bg-card shadow-none sm:max-w-3xl"
	>
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2.5 text-[15px] font-semibold">
				<span class="grid size-8 place-items-center rounded-xl bg-card2 text-muted-foreground">
					<UserPlus class="size-4" strokeWidth={1.7} />
				</span>
				Nouveau contact
			</DialogTitle>
		</DialogHeader>

		<form onsubmit={handleSubmit} class="space-y-4">
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div class="space-y-1.5">
					<div class="flex min-h-7 flex-wrap items-center justify-between gap-2">
						<Label for="contactName">Nom</Label>
						<div class="flex flex-wrap gap-1.5">
							{#each CIVILITES as c}
								<button
									type="button"
									onclick={() => toggleCivilite(c)}
									class={chipClass(civilites.includes(c))}
								>
									{c}
								</button>
							{/each}
						</div>
					</div>
					<Input
						id="contactName"
						required
						placeholder="Marie Dupont"
						bind:value={name}
						class="border-0 bg-card2 shadow-none"
					/>
				</div>

				<div class="space-y-1.5">
					<div class="flex min-h-7 items-center justify-between gap-2">
						<Label for="contactAddress">Adresse</Label>
					</div>
					<AddressInput
						bind:value={address}
						onPickDetails={(d) => {
							addressStreet = d.street ?? '';
							addressPostalCode = d.postalCode ?? '';
							addressCity = d.city ?? '';
							latitude = d.latitude;
							longitude = d.longitude;
						}}
					/>
				</div>

				<div class="space-y-1.5">
					<Label for="contactPhone">Téléphone</Label>
					<Input
						id="contactPhone"
						type="tel"
						placeholder="06 12 34 56 78"
						value={formatPhone(phone)}
						oninput={(e) => {
							phone = formatPhone(e.currentTarget.value);
							onPhoneInput(e);
						}}
						class="border-0 bg-card2 shadow-none"
					/>
				</div>

				<div class="space-y-1.5">
					<Label for="contactSource">Source</Label>
					<Select type="single" bind:value={source}>
						<SelectTrigger id="contactSource" class="w-full border-0 bg-card2 shadow-none">
							<span data-slot="select-value">
								{source ? source : 'Choisir une source'}
							</span>
						</SelectTrigger>
						<SelectContent>
							{#each contactSources as item}
								<SelectItem value={item}>{item}</SelectItem>
							{/each}
						</SelectContent>
					</Select>
				</div>

				{#if (doublons.data?.length ?? 0) > 0}
					<div
						class="rounded-xl bg-amber-500/10 px-3 py-2 text-[11.5px] leading-snug text-amber-800 md:col-span-2 dark:text-amber-200"
					>
						<span class="font-semibold">Doublon probable :</span>
						ce numéro est déjà sur
						{#each doublons.data ?? [] as d, i}
							{i > 0 ? ', ' : ''}{d.name}
						{/each}
						. Vérifie qu'il ne s'agit pas du même client.
					</div>
				{/if}

				<div class="space-y-1.5 md:col-span-2">
					<Label for="contactProjet">Projet</Label>
					<Select type="single" bind:value={projet}>
						<SelectTrigger id="contactProjet" class="w-full border-0 bg-card2 shadow-none">
							<span data-slot="select-value">
								{projet ? projet : 'Choisir un projet'}
							</span>
						</SelectTrigger>
						<SelectContent>
							{#each FAMILLES as item}
								<SelectItem value={item}>{item}</SelectItem>
							{/each}
						</SelectContent>
					</Select>
				</div>
			</div>

			{#snippet suiviBlock()}
				<div class="space-y-2">
					<Label>Suivi</Label>
					<div class="relative inline-grid grid-cols-2 gap-1 rounded-full bg-card2 p-0.5">
						<button
							type="button"
							onclick={() => (followUpType = 'rdv')}
							class={[
								'flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-all',
								followUpType === 'rdv'
									? 'bg-primary text-primary-foreground'
									: 'text-muted-foreground hover:bg-glass-3 hover:text-foreground'
							].join(' ')}
						>
							<span class="text-[13px] leading-none">📅</span>
							Ajouter un RDV
						</button>
						<button
							type="button"
							onclick={() => (followUpType = 'rappel')}
							class={[
								'flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-all',
								followUpType === 'rappel'
									? 'bg-primary text-primary-foreground'
									: 'text-muted-foreground hover:bg-glass-3 hover:text-foreground'
							].join(' ')}
						>
							<span class="text-[13px] leading-none">🔔</span>
							Ajouter un rappel
						</button>
					</div>

					{#if followUpType === 'rdv'}
						<Button
							type="button"
							variant="outline"
							size="sm"
							class="w-full text-[12px]"
							onclick={() => (agendaOpen = true)}
						>
							<CalendarDays class="size-3.5" />
							Voir l'agenda
						</Button>
					{/if}

					<div class="flex gap-3">
						<div class="flex-1 space-y-1.5">
							<Label for="contactDate">Date</Label>
							<Popover>
								<PopoverTrigger
									class="flex h-9 w-full items-center gap-2 rounded-full bg-card2 px-3 text-[12.5px] font-medium text-foreground transition-colors hover:bg-glass-3"
								>
									<CalendarDays class="size-3.5 text-muted-foreground" strokeWidth={1.7} />
									{formattedDate}
								</PopoverTrigger>
								<PopoverContent
									class="w-auto rounded-2xl border-0 bg-card p-0 shadow-none"
									align="start"
								>
									<Calendar
										locale="fr-FR"
										type="single"
										value={followUpDate}
										isDateDisabled={(date) => followUpType === 'rdv' && isSunday(date)}
										onValueChange={(value: DateValue | undefined) => {
											if (value) followUpDate = value as CalendarDate;
										}}
									/>
								</PopoverContent>
							</Popover>
						</div>
						{#if followUpType === 'rdv'}
							<div class="w-28 space-y-1.5">
								<Label for="contactTime">Heure</Label>
								<Select type="single" bind:value={followUpTime}>
									<SelectTrigger id="contactTime" class="w-full border-0 bg-card2 shadow-none">
										<span data-slot="select-value">{followUpTime}</span>
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
				</div>
			{/snippet}

			<!-- Prise de contact (RDV / rappel) -->
			{@render suiviBlock()}

			<QualificationQuestions bind:answers={qualif} />

			<!-- Informations sur le contact : la note, sous le questionnaire -->
			<div class="space-y-1.5">
				<Label for="contactNote">Informations sur le contact</Label>
				<Textarea
					id="contactNote"
					rows={5}
					placeholder="Notes sur le contact…"
					bind:value={note}
					class="min-h-28 border-0 bg-card2 shadow-none"
				/>
			</div>

			{#if error}
				<p class="text-[12px] text-destructive">{error}</p>
			{/if}

			<DialogFooter class="gap-2">
				<Button variant="ghost" type="button" onclick={() => (open = false)}>Annuler</Button>
				<Button type="submit" disabled={busy}>
					{#if busy}
						<LoaderCircle class="size-4 animate-spin" />
					{/if}
					Enregistrer le contact
				</Button>
			</DialogFooter>
		</form>
	</DialogContent>

	<AgendaApercuDialog bind:open={agendaOpen} />
</Dialog>
