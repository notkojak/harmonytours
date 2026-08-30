<script lang="ts">
	import { Tabs, TabsList, TabsTrigger } from '$lib/components/ui/tabs/index.js';
	import { statTabs } from '$lib/data/dashboard';

	let value = $state('0');
</script>

<Tabs bind:value class="w-fit">
	<TabsList>
		{#each statTabs as tab, i}
			<TabsTrigger value={String(i)}>{tab}</TabsTrigger>
		{/each}
	</TabsList>
</Tabs>
