#!/usr/bin/env node
/**
 * Generate a tile pyramid from a map image for use with Leaflet.
 *
 * Usage: node scripts/generate-map-tiles.mjs <input-image> [--tile-size=256] [--output=public/tiles]
 *
 * Produces {output}/{z}/{x}/{y}.webp tiles in a Google Maps-style layout.
 * Also writes {output}/meta.json with image dimensions and zoom levels.
 */

import sharp from 'sharp';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';

const args = process.argv.slice(2);
const inputPath = args.find(a => !a.startsWith('--'));
if (!inputPath) {
  console.error('Usage: generate-map-tiles <input-image> [--tile-size=256] [--output=public/tiles]');
  process.exit(1);
}

const tileSize = parseInt(args.find(a => a.startsWith('--tile-size='))?.split('=')[1] || '256', 10);
const outputDir = resolve(args.find(a => a.startsWith('--output='))?.split('=')[1] || 'public/tiles');

const image = sharp(resolve(inputPath));
const meta = await image.metadata();
const { width, height } = meta;

console.log(`Source: ${basename(inputPath)} (${width}x${height})`);
console.log(`Tile size: ${tileSize}px`);
console.log(`Output: ${outputDir}/`);

// Calculate zoom levels.
// At zoom 0, the entire image fits in one tile.
// maxZoom is where 1 tile = 1:1 pixels (or close to it).
const maxDim = Math.max(width, height);
const maxZoom = Math.ceil(Math.log2(maxDim / tileSize));

console.log(`Zoom levels: 0–${maxZoom}`);

// Clean output directory
if (existsSync(outputDir)) {
  await rm(outputDir, { recursive: true });
}

let totalTiles = 0;

for (let z = 0; z <= maxZoom; z++) {
  // At zoom z, the image is scaled so that maxDim fits in 2^z tiles.
  const scale = Math.pow(2, z) * tileSize / maxDim;
  const scaledW = Math.round(width * scale);
  const scaledH = Math.round(height * scale);
  const cols = Math.ceil(scaledW / tileSize);
  const rows = Math.ceil(scaledH / tileSize);

  // Resize the full image once per zoom level
  const resized = sharp(resolve(inputPath))
    .resize(scaledW, scaledH, { fit: 'fill' });
  const resizedBuf = await resized.raw().toBuffer({ resolveWithObject: true });

  for (let x = 0; x < cols; x++) {
    const dir = `${outputDir}/${z}/${x}`;
    await mkdir(dir, { recursive: true });

    for (let y = 0; y < rows; y++) {
      const left = x * tileSize;
      const top = y * tileSize;
      const extractW = Math.min(tileSize, scaledW - left);
      const extractH = Math.min(tileSize, scaledH - top);

      // Extract tile from the raw buffer
      const tilePixels = Buffer.alloc(tileSize * tileSize * resizedBuf.info.channels);

      for (let row = 0; row < extractH; row++) {
        const srcOffset = ((top + row) * scaledW + left) * resizedBuf.info.channels;
        const dstOffset = row * tileSize * resizedBuf.info.channels;
        resizedBuf.data.copy(tilePixels, dstOffset, srcOffset, srcOffset + extractW * resizedBuf.info.channels);
      }

      await sharp(tilePixels, {
        raw: { width: tileSize, height: tileSize, channels: resizedBuf.info.channels },
      })
        .webp({ quality: 80 })
        .toFile(`${dir}/${y}.webp`);

      totalTiles++;
    }
  }

  console.log(`  z${z}: ${cols}x${rows} tiles (${scaledW}x${scaledH}px)`);
}

// Write metadata for the viewer
const metaOut = {
  width,
  height,
  tileSize,
  maxZoom,
  source: basename(inputPath),
};
await writeFile(`${outputDir}/meta.json`, JSON.stringify(metaOut, null, 2));

console.log(`Done. ${totalTiles} tiles written.`);
