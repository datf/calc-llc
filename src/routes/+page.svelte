<script>
	import { getContext, onMount } from 'svelte';

	const openFilePicker = getContext('openFilePicker');

	let supportsFileSystemAPI = $state(true);

	onMount(() => {
		// Once mounted in the browser, check if the API is actually supported
		supportsFileSystemAPI = window.showOpenFilePicker !== undefined;
	});
</script>

<div class="page-wrapper page-wide">
	<h1>Welcome to the Calculator!</h1>
	<p>
		Drag and drop your save anywhere on the screen, use the button in the header, or click below.
	</p>

	{#if !supportsFileSystemAPI}
		<div class="bg-amber-500/10 border-l-4 border-amber-500 p-4 mb-8 mt-8 rounded-r-md">
			<div class="flex items-start">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-6 w-6 text-amber-500 mr-3 shrink-0"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<div>
					<h3 class="text-amber-500 font-bold">Auto-Reload Feature Unavailable</h3>
					<p class="text-sm mt-1 theme-text-muted">
						Your current browser doesn't support the File System Access API (often the case in
						Firefox or Safari). If you switch to a Chromium-based browser (like Chrome or Edge), you
						can enable <strong>Auto-Reload</strong> to automatically update this calculator in real-time
						as you play!
					</p>
				</div>
			</div>
		</div>
	{/if}

	<button
		class="w-full block border-2 border-dashed text-center border-[var(--border-main)] hover:border-[var(--accent)] hover:bg-
[var(--surface-hover)] p-12 cursor-pointer mt-8 rounded-xl transition-all duration-200 block"
		onclick={openFilePicker}
	>
		<span class="text-xl font-semibold">Click to browse for your save file</span>
	</button>
</div>
