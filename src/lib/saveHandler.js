import { gameState } from '$lib/game.svelte.js';

export async function handleSaveFileUpload(file, silent = false) {
	if (!file) return false;

	try {
		const text = await file.text();
		const json = JSON.parse(text);

		const success = gameState.loadSaveData(json);

		if (success) {
			return true;
		} else {
			if (!silent) alert("Failed to parse save data. Make sure it's a valid save file.");
			return false;
		}
	} catch (err) {
		console.error('Error reading file:', err);
		if (!silent) alert('Error reading file. Is it a valid JSON?');
		return false;
	}
}
