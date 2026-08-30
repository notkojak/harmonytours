<script lang="ts">
	import { goto } from '$app/navigation';
	import { Building2, LoaderCircle, Pencil, ShieldOff, UserPlus } from '@lucide/svelte';
	import { useAction, useMutation, useQuery } from 'convex-svelte';
	import { api } from '../../convex/_generated/api.js';
	import type { Id } from '../../convex/_generated/dataModel.js';
	import { authState } from '$lib/auth-state.svelte';
	import { canAccessAdministration, capitalizeRole, roles } from '$lib/data/roles';
	import Avatar from '$lib/components/Avatar.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import {
		Dialog,
		DialogContent,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger
	} from '$lib/components/ui/select/index.js';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table/index.js';
	import { Tabs, TabsList, TabsTrigger } from '$lib/components/ui/tabs/index.js';

	type EmployeRow = {
		_id: string;
		firstName: string | null;
		lastName: string | null;
		email: string | null;
		role: string | null;
		agencyId: string | null;
		agencyName: string | null;
		dateEntree: number | null;
		birthDate: string | null;
		photo: string | null;
		statut: string;
		firedAt: number | null;
		roleHistory: { role: string; at: number }[];
	};

	const profile = useQuery(api.users.getProfile, () => (authState.isAuthenticated ? {} : 'skip'));

	const isAuthorized = $derived(canAccessAdministration(profile.data?.role));

	$effect(() => {
		if (profile.data && !isAuthorized) {
			goto('/');
		}
	});

	const agences = useQuery(api.agences.list, () => (isAuthorized ? {} : 'skip'));
	const employes = useQuery(api.employes.list, () => (isAuthorized ? {} : 'skip'));

	const createAgency = useMutation(api.agences.create);
	const createEmploye = useAction(api.employes.create);
	const updateEmploye = useMutation(api.employes.update);
	const fireEmploye = useAction(api.employes.fire);
	const generateUploadUrl = useMutation(api.users.generatePhotoUploadUrl);
	const setPhoto = useMutation(api.users.setPhoto);
	const removePhoto = useMutation(api.users.removePhoto);

	function errorMessage(e: unknown, fallback: string): string {
		return e instanceof Error && e.message ? e.message : fallback;
	}

	function formatDate(value: number | null | undefined): string {
		if (!value) return '—';
		return new Date(value).toLocaleDateString('fr-FR');
	}

	// --- Création d'agence (admin uniquement) ---
	let agencyName = $state('');
	let agencyZone = $state('');
	let agencyBusy = $state(false);
	let agencyError = $state('');

	async function handleCreateAgency() {
		agencyBusy = true;
		agencyError = '';
		try {
			await createAgency({
				name: agencyName.trim(),
				zone: agencyZone.trim() || undefined
			});
			agencyName = '';
			agencyZone = '';
		} catch (e) {
			agencyError = errorMessage(e, 'Création impossible.');
		} finally {
			agencyBusy = false;
		}
	}

	// --- Création d'un employé ---
	let empFirstName = $state('');
	let empLastName = $state('');
	let empEmail = $state('');
	let empBirthDate = $state('');
	let empDateEntree = $state('');
	let empRole = $state('');
	let empAgencyId = $state('');
	let empPassword = $state('');
	let empBusy = $state(false);
	let empError = $state('');

	async function handleCreateEmploye() {
		if (!empAgencyId) {
			empError = 'Choisis une agence.';
			return;
		}
		if (!empRole) {
			empError = 'Choisis un rôle.';
			return;
		}
		if (!empDateEntree) {
			empError = "Renseigne la date d'entrée.";
			return;
		}
		if (empPassword.length < 8) {
			empError = 'Le mot de passe doit contenir au moins 8 caractères.';
			return;
		}

		empBusy = true;
		empError = '';
		try {
			await createEmploye({
				firstName: empFirstName.trim(),
				lastName: empLastName.trim(),
				email: empEmail.trim(),
				birthDate: empBirthDate || undefined,
				dateEntree: new Date(`${empDateEntree}T00:00:00`).getTime(),
				role: empRole,
				agencyId: empAgencyId as Id<'agences'>,
				password: empPassword
			});
			empFirstName = '';
			empLastName = '';
			empEmail = '';
			empBirthDate = '';
			empDateEntree = '';
			empRole = '';
			empAgencyId = '';
			empPassword = '';
		} catch (e) {
			empError = errorMessage(e, 'Création impossible.');
		} finally {
			empBusy = false;
		}
	}

	// --- Onglets actifs / virés ---
	let employesTab = $state<'actifs' | 'vires'>('actifs');
	const actifs = $derived((employes.data ?? []).filter((e) => e.statut !== 'viré'));
	const vires = $derived((employes.data ?? []).filter((e) => e.statut === 'viré'));
	const rows = $derived(employesTab === 'actifs' ? actifs : vires);

	// --- Modification d'un employé ---
	let editing = $state<EmployeRow | null>(null);
	let editFirstName = $state('');
	let editLastName = $state('');
	let editBirthDate = $state('');
	let editDateEntree = $state('');
	let editRole = $state('');
	let editAgencyId = $state('');
	let editPhoto = $state('');
	let photoUploading = $state(false);
	let photoError = $state('');
	let editBusy = $state(false);
	let editError = $state('');

	function openEdit(employe: EmployeRow) {
		editing = employe;
		editFirstName = employe.firstName ?? '';
		editLastName = employe.lastName ?? '';
		editBirthDate = employe.birthDate ?? '';
		editDateEntree = employe.dateEntree
			? new Date(employe.dateEntree).toISOString().slice(0, 10)
			: '';
		editRole = employe.role ?? '';
		editAgencyId = employe.agencyId ?? '';
		editPhoto = employe.photo ?? '';
		photoError = '';
		editError = '';
	}

	let photoInput = $state<HTMLInputElement | null>(null);

	async function handlePhotoUpload(event: Event) {
		if (!editing) return;
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		if (!file.type.startsWith('image/')) {
			photoError = 'Veuillez choisir une image.';
			return;
		}
		if (file.size > 5 * 1024 * 1024) {
			photoError = 'Image trop lourde (max 5 Mo).';
			return;
		}
		photoUploading = true;
		photoError = '';
		try {
			const uploadUrl = await generateUploadUrl({});
			const res = await fetch(uploadUrl, {
				method: 'POST',
				headers: { 'Content-Type': file.type },
				body: file
			});
			if (!res.ok) throw new Error('Upload échoué.');
			const { storageId } = (await res.json()) as { storageId: string };
			const url = await setPhoto({ userId: editing._id as Id<'users'>, storageId });
			editPhoto = url;
			editing = { ...editing, photo: url };
		} catch (e) {
			photoError = errorMessage(e, 'Impossible de mettre à jour la photo.');
		} finally {
			photoUploading = false;
			if (input) input.value = '';
		}
	}

	async function handleRemovePhoto() {
		if (!editing) return;
		photoUploading = true;
		photoError = '';
		try {
			await removePhoto({ userId: editing._id as Id<'users'> });
			editPhoto = '';
			editing = { ...editing, photo: null };
		} catch (e) {
			photoError = errorMessage(e, 'Impossible de retirer la photo.');
		} finally {
			photoUploading = false;
		}
	}

	async function handleSaveEdit() {
		if (!editing) return;
		editBusy = true;
		editError = '';
		try {
			await updateEmploye({
				employeId: editing._id as Id<'users'>,
				firstName: editFirstName.trim(),
				lastName: editLastName.trim(),
				birthDate: editBirthDate || undefined,
				dateEntree: editDateEntree ? new Date(`${editDateEntree}T00:00:00`).getTime() : undefined,
				agencyId: editAgencyId ? (editAgencyId as Id<'agences'>) : undefined,
				role: editRole || undefined
			});
			editing = null;
		} catch (e) {
			editError = errorMessage(e, 'Enregistrement impossible.');
		} finally {
			editBusy = false;
		}
	}

	// --- Actions sur un employé ---
	let busyRow = $state('');
	let rowError = $state('');

	async function handleFire(employeId: string, name: string) {
		if (busyRow) return;
		if (!confirm(`Virer ${name} ? Son accès sera immédiatement bloqué.`)) return;
		busyRow = employeId;
		rowError = '';
		try {
			await fireEmploye({ employeId: employeId as Id<'users'> });
		} catch (e) {
			rowError = errorMessage(e, 'Licenciement impossible.');
		} finally {
			busyRow = '';
		}
	}
</script>

{#if isAuthorized}
	<div class="mx-auto max-w-7xl space-y-5">
		<!-- Créer une agence -->
		{#if ['administrateur', 'directeur de zone'].includes(profile.data?.role ?? '')}
			<Card class="gap-0 rounded-2xl border-line py-0 shadow-none">
				<CardHeader class="flex items-center gap-2.5 px-5 pt-5 pb-0">
					<CardTitle class="flex items-center gap-2.5 text-[14px] font-semibold">
						<span
							class="grid size-8 place-items-center rounded-lg border border-line bg-card2 text-muted-foreground"
						>
							<Building2 class="size-4" strokeWidth={1.7} />
						</span>
						Créer une agence
					</CardTitle>
				</CardHeader>
				<CardContent class="px-5 pt-2 pb-5">
					<form onsubmit={handleCreateAgency} class="flex flex-wrap items-end gap-3">
						<div class="min-w-56 flex-1 space-y-1.5">
							<Label for="agencyName">Ville</Label>
							<Input
								id="agencyName"
								required
								placeholder="Tours"
								bind:value={agencyName}
								class="border-line bg-base"
							/>
						</div>
						<div class="min-w-40 space-y-1.5">
							<Label for="agencyZone">Zone</Label>
							<Select type="single" bind:value={agencyZone}>
								<SelectTrigger id="agencyZone" class="w-full border-line bg-base">
									<span data-slot="select-value">
										{agencyZone ? agencyZone : 'Choisir une zone'}
									</span>
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="Nord">Nord</SelectItem>
									<SelectItem value="Sud">Sud</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<Button type="submit" disabled={agencyBusy}>
							{#if agencyBusy}
								<LoaderCircle class="size-4 animate-spin" />
							{/if}
							Créer l'agence
						</Button>
					</form>
					{#if agencyError}
						<p class="mt-3 text-[12px] text-destructive">{agencyError}</p>
					{/if}
				</CardContent>
			</Card>
		{/if}

		<!-- Créer un employé -->
		<Card class="gap-0 rounded-2xl border-line py-0 shadow-none">
			<CardHeader class="flex items-center gap-2.5 px-5 pt-5 pb-0">
				<CardTitle class="flex items-center gap-2.5 text-[14px] font-semibold">
					<span
						class="grid size-8 place-items-center rounded-lg border border-line bg-card2 text-muted-foreground"
					>
						<UserPlus class="size-4" strokeWidth={1.7} />
					</span>
					Créer un employé
				</CardTitle>
			</CardHeader>
			<CardContent class="px-5 pt-2 pb-5">
				{#if (agences.data?.length ?? 0) === 0}
					<p class="text-[13px] text-muted-foreground">
						{['administrateur', 'directeur de zone'].includes(profile.data?.role ?? '')
							? 'Crée d’abord une agence pour pouvoir ajouter un employé.'
							: 'Aucune agence n’est disponible pour le moment.'}
					</p>
				{:else}
					<form onsubmit={handleCreateEmploye} class="space-y-4">
						<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
							<div class="space-y-1.5">
								<Label for="empFirstName">Prénom</Label>
								<Input
									id="empFirstName"
									required
									placeholder="Marie"
									bind:value={empFirstName}
									class="border-line bg-base"
								/>
							</div>
							<div class="space-y-1.5">
								<Label for="empLastName">Nom</Label>
								<Input
									id="empLastName"
									required
									placeholder="Dupont"
									bind:value={empLastName}
									class="border-line bg-base"
								/>
							</div>
							<div class="space-y-1.5">
								<Label for="empEmail">Adresse e-mail</Label>
								<Input
									id="empEmail"
									type="email"
									required
									placeholder="marie.dupont@exemple.fr"
									bind:value={empEmail}
									class="border-line bg-base"
								/>
							</div>
							<div class="space-y-1.5">
								<Label for="empBirthDate">Date de naissance</Label>
								<Input
									id="empBirthDate"
									type="date"
									bind:value={empBirthDate}
									class="border-line bg-base"
								/>
							</div>
							<div class="space-y-1.5">
								<Label for="empDateEntree">Date d'entrée</Label>
								<Input
									id="empDateEntree"
									type="date"
									required
									bind:value={empDateEntree}
									class="border-line bg-base"
								/>
							</div>
							<div class="space-y-1.5">
								<Label for="empRole">Rôle</Label>
								<Select type="single" bind:value={empRole}>
									<SelectTrigger id="empRole" class="w-full border-line bg-base">
										<span data-slot="select-value">
											{empRole ? capitalizeRole(empRole) : 'Choisir un rôle'}
										</span>
									</SelectTrigger>
									<SelectContent>
										{#each roles as role}
											<SelectItem value={role}>{capitalizeRole(role)}</SelectItem>
										{/each}
									</SelectContent>
								</Select>
							</div>
							<div class="space-y-1.5">
								<Label for="empAgency">Agence</Label>
								<Select type="single" bind:value={empAgencyId}>
									<SelectTrigger id="empAgency" class="w-full border-line bg-base">
										<span data-slot="select-value">
											{agences.data?.find((a) => a._id === empAgencyId)?.name ??
												'Choisir une agence'}
										</span>
									</SelectTrigger>
									<SelectContent>
										{#each agences.data ?? [] as agence}
											<SelectItem value={agence._id}>{agence.name}</SelectItem>
										{/each}
									</SelectContent>
								</Select>
							</div>
							<div class="space-y-1.5">
								<Label for="empPassword">Mot de passe initial</Label>
								<Input
									id="empPassword"
									type="password"
									required
									minlength={8}
									placeholder="8 caractères minimum"
									bind:value={empPassword}
									class="border-line bg-base"
								/>
							</div>
						</div>

						<div class="flex flex-wrap items-center gap-3">
							<Button type="submit" disabled={empBusy}>
								{#if empBusy}
									<LoaderCircle class="size-4 animate-spin" />
								{/if}
								Créer l'employé
							</Button>
							{#if empError}
								<p class="text-[12px] text-destructive">{empError}</p>
							{/if}
						</div>
					</form>
				{/if}
			</CardContent>
		</Card>

		<!-- Employés -->
		<Card class="gap-0 rounded-2xl border-line py-0 shadow-none">
			<CardHeader class="flex items-center justify-between gap-3 px-5 pt-5 pb-0">
				<CardTitle class="flex items-center gap-2.5 text-[14px] font-semibold">
					<span
						class="grid size-8 place-items-center rounded-lg border border-line bg-card2 text-muted-foreground"
					>
						<Building2 class="size-4" strokeWidth={1.7} />
					</span>
					Employés
				</CardTitle>
				<Badge variant="secondary" class="rounded-full px-2">
					{rows.length}
				</Badge>
			</CardHeader>
			<CardContent class="px-5 pt-2 pb-5">
				{#if rowError}
					<p class="mb-3 text-[12px] text-destructive">{rowError}</p>
				{/if}

				<Tabs
					value={employesTab}
					onValueChange={(value) => (employesTab = value as 'actifs' | 'vires')}
					class="mb-4 w-fit"
				>
					<TabsList>
						<TabsTrigger value="actifs">Actifs ({actifs.length})</TabsTrigger>
						<TabsTrigger value="vires">Virés ({vires.length})</TabsTrigger>
					</TabsList>
				</Tabs>

				<div class="overflow-x-auto rounded-xl border border-line">
					<Table class="min-w-[780px]">
						<TableHeader>
							<TableRow class="border-line bg-transparent hover:bg-transparent">
								<TableHead
									class="px-4 py-3 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase"
								>
									Employé
								</TableHead>
								<TableHead
									class="px-4 py-3 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase"
								>
									Rôle
								</TableHead>
								<TableHead
									class="px-4 py-3 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase"
								>
									Agence
								</TableHead>
								<TableHead
									class="px-4 py-3 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase"
								>
									Entrée
								</TableHead>
								<TableHead
									class="px-4 py-3 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase"
								>
									Statut
								</TableHead>
								<TableHead
									class="px-4 py-3 text-right text-[10px] font-semibold tracking-wider text-muted-foreground uppercase"
								>
									Modifier
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{#each rows as employe}
								<TableRow
									class="cursor-pointer border-line/60 transition-colors hover:bg-glass-1"
									onclick={() => openEdit(employe)}
								>
									<TableCell class="px-4 py-3">
										<div class="flex items-center gap-2.5">
											<Avatar
												photo={employe.photo}
												label={`${employe.firstName?.[0] ?? ''}${employe.lastName?.[0] ?? ''}`}
												class="size-9 rounded-full bg-black/45 text-[11px] font-bold text-white ring-1 ring-white/25"
											/>
											<div class="min-w-0">
												<p class="text-[13px] font-medium whitespace-nowrap text-foreground">
													{employe.firstName}
													{employe.lastName}
												</p>
												<p class="text-[11.5px] whitespace-nowrap text-muted-foreground">
													{employe.email}
												</p>
											</div>
										</div>
									</TableCell>
									<TableCell class="px-4 py-3 text-[12.5px] text-foreground">
										{capitalizeRole(employe.role)}
									</TableCell>
									<TableCell class="px-4 py-3 text-[12.5px] text-muted-foreground">
										{employe.agencyName ?? '—'}
									</TableCell>
									<TableCell class="px-4 py-3 text-[12.5px] text-muted-foreground">
										{formatDate(employe.dateEntree)}
									</TableCell>
									<TableCell class="px-4 py-3">
										{#if employe.statut === 'viré'}
											<Badge
												variant="outline"
												class="gap-1.5 rounded-full border-destructive/40 bg-destructive/10 px-2.5 py-0.5 text-[11px] font-medium text-destructive"
											>
												<ShieldOff class="size-3" />
												Viré
											</Badge>
										{:else}
											<Badge
												class="rounded-full bg-glass-3 px-2.5 py-0.5 text-[11px] font-medium text-foreground"
											>
												Actif
											</Badge>
										{/if}
									</TableCell>
									<TableCell class="px-4 py-3">
										<div class="flex justify-end text-muted-foreground">
											<Pencil class="size-3.5" strokeWidth={1.7} />
										</div>
									</TableCell>
								</TableRow>
							{/each}
							{#if rows.length === 0}
								<TableRow class="border-line/60 hover:bg-transparent">
									<TableCell
										colspan={6}
										class="px-4 py-8 text-center text-[13px] text-muted-foreground"
									>
										Aucun employé dans cet onglet.
									</TableCell>
								</TableRow>
							{/if}
						</TableBody>
					</Table>
				</div>
			</CardContent>
		</Card>

		<!-- Modification d'un employé -->
		<Dialog
			open={editing !== null}
			onOpenChange={(open) => {
				if (!open) editing = null;
			}}
		>
			<DialogContent
				class="max-h-[90vh] overflow-y-auto rounded-2xl border-line bg-card sm:max-w-lg"
			>
				<DialogHeader>
					<DialogTitle class="text-[15px] font-semibold">
						Modifier {editing?.firstName}
						{editing?.lastName}
					</DialogTitle>
				</DialogHeader>

				{#if editing}
					<div class="space-y-4">
						<div class="flex items-center gap-3 rounded-xl border border-line bg-base p-3">
							<Avatar
								photo={editPhoto || null}
								label={`${editFirstName?.[0] ?? ''}${editLastName?.[0] ?? ''}`}
								class="size-14 rounded-full bg-black/45 text-lg font-bold text-white ring-1 ring-white/25"
							/>
							<div class="min-w-0 flex-1 space-y-1.5">
								<p class="text-[12px] font-medium text-foreground">Photo de l'employé</p>
								<div class="flex flex-wrap items-center gap-2">
									<input
										bind:this={photoInput}
										type="file"
										accept="image/*"
										class="hidden"
										onchange={handlePhotoUpload}
									/>
									<Button
										type="button"
										variant="outline"
										size="sm"
										disabled={photoUploading}
										onclick={() => photoInput?.click()}
										class="gap-1.5"
									>
										{#if photoUploading}
											<LoaderCircle class="size-3.5 animate-spin" />
											Chargement…
										{:else}
											{editPhoto ? 'Changer la photo' : 'Ajouter une photo'}
										{/if}
									</Button>
									{#if editPhoto}
										<Button
											type="button"
											variant="ghost"
											size="sm"
											disabled={photoUploading}
											onclick={handleRemovePhoto}
											class="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
										>
											Retirer
										</Button>
									{/if}
								</div>
								{#if photoError}
									<p class="text-[11px] text-destructive">{photoError}</p>
								{/if}
							</div>
						</div>

						<div class="grid grid-cols-2 gap-3">
							<div class="space-y-1.5">
								<Label for="editFirstName">Prénom</Label>
								<Input id="editFirstName" bind:value={editFirstName} class="border-line bg-base" />
							</div>
							<div class="space-y-1.5">
								<Label for="editLastName">Nom</Label>
								<Input id="editLastName" bind:value={editLastName} class="border-line bg-base" />
							</div>
						</div>

						<div class="grid grid-cols-2 gap-3">
							<div class="space-y-1.5">
								<Label for="editBirthDate">Date de naissance</Label>
								<Input
									id="editBirthDate"
									type="date"
									bind:value={editBirthDate}
									class="border-line bg-base"
								/>
							</div>
							<div class="space-y-1.5">
								<Label for="editDateEntree">Date d'entrée</Label>
								<Input
									id="editDateEntree"
									type="date"
									bind:value={editDateEntree}
									class="border-line bg-base"
								/>
							</div>
						</div>

						<div class="grid grid-cols-2 gap-3">
							<div class="space-y-1.5">
								<Label for="editRole">Rôle</Label>
								<Select type="single" bind:value={editRole}>
									<SelectTrigger id="editRole" class="w-full border-line bg-base">
										<span data-slot="select-value">
											{editRole ? capitalizeRole(editRole) : 'Choisir un rôle'}
										</span>
									</SelectTrigger>
									<SelectContent>
										{#each roles as role}
											<SelectItem value={role}>{capitalizeRole(role)}</SelectItem>
										{/each}
									</SelectContent>
								</Select>
							</div>
							<div class="space-y-1.5">
								<Label for="editAgency">Agence</Label>
								<Select type="single" bind:value={editAgencyId}>
									<SelectTrigger id="editAgency" class="w-full border-line bg-base">
										<span data-slot="select-value">
											{agences.data?.find((a) => a._id === editAgencyId)?.name ??
												'Choisir une agence'}
										</span>
									</SelectTrigger>
									<SelectContent>
										{#each agences.data ?? [] as agence}
											<SelectItem value={agence._id}>{agence.name}</SelectItem>
										{/each}
									</SelectContent>
								</Select>
							</div>
						</div>

						{#if editError}
							<p class="text-[12px] text-destructive">{editError}</p>
						{/if}

						<div class="rounded-xl border border-line bg-base p-3">
							<p
								class="mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
							>
								Historique des postes
							</p>
							<div class="space-y-1">
								{#each (editing.roleHistory ?? []).slice().reverse() as entry}
									<div class="flex items-center justify-between rounded-lg bg-card2 px-2.5 py-1.5">
										<span class="text-[12.5px] font-medium text-foreground">
											{capitalizeRole(entry.role)}
										</span>
										<span class="text-[11px] text-muted-foreground">
											{formatDate(entry.at)}
										</span>
									</div>
								{/each}
								{#if (editing.roleHistory?.length ?? 0) === 0}
									<p class="text-[12px] text-muted-foreground">Aucun historique.</p>
								{/if}
							</div>
						</div>
					</div>
				{/if}

				<DialogFooter class="gap-2">
					{#if editing?.statut !== 'viré'}
						<Button
							variant="ghost"
							disabled={editBusy}
							onclick={() => {
								if (editing) {
									handleFire(editing._id, `${editing.firstName} ${editing.lastName}`);
									editing = null;
								}
							}}
							class="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
						>
							<ShieldOff class="size-3.5" />
							Virer
						</Button>
					{/if}
					<div class="flex-1"></div>
					<Button variant="ghost" onclick={() => (editing = null)} disabled={editBusy}>
						Annuler
					</Button>
					<Button type="button" onclick={handleSaveEdit} disabled={editBusy || !editing}>
						{#if editBusy}
							<LoaderCircle class="size-4 animate-spin" />
						{/if}
						Enregistrer
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	</div>
{/if}
