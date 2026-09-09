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
	import AddressInput from './AddressInput.svelte';
	import AgendaApercuDialog from './agenda-apercu-dialog.svelte';

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
	let address = $state('');
	let phone = $state('');
	let projet = $state('');
	let source = $state('');
	let note = $state('');
	let followUpType = $state<'rappel' | 'rdv'>('rdv');
	let followUpTime = $state('10:00');
	let busy = $state(false);
	let error = $state('');
	let agendaOpen = $state(false);

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
		address = '';
		phone = '';
		projet = '';
		source = '';
		note = '';
		followUpType = 'rdv';
		followUpTime = '10:00';
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
				address: address.trim() || undefined,
				phone: phone.trim() || undefined,
				projet: projet || undefined,
				source: (source || undefined) as ContactSource | undefined,
				note: note.trim() || undefined,
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
		class="max-h-[90vh] overflow-y-auto rounded-xl border-line bg-card sm:max-w-3xl"
		onInteractOutside={(event) => event.preventDefault()}
	>
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2.5 text-[15px] font-semibold">
				<span
					class="grid size-8 place-items-center rounded-lg border border-line bg-card2 text-muted-foreground"
				>
					<UserPlus class="size-4" strokeWidth={1.7} />
				</span>
				Nouveau contact
			</DialogTitle>
		</DialogHeader>

		<form onsubmit={handleSubmit} class="space-y-4">
			<div class="grid grid-cols-1 gap-5 md:grid-cols-2">
				<!-- Partie 1 : informations du contact -->
				<div class="space-y-4">
					<div class="space-y-1.5">
						<Label for="contactName">Nom</Label>
						<Input
							id="contactName"
							required
							placeholder="Marie Dupont"
							bind:value={name}
							class="border-line bg-base"
						/>
					</div>

					<div class="space-y-1.5">
						<Label for="contactAddress">Adresse</Label>
						<AddressInput bind:value={address} />
					</div>

					<div class="grid grid-cols-2 gap-3">
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
								class="border-line bg-base"
							/>
						</div>
						<div class="space-y-1.5">
							<Label for="contactSource">Source</Label>
							<Select type="single" bind:value={source}>
								<SelectTrigger id="contactSource" class="w-full border-line bg-base">
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
					</div>

					<div class="space-y-1.5">
						<Label for="contactProjet">Projet</Label>
						<Select type="single" bind:value={projet}>
							<SelectTrigger id="contactProjet" class="w-full border-line bg-base">
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

					<div class="space-y-1.5">
						<Label for="contactNote">Informations sur le contact</Label>
						<Textarea
							id="contactNote"
							rows={6}
							placeholder="Notes sur le contact…"
							bind:value={note}
							class="min-h-36 border-line bg-base"
						/>
					</div>
				</div>

				<!-- Partie 2 : suivi -->
				<div class="space-y-2">
					<Label>Suivi</Label>
					<div
						class="relative inline-grid grid-cols-2 gap-1 rounded-xl border border-line bg-card2/60 p-0.5"
					>
						<button
							type="button"
							onclick={() => (followUpType = 'rdv')}
							class={[
								'flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all',
								followUpType === 'rdv'
									? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
									: 'text-muted-foreground hover:bg-primary/10 hover:text-violet-200 light:hover:text-violet-600'
							].join(' ')}
						>
							<span class="text-[13px] leading-none">📅</span>
							Ajouter un RDV
						</button>
						<button
							type="button"
							onclick={() => (followUpType = 'rappel')}
							class={[
								'flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all',
								followUpType === 'rappel'
									? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
									: 'text-muted-foreground hover:bg-primary/10 hover:text-violet-200 light:hover:text-violet-600'
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
							class="w-full border-line text-[12px]"
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
									class="flex h-9 w-full items-center gap-2 rounded-md border border-line bg-base px-3 text-[12.5px] font-medium text-foreground transition-colors hover:bg-card2"
								>
									<CalendarDays class="size-3.5 text-muted-foreground" strokeWidth={1.7} />
									{formattedDate}
								</PopoverTrigger>
								<PopoverContent class="w-auto rounded-xl border-line bg-card p-0" align="start">
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
									<SelectTrigger id="contactTime" class="w-full border-line bg-base">
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
