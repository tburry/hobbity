#!/usr/bin/env python3
"""Fetch Gmail threads via MCP tool and save as JSON files.

Usage:
    # Pipe MCP tool output (JSON) for a single thread:
    echo '<json>' | python3 scripts/fetch_gmail_threads.py

    # Or pass a file containing MCP JSON output:
    python3 scripts/fetch_gmail_threads.py --file /path/to/mcp-output.json

The script strips the _mcp_structured metadata and saves the thread
to emails/_raw/{threadId}.json.
"""

import argparse
import json
import sys
from pathlib import Path

OUTPUT_DIR = Path("emails/_raw")


def save_thread(data: dict) -> str | None:
    """Save thread data to a JSON file, stripping MCP metadata."""
    clean = {k: v for k, v in data.items() if k != "_mcp_structured"}
    tid = clean.get("threadId")
    if not tid:
        return None

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    outpath = OUTPUT_DIR / f"{tid}.json"
    with open(outpath, "w") as f:
        json.dump(clean, f, indent=2)
    msg_count = len(clean.get("messages", []))
    body_total = sum(len(m.get("body", "")) for m in clean.get("messages", []))
    print(f"Saved {outpath} ({msg_count} messages, {body_total} body chars)")
    return str(outpath)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", help="Path to JSON file with MCP thread output")
    args = parser.parse_args()

    if args.file:
        with open(args.file) as f:
            data = json.load(f)
    else:
        data = json.load(sys.stdin)

    if isinstance(data, list):
        for item in data:
            if isinstance(item, dict) and "text" in item:
                inner = json.loads(item["text"])
                if "threadId" in inner:
                    save_thread(inner)
                    return
    if isinstance(data, dict) and "threadId" in data:
        save_thread(data)
    else:
        print("No thread data found")
        sys.exit(1)


if __name__ == "__main__":
    main()
