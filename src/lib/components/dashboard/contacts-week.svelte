<script lang="ts">
	import { PhoneCall } from '@lucide/svelte';
	import { useQuery } from 'convex-svelte';
	import { api } from '../../../convex/_generated/api.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import { formatPhone } from '$lib/data/phone';
	import { authState } from '$lib/auth-state.svelte';
	import ContactDialog, { type ContactRow } from '$lib/components/ContactDialog.svelte';

	const contacts = useQuery(api.contacts.list, () => (authState.isAuthenticated ? {} : 'skip'));

	// Contacts dont la date de rappel est dépassée ou est aujourd'hui,
	// non traités et sans RDV en cours.
	const todayISO = $derived.by(() => {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
			d.getDate()
		).padStart(2, '0')}`;
	});

	const dueContacts = $derived(
		(contacts.data ?? [])
			.filter(
				(c) =>
					c.followUp?.type === 'rappel' &&
					c.statut !== 'traité' &&
					(c.followUp?.date ?? '') <= todayISO
			)
			.sort((a, b) => (a.followUp?.date ?? '').localeCompare(b.followUp?.date ?? ''))
	);

	let selected = $state<ContactRow | null>(null);
	let dialogOpen = $state(false);

	function openFiche(contact: ContactRow) {
		selected = contact;
		dialogOpen = true;
	}
</script>

<Card class="flex h-full flex-col gap-0 rounded-2xl border-line py-0 shadow-none">
	<CardHeader class="flex items-center justify-between gap-3 px-5 pt-5 pb-0">
		<CardTitle class="flex items-center gap-2.5 text-[14px] font-semibold">
			<span
				class="grid size-8 place-items-center rounded-lg border border-line bg-card2 text-muted-foreground"
			>
				<PhoneCall class="size-4" strokeWidth={1.7} />
			</span>
			Contacts à rappeler
			<Badge variant="secondary" class="rounded-full px-2">
				{dueContacts.length} contacts
			</Badge>
		</CardTitle>
	</CardHeader>
	<CardContent class="flex min-h-0 flex-1 flex-col px-5 pt-2 pb-5">
		{#if dueContacts.length === 0}
			<div class="flex flex-1 items-center justify-center py-10">
				<p class="text-[12.5px] text-muted-foreground">Aucun contact à rappeler aujourd'hui.</p>
			</div>
		{:else}
			<ul class="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
				{#each dueContacts as contact}
					<button
						type="button"
						onclick={() => openFiche(contact)}
						class="flex w-full items-center gap-3 rounded-xl bg-amber-500/10 px-3.5 py-2.5 text-left transition-colors hover:bg-amber-500/15"
					>
						<span
							class="grid size-8 shrink-0 place-items-center rounded-full bg-amber-500/25 text-[10px] font-bold text-amber-400"
						>
							{contact.name
								.split(' ')
								.map((part) => part[0])
								.join('')}
						</span>
						<div class="min-w-0 flex-1 leading-tight">
							<p class="truncate text-[13px] font-semibold text-foreground">
								{contact.name}
							</p>
							<p class="truncate font-mono text-[11.5px] text-muted-foreground">
								{formatPhone(contact.phone) || '—'}
							</p>
							<p class="truncate text-[11.5px] text-muted-foreground">
								{contact.projet || '—'}
							</p>
						</div>
					</button>
				{/each}
			</ul>
		{/if}
	</CardContent>

	<ContactDialog bind:contact={selected} bind:open={dialogOpen} />
</Card>
