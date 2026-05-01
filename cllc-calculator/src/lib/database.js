import professionsRaw from '$lib/data/professions.json';
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
    } catch(e) {
      parsed.min_drop = 1n;
    }
  }
  if (parsed.max_drop) parsed.max_drop = BigInt(parsed.max_drop);
  parsed.probability = parseFloat(parsed.probability || 0);
  parsed.rarity = parseFloat(parsed.rarity || 0);
  
  return parsed;
}

// 1. FIXED PROFESSION KEY: Map using p.profession_id instead of p.name
export const professions = new Map(
  professionsRaw.map(p => [p.profession_id, parseBigInts(p)])
);

export const items = new Map(
  sortedItemsRaw.map(e => [e.itemID, parseBigInts(e)])
);

export const employees = new Map(
  employeesRaw.map(e => [e.employee_id, parseBigInts(e)])
);

export const tiles = tilesRaw;

export function getItemsForProfession(professionId) {
  const prof = professions.get(professionId);
  if (!prof) return [];
  
  const lockedTypes = new Set(prof.items_locked || []);
  const existingItems = new Set(itemOrderRaw || []);
  
  return Array.from(items.values()).filter(item => {
    // 1. Must be in the sorted order array
    if (!existingItems.has(item.itemID)) return false;
    
    // 2. Cannot be explicitly locked by Type!
    if (lockedTypes.has(item.itemType)) return false;
    
    return true;
  });
}

// 2. NEW LOGIC: Filter employees by looking up the active profession
export function getOrgChart(professionId) {
  const prof = professions.get(professionId);
  const lockedEmployees = new Set(prof?.locked_employees || []);

  // Filter out any employees that are locked for this specific profession
  const allEmployees = Array.from(employees.values()).filter(emp => !lockedEmployees.has(emp.employee_id));

  // Get a list of all valid level names that actually exist in the game (e.g., "0", "1")
  const validLevels = new Set(allEmployees.map(e => e.level_name));

  // Base employees are those whose upgrades_from points to a level that DOES NOT exist 
  // (Like the Intern pointing to "23")
  const baseEmployees = allEmployees.filter(emp => !validLevels.has(emp.upgrades_from));

  // Build the tree UPWARDS by finding employees that upgrade FROM the current level
  function findPromotions(currentLevelName) {
    const promotions = allEmployees.filter(e => e.upgrades_from === currentLevelName);
    if (promotions.length === 0) return null;

    return promotions.map(p => ({
      ...p,
      promotions: findPromotions(p.level_name)
    }));
  }

  // Return the base employees (Interns) with their promotion branches attached
  return baseEmployees.map(base => ({
    ...base,
    promotions: findPromotions(base.level_name)
  }));
}

// 3. NEW LOGIC: Passives getter for future use
export function getPassivesForProfession(professionId) {
  const prof = professions.get(professionId);
  if (!prof) return [];
  
  return prof.unlocked_passives || [];
}

