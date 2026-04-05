#!/usr/bin/env node
/**
 * Migrate story metadata (title, date, PCs, location) from markdown body
 * into YAML frontmatter.
 */
import { readFileSync, writeFileSync } from 'fs';
import { globSync } from 'fs';
import { basename } from 'path';

const STORIES_DIR = 'src/content/stories';

// Get all story files
const files = globSync(`${STORIES_DIR}/*.md`).sort();

for (const file of files) {
  const raw = readFileSync(file, 'utf-8');

  // Split frontmatter and body
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) {
    console.warn(`Skipping ${file}: no frontmatter found`);
    continue;
  }

  const fmLines = fmMatch[1].trim().split('\n');
  const body = fmMatch[2];

  // Parse existing frontmatter key-value pairs
  const fm = {};
  for (const line of fmLines) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (m) fm[m[1]] = m[2];
  }

  const lines = body.split('\n');

  // Extract title from # heading
  const h1Idx = lines.findIndex(l => l.startsWith('# '));
  if (h1Idx === -1) {
    console.warn(`Skipping ${file}: no h1 found`);
    continue;
  }
  const title = lines[h1Idx].replace(/^# /, '');

  // Extract date from dfn tag
  const dateLine = lines.find(l => l.includes('<dfn title='));
  let dateStr = null;
  if (dateLine) {
    const dfnMatch = dateLine.match(/title="([^"]+)"/);
    if (dfnMatch) {
      const realDate = dfnMatch[1];
      // Try to parse as a single date (e.g. "March 22, 2026")
      const parsed = new Date(realDate);
      if (!isNaN(parsed.getTime())) {
        dateStr = parsed.toISOString().split('T')[0];
      } else {
        // Date range like "November 2025 to March 2026" — use filename date
        const fnMatch = basename(file).match(/^(\d{4}-\d{2}-\d{2})/);
        if (fnMatch) dateStr = fnMatch[1];
      }
    }
  }

  // Extract PCs
  const pcs = [];
  const pcRegex = /^\s+-\s+\[([^\]]+)\]\(\/hobbity\/appendix\/pcs\/([^)]+)\)\s+-\s+Level\s+(.+?)(?:\s+(?:Hobbit|Adventurer))?$/;
  for (const line of lines) {
    const m = line.match(pcRegex);
    if (m) {
      pcs.push({ name: m[1], slug: m[2], level: m[3] });
    }
  }

  // Extract location
  let location = null;
  const locLine = lines.find(l => l.startsWith('- **Location:**'));
  if (locLine) {
    location = locLine.replace(/^- \*\*Location:\*\*\s*/, '');
  }

  // Find the end of the metadata block (first ## or first paragraph after the blank line after location)
  let metaEndIdx = h1Idx + 1;
  // Skip past the metadata block: find the line after location, then skip blank lines
  const locIdx = lines.findIndex(l => l.startsWith('- **Location:**'));
  if (locIdx !== -1) {
    metaEndIdx = locIdx + 1;
    // Skip blank lines after location
    while (metaEndIdx < lines.length && lines[metaEndIdx].trim() === '') {
      metaEndIdx++;
    }
  }

  // Build new body (everything from metaEndIdx onwards)
  const newBody = lines.slice(metaEndIdx).join('\n');

  // Build new frontmatter
  let newFm = `---\n`;
  newFm += `title: "${title.replace(/"/g, '\\"')}"\n`;
  newFm += `story: ${fm.story}\n`;
  if (dateStr) newFm += `date: ${dateStr}\n`;
  if (location) newFm += `location: "${location.replace(/"/g, '\\"')}"\n`;
  if (pcs.length > 0) {
    newFm += `pcs:\n`;
    for (const pc of pcs) {
      newFm += `  - name: ${pc.name}\n`;
      newFm += `    slug: ${pc.slug}\n`;
      // Keep level as string if it has arrow, otherwise as number
      if (pc.level.includes('→')) {
        newFm += `    level: "${pc.level}"\n`;
      } else {
        newFm += `    level: ${pc.level}\n`;
      }
    }
  }
  newFm += `---\n`;

  const output = newFm + '\n' + newBody;
  writeFileSync(file, output);
  console.log(`Migrated: ${basename(file)} — ${title}`);
}
