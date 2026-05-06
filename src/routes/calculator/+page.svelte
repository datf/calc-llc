<script>
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

	import { gameState } from '$lib/game.svelte.js';
	import {
		tiles,
		items,
		employees,
		passiveMap,
		getItemsForProfession,
		getOrgChart
	} from '$lib/database.js';
	import { formatLargeNumber } from '$lib/utils.js';
	import { calculateLoadoutDPS } from '$lib/calculator.js';
	import {
		IGNORED_TYPES,
		INDEPENDENT_TYPES,
		MODIFIER_TYPES,
		NON_STACKABLE_TYPES,
		formatEmployeeName,
		calculateBestUpgrades
	} from '$lib/optimizer.js';

	let activeTab = $state('power');

	// --- SOURCE LOGIC ---
	let sources = $derived.by(() => {
		let heldWeapons = [];
		let independentSources = [];
		let modifiers = [];

		for (const [itemId, count] of Object.entries(gameState.inventory)) {
			if (count > 0) {
				const itemObj = items.get(itemId);
				if (itemObj && itemObj.itemType && !IGNORED_TYPES.includes(itemObj.itemType)) {
					const isStackable = !NON_STACKABLE_TYPES.includes(itemObj.itemType);

					const sourceData = {
						id: `item_${itemId}`,
						name: itemObj.itemName || itemId,
						type: 'equipment',
						data: itemObj,
						pics: [itemObj.picB64],
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
						ownedCount: Number(count),
						isStackable: true,
						maxCount: Number(count)
					});
				}
			}
		}

		return { heldWeapons, independentSources, modifiers };
	});

	// --- TABLE FILTERS ---
	function toggleLayerFilter(layer) {
		if (gameState.calculatorHiddenLayers.includes(layer)) {
			gameState.calculatorHiddenLayers = gameState.calculatorHiddenLayers.filter(
				(l) => l !== layer
			);
		} else {
			gameState.calculatorHiddenLayers = [...gameState.calculatorHiddenLayers, layer];
		}
	}

	function toggleMaterialFilter(mat) {
		if (gameState.calculatorHiddenMaterials.includes(mat)) {
			gameState.calculatorHiddenMaterials = gameState.calculatorHiddenMaterials.filter(
				(m) => m !== mat
			);
		} else {
			gameState.calculatorHiddenMaterials = [...gameState.calculatorHiddenMaterials, mat];
		}
	}

	let layerOptions = $derived.by(() => {
		const map = new Map();
		for (const t of tiles) {
			if (!map.has(t.layer)) {
				map.set(t.layer, t.pics_in_rock_base64?.[0]);
			} else if (t.resource === 'basic') {
				map.set(t.layer, t.pics_in_rock_base64?.[0]);
			}
		}
		return Array.from(map.entries()).map(([name, pic]) => ({ name, pic }));
	});

	let materialOptions = $derived.by(() => {
		const map = new Map();
		for (const t of tiles) {
			if (t.resource !== 'basic' && !map.has(t.resource)) {
				const pic = t.pic_material_base64;
				if (pic) map.set(t.resource, pic);
			}
		}
		return Array.from(map.entries()).map(([name, pic]) => ({ name, pic }));
	});

	let filteredTiles = $derived(
		tiles.filter((t) => {
			if (t.probability !== undefined && Number(t.probability) === 0) return false;
			if (gameState.calculatorHiddenLayers.includes(t.layer)) return false;
			if (gameState.calculatorHiddenMaterials.includes(t.resource)) return false;
			return true;
		})
	);

	/** @type {Loadout[]} */
	let typedLoadouts = $derived(gameState.calculatorLoadouts);

	// --- LOADOUT BUILDER STATE ---
	let activeLoadout = $derived(
		typedLoadouts.find((l) => l.id === gameState.calculatorActiveLoadoutId) || typedLoadouts[0]
	);

	let activePassiveKeys = $derived.by(() => {
		let keys = new Set();
		const allActive = [...activeLoadout.modifiers, ...activeLoadout.independents];
		if (activeLoadout.heldWeapon) allActive.push(activeLoadout.heldWeapon);

		for (const source of allActive) {
			const typeKey = source.type === 'equipment' ? source.data.itemType : 'employee';
			const relatedPassives = passiveMap[typeKey] || [];
			relatedPassives.forEach((p) => keys.add(p));
		}
		return keys;
	});

	/**
	 * @param {LoadoutSource[]} sourceArray
	 * @param {string} sourceId
	 * @returns {LoadoutSource}
	 */
	function getActiveRef(sourceArray, sourceId) {
		const found = sourceArray.find((s) => s.id === sourceId);
		if (!found) throw new Error('Source must exist when rendered as active');
		return found;
	}

	let nonZeroPassives = $derived.by(() => {
		return Object.entries(gameState.passives)
			.filter(([k, v]) => v > 0)
			.map(([k, v]) => ({ key: k, name: k.split('_').join(' '), value: v }));
	});

	function addLoadout() {
		gameState.calculatorLoadoutCounter++;
		const newId = gameState.calculatorLoadoutCounter;
		typedLoadouts.push({
			id: newId,
			name: `Loadout ${newId}`,
			heldWeapon: null,
			independents: /** @type {any[]} */ [],
			modifiers: /** @type {any[]} */ []
		});
		gameState.calculatorActiveLoadoutId = newId;
	}

	function removeLoadout(id) {
		if (typedLoadouts.length === 1) return;
		typedLoadouts = typedLoadouts.filter((l) => l.id !== id);
		if (gameState.calculatorActiveLoadoutId === id) {
			gameState.calculatorActiveLoadoutId = typedLoadouts[0].id;
		}
	}

	function toggleItemInLoadout(source) {
		const loadout = typedLoadouts.find((l) => l.id === gameState.calculatorActiveLoadoutId);
		if (!loadout) return;

		const sourceClone = { ...source };

		if (source.category === 'held') {
			if (loadout.heldWeapon?.id === source.id) {
				loadout.heldWeapon = null;
			} else {
				sourceClone.activeCount = 1;
				loadout.heldWeapon = sourceClone;
			}
		} else if (source.category === 'modifier') {
			const idx = loadout.modifiers.findIndex((s) => s.id === source.id);
			if (idx >= 0) {
				loadout.modifiers.splice(idx, 1);
			} else {
				sourceClone.activeCount = source.maxCount;
				loadout.modifiers.push(sourceClone);
			}
		} else if (source.category === 'independent') {
			const idx = loadout.independents.findIndex((s) => s.id === source.id);
			if (idx >= 0) {
				loadout.independents.splice(idx, 1);
			} else {
				sourceClone.activeCount = source.maxCount;
				loadout.independents.push(sourceClone);
			}
		}
	}

	function isSourceActive(source) {
		if (source.category === 'held') return activeLoadout.heldWeapon?.id === source.id;
		if (source.category === 'modifier')
			return activeLoadout.modifiers.some((s) => s.id === source.id);
		if (source.category === 'independent')
			return activeLoadout.independents.some((s) => s.id === source.id);
		return false;
	}

	// --- MATH HOOKS ---
	function formatDPS(dps) {
		if (dps === 0) return '0 DPS';
		return `${formatLargeNumber(Math.floor(dps))} DPS`;
	}

	function getTimeToDestroyInfo(tile, dps, maxTime) {
		if (dps === 0) return { text: '∞', color: 'theme-text-muted' };
		const seconds = Number(tile.health) / dps;
		if (seconds > maxTime) return { text: `>${maxTime}s`, color: 'text-red-500' };
		else if (seconds > maxTime / 2)
			return { text: `${seconds.toFixed(2)}s`, color: 'text-orange-400' };
		else return { text: `${seconds.toFixed(2)}s`, color: 'theme-text-accent' };
	}

	// ==========================================
	// --- UPGRADES CALCULATOR LOGIC ---
	// ==========================================
	let upgradeStrategy = $state('MAX_DPS');
	let upgradeResults = $state([]);
	let isCalculating = $state(false);

	function executeCalculation() {
		isCalculating = true;

		// Slight timeout allows the UI to render the "Calculating..." state
		setTimeout(() => {
			const itemsForProfession = getItemsForProfession(gameState.professionId);
			const itemsMap = new Map(itemsForProfession.map((e) => [e.itemID, e]));
			const employeesForProfession = getOrgChart(gameState.professionId);
			const employeeMap = new Map(employeesForProfession.map((e) => [e.employee_id, e]));
			upgradeResults = calculateBestUpgrades(gameState, itemsMap, employeeMap, upgradeStrategy);
			isCalculating = false;
		}, 50);
	}
</script>

<div class="page-wrapper page-wide">
	<div class="mb-6 text-center">
		<h2 class="text-3xl md:text-4xl font-bold theme-text-accent tracking-tight mb-2">
			Strategy Calculator
		</h2>
		<p class="text-base theme-text-muted max-w-2xl mx-auto">
			Build setups and analyze your mining power against different blocks.
		</p>
	</div>

	<!-- TABS NAVIGATION -->
	<div class="flex gap-2 border-b theme-border pb-px">
		<button
			class="px-6 py-3 font-bold rounded-t-lg {activeTab === 'power'
				? 'theme-surface theme-surface-hover theme-text-accent border-t border-l border-r theme-border'
				: 'theme-surface theme-text-muted hover:theme-text'}"
			onclick={() => (activeTab = 'power')}>Current Power</button
		>
		<button
			class="px-6 py-3 font-bold rounded-t-lg {activeTab === 'suggestions'
				? 'theme-surface theme-surface-hover theme-text-accent border-t border-l border-r theme-border'
				: 'theme-surface theme-text-muted hover:theme-text'}"
			onclick={() => (activeTab = 'suggestions')}>Proposed Upgrades</button
		>
	</div>

	<div
		class="theme-surface theme-surface-hover border theme-border rounded-b-xl p-6 shadow-2xl min-h-[60vh]"
	>
		{#if activeTab === 'power'}
			<!-- BUILDER UI -->
			<div class="mb-8 theme-surface border theme-border rounded-xl overflow-hidden">
				<div
					class="flex items-center gap-2 p-4 var(--bg-main) border-b theme-border overflow-x-auto"
				>
					<span class="theme-text-muted font-bold uppercase tracking-wider text-sm mr-2 shrink-0"
						>Loadouts:</span
					>
					{#each typedLoadouts as loadout}
						<div
							class="flex items-center theme-surface theme-surface-hover rounded-lg border {gameState.calculatorActiveLoadoutId ===
							loadout.id
								? 'theme-border-hover shadow-[0_0_8px_rgba(255,215,0,0.2)]'
								: 'theme-border opacity-70'}"
						>
							<button
								class="px-4 py-2 font-bold text-sm {gameState.calculatorActiveLoadoutId ===
								loadout.id
									? 'theme-text-accent'
									: 'theme-text'}"
								onclick={() => (gameState.calculatorActiveLoadoutId = loadout.id)}
							>
								{loadout.name}
							</button>
							{#if typedLoadouts.length > 1}
								<button
									class="px-2 py-2 theme-text-muted hover:text-red-400"
									onclick={() => removeLoadout(loadout.id)}>✕</button
								>
							{/if}
						</div>
					{/each}
					<button
						onclick={addLoadout}
						class="px-4 py-2 theme-surface theme-surface-hover border theme-border theme-text-muted hover:theme-text rounded-lg font-bold shrink-0"
					>
						+ Add Loadout
					</button>
				</div>

				<div class="p-6">
					<p class="text-sm theme-text-muted mb-4">
						Click items to toggle them for <strong class="theme-text-accent"
							>{activeLoadout.name}</strong
						>. Adjust quantities using the inputs.
					</p>

					<div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
						<!-- Modifiers -->
						<div
							class="p-4 theme-surface theme-surface-hover/50 rounded-lg border border-blue-900/50"
						>
							<h3 class="text-xs font-bold text-blue-400 mb-3 uppercase tracking-wider">
								Status Modifiers
							</h3>
							<div class="flex flex-wrap gap-2">
								{#each sources.modifiers as source}
									<div
										role="button"
										tabindex="0"
										onclick={() => toggleItemInLoadout(source)}
										onkeydown={(e) => e.key === 'Enter' && toggleItemInLoadout(source)}
										class="flex items-center gap-2 px-2 py-1.5 rounded border cursor-pointer select-none {isSourceActive(
											source
										)
											? 'bg-blue-900/40 border-blue-400'
											: 'var(--bg-main) theme-border opacity-60 hover:opacity-100'}"
									>
										{#if source.pics}
											<div class="relative w-5 h-5">
												{#each source.pics as picBase64}
													<img
														src={picBase64}
														alt="layer"
														class="absolute inset-0 w-full h-full object-contain rendering-pixelated"
													/>
												{/each}
											</div>
										{/if}
										<div class="flex flex-col text-left">
											<span
												class="text-xs font-bold {isSourceActive(source)
													? 'theme-text'
													: 'theme-text-muted'}">{source.name}</span
											>
											{#if isSourceActive(source)}
												{@const activeRef = getActiveRef(activeLoadout.modifiers, source.id)}
												{#if source.isStackable}
													<div
														class="mt-0.5 flex items-center gap-1"
														onclick={(e) => e.stopPropagation()}
														onkeydown={(e) => e.stopPropagation()}
													>
														<input
															type="number"
															min="1"
															max={source.maxCount}
															bind:value={activeRef.activeCount}
															class="w-14 text-xs px-1 py-0.5 rounded var(--bg-main) theme-text border theme-border focus:theme-border-hover outline-none"
														/>
														<span class="text-[9px] theme-text-muted"
															>/ {formatLargeNumber(source.ownedCount)}</span
														>
													</div>
												{:else}
													<span class="text-[9px] text-blue-300 mt-0.5 font-semibold"
														>Active (Max 1)</span
													>
												{/if}
											{:else}
												<span class="text-[9px] theme-text-muted"
													>Owned: {formatLargeNumber(source.ownedCount)}</span
												>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						</div>

						<!-- Independents -->
						<div
							class="p-4 theme-surface theme-surface-hover/50 rounded-lg border border-green-900/50 xl:col-span-2"
						>
							<h3 class="text-xs font-bold text-green-400 mb-3 uppercase tracking-wider">
								Background DPS
							</h3>
							<div class="flex flex-wrap gap-2">
								{#each sources.independentSources as source}
									<div
										role="button"
										tabindex="0"
										onclick={() => toggleItemInLoadout(source)}
										onkeydown={(e) => e.key === 'Enter' && toggleItemInLoadout(source)}
										class="flex items-center gap-2 px-2 py-1.5 rounded border cursor-pointer select-none {isSourceActive(
											source
										)
											? 'bg-green-900/40 border-green-400'
											: 'var(--bg-main) theme-border opacity-60 hover:opacity-100'}"
									>
										{#if source.pics}
											<div class="relative w-5 h-5">
												{#each source.pics as picBase64}
													<img
														src={picBase64}
														alt="layer"
														class="absolute inset-0 w-full h-full object-contain rendering-pixelated"
													/>
												{/each}
											</div>
										{/if}
										<div class="flex flex-col text-left">
											<span
												class="text-xs font-bold {isSourceActive(source)
													? 'theme-text'
													: 'theme-text-muted'}">{source.name}</span
											>
											{#if isSourceActive(source)}
												{@const activeRef = getActiveRef(activeLoadout.independents, source.id)}
												{#if source.isStackable}
													<div
														class="mt-0.5 flex items-center gap-1"
														onclick={(e) => e.stopPropagation()}
														onkeydown={(e) => e.stopPropagation()}
													>
														<input
															type="number"
															min="1"
															max={source.maxCount}
															bind:value={activeRef.activeCount}
															class="w-14 text-xs px-1 py-0.5 rounded var(--bg-main) theme-text border theme-border focus:theme-border-hover outline-none"
														/>
														<span class="text-[9px] theme-text-muted"
															>/ {formatLargeNumber(source.ownedCount)}</span
														>
													</div>
												{:else}
													<span class="text-[9px] text-green-300 mt-0.5 font-semibold"
														>Active (Max 1)</span
													>
												{/if}
											{:else}
												<span class="text-[9px] theme-text-muted"
													>Owned: {formatLargeNumber(source.ownedCount)}</span
												>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						</div>

						<!-- Held Weapons -->
						<div
							class="p-4 theme-surface theme-surface-hover/50 rounded-lg border theme-border-hover/30 xl:col-span-3"
						>
							<h3 class="text-xs font-bold theme-text-accent mb-3 uppercase tracking-wider">
								Held Weapon (Max 1)
							</h3>
							<div class="flex flex-wrap gap-2">
								{#each sources.heldWeapons as source}
									<div
										role="button"
										tabindex="0"
										onclick={() => toggleItemInLoadout(source)}
										onkeydown={(e) => e.key === 'Enter' && toggleItemInLoadout(source)}
										class="flex items-center gap-2 px-2 py-1.5 rounded border cursor-pointer select-none {isSourceActive(
											source
										)
											? 'bg-yellow-900/30 theme-border-hover shadow-[0_0_8px_rgba(255,215,0,0.3)]'
											: 'var(--bg-main) theme-border opacity-60 hover:opacity-100'}"
									>
										{#if source.pics}
											<div class="relative w-5 h-5">
												{#each source.pics as picBase64}
													<img
														src={picBase64}
														alt="layer"
														class="absolute inset-0 w-full h-full object-contain rendering-pixelated"
													/>
												{/each}
											</div>
										{/if}
										<div class="flex flex-col text-left">
											<span
												class="text-xs font-bold {isSourceActive(source)
													? 'theme-text'
													: 'theme-text-muted'}">{source.name}</span
											>
											<span class="text-[9px] theme-text-muted"
												>Owned: {formatLargeNumber(source.ownedCount)}</span
											>
										</div>
									</div>
								{/each}
							</div>
						</div>

						<!-- Passives Summary -->
						<div
							class="p-4 theme-surface theme-surface-hover/50 rounded-lg border border-purple-900/50 xl:col-span-3"
						>
							<h3 class="text-xs font-bold text-purple-400 mb-3 uppercase tracking-wider">
								Active Passives Summary
							</h3>
							<div class="flex flex-wrap gap-2">
								{#each nonZeroPassives as passive}
									{@const isActive = activePassiveKeys.has(passive.key)}
									<div
										class="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono border {isActive
											? 'bg-purple-900/40 border-purple-400 theme-text shadow-[0_0_8px_rgba(168,85,247,0.2)]'
											: 'var(--bg-main) theme-border theme-text-muted opacity-60'}"
									>
										<span class="uppercase">{passive.name}:</span>
										<span class="font-bold {isActive ? 'theme-text-accent' : ''}"
											>+{Math.round(passive.value * 100)}%</span
										>
									</div>
								{/each}
								{#if nonZeroPassives.length === 0}
									<span class="text-xs theme-text-muted italic">No passives upgraded yet.</span>
								{/if}
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- TABLE FILTERS -->
			<div class="mb-4 theme-surface border theme-border rounded-xl p-4">
				<div class="mb-4">
					<h3 class="text-xs font-bold theme-text-muted mb-2 uppercase tracking-wider">
						Filter by Layer
					</h3>
					<div class="flex flex-wrap gap-2">
						{#each layerOptions as layer}
							<button
								onclick={() => toggleLayerFilter(layer.name)}
								class="flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-bold select-none {gameState.calculatorHiddenLayers.includes(
									layer.name
								)
									? 'var(--bg-main) theme-border theme-text-muted opacity-50'
									: 'theme-surface theme-surface-hover theme-border theme-text hover:var(--border-main) hover:border-gray-400'}"
							>
								{#if layer.pic}<img
										src={layer.pic}
										alt={layer.name}
										class="w-4 h-4 rendering-pixelated object-contain"
									/>{/if}
								<span class="capitalize">{layer.name}</span>
							</button>
						{/each}
					</div>
				</div>
				<div>
					<h3 class="text-xs font-bold theme-text-muted mb-2 uppercase tracking-wider">
						Filter by Material
					</h3>
					<div class="flex flex-wrap gap-2">
						{#each materialOptions as mat}
							<button
								onclick={() => toggleMaterialFilter(mat.name)}
								class="flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-bold select-none {gameState.calculatorHiddenMaterials.includes(
									mat.name
								)
									? 'var(--bg-main) theme-border theme-text-muted opacity-50'
									: 'theme-surface theme-surface-hover theme-border theme-text hover:var(--border-main) hover:border-gray-400'}"
							>
								{#if mat.pic}<img
										src={mat.pic}
										alt={mat.name}
										class="w-4 h-4 rendering-pixelated object-contain"
									/>{/if}
								<span class="capitalize">{mat.name}</span>
							</button>
						{/each}
					</div>
				</div>
			</div>

			<!-- INVERTED DATA TABLE -->
			<div class="overflow-x-auto rounded-lg border theme-border">
				<table class="w-full text-left border-collapse">
					<thead>
						<tr class="theme-surface theme-text text-sm uppercase tracking-wider">
							<th
								class="p-4 border-b border-r theme-border min-w-[280px] sticky left-0 theme-surface z-20 shadow-[2px_0_5px_rgba(0,0,0,0.3)]"
								>Loadout</th
							>
							{#each filteredTiles as tile}
								<th class="p-4 border-b theme-border min-w-[120px]">
									<div class="flex items-center gap-2">
										{#if tile.pics_in_rock_base64?.length > 0}<img
												src={tile.pics_in_rock_base64[0]}
												alt={tile.resource}
												class="w-6 h-6 rendering-pixelated object-contain"
											/>{/if}
										<div>
											<div class="font-bold leading-tight capitalize">{tile.resource}</div>
											<div class="text-[10px] theme-text-muted leading-tight capitalize">
												{tile.layer}
											</div>
										</div>
									</div>
								</th>
							{/each}
							{#if filteredTiles.length === 0}<th
									class="p-4 border-b theme-border theme-text-muted italic font-normal"
									>No tiles match current filters.</th
								>{/if}
						</tr>
					</thead>
					<tbody class="text-sm divide-y divide-gray-700">
						{#each typedLoadouts as loadout}
							{@const rowDPS = calculateLoadoutDPS(loadout, gameState)}
							{@const maxTime = gameState.secondsPerRound || 300}
							{@const isEditing = gameState.calculatorActiveLoadoutId === loadout.id}

							<tr
								class="hover:var(--border-main)/50 {isEditing
									? 'theme-surface theme-surface-hover/80'
									: ''}"
							>
								<td
									class="p-4 border-r theme-border sticky left-0 theme-surface theme-surface-hover z-10 shadow-[2px_0_5px_rgba(0,0,0,0.3)]"
								>
									<div class="flex justify-between items-start mb-2">
										<button
											class="font-bold flex items-center gap-2 focus:outline-none {isEditing
												? 'theme-text-accent'
												: 'theme-text hover:theme-text'}"
											onclick={() => (gameState.calculatorActiveLoadoutId = loadout.id)}
											>{loadout.name}</button
										>
										<div
											class="text-xs font-mono theme-text theme-surface border theme-border px-2 py-1 rounded"
										>
											{formatDPS(rowDPS)}
										</div>
									</div>
									<div class="flex flex-wrap gap-2 pt-1">
										{#if loadout.heldWeapon}
											<div
												class="relative w-6 h-6 border theme-border-hover var(--bg-main) rounded"
												title={loadout.heldWeapon.name}
											>
												{#each loadout.heldWeapon.pics as pic}<img
														src={pic}
														alt="wep"
														class="absolute inset-0 w-full h-full object-contain rendering-pixelated"
													/>{/each}
											</div>
										{/if}
										{#each loadout.modifiers as mod}
											<div
												class="relative w-6 h-6 border border-blue-500 var(--bg-main) rounded"
												title={mod.name}
											>
												{#each mod.pics as pic}<img
														src={pic}
														alt="mod"
														class="absolute inset-0 w-full h-full object-contain rendering-pixelated"
													/>{/each}
												{#if mod.activeCount > 1}<span
														class="absolute -bottom-2 -right-2 theme-surface theme-text text-[9px] font-bold px-1 rounded-full border theme-border"
														>x{formatLargeNumber(mod.activeCount)}</span
													>{/if}
											</div>
										{/each}
										{#each loadout.independents as ind}
											<div
												class="relative w-6 h-6 border border-green-500 var(--bg-main) rounded"
												title={ind.name}
											>
												{#each ind.pics as pic}<img
														src={pic}
														alt="ind"
														class="absolute inset-0 w-full h-full object-contain rendering-pixelated"
													/>{/each}
												{#if ind.activeCount > 1}<span
														class="absolute -bottom-2 -right-2 theme-surface theme-text text-[9px] font-bold px-1 rounded-full border theme-border"
														>x{formatLargeNumber(ind.activeCount)}</span
													>{/if}
											</div>
										{/each}
									</div>
								</td>

								{#each filteredTiles as tile}
									{@const ttk = getTimeToDestroyInfo(tile, rowDPS, maxTime)}
									<td class="p-4 align-middle border-r theme-border last:border-r-0 text-center">
										<div class="relative group cursor-help inline-block w-full">
											<div class="font-mono font-bold {ttk.color} text-base">{ttk.text}</div>
											<div
												class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center theme-surface border theme-border px-3 py-2 rounded shadow-[0_0_10px_rgba(0,0,0,0.5)] z-50 whitespace-nowrap pointer-events-none"
											>
												<span class="text-[9px] theme-text-muted uppercase tracking-wider mb-1"
													>Yield / Block</span
												>
												<span class="font-mono theme-text-accent font-bold text-sm"
													>{tile.min_drop === tile.max_drop
														? formatLargeNumber(tile.min_drop)
														: `${formatLargeNumber(tile.min_drop)} - ${formatLargeNumber(tile.max_drop)}`}</span
												>
												<div
													class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-600"
												></div>
											</div>
										</div>
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<!-- PROPOSED UPGRADES TAB -->
			<div class="p-4">
				<div
					class="flex flex-col md:flex-row gap-4 items-center justify-between bg-black/20 p-4 border theme-border rounded-xl mb-6"
				>
					<div class="flex items-center gap-3">
						<span class="font-bold theme-text-muted text-sm uppercase tracking-wider"
							>Strategy:</span
						>
						<select
							bind:value={upgradeStrategy}
							class="bg-black/40 border theme-border theme-text px-4 py-2 rounded focus:theme-border-hover outline-none font-bold"
						>
							<option value="MAX_DPS">Maximize DPS</option>
							<option value="COLLECTION">Optimize for Collection</option>
							<option value="QUESTS">Suggest Quests</option>
						</select>
					</div>
					<button
						onclick={executeCalculation}
						disabled={isCalculating}
						class="px-6 py-2 bg-yellow-600 hover:bg-yellow-500 text-black font-bold rounded shadow-[0_0_10px_rgba(202,138,4,0.4)] disabled:opacity-50 transition-colors"
					>
						{isCalculating ? 'Calculating...' : 'Re-calculate Upgrades'}
					</button>
				</div>

				{#if upgradeResults.length > 0}
					<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
						{#each upgradeResults as option}
							<div
								class="theme-surface border {option.id === 1
									? 'theme-border-hover shadow-[0_0_15px_rgba(255,215,0,0.1)]'
									: 'theme-border'} rounded-xl p-5 flex flex-col h-full"
							>
								<div class="border-b theme-border pb-3 mb-4">
									<div class="flex justify-between items-center mb-1">
										<h3
											class="text-lg font-bold {option.id === 1
												? 'theme-text-accent'
												: 'theme-text'}"
										>
											Option {option.id}
										</h3>
										<span
											class="text-xs px-2 py-1 bg-black/40 rounded border theme-border font-mono"
										>
											{formatDPS(option.projectedValue)}
										</span>
									</div>
									{#if option.id === 1}<p
											class="text-[10px] text-green-400 uppercase tracking-widest font-bold"
										>
											Mathematical Optimal
										</p>{/if}
								</div>

								<div class="flex-grow space-y-4">
									<!-- Sell Section -->
									<div>
										<h4 class="text-xs font-bold text-red-400 mb-2 uppercase flex justify-between">
											<span>Items to Sell</span>
											<span>+{formatLargeNumber(option.sell.totalEarned)}g</span>
										</h4>
										{#if option.sell.items.length === 0}
											<p class="text-xs theme-text-muted italic">Nothing to sell.</p>
										{:else}
											<ul class="space-y-1">
												{#each option.sell.items as item}
													<li
														class="flex justify-between items-center text-xs bg-red-950/20 px-2 py-1 rounded border border-red-900/30"
													>
														<span class="flex items-center gap-1.5 truncate">
															{#if item.pics[0]}<img
																	src={item.pics[0]}
																	alt="icon"
																	class="w-4 h-4 rendering-pixelated object-contain"
																/>{/if}
															<span class="theme-text-muted">{item.qty}x</span>
															{item.name}
														</span>
														<span class="text-red-300 font-mono"
															>+{formatLargeNumber(item.total)}g</span
														>
													</li>
												{/each}
											</ul>
										{/if}
									</div>

									<!-- Buy Section -->
									<div>
										<h4
											class="text-xs font-bold text-green-400 mb-2 uppercase flex justify-between"
										>
											<span>Items to Buy</span>
											<span>-{formatLargeNumber(option.buy.totalSpent)}g</span>
										</h4>
										{#if option.buy.items.length === 0}
											<p class="text-xs theme-text-muted italic">Nothing to buy.</p>
										{:else}
											<ul class="space-y-1">
												{#each option.buy.items as item}
													<li
														class="flex justify-between items-center text-xs bg-green-950/20 px-2 py-1 rounded border border-green-900/30"
													>
														<span class="flex items-center gap-1.5 truncate">
															{#if item.pics[0]}<img
																	src={item.pics[0]}
																	alt="icon"
																	class="w-4 h-4 rendering-pixelated object-contain"
																/>{/if}
															<span class="theme-text-muted">{item.qty}x</span>
															{item.name}
														</span>
														<span class="text-green-300 font-mono"
															>-{formatLargeNumber(item.total)}g</span
														>
													</li>
												{/each}
											</ul>
										{/if}
									</div>

									<!-- Quests Section -->
									{#if option.quests.length > 0}
										<div>
											<h4 class="text-xs font-bold text-blue-400 mb-2 uppercase">
												Suggested Quests
											</h4>
											<ul class="space-y-1">
												{#each option.quests as quest}
													<li
														class="text-xs bg-blue-950/20 text-blue-200 px-2 py-1 rounded border border-blue-900/30"
													>
														{quest}
													</li>
												{/each}
											</ul>
										</div>
									{/if}
								</div>

								<!-- Add to Loadout Button -->
								<button
									class="mt-6 w-full py-2 bg-black/40 hover:bg-black/60 border theme-border theme-text-muted hover:theme-text font-bold text-sm rounded transition-colors"
									onclick={() =>
										alert('Logic to create a new loadout from these items will go here')}
								>
									+ Create New Loadout from Option {option.id}
								</button>
							</div>
						{/each}
					</div>
				{:else}
					<div class="text-center py-20 border border-dashed theme-border rounded-xl bg-black/10">
						<h3 class="text-2xl font-bold theme-text-muted mb-2">Ready to analyze</h3>
						<p class="theme-text-muted">
							Select a strategy and click calculate to view the best upgrade paths.
						</p>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
