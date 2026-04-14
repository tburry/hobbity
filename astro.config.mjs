// @ts-check
import { defineConfig } from 'astro/config';
import pagefind from 'astro-pagefind';
import mdx from '@astrojs/mdx';
import svelte from '@astrojs/svelte';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import AstroPWA from '@vite-pwa/astro';
import rehypeDeathDagger from './src/plugins/rehype-death-dagger.mjs';
export default defineConfig({
  site: 'https://tburry.github.io',
  base: '/hobbity',
  markdown: {
    rehypePlugins: [rehypeDeathDagger],
  },
  image: {
    layout: 'constrained',
    responsiveStyles: true,
  },
  integrations: [
    svelte({ preprocess: vitePreprocess() }),
    mdx(),
    pagefind(),
    AstroPWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Toad Stompers',
        short_name: 'Toad Stompers',
        start_url: '/hobbity/',
        display: 'standalone',
        background_color: '#faf6f0',
        theme_color: '#2a1f14',
        icons: [
          { src: '/hobbity/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/hobbity/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{html,css,js,png,svg,ico,woff2}'],
        navigateFallback: null,
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\.webp$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
});
