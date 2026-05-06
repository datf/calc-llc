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
export const CONSUMABLE_TYPES = ['bomb', 'nuke', 'earthquake']; // Items that deal burst damage and are consumed

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
export function getMemoizedItemDPS(
	id,
	isEmployee,
	items,
	employees,
	gameState,
	baseWeaponId = null
) {
	const cacheKey = id + (baseWeaponId ? `_base_${baseWeaponId}` : '');
	if (dpsCache.has(cacheKey)) return dpsCache.get(cacheKey);

	/** @type {{ independents: any[], modifiers: any[], heldWeapon: any }} */
	let mockLoadout = { independents: [], modifiers: [], heldWeapon: null };

	if (baseWeaponId) {
		const baseItem = items.get(baseWeaponId);
		if (baseItem) {
			const sourceData = { type: 'equipment', data: baseItem, activeCount: 1 };
			if (INDEPENDENT_TYPES.includes(baseItem.itemType)) {
				mockLoadout.independents.push(sourceData);
			} else {
				mockLoadout.heldWeapon = sourceData;
			}
		}
	}

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
	dpsCache.clear();
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

	// 2.5 Find Best Affordable Base Weapon (Pass 1 - For Modifier Evaluation)
	let bestBaseWeaponItem = null;
	let highestWeaponDPS = 0;

	for (const item of [...shopItems, ...inventoryItems]) {
		const itemTypeStr = item.itemType || '';

		// Allow held weapons AND independent weapons (like poison_gun) to be the baseline
		const isBaseWeapon =
			!item.isEmployee &&
			!MODIFIER_TYPES.includes(itemTypeStr) &&
			!itemTypeStr.includes('water') &&
			!CONSUMABLE_TYPES.includes(itemTypeStr);

		if (isBaseWeapon) {
			const dps = getMemoizedItemDPS(item.refId, false, items, employees, gameState);
			if (dps > highestWeaponDPS) {
				highestWeaponDPS = dps;
				bestBaseWeaponItem = item;
			}
		}
	}

	// 3. Calculate Values and Densities
	const roundDuration = Number(gameState.secondsPerRound || 300);

	const candidates = [...shopItems, ...inventoryItems]
		.map((c) => {
			let value = 0;
			let sortingWeight = 0;

			if (upgradeStrategy === 'MAX_DPS') {
				const isModifier =
					MODIFIER_TYPES.includes(c.itemType) || (c.itemType && c.itemType.includes('water'));
				let rawDpsOrDamage = 0;

				if (isModifier && bestBaseWeaponItem) {
					const comboDps = getMemoizedItemDPS(
						c.refId,
						c.isEmployee,
						items,
						employees,
						gameState,
						bestBaseWeaponItem.refId
					);
					rawDpsOrDamage = Math.max(0, comboDps - highestWeaponDPS);
				} else {
					rawDpsOrDamage = getMemoizedItemDPS(c.refId, c.isEmployee, items, employees, gameState);
				}

				const SIGNIFICANCE_THRESHOLD = 0.15; // 15%

				const isAutonomous = c.isEmployee;

				if (!isAutonomous) {
					if (rawDpsOrDamage < highestWeaponDPS * SIGNIFICANCE_THRESHOLD) {
						rawDpsOrDamage = 0;
					}
				}
				value = rawDpsOrDamage;

				const isConsumable = !c.isEmployee && CONSUMABLE_TYPES.includes(c.itemType);
				sortingWeight = isConsumable ? rawDpsOrDamage : rawDpsOrDamage * roundDuration;
			} else if (upgradeStrategy === 'COLLECTION') {
				value = c.isOwned ? 1 : 100;
				sortingWeight = value;
			} else {
				value = Math.random() * 10;
				sortingWeight = value;
			}

			const priceAsNumber = Number(c.price);

			// If we already own the item, don't penalize its density by its sell price.
			// Give owned items massive density so they aren't downgraded pointlessly
			// This prevents "downgrading" to a cheaper shop item with identical DPS just for pocket change.
			const densityPrice = c.isOwned ? 0 : priceAsNumber;

			const density = densityPrice > 0 ? sortingWeight / densityPrice : sortingWeight * 999999999;

			return { ...c, value, density, sortingWeight };
		})
		.filter((c) => c.value > 0 || c.isOwned)
		.sort((a, b) => {
			const aIsMod =
				MODIFIER_TYPES.includes(a.itemType) || (a.itemType && a.itemType.includes('water'));
			const bIsMod =
				MODIFIER_TYPES.includes(b.itemType) || (b.itemType && b.itemType.includes('water'));

			if (a.sortingWeight === b.sortingWeight) {
				if (aIsMod && !bIsMod) return 1;
				if (!aIsMod && bIsMod) return -1;
			}

			return b.sortingWeight - a.sortingWeight || b.density - a.density;
		});

	// 4. Greedy Selection (Buy top items until out of money)
	let remainingBudget = maxCapacity;
	const optimalSelection = [];
	let totalDPS = 0;

	let hasHeldWeapon = false;
	let hasPoison = false;
	let hasFire = false;
	let hasJet = false;
	let hasKick = false;
	let hasWater = false;

	for (const item of candidates) {
		if (item.price > remainingBudget) continue;

		const itemTypeStr = item.itemType || '';
		const isHeldWeapon =
			!item.isEmployee &&
			!INDEPENDENT_TYPES.includes(itemTypeStr) &&
			!MODIFIER_TYPES.includes(itemTypeStr) &&
			!itemTypeStr.includes('water') &&
			!CONSUMABLE_TYPES.includes(itemTypeStr) &&
			!IGNORED_TYPES.includes(itemTypeStr);

		// Identify if this item fills an exclusive action/effect slot
		const isPoison = itemTypeStr.includes('poison');
		const isFire = itemTypeStr.includes('flame') || itemTypeStr.includes('fire');
		const isJet = itemTypeStr.includes('jet');
		const isKick = itemTypeStr.includes('kick'); // catches 'roundhouse_kick'
		const isWater = itemTypeStr.includes('water') || MODIFIER_TYPES.includes(itemTypeStr);

		// If we already filled this slot with a stronger item, skip!
		if (isHeldWeapon && hasHeldWeapon) continue;
		if (isPoison && hasPoison) continue;
		if (isFire && hasFire) continue;
		if (isJet && hasJet) continue;
		if (isKick && hasKick) continue;
		if (isWater && hasWater) continue;

		if (item.isOwned) {
			optimalSelection.push({ ...item, qty: 1 });
			remainingBudget -= item.price;
			totalDPS += item.value;

			// Mark slots as filled
			if (isHeldWeapon) hasHeldWeapon = true;
			if (isPoison) hasPoison = true;
			if (isFire) hasFire = true;
			if (isJet) hasJet = true;
			if (isKick) hasKick = true;
			if (isWater) hasWater = true;
		} else {
			// Calculate quantity
			const isStackable = !NON_STACKABLE_TYPES.includes(itemTypeStr) && !isHeldWeapon;

			const maxAffordable = remainingBudget / item.price;
			const qtyToBuy = isStackable ? Number(maxAffordable) : 1;

			if (qtyToBuy > 0) {
				optimalSelection.push({ ...item, qty: qtyToBuy });
				const totalCost = item.price * BigInt(qtyToBuy);
				remainingBudget -= totalCost;
				totalDPS += item.value * qtyToBuy;

				// Mark slots as filled
				if (isHeldWeapon) hasHeldWeapon = true;
				if (isPoison) hasPoison = true;
				if (isFire) hasFire = true;
				if (isJet) hasJet = true;
				if (isKick) hasKick = true;
				if (isWater) hasWater = true;
			}
		}
	}

	// 5. Structure the Actions (Buy / Sell / Keep)
	const toBuy = optimalSelection.filter((i) => !i.isOwned);

	// FIX: Multiply price by the calculated quantity for totalSpent
	const totalSpent = toBuy.reduce((sum, i) => sum + i.price * BigInt(i.qty || 1), 0n);

	const keptIds = new Set();
	optimalSelection.filter((i) => i.isOwned).forEach((i) => keptIds.add(i.refId));

	let tempInv = [...inventoryItems];
	const toSell = tempInv.filter((t) => !keptIds.has(t.refId));

	const totalEarned = toSell.reduce((sum, i) => sum + i.price, 0n); // toSell objects are always qty:1 from Step 1

	// Update groupItems
	const groupItems = (arr) => {
		const map = new Map();
		arr.forEach((i) => {
			const qty = i.qty || 1;
			if (map.has(i.refId)) {
				const entry = map.get(i.refId);
				entry.qty += qty;
				entry.total += i.price * BigInt(qty);
			} else {
				map.set(i.refId, {
					name: i.itemName || i.name,
					qty: qty,
					total: i.price * BigInt(qty),
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
				totalSpent: totalSpent // Use the fixed sum
			},
			sell: {
				items: groupItems(toSell),
				totalEarned: totalEarned
			},
			quests: []
		}
	];

	return topResults;
}
