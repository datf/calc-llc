import { items, employees, professions, PASSIVE_KEYS } from '$lib/database.js'; 

// Dropdown options
export const GAME_OPTIONS = {
  professions: Array.from(professions.values()), 
  maps: ['Tutorial', 'Coal Mine'],
  modes: ['Standard', 'Peaceful', 'Tough Start'],
  roundTimes: [100, 200, 300]
};

const quota = [
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
	12000000000n,
];

class GameState {
  cash = $state(0n);
  day = $state(1);
  professionId = $state('INTERNSHIP'); 
  map = $state('Tutorial');
  mode = $state('Standard');
  secondsPerRound = $state(300); // NEW: Default to 300s
  hiredEmployees = $state({}); 
  inventory = $state({}); 
  passives = $state(
    Object.fromEntries(PASSIVE_KEYS.map(key => [key, 0.0]))
  );
  calculatorHiddenMaterials = $state([]);
  calculatorHiddenLayers = $state([]);
  
  get quota() {
    if (gameState.mode === 'Peaceful') return 0n;
    if (gameState.mode === 'Tough Start'){
      if (gameState.day < quota.length) {
        return quota[gameState.day] / 2n;
      }
      else {
        const dayMultiplier = BigInt(gameState.day);
        return (quota[quota.length - 1] / 2n) * (4n ** (dayMultiplier - BigInt(quota.length)));
      }
    }
    else if (gameState.day < quota.length) {
      return quota[gameState.day];
    }
    else {
      const dayMultiplier = BigInt(gameState.day);
      return quota[quota.length - 1] * (4n ** (dayMultiplier - BigInt(quota.length)));
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
        const foundProf = Array.from(professions.values()).find(p => p.profession_enum_value === enumValue);
        
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
            const foundEmp = allEmployees.find(e => String(e.level_name) === String(levelStr));
            
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
          if (slot.itemPath && !slot.itemPath.includes("Empty.tres") && slot.count > 0) {
            // Match the itemPath from the map's values
            const foundItem = allItems.find(i => i.itemPath === slot.itemPath);
            
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

      return true; // Success
    } catch (error) {
      console.error("Failed to parse save data:", error);
      return false; // Failure
    }
  }

  calculatorLoadouts = $state([
    { id: 1, name: "Loadout 1", heldWeapon: null, independents: [], modifiers: [] }
  ]);
  calculatorActiveLoadoutId = $state(1);
  calculatorLoadoutCounter = $state(1);

}

export const gameState = new GameState();
