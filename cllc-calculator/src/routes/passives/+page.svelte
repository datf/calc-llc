<!-- src/routes/passives/+page.svelte -->
<script>
  import { gameState } from '$lib/game.svelte.js';
  import { PASSIVE_KEYS, passivesInfo } from '$lib/database.js';

  function formatLabel(key) {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Convert float to percentage for the UI (0.14 -> 14)
  function getDisplayPercent(floatValue) {
    return Number((floatValue * 100).toFixed(2));
  }

  // Convert UI percentage back to float for the save state (14 -> 0.14)
  function handleInput(key, event) {
    let percent = parseFloat(event.target.value);
    if (isNaN(percent)) percent = 0;
    
    // Divide by 100 and round to 4 decimals to avoid JS floating-point junk
    gameState.passives[key] = Number((percent / 100).toFixed(4));
  }
</script>

<div class="max-w-5xl mx-auto p-6">
  <div class="mb-6 text-center">
    <h2 class="text-3xl md:text-4xl font-bold theme-text-accent tracking-tight mb-2">
      Passive Effects
    </h2>

    <p class="text-base theme-text-muted max-w-2xl mx-auto">
      Adjust your global multipliers as percentages (e.g., 100 = +100%).
    </p>
  </div>

  <div class="theme-surface theme-surface-hover border theme-border rounded-xl p-6 shadow-2xl">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      
      {#each PASSIVE_KEYS as key}
        <div class="theme-surface border theme-border rounded-lg p-4 flex flex-col justify-center h-24">
          <label for={key} class="block text-sm font-bold theme-text mb-2">
            {formatLabel(key)}
          </label>
          
          <div class="flex items-center gap-2">
            <input 
              id={key}
              type="number" 
              step={getDisplayPercent(passivesInfo[key])} 
              value={getDisplayPercent(gameState.passives[key])}
              oninput={(e) => handleInput(key, e)}
              class="w-full theme-surface border theme-border theme-text p-2 rounded theme-border-focus focus:outline-none focus:ring-1 focus:ring-coal-gold font-mono"
            />
            <span class="theme-text-accent font-bold text-lg">%</span>
          </div>
        </div>
      {/each}

    </div>
  </div>
</div>

