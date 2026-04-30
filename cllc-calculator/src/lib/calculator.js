// $lib/calculator.js
import { DPS_FORMULAS, STATUS_APPLIERS } from './formulas.js';
import * as math from 'mathjs'; 

export function calculateLoadoutDPS(loadout, gameState) {
  let totalDPS = 0;

  // 1. Gather all active sources in this loadout
  const activeSources = [...loadout.independents, ...loadout.modifiers];
  if (loadout.heldWeapon) activeSources.push(loadout.heldWeapon);

  if (activeSources.length === 0) return 0;

  // 2. Analyze Global Statuses (Is the block wet? Poisoned?)
  let isWet = false;

  for (const source of activeSources) {
    const type = source.data.itemType || source.data.type; // Check itemType or employee type
    if (STATUS_APPLIERS.wet.includes(type)) {
      isWet = true;
      break;
    }
  }

  // 3. Build Global Scope (Passives)
  // We use `|| 0` to ensure missing passives default to 0 in the math evaluator
  const globalScope = {
    p_bomb_damage: gameState.passives.bomb_damage || 0,
    p_bullet_damage: gameState.passives.bullet_damage || 0,
    p_kick_damage: gameState.passives.kick_damage || 0,
    p_kick_speed: gameState.passives.kick_speed || 0,
    p_punch_damage: gameState.passives.punch_damage || 0,
    p_airstrike_damage: gameState.passives.airstrike_damage || 0,
    p_airstrike_rate: gameState.passives.airstrike_rate || 0,
    p_orb_damage: gameState.passives.orb_damage || 0,
    p_axe_damage: gameState.passives.axe_damage || 0,
    p_drill_damage: gameState.passives.drill_damage || 0,
    p_fire_damage: gameState.passives.fire_damage || 0,
    p_mortar_gun_damage: gameState.passives.mortar_gun_damage || 0,
    p_mortar_gun_rate: gameState.passives.mortar_gun_rate || 0,
    p_player_pickaxe_mining_damage: gameState.passives.player_pickaxe_mining_damage || 0,
    p_player_pickaxe_mining_speed: gameState.passives.player_pickaxe_mining_speed || 0,
    p_employee_miner_damage: gameState.passives.employee_miner_damage || 0,
    p_magic_missiles_damage: gameState.passives.magic_missiles_damage || 0,
    p_poison_damage: gameState.passives.poison_damage || 0,
    p_wet_damage: gameState.passives.wet_damage || 0
  };

  // 4. Aggregate DPS from all sources
  for (const source of activeSources) {
    let archetype = 'default';
    
    if (source.type === 'equipment') {
      archetype = source.data.itemType;
    } else if (source.type === 'employee') {
      // Check if this employee has AoE damage configured
      if (Number(source.data.aoe_damage) > 0) {
        archetype = 'employee_miner_aoe';
      } else {
        archetype = 'employee_miner';
      }
    }
    
    const formulaString = DPS_FORMULAS[archetype] || DPS_FORMULAS['default'];

    // Combine global passives with this specific item's stats
    const localScope = {
      ...globalScope,
      ...source.data // Injects bullet_count, cooldown_time, etc. into the math parser
    };

    try {
      // Evaluate the base formula
      let sourceDPS = math.evaluate(formulaString, localScope);

      // Apply Global Status Multipliers to this source's damage
      if (isWet) {
        // Wet blocks take 2x damage, multiplied by the wet_damage passive
        sourceDPS = sourceDPS * (2 * (1 + localScope.p_wet_damage));
      }

      // Multiply the DPS by the amount of this item the user has active
      const count = source.activeCount || 1;
      totalDPS += (sourceDPS * count);
      
    } catch (err) {
      console.error(`[Calculator Engine] Failed to evaluate ${source.name} using formula: ${formulaString}`, err);
    }
  }

  return totalDPS;
}

