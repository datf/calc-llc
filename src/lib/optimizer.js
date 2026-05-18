/** @typedef {import('./calculator/state.svelte.js').Loadout} Loadout */
/** @typedef {import('./calculator/state.svelte.js').LoadoutSource} LoadoutSource */
import { calculateLoadoutDPS, CONSUMABLE_TYPES } from './calculator.js';
import { items as ALL_ITEMS } from './database.js';

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
 * Flattens the hierarchical employee tree (promotions) into a single Map,
 * calculating the cumulative cost top-down for each tier.
 */
function flattenEmployeeTree(baseEmployeesMap) {
	const flatMap = new Map();

	function traverse(emp, accumulatedCost) {
		if (!emp || !emp.employee_id) return;

		const cost = BigInt(emp.upgrade_cost || emp.price || 0);
		const totalCumulative = accumulatedCost + cost;

		flatMap.set(emp.employee_id, {
			...emp,
			_cumulativeCost: totalCumulative
		});

		if (emp.promotions && Array.isArray(emp.promotions)) {
			for (const child of emp.promotions) {
				traverse(child, totalCumulative);
			}
		}
	}

	for (const emp of baseEmployeesMap.values()) {
		traverse(emp, 0n);
	}

	return flatMap;
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

	// Ensure mockLoadout matches the Loadout type structure
	/** @type {Loadout} */
	let mockLoadout = {
		id: 999,
		name: 'Mock',
		independents: /** @type {LoadoutSource[]} */ ([]),
		modifiers: /** @type {LoadoutSource[]} */ ([]),
		heldWeapon: null
	};

	if (baseWeaponId) {
		const baseItem = items.get(baseWeaponId);
		if (baseItem) {
			/** @type {LoadoutSource} */
			const sourceData = {
				id: `item_${baseWeaponId}`,
				name: baseItem.itemName || baseWeaponId,
				type: 'equipment',
				data: baseItem,
				pics: [baseItem.picB64 || ''],
				activeCount: 1,
				isStackable: !NON_STACKABLE_TYPES.includes(baseItem.itemType),
				maxCount: 1,
				ownedCount: 1
			};

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
			/** @type {LoadoutSource} */
			const empSource = {
				id: `emp_${id}`,
				name: formatEmployeeName(emp.employee_id),
				type: 'employee',
				data: {
					...emp,
					weapon_strength: Number(ALL_ITEMS.get(emp.equipment_itemID)?.Strength || 0)
				},
				pics: [], // Assuming mock evaluation doesn't need pics
				activeCount: 1,
				isStackable: true,
				maxCount: 1,
				ownedCount: 1
			};
			mockLoadout.independents.push(empSource);
		}
	} else {
		const item = items.get(id);
		if (item && !IGNORED_TYPES.includes(item.itemType)) {
			/** @type {LoadoutSource} */
			const sourceData = {
				id: `item_${id}`,
				name: item.itemName || id,
				type: 'equipment',
				data: item,
				pics: [item.picB64 || ''],
				activeCount: 1,
				isStackable: !NON_STACKABLE_TYPES.includes(item.itemType),
				maxCount: 1,
				ownedCount: 1
			};

			if (MODIFIER_TYPES.includes(item.itemType) || item.itemType.includes('water')) {
				mockLoadout.modifiers.push(sourceData);
			} else if (INDEPENDENT_TYPES.includes(item.itemType)) {
				mockLoadout.independents.push(sourceData);
			} else {
				mockLoadout.heldWeapon = sourceData;
			}
		}
	}

	const dps = calculateLoadoutDPS(mockLoadout, gameState, true);
	dpsCache.set(cacheKey, dps);
	return dps;
}

export function calculateBestUpgrades(gameState, items, baseEmployeesMap, upgradeStrategy) {
	dpsCache.clear();

	const allEmployees = flattenEmployeeTree(baseEmployeesMap);

	const inventoryItems = [];
	const shopItems = [];
	let totalSellValue = 0n;

	// 1. Calculate Sellable Inventory (Equipment)
	for (const [id, count] of Object.entries(gameState.inventory)) {
		const safeCount = Number(String(count).replace('n', ''));

		if (safeCount > 0) {
			const item = items.get(id);
			if (item && item.itemSellPrice) {
				const sellPrice = BigInt(item.itemSellPrice);
				totalSellValue += sellPrice * BigInt(safeCount);

				inventoryItems.push({
					...item,
					refId: id,
					price: sellPrice,
					qty: safeCount,
					isOwned: true,
					isEmployee: false
				});
			}
		}
	}

	// 1.5 Calculate Sellable Inventory (Employees)
	for (const [id, count] of Object.entries(gameState.hiredEmployees)) {
		const safeCount = Number(String(count).replace('n', ''));

		if (safeCount > 0) {
			const emp = allEmployees.get(id);
			if (emp) {
				const costForSell = BigInt(emp.upgrade_cost || emp.price || 0);
				const sellValue = costForSell / 2n;

				totalSellValue += sellValue * BigInt(safeCount);

				inventoryItems.push({
					...emp,
					name: formatEmployeeName(emp.employee_id),
					refId: id,
					price: sellValue,
					qty: safeCount,
					isOwned: true,
					isEmployee: true
				});
			}
		}
	}

	const maxCapacity = BigInt(gameState.cash || 0) + totalSellValue;

	// 2. Filter unaffordable shop items (Equipment)
	for (const [id, item] of items.entries()) {
		if (item.itemBuyPrice) {
			const buyPrice = BigInt(item.itemBuyPrice);
			if (buyPrice <= maxCapacity && !IGNORED_TYPES.includes(item.itemType)) {
				shopItems.push({ ...item, refId: id, price: buyPrice, isOwned: false, isEmployee: false });
			}
		}
	}

	// 2.5 Filter unaffordable shop items (Employees)
	for (const [id, emp] of allEmployees.entries()) {
		if (emp.type === '0') {
			const cumulativeBuyPrice = emp._cumulativeCost;

			if (cumulativeBuyPrice > 0n && cumulativeBuyPrice <= maxCapacity) {
				shopItems.push({
					...emp,
					name: formatEmployeeName(emp.employee_id),
					refId: id,
					price: cumulativeBuyPrice,
					isOwned: false,
					isEmployee: true
				});
			}
		}
	}

	// 3. Find Best Affordable Base Weapon (For Modifier Evaluation)
	let bestBaseWeaponItem = null;
	let highestWeaponDPS = 0;

	for (const item of [...shopItems, ...inventoryItems]) {
		const itemTypeStr = item.itemType || '';
		const isBaseWeapon =
			!item.isEmployee &&
			!MODIFIER_TYPES.includes(itemTypeStr) &&
			!itemTypeStr.includes('water') &&
			!CONSUMABLE_TYPES.includes(itemTypeStr);

		if (isBaseWeapon) {
			const dps = getMemoizedItemDPS(item.refId, false, items, allEmployees, gameState);
			if (dps > highestWeaponDPS) {
				highestWeaponDPS = dps;
				bestBaseWeaponItem = item;
			}
		}
	}

	// 4. Calculate Values and Densities
	const roundDuration = Number(gameState.secondsPerRound || 300);

	const candidates = [...shopItems, ...inventoryItems]
		.map((c) => {
			let value = 0;
			let sortingWeight = 0;
			const priceAsNumber = Number(c.price);

			const itemTypeStr = c.itemType || '';
			const isHeldWeapon =
				!c.isEmployee &&
				!INDEPENDENT_TYPES.includes(itemTypeStr) &&
				!MODIFIER_TYPES.includes(itemTypeStr) &&
				!itemTypeStr.includes('water') &&
				!CONSUMABLE_TYPES.includes(itemTypeStr) &&
				!IGNORED_TYPES.includes(itemTypeStr);

			// CORRECT STACKABILITY: Weapons are NEVER stackable!
			const isStackable =
				c.isEmployee || (!NON_STACKABLE_TYPES.includes(itemTypeStr) && !isHeldWeapon);

			const canAfford =
				isStackable && priceAsNumber > 0 ? Math.floor(Number(maxCapacity) / priceAsNumber) : 0;
			const maxAffordable = c.isOwned
				? c.qty + canAfford || 1
				: isStackable && priceAsNumber > 0
					? Math.floor(Number(maxCapacity) / priceAsNumber)
					: 1;

			if (upgradeStrategy === 'MAX_DPS') {
				const isModifier = MODIFIER_TYPES.includes(itemTypeStr) || itemTypeStr.includes('water');
				let rawDpsOrDamage = 0;

				if (isModifier && bestBaseWeaponItem) {
					const comboDps = getMemoizedItemDPS(
						c.refId,
						c.isEmployee,
						items,
						allEmployees,
						gameState,
						bestBaseWeaponItem.refId
					);
					rawDpsOrDamage = Math.max(0, comboDps - highestWeaponDPS);
				} else {
					rawDpsOrDamage = getMemoizedItemDPS(
						c.refId,
						c.isEmployee,
						items,
						allEmployees,
						gameState
					);
				}

				// Measure the DPS potential of the ENTIRE stack
				let potentialBulkDps = rawDpsOrDamage * maxAffordable;

				const SIGNIFICANCE_THRESHOLD = 0.25;

				if (potentialBulkDps < highestWeaponDPS * SIGNIFICANCE_THRESHOLD) {
					rawDpsOrDamage = 0;
				}
				value = rawDpsOrDamage;

				const isConsumable = !c.isEmployee && CONSUMABLE_TYPES.includes(itemTypeStr);
				sortingWeight = isConsumable ? rawDpsOrDamage : rawDpsOrDamage * roundDuration;
			} else if (upgradeStrategy === 'COLLECTION') {
				value = c.isOwned ? 1 : 100;
				sortingWeight = value;
			} else {
				value = Math.random() * 10;
				sortingWeight = value;
			}

			// PURE BULK SORTING WEIGHT: Prioritizes max affordable DPS to solve 0-1 Knapsack
			const potentialBulkWeight = sortingWeight * maxAffordable;
			const densityPrice = c.isOwned ? 0 : priceAsNumber;
			const density = densityPrice > 0 ? sortingWeight / densityPrice : sortingWeight * 999999999;

			return { ...c, value, density, sortingWeight, potentialBulkWeight };
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

			// Sort by Maximum Affordable DPS First, fallback to pure density
			return b.potentialBulkWeight - a.potentialBulkWeight || b.density - a.density;
		});

	// 5. Strict Ledger Greedy Selection
	const optimalSelection = [];
	let totalDPS = 0;
	let currentLedgerCash = BigInt(gameState.cash || 0);
	const ownedCandidates = candidates.filter((c) => c.isOwned);

	for (const owned of ownedCandidates) {
		currentLedgerCash += BigInt(owned.price) * BigInt(owned.qty || 1);
	}

	let hasHeldWeapon = false;
	let hasPoison = false;
	let hasFire = false;
	let hasJet = false;
	let hasKick = false;
	let hasWater = false;

	for (const item of candidates) {
		const priceNum = Number(item.price);

		if (item.price > currentLedgerCash) continue;

		const itemTypeStr = item.itemType || '';
		const isHeldWeapon =
			!item.isEmployee &&
			!INDEPENDENT_TYPES.includes(itemTypeStr) &&
			!MODIFIER_TYPES.includes(itemTypeStr) &&
			!itemTypeStr.includes('water') &&
			!CONSUMABLE_TYPES.includes(itemTypeStr) &&
			!IGNORED_TYPES.includes(itemTypeStr);

		const isPoison = !item.isEmployee && itemTypeStr.includes('poison');
		const isFire =
			!item.isEmployee && (itemTypeStr.includes('flame') || itemTypeStr.includes('fire'));
		const isJet = !item.isEmployee && itemTypeStr.includes('jet');
		const isKick = !item.isEmployee && itemTypeStr.includes('kick');
		const isWater =
			!item.isEmployee && (itemTypeStr.includes('water') || MODIFIER_TYPES.includes(itemTypeStr));

		let slotName = null;
		if (!item.isEmployee) {
			if (isHeldWeapon) slotName = 'held';
			else if (isPoison) slotName = 'poison';
			else if (isFire) slotName = 'fire';
			else if (isJet) slotName = 'jet';
			else if (isKick) slotName = 'kick';
			else if (isWater) slotName = 'water';
		}

		if (slotName) {
			if (slotName === 'held' && hasHeldWeapon) continue;
			if (slotName === 'poison' && hasPoison) continue;
			if (slotName === 'fire' && hasFire) continue;
			if (slotName === 'jet' && hasJet) continue;
			if (slotName === 'kick' && hasKick) continue;
			if (slotName === 'water' && hasWater) continue;
		}

		const isStackable =
			(!NON_STACKABLE_TYPES.includes(itemTypeStr) && !isHeldWeapon) || item.isEmployee;
		const maxAffordable =
			priceNum > 0 ? Math.floor(Number(currentLedgerCash) / priceNum) : item.isOwned ? item.qty : 1;

		let qtyToProcess = item.isOwned
			? Math.min(item.qty || 1, maxAffordable)
			: isStackable
				? maxAffordable
				: 1;

		if (qtyToProcess > 0) {
			if (!item.isOwned) {
				const projectedAddedDps = item.value * qtyToProcess;
				if (projectedAddedDps < highestWeaponDPS * 0.05) {
					continue;
				}
			}

			optimalSelection.push({ ...item, qty: qtyToProcess });

			const totalCost = item.price * BigInt(qtyToProcess);
			currentLedgerCash -= totalCost;

			totalDPS += item.value * qtyToProcess;

			if (slotName === 'held') hasHeldWeapon = true;
			if (slotName === 'poison') hasPoison = true;
			if (slotName === 'fire') hasFire = true;
			if (slotName === 'jet') hasJet = true;
			if (slotName === 'kick') hasKick = true;
			if (slotName === 'water') hasWater = true;
		}
	}

	// 6. Structure the Actions
	const toBuy = optimalSelection.filter((i) => !i.isOwned);
	const totalSpent = toBuy.reduce((sum, i) => sum + i.price * BigInt(i.qty || 1), 0n);

	const toSell = [];
	for (const inv of inventoryItems) {
		const kept = optimalSelection.find(
			(i) => i.isOwned && i.refId === inv.refId && i.isEmployee === inv.isEmployee
		);
		const keptQty = kept ? kept.qty || 1 : 0;

		const sellQty = inv.qty - keptQty;

		if (sellQty > 0) {
			toSell.push({ ...inv, qty: sellQty });
		}
	}

	const totalEarned = toSell.reduce((sum, i) => sum + i.price * BigInt(i.qty || 1), 0n);

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

	return [
		{
			id: 1,
			projectedValue: totalDPS,
			buy: { items: groupItems(toBuy), totalSpent: totalSpent },
			sell: { items: groupItems(toSell), totalEarned: totalEarned },
			quests: []
		}
	];
}
