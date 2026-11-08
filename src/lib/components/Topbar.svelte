<script lang="ts">
	import { Menu, Moon, Sun } from '@lucide/svelte';
	import StatPeriodPicker from './StatPeriodPicker.svelte';
	import GlobalSearch from './GlobalSearch.svelte';
	import { getTheme, setTheme, type Theme } from '$lib/theme';

	let { showPeriod = false, onMenu }: { showPeriod?: boolean; onMenu?: () => void } = $props();

	let theme = $state<Theme>(getTheme());

	function toggleTheme() {
		theme = theme === 'dark' ? 'light' : 'dark';
		setTheme(theme);
	}
</script>

<!-- Barre supérieure de la zone graphite : recherche à gauche, réglages de page à
     droite. La présentation (accueil, heure, météo) vit désormais dans le tableau
     de bord, sur le fond clair. -->
<header class="flex shrink-0 items-center gap-2 px-1 pt-1 pb-1.5 sm:gap-3 sm:px-2">
	<button
		type="button"
		class="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/15 hover:text-white lg:hidden"
		onclick={() => onMenu?.()}
		aria-label="Ouvrir le menu"
	>
		<Menu class="size-4" strokeWidth={1.7} />
	</button>

	<!-- Recherche globale, alignée à gauche de la zone noire. -->
	<div class="max-w-md min-w-0 flex-1 sm:max-w-lg">
		<GlobalSearch variant="dark" />
	</div>

	<div class="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
		{#if showPeriod}
			<div class="hidden xl:block">
				<StatPeriodPicker />
			</div>
		{/if}
		<button
			type="button"
			class="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
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
