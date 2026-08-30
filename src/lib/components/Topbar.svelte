<script lang="ts">
	import { LayoutDashboard, Menu, Moon, Sun } from '@lucide/svelte';
	import StatPeriodPicker from './StatPeriodPicker.svelte';
	import { getTheme, setTheme, type Theme } from '$lib/theme';

	let {
		title = 'Tableau de bord',
		subtitle = '',
		showPeriod = true,
		onMenu
	}: { title?: string; subtitle?: string; showPeriod?: boolean; onMenu?: () => void } = $props();

	let theme = $state<Theme>(getTheme());

	function toggleTheme() {
		theme = theme === 'dark' ? 'light' : 'dark';
		setTheme(theme);
	}

	function capitalize(value: string) {
		return value.charAt(0).toUpperCase() + value.slice(1);
	}

	const dateDuJour = capitalize(
		new Date().toLocaleDateString('fr-FR', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		})
	);
</script>

<header
	class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line bg-surface/80 px-4 py-2.5 backdrop-blur sm:px-5"
>
	<div class="flex min-w-0 items-center gap-2.5">
		<button
			type="button"
			class="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-card text-muted-foreground transition-colors hover:text-foreground lg:hidden"
			onclick={() => onMenu?.()}
			aria-label="Ouvrir le menu"
		>
			<Menu class="size-4" strokeWidth={1.7} />
		</button>
		<span
			class="grid size-7 shrink-0 place-items-center rounded-lg border border-line bg-card text-muted-foreground"
		>
			<LayoutDashboard class="size-3.5" strokeWidth={1.7} />
		</span>
		<h1 class="truncate text-[14px] font-semibold text-foreground">{title}</h1>
		{#if subtitle}
			<p class="truncate text-[12px] text-muted-foreground">{subtitle}</p>
		{/if}
	</div>

	<div class="flex items-center gap-2 sm:gap-3">
		<span class="hidden text-[12px] font-medium text-muted-foreground md:block">
			{dateDuJour}
		</span>
		{#if showPeriod}
			<StatPeriodPicker />
		{/if}
		<button
			type="button"
			class="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-card text-muted-foreground transition-colors hover:text-foreground"
			onclick={toggleTheme}
			aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
			title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
		>
			{#if theme === 'dark'}
				<Sun class="size-4" strokeWidth={1.7} />
			{:else}
				<Moon class="size-4" strokeWidth={1.7} />
			{/if}
		</button>
	</div>
</header>
