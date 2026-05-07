import { PASSIVE_KEYS } from './database.js';
import { DPS_FORMULAS, STATUS_APPLIERS } from './formulas.js';
import * as math from 'mathjs';

export const CONSUMABLE_TYPES = ['bomb', 'nuke', 'earthquake']; // Items that deal burst damage and are consumed

export function calculateLoadoutDPS(loadout, gameState, consumableDPS = false) {
	let totalDPS = 0;

	const { independents = [], modifiers = [], heldWeapon = null } = loadout || {};
	const activeSources = [...independents, ...modifiers];

	if (heldWeapon) activeSources.push(heldWeapon);

	if (activeSources.length === 0) return 0;

	const globalScope = Object.fromEntries(
		PASSIVE_KEYS.map((key) => [`p_${key}`, gameState.passives[key] || 0])
	);

	let isWet = false;

	// Extract the round duration (default to 300 if undefined)
	const roundDuration = Number(gameState.secondsPerRound || 300);

	for (const source of activeSources) {
		const type = source.data?.itemType || source.data?.type;
		if (!isWet && STATUS_APPLIERS.wet.includes(type)) {
			isWet = true;
		}

		let archetype = 'default';
		if (source.type === 'equipment') {
			archetype = type;
		} else if (source.type === 'employee') {
			archetype = Number(source.data.aoe_damage) > 0 ? 'employee_miner_aoe' : 'employee_miner';
		}

		const formulaString = DPS_FORMULAS[archetype] || DPS_FORMULAS['default'];
		const localScope = { ...globalScope, ...source.data };

		try {
			let sourceOutput = math.evaluate(formulaString, localScope);
			const count = source.activeCount || 1;

			// --- NEW LOGIC: Normalize Consumables to DPS ---
			// If it's a consumable, the formula yielded raw Damage. Divide by round duration to get true DPS.
			if (consumableDPS && CONSUMABLE_TYPES.includes(type)) {
				sourceOutput = sourceOutput / roundDuration;
			}

			totalDPS += sourceOutput * count;
		} catch (err) {
			console.error(
				`[Calculator Engine] Failed to evaluate ${source.name || archetype} using formula: ${formulaString}`,
				err
			);
		}
	}

	if (isWet) {
		totalDPS = totalDPS * (2 * (1 + globalScope.p_wet_damage));
	}

	return totalDPS;
}
