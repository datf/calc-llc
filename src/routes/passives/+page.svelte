<!-- src/routes/passives/+page.svelte -->
<script>
	import { gameState } from '$lib/game.svelte.js';
	import { PASSIVE_KEYS, passivesInfo, getBonusShopItems } from '$lib/database.js';
	import { formatLargeNumber } from '$lib/utils.js';

	// --- BONUS SHOP LOGIC ---
	// Get all bonus items for this profession, but filter out the ones the player has already bought!
	let availableBonusItems = $derived(
		getBonusShopItems(gameState.professionId).filter(
			(item) => gameState.itemUnlockedStates[item.itemID] !== false
		)
	);

	function buyBonusSingle(item) {
		if (gameState.cash >= item.itemBuyPrice) {
			gameState.cash -= item.itemBuyPrice;
			// This calls the helper we made earlier to apply systemic side-effects and lock the item
			gameState.buyBonusItem(item.itemID);
		}
	}

	// --- PASSIVES LOGIC ---
	function formatLabel(key) {
		return key
			.split('_')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	// Convert float to percentage for the UI (0.14 -> 14)
	function getDisplayPercent(floatValue) {
		return Number((floatValue * 100).toFixed(2));
	}

	// Convert UI percentage back to float for the save state (14 -> 0.14)
	function handleInput(key, event) {
		let percent = parseFloat(event.target.value);
		if (isNaN(percent)) percent = 0;

		// Divide by 100 and round to 4 decimals to avoid JS floating-point junk
		gameState.passives[key] = Number((percent / 100).toFixed(4));
	}
</script>

<div class="page-wrapper page-wide">
	<div class="mb-6 text-center">
		<h2 class="text-3xl md:text-4xl font-bold theme-text-accent tracking-tight mb-2">
			Upgrades & Passives
		</h2>
		<p class="text-base theme-text-muted max-w-2xl mx-auto">
			Purchase systemic upgrades on the left, and adjust your global passive multipliers on the
			right.
		</p>
	</div>

	<div class="flex flex-col lg:flex-row gap-8">
		<!-- LEFT PANEL: BONUS SHOP (Flexes to fill remaining space) -->
		<div class="flex-1">
			<h2 class="text-2xl font-bold mb-4 theme-text-accent border-b theme-border pb-2">
				Bonus Upgrades
			</h2>

			{#if availableBonusItems.length === 0}
				<div class="theme-surface rounded border theme-border p-8 text-center">
					<p class="theme-text-muted italic">
						There are no more bonus items available in the shop.
					</p>
				</div>
			{:else}
				<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
					{#each availableBonusItems as item}
						<button
							class="theme-surface theme-surface-hover p-4 rounded border theme-border flex flex-col text-left theme-border-hover
                     {gameState.cash < item.itemBuyPrice ? 'opacity-50 cursor-not-allowed' : ''}"
							onclick={() => buyBonusSingle(item)}
						>
							<h3
								class="text-lg theme-text-accent font-bold border-b theme-border pb-2 mb-3 leading-tight w-full"
							>
								{item.itemName} - <br /><span class="theme-text"
									>${formatLargeNumber(item.itemBuyPrice)}</span
								>
							</h3>

							<div class="flex gap-3 flex-1 mb-2 w-full">
								<div class="shrink-0">
									{#if item.picB64}
										<img
											src={item.picB64}
											alt={item.itemName}
											class="w-16 h-16 object-contain theme-surface rounded p-1 border theme-border"
											style="image-rendering: pixelated;"
										/>
									{:else}
										<div
											class="w-16 h-16 theme-surface border theme-border flex items-center justify-center text-2xl rounded"
										>
											✨
										</div>
									{/if}
								</div>

								<div class="flex-1 text-xs text-gray-300 flex flex-col justify-center">
									<span class="theme-text-muted italic mb-1 uppercase tracking-wider"
										>{item.itemType}</span
									>
									<span class="theme-text font-semibold">Click to unlock permanently!</span>
								</div>
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<!-- RIGHT PANEL: PASSIVES (Fixed width, vertical scroll) -->
		<div class="lg:w-80 shrink-0">
			<div class="sticky top-4">
				<h2 class="text-2xl font-bold mb-4 theme-text-accent border-b theme-border pb-2">
					Passive Effects
				</h2>

				<!-- Added max height and vertical scrolling so it doesn't break the page height -->
				<div
					class="theme-surface p-4 rounded border theme-border max-h-[75vh] overflow-y-auto custom-scrollbar"
				>
					<div class="flex flex-col gap-4 pr-1">
						{#each PASSIVE_KEYS as key}
							<div class="flex flex-col bg-black/20 p-3 rounded border theme-border">
								<label
									for={key}
									class="block text-[11px] uppercase tracking-wider font-bold theme-text-muted mb-2"
								>
									{formatLabel(key)}
								</label>

								<div class="flex items-center gap-2">
									<input
										id={key}
										type="number"
										step={getDisplayPercent(passivesInfo[key])}
										value={getDisplayPercent(gameState.passives[key])}
										oninput={(e) => handleInput(key, e)}
										class="w-full theme-input p-1.5 rounded theme-border-focus font-mono text-sm"
									/>
									<span class="theme-text-accent font-bold">%</span>
								</div>
							</div>
						{/each}
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	/* Small custom scrollbar styling to make the Passives panel look neat */
	.custom-scrollbar::-webkit-scrollbar {
		width: 6px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background-color: var(--border-main, #4b5563);
		border-radius: 10px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background-color: var(--text-accent, #fbbf24);
	}
</style>
