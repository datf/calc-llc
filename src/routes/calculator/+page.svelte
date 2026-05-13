<script>
	import { gameState } from '$lib/game.svelte.js';
	import { formatLargeNumber } from '$lib/utils.js';
	import { formatDPS, getTimeToDestroyInfo } from '$lib/utils.js';
	import { CalculatorManager } from '$lib/calculator/state.svelte.js';

	const calc = new CalculatorManager();
</script>

<div class="mb-8 theme-surface border theme-border rounded-xl overflow-hidden">
	<div class="flex items-center gap-2 p-4 var(--bg-main) border-b theme-border overflow-x-auto">
		<span class="theme-text-muted font-bold uppercase tracking-wider text-sm mr-2 shrink-0"
			>Loadouts:</span
		>
		{#each calc.typedLoadouts as loadout}
			<div
				class="flex items-center theme-surface theme-surface-hover rounded-lg border {gameState.calculatorActiveLoadoutId ===
				loadout.id
					? 'theme-border-hover shadow-[0_0_8px_rgba(255,215,0,0.2)]'
					: 'theme-border opacity-70'}"
			>
				<button
					class="px-4 py-2 font-bold text-sm {gameState.calculatorActiveLoadoutId === loadout.id
						? 'theme-text-accent'
						: 'theme-text'}"
					onclick={() => (gameState.calculatorActiveLoadoutId = loadout.id)}
				>
					{loadout.name}
				</button>
				{#if calc.typedLoadouts.length > 1}
					<button
						class="px-2 py-2 theme-text-muted hover:text-red-400"
						onclick={() => calc.removeLoadout(loadout.id)}>✕</button
					>
				{/if}
			</div>
		{/each}
		<button
			onclick={() => calc.addLoadout()}
			class="px-4 py-2 theme-surface theme-surface-hover border theme-border theme-text-muted hover:theme-text rounded-lg font-bold shrink-0"
		>
			+ Add Loadout
		</button>
	</div>

	<div class="p-6">
		<p class="text-sm theme-text-muted mb-4">
			Click items to toggle them for <strong class="theme-text-accent"
				>{calc.activeLoadout.name}</strong
			>. Adjust quantities using the inputs.
		</p>

		<div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
			<!-- Modifiers -->
			<div class="p-4 theme-surface theme-surface-hover/50 rounded-lg border border-blue-900/50">
				<h3 class="text-xs font-bold text-blue-400 mb-3 uppercase tracking-wider">
					Status Modifiers
				</h3>
				<div class="flex flex-wrap gap-2">
					{#each calc.sources.modifiers as source}
						<div
							role="button"
							tabindex="0"
							onclick={() => calc.toggleItemInLoadout(source)}
							onkeydown={(e) => e.key === 'Enter' && calc.toggleItemInLoadout(source)}
							class="flex items-center gap-2 px-2 py-1.5 rounded border cursor-pointer select-none {calc.isSourceActive(
								source
							)
								? 'bg-blue-900/40 border-blue-400'
								: 'var(--bg-main) theme-border opacity-60 hover:opacity-100'}"
						>
							{#if source.pics}
								<div class="relative w-5 h-5">
									{#each source.pics as picBase64}
										<img
											src={picBase64}
											alt="layer"
											class="absolute inset-0 w-full h-full object-contain rendering-pixelated"
										/>
									{/each}
								</div>
							{/if}
							<div class="flex flex-col text-left">
								<span
									class="text-xs font-bold {calc.isSourceActive(source)
										? 'theme-text'
										: 'theme-text-muted'}">{source.name}</span
								>
								{#if calc.isSourceActive(source)}
									{@const activeRef = calc.getActiveRef(calc.activeLoadout.modifiers, source.id)}
									{#if source.isStackable}
										<div
											class="mt-0.5 flex items-center gap-1"
											onclick={(e) => e.stopPropagation()}
											onkeydown={(e) => e.stopPropagation()}
										>
											<input
												type="number"
												min="1"
												max={source.maxCount}
												bind:value={activeRef.activeCount}
												class="w-14 text-xs px-1 py-0.5 rounded var(--bg-main) theme-text border theme-border focus:theme-border-hover outline-none"
											/>
											<span class="text-[9px] theme-text-muted"
												>/ {formatLargeNumber(source.ownedCount)}</span
											>
										</div>
									{:else}
										<span class="text-[9px] text-blue-300 mt-0.5 font-semibold">Active (Max 1)</span
										>
									{/if}
								{:else}
									<span class="text-[9px] theme-text-muted"
										>Owned: {formatLargeNumber(source.ownedCount)}</span
									>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Independents -->
			<div
				class="p-4 theme-surface theme-surface-hover/50 rounded-lg border border-green-900/50 xl:col-span-2"
			>
				<h3 class="text-xs font-bold text-green-400 mb-3 uppercase tracking-wider">
					Background DPS
				</h3>
				<div class="flex flex-wrap gap-2">
					{#each calc.sources.independentSources as source}
						<div
							role="button"
							tabindex="0"
							onclick={() => calc.toggleItemInLoadout(source)}
							onkeydown={(e) => e.key === 'Enter' && calc.toggleItemInLoadout(source)}
							class="flex items-center gap-2 px-2 py-1.5 rounded border cursor-pointer select-none {calc.isSourceActive(
								source
							)
								? 'bg-green-900/40 border-green-400'
								: 'var(--bg-main) theme-border opacity-60 hover:opacity-100'}"
						>
							{#if source.pics}
								<div class="relative w-5 h-5">
									{#each source.pics as picBase64}
										<img
											src={picBase64}
											alt="layer"
											class="absolute inset-0 w-full h-full object-contain rendering-pixelated"
										/>
									{/each}
								</div>
							{/if}
							<div class="flex flex-col text-left">
								<span
									class="text-xs font-bold {calc.isSourceActive(source)
										? 'theme-text'
										: 'theme-text-muted'}">{source.name}</span
								>
								{#if calc.isSourceActive(source)}
									{@const activeRef = calc.getActiveRef(calc.activeLoadout.independents, source.id)}
									{#if source.isStackable}
										<div
											class="mt-0.5 flex items-center gap-1"
											onclick={(e) => e.stopPropagation()}
											onkeydown={(e) => e.stopPropagation()}
										>
											<input
												type="number"
												min="1"
												max={source.maxCount}
												bind:value={activeRef.activeCount}
												class="w-14 text-xs px-1 py-0.5 rounded var(--bg-main) theme-text border theme-border focus:theme-border-hover outline-none"
											/>
											<span class="text-[9px] theme-text-muted"
												>/ {formatLargeNumber(source.ownedCount)}</span
											>
										</div>
									{:else}
										<span class="text-[9px] text-green-300 mt-0.5 font-semibold"
											>Active (Max 1)</span
										>
									{/if}
								{:else}
									<span class="text-[9px] theme-text-muted"
										>Owned: {formatLargeNumber(source.ownedCount)}</span
									>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Held Weapons -->
			<div
				class="p-4 theme-surface theme-surface-hover/50 rounded-lg border theme-border-hover/30 xl:col-span-3"
			>
				<h3 class="text-xs font-bold theme-text-accent mb-3 uppercase tracking-wider">
					Held Weapon (Max 1)
				</h3>
				<div class="flex flex-wrap gap-2">
					{#each calc.sources.heldWeapons as source}
						<div
							role="button"
							tabindex="0"
							onclick={() => calc.toggleItemInLoadout(source)}
							onkeydown={(e) => e.key === 'Enter' && calc.toggleItemInLoadout(source)}
							class="flex items-center gap-2 px-2 py-1.5 rounded border cursor-pointer select-none {calc.isSourceActive(
								source
							)
								? 'bg-yellow-900/30 theme-border-hover shadow-[0_0_8px_rgba(255,215,0,0.3)]'
								: 'var(--bg-main) theme-border opacity-60 hover:opacity-100'}"
						>
							{#if source.pics}
								<div class="relative w-5 h-5">
									{#each source.pics as picBase64}
										<img
											src={picBase64}
											alt="layer"
											class="absolute inset-0 w-full h-full object-contain rendering-pixelated"
										/>
									{/each}
								</div>
							{/if}
							<div class="flex flex-col text-left">
								<span
									class="text-xs font-bold {calc.isSourceActive(source)
										? 'theme-text'
										: 'theme-text-muted'}">{source.name}</span
								>
								<span class="text-[9px] theme-text-muted"
									>Owned: {formatLargeNumber(source.ownedCount)}</span
								>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Passives Summary -->
			<div
				class="p-4 theme-surface theme-surface-hover/50 rounded-lg border border-purple-900/50 xl:col-span-3"
			>
				<h3 class="text-xs font-bold text-purple-400 mb-3 uppercase tracking-wider">
					Active Passives Summary
				</h3>
				<div class="flex flex-wrap gap-2">
					{#each calc.nonZeroPassives as passive}
						{@const isActive = calc.activePassiveKeys.has(passive.key)}
						<div
							class="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono border {isActive
								? 'bg-purple-900/40 border-purple-400 theme-text shadow-[0_0_8px_rgba(168,85,247,0.2)]'
								: 'var(--bg-main) theme-border theme-text-muted opacity-60'}"
						>
							<span class="uppercase">{passive.name}:</span>
							<span class="font-bold {isActive ? 'theme-text-accent' : ''}"
								>+{Math.round(passive.value * 100)}%</span
							>
						</div>
					{/each}
					{#if calc.nonZeroPassives.length === 0}
						<span class="text-xs theme-text-muted italic">No passives upgraded yet.</span>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>

<!-- TABLE FILTERS -->
<div class="mb-4 theme-surface border theme-border rounded-xl p-4">
	<div class="mb-4">
		<h3 class="text-xs font-bold theme-text-muted mb-2 uppercase tracking-wider">
			Filter by Layer
		</h3>
		<div class="flex flex-wrap gap-2">
			{#each calc.layerOptions as layer}
				<button
					onclick={() => calc.toggleLayerFilter(layer.name)}
					class="flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-bold select-none {gameState.calculatorHiddenLayers.includes(
						layer.name
					)
						? 'var(--bg-main) theme-border theme-text-muted opacity-50'
						: 'theme-surface theme-surface-hover theme-border theme-text hover:var(--border-main) hover:border-gray-400'}"
				>
					{#if layer.pic}<img
							src={layer.pic}
							alt={layer.name}
							class="w-4 h-4 rendering-pixelated object-contain"
						/>{/if}
					<span class="capitalize">{layer.name}</span>
				</button>
			{/each}
		</div>
	</div>
	<div>
		<h3 class="text-xs font-bold theme-text-muted mb-2 uppercase tracking-wider">
			Filter by Material
		</h3>
		<div class="flex flex-wrap gap-2">
			{#each calc.materialOptions as mat}
				<button
					onclick={() => calc.toggleMaterialFilter(mat.name)}
					class="flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-bold select-none {gameState.calculatorHiddenMaterials.includes(
						mat.name
					)
						? 'var(--bg-main) theme-border theme-text-muted opacity-50'
						: 'theme-surface theme-surface-hover theme-border theme-text hover:var(--border-main) hover:border-gray-400'}"
				>
					{#if mat.pic}<img
							src={mat.pic}
							alt={mat.name}
							class="w-4 h-4 rendering-pixelated object-contain"
						/>{/if}
					<span class="capitalize">{mat.name}</span>
				</button>
			{/each}
		</div>
	</div>
</div>

<!-- INVERTED DATA TABLE -->
<div class="overflow-x-auto rounded-lg border theme-border">
	<table class="w-full text-left border-collapse">
		<thead>
			<tr class="theme-surface theme-text text-sm uppercase tracking-wider">
				<th
					class="p-4 border-b border-r theme-border min-w-[280px] sticky left-0 theme-surface z-20 shadow-[2px_0_5px_rgba(0,0,0,0.3)]"
					>Loadout</th
				>
				{#each calc.filteredTiles as tile}
					<th class="p-4 border-b theme-border min-w-[120px]">
						<div class="flex items-center gap-2">
							{#if tile.pics_in_rock_base64?.length > 0}
								<img
									src={tile.pics_in_rock_base64[0]}
									alt={tile.resource}
									class="w-6 h-6 rendering-pixelated object-contain"
								/>
							{/if}
							<div>
								<div class="font-bold leading-tight capitalize">{tile.resource}</div>
								<div class="text-[10px] theme-text-muted leading-tight capitalize">
									{tile.layer}
								</div>
							</div>
						</div>
					</th>
				{/each}
				{#if calc.filteredTiles.length === 0}
					<th class="p-4 border-b theme-border theme-text-muted italic font-normal"
						>No tiles match current filters.</th
					>
				{/if}
			</tr>
		</thead>
		<tbody class="text-sm divide-y divide-gray-700">
			{#each calc.typedLoadouts as loadout}
				{@const rowDPS = calc.loadoutDPSMap.get(loadout.id) || 0}
				{@const maxTime = gameState.secondsPerRound || 300}
				{@const isEditing = gameState.calculatorActiveLoadoutId === loadout.id}

				<tr
					class="hover:var(--border-main)/50 {isEditing
						? 'theme-surface theme-surface-hover/80'
						: ''}"
				>
					<td
						class="p-4 border-r theme-border sticky left-0 theme-surface theme-surface-hover z-10 shadow-[2px_0_5px_rgba(0,0,0,0.3)]"
					>
						<div class="flex justify-between items-start mb-2">
							<button
								class="font-bold flex items-center gap-2 focus:outline-none {isEditing
									? 'theme-text-accent'
									: 'theme-text hover:theme-text'}"
								onclick={() => (gameState.calculatorActiveLoadoutId = loadout.id)}
							>
								{loadout.name}
							</button>
							<div
								class="text-xs font-mono theme-text theme-surface border theme-border px-2 py-1 rounded"
							>
								{formatDPS(rowDPS)}
							</div>
						</div>
						<div class="flex flex-wrap gap-2 pt-1">
							{#if loadout.heldWeapon}
								<div
									class="relative w-6 h-6 border theme-border-hover var(--bg-main) rounded"
									title={loadout.heldWeapon.name}
								>
									{#each loadout.heldWeapon.pics as pic}<img
											src={pic}
											alt="wep"
											class="absolute inset-0 w-full h-full object-contain rendering-pixelated"
										/>{/each}
								</div>
							{/if}
							{#each loadout.modifiers as mod}
								<div
									class="relative w-6 h-6 border border-blue-500 var(--bg-main) rounded"
									title={mod.name}
								>
									{#each mod.pics as pic}<img
											src={pic}
											alt="mod"
											class="absolute inset-0 w-full h-full object-contain rendering-pixelated"
										/>{/each}
									{#if (mod.activeCount ?? 0) > 1}
										<span
											class="absolute -bottom-2 -right-2 theme-surface theme-text text-[9px] font-bold px-1 rounded-full border theme-border"
											>x{formatLargeNumber(mod.activeCount ?? 1)}</span
										>
									{/if}
								</div>
							{/each}
							{#each loadout.independents as ind}
								<div
									class="relative w-6 h-6 border border-green-500 var(--bg-main) rounded"
									title={ind.name}
								>
									{#each ind.pics as pic}<img
											src={pic}
											alt="ind"
											class="absolute inset-0 w-full h-full object-contain rendering-pixelated"
										/>{/each}
									{#if ind.activeCount > 1}<span
											class="absolute -bottom-2 -right-2 theme-surface theme-text text-[9px] font-bold px-1 rounded-full border theme-border"
											>x{formatLargeNumber(ind.activeCount)}</span
										>{/if}
								</div>
							{/each}
						</div>
					</td>

					{#each calc.filteredTiles as tile}
						{@const ttk = getTimeToDestroyInfo(tile, rowDPS, maxTime)}
						<td class="p-4 align-middle border-r theme-border last:border-r-0 text-center">
							<div class="relative group cursor-help inline-block w-full">
								<div class="font-mono font-bold {ttk.color} text-base">{ttk.text}</div>
								<div
									class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center theme-surface border theme-border px-3 py-2 rounded shadow-[0_0_10px_rgba(0,0,0,0.5)] z-50 whitespace-nowrap pointer-events-none"
								>
									<span class="text-[9px] theme-text-muted uppercase tracking-wider mb-1"
										>Yield / Block</span
									>
									<span class="font-mono theme-text-accent font-bold text-sm">
										{tile.min_drop === tile.max_drop
											? formatLargeNumber(tile.min_drop)
											: `${formatLargeNumber(tile.min_drop)} - ${formatLargeNumber(tile.max_drop)}`}
									</span>
									<div
										class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-600"
									></div>
								</div>
							</div>
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>
