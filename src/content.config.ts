import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const stories = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/stories' }),
  schema: z.object({
    title: z.string(),
    story: z.string(),
    date: z.coerce.date(),
    location: z.string().optional(),
    pcs: z.array(z.object({
      name: z.string(),
      slug: z.string(),
      level: z.union([z.number(), z.string()]),
    })).optional(),
    enemiesDefeated: z.array(z.string()).optional(),
    treasure: z.array(z.string()).optional(),
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

export const collections = { stories, appendix, summaries, pcs };
