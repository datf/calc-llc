<script>
	import { page } from '$app/stores';
	import { resolve } from '$app/paths';

	let { children } = $props();

	const calculatorPath = resolve('/calculator');
	const suggestionsPath = resolve('/calculator/suggestions');
</script>

<div class="page-wrapper page-wide">
	<div class="mb-6 text-center">
		<h2 class="text-3xl md:text-4xl font-bold theme-text-accent tracking-tight mb-2">
			Strategy Calculator
		</h2>
		<p class="text-base theme-text-muted max-w-2xl mx-auto">
			Build setups and analyze your mining power against different blocks.
		</p>
	</div>

	<!-- TABS NAVIGATION -->
	<div class="flex gap-2 border-b theme-border pb-px">
		<a
			href={calculatorPath}
			class="px-6 py-3 font-bold rounded-t-lg {$page.url.pathname === calculatorPath
				? 'theme-surface theme-surface-hover theme-text-accent border-t border-l border-r theme-border'
				: 'theme-surface theme-text-muted hover:theme-text'}"
		>
			Current Power
		</a>
		<a
			href={suggestionsPath}
			class="px-6 py-3 font-bold rounded-t-lg {$page.url.pathname === suggestionsPath
				? 'theme-surface theme-surface-hover theme-text-accent border-t border-l border-r theme-border'
				: 'theme-surface theme-text-muted hover:theme-text'}"
		>
			Proposed Upgrades
		</a>
	</div>

	<div
		class="theme-surface theme-surface-hover border theme-border rounded-b-xl p-6 shadow-2xl min-h-[60vh]"
	>
		<!-- This renders the sub-pages -->
		{@render children()}
	</div>
</div>
