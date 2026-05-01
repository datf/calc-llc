<!-- src/routes/calculator/+page.svelte -->
<script>
  import { gameState } from '$lib/game.svelte.js';
  import { tiles, items, employees, passiveMap } from '$lib/database.js';
  import { formatLargeNumber } from '$lib/utils.js';
  import { calculateLoadoutDPS } from '$lib/calculator.js';

  let activeTab = $state('power'); 

  // --- CATEGORIZATION ARRAYS ---
  const IGNORED_TYPES = ["mining_whistle", "ladder", "collector_whistle", "platform", "gravity_enhancer", "teleporter"];
  const INDEPENDENT_TYPES = ["poison_gun", "bomb", "flamethrower", "drill", "mortar_gun", "roundhouse_kick", "jet"];
  const MODIFIER_TYPES = ["water_gun", "water_staff"]; 
  
  // Items that act as binary effects or single-use global cooldowns
  const NON_STACKABLE_TYPES = ["roundhouse_kick", "poison_gun", "poison_staff", "flamethrower", "jet", "water_gun", "water_staff"];

  function formatEmployeeName(id) {
    if (!id) return "Unknown";
    return id.split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

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

          if (MODIFIER_TYPES.includes(itemObj.itemType) || itemObj.itemType.includes("water")) {
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
        
        if (empObj && empObj.type === "0") {
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

  // --- TABLE FILTERS (Persisted in gameState) ---
  
  function toggleLayerFilter(layer) {
    if (gameState.calculatorHiddenLayers.includes(layer)) {
      gameState.calculatorHiddenLayers = gameState.calculatorHiddenLayers.filter(l => l !== layer);
    } else {
      gameState.calculatorHiddenLayers = [...gameState.calculatorHiddenLayers, layer];
    }
  }

  function toggleMaterialFilter(mat) {
    if (gameState.calculatorHiddenMaterials.includes(mat)) {
      gameState.calculatorHiddenMaterials = gameState.calculatorHiddenMaterials.filter(m => m !== mat);
    } else {
      gameState.calculatorHiddenMaterials = [...gameState.calculatorHiddenMaterials, mat];
    }
  }

  // Extract unique layers and find their "basic" block pic
  let layerOptions = $derived.by(() => {
    const map = new Map();
    for (const t of tiles) {
      if (!map.has(t.layer)) {
        map.set(t.layer, t.pics_in_rock_base64?.[0]);
      } else if (t.resource === 'basic') {
        map.set(t.layer, t.pics_in_rock_base64?.[0]);
      }
    }
    return Array.from(map.entries()).map(([name, pic]) => ({name, pic}));
  });

  // Extract unique materials and their pics (excluding "basic")
  let materialOptions = $derived.by(() => {
    const map = new Map();
    for (const t of tiles) {
      if (t.resource !== 'basic' && !map.has(t.resource)) {
        const pic = t.pic_material_base64;
        if (pic) map.set(t.resource, pic);
      }
    }
    return Array.from(map.entries()).map(([name, pic]) => ({name, pic}));
  });

  // The dynamically filtered array of tiles for the table
  let filteredTiles = $derived(
    tiles.filter(t => {
      // 1. Check if probability is explicitly 0 (handles string or number)
      if (t.probability !== undefined && Number(t.probability) === 0) return false;
      // 2. Check user filters using the global state variables
      if (gameState.calculatorHiddenLayers.includes(t.layer)) return false;
      if (gameState.calculatorHiddenMaterials.includes(t.resource)) return false;
      return true;
    })
  );

  // --- LOADOUT BUILDER STATE ---
  let activeLoadout = $derived(
    gameState.calculatorLoadouts.find(l => l.id === gameState.calculatorActiveLoadoutId) 
    || gameState.calculatorLoadouts[0]
  );

  // Derive which passives are currently active based on equipped items
  let activePassiveKeys = $derived.by(() => {
    let keys = new Set();
    const allActive = [...activeLoadout.modifiers, ...activeLoadout.independents];
    if (activeLoadout.heldWeapon) allActive.push(activeLoadout.heldWeapon);

    for (const source of allActive) {
      const typeKey = source.type === 'equipment' ? source.data.itemType : 'employee';
      const relatedPassives = passiveMap[typeKey] || [];
      relatedPassives.forEach(p => keys.add(p));
    }
    return keys;
  });

  // Derive a clean array of passives the player actually owns (value > 0)
  let nonZeroPassives = $derived.by(() => {
    return Object.entries(gameState.passives)
      .filter(([k, v]) => v > 0)
      .map(([k, v]) => ({
        key: k,
        name: k.split('_').join(' '),
        value: v
      }));
  });

  function addLoadout() {
    gameState.calculatorLoadoutCounter++;
    const newId = gameState.calculatorLoadoutCounter;
    gameState.calculatorLoadouts.push({ 
      id: newId, 
      name: `Loadout ${newId}`, 
      heldWeapon: null, 
      independents: [], 
      modifiers: [] 
    });
    gameState.calculatorActiveLoadoutId = newId;
  }

  function removeLoadout(id) {
    if (gameState.calculatorLoadouts.length === 1) return; 
    gameState.calculatorLoadouts = gameState.calculatorLoadouts.filter(l => l.id !== id);
    if (gameState.calculatorActiveLoadoutId === id) {
      gameState.calculatorActiveLoadoutId = gameState.calculatorLoadouts[0].id;
    }
  }

  function toggleItemInLoadout(source) {
    const loadout = gameState.calculatorLoadouts.find(l => l.id === gameState.calculatorActiveLoadoutId);
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
      const idx = loadout.modifiers.findIndex(s => s.id === source.id);
      if (idx >= 0) {
        loadout.modifiers.splice(idx, 1);
      } else {
        sourceClone.activeCount = source.maxCount;
        loadout.modifiers.push(sourceClone);
      }
    } else if (source.category === 'independent') {
      const idx = loadout.independents.findIndex(s => s.id === source.id);
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
    if (source.category === 'modifier') return activeLoadout.modifiers.some(s => s.id === source.id);
    if (source.category === 'independent') return activeLoadout.independents.some(s => s.id === source.id);
    return false;
  }

  // --- MATH HOOKS ---
  function formatDPS(dps) {
    if (dps === 0) return "0 DPS";
    return `${formatLargeNumber(Math.floor(dps))} DPS`; 
  }

  function getTimeToDestroyInfo(tile, dps, maxTime) {
    if (dps === 0) return { text: "∞", color: "text-gray-600" };
    
    const seconds = Number(tile.health) / dps;

    if (seconds > maxTime) {
      return { text: `>${maxTime}s`, color: "text-red-500" };
    } else if (seconds > maxTime / 2) {
      return { text: `${seconds.toFixed(2)}s`, color: "text-orange-400" };
    } else {
      return { text: `${seconds.toFixed(2)}s`, color: "text-coal-gold" };
    }
  }
</script>

<div class="max-w-screen-2xl mx-auto p-6">
  
  <div class="mb-8">
    <h2 class="text-4xl font-bold text-coal-gold font-sans tracking-tight">Strategy Calculator</h2>
    <p class="text-gray-400 mt-2">Build setups and analyze your mining power against different blocks.</p>
  </div>

  <!-- TABS NAVIGATION -->
  <div class="flex gap-2 mb-6 border-b border-gray-700 pb-px">
    <button class="px-6 py-3 font-bold rounded-t-lg transition-colors {activeTab === 'power' ? 'bg-gray-800 text-coal-gold border-t border-l border-r border-gray-700' : 'bg-gray-900 text-gray-500 hover:text-white'}" onclick={() => activeTab = 'power'}>Current Power</button>
    <button class="px-6 py-3 font-bold rounded-t-lg transition-colors {activeTab === 'suggestions' ? 'bg-gray-800 text-coal-gold border-t border-l border-r border-gray-700' : 'bg-gray-900 text-gray-500 hover:text-white'}" onclick={() => activeTab = 'suggestions'}>Proposed Upgrades</button>
  </div>

  <div class="bg-gray-800 border border-gray-700 rounded-b-xl rounded-tr-xl p-6 shadow-2xl min-h-[60vh]">
    
    {#if activeTab === 'power'}
      <!-- BUILDER UI -->
      <div class="mb-8 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
        
        <!-- Loadout Selectors -->
        <div class="flex items-center gap-2 p-4 bg-black border-b border-gray-700 overflow-x-auto">
          <span class="text-gray-400 font-bold uppercase tracking-wider text-sm mr-2 shrink-0">Loadouts:</span>
          {#each gameState.calculatorLoadouts as loadout}
            <div class="flex items-center bg-gray-800 rounded-lg border {gameState.calculatorActiveLoadoutId === loadout.id ? 'border-coal-gold shadow-[0_0_8px_rgba(255,215,0,0.2)]' : 'border-gray-700 opacity-70'}">
              <button class="px-4 py-2 font-bold text-sm {gameState.calculatorActiveLoadoutId === loadout.id ? 'text-coal-gold' : 'text-gray-300'}" onclick={() => gameState.calculatorActiveLoadoutId = loadout.id}>
                {loadout.name}
              </button>
              {#if gameState.calculatorLoadouts.length > 1}
                <button class="px-2 py-2 text-gray-500 hover:text-red-400 transition-colors" onclick={() => removeLoadout(loadout.id)}>✕</button>
              {/if}
            </div>
          {/each}
          <button onclick={addLoadout} class="px-4 py-2 bg-gray-800 border border-gray-700 text-gray-400 hover:text-white rounded-lg font-bold transition-colors shrink-0">
            + Add Loadout
          </button>
        </div>

        <!-- Inventory Palette -->
        <div class="p-6">
          <p class="text-sm text-gray-400 mb-4">Click items to toggle them for <strong class="text-coal-gold">{activeLoadout.name}</strong>. Adjust quantities using the inputs.</p>
          
          <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <!-- Modifiers -->
            <div class="p-4 bg-gray-800/50 rounded-lg border border-blue-900/50">
              <h3 class="text-xs font-bold text-blue-400 mb-3 uppercase tracking-wider">Status Modifiers</h3>
              <div class="flex flex-wrap gap-2">
                {#each sources.modifiers as source}
                  <div role="button" tabindex="0" onclick={() => toggleItemInLoadout(source)} onkeydown={(e) => e.key === 'Enter' && toggleItemInLoadout(source)} class="flex items-center gap-2 px-2 py-1.5 rounded border transition-all cursor-pointer select-none {isSourceActive(source) ? 'bg-blue-900/40 border-blue-400' : 'bg-black border-gray-700 opacity-60 hover:opacity-100'}">
                    {#if source.pics}
                      <div class="relative w-5 h-5">
                        {#each source.pics as picBase64}
                          <img src={picBase64} alt="layer" class="absolute inset-0 w-full h-full object-contain rendering-pixelated" />
                        {/each}
                      </div>
                    {/if}
                    <div class="flex flex-col text-left">
                      <span class="text-xs font-bold {isSourceActive(source) ? 'text-white' : 'text-gray-400'}">{source.name}</span>
                      {#if isSourceActive(source)}
                        {@const activeRef = activeLoadout.modifiers.find(s => s.id === source.id)}
                        {#if source.isStackable}
                          <div class="mt-0.5 flex items-center gap-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
                            <input type="number" min="1" max={source.maxCount} bind:value={activeRef.activeCount} class="w-14 text-xs px-1 py-0.5 rounded bg-black text-white border border-gray-500 focus:border-coal-gold outline-none" />
                            <span class="text-[9px] text-gray-400">/ {formatLargeNumber(source.ownedCount)}</span>
                          </div>
                        {:else}
                          <span class="text-[9px] text-blue-300 mt-0.5 font-semibold">Active (Max 1)</span>
                        {/if}
                      {:else}
                        <span class="text-[9px] text-gray-500">Owned: {formatLargeNumber(source.ownedCount)}</span>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            </div>

            <!-- Independents -->
            <div class="p-4 bg-gray-800/50 rounded-lg border border-green-900/50 xl:col-span-2">
              <h3 class="text-xs font-bold text-green-400 mb-3 uppercase tracking-wider">Background DPS</h3>
              <div class="flex flex-wrap gap-2">
                {#each sources.independentSources as source}
                  <div role="button" tabindex="0" onclick={() => toggleItemInLoadout(source)} onkeydown={(e) => e.key === 'Enter' && toggleItemInLoadout(source)} class="flex items-center gap-2 px-2 py-1.5 rounded border transition-all cursor-pointer select-none {isSourceActive(source) ? 'bg-green-900/40 border-green-400' : 'bg-black border-gray-700 opacity-60 hover:opacity-100'}">
                    {#if source.pics}
                      <div class="relative w-5 h-5">
                        {#each source.pics as picBase64}
                          <img src={picBase64} alt="layer" class="absolute inset-0 w-full h-full object-contain rendering-pixelated" />
                        {/each}
                      </div>
                    {/if}
                    <div class="flex flex-col text-left">
                      <span class="text-xs font-bold {isSourceActive(source) ? 'text-white' : 'text-gray-400'}">{source.name}</span>
                      {#if isSourceActive(source)}
                        {@const activeRef = activeLoadout.independents.find(s => s.id === source.id)}
                        {#if source.isStackable}
                          <div class="mt-0.5 flex items-center gap-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
                            <input type="number" min="1" max={source.maxCount} bind:value={activeRef.activeCount} class="w-14 text-xs px-1 py-0.5 rounded bg-black text-white border border-gray-500 focus:border-coal-gold outline-none" />
                            <span class="text-[9px] text-gray-400">/ {formatLargeNumber(source.ownedCount)}</span>
                          </div>
                        {:else}
                          <span class="text-[9px] text-green-300 mt-0.5 font-semibold">Active (Max 1)</span>
                        {/if}
                      {:else}
                        <span class="text-[9px] text-gray-500">Owned: {formatLargeNumber(source.ownedCount)}</span>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            </div>

            <!-- Held Weapons -->
            <div class="p-4 bg-gray-800/50 rounded-lg border border-coal-gold/30 xl:col-span-3">
              <h3 class="text-xs font-bold text-coal-gold mb-3 uppercase tracking-wider">Held Weapon (Max 1)</h3>
              <div class="flex flex-wrap gap-2">
                {#each sources.heldWeapons as source}
                  <div role="button" tabindex="0" onclick={() => toggleItemInLoadout(source)} onkeydown={(e) => e.key === 'Enter' && toggleItemInLoadout(source)} class="flex items-center gap-2 px-2 py-1.5 rounded border transition-all cursor-pointer select-none {isSourceActive(source) ? 'bg-yellow-900/30 border-coal-gold shadow-[0_0_8px_rgba(255,215,0,0.3)]' : 'bg-black border-gray-700 opacity-60 hover:opacity-100'}">
                    {#if source.pics}
                      <div class="relative w-5 h-5">
                        {#each source.pics as picBase64}
                          <img src={picBase64} alt="layer" class="absolute inset-0 w-full h-full object-contain rendering-pixelated" />
                        {/each}
                      </div>
                    {/if}
                    <div class="flex flex-col text-left">
                      <span class="text-xs font-bold {isSourceActive(source) ? 'text-white' : 'text-gray-400'}">{source.name}</span>
                      <span class="text-[9px] text-gray-500">Owned: {formatLargeNumber(source.ownedCount)}</span>
                    </div>
                  </div>
                {/each}
              </div>
            </div>

            <!-- Passives Summary -->
            <div class="p-4 bg-gray-800/50 rounded-lg border border-purple-900/50 xl:col-span-3">
              <h3 class="text-xs font-bold text-purple-400 mb-3 uppercase tracking-wider">Active Passives Summary</h3>
              <div class="flex flex-wrap gap-2">
                {#each nonZeroPassives as passive}
                  {@const isActive = activePassiveKeys.has(passive.key)}
                  <div class="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono border transition-colors {isActive ? 'bg-purple-900/40 border-purple-400 text-white shadow-[0_0_8px_rgba(168,85,247,0.2)]' : 'bg-black border-gray-700 text-gray-500 opacity-60'}">
                    <span class="uppercase">{passive.name}:</span>
                    <span class="font-bold {isActive ? 'text-coal-gold' : ''}">+{Math.round(passive.value * 100)}%</span>
                  </div>
                {/each}
                {#if nonZeroPassives.length === 0}
                  <span class="text-xs text-gray-500 italic">No passives upgraded yet.</span>
                {/if}
              </div>
            </div>
            
          </div>
        </div>
      </div>

      <!-- TABLE FILTERS -->
      <div class="mb-4 bg-gray-900 border border-gray-700 rounded-xl p-4">
        
        <!-- Layer Filter -->
        <div class="mb-4">
          <h3 class="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Filter by Layer</h3>
          <div class="flex flex-wrap gap-2">
            {#each layerOptions as layer}
              <button 
                onclick={() => toggleLayerFilter(layer.name)}
                class="flex items-center gap-1.5 px-2 py-1 rounded border transition-all text-xs font-bold select-none {gameState.calculatorHiddenLayers.includes(layer.name) ? 'bg-black border-gray-700 text-gray-600 opacity-50' : 'bg-gray-800 border-gray-500 text-white hover:bg-gray-700 hover:border-gray-400'}"
              >
                {#if layer.pic}
                  <img src={layer.pic} alt={layer.name} class="w-4 h-4 rendering-pixelated object-contain" />
                {/if}
                <span class="capitalize">{layer.name}</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- Material Filter -->
        <div>
          <h3 class="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Filter by Material</h3>
          <div class="flex flex-wrap gap-2">
            {#each materialOptions as mat}
              <button 
                onclick={() => toggleMaterialFilter(mat.name)}
                class="flex items-center gap-1.5 px-2 py-1 rounded border transition-all text-xs font-bold select-none {gameState.calculatorHiddenMaterials.includes(mat.name) ? 'bg-black border-gray-700 text-gray-600 opacity-50' : 'bg-gray-800 border-gray-500 text-white hover:bg-gray-700 hover:border-gray-400'}"
              >
                {#if mat.pic}
                  <img src={mat.pic} alt={mat.name} class="w-4 h-4 rendering-pixelated object-contain" />
                {/if}
                <span class="capitalize">{mat.name}</span>
              </button>
            {/each}
          </div>
        </div>

      </div>

      <!-- INVERTED DATA TABLE (Rows = Loadouts, Cols = Tiles) -->
      <div class="overflow-x-auto rounded-lg border border-gray-700">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-gray-900 text-white text-sm uppercase tracking-wider">
              <th class="p-4 border-b border-r border-gray-700 min-w-[280px] sticky left-0 bg-gray-900 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">Loadout</th>
              
              {#each filteredTiles as tile}
                <th class="p-4 border-b border-gray-700 min-w-[120px]">
                  <div class="flex items-center gap-2">
                    {#if tile.pics_in_rock_base64 && tile.pics_in_rock_base64.length > 0}
                      <img src={tile.pics_in_rock_base64[0]} alt={tile.resource} class="w-6 h-6 rendering-pixelated object-contain" />
                    {/if}
                    <div>
                      <div class="font-bold leading-tight capitalize">{tile.resource}</div>
                      <div class="text-[10px] text-gray-400 leading-tight capitalize">{tile.layer}</div>
                    </div>
                  </div>
                </th>
              {/each}
              
              {#if filteredTiles.length === 0}
                <th class="p-4 border-b border-gray-700 text-gray-500 italic font-normal">No tiles match current filters.</th>
              {/if}
            </tr>
          </thead>
          <tbody class="text-sm divide-y divide-gray-700">
            {#each gameState.calculatorLoadouts as loadout}
              {@const rowDPS = calculateLoadoutDPS(loadout, gameState)}
              {@const maxTime = gameState.secondsPerRound || 300}
              {@const isEditing = gameState.calculatorActiveLoadoutId === loadout.id}
              
              <tr class="hover:bg-gray-700/50 transition-colors {isEditing ? 'bg-gray-800/80' : ''}">
                
                <!-- Loadout Info (Sticky Left) -->
                <td class="p-4 border-r border-gray-700 sticky left-0 bg-gray-800 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                  <div class="flex justify-between items-start mb-2">
                    <button 
                      class="font-bold flex items-center gap-2 transition-colors focus:outline-none {isEditing ? 'text-coal-gold' : 'text-white hover:text-gray-300'}"
                      onclick={() => gameState.calculatorActiveLoadoutId = loadout.id}
                      title="Click to edit this loadout"
                    >
                      {loadout.name}
                    </button>
                    <div class="text-xs font-mono text-gray-300 bg-gray-900 border border-gray-700 px-2 py-1 rounded">
                      {formatDPS(rowDPS)}
                    </div>
                  </div>
                  
                  <!-- Mini icons of the loadout contents -->
                  <div class="flex flex-wrap gap-2 pt-1">
                    {#if loadout.heldWeapon}
                      <div class="relative w-6 h-6 border border-coal-gold bg-black rounded" title={loadout.heldWeapon.name}>
                        {#each loadout.heldWeapon.pics as pic}
                          <img src={pic} alt="wep" class="absolute inset-0 w-full h-full object-contain rendering-pixelated" />
                        {/each}
                      </div>
                    {/if}
                    
                    {#each loadout.modifiers as mod}
                      <div class="relative w-6 h-6 border border-blue-500 bg-black rounded" title={mod.name}>
                        {#each mod.pics as pic}
                          <img src={pic} alt="mod" class="absolute inset-0 w-full h-full object-contain rendering-pixelated" />
                        {/each}
                        {#if mod.activeCount > 1}
                          <span class="absolute -bottom-2 -right-2 bg-gray-900 text-white text-[9px] font-bold px-1 rounded-full border border-gray-700">x{formatLargeNumber(mod.activeCount)}</span>
                        {/if}
                      </div>
                    {/each}

                    {#each loadout.independents as ind}
                      <div class="relative w-6 h-6 border border-green-500 bg-black rounded" title={ind.name}>
                        {#each ind.pics as pic}
                          <img src={pic} alt="ind" class="absolute inset-0 w-full h-full object-contain rendering-pixelated" />
                        {/each}
                        {#if ind.activeCount > 1}
                          <span class="absolute -bottom-2 -right-2 bg-gray-900 text-white text-[9px] font-bold px-1 rounded-full border border-gray-700">x{formatLargeNumber(ind.activeCount)}</span>
                        {/if}
                      </div>
                    {/each}

                    {#if !loadout.heldWeapon && loadout.modifiers.length===0 && loadout.independents.length===0}
                      <span class="text-xs text-gray-500 italic mt-1">Empty Loadout</span>
                    {/if}
                  </div>
                </td>

                <!-- Tile Calculations -->
                {#each filteredTiles as tile}
                  {@const ttk = getTimeToDestroyInfo(tile, rowDPS, maxTime)}
                  <td class="p-4 align-middle border-r border-gray-700 last:border-r-0 text-center">
                    <div class="font-mono font-bold {ttk.color} text-base">{ttk.text}</div>
                  </td>
                {/each}
                
                {#if filteredTiles.length === 0}
                  <td class="p-4 bg-gray-900/50"></td>
                {/if}

              </tr>
            {/each}
          </tbody>
        </table>
      </div>

    {:else}
      <!-- PROPOSED UPGRADES TAB -->
      <div class="text-center py-20">
        <h3 class="text-2xl font-bold text-gray-400 mb-2">Algorithm processing...</h3>
        <p class="text-gray-500">Upgrade suggestions logic will go here!</p>
      </div>
    {/if}

  </div>
</div>

