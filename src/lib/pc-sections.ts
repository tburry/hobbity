/** Extract the leading paragraph before any ## heading. */
export function extractBlurb(markdown: string): string {
  const firstHeading = markdown.search(/^## /m);
  if (firstHeading === -1) return markdown.trim();
  return markdown.slice(0, firstHeading).trim();
}

/**
 * Extract sections from raw markdown by ## heading.
 * Returns a map of heading text → markdown body between this ## and the next.
 */
export function extractSections(markdown: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const parts = markdown.split(/^## /m);

  for (let i = 1; i < parts.length; i++) {
    const newlineIdx = parts[i].indexOf('\n');
    if (newlineIdx === -1) continue;
    const heading = parts[i].slice(0, newlineIdx).trim();
    const body = parts[i].slice(newlineIdx + 1).trim();
    sections[heading] = body;
  }

  return sections;
}

/** Convert simple markdown bullet lists to HTML. Handles **bold** and [links](url). */
export function mdToHtml(md: string): string {
  return '<ul>' + md
    .split('\n')
    .filter((l) => l.startsWith('- '))
    .map((l) => {
      let html = l.slice(2);
      html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
      return `<li>${html}</li>`;
    })
    .join('') + '</ul>';
}
