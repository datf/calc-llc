import { gameState } from '$lib/game.svelte.js';
import { tiles, items, employees, passiveMap } from '$lib/database.js';
import { calculateLoadoutDPS } from '$lib/calculator.js';
import {
	IGNORED_TYPES,
	INDEPENDENT_TYPES,
	MODIFIER_TYPES,
	NON_STACKABLE_TYPES,
	formatEmployeeName
} from '$lib/optimizer.js';

export const LAYER_PROGRESSION = ['dirt', 'clay', 'stone', 'ice', 'fire', 'dark'];

/**
 * @typedef {Object} LoadoutSource
 * @property {string} id
 * @property {string} name
 * @property {string} type
 * @property {any} data
 * @property {string[]} pics
 * @property {number} activeCount
 * @property {boolean} isStackable
 * @property {number} maxCount
 * @property {number} ownedCount
 * @property {string} [category]
 */

/**
 * @typedef {Object} Loadout
 * @property {number} id
 * @property {string} name
 * @property {LoadoutSource | null} heldWeapon
 * @property {LoadoutSource[]} independents
 * @property {LoadoutSource[]} modifiers
 */

export class CalculatorManager {
	sources = $derived.by(() => {
		/** @type {LoadoutSource[]} */
		let heldWeapons = [];
		/** @type {LoadoutSource[]} */
		let independentSources = [];
		/** @type {LoadoutSource[]} */
		let modifiers = [];

		for (const [itemId, count] of Object.entries(gameState.inventory)) {
			if (count > 0) {
				const itemObj = items.get(itemId);
				if (itemObj && itemObj.itemType && !IGNORED_TYPES.includes(itemObj.itemType)) {
					const isStackable = !NON_STACKABLE_TYPES.includes(itemObj.itemType);

					/** @type {LoadoutSource} */
					const sourceData = {
						id: `item_${itemId}`,
						name: itemObj.itemName || itemId,
						type: 'equipment',
						data: itemObj,
						pics: [itemObj.picB64 || ''], // Ensure array contains strings
						activeCount: 1, // Add this
						ownedCount: Number(count),
						isStackable: isStackable,
						maxCount: isStackable ? Number(count) : 1
					};

					if (MODIFIER_TYPES.includes(itemObj.itemType) || itemObj.itemType.includes('water')) {
						modifiers.push({ ...sourceData, category: 'modifier' });
					} else if (INDEPENDENT_TYPES.includes(itemObj.itemType)) {
						independentSources.push({ ...sourceData, category: 'independent' });
					} else {
						heldWeapons.push({ ...sourceData, category: 'held' });
					}
				}
			}
		}

		for (const [empId, count] of Object.entries(gameState.hiredEmployees)) {
			if (count > 0n) {
				const empObj = employees.get(empId);
				if (empObj && empObj.type === '0') {
					let compositePics = [];
					if (empObj.legs_texture_base64) compositePics.push(empObj.legs_texture_base64);
					if (empObj.torso_texture_base64) compositePics.push(empObj.torso_texture_base64);
					if (empObj.head_texture_base64) compositePics.push(empObj.head_texture_base64);

					let weaponStrength = 0;
					if (empObj.equipment_itemID) {
						const weaponObj = items.get(empObj.equipment_itemID);
						if (weaponObj) {
							if (weaponObj.picB64) compositePics.push(weaponObj.picB64);
							weaponStrength = Number(weaponObj.Strength || weaponObj.damage || 0);
						}
					}
					independentSources.push({
						id: `emp_${empId}`,
						name: formatEmployeeName(empObj.employee_id),
						type: 'employee',
						data: { ...empObj, weapon_strength: weaponStrength },
						pics: compositePics,
						category: 'independent',
						activeCount: 1, // Add this
						ownedCount: Number(count),
						isStackable: true,
						maxCount: Number(count)
					});
				}
			}
		}
		return { heldWeapons, independentSources, modifiers };
	});

	layerOptions = $derived.by(() => {
		const map = new Map();
		const shiftAmount = Number(gameState.bonus_equipment_manager?.shift_layers_up || 0);
		for (const t of tiles) {
			const layerIndex = LAYER_PROGRESSION.indexOf(t.layer);
			if (layerIndex > 0 && layerIndex <= shiftAmount) continue;
			if (!map.has(t.layer) || t.resource === 'basic') {
				map.set(t.layer, t.pics_in_rock_base64?.[0]);
			}
		}
		return Array.from(map.entries()).map(([name, pic]) => ({ name, pic }));
	});

	materialOptions = $derived.by(() => {
		const map = new Map();
		const shiftAmount = Number(gameState.bonus_equipment_manager?.shift_layers_up || 0);
		for (const t of tiles) {
			const layerIndex = LAYER_PROGRESSION.indexOf(t.layer);
			if (layerIndex > 0 && layerIndex <= shiftAmount) continue;
			if (t.resource !== 'basic' && !map.has(t.resource)) {
				if (t.pic_material_base64) map.set(t.resource, t.pic_material_base64);
			}
		}
		return Array.from(map.entries()).map(([name, pic]) => ({ name, pic }));
	});

	filteredTiles = $derived.by(() => {
		const shiftAmount = Number(gameState.bonus_equipment_manager?.shift_layers_up || 0);
		return tiles.filter((t) => {
			if (t.probability !== undefined && Number(t.probability) === 0) return false;
			const layerIndex = LAYER_PROGRESSION.indexOf(t.layer);
			if (layerIndex > 0 && layerIndex <= shiftAmount) return false;
			if (gameState.calculatorHiddenLayers.includes(t.layer)) return false;
			if (gameState.calculatorHiddenMaterials.includes(t.resource)) return false;
			return true;
		});
	});

	/** @returns {Loadout[]} */
	get typedLoadouts() {
		return gameState.calculatorLoadouts;
	}

	/** @type {Loadout} */
	activeLoadout = $derived.by(() => {
		return (
			this.typedLoadouts.find((l) => l.id === gameState.calculatorActiveLoadoutId) ||
			this.typedLoadouts[0]
		);
	});

	activePassiveKeys = $derived.by(() => {
		let keys = new Set();
		/** @type {LoadoutSource[]} */
		const allActive = [...this.activeLoadout.modifiers, ...this.activeLoadout.independents];
		if (this.activeLoadout.heldWeapon) allActive.push(this.activeLoadout.heldWeapon);

		for (const source of allActive) {
			const typeKey = source.type === 'equipment' ? source.data.itemType : 'employee';
			const relatedPassives = passiveMap[typeKey] || [];
			relatedPassives.forEach((p) => keys.add(p));
		}
		return keys;
	});

	nonZeroPassives = $derived.by(() => {
		return Object.entries(gameState.passives)
			.filter(([k, v]) => v > 0)
			.map(([k, v]) => ({ key: k, name: k.split('_').join(' '), value: v }));
	});

	loadoutDPSMap = $derived.by(() => {
		const map = new Map();
		for (const loadout of this.typedLoadouts) {
			const dps = calculateLoadoutDPS(loadout, gameState);
			map.set(loadout.id, dps);
		}
		return map;
	});

	toggleLayerFilter(layer) {
		if (gameState.calculatorHiddenLayers.includes(layer)) {
			gameState.calculatorHiddenLayers = gameState.calculatorHiddenLayers.filter(
				(l) => l !== layer
			);
		} else {
			gameState.calculatorHiddenLayers = [...gameState.calculatorHiddenLayers, layer];
		}
	}

	toggleMaterialFilter(mat) {
		if (gameState.calculatorHiddenMaterials.includes(mat)) {
			gameState.calculatorHiddenMaterials = gameState.calculatorHiddenMaterials.filter(
				(m) => m !== mat
			);
		} else {
			gameState.calculatorHiddenMaterials = [...gameState.calculatorHiddenMaterials, mat];
		}
	}

	/**
	 * @param {LoadoutSource[]} sourceArray
	 * @param {string} sourceId
	 * @returns {LoadoutSource}
	 */
	getActiveRef(sourceArray, sourceId) {
		const found = sourceArray.find((s) => s.id === sourceId);
		if (!found) throw new Error('Source must exist when rendered as active');
		return found;
	}

	addLoadout() {
		gameState.calculatorLoadoutCounter++;
		const newId = gameState.calculatorLoadoutCounter;

		/** @type {Loadout} */
		const newLoadout = {
			id: newId,
			name: `Loadout ${newId}`,
			heldWeapon: null,
			independents: [],
			modifiers: []
		};

		/** @type {any} */
		(gameState.calculatorLoadouts).push(newLoadout);
		gameState.calculatorActiveLoadoutId = newId;
	}

	removeLoadout(id) {
		if (this.typedLoadouts.length === 1) return;

		/** @type {any} */
		(gameState).calculatorLoadouts = this.typedLoadouts.filter((l) => l.id !== id);

		if (gameState.calculatorActiveLoadoutId === id) {
			gameState.calculatorActiveLoadoutId = this.typedLoadouts[0].id;
		}
	}

	/**
	 * @param {LoadoutSource} source
	 */
	toggleItemInLoadout(source) {
		const loadout = this.typedLoadouts.find((l) => l.id === gameState.calculatorActiveLoadoutId);
		if (!loadout) return;

		const sourceClone = { ...source };

		if (source.category === 'held') {
			if (loadout.heldWeapon?.id === source.id) loadout.heldWeapon = null;
			else {
				sourceClone.activeCount = 1;
				loadout.heldWeapon = sourceClone;
			}
		} else if (source.category === 'modifier') {
			const idx = loadout.modifiers.findIndex((s) => s.id === source.id);
			if (idx >= 0) loadout.modifiers.splice(idx, 1);
			else {
				sourceClone.activeCount = source.maxCount;
				loadout.modifiers.push(sourceClone);
			}
		} else if (source.category === 'independent') {
			const idx = loadout.independents.findIndex((s) => s.id === source.id);
			if (idx >= 0) loadout.independents.splice(idx, 1);
			else {
				sourceClone.activeCount = source.maxCount;
				loadout.independents.push(sourceClone);
			}
		}
	}

	/**
	 * @param {LoadoutSource} source
	 * @returns {boolean}
	 */
	isSourceActive(source) {
		if (source.category === 'held') return this.activeLoadout.heldWeapon?.id === source.id;
		if (source.category === 'modifier')
			return this.activeLoadout.modifiers.some((s) => s.id === source.id);
		if (source.category === 'independent')
			return this.activeLoadout.independents.some((s) => s.id === source.id);
		return false;
	}
}
