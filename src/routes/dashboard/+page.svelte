<script>
	import OptimizerWidget from '$lib/components/OptimizerWidget.svelte';
</script>

<div class="page-wrapper page-wide">
	<h1>Dashboard</h1>
	<p>All you need in one place</p>

	<div class="flex justify-between items-center mb-4">
		<h2 class="font-bold text-lg">Next Best Upgrade</h2>
		<a href="/calculator/suggestions" class="text-xs text-blue-400 hover:underline">View All</a>
	</div>

	<OptimizerWidget compact={true} maxResults={1} />
</div>
