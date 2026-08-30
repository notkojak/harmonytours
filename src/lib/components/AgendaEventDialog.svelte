<script lang="ts">
	import { CalendarDays, LoaderCircle, X } from '@lucide/svelte';
	import { CalendarDate, type DateValue } from '@internationalized/date';
	import { env } from '$env/dynamic/public';
	import { useMutation } from 'convex-svelte';
	import { api } from '../../convex/_generated/api.js';
	import type { Id } from '../../convex/_generated/dataModel.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Calendar } from '$lib/components/ui/calendar/index.js';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover/index.js';

	export type MembreRow = { _id: string; firstName: string; lastName: string };

	// Événement en cours d'édition (null = création).
	export type EventEdit = {
		_id: string;
		type: 'réunion' | 'formation' | 'prospection' | 'gestion';
		titre: string;
		date: string;
		start: string;
		end: string;
		secteur?: string | null;
		membres?: string[] | null;
		sections?: { nom?: string | null; secteur: string; membres: string[] }[] | null;
	};
	const TYPES = [
		{
			value: 'réunion',
			label: 'Réunion',
			emoji: '👨‍🏫',
			cls: 'border-violet-500/60 bg-violet-500/15 text-violet-300'
		},
		{
			value: 'formation',
			label: 'Formation',
			emoji: '🎓',
			cls: 'border-yellow-500/60 bg-yellow-500/15 text-yellow-300'
		},
		{
			value: 'prospection',
			label: 'Prospection',
			emoji: '🔎',
			cls: 'border-rose-500/60 bg-rose-500/15 text-rose-300'
		},
		{
			value: 'gestion',
			label: 'Gestion dossier',
			emoji: '📁',
			cls: 'border-violet-500/60 bg-violet-500/15 text-violet-300'
		}
	] as const;

	type EventType = (typeof TYPES)[number]['value'];

	const DEFAULT_TITRES: Record<EventType, string> = {
		réunion: 'Réunion',
		formation: 'Formation',
		prospection: 'Prospection',
		gestion: 'Gestion dossier'
	};

	let {
		open = $bindable(false),
		initialDate = '',
		initialStart = '',
		initialEnd = '',
		membres = [],
		editing = null,
		// La catégorie « Gestion » n'est proposée qu'à l'administrateur et au
		// directeur de zone (l'agenda la masque déjà pour les autres rôles).
		canSeeGestion = true
	}: {
		open?: boolean;
		initialDate?: string;
		initialStart?: string;
		initialEnd?: string;
		membres?: MembreRow[];
		editing?: EventEdit | null;
		canSeeGestion?: boolean;
	} = $props();

	const createEvent = useMutation(api.evenements.create);
	const updateEvent = useMutation(api.evenements.update);

	const isEditing = $derived(editing !== null);

	let type = $state<EventType>('réunion');
	let titre = $state('');
	let date = $state('');
	let start = $state('09:00');
	let end = $state('10:00');
	// Sections de prospection : chaque section = nom d'équipe + secteur + membres.
	type SectionDraft = { nom: string; secteur: string; membres: string[] };
	let sections = $state<SectionDraft[]>([]);
	let busy = $state(false);
	let error = $state('');

	// Date picker shadcn : calendrier synchronisé avec le champ `date` (YYYY-MM-DD).
	let pickerDate = $state(new CalendarDate(2000, 1, 1));

	const formattedDate = $derived(
		date
			? new Date(`${date}T00:00:00`).toLocaleDateString('fr-FR', {
					day: 'numeric',
					month: 'short',
					year: 'numeric'
				})
			: 'Choisir une date'
	);

	function handlePickerChange(value: DateValue | DateValue[] | undefined) {
		const d = Array.isArray(value) ? value[0] : value;
		if (!d) return;
		pickerDate = d as CalendarDate;
		date = `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
	}

	$effect(() => {
		if (open) {
			if (editing) {
				// Mode édition : on charge les valeurs de l'événement.
				type = editing.type;
				titre = editing.titre;
				date = editing.date;
				if (editing.date) {
					const [y, m, d] = editing.date.split('-').map(Number);
					if (y && m && d) pickerDate = new CalendarDate(y, m, d);
				}
			start = editing.start || '09:00';
			end = editing.end || addHour(editing.start || '09:00');
			if (editing.sections && editing.sections.length > 0) {
				sections = editing.sections.map((s) => ({
					nom: s.nom ?? '',
					secteur: s.secteur ?? '',
					membres: (s.membres ?? []).slice()
				}));
			} else {
				// Rétro-compatibilité : un événement sans sections = une seule
				// section à partir de secteur/membres.
				sections = [
					{ nom: '', secteur: editing.secteur ?? '', membres: (editing.membres ?? []).slice() }
				];
			}
		} else {
				// Mode création : valeurs par défaut (date/heure pré-remplies).
				type = 'réunion';
				titre = DEFAULT_TITRES.réunion;
				date = initialDate;
				if (initialDate) {
					const [y, m, d] = initialDate.split('-').map(Number);
					if (y && m && d) pickerDate = new CalendarDate(y, m, d);
				}
			start = initialStart || '09:00';
			end = initialEnd || addHour(initialStart || '09:00');
			sections = [{ nom: '', secteur: '', membres: [] }];
		}
		error = '';
		}
	});

	function addHour(hhmm: string): string {
		const [h, m] = hhmm.split(':').map(Number);
		const next = new Date(2000, 0, 1, (h || 9) + 1, m || 0);
		return `${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}`;
	}

	function selectType(t: EventType) {
		if (titre.trim() === '' || titre.trim() === DEFAULT_TITRES[type]) {
			titre = DEFAULT_TITRES[t];
		}
		type = t;
	}

	function toggleSectionMembre(idx: number, id: string) {
		sections = sections.map((s, i) =>
			i === idx
				? {
						...s,
						membres: s.membres.includes(id)
							? s.membres.filter((m) => m !== id)
							: [...s.membres, id]
					}
				: s
		);
	}

	function addSection() {
		sections = [...sections, { nom: '', secteur: '', membres: [] }];
	}

	function removeSection(idx: number) {
		sections = sections.filter((_, i) => i !== idx);
	}

	function secteursValides(): SectionDraft[] {
		return sections.filter((s) => s.secteur.trim() || s.nom.trim() || s.membres.length > 0);
	}

	function uniqMembres() {
		return [...new Set(sections.flatMap((s) => s.membres))];
	}

	// Sections prêtes à envoyer : normalisées, sans entrée vide.
	function cleanedSections() {
		return secteursValides().map((s) => ({
			nom: s.nom.trim() || undefined,
			secteur: s.secteur.trim(),
			membres: s.membres as Id<'users'>[]
		}));
	}

	// --- Suggestions de ville (géocodage Mapbox, token déjà utilisé par la carte) ---
	// `label` = suggestion affichée (ville + département), `city` = valeur stockée (ville seule).
	let suggestions = $state<{ label: string; city: string }[]>([]);
	let showSuggestions = $state(false);
	let suggestTimer: ReturnType<typeof setTimeout> | undefined;
	// Index de la section pour laquelle on affiche les suggestions de secteur.
	let suggestIndex = $state(0);

	async function fetchCitySuggestions(query: string) {
		if (!env.PUBLIC_MAPBOX_TOKEN) return;
		try {
			const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
				query
			)}.json?types=place&country=fr&limit=5&access_token=${env.PUBLIC_MAPBOX_TOKEN}`;
			const res = await fetch(url);
			if (!res.ok) return;
			const data = (await res.json()) as { features?: { place_name?: string }[] };
			suggestions = (data.features ?? [])
				.map((f) => {
					const full = (f.place_name ?? '').replace(/, France$/, '');
					// On ne stocke que la ville, même si la suggestion affiche le département.
					const city = full.split(',')[0].trim();
					return { label: full, city };
				})
				.filter((s) => s.city.length > 0);
			showSuggestions = suggestions.length > 0;
		} catch {
			suggestions = [];
			showSuggestions = false;
		}
	}

	function onSecteurInput(e: Event, idx: number) {
		sections = sections.map((s, i) =>
			i === idx ? { ...s, secteur: (e.currentTarget as HTMLInputElement).value } : s
		);
		clearTimeout(suggestTimer);
		showSuggestions = false;
		const q = sections[idx]?.secteur.trim() ?? '';
		if (q.length < 2) return;
		suggestIndex = idx;
		suggestTimer = setTimeout(() => fetchCitySuggestions(q), 300);
	}

	function pickSecteur(name: string, idx = suggestIndex) {
		sections = sections.map((s, i) => (i === idx ? { ...s, secteur: name } : s));
		showSuggestions = false;
	}

	async function save() {
		if (!titre.trim()) {
			error = "Renseigne l'intitulé de l'événement.";
			return;
		}
		if (!date) {
			error = 'Choisis une date.';
			return;
		}
		if (!start || !end || end <= start) {
			error = "L'heure de fin doit être après l'heure de début.";
			return;
		}
		busy = true;
		error = '';
		try {
			if (editing) {
				await updateEvent({
					eventId: editing._id as Id<'evenements'>,
					type,
					titre: titre.trim(),
					date,
					start,
					end,
					// Secteur vide → effacé (champ retiré côté serveur). Premier
					// secteur conservé pour rétro-compat (app mobile).
					secteur: type === 'prospection' ? sections[0]?.secteur.trim() || undefined : '',
					// Membres vidés → effacés.
					membres: type === 'prospection' ? (uniqMembres() as Id<'users'>[]) : [],
					// Sections complètes (multi-secteurs + équipes).
					sections: type === 'prospection' ? cleanedSections() : undefined
				});
			} else {
				await createEvent({
					type,
					titre: titre.trim(),
					date,
					start,
					end,
					secteur: type === 'prospection' ? sections[0]?.secteur.trim() || undefined : undefined,
					membres:
						type === 'prospection' && uniqMembres().length > 0
							? (uniqMembres() as Id<'users'>[])
							: undefined,
					sections: type === 'prospection' ? cleanedSections() : undefined
				});
			}
			open = false;
		} catch (e) {
			error = e instanceof Error ? e.message : "Erreur lors de l'enregistrement de l'événement.";
		} finally {
			busy = false;
		}
	}
</script>

<Dialog bind:open>
	<DialogContent
		class="max-h-[88svh] overflow-y-auto rounded-xl border-line bg-card sm:max-w-md"
	>

		<DialogHeader>
			<DialogTitle>{isEditing ? "Modifier l'événement" : 'Nouvel événement'}</DialogTitle>
			<DialogDescription>
				{isEditing
					? "Modifie les informations de l'événement de l'agenda partagé."
					: "Ajoute un événement à l'agenda partagé de l'agence."}
			</DialogDescription>
		</DialogHeader>

		<div class="space-y-4">
			<div class="space-y-1.5">
				<Label>Type d'événement</Label>
				<div class="grid grid-cols-2 gap-1.5">
					{#each TYPES.filter((t) => canSeeGestion || t.value !== 'gestion') as t}
						<button
							type="button"
							onclick={() => selectType(t.value)}
							class={[
								'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[12px] font-medium transition-colors',
								type === t.value
									? t.cls
									: 'border-line bg-base text-muted-foreground hover:text-foreground'
							].join(' ')}
						>
							<span class="text-[13px] leading-none">{t.emoji}</span>
							{t.label}
						</button>
					{/each}
				</div>
			</div>

			<div class="space-y-1.5">
				<Label for="event-titre">Intitulé</Label>
				<Input
					id="event-titre"
					bind:value={titre}
					placeholder="Intitulé de l'événement"
					class="border-line bg-base"
				/>
			</div>
			<div class="grid grid-cols-2 gap-2">
				<div class="space-y-1.5">
					<Label>Date</Label>
					<Popover>
						<PopoverTrigger
							class="flex h-9 w-full items-center gap-2 rounded-md border border-line bg-base px-3 text-[12.5px] font-medium text-foreground transition-colors hover:bg-card2"
						>
							<CalendarDays class="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.7} />
							{formattedDate}
						</PopoverTrigger>
						<PopoverContent class="w-auto rounded-xl border-line bg-card p-0" align="start">
							<Calendar
								locale="fr-FR"
								type="single"
								value={pickerDate}
								onValueChange={(value: DateValue | undefined) => handlePickerChange(value)}
							/>
						</PopoverContent>
					</Popover>
				</div>
				<div class="grid grid-cols-2 gap-2">
					<div class="space-y-1.5">
						<Label for="event-start">Début</Label>
						<Input
							id="event-start"
							type="time"
							bind:value={start}
							class="h-9 border-line bg-base text-[12px]"
						/>
					</div>
					<div class="space-y-1.5">
						<Label for="event-end">Fin</Label>
						<Input
							id="event-end"
							type="time"
							bind:value={end}
							class="h-9 border-line bg-base text-[12px]"
						/>
					</div>
				</div>
			</div>

			{#if type === 'prospection'}
				<div class="space-y-1.5">
					<div class="flex items-center justify-between gap-2">
						<Label>Sections (secteur + équipe)</Label>
						<Button
							type="button"
							variant="outline"
							onclick={addSection}
							class="h-7 px-2 text-[11.5px]"
						>
							＋ Ajouter une section
						</Button>
					</div>

					{#each sections as section, si}
						<div class="space-y-2 rounded-lg border border-line bg-base p-2.5">
							<div class="flex items-center justify-between gap-2">
								<span
									class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
								>
									Section {si + 1}
								</span>
								{#if sections.length > 1}
									<button
										type="button"
										class="text-[11px] font-medium text-destructive hover:underline"
										onclick={() => removeSection(si)}
									>
										Retirer
									</button>
								{/if}
							</div>

							<div class="space-y-1.5">
								<Label class="text-[11.5px]">Nom de l'équipe</Label>
								<Input
									placeholder="Équipe A, Équipe 2…"
									class="h-8 border-line bg-base text-[12.5px]"
									oninput={(e) =>
										(sections[si].nom = (e.currentTarget as HTMLInputElement).value)}
								/>
							</div>

							<div class="space-y-1.5">
								<Label class="text-[11.5px]">Secteur (zone de prospection)</Label>
								<div class="relative">
									<Input
										value={sections[si].secteur}
										placeholder="Ex. : Tours Nord, Châtellerault…"
										class="border-line bg-base"
										oninput={(e) => onSecteurInput(e, si)}
										onblur={() => setTimeout(() => (showSuggestions = false), 150)}
									/>
									{#if showSuggestions && suggestIndex === si && suggestions.length > 0}
										<div
											class="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-line bg-card shadow-lg"
										>
											{#each suggestions as s}
												<button
													type="button"
													class="w-full px-3 py-2 text-left text-[12.5px] text-foreground transition-colors hover:bg-glass-2"
													onpointerdown={(e) => {
														e.preventDefault();
														pickSecteur(s.city, si);
													}}
												>
													{s.label}
												</button>
											{/each}
										</div>
									{/if}
								</div>
							</div>

							<div class="space-y-1.5">
								<Label class="text-[11.5px]">Membres de l'équipe</Label>
								{#if membres.length === 0}
									<p class="text-[12px] text-muted-foreground">Aucun membre disponible.</p>
								{:else}
									<div
										class="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-line bg-base p-2"
									>
										{#each membres as membre}
											<label
												class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] transition-colors hover:bg-glass-2"
											>
												<input
													type="checkbox"
													checked={sections[si].membres.includes(membre._id)}
													onchange={() => toggleSectionMembre(si, membre._id)}
													class="size-3.5 accent-violet-500"
												/>
												<span class="text-foreground">
													{membre.firstName}
													{membre.lastName}
												</span>
											</label>
										{/each}
									</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}


			{#if error}
				<p class="text-[12px] font-medium text-destructive">{error}</p>
			{/if}
		</div>

		<DialogFooter class="gap-2">
			<Button variant="outline" onclick={() => (open = false)} disabled={busy}>
				<X class="size-4" />
				Annuler
			</Button>
			<Button onclick={save} disabled={busy} class="bg-white text-black hover:bg-white/90">
				{#if busy}
					<LoaderCircle class="size-4 animate-spin" />
				{/if}
				{isEditing ? 'Enregistrer' : 'Ajouter'}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
