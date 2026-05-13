#!/usr/bin/env python3
"""
Fix common Whisper misrecognitions in a hobbit-campaign session transcript.

Deterministic, regex-based. No API key required. Apply targeted substitutions
for the proper nouns Whisper keeps mangling.

Usage:
    fix-transcript.py <transcript> [-o OUTPUT] [--dry-run] [--diff]

When run without -o, the input file is overwritten in place. Use --dry-run
to see how many lines would change without writing. Use --diff to also print
a per-rule count.

Add new mishearings to CORRECTIONS below as they show up.
"""

import argparse
import os
import re
import sys

# Each entry: (pattern, replacement). Patterns are case-sensitive regexes
# applied in order. Use \b to anchor whole-word matches.
#
# Convention: list the *misrecognition* on the left, the correct campaign
# spelling on the right. Group variants with alternation to keep the table
# scannable. Comments explain non-obvious cases.
CORRECTIONS = [
    # --- PCs ---
    # Boffo: Whisper produces a zoo of B-words. Anchor with \b so we don't
    # touch "Boffo" itself or compound words.
    (r"\b(Bofo|Bofor|Bofol|Bofos|Bofko|Bofko's"
     r"|Baffle|Baffles|Baffo|Baffel|Bafel|Bafho|Bafko"
     r"|Bapho|Bopho|Boffel|Buffle|Buffles|Buffalo)\b", "Boffo"),
    # Possessives that the above won't catch.
    (r"\bBoffo s\b", "Boffo's"),

    # Turnip: "Turnup", "Turtup", "Turd up", "Turn up" (when clearly the name)
    (r"\b(Turnup|Turtup)\b", "Turnip"),
    (r"\bTurd up\b", "Turnip"),
    # "Turn up" is ambiguous (could be "show up"). Skip — let the human judge.

    # Wedge: usually right, but sometimes lowercased.
    (r"(?<![\w-])wedge(?![\w-])", "Wedge"),

    # --- NPCs ---
    (r"\bExplicitica\b", "Explictica"),
    (r"\bGammie\b", "Gammy"),
    (r"\bgammy\b", "Gammy"),  # mid-sentence lowercase
    (r"\bGametes\b", "Gammy"),  # whisper sometimes hears "gammy" as "gametes"
    (r"\bgametes\b", "Gammy"),
    (r"\bGammy Boccin\b", "Gammy Boffin"),
    (r"\bGammy Bochan\b", "Gammy Boffin"),
    (r"\bMattie\b", "Mattie"),  # canonical (vs. "Maddie" in some context docs)
    (r"\bMisha's\b", "Misha's"),
    (r"\bRamney\b", "Ramne"),
    (r"\bRomney\b", "Ramne"),
    (r"\bRamna\b", "Ramne"),
    (r"\bCirelli\b", "Cirilli"),
    (r"\bSerelli\b", "Cirilli"),
    (r"\bAbromo\b", "Abramo"),
    (r"\bZachariah\b", "Zacharias"),
    (r"\bZachariahs\b", "Zacharias's"),
    (r"\bDerrick\b", "Derek"),
    (r"\bDerek Deslay\b", "Derek Desleigh"),
    (r"\bDerek Daslay\b", "Derek Desleigh"),
    (r"\bBuford Nis\b", "Buford Niss"),
    (r"\bBuford Nyss\b", "Buford Niss"),
    (r"\bBilbo\b", "Belba"),  # she gets mistaken for Bilbo a lot
    (r"\bBelva\b", "Belba"),
    (r"\bOlin\b", "Olwyn"),
    (r"\bAlwyn\b", "Olwyn"),
    (r"\bKillian Gade\b", "Killian Gade"),
    (r"\bKilly and Gade\b", "Killian Gade"),
    (r"\bIrish Gade\b", "Iris Gade"),
    (r"\bHaskelley\b", "Haskelly"),
    (r"\bHascalee\b", "Haskelly"),
    (r"\bConstable Glover\b", "Constable Grover"),

    # --- Places ---
    (r"\bOrlene\b", "Orlane"),
    (r"\bOrleans\b", "Orlane"),
    (r"\bMerica\b", "Merikka"),
    (r"\bMaricka\b", "Merikka"),
    (r"\bMerica's\b", "Merikka's"),
    (r"\bSlumber Inn Serpent\b", "Slumbering Serpent"),
    (r"\bGoldengrain\b", "Golden Grain"),
    (r"\bFortifield\b", "Fortfield"),
    (r"\bHuddle Farm\b", "Huddle Farm"),  # canonical (idempotent)
    (r"\bDim Wood\b", "Dimwood"),
    (r"\bRush Moors\b", "Rushmoors"),
    (r"\bGom Wick\b", "Gomwick"),

    # --- Misc campaign terms ---
    (r"\bToadstompers\b", "Toad Stompers"),
    (r"\bToad-Stompers\b", "Toad Stompers"),
    (r"\bWhisker\b(?! the)", "Whiskers"),  # only when standalone
    (r"\btroglodite\b", "troglodyte"),
    (r"\btroglodites\b", "troglodytes"),
    (r"\bcobra headed\b", "cobra-headed"),
    (r"\bsnake headed\b", "snake-headed"),
]


def compile_rules(rules):
    return [(re.compile(pat), repl) for pat, repl in rules]


def apply(text, compiled):
    """Apply each rule once across the whole text. Returns (new_text, counts)."""
    counts = {}
    for pattern, repl in compiled:
        new_text, n = pattern.subn(repl, text)
        if n:
            counts[f"{pattern.pattern} -> {repl}"] = n
            text = new_text
    return text, counts


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("transcript", help="Path to the transcript markdown file.")
    parser.add_argument(
        "-o", "--out", default=None, metavar="FILE",
        help="Output path (default: overwrite input).",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Show counts without writing the file.",
    )
    opts = parser.parse_args()

    if not os.path.exists(opts.transcript):
        print(f"[error] File not found: {opts.transcript}", file=sys.stderr)
        return 1

    with open(opts.transcript) as f:
        original = f.read()

    compiled = compile_rules(CORRECTIONS)
    fixed, counts = apply(original, compiled)

    total = sum(counts.values())
    if total == 0:
        print("[fix] No corrections matched.")
        return 0

    print(f"[fix] {total} substitution(s) across {len(counts)} rule(s):")
    for rule, n in sorted(counts.items(), key=lambda x: -x[1]):
        print(f"  {n:4d}  {rule}")

    if opts.dry_run:
        print("\n[dry-run] No file written.")
        return 0

    out_path = opts.out or opts.transcript
    with open(out_path, "w") as f:
        f.write(fixed)
    print(f"\n[fix] Written to {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
