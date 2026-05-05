import { calculateLoadoutDPS } from './calculator.js';

// --- CATEGORIZATION CONSTANTS ---
export const IGNORED_TYPES = [
	'mining_whistle',
	'ladder',
	'collector_whistle',
	'platform',
	'gravity_enhancer',
	'teleporter'
];
export const INDEPENDENT_TYPES = [
	'poison_gun',
	'bomb',
	'flamethrower',
	'drill',
	'mortar_gun',
	'roundhouse_kick',
	'jet'
];
export const MODIFIER_TYPES = ['water_gun', 'water_staff'];
export const NON_STACKABLE_TYPES = [
	'roundhouse_kick',
	'poison_gun',
	'poison_staff',
	'flamethrower',
	'jet',
	'water_gun',
	'water_staff'
];

// DPS Memoization Cache
const dpsCache = new Map();

export function formatEmployeeName(id) {
	if (!id) return 'Unknown';
	return id
		.split('_')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(' ');
}

/**
 * Calculates the DPS value for a single item/employee. Memoized for performance.
 */
export function getMemoizedItemDPS(id, isEmployee, items, employees, gameState) {
	if (dpsCache.has(id)) return dpsCache.get(id);

	let mockLoadout = { independents: [], modifiers: [], heldWeapon: null };

	if (isEmployee) {
		const emp = employees.get(id);
		if (emp) {
			mockLoadout.independents.push({
				type: 'employee',
				data: { ...emp, weapon_strength: Number(items.get(emp.equipment_itemID)?.Strength || 0) },
				activeCount: 1
			});
		}
	} else {
		const item = items.get(id);
		if (item && !IGNORED_TYPES.includes(item.itemType)) {
			const sourceData = { type: 'equipment', data: item, activeCount: 1 };
			if (MODIFIER_TYPES.includes(item.itemType) || item.itemType.includes('water')) {
				mockLoadout.modifiers.push(sourceData);
			} else if (INDEPENDENT_TYPES.includes(item.itemType)) {
				mockLoadout.independents.push(sourceData);
			} else {
				mockLoadout.heldWeapon = sourceData;
			}
		}
	}

	const dps = calculateLoadoutDPS(mockLoadout, gameState);
	dpsCache.set(id, dps);
	return dps;
}

/**
 * Core 0/1 Knapsack Algorithm. Computes the optimal items to buy/sell based on a strategy.
 * This is a pure function making it highly testable.
 */
export function calculateBestUpgrades(gameState, items, employees, upgradeStrategy) {
	let totalSellValue = 0;
	const inventoryItems = [];
	const shopItems = [];

	// 1. Calculate max capacity based on cash + sellable inventory
	for (const [id, count] of Object.entries(gameState.inventory)) {
		if (count > 0) {
			const item = items.get(id);
			if (item && item.itemSellPrice) {
				const sellPriceNum = Number(item.itemSellPrice);
				totalSellValue += sellPriceNum * Number(count);
				for (let i = 0; i < count; i++) {
					inventoryItems.push({
						...item,
						refId: id,
						weight: sellPriceNum,
						isOwned: true,
						isEmployee: false
					});
				}
			}
		}
	}

	// Active employees -> inventory representation
	for (const [id, count] of Object.entries(gameState.hiredEmployees)) {
		if (count > 0n || count > 0) {
			const emp = employees.get(id);
			if (emp && emp.price) {
				const sellValue = Math.floor(Number(emp.price) * 0.5);
				totalSellValue += sellValue * Number(count);
				for (let i = 0; i < Number(count); i++) {
					inventoryItems.push({
						...emp,
						name: formatEmployeeName(emp.employee_id),
						refId: id,
						weight: sellValue,
						isOwned: true,
						isEmployee: true
					});
				}
			}
		}
	}

	const maxCapacity = Math.floor(Number(gameState.cash || 0) + totalSellValue);

	// 2. Filter unaffordable shop items
	for (const [id, item] of items.entries()) {
		const buyPriceNum = Number(item.itemBuyPrice || Infinity);
		if (buyPriceNum <= maxCapacity && !IGNORED_TYPES.includes(item.itemType)) {
			shopItems.push({
				...item,
				refId: id,
				weight: buyPriceNum,
				isOwned: false,
				isEmployee: false
			});
		}
	}

	// Assign knapsack values based on the chosen strategy
	const candidates = [...shopItems, ...inventoryItems]
		.map((c) => {
			let value = 0;
			if (upgradeStrategy === 'MAX_DPS') {
				value = getMemoizedItemDPS(c.refId, c.isEmployee, items, employees, gameState);
			} else if (upgradeStrategy === 'COLLECTION') {
				value = c.isOwned ? 1 : 100;
			} else {
				value = Math.random() * 10; // Placeholder for Quests weighting
			}
			return { ...c, value };
		})
		.filter((c) => c.value > 0);

	// 3. 0/1 Knapsack Execution
	const scaleFactor = Math.max(1, Math.floor(maxCapacity / 50000));
	const W = Math.floor(maxCapacity / scaleFactor);

	const dp = new Float32Array(W + 1);
	const keep = Array.from({ length: candidates.length }, () => new Uint8Array(W + 1));

	for (let i = 0; i < candidates.length; i++) {
		const wt = Math.ceil(candidates[i].weight / scaleFactor);
		const val = candidates[i].value;
		if (wt <= 0) continue;

		for (let w = W; w >= wt; w--) {
			if (dp[w - wt] + val > dp[w]) {
				dp[w] = dp[w - wt] + val;
				keep[i][w] = 1;
			}
		}
	}

	// 4. Backtrack Optimal Path
	let remainingW = W;
	const optimalSelection = [];
	for (let i = candidates.length - 1; i >= 0; i--) {
		if (keep[i] && keep[i][remainingW] === 1) {
			optimalSelection.push(candidates[i]);
			remainingW -= Math.ceil(candidates[i].weight / scaleFactor);
		}
	}

	// 5. Structure the Actions (Buy / Sell / Keep)
	const toBuy = optimalSelection.filter((i) => !i.isOwned);
	const keptIds = [];
	optimalSelection.filter((i) => i.isOwned).forEach((i) => keptIds.push(i.refId));

	let tempInv = [...inventoryItems];
	keptIds.forEach((kId) => {
		const idx = tempInv.findIndex((t) => t.refId === kId);
		if (idx !== -1) tempInv.splice(idx, 1);
	});
	const toSell = tempInv;

	const groupItems = (arr, isBuy) => {
		const map = new Map();
		arr.forEach((i) => {
			const key = i.refId;
			const price = isBuy ? Number(i.itemBuyPrice || 0) : i.weight;
			if (map.has(key)) {
				const entry = map.get(key);
				entry.qty++;
				entry.total += price;
			} else {
				map.set(key, {
					name: i.itemName || i.name,
					qty: 1,
					total: price,
					pics: [i.picB64 || i.head_texture_base64]
				});
			}
		});
		return Array.from(map.values());
	};

	const topResults = [
		{
			id: 1,
			projectedValue: dp[W],
			buy: {
				items: groupItems(toBuy, true),
				totalSpent: toBuy.reduce((sum, i) => sum + Number(i.itemBuyPrice || 0), 0)
			},
			sell: {
				items: groupItems(toSell, false),
				totalEarned: toSell.reduce((sum, i) => sum + i.weight, 0)
			},
			quests: upgradeStrategy === 'QUESTS' ? ["Complete 'The Deep Dig' for +500g"] : []
		}
	];

	// Mock options 2 and 3
	topResults.push({
		...topResults[0],
		id: 2,
		projectedValue: dp[W] * 0.9,
		buy: { items: [], totalSpent: 0 }
	});
	topResults.push({
		...topResults[0],
		id: 3,
		projectedValue: dp[W] * 0.75,
		sell: { items: [], totalEarned: 0 }
	});

	return topResults;
}
