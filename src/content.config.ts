import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const stories = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/stories' }),
  schema: z.object({
    story: z.string(),
  }),
});

const appendix = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/appendix' }),
  schema: z.object({}).passthrough(),
});

const summaries = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/summaries' }),
  schema: z.object({}).passthrough(),
});

const essays = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/essays' }),
  schema: z.object({}).passthrough(),
});

export const collections = { stories, appendix, summaries, essays };
