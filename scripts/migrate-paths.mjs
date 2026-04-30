#!/usr/bin/env node
/**
 * One-shot migration: rewrite every `kind: 'path'` entry in
 * src/data/maps/*.json from the old `a`/`b`/`cpA`/`cpB` shape into a
 * unified `nodes` array, matching the new runtime model. Idempotent:
 * paths already on the new shape are left untouched.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MAPS_DIR = join(__dirname, '..', 'src', 'data', 'maps');

// Same per-kind key order App.svelte writes with, so the migrated JSON
// stays consistent with future saves.
const FEATURE_KEY_ORDER = {
  pin:  ['kind', 'class', 'number', 'name', 'x', 'y', 'anchor', 'labelPos', 'labelOnly', 'minZoom', 'shrink', 'description', 'link'],
  text: ['kind', 'class', 'name', 'x', 'y', 'width', 'height', 'align', 'valign', 'minZoom', 'shrink', 'description', 'link'],
  path: ['kind', 'class', 'name', 'mode', 'nodes', 'textAlign', 'textBaseline', 'flip', 'minZoom', 'shrink', 'description', 'link'],
};

function orderFeatureKeys(kind, obj) {
  const order = FEATURE_KEY_ORDER[kind] || [];
  const out = {};
  for (const k of order) if (k in obj) out[k] = obj[k];
  const extras = Object.keys(obj).filter(k => !order.includes(k)).sort();
  for (const k of extras) out[k] = obj[k];
  return out;
}

function migratePath(p) {
  if (Array.isArray(p.nodes)) return p; // already migrated
  if (!Array.isArray(p.a) || !Array.isArray(p.b)) return p;
  const mode = p.mode ?? 'straight';
  const first = { p: p.a };
  const last  = { p: p.b };
  if (mode === 'bezier') {
    if (Array.isArray(p.cpA)) first.cpOut = p.cpA;
    if (Array.isArray(p.cpB)) last.cpIn  = p.cpB;
  }
  const { a, b, cpA, cpB, ...rest } = p;
  return { ...rest, mode, nodes: [first, last] };
}

const files = readdirSync(MAPS_DIR).filter(f => f.endsWith('.json'));
let totalPaths = 0, migrated = 0;

for (const file of files) {
  const fp = join(MAPS_DIR, file);
  const doc = JSON.parse(readFileSync(fp, 'utf8'));
  if (!Array.isArray(doc.pins)) continue;
  let changed = false;
  doc.pins = doc.pins.map(p => {
    if (p.kind !== 'path') return p;
    totalPaths++;
    const next = migratePath(p);
    if (next !== p) { migrated++; changed = true; }
    return orderFeatureKeys('path', next);
  });
  if (changed) {
    writeFileSync(fp, JSON.stringify(doc, null, 2) + '\n');
    console.log(`migrated ${file}`);
  }
}

console.log(`\n${migrated}/${totalPaths} path entries migrated.`);
