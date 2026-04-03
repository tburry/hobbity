/**
 * Rehype plugin that finds headings containing a bold † and:
 * 1. Pre-assigns a clean ID (without the dagger)
 * 2. Replaces the <strong>†</strong> with <dfn title="Dead" class="icon-dfn">†</dfn>
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

export default function rehypeDeathDagger() {
  return (tree) => {
    const slugger = new Slugger();

    visit(tree, 'element', (node) => {
      if (!/^h[1-6]$/.test(node.tagName)) return;

      // Find a <strong> child containing only †
      const lastIdx = node.children.length - 1;
      const last = node.children[lastIdx];
      if (!last || last.tagName !== 'strong') return;

      const strongText = getTextContent(last).trim();
      if (strongText !== '†') return;

      // Build clean text for slug
      const cleanText = node.children
        .slice(0, lastIdx)
        .map(getTextContent)
        .join('')
        .trim();

      // Pre-assign clean ID
      node.properties ??= {};
      node.properties.id = slugger.slug(cleanText);

      // Trim trailing whitespace from preceding text node
      const prev = node.children[lastIdx - 1];
      if (prev?.type === 'text') {
        prev.value = prev.value.replace(/\s+$/, '');
      }

      // Replace <strong>†</strong> with <dfn title="Dead" class="icon-dfn">†</dfn>
      node.children.splice(lastIdx, 1,
        { type: 'text', value: ' ' },
        {
          type: 'element',
          tagName: 'dfn',
          properties: { title: 'Dead', className: ['icon-dfn'] },
          children: [{ type: 'text', value: '†' }],
        }
      );
    });
  };
}
