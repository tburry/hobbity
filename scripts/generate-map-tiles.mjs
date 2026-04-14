#!/usr/bin/env node
/**
 * Generate tile pyramids from map images for use with Leaflet.
 *
 * Usage: node scripts/generate-map-tiles.mjs <input-image> [--tile-size=256] [--output=dir]
 *        node scripts/generate-map-tiles.mjs --all [--tile-size=256]
 *
 * --all processes every image in src/assets/images/maps/ into public/tiles/<slug>/.
 *
 * Produces {output}/{z}/{x}/{y}.webp tiles in a Google Maps-style layout.
 * Also writes {output}/meta.json with image dimensions and zoom levels.
 */

import sharp from 'sharp';
import { mkdir, writeFile, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, basename, extname } from 'node:path';

async function generateTiles(inputPath, tileSize, outputDir) {
  const image = sharp(resolve(inputPath));
  const meta = await image.metadata();
  const { width, height } = meta;

  console.log(`Source: ${basename(inputPath)} (${width}x${height})`);
  console.log(`Tile size: ${tileSize}px → ${outputDir}/`);

  const maxDim = Math.max(width, height);
  const maxZoom = Math.ceil(Math.log2(maxDim / tileSize));

  console.log(`Zoom levels: 0–${maxZoom}`);

  if (existsSync(outputDir)) await rm(outputDir, { recursive: true });

  let totalTiles = 0;

  for (let z = 0; z <= maxZoom; z++) {
    const scale = Math.pow(2, z) * tileSize / maxDim;
    const scaledW = Math.round(width * scale);
    const scaledH = Math.round(height * scale);
    const cols = Math.ceil(scaledW / tileSize);
    const rows = Math.ceil(scaledH / tileSize);

    const resized = sharp(resolve(inputPath))
      .resize(scaledW, scaledH, { fit: 'fill' })
      .ensureAlpha();
    const resizedBuf = await resized.raw().toBuffer({ resolveWithObject: true });

    for (let x = 0; x < cols; x++) {
      const dir = `${outputDir}/${z}/${x}`;
      await mkdir(dir, { recursive: true });

      for (let y = 0; y < rows; y++) {
        const left = x * tileSize;
        const top = y * tileSize;
        const extractW = Math.min(tileSize, scaledW - left);
        const extractH = Math.min(tileSize, scaledH - top);

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

  const metaOut = { width, height, tileSize, maxZoom, source: basename(inputPath) };
  await writeFile(`${outputDir}/meta.json`, JSON.stringify(metaOut, null, 2));

  console.log(`Done. ${totalTiles} tiles written.\n`);
}

// --- CLI ---
const args = process.argv.slice(2);
const processAll = args.includes('--all');
const inputPath = args.find(a => !a.startsWith('--'));

if (!inputPath && !processAll) {
  console.error('Usage: generate-map-tiles <input-image> [--tile-size=256] [--output=dir]');
  console.error('       generate-map-tiles --all');
  process.exit(1);
}

const tileSize = parseInt(args.find(a => a.startsWith('--tile-size='))?.split('=')[1] || '256', 10);

if (processAll) {
  const mapsDir = resolve('src/assets/images/maps');
  const files = (await readdir(mapsDir))
    .filter(f => ['.webp', '.png', '.jpg', '.jpeg'].includes(extname(f).toLowerCase()));
  for (const file of files.sort()) {
    const slug = basename(file, extname(file));
    await generateTiles(resolve(mapsDir, file), tileSize, resolve(`public/tiles/${slug}`));
  }
} else {
  const outputDir = resolve(args.find(a => a.startsWith('--output='))?.split('=')[1]
    || `public/tiles/${basename(inputPath, extname(inputPath))}`);
  await generateTiles(resolve(inputPath), tileSize, outputDir);
}
