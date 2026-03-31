#!/usr/bin/env python3
"""
Fix Whisper misrecognitions in a D&D session transcript using Claude.

Reads the campaign context doc and sends transcript chunks to Claude
to identify and correct proper noun misrecognitions.

Usage:
    fix-transcript.py <transcript> [-o OUTPUT]

Requires ANTHROPIC_API_KEY environment variable.
"""

import argparse
import json
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CONTEXT_PATH = os.path.join(SCRIPT_DIR, "..", "HOBBIT_CAMPAIGN_CONTEXT.md")
MAX_CHUNK_CHARS = 80_000  # ~20k tokens per chunk, well under context limit


def read_file(path):
    with open(path) as f:
        return f.read()


def chunk_transcript(lines, max_chars=MAX_CHUNK_CHARS):
    """Split transcript lines into chunks that fit within the char budget."""
    chunks = []
    current = []
    current_len = 0

    for line in lines:
        line_len = len(line) + 1
        if current and current_len + line_len > max_chars:
            chunks.append(current)
            current = []
            current_len = 0
        current.append(line)
        current_len += line_len

    if current:
        chunks.append(current)

    return chunks


SYSTEM_PROMPT = """\
You are a transcript correction tool for a D&D campaign. You fix Whisper \
speech-to-text misrecognitions of proper nouns (character names, place names, \
NPC names, item names, game terms).

You will receive:
1. Campaign context with correct spellings of all proper nouns
2. A chunk of transcript to correct

Return ONLY a JSON array of corrections. Each correction is an object:
{"line": <1-indexed line number within the chunk>, "old": "<exact text to replace>", "new": "<corrected text>"}

Rules:
- Only fix clear misrecognitions of proper nouns from the campaign context.
- Do not fix grammar, punctuation, filler words, or rephrase anything.
- Do not "improve" the transcript — only correct names/terms that Whisper got wrong.
- If there are no corrections needed, return an empty array: []
- Return raw JSON only, no markdown fences."""


def get_corrections(client, context, chunk_lines, chunk_index, total_chunks):
    """Send a chunk to Claude and get back corrections."""
    chunk_text = "\n".join(
        f"{i+1}: {line}" for i, line in enumerate(chunk_lines)
    )

    user_msg = f"""## Campaign Context

{context}

## Transcript Chunk ({chunk_index + 1}/{total_chunks})

{chunk_text}"""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
    )

    text = response.content[0].text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        print(f"  [warning] Failed to parse response for chunk {chunk_index + 1}:",
              file=sys.stderr)
        print(f"  {text[:200]}", file=sys.stderr)
        return []


def apply_corrections(lines, all_corrections):
    """Apply corrections to transcript lines. Returns corrected lines and stats."""
    fixed = list(lines)
    total = 0
    changes = {}

    for offset, corrections in all_corrections:
        for c in corrections:
            line_idx = offset + c["line"] - 1
            if line_idx < len(fixed) and c["old"] in fixed[line_idx]:
                fixed[line_idx] = fixed[line_idx].replace(c["old"], c["new"], 1)
                key = f"{c['old']} -> {c['new']}"
                changes[key] = changes.get(key, 0) + 1
                total += 1

    return fixed, changes, total


def main():
    parser = argparse.ArgumentParser(
        description="Fix Whisper misrecognitions in a transcript using Claude.",
    )
    parser.add_argument("transcript", help="Path to the transcript markdown file.")
    parser.add_argument(
        "-o", "--out", default=None, metavar="FILE",
        help="Output path for the fixed transcript (default: overwrite input).",
    )
    parser.add_argument(
        "-c", "--context", default=CONTEXT_PATH, metavar="FILE",
        help=f"Path to campaign context file (default: {CONTEXT_PATH}).",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Show corrections without writing the file.",
    )
    opts = parser.parse_args()

    if not os.path.exists(opts.transcript):
        print(f"[error] File not found: {opts.transcript}")
        raise SystemExit(1)

    if not os.path.exists(opts.context):
        print(f"[error] Campaign context not found: {opts.context}")
        raise SystemExit(1)

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("[error] ANTHROPIC_API_KEY environment variable not set.")
        raise SystemExit(1)

    import anthropic
    client = anthropic.Anthropic(api_key=api_key)

    context = read_file(opts.context)
    transcript = read_file(opts.transcript)
    lines = transcript.splitlines()

    # Split header from body so we don't chunk the header
    body_start = 0
    for i, line in enumerate(lines):
        if line.startswith("**["):
            body_start = i
            break

    header = lines[:body_start]
    body = lines[body_start:]

    chunks = chunk_transcript(body)
    print(f"[fix] {len(lines)} lines, {len(chunks)} chunk(s)")

    all_corrections = []
    for i, chunk in enumerate(chunks):
        print(f"[fix] Processing chunk {i + 1}/{len(chunks)} ({len(chunk)} lines)...")
        corrections = get_corrections(client, context, chunk, i, len(chunks))
        if corrections:
            print(f"  Found {len(corrections)} correction(s)")
            all_corrections.append((body_start, corrections))
        else:
            print(f"  No corrections")
        # Offset for next chunk accounts for lines already processed
        body_start += len(chunk)

    if not all_corrections:
        print("[fix] No corrections needed.")
        return

    fixed, changes, total = apply_corrections(lines, all_corrections)

    print(f"\n[fix] {total} correction(s):")
    for change, count in sorted(changes.items(), key=lambda x: -x[1]):
        print(f"  {change} ({count}x)")

    if opts.dry_run:
        print("\n[dry-run] No file written.")
        return

    out_path = opts.out or opts.transcript
    with open(out_path, "w") as f:
        f.write("\n".join(fixed))
        if fixed and not fixed[-1].endswith("\n"):
            f.write("\n")

    print(f"\n[fix] Written to {out_path}")


if __name__ == "__main__":
    main()
