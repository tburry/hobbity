/**
 * Rehype plugin that finds headings containing a <Dead /> component
 * (rendered as <dfn class="icon-dfn icon-dead">) and pre-assigns a clean
 * heading ID that excludes the dagger symbol.
 *
 * Runs as a user rehype plugin before Astro's rehypeHeadingIds,
 * so the pre-assigned ID prevents Astro from generating a dirty slug.
 */
import { visit } from 'unist-util-visit';
import Slugger from 'github-slugger';

function getTextContent(node) {
  if (node.type === 'text') return node.value;
  if (node.children) return node.children.map(getTextContent).join('');
  return '';
}

function isDeadDfn(node) {
  if (node.tagName !== 'dfn') return false;
  const classes = node.properties?.className ?? [];
  return classes.includes('icon-dead');
}

export default function rehypeDeathDagger() {
  return (tree) => {
    const slugger = new Slugger();

    visit(tree, 'element', (node) => {
      if (!/^h[1-6]$/.test(node.tagName)) return;

      // Find a <dfn class="icon-dead"> child
      const lastIdx = node.children.length - 1;
      const last = node.children[lastIdx];
      if (!last || !isDeadDfn(last)) return;

      // Build clean text for slug (exclude the dfn)
      const cleanText = node.children
        .slice(0, lastIdx)
        .map(getTextContent)
        .join('')
        .trim();

      // Pre-assign clean ID
      node.properties ??= {};
      node.properties.id = slugger.slug(cleanText);

      // Ensure a space before the dfn
      const prev = node.children[lastIdx - 1];
      if (prev?.type === 'text') {
        prev.value = prev.value.replace(/\s+$/, '') + ' ';
      }
    });
  };
}
