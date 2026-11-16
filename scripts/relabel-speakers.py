#!/usr/bin/env python3
"""
Reassign transcript lines from one speaker to another, for shared microphones.

When two players sit at one mic, Craig records them on a single track and
Whisper labels every line with that track's name. Speaker attribution then
has to come from context. Record the decisions in a mapping file and apply
them with this script, so they are reviewable and can be re-run.

Usage:
    relabel-speakers.py <transcript> <mapping.tsv> [--from SPEAKER] [--dry-run]

Mapping file: one entry per line, tab-separated, '#' starts a comment.

    timestamp<TAB>new_speaker[<TAB>text prefix]

    1:07:04	robertsonstephen
    2:36:00	robertsonstephen	The manacles

The text prefix is only needed when the --from speaker has more than one line
at the same timestamp. Entries already applied are skipped, so re-running is
safe. The transcript header gains a "Shared mic" note naming the mapping file.
"""

import argparse
import os
import re
import sys

LINE_RE = re.compile(r"^\*\*\[(?P<ts>[\d:]+)\] (?P<speaker>[^:*]+):\*\* ?(?P<text>.*)$")


def load_mapping(path):
    entries = []
    with open(path) as f:
        for n, raw in enumerate(f, 1):
            line = raw.split("#", 1)[0].rstrip("\n")
            if not line.strip():
                continue
            parts = line.split("\t")
            if len(parts) < 2:
                sys.exit(f"[error] {path}:{n}: expected timestamp<TAB>speaker")
            ts, speaker = parts[0].strip(), parts[1].strip()
            prefix = parts[2].strip() if len(parts) > 2 else ""
            entries.append((n, ts, speaker, prefix))
    return entries


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument("transcript")
    parser.add_argument("mapping")
    parser.add_argument("--from", dest="source", default="toddburry",
                        help="Speaker whose lines are being reassigned (default: toddburry).")
    parser.add_argument("--dry-run", action="store_true")
    opts = parser.parse_args()

    with open(opts.transcript) as f:
        lines = f.read().split("\n")

    parsed = [LINE_RE.match(l) for l in lines]
    changed = 0
    for n, ts, target, prefix in load_mapping(opts.mapping):
        def hits(speaker):
            return [i for i, m in enumerate(parsed)
                    if m and m["ts"] == ts and m["speaker"] == speaker
                    and m["text"].startswith(prefix)]

        source_hits = hits(opts.source)
        if not source_hits:
            if hits(target):
                continue  # already applied
            sys.exit(f"[error] mapping line {n}: no {opts.source} line at [{ts}]"
                     + (f" starting {prefix!r}" if prefix else ""))
        if len(source_hits) > 1:
            sys.exit(f"[error] mapping line {n}: {len(source_hits)} {opts.source} lines at"
                     f" [{ts}]; add a text prefix to pick one")
        i = source_hits[0]
        lines[i] = f"**[{ts}] {target}:** {parsed[i]['text']}"
        parsed[i] = LINE_RE.match(lines[i])
        changed += 1
        print(f"  [{ts}] {opts.source} -> {target}: {parsed[i]['text'][:60]}")

    note = (f"- **Shared mic:** some {opts.source} lines reassigned from context"
            f" ({os.path.basename(opts.mapping)})")
    if changed and note not in lines:
        speakers_at = next((i for i, l in enumerate(lines) if l.startswith("- **Speakers:**")), None)
        if speakers_at is not None:
            lines.insert(speakers_at + 1, note)

    print(f"[relabel] {changed} line(s) reassigned")
    if not opts.dry_run and changed:
        with open(opts.transcript, "w") as f:
            f.write("\n".join(lines))
        print(f"[relabel] Written to {opts.transcript}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
