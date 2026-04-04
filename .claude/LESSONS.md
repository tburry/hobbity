# Lessons Learned

Corrections and preferences captured during work on this project. Apply these
going forward without being told twice.

## Formatting

- Em dashes (—) have no spaces on either side. Use sparingly.
- En dashes (–) with spaces for title–subtitle separators (e.g. "Session Recap – 6 Blotmath").
- Use `:` as the separator between bold names and descriptions in bulleted lists (not `—`).
- Always put space on either side of `<span class="separator">` elements.
- Reference other files with markdown links, not just backticks. Humans read these files too.

## Story Files

When adding new story markdown files:

1. Set the `story` frontmatter field to the correct story group name.
2. Use a date-prefixed filename (YYYY-MM-DD-slug.md) so it sorts correctly in chapter order.
3. Add a proper h1 title (different from the story group name) and section headings.
4. Convert DM narratives from second person ("you") to third person past tense. Keep quoted dialogue untouched.
5. The `storyOrder` array in [stories.ts](../src/lib/stories.ts) only needs updating when adding a *new story group*, not individual chapters.
6. Check for new special/magical permanent items to add to [pcs.mdx](../src/content/appendix/pcs.mdx) under "Notable Items." No consumables or mundane gear.
7. Add new NPCs to [npcs.md](../src/content/appendix/npcs.md) with proper alphabetical filing, cross-links, and "See Also" entries.
8. Update [places.md](../src/content/appendix/places.md) with any new locations or happenings.
9. Rename the file to match the h1 title slug.

## NPCs ([npcs.md](../src/content/appendix/npcs.md))

- Sorted alphabetically by surname (or single name).
- Descriptions focus on character, relationships, and status, not minor story beats.
- "See Also" cross-references at the end of each letter section for NPCs whose first name starts with a different letter than their filing letter. Use "See Also" not "See also."
- Location links point to parent town anchors in [places.md](../src/content/appendix/places.md) (e.g. `#orlane`), not sub-location anchors.
- Never include module map keys (e.g. `#27`) or other source-material reference numbers. They're meaningless to readers and leak module structure.
- Each NPC blurb must stand on its own. Don't use vague references like "the cult" or "independently" that only make sense if the reader has other context. Name things specifically (e.g. "the cult of Explictica"). Update entries as the story reveals more detail.
- Watch for "the" + noun assuming the reader knows which one (e.g. "the temple", "the barn"). Either name it specifically or link it.
- Location belongs in the **Location** field, not the blurb. Don't duplicate location info in prose.
- Relations (family, employer, etc.) belong in relation fields, not as defacto blurb text. Don't use "X's son" as the entire characterization—add a relation field and write actual characterization.
- No temporal words like "now" that will go stale. Write entries as standing facts.

## Places ([places.md](../src/content/appendix/places.md))

- Only towns, standalone buildings, and regions get h2 headings.
- Locations within a town go under `### Locations` as a bulleted list with short descriptions.
- Roads go under The Five Shires' `### Locations`.
- Sort h2s alphabetically; The Five Shires goes first.
- Happenings are links to stories, not prose. Link to story TOC, individual chapter, or specific heading as appropriate.
- Notable NPCs are comma-separated links, not a bulleted list.

## Images

- Check [src/assets/images/](../src/assets/images/) for new files before asking the user.
- Full workflow: convert to webp, insert in story with relative path, add to gallery.
- Astro handles responsive image optimization automatically — no manual small versions.
- Run [generate-icons.sh](../scripts/generate-icons.sh) when `toad-icon.webp` changes.

## Commits

- No Co-Authored-By trailer in commit messages.
- Never ask or offer to push after committing.
- When committing large working changes, break them into logical pieces (e.g. formatting fixes, content additions, documentation updates).
