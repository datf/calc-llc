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

export function calculateBestUpgrades(gameState, items, employees, upgradeStrategy) {
	const inventoryItems = [];
	const shopItems = [];
	let totalSellValue = 0n; // Use BigInt explicitly

	// 1. Calculate Sellable Inventory
	for (const [id, count] of Object.entries(gameState.inventory)) {
		if (count > 0) {
			const item = items.get(id);
			if (item && item.itemSellPrice) {
				const sellPrice = BigInt(item.itemSellPrice);
				totalSellValue += sellPrice * BigInt(count);
				for (let i = 0; i < count; i++) {
					inventoryItems.push({
						...item,
						refId: id,
						price: sellPrice,
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
				// Example logic: sell price is half of buy price
				const sellValue = BigInt(emp.price) / 2n;
				totalSellValue += sellValue * BigInt(count);
				for (let i = 0; i < Number(count); i++) {
					inventoryItems.push({
						...emp,
						name: formatEmployeeName(emp.employee_id),
						refId: id,
						price: sellValue,
						isOwned: true,
						isEmployee: true
					});
				}
			}
		}
	}

	const maxCapacity = BigInt(gameState.cash || 0) + totalSellValue;

	// 2. Filter unaffordable shop items
	for (const [id, item] of items.entries()) {
		if (item.itemBuyPrice) {
			const buyPrice = BigInt(item.itemBuyPrice);
			if (buyPrice <= maxCapacity && !IGNORED_TYPES.includes(item.itemType)) {
				shopItems.push({ ...item, refId: id, price: buyPrice, isOwned: false, isEmployee: false });
			}
		}
	}

	// 3. Calculate Values and Densities
	const candidates = [...shopItems, ...inventoryItems]
		.map((c) => {
			let value = 0;
			if (upgradeStrategy === 'MAX_DPS') {
				value = getMemoizedItemDPS(c.refId, c.isEmployee, items, employees, gameState);
			} else if (upgradeStrategy === 'COLLECTION') {
				value = c.isOwned ? 1 : 100;
			} else {
				value = Math.random() * 10;
			}

			// Value Density = DPS / Price.
			// We convert the BigInt price to Number temporarily JUST for the ratio.
			// Even if price is 1e60, the ratio will just be a very small float, which is fine for sorting.
			const priceAsNumber = Number(c.price);
			const density = priceAsNumber > 0 ? value / priceAsNumber : value;

			return { ...c, value, density };
		})
		.filter((c) => c.value > 0);

	// Sort by density (highest DPS per gold first)
	candidates.sort((a, b) => b.density - a.density);

	// 4. Greedy Selection (Buy top items until out of money)
	let remainingBudget = maxCapacity;
	const optimalSelection = [];
	let totalDPS = 0;

	for (const item of candidates) {
		if (item.price <= remainingBudget) {
			optimalSelection.push(item);
			remainingBudget -= item.price;
			totalDPS += item.value;
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
	const toSell = tempInv; // What wasn't kept is sold

	const groupItems = (arr) => {
		const map = new Map();
		arr.forEach((i) => {
			if (map.has(i.refId)) {
				const entry = map.get(i.refId);
				entry.qty++;
				entry.total += i.price;
			} else {
				map.set(i.refId, {
					name: i.itemName || i.name,
					qty: 1,
					total: i.price,
					pics: [i.picB64 || i.head_texture_base64]
				});
			}
		});
		return Array.from(map.values());
	};

	const topResults = [
		{
			id: 1,
			projectedValue: totalDPS,
			buy: {
				items: groupItems(toBuy),
				totalSpent: toBuy.reduce((sum, i) => sum + i.price, 0n)
			},
			sell: {
				items: groupItems(toSell),
				totalEarned: toSell.reduce((sum, i) => sum + i.price, 0n)
			},
			quests: []
		}
	];

	return topResults;
}
