import { gameState } from '$lib/game.svelte.js';
import { getItemsForProfession, getOrgChart } from '$lib/database.js';
import { calculateBestUpgrades } from '$lib/optimizer.js';

class OptimizerManager {
	strategy = $state('MAX_DPS');
	results = $state([]);
	isCalculating = $state(false);

	constructor() {
		gameState.actionBus?.addEventListener('saveReloaded', () => this.execute());
	}

	execute() {
		if (this.isCalculating) return;
		this.isCalculating = true;

		setTimeout(() => {
			const itemsForProfession = getItemsForProfession(gameState.professionId);
			const itemsMap = new Map(itemsForProfession.map((e) => [e.itemID, e]));
			const employeesForProfession = getOrgChart(gameState.professionId);
			const employeeMap = new Map(employeesForProfession.map((e) => [e.employee_id, e]));

			this.results = calculateBestUpgrades(
				gameState,
				itemsMap,
				employeeMap,
				this.strategy,
				this.lockedItems
			);
			this.isCalculating = false;
		}, 50);
	}

	lockedItems = $state([]);

	toggleLock(refId) {
		if (!refId) return;
		if (this.lockedItems.includes(refId)) {
			this.lockedItems = this.lockedItems.filter((id) => id !== refId);
		} else {
			this.lockedItems.push(refId);
		}
		// Automatically recalculate when a lock changes
		this.execute();
	}
}

export const optimizer = new OptimizerManager();
