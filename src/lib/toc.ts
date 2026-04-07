import { storyOrder, storySlug } from './stories';
import { appendixLabels } from './appendix';

export interface TocItem {
  label: string;
  href: string;
  children?: TocItem[];
  ordered?: boolean;
}

export interface TocSection {
  heading: string;
  items: TocItem[];
}

const world = ['pcs', 'npcs', 'places'] as const;
const appendices = ['gallery', 'tokens'] as const;

export const tocSections: TocSection[] = [
  {
    heading: 'Stories',
    items: storyOrder.map((name) => ({
      label: name,
      href: `/hobbity/stories/${storySlug(name)}/`,
    })),
  },
  {
    heading: 'World',
    items: world.map((id) => ({
      label: appendixLabels[id],
      href: `/hobbity/world/${id}/`,
    })),
  },
  {
    heading: 'Appendices',
    items: [
      ...appendices.map((id) => ({
        label: appendixLabels[id],
        href: `/hobbity/appendix/${id}/`,
      })),
      { label: 'Ledger', href: '/hobbity/ledger/' },
      { label: 'Index', href: '/hobbity/index-page/' },
    ],
  },
];
