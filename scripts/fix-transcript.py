#!/usr/bin/env python3
"""
Fix common Whisper misrecognitions in a hobbit-campaign session transcript.

Deterministic, regex-based. No API key required. Apply targeted substitutions
for the proper nouns Whisper keeps mangling.

Usage:
    fix-transcript.py <transcript> [-o OUTPUT] [--dry-run]

When run without -o, the input file is overwritten in place. Use --dry-run
to see the per-rule counts without writing.

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
#
# Never add a rule whose pattern already equals its replacement — it rewrites
# nothing and inflates the reported counts. Canonical spellings Whisper gets
# right (Mattie, Misha, Killian Gade, Huddle Farm) need no entry.
CORRECTIONS = [
    # --- PCs ---
    # Boffo: Whisper produces a zoo of B-words. Anchor with \b so we don't
    # touch "Boffo" itself or compound words.
    # Case-insensitive: Whisper lowercases the name mid-sentence as often as not.
    (r"(?i)\b(Bofo|Bofor|Bofol|Bofos|Bofko|Bofko's|Bofill|Mbafo|Baffa"
     r"|Baffle|Baffles|Baffo|Baffel|Bafel|Bafho|Bafko|Bafo"
     r"|Bapho|Bopho|Boffel|Bofu|Boppo|Buffo"
     r"|Buffle|Buffles|Buffalo|Waffle)\b", "Boffo"),
    # Two-word manglings. "a bottle"/"a baffle" only ever show up as vocatives
    # in this campaign, so the leading article goes too.
    (r"(?i)\bBarf-?o\b", "Boffo"),
    (r"(?i)\ba baffle\b", "Boffo"),
    (r"(?i)\bHere a buffalo\b", "Here, Boffo"),
    # Possessives that the above won't catch.
    (r"\bBoffo s\b", "Boffo's"),

    # Turnip: "Turnup", "Turtup", "Turd up", "Turn up" (when clearly the name)
    (r"\b(Turnup|Turtup|Ternate)\b", "Turnip"),
    (r"\bTurd up\b", "Turnip"),
    # "Turn up" is ambiguous (could be "show up"). Skip — let the human judge.
    # Likewise "Turner" and "Tati" — too many false positives to automate.

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
    (r"\bMaddie\b", "Mattie"),
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
    (r"\bDerek to slay\b", "Derek Desleigh"),
    (r"\bdislay\b", "Desleigh"),
    (r"\bBuford Nis\b", "Buford Niss"),
    (r"\bBuford Nyss\b", "Buford Niss"),
    (r"\bBilbo\b", "Belba"),  # she gets mistaken for Bilbo a lot
    (r"\bBelva\b", "Belba"),
    (r"\bOlin\b", "Olwyn"),
    (r"\bAlwyn\b", "Olwyn"),
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
    (r"\bMarika\b", "Merikka"),
    (r"\bSlumber Inn Serpent\b", "Slumbering Serpent"),
    (r"\bGoldengrain\b", "Golden Grain"),
    (r"\bFortifield\b", "Fortfield"),
    (r"\bDim Wood\b", "Dimwood"),
    (r"\bRush Moors\b", "Rushmoors"),
    (r"\bGom Wick\b", "Gomwick"),

    # --- Misc campaign terms ---
    (r"\bToadstompers\b", "Toad Stompers"),
    (r"\bToad-Stompers\b", "Toad Stompers"),
    (r"\bWhisker\b(?! the)", "Whiskers"),  # only when standalone
    (r"(?i)\btroglodite\b", "troglodyte"),
    (r"(?i)\btroglodites\b", "troglodytes"),
    # Whisper has no idea what a troglodyte is and guesses wildly. Plurals
    # first so the singular rules don't strand a trailing "s".
    (r"(?i)\b(trug the dites|trug with 8s|troweldytes|trollglydes"
     r"|rogueledites|froglet aces|chocolate dice)\b", "troglodytes"),
    (r"(?i)\b(trug the dite|trug with 8|troweldyte|trollglyde|tronglid night's"
     r"|rogueledite|travel date|froglet ace|trouble light|truck update"
     r"|truck relate|tr ach it|chocolate eight|chocolate bite"
     r"|drug abuse)\b", "troglodyte"),
    # The DM's own coinage — he says it deliberately, so keep the spelling
    # consistent rather than normalising it to "troglodyte".
    (r"(?i)\bfroglodytes\b", "froglodytes"),
    (r"(?i)\bfroglet-?like\b", "froglike"),
    (r"\bsmoke chocolate\b", "sneak attack"),
    (r"\bgolin\b", "goblin"),
    (r"\bgolins\b", "goblins"),
    (r"\bPiston Goblin\b", "pissing goblin"),
    (r"\bI glazed you golin\b", "lazy goblin"),
    # Combat terms Whisper mangles.
    (r"\bsave versus process\b", "save versus paralysis"),
    (r"\bDirt\. Toxic\b", "Dart, toxic"),
    # The campaign's luck mechanic.
    (r"(?i)\b(hobbit die|bit point|bit points|bit die|high points)\b",
     "hobbit point"),
    # The harpy's charm rules, read aloud: "move toward the heartbeat".
    # Replacements are literal (no backreferences), so one rule per article.
    (r"\bthe heartbeat\b", "the harpy"),
    (r"\bthat heartbeat\b", "that harpy"),
    (r"\bmassagic\b", "magic"),
    (r"\bStroll case\b", "scroll case"),
    (r"\bstroll case\b", "scroll case"),
    (r"\bBastard's Bird\b", "bastard sword"),
    (r"\bClimb Shire Surfaces\b", "Climb Sheer Surfaces"),
    (r"\bcobra headed\b", "cobra-headed"),
    (r"\bsnake headed\b", "snake-headed"),
]


def compile_rules(rules):
    return [(re.compile(pat), repl) for pat, repl in rules]


def sub_changed(pattern, repl, text):
    """Substitute, counting only matches the rule actually rewrites.

    re.subn counts matches, not changes: a case-insensitive rule reports every
    already-correct spelling it passes over. Compare each match to the
    replacement so the reported total is work done.
    """
    changed = 0

    def _repl(match):
        nonlocal changed
        if match.group(0) != repl:
            changed += 1
        return repl

    return pattern.sub(_repl, text), changed


def apply(text, compiled):
    """Apply each rule once across the whole text. Returns (new_text, counts)."""
    counts = {}
    for pattern, repl in compiled:
        text, n = sub_changed(pattern, repl, text)
        if n:
            counts[f"{pattern.pattern} -> {repl}"] = n
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
