export interface GalleryImage {
  src: ImageMetadata;
  alt: string;
  caption: string;
  storyLink?: string;
  storyTitle?: string;
}

// Glob import all gallery images (excludes pcs/ and generated files)
const allImages = import.meta.glob<{ default: ImageMetadata }>(
  ['/src/assets/images/*.webp', '/src/assets/images/npcs/*.webp'],
  { eager: true }
);

function img(name: string): ImageMetadata {
  // Try top-level first, then npcs/
  const key = `/src/assets/images/${name}`;
  const npcKey = `/src/assets/images/npcs/${name}`;
  const mod = allImages[key] ?? allImages[npcKey];
  if (!mod) throw new Error(`Image not found: ${key}`);
  return mod.default;
}

// Sorted reverse chronologically by story date, then reverse story order
// within each story (latest scene first).
export const images: GalleryImage[] = [
  // 2026-03-31 — The Serpent Beneath
  {
    src: img('explictica.webp'),
    alt: 'The jade statue of Explictica',
    caption:
      'A polished jade statue of Explictica—a snake with a woman\'s head, four-armed, exquisitely carved. Light from torches caused the colours to swirl in an almost hypnotic pattern.',
    storyLink:
      '/hobbity/stories/2026-03-31-the-serpent-beneath/#prisoner-of-the-snake-goddess',
    storyTitle: 'The Serpent Beneath',
  },
  {
    src: img('abramo.webp'),
    alt: 'Abramo',
    caption:
      'Abramo, priest of the cult of Explictica. Robed in snake-skin scale mail with a cobra-headed mace, he worshipped his snake goddess with the fervour of the truly insane.',
    storyLink:
      '/hobbity/stories/2026-03-31-the-serpent-beneath/#the-serpents-lair',
    storyTitle: 'The Serpent Beneath',
  },
  {
    src: img('ramne.webp'),
    alt: 'Ramne',
    caption:
      'Ramne, an old hobbit druid with his weasel Twitch perched on his head. He carried a book, a wooden spoon, and three healing spells—all of which he spent on the Toad Stompers.',
    storyLink:
      '/hobbity/stories/2026-03-31-the-serpent-beneath/#ramne',
    storyTitle: 'The Serpent Beneath',
  },
  {
    src: img('ramne-offers-boffo-pipe.webp'),
    alt: 'Ramne offers Boffo a puff of his pipe',
    caption:
      'Ramne packed his pipe amid the skeleton-strewn ruins beneath the Temple of Merikka. "The only religion I follow is this right here," he said. Boffo asked for a bit of that religion too.',
    storyLink:
      '/hobbity/stories/2026-03-31-the-serpent-beneath/#ramne',
    storyTitle: 'The Serpent Beneath',
  },
  // 2026-03-22 — The Skeleton Room
  {
    src: img('boffo-felled-by-skeleton.webp'),
    alt: 'Boffo felled by a skeleton',
    caption:
      'A skeleton\'s sword drove through the gap between shield and chainmail. Boffo went down. His mace clattered on the stone beside him.',
    storyLink:
      '/hobbity/stories/2026-03-22-the-skeleton-room/#the-bones-stand-up',
    storyTitle: 'The Skeleton Room',
  },
  {
    src: img('alcove-offering-to-merikka.webp'),
    alt: 'Nine golden food offerings arranged in alcoves',
    caption:
      'Nine alcoves, nine gold replicas of food — wheat, potato, oats, corn, carrot, turnips, grapes, barley, beans. Each rendered with precision, imperfections and flecks of dirt cast in gold.',
    storyLink:
      '/hobbity/stories/2026-03-22-the-skeleton-room/#the-golden-offerings',
    storyTitle: 'The Skeleton Room',
  },
  {
    src: img('mural-of-merikka.webp'),
    alt: 'A mural of the goddess Merikka surrounded by harvest bounty',
    caption:
      'A freshly painted mural on the north wall of the temple dining hall, depicting the goddess Merikka surrounded by cornucopia, fish, pumpkins, and grapes. A shrine to abundance in a town where people were disappearing.',
    storyLink: '/hobbity/stories/2026-03-22-the-skeleton-room/#the-mural-of-merikka',
    storyTitle: 'The Skeleton Room',
  },
  // 2026-03-19 — A Pilgrimage to the Temple of Merikka
  {
    src: img('brooch-of-shielding.webp'),
    alt: 'The Brooch of Shielding found in the troglodyte lair',
    caption:
      'A Brooch of Shielding, found in a locked chest in the troglodyte lair beneath the Temple of Merikka. Absorbs up to 30 HP of damage before shattering.',
    storyLink:
      '/hobbity/stories/2026-03-19-a-pilgrimage-to-the-temple-of-merikka/#troglodyte-lair',
    storyTitle: 'A Pilgrimage to the Temple of Merikka',
  },
  {
    src: img('shield-of-merikka.webp'),
    alt: 'The shield of Merikka, taken from Misha\'s quarters',
    caption:
      'Merikka\'s shield, found in the priestess Misha\'s quarters above the secret passage to the dungeon beneath the temple.',
    storyLink:
      '/hobbity/stories/2026-03-19-a-pilgrimage-to-the-temple-of-merikka/#the-dungeon-beneath',
    storyTitle: 'A Pilgrimage to the Temple of Merikka',
  },
  {
    src: img('merikka-vision.webp'),
    alt: 'A vision of Merikka reaching out',
    caption:
      'Touch a golden offering in the Temple of Merikka, and the goddess comes swimming toward you — beautiful, green, and hungry. She kissed Turnip. She kissed Boffo. Both resisted.',
    storyLink:
      '/hobbity/stories/2026-03-19-a-pilgrimage-to-the-temple-of-merikka/#the-offering-room',
    storyTitle: 'A Pilgrimage to the Temple of Merikka',
  },
  {
    src: img('misha.webp'),
    alt: 'Misha',
    caption:
      'Misha, the priestess of the Temple of Merikka in Orlane. Whether imposter or charmed follower, Turnip\'s sleep dart settled the question before anyone found out.',
    storyLink:
      '/hobbity/stories/2026-03-19-a-pilgrimage-to-the-temple-of-merikka/#entering-the-temple',
    storyTitle: 'A Pilgrimage to the Temple of Merikka',
  },
  // 2026-02-26 — A Stroll Around Orlane
  {
    src: img('zacharias.webp'),
    alt: 'Zacharias fishing at the lakeshore near Orlane',
    caption:
      'Zacharias led the Toad Stompers to the lakeshore to talk freely, paranoid about being overheard. His intelligence was grim: people in Orlane were disappearing and coming back changed.',
    storyLink:
      '/hobbity/stories/2026-02-26-a-stroll-around-orlane/#the-elm-grove-and-zacharias',
    storyTitle: 'A Stroll Around Orlane',
  },
  {
    src: img('grover-and-deputies-at-bridge.webp'),
    alt: 'Constable Grover and his deputies at the bridge',
    caption:
      'Dawn in Orlane. The hobbits slipped out of the Foaming Mug ruins and walked straight into Constable Grover and his deputies at the foot of the bridge.',
    storyLink:
      '/hobbity/stories/2026-02-26-a-stroll-around-orlane/#caught-at-the-bridge',
    storyTitle: 'A Stroll Around Orlane',
  },
  {
    src: img('wedge-getting-hammered.webp'),
    alt: 'Mattie Snowvale swings a hammer at Wedge in the smithy',
    caption:
      'Mattie Snowvale caught Wedge across the skull with a hammer before anyone could react. The blow knocked something loose in Wedge that would not settle back.',
    storyLink:
      '/hobbity/stories/2026-02-26-a-stroll-around-orlane/#the-blacksmith-and-the-constable',
    storyTitle: 'A Stroll Around Orlane',
  },
  // 2026-02-05 — I'll Have Two Bowls Please
  {
    src: img('constable-grover.webp'),
    alt: 'Constable Grover',
    caption:
      'Constable Grover of Orlane. Over dwarven whiskey at the Slumbering Serpent, he told the hobbits how the Golden Grain burned—and how Zacharias fled with Derek Desleigh.',
    storyLink:
      '/hobbity/stories/2026-02-05-ill-have-two-bowls-please/#orlane',
    storyTitle: "I'll Have Two Bowls Please",
  },
  // 2026-01-29 — Toads, Toads, Toads
  {
    src: img('sinister-orlane-note.webp'),
    alt: 'A sinister note found on a slain goblin',
    caption:
      'A note found on a slain goblin at a bridge on the road to Orlane, confirming Orlane as a target of the cult of Explictica and naming Gomwick as the next.',
    storyLink:
      '/hobbity/stories/2026-01-29-toads-toads-toads/#the-bridge',
    storyTitle: 'Toads, Toads, Toads',
  },
  {
    src: img('toad-stompers-logo.webp'),
    alt: 'Toad Stompers logo',
    caption: 'The Toad Stompers crest.',
    storyLink: '/hobbity/stories/2026-01-29-toads-toads-toads/#the-bridge',
    storyTitle: 'Toads, Toads, Toads',
  },
  // 2025-11-27 — Green Cows and Blackberries
  {
    src: img('two-headed-snake-stone.webp'),
    alt: 'A two-headed snake carved into stone from the Fortfield ruins',
    caption:
      'A serpent motif carved into stone repurposed from the Fortfield ruins at Huddle Farm. Not hobbit work, and not recent.',
    storyLink:
      '/hobbity/stories/2025-11-27-green-cows-and-blackberries/#the-huddle-household',
    storyTitle: 'Green Cows and Blackberries',
  },
  // 2025-11-24 — The Summons
  {
    src: img('buford-outfits-the-party.webp'),
    alt: 'Buford outfits the party with gear for the road to Orlane',
    caption:
      'Buford Niss, gaunt and cane-bound, outfitting the three hobbits with leather armour, daggers, slings, and individual gifts before sending them to Orlane.',
    storyLink:
      '/hobbity/stories/2025-11-24-the-summons/#outfitting',
    storyTitle: 'The Summons',
  },
  // 2025-11-08 — The Hermit of the Woods
  {
    src: img('the-hermit.webp'),
    alt: 'The Hermit of the Old Woods',
    caption:
      'The Hermit—an ancient tall-folk man living deep in the Old Woods. Each hobbit saw his dwelling differently. Inside, his strange arcane machine delivered visions none of them could unsee.',
    storyLink:
      '/hobbity/stories/2025-11-08-the-hermit-of-the-woods/#into-the-woods',
    storyTitle: 'The Hermit of the Woods',
  },
  // 2025-11-06 — The Gomwick Harvest Festival
  {
    src: img('hungry-hank.webp'),
    alt: 'Hungry Hank the scarecrow',
    caption:
      'Hungry Hank, the harvest effigy that ripped free from his pole and rampaged through the fairgrounds. Boffo brought it low with a torch.',
    storyLink:
      '/hobbity/stories/2025-11-06-the-gomwick-harvest-festival/#hungry-hank',
    storyTitle: 'The Gomwick Harvest Festival',
  },
  {
    src: img('pie-eating-trophy.webp'),
    alt: 'The pie-eating trophy',
    caption:
      'The pie-eating trophy at the Gomwick Harvest Festival. Boffo cleaned three plates of rhubarb pie and asked for more.',
    storyLink:
      '/hobbity/stories/2025-11-06-the-gomwick-harvest-festival/#the-pie-eating-contest',
    storyTitle: 'The Gomwick Harvest Festival',
  },
  {
    src: img('grunela.webp'),
    alt: 'Grunela Bunce',
    caption:
      'Grunela Bunce, three-time pie-eating champion, defeated by Boffo in the second round. She threw up after the first pie. She threw an apple at his head later.',
    storyLink:
      '/hobbity/stories/2025-11-06-the-gomwick-harvest-festival/#the-pie-eating-contest',
    storyTitle: 'The Gomwick Harvest Festival',
  },
  {
    src: img('spottle-toad.webp'),
    alt: 'A spottle toad',
    caption:
      'A spottle toad at the Gomwick Harvest Festival gambling table. Any die it swallowed counted as zero. Turnip swore it was cheating.',
    storyLink:
      '/hobbity/stories/2025-11-06-the-gomwick-harvest-festival/#the-spottle-table',
    storyTitle: 'The Gomwick Harvest Festival',
  },
  {
    src: img('buford.webp'),
    alt: 'Buford Niss',
    caption:
      'The Hon. Horace Buford Hockwallop Niss, Esq. Wealthy, well-traveled, and watching from the edge of the commotion with a dimmed jovial mood.',
    storyLink:
      '/hobbity/stories/2025-11-06-the-gomwick-harvest-festival/#buford-niss',
    storyTitle: 'The Gomwick Harvest Festival',
  },
  {
    src: img('pie-eating-contest.webp'),
    alt: 'Boffo at the pie-eating contest',
    caption:
      'Boffo Lunderbunk at the Gomwick Harvest Festival pie-eating qualifiers. The crowd gasped. Some asked how he could possibly eat so much. Boffo shrugged. "I like pie."',
    storyLink:
      '/hobbity/stories/2025-11-06-the-gomwick-harvest-festival/#the-festival',
    storyTitle: 'The Gomwick Harvest Festival',
  },
  {
    src: img('tobias-chubb.webp'),
    alt: 'Tobias Chubb',
    caption:
      'Tobias Chubb, a ne\'er-do-well encountered on the Old Road, muttering about the trees "looking at him funny." Later found dead in the Hermit\'s cabin.',
    storyLink:
      '/hobbity/stories/2025-11-06-the-gomwick-harvest-festival/#the-road-to-gomwick',
    storyTitle: 'The Gomwick Harvest Festival',
  },
  {
    src: img('sinister-tree.webp'),
    alt: 'A sinister tree in the Old Woods',
    caption:
      'The trees on the Old Road seemed to watch the hobbits—a face in the bark that vanished the moment you looked straight at it.',
    storyLink:
      '/hobbity/stories/2025-11-06-the-gomwick-harvest-festival/#the-road-to-gomwick',
    storyTitle: 'The Gomwick Harvest Festival',
  },
  {
    src: img('road-to-gomwick.webp'),
    alt: 'The Old Road to Gomwick',
    caption:
      'The Old Road through the forest to Gomwick. A storm delayed the hobbits, so they took the long way—through woods where the trees watched back.',
    storyLink:
      '/hobbity/stories/2025-11-06-the-gomwick-harvest-festival/#the-road-to-gomwick',
    storyTitle: 'The Gomwick Harvest Festival',
  },
];
