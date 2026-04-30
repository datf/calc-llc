// svelte.config.js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      // Fallback enables SPA mode
      fallback: 'index.html', 
      pages: 'build',
      assets: 'build',
      precompress: false,
      strict: true
    }),
    // This is the magic SvelteKit setting that replaces the Vite plugin:
    output: {
      bundleStrategy: 'inline'
    },
	  router: {
		  type: 'hash'
	  }
  }
};

export default config;
