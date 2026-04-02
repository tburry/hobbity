export interface GalleryImage {
  src: string;
  srcSmall: string;
  alt: string;
  caption: string;
  storyLink?: string;
  storyTitle?: string;
}

export const images: GalleryImage[] = [
  // 2026-03-31 — The Serpent Beneath
  {
    src: '/hobbity/images/ramne.webp',
    srcSmall: '/hobbity/images/small/ramne.webp',
    alt: 'Ramne',
    caption:
      'Ramne, an old hobbit druid with his weasel Twitch perched on his head. He carried a book, a wooden spoon, and three healing spells—all of which he spent on the Toad Stompers.',
    storyLink:
      '/hobbity/stories/2026-03-31-the-serpent-beneath/#ramne',
    storyTitle: 'The Serpent Beneath',
  },
  {
    src: '/hobbity/images/abramo.webp',
    srcSmall: '/hobbity/images/small/abramo.webp',
    alt: 'Abramo',
    caption:
      'Abramo, the serpent cult\'s priest. Robed in snake-skin scale mail with a cobra-headed mace, he worshipped Explictica with the fervour of the truly insane.',
    storyLink:
      '/hobbity/stories/2026-03-31-the-serpent-beneath/#the-serpents-lair',
    storyTitle: 'The Serpent Beneath',
  },
  {
    src: '/hobbity/images/misha.webp',
    srcSmall: '/hobbity/images/small/misha.webp',
    alt: 'Misha',
    caption:
      'Misha, the priestess of the Temple of Merikka. Whether imposter or charmed follower, Turnip\'s sleep dart settled the question for now.',
    storyLink:
      '/hobbity/stories/2026-03-31-the-serpent-beneath/#the-serpents-lair',
    storyTitle: 'The Serpent Beneath',
  },
  {
    src: '/hobbity/images/explictica.webp',
    srcSmall: '/hobbity/images/small/explictica.webp',
    alt: 'The jade statue of Explictica',
    caption:
      'A polished jade statue of Explictica—a snake with a woman\'s head, four-armed, exquisitely carved. Light from torches caused the colours to swirl in an almost hypnotic pattern.',
    storyLink:
      '/hobbity/stories/2026-03-31-the-serpent-beneath/#cirilli',
    storyTitle: 'The Serpent Beneath',
  },
  // 2026-03-22 — The Skeleton Room
  {
    src: '/hobbity/images/boffo-felled-by-skeleton.webp',
    srcSmall: '/hobbity/images/small/boffo-felled-by-skeleton.webp',
    alt: 'Boffo felled by a skeleton',
    caption:
      'A skeleton\'s sword drove through the gap between shield and chainmail. Boffo went down. His mace clattered on the stone beside him.',
    storyLink:
      '/hobbity/stories/2026-03-22-the-skeleton-room/#the-bones-stand-up',
    storyTitle: 'The Skeleton Room',
  },
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
    alt: 'A sinister note found on a slain goblin',
    caption:
      'A note found on a slain goblin at the bridge on the road to Orlane, confirming Orlane as a target and Gomwick as the next.',
    storyLink:
      '/hobbity/stories/2026-01-29-toads-toads-toads/#the-bridge',
    storyTitle: 'Toads, Toads, Toads',
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
  // 2025-11-08 — The Hermit of the Woods
  {
    src: '/hobbity/images/the-hermit.webp',
    srcSmall: '/hobbity/images/small/the-hermit.webp',
    alt: 'The Hermit of the Old Woods',
    caption:
      'The Hermit—an ancient tall-folk man living deep in the Old Woods. Each hobbit saw his dwelling differently. Inside, his strange arcane machine delivered visions none of them could unsee.',
    storyLink:
      '/hobbity/stories/2025-11-08-the-hermit-of-the-woods/#into-the-woods',
    storyTitle: 'The Hermit of the Woods',
  },
  // 2025-11-06 — The Gomwick Harvest Festival
  {
    src: '/hobbity/images/road-to-gomwick.webp',
    srcSmall: '/hobbity/images/small/road-to-gomwick.webp',
    alt: 'The Old Road to Gomwick',
    caption:
      'The Old Road through the forest to Gomwick. A storm delayed the hobbits, so they took the long way—through woods where the trees watched back.',
    storyLink:
      '/hobbity/stories/2025-11-06-the-gomwick-harvest-festival/#the-road-to-gomwick',
    storyTitle: 'The Gomwick Harvest Festival',
  },
  {
    src: '/hobbity/images/sinister-tree.webp',
    srcSmall: '/hobbity/images/small/sinister-tree.webp',
    alt: 'A sinister tree in the Old Woods',
    caption:
      'The trees on the Old Road seemed to watch the hobbits—a face in the bark that vanished the moment you looked straight at it.',
    storyLink:
      '/hobbity/stories/2025-11-06-the-gomwick-harvest-festival/#the-road-to-gomwick',
    storyTitle: 'The Gomwick Harvest Festival',
  },
  {
    src: '/hobbity/images/tobias-chubb.webp',
    srcSmall: '/hobbity/images/small/tobias-chubb.webp',
    alt: 'Tobias Chubb',
    caption:
      'Tobias Chubb, a ne\'er-do-well encountered on the Old Road, muttering about the trees "looking at him funny." Later found dead in the Hermit\'s cabin.',
    storyLink:
      '/hobbity/stories/2025-11-06-the-gomwick-harvest-festival/#the-road-to-gomwick',
    storyTitle: 'The Gomwick Harvest Festival',
  },
  {
    src: '/hobbity/images/grunela.webp',
    srcSmall: '/hobbity/images/small/grunela.webp',
    alt: 'Grunela Bunce',
    caption:
      'Grunela Bunce, three-time pie-eating champion, defeated by Boffo in the second round. She threw up after the first pie. She threw an apple at his head later.',
    storyLink:
      '/hobbity/stories/2025-11-06-the-gomwick-harvest-festival/#the-festival',
    storyTitle: 'The Gomwick Harvest Festival',
  },
  {
    src: '/hobbity/images/pie-eating-trophy.webp',
    srcSmall: '/hobbity/images/small/pie-eating-trophy.webp',
    alt: 'The pie-eating trophy',
    caption:
      'The pie-eating trophy at the Gomwick Harvest Festival. Boffo cleaned three plates of rhubarb pie and asked for more.',
    storyLink:
      '/hobbity/stories/2025-11-06-the-gomwick-harvest-festival/#the-festival',
    storyTitle: 'The Gomwick Harvest Festival',
  },
  {
    src: '/hobbity/images/spottle-toad.webp',
    srcSmall: '/hobbity/images/small/spottle-toad.webp',
    alt: 'A spottle toad',
    caption:
      'The spottle toad at the gambling table. Any die it swallowed counted as zero. Turnip swore it was cheating.',
    storyLink:
      '/hobbity/stories/2025-11-06-the-gomwick-harvest-festival/#the-spottle-table',
    storyTitle: 'The Gomwick Harvest Festival',
  },
  {
    src: '/hobbity/images/hungry-hank.webp',
    srcSmall: '/hobbity/images/small/hungry-hank.webp',
    alt: 'Hungry Hank the scarecrow',
    caption:
      'Hungry Hank, the harvest effigy that ripped free from his pole and rampaged through the fairgrounds. Boffo brought it low with a torch.',
    storyLink:
      '/hobbity/stories/2025-11-06-the-gomwick-harvest-festival/#hungry-hank',
    storyTitle: 'The Gomwick Harvest Festival',
  },
  {
    src: '/hobbity/images/buford.webp',
    srcSmall: '/hobbity/images/small/buford.webp',
    alt: 'Buford Niss',
    caption:
      'The Hon. Horace Buford Hockwallop Niss, Esq. Wealthy, well-traveled, and watching from the edge of the commotion with a dimmed jovial mood.',
    storyLink:
      '/hobbity/stories/2025-11-06-the-gomwick-harvest-festival/#buford-niss',
    storyTitle: 'The Gomwick Harvest Festival',
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
