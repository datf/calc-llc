<script>
	import { calcState } from '$lib/calculator/state.svelte.js';
	import { gameState } from '$lib/game.svelte.js';
	import { formatLargeNumber, formatDPS } from '$lib/utils.js';

	// Helper to format seconds into something readable
	function formatTime(seconds) {
		if (seconds < 60) return `${Math.ceil(seconds)}s`;
		const mins = Math.floor(seconds / 60);
		const secs = Math.ceil(seconds % 60);
		return `${mins}m ${secs}s`;
	}
</script>

<div class="flex flex-col h-full">
	<div class="theme-surface border theme-border rounded-xl p-4 shadow-lg flex flex-col gap-4">
		<h3 class="font-bold theme-text-accent uppercase tracking-wider border-b theme-border pb-2">
			Mining Analytics
		</h3>

		<!-- Loadout Selector -->
		<div>
			<label for="widget-loadout" class="block text-xs font-bold theme-text-muted mb-1 uppercase"
				>Active Loadout</label
			>
			<select
				id="widget-loadout"
				bind:value={calcState.calculatorActiveLoadoutId}
				class="w-full theme-surface theme-surface-hover theme-text border theme-border rounded p-2 text-sm outline-none"
			>
				{#each calcState.calculatorLoadouts as loadout}
					<option value={loadout.id}>{loadout.name}</option>
				{/each}
			</select>
		</div>

		<!-- DPS Display -->
		<div class="flex justify-between items-center p-3 var(--bg-main) rounded border theme-border">
			<span class="text-xs font-bold theme-text-muted uppercase">Theoretical DPS</span>
			<span class="font-mono font-bold text-green-400">
				{formatDPS(calcState.loadoutDPSMap.get(calcState.calculatorActiveLoadoutId) || 0)}
			</span>
		</div>

		<div class="grid grid-cols-1 gap-3">
			<!-- Quota Analytics -->
			{#if gameState.quota > 0n}
				<div class="p-3 theme-surface-hover rounded border border-blue-900/50">
					<div class="text-[10px] font-bold text-blue-400 uppercase mb-1">Quota Strategy</div>
					{#if calcState.bestTileForQuota}
						{@const quota = calcState.bestTileForQuota}
						<div class="flex items-center gap-2 mb-2">
							{#if quota.tile.pics_in_rock_base64?.length > 0}
								<img
									src={quota.tile.pics_in_rock_base64[0]}
									alt="tile"
									class="w-6 h-6 rendering-pixelated"
								/>
							{/if}
							<div class="text-sm font-bold capitalize">
								{quota.tile.layer}
								{quota.tile.resource}
							</div>
						</div>
						<div class="text-xs theme-text-muted">
							Requires breaking <strong class="theme-text"
								>{formatLargeNumber(quota.blocksNeeded)}</strong
							> blocks.
						</div>
						<div
							class="mt-2 text-xs font-mono font-bold {quota.isPossibleThisRound
								? 'text-green-400'
								: 'text-red-400'}"
						>
							Est. Time: {formatTime(quota.totalTime)}
							{#if !quota.isPossibleThisRound}
								<span class="block text-[9px] mt-0.5 opacity-80">(Exceeds round timer!)</span>
							{/if}
						</div>
					{:else}
						<div class="text-xs theme-text-muted italic">Insufficient DPS or unknown resource.</div>
					{/if}
				</div>
			{/if}

			<!-- Profit Analytics -->
			<div class="p-3 theme-surface-hover rounded border border-yellow-900/50">
				<div class="text-[10px] font-bold text-yellow-500 uppercase mb-1">Max Profit Strategy</div>
				{#if calcState.mostProfitableTile}
					{@const profit = calcState.mostProfitableTile}
					<div class="flex items-center gap-2 mb-2">
						{#if profit.tile.pics_in_rock_base64?.length > 0}
							<img
								src={profit.tile.pics_in_rock_base64[0]}
								alt="tile"
								class="w-6 h-6 rendering-pixelated"
							/>
						{/if}
						<div class="text-sm font-bold capitalize">
							{profit.tile.layer}
							{profit.tile.resource}
						</div>
					</div>
					<div class="mt-1 text-xs font-mono font-bold text-yellow-400">
						${formatLargeNumber(profit.profitPerSec)} / sec
					</div>
				{:else}
					<div class="text-xs theme-text-muted italic">No profitable tiles found.</div>
				{/if}
			</div>
		</div>
	</div>
</div>
