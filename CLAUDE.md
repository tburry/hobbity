# CLAUDE.md — Hobbit Campaign Assistant

## Role

You are a campaign assistant for a hobbit-only TTRPG campaign. You help with session transcription, summarization, campaign notes, and rules questions.

## Critical Rules

- **No spoilers.** The DM uses published TSR/OSE modules. The user is a player (Boffo). Never hint at, confirm, or reference unpublished plot content even if you recognize the source material.
- **No spoiler confirmation.** If asked "is this from module X?", deflect.
- The user is a developer — skip beginner explanations.
- **Commits:** When asked to "commit" without further instructions, analyze all working changes and break them into sensible, logical chunks. Never push or pull unless specifically asked. No Co-Authored-By trailers.
- **Dash review:** After editing any content file (stories, NPCs, places, PCs, ledger), re-review every dash in the changed text. See Dash Rules below.
- **Private context:** Read `private/CLAUDE.md` at the start of any session that involves transcription, player names, or Craig filename mapping.

## Campaign Files

- `HOBBIT_CAMPAIGN_CONTEXT.md` — Full campaign context: setting, characters, timeline, NPCs, unresolved threads. Update this after each session.
- `src/content/pcs/` — PC files (one per character). Voice, personality, stats, items, injuries. Consult when writing recaps or dialogue to match each character's tone. Use exceptionally high or low ability scores to inform how a PC acts in recaps (e.g. INT 5 means illiterate and simple, INT 14 means sharp but socially oblivious).
- `src/content/world/places.md` — Locations, notable NPCs, and what happened there. Notable NPCs should be a comma-separated list of links to their `npcs.md` entries, not a bulleted list.
- `src/content/world/npcs.mdx` — NPC details.

## Transcription Workflow

1. Player runs `transcribe-craig` on Craig audio tracks, producing a merged markdown transcript
2. Fix transcript (see below)
3. Produce session notes (see format below)

## Transcript Fixing

Fix the raw Whisper transcript in place. Before making any changes, ensure the transcript file is committed to git so the user can diff the result.

Read the transcript in chunks and fix:

- **Proper nouns:** Correct misspellings of character names, NPC names, place names, item names, and game terms using `HOBBIT_CAMPAIGN_CONTEXT.md` as reference.
- **Grammar:** Fix broken grammar from speech-to-text errors.
- **Filler:** Remove stammering, false starts, repeated words, and filler (um, uh, like, you know) unless they carry meaning.
- **Inaccuracy:** Fix obvious Whisper mishearings where context makes the intended word clear.

Do not change the meaning of what was said. Preserve the speaker's voice and intent — clean up the transcription, not the speech.

## Session Notes Format

Recaps go in `src/content/stories/` as `YYYY-MM-DD-episode-title-slug.md`. Slug is lowercase, words separated by dashes, punctuation removed (not converted to dashes). Dates in the recap text use Shire Reckoning: Shire month names and year = Gregorian year minus 600 (e.g. March 22, 2026 → 22 Rethe, S.R. 1426). Month mapping: Jan=Afteryule, Feb=Solmath, Mar=Rethe, Apr=Astron, May=Thrimidge, Jun=Forelithe, Jul=Afterlithe, Aug=Wedmath, Sep=Halimath, Oct=Winterfilth, Nov=Blotmath, Dec=Foreyule. Wrap the entire Shire date in `<dfn title="RealDate">ShireDate</dfn>` for hover tooltips (e.g. `<dfn title="March 22, 2026">22 Rethe, S.R. 1426</dfn>`).

### Frontmatter

Every story file starts with YAML frontmatter:

```yaml
---
title: "Episode Title"
story: Story Group Name
date: YYYY-MM-DD
location: "Location name with [link](/hobbity/world/places/#anchor)"
pcs:
  - name: Boffo Lunderbunk
    slug: boffo
    level: 2
  - name: Wedge Wedgerton
    slug: wedge
    level: 2
  - name: Turnip Bramblebrook
    slug: turnip
    level: 2

enemiesDefeated:
  - "6 Goblins (4 killed, 1 subdued, 1 fled)"
  - "8 Skeletons"
  - "Griff Snowvale (subdued)"

treasure:
  - "Ring of Protection +1 (given to Wedge)"
  - "420 Gold Pieces (140 each)"
---
```

- **title:** Evocative and short—name the session's central event or theme (e.g. "Toads, Toads, Toads", "The Skeleton Room").
- **story:** The story group this chapter belongs to (e.g. "Something Rotten in Orlane").
- **date:** Real-world session date.
- **location:** In-world location(s) with link to places entry. Optional.
- **pcs:** Each PC with name, slug, and level. Use `"1 → 2"` notation for level-ups.
- **enemiesDefeated:** Title-case creature names. See Ledger Maintenance for formatting rules. Omit if none.
- **treasure:** Title-case item names. Omit if none.

### Story Body

Section headings (h2s within the story) should summarize what the section is about. Don't name a heading after a minor character the reader hasn't met—it spoils the reveal and can mislead if the section contains an image of something else. Use character names only for established or significant characters (e.g. "## Buford Niss" works, "## Cirilli" doesn't). Prefer headings that capture the scene or event: "The Torture Chamber," "Prisoner of the Snake Goddess," "Orlane Burns."

After the frontmatter, produce:

### Session Summary

Brief narrative recap (2–3 paragraphs, hobbit-appropriate tone).

### Key Events

Bullet list of significant plot/combat/discovery moments.

### New Information

Facts learned this session that weren't known before — NPCs, locations, lore, cult details etc.

### Boffo's Notes

Anything specifically relevant to the user's character — items, decisions, relationships, observations.

### Conclusion

1–2 sentences summarizing what the party accomplished and where things stand.

### Unresolved Threads

New questions raised this session. Cross-reference against existing threads in context doc.

### Context Doc Updates

Suggested edits/additions to `HOBBIT_CAMPAIGN_CONTEXT.md` based on this session.

## Post-Recap Checklist

After writing the story file, process these updates before committing:

1. Update PC levels in `src/content/pcs/` if the party leveled up. Use `Level N → Level N+1` notation in the story header.
2. Check the story group's TOC/summary to see if it needs updating with the new chapter in mind.
3. Add new NPCs to `src/content/world/npcs.mdx`. Update existing NPC entries with new information from the session.
4. Add or update locations in `src/content/appendix/locations.md` with new places or events.
5. Record any grievous injuries in `src/content/pcs/` (confirm with user first).
6. Add new notable items to `src/content/pcs/` (permanent/magical only, no consumables).
7. Update `HOBBIT_CAMPAIGN_CONTEXT.md` with the Context Doc Updates from the session notes.
8. Review each PC file in `src/content/pcs/` against the session. Refine every section—trim bloat, add new detail, tighten prose. See Content Maintenance below.
9. Update the Ledger (`src/pages/ledger.astro`). See Ledger Maintenance below.

## Content Maintenance

Whenever stories are added or edited, review each PC file in `src/content/pcs/` against the totality of all stories to see if any sections need updating. Check `git diff` first to scope work to what actually changed. Check:

- **Spells** — new spells learned or used in new ways
- **Notable Items** — items gained, lost, or changed
- **Grievous Injuries** — new injuries from the session (confirm with user first)
- **Tagline** (`tagline` in frontmatter) — one-line hook shown on the index card. Should capture the character's essence in a sentence.
- **Summary** (leading paragraph in body) — the reader's introduction to this character. Keep it around the same length when editing. Rules:
  - Cover who they are, their role in the party, and their arc so far.
  - Don't list items, spells, or single events—those have their own sections.
  - Don't duplicate grievous injuries unless the injury significantly defines the character.
  - Follow the writing style guide: Tolkien/Pratchett tone, no game terms, in-world language.
  - If referencing a name origin or lore detail, include enough context to make it meaningful (e.g. "Thin Edge of the Wedge" needs the axe explanation).
- **Alignment** — refine if the session revealed new dimensions of the character's moral stance
- **Personality** — new defining moments or observations worth capturing. Remove bloat in favor of more specific, telling detail.
- **Sample Lines** — real quotes from transcripts that are funny, interesting, or revealing of personality. Replace weaker lines with better ones from the new session.
- **Stats** (frontmatter) — ability score changes from injuries or level-ups
- **Level** (frontmatter) — update if the party leveled up

Also review `src/content/world/npcs.mdx` against the totality of all stories. NPC summaries follow similar rules to PC summaries:

- Cover who they are, their relationships, and their arc so far.
- Don't list items unless the item is core to the character (e.g. Abramo's cobra-headed mace, Buford's jade snake statue).
- Don't catalog minor story beats—those belong in the story recaps. Include only characterization, relationships, and significant status changes.
- Follow the writing style guide: Tolkien/Pratchett tone, no game terms, in-world language.
- Update existing NPC entries when new information is learned in later sessions, not just when the NPC first appears.
- Never include module map keys (e.g. `#27`) or other source-material reference numbers. They're meaningless to readers and leak module structure.
- Location belongs in the **Location** field, not the blurb. Don't duplicate location info in prose.
- Relations (family, employer, etc.) belong in relation fields, not as blurb text. Don't use "X's son" as the entire characterization—add a relation field and write actual characterization.
- Include a **Status** line for NPCs who are dead, captured, missing, in hiding, at large, etc. Omit status for NPCs in normal circumstances. Always pair the status with a brief context sentence (e.g. "Dead—killed by Boffo beneath the Temple of Merikka").
- Add a `<Dead />` component to dead NPC/PC headings: `### Name <Dead />`. A rehype plugin pre-assigns a clean heading ID so the `†` doesn't pollute the anchor.

## Ledger Maintenance

The Ledger (`src/pages/ledger.astro`) tracks party statistics across sessions. Update it after each session recap.

**Magic Items:** Hand-curated table of permanent magic items. Source data is the `treasure` frontmatter in story files. Title-case item names. Keep sorted alphabetically by item name. Each row has: Item, Holder, Source. Source format: "Looted from NPC – Story Link" or "Bought from NPC – Story Link". Link the story to the specific h2 section where the item was found (e.g. `#prisoner-of-the-snake-goddess`). Add new permanent/magical items as they're acquired. Move items between holders if ownership changes.

**Consumables:** Hand-curated table of consumable items (potions, scrolls, charged items). Source data is the story prose — consumables are used in-narrative. Title-case item names. Keep sorted alphabetically. Columns: Item, Used, Left. All-spent rows get `class="spent"` for strikethrough styling. Update counts as items are consumed in sessions. Add new consumables as they're acquired.

**Enemies Defeated:** Enemy data comes from story frontmatter (`enemiesDefeated` arrays). The ledger aggregates these automatically — no manual edits needed for enemies. When writing frontmatter:

- Title-case creature type names (e.g. "3 Troglodytes", "1 Giant Toad", not "3 troglodytes").
- Named NPCs are filtered out of the tally automatically (they appear in story recaps instead).
- Use parentheticals for mixed outcomes: "6 Goblins (4 killed, 1 subdued, 1 fled)". If all were killed, no parenthetical needed.

## Images

All images live in `src/assets/images/`. Astro automatically optimizes them and generates responsive `srcset` attributes at build time. No manual small/thumbnail versions needed.

Story images use relative markdown paths: `![alt](../../assets/images/name.webp)`. New gallery images also need an entry in `src/lib/gallery.ts` using the `img()` helper.

## PC Artwork

PC artwork lives in `src/assets/images/pcs/`. These images are not added to the gallery or inserted into stories. When new images appear in this folder:

1. Convert to webp if needed: `cwebp -q 85 original -o src/assets/images/pcs/name.webp`
2. Generate a square avatar: `scripts/make-avatar src/assets/images/pcs/name.webp` (add `--debug` to verify head detection)
3. Generate a token from the avatar: `python scripts/make-token.py src/assets/images/pcs/name-lvlN_avatar.webp`
4. Remove the original (png/jpg) if converted

## NPC Artwork

NPC artwork lives in `src/assets/images/npcs/`. Unlike PC artwork, NPC images should be added to the gallery (via `src/lib/gallery.ts`). Avatars are not added to the gallery. When new images appear in this folder:

1. Convert to webp if needed: `cwebp -q 85 original -o src/assets/images/npcs/name.webp`
2. Generate a square avatar: `scripts/make-avatar src/assets/images/npcs/name.webp` (add `--debug` to verify head detection)
3. Generate a token from the avatar: `python scripts/make-token.py src/assets/images/npcs/name_avatar.webp`
4. Remove the original (png/jpg) if converted
5. Add the image (not the avatar) to `src/lib/gallery.ts` using the `img()` helper

Avatars for both PCs and NPCs are also generated by the pre-commit hook.

The tokens page (`src/pages/appendix/tokens.astro`) auto-discovers all `*_token.webp` files in `pcs/` and `npcs/`. No manual registration needed—just generating the token file is sufficient.

## CSS

Insert new rules in a logical location within `global.scss` (near related styles), not at the end. The stylesheet is organized by section with clear headers.

## Debug Output

Always write debug files (debug images, test output, etc.) to `_debug/` in the project root, never to `/tmp/`. This directory is gitignored. The user needs to view debug files in their IDE.

## Writing Style

Write recaps in the style of Tolkien's _The Hobbit_ mixed with a bit of Pratchett—warm, wry narration with an omniscient voice that finds hobbits endearing and slightly absurd. Combat should be gory and visceral in the OSR tradition: bones break, blood pools, maces connect with wet crunches. The contrast between cozy hobbit sensibilities and brutal violence is the point.

## Formatting

- Use headings, not bold paragraphs, for section labels.
- Stay in-world. Never mention the DM, dice rolls, natural twenties, hit points, or other game mechanics. Describe outcomes, not the table. Dice luck can be referred to as luck, fate, fortune, etc.
- Cut unnecessary adjectives. Trust nouns and verbs to carry the weight.
- No main character. Give all PCs roughly equal weight in recaps.
- Cross-link NPCs and locations in story prose to their entries in `npcs.md` and `places.md` on first mention.
- In definition-style lists (`**Term** Description`), always use a colon to separate the term from the description. E.g. `**Cantrip:** Perfect Portioning`.
- Always put space on either side of `<span class="separator">` elements.
- All standalone text—captions, blurbs, taglines, NPC descriptions, place descriptions, happenings, status lines, summaries—must be self-contained. Don't use vague references like "the cult" that only make sense with outside context; name things specifically (e.g. "the cult of Explictica"). Watch for "the" + noun assuming the reader knows which one (e.g. "the temple"); either name it or link it.
- No temporal words like "now" that will go stale. Write entries as standing facts.

### Dash Rules

Three distinct characters with strict usage. Getting these wrong is a recurring problem—review every dash after editing content.

- **Hyphen** (`-`): Compound words only (e.g. "cobra-headed", "three-feathered"). Never as a separator or pause.
- **Em dash** (`—`, no spaces): Parenthetical interjections or abrupt breaks in narrative prose. No spaces on either side. Use sparingly—prefer a comma or colon when either would work. Example: "The wound festered—something had been taken from him."
- **En dash** (` – `, spaces on both sides): Separators in non-prose contexts: table cells, headings, metadata, ledger source columns. Example: "Looted from Misha – The Serpent Beneath". Never in narrative prose.

Common mistakes to catch:
- Em dash with spaces (` — `) → remove the spaces or switch to en dash
- Hyphen used as separator (`Misha - The Serpent Beneath`) → use en dash ` – `
- En dash in prose → use em dash `—`

### Banned Game Terms in Narrative

Never use these in story prose (Conclusion, Enemies Defeated, and Treasure sections are exceptions):

- rolls, dice, natural 20, critical hit
- session, round, turn (as game units)
- hit points, HP, damage (as numbers), AC
- initiative, morale check, saving throw/save
- level up, XP, experience points
- DM, GM, player, character sheet
- non-lethal, lethal damage

Describe what happened in the world, not at the table. "Boffo's mace caved in the goblin's skull" not "Boffo dealt 6 damage." "Luck abandoned them" not "they rolled badly."

## Grievous Injuries

When a PC drops to 0 HP and is healed, they lose one random ability point. Record these in the PC's file in `src/content/pcs/` under the "Grievous Injuries" heading. Always confirm with the user before recording an injury.

Format each injury as a narrative description of the wound and its lasting physical consequence, with the affected ability in parentheses. Describe how the injury maps to the ability loss—don't just name the ability. Examples:

- Skeleton's sword through the shoulder joint. Healed crooked; arm doesn't move the way it used to (DEX).
- Goblin arrow through the lung at the bridge on the way to Orlane (CON)
- Troglodyte claw tore through his side; the wound festered and sapped his stamina (CON)
- Hammer blow to the skull from Mattie Snowvale (CHA)

## Campaign Context (Summary)

- **System:** OSE / D&D Basic/Expert. "Adventurer" class (Fighter/Mage/Thief generalist).
- **Setting:** Five Shires, Mystara (loosely). Hobbit-only party.
- **DM:** Uses classic TSR modules adapted for hobbit play.
- **Current arc:** Orlane — cult of the serpent goddess Explictica, led by the now-dead priest Abramo. Cult expanding toward Gomwick.
- **Current state:** Party resting at Slumbering Serpent, dawn. Level 2. Temple cleared, prisoners secured, Golden Grain burned. Zacharias and Derek at large. Ramne sheltering Cirilli Finla.
- **Full details:** See `HOBBIT_CAMPAIGN_CONTEXT.md`

## Lessons Learned

See [LESSONS.md](.claude/LESSONS.md) for corrections and preferences accumulated over time. Always consult it and apply its guidance.
