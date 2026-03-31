// @ts-check
import { defineConfig } from 'astro/config';
import pagefind from 'astro-pagefind';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://tburry.github.io',
  base: '/hobbity',
  integrations: [mdx(), pagefind()],
});
