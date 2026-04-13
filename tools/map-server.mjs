#!/usr/bin/env node
/**
 * Local dev server for the map pin editor.
 *
 * - Vite dev server (middleware mode) for the Svelte app with HMR
 * - GET  /api/maps         → map manifest (auto-scanned from images/maps/)
 * - GET  /api/pins/:slug   → pin data for a map
 * - PUT  /api/pins/:slug   → save pin data for a map
 * - /maps/*                → map images from src/assets/images/maps/
 *
 * Pin files: src/data/maps/{slug}.json
 *
 * Usage: node tools/map-server.mjs [--port=8321]
 */

import { createServer as createHttpServer } from 'node:http';
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, join } from 'node:path';
import sharp from 'sharp';
import { createServer as createViteServer } from 'vite';
import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const ROOT = resolve(import.meta.dirname, '..');
const MAPS_DIR = resolve(ROOT, 'src/assets/images/maps');
const PINS_DIR = resolve(ROOT, 'src/data/maps');
const EDITOR_DIR = resolve(ROOT, 'tools/map-editor');

const port = parseInt(
  process.argv.find(a => a.startsWith('--port='))?.split('=')[1] || '8321',
  10,
);

const MIME = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

// Build map manifest on startup
async function buildManifest() {
  const files = (await readdir(MAPS_DIR)).filter(f =>
    ['.webp', '.png', '.jpg', '.jpeg'].includes(extname(f).toLowerCase()),
  );
  files.sort();

  const maps = [];
  for (const file of files) {
    const meta = await sharp(resolve(MAPS_DIR, file)).metadata();
    const slug = file.replace(/\.[^.]+$/, '');
    const entry = {
      slug,
      name: slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      file,
      width: meta.width,
      height: meta.height,
    };

    // Check for pre-generated tiles
    const tileMetaPath = join(ROOT, `public/tiles/${slug}/meta.json`);
    try {
      const tileMeta = JSON.parse(await readFile(tileMetaPath, 'utf8'));
      entry.tiles = { basePath: `/tiles/${slug}`, ...tileMeta };
    } catch {}


    if (entry.tiles) {
      const vp = 900;
      const ts = entry.tiles.tileSize;
      const maxDim = Math.max(entry.width, entry.height);
      entry.initialZoom = Math.round(Math.log2(vp * maxDim / (entry.width * ts)));
      entry.minZoom = 0;
      entry.maxZoom = entry.tiles.maxZoom + 2;
    } else {
      entry.minZoom = -3;
      entry.maxZoom = 4;
    }

    maps.push(entry);
  }
  return maps;
}

const manifest = await buildManifest();
console.log(`Found ${manifest.length} map(s): ${manifest.map(m => m.name).join(', ')}`);

if (!existsSync(PINS_DIR)) await mkdir(PINS_DIR, { recursive: true });

// Vite dev server in middleware mode
const vite = await createViteServer({
  root: EDITOR_DIR,
  server: { middlewareMode: true },
  plugins: [svelte({ preprocess: vitePreprocess() })],
  resolve: {
    alias: {
      '$components': resolve(ROOT, 'src/components'),
    },
  },
});

// HTTP server
const server = createHttpServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  const path = url.pathname;

  // API: map manifest
  if (path === '/api/maps') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(manifest));
    return;
  }

  // API: pin data
  const pinMatch = path.match(/^\/api\/pins\/([a-z0-9-]+)$/);
  if (pinMatch) {
    const slug = pinMatch[1];
    const pinFile = join(PINS_DIR, `${slug}.json`);

    if (req.method === 'GET') {
      let data = '[]';
      try { data = await readFile(pinFile, 'utf8'); } catch {}
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
      return;
    }

    if (req.method === 'PUT') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks).toString();
      try { JSON.parse(body); } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end('{"error":"Invalid JSON"}');
        return;
      }
      await writeFile(pinFile, body + '\n');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
      return;
    }
  }

  // Map images (raw)
  if (path.startsWith('/maps/')) {
    const filePath = join(MAPS_DIR, path.slice(6));
    try {
      const data = await readFile(filePath);
      const ext = extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
      return;
    } catch {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
  }

  // Tiles: /tiles/{slug}/{z}/{x}/{y}.webp
  if (path.startsWith('/tiles/')) {
    const filePath = join(ROOT, 'public', path);
    try {
      const data = await readFile(filePath);
      const ext = extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/json' });
      res.end(data);
      return;
    } catch {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
  }

  // Everything else → Vite
  vite.middlewares(req, res);
});

server.listen(port, () => {
  console.log(`Map editor: http://localhost:${port}`);
});
