#!/usr/bin/env node
/**
 * Scan src/assets/images/maps/ and write tools/maps.json with image metadata.
 *
 * Usage: node scripts/generate-map-manifest.mjs
 */

import sharp from 'sharp';
import { readdir, writeFile } from 'node:fs/promises';
import { resolve, basename, extname } from 'node:path';

const mapsDir = resolve('src/assets/images/maps');
const outFile = resolve('tools/maps.json');

const files = (await readdir(mapsDir)).filter(f =>
  ['.webp', '.png', '.jpg', '.jpeg'].includes(extname(f).toLowerCase())
);

files.sort();

const maps = [];
for (const file of files) {
  const meta = await sharp(resolve(mapsDir, file)).metadata();
  const slug = basename(file, extname(file));
  maps.push({
    slug,
    name: slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    file,
    width: meta.width,
    height: meta.height,
  });
}

await writeFile(outFile, JSON.stringify(maps, null, 2) + '\n');
console.log(`Wrote ${maps.length} map(s) to ${outFile}`);
