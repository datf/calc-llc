
<script>
  import { gameState } from '$lib/game.svelte.js';
  import { getItemsForProfession, items } from '$lib/database.js';
  import { formatLargeNumber, formatDecimal } from '$lib/utils.js';

  let availableEquipment = $derived([...getItemsForProfession(gameState.professionId)]);
  
  // Derive the active inventory items (filtering out items with 0 quantity)
  let activeInventory = $derived(
    Object.entries(gameState.inventory)
      .filter(([id, qty]) => qty > 0n)
      .map(([id, qty]) => ({ item: items.get(id), qty }))
  );

  // POPUP STATE FOR CUSTOM AMOUNTS
  let showPopup = $state(false);
  let selectedItem = $state(null);
  let inputQty = $state(1n);

  function handleQtyInput(e) {
    try {
      let val = e.target.value.replace(/,/g, '');
      inputQty = BigInt(val || 0);
    } catch (err) {}
  }

  let totalCost = $derived(selectedItem ? selectedItem.itemBuyPrice * inputQty : 0n);
  let totalSell = $derived(selectedItem ? (selectedItem.itemSellPrice ? selectedItem.itemSellPrice : selectedItem.itemBuyPrice / 2n) * inputQty : 0n);
  let canAfford = $derived(gameState.cash >= totalCost);

  // ACTIONS
  function buySingle(item) {
    if (gameState.cash >= item.itemBuyPrice) {
      gameState.cash -= item.itemBuyPrice;
      gameState.inventory[item.itemID] = (gameState.inventory[item.itemID] || 0n) + 1n;
    }
  }

  function openPopup(item, e) {
    e.preventDefault(); // Prevent context menu from appearing
    selectedItem = item;
    inputQty = 1n;
    showPopup = true;
  }

  function buyQty() {
    if (canAfford) {
      gameState.cash -= totalCost;
      gameState.inventory[selectedItem.itemID] = (gameState.inventory[selectedItem.itemID] || 0n) + inputQty;
      showPopup = false;
    }
  }

  function sellQty() {
    let currentQty = gameState.inventory[selectedItem.itemID] || 0n;
    if (currentQty >= inputQty) {
      gameState.cash += totalSell;
      gameState.inventory[selectedItem.itemID] -= inputQty;
      showPopup = false;
    }
  }

  function setQty() {
    gameState.inventory[selectedItem.itemID] = inputQty;
    showPopup = false;
  }
</script>

<!-- CUSTOM AMOUNT MODAL -->
{#if showPopup && selectedItem}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onmousedown={(e) => { if (e.target === e.currentTarget) showPopup = false; }}>
    <div class="bg-gray-800 p-6 rounded border border-gray-600 shadow-2xl flex flex-col gap-4 w-80 text-white">
      <h3 class="text-xl text-coal-gold font-bold text-center border-b border-gray-700 pb-2">{selectedItem.itemName}</h3>
      <div class="flex flex-col gap-2">
        <label class="text-sm text-gray-400">Quantity</label>
        <input type="text" value={inputQty} oninput={handleQtyInput} class="bg-gray-900 border border-gray-600 rounded px-2 py-2 text-white text-lg text-center font-bold" />
      </div>
      <div class="flex flex-col gap-2 mt-2">
        <button onclick={buyQty} disabled={!canAfford} class="bg-green-700 hover:bg-green-600 disabled:bg-gray-700 disabled:text-gray-500 py-2 rounded font-bold transition-colors">
          Buy (Cost: ${formatLargeNumber(totalCost)})
        </button>
        <button onclick={sellQty} disabled={(gameState.inventory[selectedItem.itemID] || 0n) < inputQty} class="bg-red-700 hover:bg-red-600 disabled:bg-gray-700 disabled:text-gray-500 py-2 rounded font-bold transition-colors">
          Sell (Refund: ${formatLargeNumber(totalSell)})
        </button>
        <button onclick={setQty} class="bg-blue-700 hover:bg-blue-600 py-2 rounded font-bold transition-colors mt-2 border-t border-gray-600 pt-2">
          Set Quantity
        </button>
      </div>
    </div>
  </div>
{/if}
<div class="flex flex-col lg:flex-row gap-8">
  
  <!-- LEFT PANEL: SHOP (Flexes to fill remaining space) -->
  <div class="flex-1">
    <h2 class="text-2xl font-bold mb-1">Equipment Shop</h2>
    <p class="text-sm text-gray-400 mb-4 italic">Left-click to buy 1. Right-click to buy custom amount.</p>

    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {#each availableEquipment as item}
        <!-- Notice we apply the actions directly to the whole card! -->
        <button 
          class="bg-gray-800 p-4 rounded border border-gray-700 flex flex-col text-left hover:border-coal-gold transition-colors
                 {gameState.cash < item.itemBuyPrice ? 'opacity-50' : ''}"
          onclick={() => buySingle(item)}
          oncontextmenu={(e) => openPopup(item, e)}
        >
          
          <h3 class="text-lg text-coal-gold font-bold border-b border-gray-700 pb-2 mb-3 leading-tight w-full">
            {item.itemName} - <br/><span class="text-white">${formatLargeNumber(item.itemBuyPrice)}</span>
          </h3>

          <div class="flex gap-3 flex-1 mb-4 w-full">
            <div class="shrink-0">
              {#if item.picB64}
                <img src={item.picB64} alt={item.itemName} class="w-16 h-16 object-contain bg-gray-900 rounded p-1 border border-gray-700" style="image-rendering: pixelated;"/>
              {:else}
                <div class="w-16 h-16 bg-gray-900 border border-gray-700 flex items-center justify-center text-2xl rounded">📦</div>
              {/if}
            </div>

            <div class="flex-1 text-xs text-gray-300 flex flex-col gap-1">
              {#if item.damage}<p>Dmg: <span class="text-white font-bold">{formatLargeNumber(item.damage)}</span></p>{/if}
              {#if item.Strength}<p>Str: <span class="text-white">{formatLargeNumber(item.Strength)}</span></p>{/if}
              {#if item.cooldown_secs}<p>CD: <span class="text-white">{item.cooldown_secs}s</span></p>{/if}
            </div>
          </div>
        </button>
      {/each}
    </div>
  </div>

  <!-- RIGHT PANEL: INVENTORY (Fixed width, visual grid) -->
  <!-- lg:w-80 keeps the panel nice and neat on the right side of the screen -->
  <div class="lg:w-80 shrink-0">
    <div class="sticky top-4">
      <h2 class="text-2xl font-bold mb-4 text-coal-gold border-b border-gray-700 pb-2">Inventory</h2>
      
      <!-- A neat 4-column visual grid to mimic the game's UI -->
      <div class="bg-gray-800 p-4 rounded border border-gray-700">
        {#if activeInventory.length === 0}
          <p class="text-gray-500 italic text-center py-8">Your inventory is empty.</p>
        {:else}
          <div class="grid grid-cols-4 gap-2">
            {#each activeInventory as {item, qty}}
              <button 
                class="relative w-14 h-14 bg-gray-900 border border-gray-600 rounded flex items-center justify-center hover:border-coal-gold cursor-pointer"
                oncontextmenu={(e) => openPopup(item, e)}
                onclick={(e) => openPopup(item, e)}
                title="{item.itemName}"
              >
                {#if item.picB64}
                  <img src={item.picB64} class="w-10 h-10 object-contain" style="image-rendering: pixelated;" />
                {/if}
                
                <!-- Format the quantity if it gets ridiculously high -->
                <div class="absolute -bottom-2 -right-2 bg-gray-700 text-white text-[10px] font-bold px-1 rounded border border-gray-900 z-10 shadow">
                  x{formatLargeNumber(qty)}
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>
      
    </div>
  </div>

</div>
