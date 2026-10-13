// svelte.config.js
import adapter from '@sveltejs/adapter-static';

import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite'; // 1. Import the Tailwind Vite plugin

export default defineConfig({
	plugins: [
		sveltekit({
			preprocess: vitePreprocess(),
			adapter: adapter({
				// Fallback enables SPA mode and fix GH pages 404'ing
				fallback: '404.html',
				pages: 'build',
				assets: 'build',
				precompress: false,
				strict: true
			}),

			// This is the magic SvelteKit setting that replaces the Vite plugin:
			output: { bundleStrategy: 'inline' },
			paths: {
				base: (process.argv.includes('dev') ? '' : process.env.BASE_PATH) as
					'' | `/${string}` | undefined
			}
		}),
		tailwindcss()
	],
	test: { include: ['src/**/*.{test,spec}.{js,ts}'] },
	server: {
		host: '0.0.0.0' /* Listen on all network interfaces */,
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
