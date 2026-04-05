export const storyOrder = ['A Hobbity Thanksgiving', 'The Huddle Job', 'Something Rotten in Orlane'];

export function storySlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function getTitle(entry: { data?: { title?: string }; body?: string; id: string }): string {
  if (entry.data?.title) return entry.data.title;
  const h1 = entry.body?.split('\n').find((l) => l.startsWith('# '));
  return h1 ? h1.replace(/^# /, '') : entry.id;
}

/** Convert inline markdown links to HTML anchors */
export function mdLinks(text: string): string {
  return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

const SHIRE_MONTHS = [
  'Afteryule', 'Solmath', 'Rethe', 'Astron', 'Thrimidge', 'Forelithe',
  'Afterlithe', 'Wedmath', 'Halimath', 'Winterfilth', 'Blotmath', 'Foreyule',
];

export function toShireDate(date: Date): { shire: string; real: string } {
  const day = date.getUTCDate();
  const month = SHIRE_MONTHS[date.getUTCMonth()];
  const year = date.getUTCFullYear() - 600;
  const realMonth = date.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  return {
    shire: `${day} ${month}, S.R. ${year}`,
    real: `${realMonth} ${day}, ${date.getUTCFullYear()}`,
  };
}
