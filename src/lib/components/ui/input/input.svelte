<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLInputAttributes, HTMLInputTypeAttribute } from 'svelte/elements';

	type InputType = Exclude<HTMLInputTypeAttribute, 'file'>;

	type Props = WithElementRef<
		Omit<HTMLInputAttributes, 'type'> &
			({ type: 'file'; files?: FileList } | { type?: InputType; files?: undefined })
	>;

	let {
		ref = $bindable(null),
		value = $bindable(),
		type,
		files = $bindable(),
		class: className,
		'data-slot': dataSlot = 'input',
		...restProps
	}: Props = $props();

	// Champ de bravaux.fr : coins arrondis (pas pilule), 15px, fond blanc, bordure qui
	// passe au bleu au focus.
	const field =
		'h-11 w-full min-w-0 rounded-md border border-input bg-card px-3.5 text-[15px] text-foreground caret-foreground transition-[border-color,box-shadow] outline-none placeholder:text-ink-mute focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-brand/15 aria-invalid:border-destructive aria-invalid:ring-4 aria-invalid:ring-destructive/15 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 file:mr-3 file:inline-flex file:h-9 file:cursor-pointer file:items-center file:rounded-full file:border-0 file:bg-primary file:px-4 file:text-[11.5px] file:font-bold file:tracking-[0.06em] file:uppercase file:text-primary-foreground';
</script>

{#if type === 'file'}
	<input
		bind:this={ref}
		data-slot={dataSlot}
		class={cn(field, className)}
		type="file"
		bind:files
		bind:value
		{...restProps}
	/>
{:else}
	<input
		bind:this={ref}
		data-slot={dataSlot}
		class={cn(field, className)}
		{type}
		bind:value
		{...restProps}
	/>
{/if}
