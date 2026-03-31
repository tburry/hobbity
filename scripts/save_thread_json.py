#!/usr/bin/env python3
"""Save Gmail thread JSON from MCP tool output to individual files.

Usage:
    # From an MCP result file (large results auto-saved):
    python3 save_thread_json.py --from-mcp-file <path>

    # From raw JSON on stdin:
    echo '{"threadId": "...", ...}' | python3 save_thread_json.py

    # Process all MCP result files matching a pattern:
    python3 save_thread_json.py --from-mcp-dir <dir> --pattern '*gmail_read_thread*'
"""

import argparse
import json
import sys
from pathlib import Path

OUTPUT_DIR = Path("private/emails/_raw")


def save_thread(thread_data: dict) -> str | None:
    """Save thread data to a JSON file. Returns the filename."""
    tid = thread_data.get("threadId")
    if not tid:
        return None

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    outpath = OUTPUT_DIR / f"{tid}.json"
    with open(outpath, "w") as f:
        json.dump(thread_data, f, indent=2)
    msg_count = len(thread_data.get("messages", []))
    print(f"Saved {outpath} ({msg_count} messages)")
    return str(outpath)


def load_mcp_result(filepath: str) -> dict | None:
    """Load thread data from an MCP tool result file."""
    with open(filepath) as f:
        data = json.load(f)

    # MCP results are wrapped: [{type: "text", text: "<json>"}]
    if isinstance(data, list):
        for item in data:
            if isinstance(item, dict) and "text" in item:
                inner = json.loads(item["text"])
                if "threadId" in inner:
                    return inner
    elif isinstance(data, dict) and "threadId" in data:
        return data
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--from-mcp-file", help="Path to MCP result file")
    parser.add_argument("--from-mcp-dir", help="Directory of MCP result files")
    parser.add_argument("--pattern", default="*gmail_read_thread*",
                        help="Glob pattern for MCP files")
    args = parser.parse_args()

    if args.from_mcp_file:
        data = load_mcp_result(args.from_mcp_file)
        if data:
            save_thread(data)
        else:
            print(f"No thread data found in {args.from_mcp_file}")

    elif args.from_mcp_dir:
        mcp_dir = Path(args.from_mcp_dir)
        files = sorted(mcp_dir.glob(args.pattern))
        for f in files:
            data = load_mcp_result(str(f))
            if data:
                save_thread(data)

    else:
        # Read from stdin
        data = json.load(sys.stdin)
        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict) and "text" in item:
                    data = json.loads(item["text"])
                    break
        if isinstance(data, dict) and "threadId" in data:
            save_thread(data)
        else:
            print("No thread data found on stdin")
            sys.exit(1)


if __name__ == "__main__":
    main()
