# Lessons Learned

Corrections and preferences captured during work on this project. Apply these
going forward without being told twice.

All prior lessons have been consolidated into [CLAUDE.md](../CLAUDE.md). Add new
lessons here as they come up, then periodically promote them into CLAUDE.md.

## Standalone Text

- When fixing "the" + noun, sometimes replacing "the" with "a" is better than naming the specific instance—it avoids forcing the reader to think about a particular event. E.g. "after a confrontation" rather than "after the confrontation."
- "The party" is fine to use sometimes. Mix it up with "the Toad Stompers," "the hobbits," and "the party" for variety. Don't mechanically replace every instance.
- Only use "the hobbits" if "the party" or "the Toad Stompers" was used previously in the same section or paragraph—it needs an antecedent.
- Pub/inn names that sound like pubs (the Golden Grain, the Slumbering Serpent, the Foaming Mug) don't need "Inn" appended—the name is self-evident. Add "Inn" occasionally for variety, not as a rule.

## CSS/SCSS

- Never use raw rem/px values for padding and spacing. Use `var(--space)` (16px) or `var(--space-sm)` (8px) or multiples thereof to maintain the 8px grid.

## PRs and Commits

- Never include "Generated with Claude Code" footers in PRs or commits.
