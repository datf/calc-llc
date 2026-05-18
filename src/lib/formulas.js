const PICKAXE_DPS =
	'(Strength * (1 + p_player_pickaxe_mining_damage)) * (max(25.0, 1 + p_player_pickaxe_mining_speed) / 25.0)';
const GUN_DPS = '((bullet_count / cooldown_time) * bullet_damage) * (1 + p_bullet_damage)';
const BOMB_DPS = 'damage * (1 + p_bomb_damage)';
const AXE_DPS = 'damage * (1 + p_axe_damage)';

export const DPS_FORMULAS = {
	pickaxe: PICKAXE_DPS,
	electric_pickaxe: PICKAXE_DPS,

	pistol: GUN_DPS,
	rifle: GUN_DPS,
	minigun: GUN_DPS,
	shotgun: GUN_DPS,

	bomb: BOMB_DPS,
	nuke: BOMB_DPS,
	axe: AXE_DPS,
	battleaxe: AXE_DPS,

	mortar_gun: 'damage * (1 + p_mortar_gun_damage) * (1 + p_mortar_gun_rate)',
	tank: 'damage * (1 + p_tank_damage) * (1 + p_tank_firing_rate)',
	jet: 'damage * (1 + p_airstrike_damage) * (1 + p_airstrike_rate)',

	boxing_glove: 'damage * (1 + p_punch_damage) * (1 + p_punch_speed)',
	roundhouse_kick: 'damage * (1 + p_kick_damage) * (1 + p_kick_speed)',

	// Add area calculation with radius here to test
	orb: 'damage * (1 + p_orb_damage) * ((pi * ((min(1500, 60 * (1 + p_orb_radius))) ^ 2)) / (64 * 64))',

	staff: '((missile_count / cooldown_secs) * missile_damage) * (1 + p_magic_missiles_damage)',

	// Poison does damage per tick, but you only get a tick every 3s
	poison_gun: 'damage * (1 + p_poison_damage) / 3',
	// Fire is similar, but ticks every 70 frames and we assume physics at 60Hz
	flamethrower: 'damage * (1 + p_fire_damage) * 6 / 7',

	water_gun: '0',

	employee_miner: '(weapon_strength * (1 + p_employee_miner_damage)) * max(1, buff_damage)',
	employee_miner_aoe: '(weapon_strength * aoe_damage * (1 + p_employee_miner_damage))',

	default: '0'
};

export const STATUS_APPLIERS = {
	wet: ['water_gun', 'water_staff', 'elementalist_water'],
	poisoned: ['poison_gun', 'poison_staff', 'elementalist_poison'],
	burning: ['flamethrower', 'elementalist_fire']
};
