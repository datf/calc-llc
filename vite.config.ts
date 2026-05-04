import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite'; // 1. Import the Tailwind Vite plugin

export default defineConfig({
	plugins: [
		sveltekit(),
		tailwindcss()
	],
	server: {
		host: '0.0.0.0', // Listen on all network interfaces
		port: 5173,
		watch: {
			// Enable polling if your OS/filesystem doesn't pass file change events to the container
			usePolling: true
		},
		hmr: {
			// Tell the browser to connect to localhost for HMR, not the container's internal IP
			host: 'localhost',
			port: 5173
		}
	},
	preview: {
		host: '0.0.0.0',
		port: 4173
	}
});
