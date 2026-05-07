import { items, employees, professions, maps, PASSIVE_KEYS } from '$lib/database.js';

// Dropdown options
export const GAME_OPTIONS = {
	professions: Array.from(professions.values()),
	maps: Array.from(maps.values()),
	modes: ['Standard', 'Peaceful', 'Tough Start'],
	roundTimes: [100, 200, 300]
};

const QUOTA_MILESTONES = [
	0n,
	40n,
	80n,
	160n,
	320n,
	580n,
	900n,
	1500n,
	2200n,
	3000n,
	5000n,
	8000n,
	12000n,
	18000n,
	28000n,
	40000n,
	80000n,
	120000n,
	250000n,
	600000n,
	1000000n,
	1700000n,
	3000000n,
	6000000n,
	20000000n,
	50000000n,
	150000000n,
	400000000n,
	1200000000n,
	4000000000n,
	12000000000n
];

class GameState {
	cash = $state(0n);
	day = $state(1);
	professionId = $state('INTERNSHIP');
	map = $state(0);
	mode = $state('Standard');
	secondsPerRound = $state(300); // NEW: Default to 300s
	hiredEmployees = $state({});
	inventory = $state({});
	passives = $state(Object.fromEntries(PASSIVE_KEYS.map((key) => [key, 0.0])));

	// NEW: Tracks explicit shop availability overrides from the save file
	// (e.g., setting to 'false' once a player buys a bonus item)
	itemUnlockedStates = $state({});

	// NEW: System tracker for bonus effects
	bonus_equipment_manager = $state({
		auto_loot_chests: false,
		item_filter: false,
		current_vacuum: 0,
		shift_layers_up: 0
	});

	calculatorHiddenMaterials = $state([]);
	calculatorHiddenLayers = $state([]);

	get quota() {
		if (gameState.mode === 'Peaceful') return 0n;
		if (gameState.mode === 'Tough Start') {
			if (gameState.day < QUOTA_MILESTONES.length) {
				return QUOTA_MILESTONES[gameState.day] / 2n;
			} else {
				const dayMultiplier = BigInt(gameState.day);
				return (
					(QUOTA_MILESTONES[QUOTA_MILESTONES.length - 1] / 2n) *
					4n ** (dayMultiplier - BigInt(QUOTA_MILESTONES.length))
				);
			}
		} else if (gameState.day < QUOTA_MILESTONES.length) {
			return QUOTA_MILESTONES[gameState.day];
		} else {
			const dayMultiplier = BigInt(gameState.day);
			return (
				QUOTA_MILESTONES[QUOTA_MILESTONES.length - 1] *
				4n ** (dayMultiplier - BigInt(QUOTA_MILESTONES.length))
			);
		}
	}

	// Helper method for the UI to purchase items and lock them out of the shop
	buyBonusItem(itemID) {
		// Lock the item so it is removed from the shop
		this.itemUnlockedStates[itemID] = false;

		const itemObj = items.get(itemID);

		if (!itemObj) return;

		// Process systemic side-effects
		if (itemObj.itemType === 'auto_loot_chests') {
			this.bonus_equipment_manager.auto_loot_chests = true;
		} else if (itemObj.itemType === 'item_filter') {
			this.bonus_equipment_manager.item_filter = true;
		} else if (itemObj.itemType === 'BonusEffect') {
			if (itemID.startsWith('vacuum_cleaner_')) {
				this.bonus_equipment_manager.current_vacuum += 1;
			} else if (itemID.startsWith('shift_layers_')) {
				this.bonus_equipment_manager.shift_layers_up += 1;
			}
		}
	}

	loadSaveData(saveJson) {
		try {
			// 1. Cash & Day
			if (saveJson.Gvars?.CashCount !== undefined) {
				this.cash = BigInt(Math.floor(saveJson.Gvars.CashCount));
			}
			if (saveJson.Gvars?.dayCount !== undefined) {
				this.day = saveJson.Gvars.dayCount + 1;
			}
			if (saveJson.Gvars?.secondsPerRound !== undefined) {
				this.secondsPerRound = saveJson.Gvars.secondsPerRound;
			}

			// 2. Profession
			if (saveJson.Gvars?.profession !== undefined) {
				const enumValue = saveJson.Gvars.profession;
				// Search through the values of the Map for the matching enum
				const foundProf = Array.from(professions.values()).find(
					(p) => p.profession_enum_value === enumValue
				);

				if (foundProf) {
					this.professionId = foundProf.profession_id;
				} else {
					console.warn(`[Save Loader] Profession enum ${enumValue} not found in DB.`);
				}
			}

			// 3. Employees
			const newEmployees = {};
			if (saveJson.employee_manager_2?.employees) {
				const allEmployees = Array.from(employees.values());

				for (const [levelStr, count] of Object.entries(saveJson.employee_manager_2.employees)) {
					if (count > 0) {
						// Match the level_name from the map's values
						const foundEmp = allEmployees.find((e) => String(e.level_name) === String(levelStr));

						if (foundEmp) {
							newEmployees[foundEmp.employee_id] = BigInt(Math.floor(count));
						} else {
							console.warn(`[Save Loader] Employee level_name ${levelStr} not found in DB.`);
						}
					}
				}
			}
			this.hiredEmployees = newEmployees;

			// 4. Inventory
			const newInventory = {};
			if (saveJson.inventory?.items) {
				const allItems = Array.from(items.values());

				for (const slot of saveJson.inventory.items) {
					if (slot.itemPath && !slot.itemPath.includes('Empty.tres') && slot.count > 0) {
						// Match the itemPath from the map's values
						const foundItem = allItems.find((i) => i.itemPath === slot.itemPath);

						if (foundItem) {
							newInventory[foundItem.itemID] = Math.floor(slot.count);
						} else {
							console.warn(`[Save Loader] Item path ${slot.itemPath} not found in DB.`);
						}
					}
				}
			}
			this.inventory = newInventory;

			// 5. Passives
			if (saveJson.passives) {
				for (const [key, value] of Object.entries(saveJson.passives)) {
					// Only load passives that exist in the database
					if (PASSIVE_KEYS.includes(key)) {
						this.passives[key] = value;
					}
				}
			}

			// 6. Shop Availability / Unlocked States overrides
			const newUnlockedStates = {};
			if (saveJson.Resources?.Items) {
				const allItems = Array.from(items.values());
				// Resources.Items could be an array or object in Godot, handle safely
				const itemsList = Array.isArray(saveJson.Resources.Items)
					? saveJson.Resources.Items
					: Object.values(saveJson.Resources.Items);

				for (const slot of itemsList) {
					if (slot.itemUnlocked !== undefined) {
						// First try matching by itemID, fallback to itemPath
						let foundItem = null;
						if (slot.itemID) foundItem = allItems.find((i) => i.itemID === slot.itemID);
						if (!foundItem && slot.itemPath)
							foundItem = allItems.find((i) => i.itemPath === slot.itemPath);

						if (foundItem) {
							newUnlockedStates[foundItem.itemID] = slot.itemUnlocked;
						}
					}
				}
			}
			this.itemUnlockedStates = newUnlockedStates;

			// 7. Bonus Equipment Manager
			if (saveJson.bonus_equipment_manager) {
				this.bonus_equipment_manager.auto_loot_chests =
					!!saveJson.bonus_equipment_manager.auto_loot_chests;
				this.bonus_equipment_manager.item_filter = !!saveJson.bonus_equipment_manager.item_filter;
				this.bonus_equipment_manager.current_vacuum =
					saveJson.bonus_equipment_manager.current_vacuum || 0;
				this.bonus_equipment_manager.shift_layers_up =
					saveJson.bonus_equipment_manager.shift_layers_up || 0;
			} else {
				// Reset defaults if no data is found
				this.bonus_equipment_manager = {
					auto_loot_chests: false,
					item_filter: false,
					current_vacuum: 0,
					shift_layers_up: 0
				};
			}

			// 8. Level/map
			if (saveJson.Gvars?.level !== undefined) {
				const enumValue = saveJson.Gvars.level;
				// Search through the values of the Map for the matching enum
				const foundLevel = Array.from(maps.values()).find((p) => p.level === enumValue);

				if (foundLevel) {
					this.map = foundLevel.level;
				} else {
					console.warn(`[Save Loader] Level enum ${enumValue} not found in DB.`);
				}
			}

			return true; // Success
		} catch (error) {
			console.error('Failed to parse save data:', error);
			return false; // Failure
		}
	}

	calculatorLoadouts = $state([
		{ id: 1, name: 'Loadout 1', heldWeapon: null, independents: [], modifiers: [] }
	]);
	calculatorActiveLoadoutId = $state(1);
	calculatorLoadoutCounter = $state(1);
}

export const gameState = new GameState();
