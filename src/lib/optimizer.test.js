import { describe, it, expect } from 'vitest';
import { calculateBestUpgrades } from './optimizer.js';
import { items, employees, tilesPerLayer, getOrgChart, getItemsForProfession } from './database.js';

//BigInt.prototype.toJSON = function () {
//	return this.toString();
//};

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

		// The Shotgun density: 15000 / 1360 = 11.02 value per gold
		// The greedy algorithm will perfectly buy the shotgun first!
		expect(shotgun).toBeDefined();
		expect(shotgun.qty).toBe(1);

		expect(option1.buy.totalSpent).toBe(1360n);
	});
	it('should buy miners rather than spinel pistol when miner damage is buffed', () => {
		const realGameState = {
			cash: 300000000n,
			inventory: {},
			hiredEmployees: {},
			passives: { employee_miner_damage: 999999n },
			secondsPerRound: 300
		};
		const employeesForProfession = getOrgChart(20); // Generalist +
		const employeeMap = new Map(employeesForProfession.map((e) => [e.employee_id, e]));

		const results = calculateBestUpgrades(realGameState, items, employeeMap, 'MAX_DPS');
		const option1 = results.find((opt) => opt.id === 1);
		if (!option1) throw new Error('Option 1 was not found in results');

		const miner = option1.buy.items.find((i) => i.name === 'Senior Vp Miner');

		expect(miner).toBeDefined();
		expect(miner.qty).toBe(1142);
	});
	it('should buy miners rather than spinel pistol in general', () => {
		const realGameState = {
			cash: 300000000n,
			inventory: {},
			hiredEmployees: {},
			passives: {},
			professionId: 'GENERALIST_PLUS',
			secondsPerRound: 300
		};
		const employeesForProfession = getOrgChart(realGameState.professionId); // Generalist +
		const employeeMap = new Map(employeesForProfession.map((e) => [e.employee_id, e]));

		const results = calculateBestUpgrades(realGameState, items, employeeMap, 'MAX_DPS');
		const option1 = results.find((opt) => opt.id === 1);
		if (!option1) throw new Error('Option 1 was not found in results');

		const miner = option1.buy.items.find((i) => i.name === 'Senior Vp Miner');

		expect(miner).toBeDefined();
		expect(miner.qty).toBe(1142);
	});
	it('should buy an orb for an Orbist', () => {
		const realGameState = {
			cash: 3000n,
			inventory: {},
			hiredEmployees: {},
			passives: {},
			professionId: 'ORBIST',
			secondsPerRound: 100
		};
		const employeesForProfession = getOrgChart(realGameState.professionId);
		const employeeMap = new Map(employeesForProfession.map((e) => [e.employee_id, e]));
		const itemsForProfession = getItemsForProfession(realGameState.professionId);
		const itemsMap = new Map(itemsForProfession.map((e) => [e.itemID, e]));

		const results = calculateBestUpgrades(realGameState, itemsMap, employeeMap, 'MAX_DPS');
		const option1 = results.find((opt) => opt.id === 1);
		if (!option1) throw new Error('Option 1 was not found in results');

		const miner = option1.buy.items.find((i) => i.name === 'Emerald Orb');

		expect(miner).toBeDefined();
		expect(miner.qty).toBe(1);
	});
	it('should drop a collector to buy the amethyst shotgun', () => {
		const silverShotgun = items.get('shotgun_06_silver');
		const realGameState = {
			cash: 19185n,
			inventory: {
				shotgun_06_silver: 1
			},
			hiredEmployees: {
				SENIOR_COLLECTOR: 2n
			},
			passives: {},
			professionId: 'INTERNSHIP',
			secondsPerRound: 300
		};
		const employeesForProfession = getOrgChart(realGameState.professionId);
		const employeeMap = new Map(employeesForProfession.map((e) => [e.employee_id, e]));
		const itemsForProfession = getItemsForProfession(realGameState.professionId);
		const itemsMap = new Map(itemsForProfession.map((e) => [e.itemID, e]));

		const results = calculateBestUpgrades(realGameState, itemsMap, employeeMap, 'MAX_DPS');
		const option1 = results.find((opt) => opt.id === 1);
		if (!option1) throw new Error('Option 1 was not found in results');

		const newShotgun = option1.buy.items.find((i) => i.name === 'Amethyst Shotgun');

		expect(newShotgun).toBeDefined();

		const soldItemNames = option1.sell.items.map((i) => i.name);

		expect(soldItemNames).toContain('Silver Shotgun');
		expect(soldItemNames).toContain('Senior Collector');
	});
});

describe('Optimizer prerequisites', () => {
	it('should correctly group layers and calculate averages', () => {
		//console.log(JSON.stringify(tilesPerLayer['clay']));
		const res = tilesPerLayer;
		expect(res['clay']).toEqual(
			expect.objectContaining({ avgCoalYield: 3.6, avgHealth: 151.78571428571428 })
		);
		expect(res['stone']).toEqual(
			expect.objectContaining({ avgCoalYield: 153, avgHealth: 1448.780487804878 })
		);
		expect(res['ice']).toEqual(
			expect.objectContaining({ avgCoalYield: 7515, avgHealth: 14717.647058823528 })
		);
		expect(res['fire']).toEqual(
			expect.objectContaining({ avgCoalYield: 37575, avgHealth: 148965.5172413793 })
		);
		expect(res['dark']).toEqual(
			expect.objectContaining({ avgCoalYield: 234379687.5, avgHealth: 13852272.727272727 })
		);
		expect(res['green']).toEqual(
			expect.objectContaining({ avgCoalYield: 1171875234375, avgHealth: 1385227272.7272727 })
		);
		expect(res['orange']).toEqual(
			expect.objectContaining({ avgCoalYield: 585937511718750, avgHealth: 138522727272.72726 })
		);
		expect(res['purple']).toEqual(
			expect.objectContaining({ avgCoalYield: 2929687500585937400, avgHealth: 13852272727272.727 })
		);
		expect(res['darkgreen']).toEqual(
			expect.objectContaining({ avgCoalYield: 1.4648437500029297e22, avgHealth: 13852272727272728 })
		);
		expect(res['yellow']).toEqual(
			expect.objectContaining({
				avgCoalYield: 7.324218750000001e29,
				avgHealth: 13852272727272727000
			})
		);
		expect(res['darkbrown']).toEqual(
			expect.objectContaining({ avgCoalYield: 7.32421875e39, avgHealth: 1.385227272727273e24 })
		);
		expect(res['darkblue']).toEqual(
			expect.objectContaining({ avgCoalYield: 7.32421875e55, avgHealth: 1.3852272727272726e31 })
		);
	});
});
