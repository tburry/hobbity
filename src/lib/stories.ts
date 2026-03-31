export const storyOrder = ['A Hobbity Thanksgiving', 'The Huddle Job', 'Something Rotten in Orlane'];

export function storySlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function getTitle(entry: { body?: string; id: string }): string {
  const h1 = entry.body?.split('\n').find((l) => l.startsWith('# '));
  return h1 ? h1.replace(/^# /, '') : entry.id;
}
