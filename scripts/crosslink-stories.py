#!/usr/bin/env python3
"""Cross-link characters and locations in story markdown files.

Links:
- PC names in story headers -> /hobbity/world/pcs/<slug>
- Locations in story headers -> /hobbity/world/places/#<anchor>
- NPC/location first mentions in prose -> appropriate appendix link

Usage: python3 scripts/crosslink-stories.py [--dry-run]
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STORY_DIR = ROOT / 'src' / 'content' / 'stories'

DRY_RUN = '--dry-run' in sys.argv

# --- PC header links ---

PC_LINKS = {
    'Boffo Lunderbunk': '/hobbity/world/pcs/boffo',
    'Wedge Wedgerton': '/hobbity/world/pcs/wedge',
    'Turnip Bramblebrook': '/hobbity/world/pcs/turnip',
}

# --- Header location links (main towns/standalone locations only) ---

HEADER_LOCATIONS = [
    ('The Right Way Inn', '/hobbity/world/places/#the-right-way-inn'),
    ('Huddle Farm', '/hobbity/world/places/#huddle-farm'),
    ('Thistledown', '/hobbity/world/places/#thistledown'),
    ('Gomwick', '/hobbity/world/places/#gomwick'),
    ('Orlane', '/hobbity/world/places/#orlane'),
]

# --- Prose entities: (name, regex_override_or_None, target) ---
# Full names first, then unique single-word names.
# Sorted longest-first at runtime so "Buford Niss" matches before "Buford".

_RAW_ENTITIES = [
    # Full NPC names
    ('Constable Grover', None, '/hobbity/world/npcs/#constable-grover'),
    ('Buford Niss', None, '/hobbity/world/npcs/#buford-niss'),
    ('Tobias Chubb', None, '/hobbity/world/npcs/#tobias-chubb'),
    ('Farmer Fallow', None, '/hobbity/world/npcs/#farmer-fallow'),
    ('Gammy Boffin', None, '/hobbity/world/npcs/#gammy-boffin'),
    ('Daisy Boffin', None, '/hobbity/world/npcs/#daisy-boffin'),
    ('Grunela Bunce', None, '/hobbity/world/npcs/#grunela-bunce'),
    ('Adelard Potts', None, '/hobbity/world/npcs/#adelard-potts'),
    ('Hanna Boggs', None, '/hobbity/world/npcs/#hanna-boggs'),
    ('Lotho Longbuck', None, '/hobbity/world/npcs/#lotho-longbuck'),
    ('Dalton Dallydown', None, '/hobbity/world/npcs/#dalton-dallydown'),
    ('Wilbur Oldbuck', None, '/hobbity/world/npcs/#wilbur-oldbuck'),
    ('Killian Gade', None, '/hobbity/world/npcs/#killian-gade'),
    ('Derek Desleigh', None, '/hobbity/world/npcs/#derek-desleigh'),
    ('Tom Huddle', None, '/hobbity/world/npcs/#tom-huddle'),
    ('Primula Huddle', None, '/hobbity/world/npcs/#primula-huddle'),
    ('Berry Huddle', None, '/hobbity/world/npcs/#berry-huddle'),
    ('Sherry Huddle', None, '/hobbity/world/npcs/#sherry-huddle'),
    ('Bordo Huddle', None, '/hobbity/world/npcs/#bordo-huddle'),
    ('Krund Pothrower', None, '/hobbity/world/npcs/#krund-pothrower'),
    ('Norrie Sutton', None, '/hobbity/world/npcs/#norrie-sutton'),
    ('Sam Sutton', None, '/hobbity/world/npcs/#sam-sutton'),
    ('Mattie Snowvale', None, '/hobbity/world/npcs/#mattie-snowvale'),
    ('Maddie Snowvale', None, '/hobbity/world/npcs/#maddie-snowvale'),
    ('Griff Snowvale', None, '/hobbity/world/npcs/#griff-snowvale'),
    ('Timba Snowvale', None, '/hobbity/world/npcs/#timba-snowvale'),
    ('Kaylin Snowvale', None, '/hobbity/world/npcs/#kaylin-snowvale'),
    ('Cirilli Finla', None, '/hobbity/world/npcs/#cirilli-finla'),
    ('Quinn Finla', None, '/hobbity/world/npcs/#quinn-finla'),
    ('The Hermit', r'[Tt]he Hermit', '/hobbity/world/npcs/#the-hermit'),
    # Unique single-word NPC names
    ('Abramo', None, '/hobbity/world/npcs/#abramo'),
    ('Belba', None, '/hobbity/world/npcs/#belba'),
    ('Bertram', None, '/hobbity/world/npcs/#bertram'),
    ('Buford', None, '/hobbity/world/npcs/#buford-niss'),
    ('Bulbar', None, '/hobbity/world/npcs/#bulbar'),
    ('Cirilli', None, '/hobbity/world/npcs/#cirilli-finla'),
    ('Dalton', None, '/hobbity/world/npcs/#dalton-dallydown'),
    ('Donovan', None, '/hobbity/world/npcs/#donovan'),
    ('Epsten', None, '/hobbity/world/npcs/#epsten'),
    ('Grover', None, '/hobbity/world/npcs/#constable-grover'),
    ('Kaylin', None, '/hobbity/world/npcs/#kaylin-snowvale'),
    ('Krund', None, '/hobbity/world/npcs/#krund-pothrower'),
    ('Misha', None, '/hobbity/world/npcs/#misha'),
    ('Olwyn', None, '/hobbity/world/npcs/#olwyn'),
    ('Ramne', None, '/hobbity/world/npcs/#ramne'),
    ('Rolo', None, '/hobbity/world/npcs/#rolo'),
    ('Vilma', None, '/hobbity/world/npcs/#vilma'),
    ('Zacharias', None, '/hobbity/world/npcs/#zacharias'),
    # Locations (main towns only)
    ('Huddle Farm', None, '/hobbity/world/places/#huddle-farm'),
    ('The Right Way Inn', None, '/hobbity/world/places/#the-right-way-inn'),
    ('The Right Way', None, '/hobbity/world/places/#the-right-way-inn'),
    ('Thistledown', None, '/hobbity/world/places/#thistledown'),
    ('Gomwick', None, '/hobbity/world/places/#gomwick'),
    ('Orlane', None, '/hobbity/world/places/#orlane'),
]

# Build processed list sorted by name length descending
PROSE_ENTITIES = []
for name, regex_override, target in _RAW_ENTITIES:
    pattern = regex_override if regex_override else re.escape(name)
    PROSE_ENTITIES.append((name, pattern, target))
PROSE_ENTITIES.sort(key=lambda x: -len(x[0]))


# --- Helpers ---

def find_header_end(lines):
    """Find the line index of the first ## heading."""
    for i, line in enumerate(lines):
        if line.startswith('## '):
            return i
    return len(lines)


def is_linkable_line(line):
    """Check if a line is prose that should have entity links added."""
    stripped = line.strip()
    if not stripped:
        return False
    if stripped.startswith('#'):
        return False
    if stripped.startswith('!['):
        return False
    if stripped.startswith('>'):
        return False
    if stripped.startswith('---'):
        return False
    return True


def protect_links(text):
    """Replace existing markdown links and special tags with placeholders."""
    placeholders = {}
    counter = [0]

    def make_ph(m):
        key = f'\x00PH{counter[0]}\x00'
        placeholders[key] = m.group(0)
        counter[0] += 1
        return key

    # Protect image links, then regular links, then dfn tags
    text = re.sub(r'!\[[^\]]*\]\([^)]*\)', make_ph, text)
    text = re.sub(r'\[[^\]]*\]\([^)]*\)', make_ph, text)
    text = re.sub(r'<dfn[^>]*>[^<]*</dfn>', make_ph, text)
    return text, placeholders


def restore_links(text, placeholders):
    """Restore protected links from placeholders."""
    for key, value in placeholders.items():
        text = text.replace(key, value)
    return text


# --- Linking functions ---

def link_header_pcs(lines, end):
    """Link PC names in the header section."""
    for i in range(end):
        line = lines[i]
        for name, target in PC_LINKS.items():
            if name in line and f'[{name}]' not in line:
                lines[i] = lines[i].replace(name, f'[{name}]({target})')


def link_header_locations(lines, end):
    """Link locations in the **Location:** header line. Returns set of linked targets."""
    linked = set()
    for i in range(end):
        line = lines[i]
        if '**Location:**' not in line:
            continue
        for name, target in sorted(HEADER_LOCATIONS, key=lambda x: -len(x[0])):
            if name in line and f'[{name}]' not in line:
                lines[i] = lines[i].replace(name, f'[{name}]({target})', 1)
                linked.add(target)
                line = lines[i]
    return linked


def link_prose(lines, start, pre_linked):
    """Link first mention of each entity in prose lines."""
    linked_targets = set(pre_linked)

    for i in range(start, len(lines)):
        line = lines[i]
        if not is_linkable_line(line):
            continue

        for _name, pattern, target in PROSE_ENTITIES:
            if target in linked_targets:
                continue

            # Protect all existing links (including ones added in earlier iterations)
            protected, placeholders = protect_links(line)

            regex = r'\b' + pattern + r'\b'
            match = re.search(regex, protected)
            if match:
                matched_text = match.group(0)
                replacement = f'[{matched_text}]({target})'
                protected = (
                    protected[: match.start()]
                    + replacement
                    + protected[match.end() :]
                )
                line = restore_links(protected, placeholders)
                lines[i] = line
                linked_targets.add(target)


# --- Banned game term warnings ---

BANNED_PATTERNS = [
    (r'\bmorale check\b', 'morale check'),
    (r'\bstrength check\b', 'strength check'),
    (r'\bAC \d', 'AC (armor class)'),
    (r'\bnatural 20', 'natural 20'),
    (r'\bnatural twenty', 'natural twenty'),
    (r'\bcritical hit', 'critical hit'),
    (r'\bhit points?\b', 'hit points'),
    (r'\b\+\d+ sling', '+N equipment notation'),
]


def check_banned_terms(path, lines):
    """Warn about banned game terms in prose (not in Conclusion/Enemies/Treasure)."""
    in_exception_section = False
    warnings = []
    for i, line in enumerate(lines):
        stripped = line.strip()
        # Track exception sections
        if re.match(r'^#{1,4} (Conclusion|Enemies Defeated|Treasure)', stripped):
            in_exception_section = True
            continue
        if stripped.startswith('#') and not in_exception_section:
            in_exception_section = False
        if in_exception_section or stripped.startswith('>') or stripped.startswith('#'):
            continue
        for pattern, label in BANNED_PATTERNS:
            if re.search(pattern, line, re.IGNORECASE):
                warnings.append(f'  Line {i + 1}: "{label}" — {stripped[:80]}')
    if warnings:
        print(f'  ⚠ Banned game terms in {path.name}:')
        for w in warnings:
            print(w)


# --- Main ---

def process_file(path):
    """Process a single story file."""
    text = path.read_text()
    lines = text.split('\n')
    header_end = find_header_end(lines)

    # Link headers
    link_header_pcs(lines, header_end)
    location_targets = link_header_locations(lines, header_end)

    # Link prose (skip targets already linked in header)
    link_prose(lines, header_end, location_targets)

    # Check for banned terms
    check_banned_terms(path, lines)

    new_text = '\n'.join(lines)
    if new_text != text:
        if DRY_RUN:
            print(f'Would modify: {path.name}')
        else:
            path.write_text(new_text)
            print(f'Modified: {path.name}')
    else:
        print(f'No changes: {path.name}')


def main():
    stories = sorted(STORY_DIR.glob('*.md'))
    print(f'Processing {len(stories)} story files...')
    for story in stories:
        process_file(story)
    print('Done.')


if __name__ == '__main__':
    main()
