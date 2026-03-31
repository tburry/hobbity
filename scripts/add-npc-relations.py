#!/usr/bin/env python3
"""Add relation links to NPC entries in npcs.md."""

import re
from pathlib import Path

NPC_FILE = Path("src/content/appendix/npcs.md")

# Relations keyed by NPC heading text.
# Each value is a list of ("Label", "markdown links") tuples.
RELATIONS = {
    "Belba": [
        ("Family", "[Olwyn](#olwyn) (husband)"),
    ],
    "Daisy Boffin": [
        ("Family", "[Gammy Boffin](#gammy-boffin) (mother)"),
    ],
    "Gammy Boffin": [
        ("Family", "[Daisy Boffin](#daisy-boffin) (daughter)"),
    ],
    "Hanna Boggs": [
        ("Conspirator", "[Adelard Potts](#adelard-potts)"),
        ("Agent", "[Tobias Chubb](#tobias-chubb)"),
    ],
    "Tobias Chubb": [
        ("Handlers", "[Hanna Boggs](#hanna-boggs), [Adelard Potts](#adelard-potts)"),
    ],
    "Dalton Dallydown": [
        ("Employer", "[Buford Niss](#buford-niss)"),
    ],
    "Derek Desleigh": [
        ("Henchmen", "[Goblin Four](#goblin-four), [Goblin Two](#goblin-two)"),
    ],
    "Boris Duddle": [
        ("Family", "[Tom Huddle](#tom-huddle) (cousin)"),
        ("Partner", "[Krund Pothrower](#krund-pothrower)"),
    ],
    "Epsten": [
        ("Boss", "[Krund Pothrower](#krund-pothrower)"),
    ],
    "Goblin Four": [
        ("Boss", "[Derek Desleigh](#derek-desleigh)"),
    ],
    "Berry Huddle": [
        ("Family", "[Tom Huddle](#tom-huddle) (father), [Primula Huddle](#primula-huddle) (mother)"),
        ("Romance", "[Sam Sutton](#sam-sutton)"),
    ],
    "Bordo Huddle": [
        ("Family", "[Tom Huddle](#tom-huddle) (father), [Primula Huddle](#primula-huddle) (mother)"),
    ],
    "Marlo Huddle": [
        ("Family", "[Tom Huddle](#tom-huddle) (father), [Primula Huddle](#primula-huddle) (mother)"),
    ],
    "Mary Huddle": [
        ("Family", "[Tom Huddle](#tom-huddle) (father), [Primula Huddle](#primula-huddle) (mother), [Sara Huddle](#sara-huddle) (twin)"),
    ],
    "Motto Huddle": [
        ("Family", "[Tom Huddle](#tom-huddle) (father), [Primula Huddle](#primula-huddle) (mother), [Otto Huddle](#otto-huddle) (twin)"),
    ],
    "Otto Huddle": [
        ("Family", "[Tom Huddle](#tom-huddle) (father), [Primula Huddle](#primula-huddle) (mother), [Motto Huddle](#motto-huddle) (twin)"),
    ],
    "Primula Huddle": [
        ("Family", "[Tom Huddle](#tom-huddle) (husband)"),
    ],
    "Sara Huddle": [
        ("Family", "[Tom Huddle](#tom-huddle) (father), [Primula Huddle](#primula-huddle) (mother), [Mary Huddle](#mary-huddle) (twin)"),
    ],
    "Sherry Huddle": [
        ("Family", "[Tom Huddle](#tom-huddle) (father), [Primula Huddle](#primula-huddle) (mother)"),
    ],
    "Tom Huddle": [
        ("Family", "[Primula Huddle](#primula-huddle) (wife), [Berry](#berry-huddle), [Motto](#motto-huddle), [Otto](#otto-huddle), [Sherry](#sherry-huddle), [Mary](#mary-huddle), [Sara](#sara-huddle), [Bordo](#bordo-huddle), [Marlo](#marlo-huddle) (children), [Boris Duddle](#boris-duddle) (cousin)"),
    ],
    "Buford Niss": [
        ("Servant", "[Dalton Dallydown](#dalton-dallydown) (butler)"),
        ("Ally", "[Zacharias](#zacharias)"),
    ],
    "Olwyn": [
        ("Family", "[Belba](#belba) (wife)"),
    ],
    "Krund Pothrower": [
        ("Partner", "[Boris Duddle](#boris-duddle)"),
        ("Worker", "[Epsten](#epsten)"),
    ],
    "Adelard Potts": [
        ("Conspirator", "[Hanna Boggs](#hanna-boggs)"),
        ("Agent", "[Tobias Chubb](#tobias-chubb)"),
    ],
    "Griff Snowvale (Gardner)": [
        ("Family", "[Timba Snowvale](#timba-snowvale-gardner) (son)"),
    ],
    "Kaylin Snowvale": [
        ("Family", "[Maddie Snowvale](#maddie-snowvale) (mother)"),
    ],
    "Maddie Snowvale": [
        ("Family", "[Kaylin Snowvale](#kaylin-snowvale) (daughter)"),
    ],
    "Timba Snowvale (Gardner)": [
        ("Family", "[Griff Snowvale](#griff-snowvale-gardner) (father)"),
    ],
    "Traver Stokehart": [
        ("Employer", "[Zacharias](#zacharias)"),
    ],
    "Norrie Sutton": [
        ("Family", "[Sam Sutton](#sam-sutton) (son)"),
    ],
    "Sam Sutton": [
        ("Family", "[Norrie Sutton](#norrie-sutton) (father)"),
        ("Romance", "[Berry Huddle](#berry-huddle)"),
    ],
    "Zacharias": [
        ("Ally", "[Buford Niss](#buford-niss)"),
        ("Servant", "[Traver Stokehart](#traver-stokehart)"),
    ],
}


def main():
    text = NPC_FILE.read_text()
    lines = text.split("\n")
    out = []
    i = 0

    while i < len(lines):
        out.append(lines[i])

        # Detect ### heading
        m = re.match(r"^### (.+)$", lines[i])
        if m:
            npc_name = m.group(1)
            relations = RELATIONS.get(npc_name)

            if relations:
                # Scan forward to find the Location line for this NPC
                j = i + 1
                while j < len(lines):
                    if lines[j].startswith("- **Location:**"):
                        break
                    if re.match(r"^#{1,3} ", lines[j]):
                        # Hit next heading without finding Location
                        j = None
                        break
                    j += 1

                if j is not None and j < len(lines):
                    # Copy lines up to and including Location
                    for k in range(i + 1, j + 1):
                        out.append(lines[k])
                    # Insert relation lines
                    for label, links in relations:
                        out.append(f"- **{label}:** {links}")
                    i = j + 1
                    continue

        i += 1

    NPC_FILE.write_text("\n".join(out))
    print(f"Updated {NPC_FILE} with {len(RELATIONS)} NPC relations")


if __name__ == "__main__":
    main()
