#!/usr/bin/env python3
"""Unwrap hard-wrapped paragraphs in a markdown file.

Joins consecutive non-blank lines into single lines, preserving blank-line
paragraph boundaries, headings, and list items as paragraph starts.
"""

import sys
import re


def unwrap(path: str) -> str:
    with open(path) as f:
        lines = f.readlines()

    paragraphs: list[str] = []
    current: list[str] = []

    def flush():
        if current:
            paragraphs.append(" ".join(current))
            current.clear()

    for line in lines:
        stripped = line.rstrip("\n")

        if stripped == "":
            flush()
            paragraphs.append("")
        elif stripped.startswith("#") or stripped.startswith("- "):
            # Headings and list items start a new paragraph
            flush()
            current.append(stripped)
        else:
            current.append(stripped)

    flush()
    return "\n".join(paragraphs) + "\n"


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <file.md>", file=sys.stderr)
        sys.exit(1)

    result = unwrap(sys.argv[1])
    with open(sys.argv[1], "w") as f:
        f.write(result)
    print(f"Unwrapped: {sys.argv[1]}")
