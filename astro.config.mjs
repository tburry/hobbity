// @ts-check
import { defineConfig } from 'astro/config';
import pagefind from 'astro-pagefind';
import mdx from '@astrojs/mdx';
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
    mdx(),
    pagefind(),
    AstroPWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
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
      injectManifest: {
        globPatterns: ['**/*.{html,css,js,png,webp,svg,ico,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
});
