<script lang="ts">
	// Bulle avatar réutilisable : affiche la photo de l'employé si elle existe,
	// sinon l'initiale (lettre du prénom ou initiales) en secours.
	// La classe passée contrôle la taille et l'arrondi (ex. « size-6 rounded-full »).
	let {
		photo = null,
		label = '',
		alt = '',
		title = '',
		class: className = ''
	}: {
		photo?: string | null;
		label?: string;
		alt?: string;
		title?: string;
		class?: string;
	} = $props();
</script>

{#if photo}
	<span
		class="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full {className}"
	>
		<img
			src={photo}
			alt={alt || label}
			title={title || alt || label}
			draggable="false"
			class="size-full scale-[1.3] object-cover"
		/>
	</span>
{:else}
	<span
		class="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full {className}"
	>
		{label || '·'}
	</span>
{/if}
