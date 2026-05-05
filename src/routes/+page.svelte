<script>
  import { handleSaveFileUpload } from '$lib/saveHandler.js';

  async function handleFileInput(e) {
    const file = e.target.files[0];
    await handleSaveFileUpload(file);
  }
</script>

<div class="p-8">
  <h1>Welcome to the Calculator!</h1>
  <p>Drag and drop your save anywhere on the screen, use the button in the header, or click below.</p>

  <label class="block border-2 border-dashed p-12 text-center cursor-pointer mt-8">
    <span>Click to browse for your save file</span>
    <input type="file" class="hidden" accept=".json,.save" onchange={handleFileInput} />
  </label>
</div>
