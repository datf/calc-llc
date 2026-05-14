<script>
	import { optimizer } from '$lib/optimizer/state.svelte.js';
	import { formatLargeNumber, formatDPS } from '$lib/utils.js';

	let { compact = false, maxResults = 3 } = $props();

	// Derived value to handle the maxResults slicing purely for display
	let displayResults = $derived(optimizer.results.slice(0, maxResults));

	$effect(() => {
		// Only run the calculation if we haven't done it yet
		if (optimizer.results.length === 0 && !optimizer.isCalculating) {
			optimizer.execute();
		}
	});
</script>

<div class="flex flex-col h-full">
	{#if !compact}
		<div
			class="flex flex-col md:flex-row gap-4 items-center justify-between bg-black/20 p-4 border theme-border rounded-xl mb-6"
		>
			<div class="flex items-center gap-3">
				<span class="font-bold theme-text-muted text-sm uppercase tracking-wider">Strategy:</span>
				<select
					bind:value={optimizer.strategy}
					class="bg-black/40 border theme-border theme-text px-4 py-2 rounded focus:theme-border-hover outline-none font-bold"
				>
					<option value="MAX_DPS">Maximize DPS</option>
					<option value="COLLECTION">Optimize for Collection</option>
					<option value="QUESTS">Suggest Quests</option>
				</select>
			</div>
			<button
				onclick={() => optimizer.execute()}
				disabled={optimizer.isCalculating}
				class="px-6 py-2 bg-yellow-600 hover:bg-yellow-500 text-black font-bold rounded shadow-[0_0_10px_rgba(202,138,4,0.4)] disabled:opacity-50 transition-colors"
			>
				{optimizer.isCalculating ? 'Calculating...' : 'Re-calculate Upgrades'}
			</button>
		</div>
	{/if}

	{#if displayResults.length > 0}
		<div class="grid grid-cols-1 {compact ? 'gap-4' : 'lg:grid-cols-3 gap-6'}">
			{#each displayResults as option}
				<div
					class="theme-surface border {option.id === 1
						? 'theme-border-hover shadow-[0_0_15px_rgba(255,215,0,0.1)]'
						: 'theme-border'} rounded-xl p-5 flex flex-col h-full"
				>
					<div class="border-b theme-border pb-3 mb-4">
						<div class="flex justify-between items-center mb-1">
							<h3 class="text-lg font-bold {option.id === 1 ? 'theme-text-accent' : 'theme-text'}">
								Option {option.id}
							</h3>
							<span class="text-xs px-2 py-1 bg-black/40 rounded border theme-border font-mono">
								{formatDPS(option.projectedValue)}
							</span>
						</div>
						{#if option.id === 1}
							<p class="text-[10px] text-green-400 uppercase tracking-widest font-bold">
								Mathematical Optimal
							</p>
						{/if}
					</div>

					<div class="flex-grow space-y-4">
						<!-- Sell Section -->
						<div>
							<h4 class="text-xs font-bold text-red-400 mb-2 uppercase flex justify-between">
								<span>Items to Sell</span>
								<span>+{formatLargeNumber(option.sell.totalEarned)}g</span>
							</h4>
							{#if option.sell.items.length === 0}
								<p class="text-xs theme-text-muted italic">Nothing to sell.</p>
							{:else}
								<ul class="space-y-1">
									{#each option.sell.items as item}
										<li
											class="flex justify-between items-center text-xs bg-red-950/20 px-2 py-1 rounded border border-red-900/30"
										>
											<span class="flex items-center gap-1.5 truncate">
												{#if item.pics[0]}<img
														src={item.pics[0]}
														alt="icon"
														class="w-4 h-4 rendering-pixelated object-contain"
													/>{/if}
												<span class="theme-text-muted">{item.qty} x</span>
												{item.name}
											</span>
											<span class="text-red-300 font-mono">+{formatLargeNumber(item.total)}g</span>
										</li>
									{/each}
								</ul>
							{/if}
						</div>

						<!-- Buy Section -->
						<div>
							<h4 class="text-xs font-bold text-green-400 mb-2 uppercase flex justify-between">
								<span>Items to Buy</span>
								<span>-{formatLargeNumber(option.buy.totalSpent)}g</span>
							</h4>
							{#if option.buy.items.length === 0}
								<p class="text-xs theme-text-muted italic">Nothing to buy.</p>
							{:else}
								<ul class="space-y-1">
									{#each option.buy.items as item}
										<li
											class="flex justify-between items-center text-xs bg-green-950/20 px-2 py-1 rounded border border-green-900/30"
										>
											<span class="flex items-center gap-1.5 truncate">
												{#if item.pics[0]}<img
														src={item.pics[0]}
														alt="icon"
														class="w-4 h-4 rendering-pixelated object-contain"
													/>{/if}
												<span class="theme-text-muted">{item.qty} x</span>
												{item.name}
											</span>
											<span class="text-green-300 font-mono">-{formatLargeNumber(item.total)}g</span
											>
										</li>
									{/each}
								</ul>
							{/if}
						</div>
					</div>

					{#if !compact}
						<button
							class="mt-6 w-full py-2 bg-black/40 hover:bg-black/60 border theme-border theme-text-muted hover:theme-text font-bold text-sm rounded transition-colors"
							onclick={() => alert('Logic to create a new loadout from these items will go here')}
						>
							+ Create New Loadout
						</button>
					{/if}
				</div>
			{/each}
		</div>
	{:else}
		<div
			class="text-center py-10 border border-dashed theme-border rounded-xl bg-black/10 h-full flex flex-col justify-center"
		>
			<h3 class="text-xl font-bold theme-text-muted mb-2">
				{optimizer.isCalculating ? 'Crunching numbers...' : 'Ready to analyze'}
			</h3>
		</div>
	{/if}
</div>
