<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
	import { gameState, GAME_OPTIONS } from '$lib/game.svelte.js';

	// UI States
	let isEditingCash = $state(false);
	let isEditingDay = $state(false);
	let isEditingProfession = $state(false);
	let isEditingMap = $state(false);
	let isEditingMode = $state(false);
	let isEditingTime = $state(false);


	// Temporary string to hold cash input while typing
	let rawCashInput = $state("");

	// Format cash: Standard up to 999,999,999, Scientific for 1e9+
	let formattedCash = $derived.by(() => {
			if (gameState.cash >= 1000000000n) {
			const str = gameState.cash.toString();
			const exponent = str.length - 1;
			// Grab first 3 digits for the mantissa (e.g. "123" -> "1.23")
			const mantissa = str.slice(0, 3).padEnd(3, '0'); 
			return `${mantissa[0]}.${mantissa.slice(1)}e+${exponent}`;
			}
			return new Intl.NumberFormat('en-US').format(gameState.cash);
			});

let formattedQuota = $derived(new Intl.NumberFormat('en-US').format(gameState.quota));

// --- Handlers ---

function startEditingCash() {
	rawCashInput = gameState.cash.toString();
	isEditingCash = true;
}

function saveCash() {
	try {
		let val = rawCashInput.toLowerCase().replace(/,/g, '').trim();

		if (val.includes('e')) {
			// Parse scientific notation (e.g., "1.5e9") into BigInt
			let [base, exp] = val.split('e');
			let expNum = parseInt(exp) || 0;
			let decimals = 0;

			if (base.includes('.')) {
				const parts = base.split('.');
				base = parts[0] + parts[1];
				decimals = parts[1].length;
			}

			expNum -= decimals;
			if (expNum < 0) throw new Error("Too small");
			gameState.cash = BigInt(base) * (10n ** BigInt(expNum));
		} else {
			gameState.cash = BigInt(val || 0);
		}
	} catch (e) {
		// Revert if input was completely invalid
	}
	isEditingCash = false;
}

function handleDayInput(event) {
	gameState.day = Math.max(1, parseInt(event.target.value) || 1);
}

// Helper to commit edits on Enter key
function handleEnter(event) {
	if (event.key === 'Enter') event.target.blur();
}

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="flex flex-col h-screen overflow-hidden">

  <div class="shrink-0 shadow-2xl z-50">

<header class="bg-coal-dark text-coal-gold p-4 border-b-2 border-gray-700 flex justify-between text-sm sm:text-base">
  
  <!-- Left Column -->
  <div class="flex flex-col gap-2">
    <div class="flex items-center gap-1">
      Cash: 
      {#if isEditingCash}
        <input 
          type="text" 
          bind:value={rawCashInput} 
          onblur={saveCash}
          onkeydown={handleEnter}
          class="w-24 bg-gray-800 text-white border border-coal-gold rounded px-1 outline-none"
          autofocus
        />
      {:else}
        <button onclick={startEditingCash} class="font-bold underline cursor-pointer hover:text-white px-1">
          {formattedCash}
        </button>
      {/if}
      g
    </div>

    <div class="flex items-center gap-1">
      Day 
      {#if isEditingDay}
        <input 
          type="number" 
          value={gameState.day} 
          oninput={handleDayInput}
          onblur={() => isEditingDay = false}
          onkeydown={handleEnter}
          class="w-16 bg-gray-800 text-white border border-coal-gold rounded px-1 outline-none"
          autofocus
        />
      {:else}
        <button onclick={() => isEditingDay = true} class="font-bold underline cursor-pointer hover:text-white px-1">
          {gameState.day}
        </button>
      {/if}
      - upcoming coal quota: {formattedQuota}
    </div>
  </div>

  <!-- Right Column -->
  <div class="flex flex-col gap-2 text-right">
    
<div>Profession: 
  {#if isEditingProfession}
    <select 
      bind:value={gameState.professionId} 
      onblur={() => isEditingProfession = false}
      onchange={() => isEditingProfession = false}
      class="bg-gray-800 text-white border border-coal-gold rounded px-1 outline-none cursor-pointer"
      autofocus
    >
      {#each GAME_OPTIONS.professions as option}
        <option value={option.profession_id}>{option.profession_name}</option>
      {/each}
    </select>
  {:else}
    <!-- Look up the matching name for the current professionId to display -->
    <button onclick={() => isEditingProfession = true} class="text-white hover:underline cursor-pointer">
      {GAME_OPTIONS.professions.find(p => p.profession_id === gameState.professionId)?.profession_name || gameState.professionId}
    </button>
  {/if}
</div>

    <div>Map: 
      {#if isEditingMap}
        <select 
          bind:value={gameState.map} 
          onblur={() => isEditingMap = false}
          onchange={() => isEditingMap = false}
          class="bg-gray-800 text-white border border-coal-gold rounded px-1 outline-none cursor-pointer"
          autofocus
        >
          {#each GAME_OPTIONS.maps as option}
            <option value={option}>{option}</option>
          {/each}
        </select>
      {:else}
        <button onclick={() => isEditingMap = true} class="text-white hover:underline cursor-pointer">
          {gameState.map}
        </button>
      {/if}
    </div>

    <div>Mode: 
      {#if isEditingMode}
        <select 
          bind:value={gameState.mode} 
          onblur={() => isEditingMode = false}
          onchange={() => isEditingMode = false}
          class="bg-gray-800 text-white border border-coal-gold rounded px-1 outline-none cursor-pointer"
          autofocus
        >
          {#each GAME_OPTIONS.modes as option}
            <option value={option}>{option}</option>
          {/each}
        </select>
      {:else}
        <button onclick={() => isEditingMode = true} class="text-white hover:underline cursor-pointer">
          {gameState.mode}
        </button>
      {/if}
    </div>

        <!-- Time Option -->
        <div>Round Time: 
          {#if isEditingTime}
            <select 
              bind:value={gameState.secondsPerRound} 
              onblur={() => isEditingTime = false}
              onchange={() => isEditingTime = false}
              class="bg-gray-800 text-white border border-coal-gold rounded px-1 outline-none cursor-pointer"
              autofocus
            >
              {#each GAME_OPTIONS.roundTimes as option}
                <option value={option}>{option}s</option>
              {/each}
            </select>
          {:else}
            <button onclick={() => isEditingTime = true} class="text-white hover:underline cursor-pointer">
              {gameState.secondsPerRound}s
            </button>
          {/if}
        </div>

  </div>
</header>


<nav class="flex gap-4 p-4 bg-gray-900 border-b border-coal-gold">
  <a href="#/" class="text-coal-gold hover:text-white transition">Welcome</a>
  <a href="#/character" class="text-coal-gold hover:text-white transition">Character Setup</a>
  <a href="#/employees" class="text-coal-gold hover:text-white transition">Employees</a>
  <a href="#/equipment" class="text-coal-gold hover:text-white transition">Equipment</a>
  <a href="#/passives" class="text-coal-gold hover:text-white transition">Passives</a>
  <a href="#/calculator" class="text-coal-gold hover:text-white transition">Calculator</a>
</nav>
</div>

  <main class="flex-1 overflow-y-auto">
    <div class="relative">
      {@render children()} 
    </div>
  </main>
</div>
