// $lib/formulas.js

// Make sure these formula variables EXACTLY match the keys in your item JSONs!
// Passives are prefixed with "p_" to match the global scope built in calculator.js
export const DPS_FORMULAS = {
  // --- PICKAXES ---
  // Uses "Strength" from JSON. (Assuming strength_buff is 1 if not provided)
  pickaxe: "(Strength * (1 + p_player_pickaxe_mining_damage)) * (max(25.0, 1 + p_player_pickaxe_mining_speed) / 25.0)",
  electric_pickaxe: "(Strength * (1 + p_player_pickaxe_mining_damage)) * (max(25.0, 1 + p_player_pickaxe_mining_speed) / 25.0)",
  
  // --- GUNS ---
  // Uses "bullet_count", "cooldown_time", and "bullet_damage" from JSON
  pistol: "((bullet_count / cooldown_time) * bullet_damage) * (1 + p_bullet_damage)",
  rifle: "((bullet_count / cooldown_time) * bullet_damage) * (1 + p_bullet_damage)",
  minigun: "((bullet_count / cooldown_time) * bullet_damage) * (1 + p_bullet_damage)",
  
  // Shotgun has recoil in the passive map, though it usually doesn't affect raw DPS
  shotgun: "((bullet_count / cooldown_time) * bullet_damage) * (1 + p_bullet_damage)",

  // --- INDEPENDENTS & OTHERS (Examples based on your passive map) ---
  // Assuming these items have a "damage" field. If they use a different capital letter (like "Damage"), change it!
  bomb: "damage * (1 + p_bomb_damage)",
  nuke: "damage * (1 + p_bomb_damage)",
  flamethrower: "damage * (1 + p_fire_damage)",
  axe: "damage * (1 + p_axe_damage)",
  battleaxe: "damage * (1 + p_axe_damage)",
  
  // Mortar uses damage and rate passives
  mortar_gun: "damage * (1 + p_mortar_gun_damage) * (1 + p_mortar_gun_rate)",
  
  // Tank uses damage and firing rate
  tank: "damage * (1 + p_tank_damage) * (1 + p_tank_firing_rate)",

  // Jet uses airstrike passives
  jet: "damage * (1 + p_airstrike_damage) * (1 + p_airstrike_rate)",
  
  // Boxing glove uses punch passives
  boxing_glove: "damage * (1 + p_punch_damage) * (1 + p_punch_speed)",
  
  // Kick uses kick passives
  roundhouse_kick: "damage * (1 + p_kick_damage) * (1 + p_kick_speed)",

  // Magic Staffs (Assuming fields are missile_damage, missile_count, cooldown_secs)
  staff: "((missile_count / cooldown_secs) * missile_damage) * (1 + p_magic_missiles_damage)",
  
  // Poison/Water
  poison_gun: "damage * (1 + p_poison_damage)",
  water_gun: "0", // Water gun does no base DPS itself

  employee_miner: "(weapon_strength * (1 + p_employee_miner_damage))",
  employee_miner_aoe: "(weapon_strength * aoe_damage * (1 + p_employee_miner_damage))",

  // Fallback so the calculator never crashes if an itemType isn't listed
  default: "0" 
};

// Which types apply global statuses to the target block?
export const STATUS_APPLIERS = {
  wet: ["water_gun", "water_staff", "elementalist_water"],
  poisoned: ["poison_gun", "poison_staff", "elementalist_poison"],
  burning: ["flamethrower", "elementalist_fire"]
};

