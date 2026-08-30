<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table/index.js';
	import { skeletonRows, statColumns } from '$lib/data/dashboard';

	// Largeurs pseudo-aléatoires mais stables pour les barres de squelette.
	function barWidth(index: number, row: number) {
		const widths = [52, 42, 34, 30, 38, 32, 46, 40, 36, 28, 50];
		return widths[(index + row * 3) % widths.length];
	}
</script>

<div class="overflow-x-auto rounded-xl border border-line">
	<Table class="min-w-[720px]">
		<TableHeader>
			<TableRow class="border-line bg-transparent hover:bg-transparent">
				{#each statColumns as col}
					<TableHead
						class="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
					>
						{col}
					</TableHead>
				{/each}
			</TableRow>
		</TableHeader>
		<TableBody>
			{#each skeletonRows as row}
				<TableRow class="border-line/60 hover:bg-transparent">
					{#each statColumns as _, col}
						<TableCell class="px-4 py-3.5">
							<Skeleton class="h-2.5 rounded-full" style={`width:${barWidth(col, row)}%`} />
						</TableCell>
					{/each}
				</TableRow>
			{/each}
		</TableBody>
	</Table>
</div>
