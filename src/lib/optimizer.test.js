import { describe, it, expect } from 'vitest';
import { calculateBestUpgrades } from './optimizer.js';

describe('Optimizer Knapsack Algorithm', () => {
	it('should correctly suggest selling unused inventory for a DPS upgrade', () => {
		const mockGameState = {
			cash: 10n,
			inventory: { old_pickaxe: 1 },
			hiredEmployees: {},
			passives: {}
		};

		const mockItems = new Map([
			[
				'old_pickaxe',
				{
					itemName: 'Old Pickaxe',
					itemType: 'pickaxe',
					itemSellPrice: 5n,
					Strength: 10 // Used by PICKAXE_DPS formula
				}
			],
			[
				'new_bomb',
				{
					itemName: 'New Bomb',
					itemType: 'bomb', // bomb has a valid formula in formulas.js!
					itemBuyPrice: 15n,
					damage: 100 // Used by BOMB_DPS formula
				}
			]
		]);

		const mockEmployees = new Map();

		const results = calculateBestUpgrades(mockGameState, mockItems, mockEmployees, 'MAX_DPS');

		const option1 = results.find((opt) => opt.id === 1);

		expect(option1).toBeDefined();

		// Now it should realize Bomb (100 DPS) > Pickaxe (10 DPS)
		// and successfully suggest the swap!
		expect(option1.sell.totalEarned).toBe(5);
		expect(option1.sell.items.length).toBe(1);
		expect(option1.sell.items[0].name).toBe('Old Pickaxe');

		expect(option1.buy.totalSpent).toBe(15);
		expect(option1.buy.items.length).toBe(1);
		expect(option1.buy.items[0].name).toBe('New Bomb');
	});
});
