<script>
	import { getOrgChart } from '$lib/database.js';
	import { gameState } from '$lib/game.svelte.js';
	import OrgNode from './OrgNode.svelte';

	let orgChart = $derived(getOrgChart(gameState.professionId));
</script>

<!-- Swapped hardcoded colors for your theme tokens! -->
<div class="page-wrapper page-wide">
	<div class="mb-6 text-center">
		<h2 class="text-3xl md:text-4xl font-bold theme-text-accent tracking-tight mb-2">
			Organisation Chart
		</h2>
		<p class="text-base theme-text-muted max-w-2xl mx-auto">
			Higher ranking employees must be promoted from lower ranks. Only interns can be purchased
			outright.
		</p>
	</div>
	<div class="theme-surface theme-border border-2 rounded-lg overflow-x-auto p-4 md:p-8">
		<!-- Render the top tier nodes side-by-side -->
		<div class="flex justify-center gap-16 items-start min-w-max">
			{#each orgChart as topTierEmp}
				<OrgNode employee={topTierEmp} />
			{/each}
		</div>
	</div>
</div>
