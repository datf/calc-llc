import professionsRaw from '$lib/data/professions.json';
/**
 * @typedef {Object} GameItem
 * @property {string} itemID - The unique identifier.
 * @property {string} itemName - The human-readable name.
 * @property {string} itemType - Category of the item (e.g., 'pickaxe', 'bomb').
 * @property {string} itemPath - Path used in the game engine mentioned in the save files.
 * @property {boolean|string} [itemUnlocked] - Whether it is unlocked by default.
 * @property {string} [picB64] - Base64 image string.
 * @property {bigint} [itemBuyPrice] - Cost to purchase (Parsed to BigInt).
 * @property {bigint} [itemSellPrice] - Value when sold (Parsed to BigInt).
 * @property {bigint} [Strength] - Used in pickaxe formulas.
 * @property {bigint} [damage] - Used in standard weapon formulas.
 * @property {bigint} [bullet_damage] - Used in gun formulas.
 * @property {number} [cooldown_time] - Attack speed.
 * @property {number} [cooldown_secs] - Magic speed.
 * @property {number} [bullet_count] - Number of projectiles.
 */
import itemsRaw from '$lib/data/items.json';
import itemOrderRaw from '$lib/data/items_sorted.json';
import employeesRaw from '$lib/data/employees.json';
import passivesRaw from '$lib/data/passives.json';
import tilesRaw from '$lib/data/tiles.json';

export const passivesInfo = passivesRaw.all_passives;
export const passiveMap = passivesRaw.passive_map;

export const PASSIVE_KEYS = Object.keys(passivesInfo);

const sortWeights = itemOrderRaw.reduce((acc, itemId, index) => {
	acc[itemId] = index;
	return acc;
}, {});

// Sort the raw JSON array using our sortWeights dictionary
const sortedItemsRaw = itemsRaw.sort((a, b) => {
	const indexA = sortWeights[a.itemID];
	const indexB = sortWeights[b.itemID];

	const weightA = indexA !== undefined ? indexA : 99999;
	const weightB = indexB !== undefined ? indexB : 99999;

	return weightA - weightB;
});

// Helper to convert nested string numbers into BigInts AND sanitize data
function parseBigInts(item) {
	const parsed = { ...item };

	// SAFETY FIX: Trim invisible whitespace from JSON IDs that causes missing branches!
	if (parsed.employee_id) parsed.employee_id = String(parsed.employee_id).trim();
	if (parsed.upgrades_from) parsed.upgrades_from = String(parsed.upgrades_from).trim();

	// Convert massive integers
	if (parsed.startingCash) parsed.startingCash = BigInt(parsed.startingCash);
	if (parsed.itemBuyPrice) parsed.itemBuyPrice = BigInt(parsed.itemBuyPrice);
	if (parsed.itemSellPrice) parsed.itemSellPrice = BigInt(parsed.itemSellPrice);
	if (parsed.missile_damage) parsed.missile_damage = BigInt(parsed.missile_damage);
	if (parsed.bullet_damage) parsed.bullet_damage = BigInt(parsed.bullet_damage);

	// Safely handle missing upgrade costs
	parsed.upgrade_cost = BigInt(parsed.upgrade_cost || 0);

	// Parse floats
	parsed.mining_speed = parseFloat(parsed.mining_speed || 0);
	parsed.bomb_rate = parseFloat(parsed.bomb_rate || 0);

	if (parsed.health) parsed.health = BigInt(parsed.health);
	// There's a bug in the calculation of moonstone_darkblue so we need to account for that...
	if (parsed.min_drop) {
		try {
			parsed.min_drop = BigInt(parsed.min_drop);
		} catch (e) {
			parsed.min_drop = 1n;
		}
	}
	if (parsed.max_drop) parsed.max_drop = BigInt(parsed.max_drop);
	parsed.probability = parseFloat(parsed.probability || 0);
	parsed.rarity = parseFloat(parsed.rarity || 0);

	return parsed;
}

// 1. FIXED PROFESSION KEY: Map using p.profession_id instead of p.name
export const professions = new Map(professionsRaw.map((p) => [p.profession_id, parseBigInts(p)]));

/** @type {Map<string, GameItem>} */
export const items = new Map(sortedItemsRaw.map((e) => [e.itemID, parseBigInts(e)]));

export const employees = new Map(employeesRaw.map((e) => [e.employee_id, parseBigInts(e)]));

export const tiles = tilesRaw;

export function getItemsForProfession(professionId) {
	const prof = professions.get(professionId);
	if (!prof) return [];

	const lockedTypes = new Set(prof.items_locked || []);
	const existingItems = new Set(itemOrderRaw || []);

	return Array.from(items.values()).filter((item) => {
		if (!existingItems.has(item.itemID)) return false;
		if (lockedTypes.has(item.itemType)) return false;
		return true;
	});
}

// New API: Returns bonus items that are unlocked and available for the secondary shop
export function getBonusShopItems(professionId) {
	const prof = professions.get(professionId);
	if (!prof) return [];

	const lockedTypes = new Set(prof.items_locked || []);
	const existingItems = new Set(itemOrderRaw || []);

	return Array.from(items.values()).filter((item) => {
		if (existingItems.has(item.itemID)) return false; // Ignore standard items
		if (lockedTypes.has(item.itemType)) return false; // Respect profession locks

		// Must be explicitly unlocked
		return item.itemUnlocked === true || item.itemUnlocked === 'true';
	});
}

// New API: Returns locked bonus items (quest rewards). Forces price to 0.
export function getQuestItems(professionId) {
	const prof = professions.get(professionId);
	if (!prof) return [];

	const lockedTypes = new Set(prof.items_locked || []);
	const existingItems = new Set(itemOrderRaw || []);

	return Array.from(items.values())
		.filter((item) => {
			if (existingItems.has(item.itemID)) return false; // Ignore standard items
			if (lockedTypes.has(item.itemType)) return false; // Respect profession locks

			// Must be locked
			return (
				item.itemUnlocked === false ||
				item.itemUnlocked === 'false' ||
				item.itemUnlocked === undefined
			);
		})
		.map((item) => ({
			...item,
			itemBuyPrice: 0n // Enforce 0 cost at the data layer to prevent UI mistakes
		}));
}

// --- EMPLOYEE & PASSIVE SELECTORS ---

// Extracted helper for org chart recursion
function findPromotions(currentLevelName, allEmployees) {
	const promotions = allEmployees.filter((e) => e.upgrades_from === currentLevelName);
	if (promotions.length === 0) return null;

	return promotions.map((p) => ({
		...p,
		promotions: findPromotions(p.level_name, allEmployees)
	}));
}

export function getOrgChart(professionId) {
	const prof = professions.get(professionId);
	const lockedEmployees = new Set(prof?.locked_employees || []);

	const allEmployees = Array.from(employees.values()).filter(
		(emp) => !lockedEmployees.has(emp.employee_id)
	);
	const validLevels = new Set(allEmployees.map((e) => e.level_name));

	// Base employees are those whose upgrades_from doesn't match any valid level_name
	const baseEmployees = allEmployees.filter((emp) => !validLevels.has(emp.upgrades_from));

	return baseEmployees.map((base) => ({
		...base,
		promotions: findPromotions(base.level_name, allEmployees)
	}));
}

// 3. NEW LOGIC: Passives getter for future use
export function getPassivesForProfession(professionId) {
	const prof = professions.get(professionId);
	if (!prof) return [];

	return prof.unlocked_passives || [];
}
