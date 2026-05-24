<script>
	import OptimizerWidget from '$lib/components/OptimizerWidget.svelte';
	import ResourcePriceWidget from '$lib/components/ResourcePriceWidget.svelte';
	import DashboardCalculatorWidget from '$lib/components/DashboardCalculatorWidget.svelte';

	import { dev } from '$app/environment';
</script>

<div class="page-wrapper page-wide">
	<div class="mb-6 text-center">
		<h2 class="text-3xl md:text-4xl font-bold theme-text-accent tracking-tight mb-2">Dashboard</h2>
		<p class="text-base theme-text-muted max-w-2xl mx-auto">All you need in once place</p>
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
		<div class="lg:col-span-2 flex flex-col">
			<div class="flex justify-between items-center mb-4 px-1">
				<h2 class="font-bold text-lg">Next Best Upgrade</h2>
				<a href="/calculator/suggestions" class="text-xs text-blue-400 hover:underline"
					>View All &rarr;</a
				>
			</div>

			<div class="flex-grow mb-4">
				<OptimizerWidget compact={true} maxResults={1} />
			</div>
			<div class="flex-grow">
				<DashboardCalculatorWidget />
			</div>
		</div>
		<div class="lg:col-span-1 flex flex-col max-h-[600px]">
			<ResourcePriceWidget />
		</div>
		{#if dev}
			<div class="lg:col-span-2 flex flex-col">
				{#await import('$lib/components/OptimizerTestWidget.svelte') then { default: OptimizerTestWidget }}
					<OptimizerTestWidget />
				{/await}
			</div>
		{/if}
	</div>
</div>
