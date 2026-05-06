import { describe, it, expect } from 'vitest';
import { calculateBestUpgrades } from './optimizer.js';
import { items, employees } from './database.js';

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
					damage: 4000n // Now 4000 > 3000, it will sell the pickaxe to buy it!
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

describe('Optimizer Integration (Real Items)', () => {
	it('should correctly evaluate real game items using actual formulas', () => {
		// Give the player enough cash to buy a real item
		const realGameState = {
			cash: 50n,
			inventory: {},
			hiredEmployees: {},
			passives: {}
		};

		const results = calculateBestUpgrades(realGameState, items, employees, 'MAX_DPS');

		const option1 = results.find((opt) => opt.id === 1);
		if (!option1) throw new Error('Option 1 not found');

		// Since it's greedy and searching for MAX_DPS, it should buy the highest
		// DPS item available for <= 50g.
		expect(option1).toBeDefined();

		// We don't assert exact names/prices here because we might balance the game later,
		// but we CAN assert that the algorithm successfully produced a valid buy list
		// using the real data without crashing or throwing mathjs errors!
		expect(option1.buy.items.length).toBeGreaterThan(0);
		expect(option1.buy.totalSpent).toBeLessThanOrEqual(50n);

		// Assert that the density calculation worked and projectedValue > 0
		expect(option1.projectedValue).toBeGreaterThan(0);
	});

	it('should buy a Sapphire Shotgun and 6 Weak Dynamites with 1700g based on round duration', () => {
		const realGameState = {
			cash: 1700n,
			inventory: {},
			hiredEmployees: {},
			passives: {},
			secondsPerRound: 300 // The key to making the Shotgun win!
		};

		// Mock the items to exactly match your scenario
		const mockItems = new Map([
			[
				'shotgun_04_sapphire',
				{
					itemName: 'Sapphire Shotgun',
					itemType: 'shotgun',
					itemBuyPrice: 1360n,
					bullet_count: 5,
					bullet_damage: 10,
					cooldown_time: 1 // Eval: (5/1) * 10 = 50 DPS. 50 * 300s = 15,000 Total Damage
				}
			],
			[
				'weak_dynamite',
				{
					itemName: 'Weak Dynamite',
					itemType: 'bomb',
					itemBuyPrice: 50n,
					damage: 300 // Eval: 300 Damage ONCE
				}
			]
		]);

		const mockEmployees = new Map();

		const results = calculateBestUpgrades(realGameState, items, mockEmployees, 'MAX_DPS');
		const option1 = results.find((opt) => opt.id === 1);
		if (!option1) throw new Error('Option 1 was not found in results');

		const shotgun = option1.buy.items.find((i) => i.name === 'Sapphire Shotgun');
		const dynamite = option1.buy.items.find((i) => i.name === 'Weak Dynamite');

		// The Shotgun density: 15000 / 1360 = 11.02 value per gold
		// The Dynamite density: 300 / 50 = 6.0 value per gold
		// The greedy algorithm will perfectly buy the shotgun first!
		expect(shotgun).toBeDefined();
		expect(shotgun.qty).toBe(1);

		// 1700 - 1360 = 340g remaining. 340 / 50 = 6 dynamites.
		expect(dynamite).toBeDefined();
		expect(dynamite.qty).toBe(6);

		expect(option1.buy.totalSpent).toBe(1660n);
	});
});
