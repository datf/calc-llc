<script>
	import { calculateBestUpgrades } from '$lib/optimizer.js';
	import { getOrgChart, getItemsForProfession } from '$lib/database.js';
	import { gameState } from '$lib/game.svelte.js';

	let testName = $state('should optimize correctly for this edge case');
	let lockedItemsInput = $state('');

	/** @type {any} */
	let parsedState = $state(null);
	/** @type {any} */
	let calculationResults = $state(null);

	/** @type {string[]} */
	let expectedBuys = $state([]);
	/** @type {string[]} */
	let expectedSells = $state([]);

	/** @param {any} val */
	function formatAsBigIntStr(val) {
		if (val === undefined || val === null) return '0n';
		const strVal = String(val).replace('n', '');
		return `${strVal}n`;
	}

	function captureAndCalculate() {
		try {
			const raw = gameState;

			const tempState = {
				cash: formatAsBigIntStr(raw.cash),
				inventory: { ...raw.inventory },
				hiredEmployees: /** @type {Record<string, string>} */ ({}),
				passives: Object.fromEntries(
					Object.entries(raw.passives || {}).filter(([_, val]) => Number(val) > 0)
				),
				professionId: raw.professionId || 'INTERNSHIP',
				secondsPerRound: raw.secondsPerRound || 100,
				map: raw.map || 'earth',
				quota: Number(raw.quota || 40),
				bonus_equipment_manager: { ...raw.bonus_equipment_manager }
			};

			for (const [k, v] of Object.entries(raw.hiredEmployees || {})) {
				if (v) tempState.hiredEmployees[k] = formatAsBigIntStr(v);
			}

			parsedState = tempState;

			const lockedArr = lockedItemsInput
				.split(',')
				.map((i) => i.trim())
				.filter(Boolean);

			const employeesForProfession = getOrgChart(parsedState.professionId);
			const employeeMap = new Map(employeesForProfession.map((e) => [e.employee_id, e]));
			const itemsForProfession = getItemsForProfession(parsedState.professionId);
			const itemsMap = new Map(itemsForProfession.map((e) => [e.itemID, e]));

			const liveState = JSON.parse(JSON.stringify(parsedState));
			liveState.cash = BigInt(String(liveState.cash).replace('n', ''));
			for (let k in liveState.hiredEmployees) {
				liveState.hiredEmployees[k] = BigInt(String(liveState.hiredEmployees[k]).replace('n', ''));
			}

			const results = calculateBestUpgrades(liveState, itemsMap, employeeMap, 'MAX_DPS', lockedArr);
			calculationResults = results.find((/** @type {any} */ o) => o.id === 1) || null;

			expectedBuys = [];
			expectedSells = [];
		} catch (error) {
			const e = /** @type {Error} */ (error);
			alert('Failed to capture state or run calculation: ' + e.message);
			console.error(e);
		}
	}

	/** @param {any} state */
	function generateStateCode(state) {
		if (!state) return '';
		let str = JSON.stringify(state, null, 3);
		str = str.replace(/"([^"]+)":/g, '$1:');
		str = str.replace(/"(\d+)n"/g, '$1n');
		return str;
	}

	let generatedTestCode = $derived.by(() => {
		if (!parsedState || !calculationResults) return '';

		const lockedArr = lockedItemsInput
			.split(',')
			.map((i) => i.trim())
			.filter(Boolean);
		const stateCode = generateStateCode(parsedState);

		let code = `\tit('${testName.replace(/'/g, "\\'")}', () => {\n`;
		code += `\t\tconst realGameState = ${stateCode.replace(/\n/g, '\n\t\t')};\n`;

		if (lockedArr.length > 0) {
			code += `\t\tconst lockedItems = ${JSON.stringify(lockedArr)};\n\n`;
		} else {
			code += `\n`;
		}

		code += `\t\tconst employeesForProfession = getOrgChart(realGameState.professionId);\n`;
		code += `\t\tconst employeeMap = new Map(employeesForProfession.map((e) => [e.employee_id, e]));\n`;
		code += `\t\tconst itemsForProfession = getItemsForProfession(realGameState.professionId);\n`;
		code += `\t\tconst itemsMap = new Map(itemsForProfession.map((e) => [e.itemID, e]));\n\n`;

		if (lockedArr.length > 0) {
			code += `\t\tconst results = calculateBestUpgrades(realGameState, itemsMap, employeeMap, 'MAX_DPS', lockedItems);\n`;
		} else {
			code += `\t\tconst results = calculateBestUpgrades(realGameState, itemsMap, employeeMap, 'MAX_DPS');\n`;
		}

		code += `\t\tconst option1 = results.find((opt) => opt.id === 1);\n`;
		code += `\t\tif (!option1) throw new Error('Option 1 was not found in results');\n\n`;

		code += `\t\tconst boughtItemNames = option1.buy.items.map((i) => i.name);\n`;
		code += `\t\tconst soldItemNames = option1.sell.items.map((i) => i.name);\n\n`;

		for (const buy of expectedBuys) {
			code += `\t\texpect(boughtItemNames).toContain('${buy}');\n`;
		}
		for (const sell of expectedSells) {
			code += `\t\texpect(soldItemNames).toContain('${sell}');\n`;
		}

		code += `\t});`;
		return code;
	});

	/**
	 * @param {string[]} arr
	 * @param {string} item
	 */
	function toggleSelection(arr, item) {
		const idx = arr.indexOf(item);
		if (idx >= 0) arr.splice(idx, 1);
		else arr.push(item);
	}
</script>

<div
	class="p-4 bg-black/30 border theme-border rounded-xl flex flex-col gap-4 font-mono text-sm max-w-full"
>
	<div class="flex justify-between items-center">
		<h2 class="text-lg font-bold text-yellow-500">🧪 Live State Test Gen</h2>
		<button
			onclick={captureAndCalculate}
			class="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-1.5 px-3 rounded transition-colors shadow-lg"
		>
			Snapshot & Calculate
		</button>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
		<div class="flex flex-col gap-1">
			<label class="font-bold text-xs theme-text-muted">Test Name</label>
			<input
				bind:value={testName}
				class="bg-black/60 border theme-border p-1.5 text-xs rounded focus:outline-none focus:border-yellow-500"
			/>
		</div>

		<div class="flex flex-col gap-1">
			<label class="font-bold text-xs theme-text-muted">Locked Items (Optional IDs)</label>
			<input
				bind:value={lockedItemsInput}
				placeholder="poisongun_spinel"
				class="bg-black/60 border theme-border p-1.5 text-xs rounded focus:outline-none focus:border-yellow-500"
			/>
		</div>
	</div>

	{#if calculationResults}
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4 border-t theme-border pt-4">
			<!-- Results Selector -->
			<div class="flex flex-col gap-3">
				<h3 class="font-bold text-sm text-white">Select Expected Outcome:</h3>

				<div>
					<h4 class="text-green-400 font-bold text-xs mb-1">Expect to Buy:</h4>
					<div class="flex flex-col gap-1 max-h-32 overflow-y-auto pr-2">
						{#each calculationResults.buy.items as item}
							<label
								class="flex items-center gap-2 bg-green-950/30 p-1.5 text-xs rounded border border-green-900/50 cursor-pointer hover:bg-green-900/50 transition-colors"
							>
								<input
									type="checkbox"
									checked={expectedBuys.includes(item.name)}
									onchange={() => toggleSelection(expectedBuys, item.name)}
									class="accent-green-500"
								/>
								<span class="text-green-200 truncate">{item.qty}x {item.name}</span>
							</label>
						{/each}
						{#if calculationResults.buy.items.length === 0}
							<span class="text-gray-500 italic text-xs">Nothing to buy.</span>
						{/if}
					</div>
				</div>

				<div>
					<h4 class="text-red-400 font-bold text-xs mb-1">Expect to Sell:</h4>
					<div class="flex flex-col gap-1 max-h-32 overflow-y-auto pr-2">
						{#each calculationResults.sell.items as item}
							<label
								class="flex items-center gap-2 bg-red-950/30 p-1.5 text-xs rounded border border-red-900/50 cursor-pointer hover:bg-red-900/50 transition-colors"
							>
								<input
									type="checkbox"
									checked={expectedSells.includes(item.name)}
									onchange={() => toggleSelection(expectedSells, item.name)}
									class="accent-red-500"
								/>
								<span class="text-red-200 truncate">{item.qty}x {item.name}</span>
							</label>
						{/each}
						{#if calculationResults.sell.items.length === 0}
							<span class="text-gray-500 italic text-xs">Nothing to sell.</span>
						{/if}
					</div>
				</div>
			</div>

			<!-- Generated Code Output -->
			<div class="flex flex-col gap-1 h-full">
				<div class="flex justify-between items-center">
					<label class="font-bold text-xs theme-text-muted">Generated Vitest Code</label>
					<button
						onclick={() => navigator.clipboard.writeText(generatedTestCode)}
						class="text-[10px] bg-yellow-600/20 text-yellow-500 border border-yellow-600/50 px-2 py-1 rounded hover:bg-yellow-600/40 transition-colors"
					>
						Copy
					</button>
				</div>
				<textarea
					readonly
					value={generatedTestCode}
					class="bg-[#0d1117] border theme-border p-2 rounded h-full min-h-[250px] text-green-300 focus:outline-none whitespace-pre overflow-x-auto text-[10px] leading-relaxed font-mono"
				></textarea>
			</div>
		</div>
	{/if}
</div>
