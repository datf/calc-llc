<script>
  import { gameState } from '$lib/game.svelte.js'; // Import your singleton instance
  import { goto } from '$app/navigation';

  let fileInput;
  let errorMessage = $state("");

  function handleFileUpload(event) {
    errorMessage = "";
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const saveJson = JSON.parse(e.target.result);
        
        // Call the method ON the class instance
        const success = gameState.loadSaveData(saveJson);
        
        if (success) {
          goto('#/employees'); 
        } else {
          errorMessage = "Save file was loaded but missing expected data structures.";
        }
      } catch (err) {
        errorMessage = "Invalid file. Make sure it's a valid JSON save file.";
        console.error(err);
      }
      
      fileInput.value = ""; 
    };

    reader.readAsText(file);
  }
</script>

<div class="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center">
  <div class="mb-10">
    <h1 class="text-5xl font-bold theme-text-accent mb-4 tracking-tight">Coal LLC</h1>
    <p class="text-lg theme-text-muted max-w-xl mx-auto">
      Upload your management save file to resume expanding your corporate mining empire.
    </p>
  </div>

  <div class="theme-surface p-8 rounded-xl shadow-2xl border theme-border w-full max-w-md">
    <label for="save-upload" class="block text-xl font-bold theme-text mb-6">
      Load Save File
    </label>
    
    <input
      id="save-upload"
      type="file"
      accept=".json,.txt,.save"
      class="block w-full text-sm theme-text-muted
        file:mr-4 file:py-3 file:px-6
        file:rounded-lg file:border-0
        file:text-sm file:font-bold
        file:bg-[var(--accent)] file:text-[var(--bg-main)]
        hover:file:brightness-110 cursor-pointer transition-all"
      onchange={handleFileUpload}
      bind:this={fileInput}
    />
    
    {#if errorMessage}
      <div class="mt-6 p-4 bg-red-500/10 border border-red-500 rounded text-red-500 text-sm">
        {errorMessage}
      </div>
    {/if}
  </div>
</div>
