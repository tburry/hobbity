// @ts-check
import { defineConfig } from 'astro/config';
import pagefind from 'astro-pagefind';
import mdx from '@astrojs/mdx';
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
  integrations: [mdx(), pagefind()],
});
