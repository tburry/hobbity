#!/usr/bin/env python3
"""Convert Gmail MCP thread JSON files into individual .eml files."""

import json
import sys
import os
import re
from email.mime.text import MIMEText
from email.utils import formatdate
from pathlib import Path


def sanitize_filename(s: str, max_len: int = 60) -> str:
    s = re.sub(r'[^\w\s-]', '', s)
    s = re.sub(r'\s+', '_', s.strip())
    return s[:max_len]


def thread_json_to_emls(thread_data: dict, outdir: Path):
    """Write one .eml per message in a thread."""
    messages = thread_data.get("messages", [])
    if not messages:
        return

    subject_base = sanitize_filename(
        messages[0].get("headers", {}).get("Subject", "no_subject")
    )

    for msg in messages:
        headers = msg.get("headers", {})
        body = msg.get("body", "")
        msg_id = msg.get("messageId", "unknown")
        date_str = headers.get("Date", "")

        # Build .eml content
        mime = MIMEText(body, "plain", "utf-8")
        mime["From"] = headers.get("From", "")
        mime["To"] = headers.get("To", "")
        if headers.get("Cc"):
            mime["Cc"] = headers["Cc"]
        mime["Subject"] = headers.get("Subject", "")
        mime["Date"] = date_str
        mime["Message-ID"] = f"<{msg_id}@gmail.com>"

        fname = f"{subject_base}_{msg_id[:8]}.eml"
        outpath = outdir / fname
        outpath.write_text(mime.as_string())
        print(f"  wrote {outpath.name}")


def process_file(filepath: str, outdir: Path):
    """Process a JSON file that may be a raw thread dict or an MCP tool-result wrapper."""
    with open(filepath) as f:
        data = json.load(f)

    # MCP tool results are wrapped in [{type, text}]
    if isinstance(data, list):
        for item in data:
            if isinstance(item, dict) and "text" in item:
                inner = json.loads(item["text"])
                if "messages" in inner:
                    thread_json_to_emls(inner, outdir)
                    return
    elif isinstance(data, dict):
        if "messages" in data:
            thread_json_to_emls(data, outdir)
            return

    print(f"  skipped {filepath} (no messages found)")


def main():
    outdir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("_inbox")
    outdir.mkdir(parents=True, exist_ok=True)

    # Process all JSON files passed as arguments or from stdin
    files = sys.argv[2:] if len(sys.argv) > 2 else []

    if not files:
        # Read JSON from stdin
        data = json.load(sys.stdin)
        if isinstance(data, list) and all(isinstance(d, dict) and "messages" in d for d in data):
            for thread in data:
                thread_json_to_emls(thread, outdir)
        elif isinstance(data, dict) and "messages" in data:
            thread_json_to_emls(data, outdir)
        else:
            print("Unrecognized input format")
            sys.exit(1)
    else:
        for f in files:
            print(f"Processing {f}...")
            process_file(f, outdir)


if __name__ == "__main__":
    main()
