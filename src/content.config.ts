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

const pcs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pcs' }),
  schema: z.object({
    name: z.string(),
    class: z.string(),
    level: z.number(),
    pc: z.string(),
    order: z.number(),
    tagline: z.string().optional(),
    stats: z.object({
      STR: z.number(),
      INT: z.number(),
      WIS: z.number(),
      DEX: z.number(),
      CON: z.number(),
      CHA: z.number(),
    }),
  }),
});

export const collections = { stories, appendix, summaries, essays, pcs };
