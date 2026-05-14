<script>
	import { tiles } from '$lib/database.js';
	import { formatLargeNumber } from '$lib/utils.js';

	let materials = $derived.by(() => {
		const map = new Map();

		for (const t of tiles) {
			// Ignore clay as requested, and ensure it has a picture and a price
			if (t.resource === 'clay') continue;

			if (!map.has(t.resource) && t.pic_material_base64 && t.itemSellPrice !== undefined) {
				map.set(t.resource, {
					pic: t.pic_material_base64,
					price: Number(t.itemSellPrice)
				});
			}
		}

		return Array.from(map.values());
	});
</script>

<div class="theme-surface border theme-border rounded-xl p-5 flex flex-col h-full">
	<h2 class="font-bold text-lg mb-4 theme-text-accent">Market Prices</h2>

	<div class="flex-1 overflow-y-auto pr-2 space-y-1">
		{#each materials as mat}
			<div
				class="flex items-center justify-between p-2 rounded hover:bg-black/20 border border-transparent hover:theme-border transition-colors"
			>
				<div class="w-6 h-6 relative shrink-0">
					<img
						src={mat.pic}
						alt="resource"
						class="absolute inset-0 w-full h-full object-contain rendering-pixelated"
					/>
				</div>

				<div class="font-mono font-bold theme-text text-right grow">
					{formatLargeNumber(mat.price)}g
				</div>
			</div>
		{/each}

		{#if materials.length === 0}
			<div class="text-center py-4 text-xs theme-text-muted italic">No prices available.</div>
		{/if}
	</div>
</div>
