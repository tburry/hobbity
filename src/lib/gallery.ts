export interface GalleryImage {
  src: string;
  srcSmall: string;
  alt: string;
  caption: string;
  storyLink?: string;
  storyTitle?: string;
}

export const images: GalleryImage[] = [
  // 2026-03-22 — The Skeleton Room
  {
    src: '/hobbity/images/mural-of-merikka.webp',
    srcSmall: '/hobbity/images/small/mural-of-merikka.webp',
    alt: 'A mural of the goddess Merikka surrounded by harvest bounty',
    caption:
      'A freshly painted mural on the north wall of the temple dining hall, depicting the goddess Merikka surrounded by cornucopia, fish, pumpkins, and grapes. A shrine to abundance in a town where people were disappearing.',
    storyLink: '/hobbity/stories/2026-03-22-the-skeleton-room/#the-mural-of-merikka',
    storyTitle: 'The Skeleton Room',
  },
  {
    src: '/hobbity/images/alcove-offering-to-merikka.webp',
    srcSmall: '/hobbity/images/small/alcove-offering-to-merikka.webp',
    alt: 'Nine golden food offerings arranged in alcoves',
    caption:
      'Nine alcoves, nine gold replicas of food — wheat, potato, oats, corn, carrot, turnips, grapes, barley, beans. Each rendered with precision, imperfections and flecks of dirt cast in gold.',
    storyLink:
      '/hobbity/stories/2026-03-22-the-skeleton-room/#the-golden-offerings',
    storyTitle: 'The Skeleton Room',
  },
  // 2026-03-19 — A Pilgrimage to the Temple of Merikka
  {
    src: '/hobbity/images/merikka-vision.webp',
    srcSmall: '/hobbity/images/small/merikka-vision.webp',
    alt: 'A vision of Merikka reaching out',
    caption:
      'Touch a golden offering, and Merikka comes swimming toward you — beautiful, green, and hungry. She kissed Turnip. She kissed Boffo. Both held.',
    storyLink:
      '/hobbity/stories/2026-03-19-a-pilgrimage-to-the-temple-of-merikka/#the-offering-room',
    storyTitle: 'A Pilgrimage to the Temple of Merikka',
  },
  {
    src: '/hobbity/images/shield-of-merikka.webp',
    srcSmall: '/hobbity/images/small/shield-of-merikka.webp',
    alt: 'The shield of Merikka, taken from Misha\'s quarters',
    caption:
      'Merikka\'s shield, found in the priestess Misha\'s quarters above the secret passage to the dungeon beneath the temple.',
    storyLink:
      '/hobbity/stories/2026-03-19-a-pilgrimage-to-the-temple-of-merikka/#the-dungeon-beneath',
    storyTitle: 'A Pilgrimage to the Temple of Merikka',
  },
  {
    src: '/hobbity/images/sinister-orlane-note.webp',
    srcSmall: '/hobbity/images/small/sinister-orlane-note.webp',
    alt: 'A fragment of stone tablet with sinister text',
    caption:
      'A stone fragment found in the troglodyte lair beneath the Temple of Merikka, confirming Orlane as a target and Gomwick as the next.',
    storyLink:
      '/hobbity/stories/2026-03-19-a-pilgrimage-to-the-temple-of-merikka/#underground-exploration',
    storyTitle: 'A Pilgrimage to the Temple of Merikka',
  },
  {
    src: '/hobbity/images/brooch-of-shielding.webp',
    srcSmall: '/hobbity/images/small/brooch-of-shielding.webp',
    alt: 'The Brooch of Shielding found in the troglodyte lair',
    caption:
      'A Brooch of Shielding, found in a locked chest in the troglodyte lair beneath the Temple of Merikka. Absorbs up to 30 HP of damage before shattering.',
    storyLink:
      '/hobbity/stories/2026-03-19-a-pilgrimage-to-the-temple-of-merikka/#troglodyte-lair',
    storyTitle: 'A Pilgrimage to the Temple of Merikka',
  },
  // 2026-02-26 — A Stroll Around Orlane
  {
    src: '/hobbity/images/wedge-getting-hammered.webp',
    srcSmall: '/hobbity/images/small/wedge-getting-hammered.webp',
    alt: 'Mattie Snowvale swings a hammer at Wedge in the smithy',
    caption:
      'Mattie Snowvale caught Wedge across the skull with a hammer before anyone could react. The blow knocked something loose in Wedge that would not settle back.',
    storyLink:
      '/hobbity/stories/2026-02-26-a-stroll-around-orlane/#the-blacksmith-and-the-constable',
    storyTitle: 'A Stroll Around Orlane',
  },
  {
    src: '/hobbity/images/grover-and-deputies-at-bridge.webp',
    srcSmall: '/hobbity/images/small/grover-and-deputies-at-bridge.webp',
    alt: 'Constable Grover and his deputies at the bridge',
    caption:
      'Dawn of the third day. The hobbits slipped out of the Foaming Mug ruins and walked straight into Constable Grover and his deputies at the foot of the bridge.',
    storyLink:
      '/hobbity/stories/2026-02-26-a-stroll-around-orlane/#caught-at-the-bridge',
    storyTitle: 'A Stroll Around Orlane',
  },
  {
    src: '/hobbity/images/zacharias-fishing.webp',
    srcSmall: '/hobbity/images/small/zacharias-fishing.webp',
    alt: 'Zacharias fishing at the lakeshore near Orlane',
    caption:
      'Zacharias led the party to the lakeshore to talk freely, paranoid about being overheard. His intelligence was grim: people were disappearing and coming back changed.',
    storyLink:
      '/hobbity/stories/2026-02-26-a-stroll-around-orlane/#the-elm-grove-and-zacharias',
    storyTitle: 'A Stroll Around Orlane',
  },
  // 2025-11-27 — Green Cows and Blackberries
  {
    src: '/hobbity/images/two-headed-snake-stone.webp',
    srcSmall: '/hobbity/images/small/two-headed-snake-stone.webp',
    alt: 'A two-headed snake carved into stone from the Fortfield ruins',
    caption:
      'A serpent motif carved into stone repurposed from the Fortfield ruins at Huddle Farm. Not hobbit work, and not recent.',
    storyLink:
      '/hobbity/stories/2025-11-27-green-cows-and-blackberries/#the-huddle-household',
    storyTitle: 'Green Cows and Blackberries',
  },
  // Non-story
  {
    src: '/hobbity/images/toad-stompers.webp',
    srcSmall: '/hobbity/images/small/toad-stompers.webp',
    alt: 'The Toad Stompers',
    caption: 'The Toad Stompers — Boffo, Turnip, and Wedge.',
  },
  {
    src: '/hobbity/images/toad-stompers-logo.webp',
    srcSmall: '/hobbity/images/small/toad-stompers-logo.webp',
    alt: 'Toad Stompers logo',
    caption: 'The Toad Stompers crest.',
    storyLink: '/hobbity/stories/2026-01-29-toads-toads-toads/#the-bridge',
    storyTitle: 'Toads, Toads, Toads',
  },
];
