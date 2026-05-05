<script lang="ts">
  import favicon from '$lib/assets/favicon.svg';
  import '../app.css';
  import { gameState, GAME_OPTIONS } from '$lib/game.svelte.js';
  import { page } from '$app/stores';
  import { resolve } from '$app/paths';
  import { handleSaveFileUpload } from '$lib/saveHandler.js';

  const navLinks = [
    { href: resolve('/'), label: 'Welcome' },
    { href: resolve('/employees'), label: 'Employees' },
    { href: resolve('/equipment'), label: 'Equipment' },
    { href: resolve('/passives'), label: 'Passives' },
    { href: resolve('/calculator'), label: 'Calculator' }
  ];

  let theme = $state('dark');
  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.className = theme;
  }

  // UI States
  let isEditingCash = $state(false);
  let isEditingDay = $state(false);
  let isEditingProfession = $state(false);
  let isEditingMap = $state(false);
  let isEditingMode = $state(false);
  let isEditingTime = $state(false);
  let dragCounter = $state(0);
  let isDragging = $derived(dragCounter > 0);

  let rawCashInput = $state("");

  let formattedCash = $derived.by(() => {
    if (gameState.cash >= 1000000000n) {
      const str = gameState.cash.toString();
      const exponent = str.length - 1;
      const mantissa = str.slice(0, 3).padEnd(3, '0');
      return `${mantissa[0]}.${mantissa.slice(1)}e+${exponent}`;
    }
    return new Intl.NumberFormat('en-US').format(gameState.cash);
  });

  let formattedQuota = $derived(new Intl.NumberFormat('en-US').format(gameState.quota));

  function startEditingCash() {
    rawCashInput = gameState.cash.toString();
    isEditingCash = true;
  }

  function saveCash() {
    try {
      let val = rawCashInput.toLowerCase().replace(/,/g, '').trim();

      if (val.includes('e')) {
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
      // Revert silently
    }
    isEditingCash = false;
  }

  function handleDayInput(event) {
    gameState.day = Math.max(1, parseInt(event.target.value) || 1);
  }

  function handleEnter(event) {
    if (event.key === 'Enter') event.target.blur();
  }

  // --- Drag and Drop Handlers ---
  function handleDragOver(e) {
    e.preventDefault();
  }

  function handleDragEnter(e) {
    e.preventDefault();
    dragCounter++;
  }

  function handleDragLeave(e) {
    e.preventDefault();
    dragCounter--;
  }

  async function handleDrop(e) {
    e.preventDefault();
    dragCounter = 0; // Reset counter on drop

    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const item = e.dataTransfer.items[0];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        await handleSaveFileUpload(file);
      }
    }
  }

  async function handleHeaderFileInput(e) {
    const file = e.target.files[0];
    if (file) {
      await handleSaveFileUpload(file);
      // Reset input so the same file can be uploaded again if needed
      e.target.value = null;
    }
  }

  let { children } = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <title>Calc LLC</title>
</svelte:head>

<!-- Global Drag Container -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="flex flex-col h-screen overflow-hidden relative"
  ondragover={handleDragOver}
  ondragenter={handleDragEnter}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
>

  {#if isDragging}
    <!-- Add pointer-events-none here to ensure the overlay cannot trigger dragleave -->
    <div class="absolute inset-0 z-[100] bg-black/60 flex items-center justify-center backdrop-blur-sm pointer-events-none">
      <div class="text-4xl font-bold text-white border-4 border-dashed border-white p-12 rounded-2xl pointer-events-none">
        Drop Save File Here
      </div>
    </div>
  {/if}

  <div class="shrink-0 shadow-2xl z-50">
    <header class="bg-transparent theme-text-accent p-4 border-b-2 theme-border flex justify-between text-sm sm:text-base">

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
              class="w-24 theme-surface theme-text border theme-border-hover rounded px-1 outline-none"
              autofocus
            />
          {:else}
            <button onclick={startEditingCash} class="font-bold underline cursor-pointer hover:theme-text px-1">
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
              class="w-16 theme-surface theme-text border theme-border-hover rounded px-1 outline-none"
              autofocus
            />
          {:else}
            <button onclick={() => isEditingDay = true} class="font-bold underline cursor-pointer hover:theme-text px-1">
              {gameState.day}
            </button>
          {/if}
          - upcoming coal quota: {formattedQuota}
        </div>

        <div class="flex gap-2">
          <button
            class="px-3 py-1 border theme-border rounded theme-surface-hover theme-text-muted"
            onclick={toggleTheme}
          >
            {theme === "dark" ? "☀️ Light" : "🌑 Dark"}
          </button>

          <!-- Header File Upload Button -->
          <label class="px-3 py-1 border theme-border rounded theme-surface-hover theme-text-muted cursor-pointer">
            📁 Load Save
            <input
              type="file"
              accept=".json,.save"
              class="hidden"
              onchange={handleHeaderFileInput}
            />
          </label>
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
              class="theme-surface theme-text border theme-border-hover rounded px-1 outline-none cursor-pointer"
              autofocus
            >
              {#each GAME_OPTIONS.professions as option}
                <option value={option.profession_id}>{option.profession_name}</option>
              {/each}
            </select>
          {:else}
            <button onclick={() => isEditingProfession = true} class="theme-text hover:underline cursor-pointer">
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
              class="theme-surface theme-text border theme-border-hover rounded px-1 outline-none cursor-pointer"
              autofocus
            >
              {#each GAME_OPTIONS.maps as option}
                <option value={option}>{option}</option>
              {/each}
            </select>
          {:else}
            <button onclick={() => isEditingMap = true} class="theme-text hover:underline cursor-pointer">
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
              class="theme-surface theme-text border theme-border-hover rounded px-1 outline-none cursor-pointer"
              autofocus
            >
              {#each GAME_OPTIONS.modes as option}
                <option value={option}>{option}</option>
              {/each}
            </select>
          {:else}
            <button onclick={() => isEditingMode = true} class="theme-text hover:underline cursor-pointer">
              {gameState.mode}
            </button>
          {/if}
        </div>

        <div>Round Time:
          {#if isEditingTime}
            <select
              bind:value={gameState.secondsPerRound}
              onblur={() => isEditingTime = false}
              onchange={() => isEditingTime = false}
              class="theme-surface theme-text border theme-border-hover rounded px-1 outline-none cursor-pointer"
              autofocus
            >
              {#each GAME_OPTIONS.roundTimes as option}
                <option value={option}>{option}s</option>
              {/each}
            </select>
          {:else}
            <button onclick={() => isEditingTime = true} class="theme-text hover:underline cursor-pointer">
              {gameState.secondsPerRound}s
            </button>
          {/if}
        </div>
      </div>
    </header>

    <nav class="flex gap-4 p-4 theme-surface border-b theme-border overflow-x-auto">
      {#each navLinks as { href, label }}
        <a
          {href}
          class="px-2 py-1 transition-all duration-200 border-b-2 whitespace-nowrap
            {$page.url.pathname === href
              ? 'theme-text-accent border-[var(--accent)] font-bold'
              : 'theme-text-muted border-transparent hover:theme-text hover:border-[var(--border-main)]'}"
        >
          {label}
        </a>
      {/each}
    </nav>
  </div>

  <main class="flex-1 overflow-y-auto bg-[var(--bg-main)] text-[var(--text-main)] transition-colors duration-300">
    <div class="relative min-h-full">
      {@render children()}
    </div>
  </main>
</div>

