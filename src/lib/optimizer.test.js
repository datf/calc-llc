import { describe, it, expect } from 'vitest';
import { calculateBestUpgrades } from './optimizer.js';

describe('Optimizer Knapsack Greedy Algorithm', () => {
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
					Strength: 10n
				}
			],
			[
				'new_bomb',
				{
					itemName: 'New Bomb',
					itemType: 'bomb',
					itemBuyPrice: 15n,
					damage: 100n
				}
			]
		]);

		const mockEmployees = new Map();

		const results = calculateBestUpgrades(mockGameState, mockItems, mockEmployees, 'MAX_DPS');

		const option1 = results.find((opt) => opt.id === 1);

		if (!option1) throw new Error('Option 1 was not found in results');

		expect(option1).toBeDefined();

		expect(option1.sell.totalEarned).toBe(5n);
		expect(option1.sell.items.length).toBe(1);
		expect(option1.sell.items[0].name).toBe('Old Pickaxe');

		expect(option1.buy.totalSpent).toBe(15n);
		expect(option1.buy.items.length).toBe(1);
		expect(option1.buy.items[0].name).toBe('New Bomb');
	});
});
