
<script>
  import OrgNode from './OrgNode.svelte';
  import { formatLargeNumber } from '$lib/utils.js';
  import { gameState } from '$lib/game.svelte.js';
  import { employees, items } from '$lib/database.js';

  let { employee } = $props();

  // Find the equipment item this employee uses
  let heldItem = $derived(
    employee.equipment_itemID ? items.get(employee.equipment_itemID) : null
  );

  // POPUP STATE
  let showPopup = $state(false);
  let inputQty = $state(1n);

  function handleQtyInput(e) {
    try {
      let val = e.target.value.replace(/,/g, '');
      inputQty = BigInt(val || 0);
    } catch (err) {}
  }

  // BIG INT ROSTER LOGIC
  let ownedCount = $derived(gameState.hiredEmployees[employee.employee_id] || 0n);

  let totalCost = $derived(employee.upgrade_cost * inputQty);
  let canAfford = $derived(gameState.cash >= totalCost);

  // Use itemSellPrice if it exists, otherwise fallback to 50% of upgrade cost
  let sellPrice = $derived(employee.itemSellPrice ? BigInt(employee.itemSellPrice) : (employee.upgrade_cost / 2n));
  let totalSell = $derived(sellPrice * inputQty);

  // Do we have enough prerequisites to upgrade `inputQty` times?
  let prereqCount = $derived.by(() => {
    if (!employee.upgrades_from || employee.upgrades_from === "23") return -1n; // Infinite prereqs for Interns
    let count = 0n;
    for (const [hiredId, qty] of Object.entries(gameState.hiredEmployees)) {
      if (qty > 0n) {
        const hiredEmp = employees.get(hiredId);
        if (hiredEmp && hiredEmp.level_name === employee.upgrades_from) count += qty;
      }
    }
    return count;
  });

  let hasPrerequisiteForQty = $derived(prereqCount === -1n || prereqCount >= inputQty);
  let hasPrerequisiteForOne = $derived(prereqCount === -1n || prereqCount >= 1n);

  // NEW: The node is enabled if you can buy it OR if you already own it
  let isEnabled = $derived(hasPrerequisiteForOne || ownedCount > 0n);

  // ACTIONS
  function buyQty() {
    if (canAfford && hasPrerequisiteForQty) {
      gameState.cash -= totalCost;
      
      // Deduct prerequisites
      if (prereqCount !== -1n) {
        let needed = inputQty;
        for (const [hiredId, qty] of Object.entries(gameState.hiredEmployees)) {
          if (needed <= 0n) break;
          const hiredEmp = employees.get(hiredId);
          if (hiredEmp && hiredEmp.level_name === employee.upgrades_from && qty > 0n) {
            let take = qty >= needed ? needed : qty;
            gameState.hiredEmployees[hiredId] -= take;
            needed -= take;
          }
        }
      }
      gameState.hiredEmployees[employee.employee_id] = ownedCount + inputQty;
      showPopup = false;
    }
  }

  function sellQty() {
    if (ownedCount >= inputQty) {
      gameState.cash += totalSell;
      gameState.hiredEmployees[employee.employee_id] -= inputQty;
      showPopup = false;
    }
  }

  function setQty() {
    gameState.hiredEmployees[employee.employee_id] = inputQty;
    showPopup = false;
  }
</script>

<!-- MODAL OVERLAY -->
{#if showPopup}
  <!-- Use onmousedown and check the target so dragging text doesn't trigger a close -->
  <div 
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/80" 
    onmousedown={(e) => { if (e.target === e.currentTarget) showPopup = false; }}
  >
    <div class="bg-gray-800 p-6 rounded border border-gray-600 shadow-2xl flex flex-col gap-4 w-80 text-white">
      <h3 class="text-xl text-coal-gold font-bold text-center border-b border-gray-700 pb-2">{employee.employee_id}</h3>
      
      <div class="flex flex-col gap-2">
        <label class="text-sm text-gray-400">Quantity</label>
        <input type="text" value={inputQty} oninput={handleQtyInput} class="bg-gray-900 border border-gray-600 rounded px-2 py-2 text-white text-lg text-center font-bold" />
      </div>

      <div class="flex flex-col gap-2 mt-2">
        <button onclick={buyQty} disabled={!canAfford || !hasPrerequisiteForQty} class="bg-green-700 hover:bg-green-600 disabled:bg-gray-700 disabled:text-gray-500 py-2 rounded font-bold transition-colors">
          Buy (Cost: ${formatLargeNumber(totalCost)})
        </button>
        <button onclick={sellQty} disabled={ownedCount < inputQty} class="bg-red-700 hover:bg-red-600 disabled:bg-gray-700 disabled:text-gray-500 py-2 rounded font-bold transition-colors">
          Sell (Refund: ${formatLargeNumber(totalSell)})
        </button>
        <button onclick={setQty} class="bg-blue-700 hover:bg-blue-600 py-2 rounded font-bold transition-colors mt-2 border-t border-gray-600 pt-2">
          Set Quantity (Free)
        </button>
      </div>
    </div>
  </div>
{/if}

<div class="flex flex-col items-center">

  {#if employee.promotions && employee.promotions.length > 0}
    <div class="flex items-end">
      {#each employee.promotions as promo, index}
        <div class="relative flex flex-col items-center px-4">
          <OrgNode employee={promo} />
          <div class="w-px h-6 bg-red-700"></div>
          {#if employee.promotions.length > 1}
            <div class="absolute bottom-0 h-0.5 bg-red-700 {index === 0 ? 'left-1/2 right-0' : index === employee.promotions.length - 1 ? 'left-0 right-1/2' : 'left-0 right-0'}"></div>
          {/if}
        </div>
      {/each}
    </div>
    <div class="w-px h-6 bg-red-700"></div>
  {/if}

  <div class="relative z-10 flex flex-col items-center mb-2">
    
    {#if ownedCount > 0n}
      <!-- formatLargeNumber prevents huge numbers from blowing out the box -->
      <div class="absolute -top-3 -right-3 bg-green-500 text-white text-xs font-bold px-1 rounded border border-black z-20">
        x{formatLargeNumber(ownedCount)}
      </div>
    {/if}

    <button 
      class="relative w-16 h-20 bg-gray-400 border-2 border-gray-600 shadow-md cursor-pointer hover:border-white transition-all flex justify-center {!isEnabled ? 'opacity-50 grayscale' : ''}"
      onclick={() => showPopup = true}
      title="{employee.employee_id}"
    >
      <div style="image-rendering: pixelated;" class="relative w-10 h-full flex justify-center">
        {#if employee.wings_texture_base64}
          <img src={employee.wings_texture_base64} alt="Wings" class="absolute h-10 z-0 max-w-none left-1/2 -translate-x-1/2" style="width: 120px; top: 16px;" />
        {/if}
        {#if employee.legs_texture_base64}
          <img src={employee.legs_texture_base64} alt="Legs" class="absolute w-10 h-10 z-10" style="top: 24px;" />
        {/if}
        {#if employee.torso_texture_base64}
          <img src={employee.torso_texture_base64} alt="Torso" class="absolute w-10 h-10 z-20" style="top: 24px;" />
        {/if}
        {#if employee.head_texture_base64}
          <img src={employee.head_texture_base64} alt="Head" class="absolute w-10 h-10 z-30" style="top: 8px;" />
        {/if}
        
        <!-- LAYER 5: HELD ITEM (Front of everything, z-40) -->
        {#if heldItem && heldItem.picB64}
          <img src={heldItem.picB64} alt={heldItem.itemName} class="absolute w-8 h-8 z-40 transform rotate-45" style="top: 32px; left: 16px;" />
        {/if}
      </div>
    </button>

    <div class="mt-1 bg-amber-100 text-black text-xs font-mono px-1 border border-dashed border-gray-600">
      ${formatLargeNumber(employee.upgrade_cost)}
    </div>
  </div>

</div>
