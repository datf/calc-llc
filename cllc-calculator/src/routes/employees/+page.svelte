<script>
  import { getOrgChart } from '$lib/database.js';
  import { gameState } from '$lib/game.svelte.js';
  import OrgNode from './OrgNode.svelte';

  let orgChart = $derived(getOrgChart(gameState.professionId));

</script>

<div class="bg-amber-50 p-8 rounded-lg border-2 border-black overflow-x-auto">
  
  <div class="text-center mb-10">
    <h2 class="text-3xl font-bold text-black font-sans">Organisation Chart</h2>
    <p class="text-sm text-black italic mt-1">
      Higher ranking employees must be promoted from lower ranks. Only interns can be purchased outright.
    </p>
  </div>

  <!-- Render the top tier nodes side-by-side -->
  <div class="flex justify-center gap-16 items-start min-w-max">
    {#each orgChart as topTierEmp}
      <OrgNode employee={topTierEmp} />
    {/each}
  </div>

</div>
