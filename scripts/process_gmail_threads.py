#!/usr/bin/env python3
"""Process Gmail thread JSON files into markdown and .eml files.

Usage:
    process_gmail_threads.py [--raw-dir DIR] [--output-dir DIR]

Reads thread JSON files (from gmail_read_thread MCP output) from raw-dir,
produces:
    <output-dir>/<yyyy-mm-dd-hhmm-XX-subject-slug>.md
    <output-dir>/eml/<yyyy-mm-dd-hhmm-XX-subject-slug>.eml
    <output-dir>/attachments/<msg-id>/<filename>  (linked from md)
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from email.mime.text import MIMEText
from email.utils import parsedate_to_datetime
from pathlib import Path

# Email -> initials mapping
INITIALS = {
    "contact@toddburry.com": "TB",
    "gus.miranda@gmail.com": "GM",
    "les.blackwell@gmail.com": "LB",
    "robertsoncrusoe@gmail.com": "SR",
    "scunny1973@gmail.com": "SM",
}


def extract_email(from_header: str) -> str:
    """Extract bare email from 'Name <email>' format."""
    m = re.search(r"<([^>]+)>", from_header)
    return m.group(1).lower() if m else from_header.strip().lower()


def get_initials(from_header: str) -> str:
    """Get initials from a From header."""
    email = extract_email(from_header)
    if email in INITIALS:
        return INITIALS[email]
    # Fallback: first letter of each name part
    name = from_header.split("<")[0].strip().strip('"')
    if name:
        parts = name.split()
        return "".join(p[0].upper() for p in parts if p)
    return "XX"


def slugify(subject: str, max_len: int = 50) -> str:
    """Convert subject to a filename slug."""
    # Strip Re:/Fwd: prefixes
    s = re.sub(r"^(Re|Fwd|re|fwd):\s*", "", subject).strip()
    s = s.lower()
    # Remove punctuation (don't convert to dashes)
    s = re.sub(r"[^\w\s-]", "", s)
    # Collapse whitespace to dashes
    s = re.sub(r"[\s_]+", "-", s).strip("-")
    return s[:max_len].rstrip("-")


def parse_date(date_str: str) -> datetime | None:
    """Parse an email date string."""
    if not date_str:
        return None
    try:
        return parsedate_to_datetime(date_str)
    except Exception:
        pass
    # Fallback: try internalDate (epoch ms)
    return None


def parse_internal_date(ms_str: str) -> datetime:
    """Parse internalDate (epoch milliseconds)."""
    return datetime.fromtimestamp(int(ms_str) / 1000, tz=timezone.utc)


def strip_quoted_reply(body: str) -> str:
    """Remove quoted reply text from email body.

    Strips everything from the first 'On ... wrote:' line onwards,
    and any lines starting with '>'.
    """
    lines = body.split("\n")
    result = []
    in_quote = False

    for i, line in enumerate(lines):
        stripped = line.strip()

        # Detect "On <date>, <name> wrote:" pattern
        if re.match(r"^On .+ wrote:$", stripped):
            in_quote = True
            continue

        if in_quote:
            # Stay in quote mode for '>' lines and blank lines
            if stripped.startswith(">") or stripped == "":
                continue
            # Non-quoted, non-blank line after quote block — back to content
            in_quote = False

        if stripped.startswith(">"):
            continue

        result.append(line)

    # Trim trailing blank lines
    while result and result[-1].strip() == "":
        result.pop()

    return "\n".join(result)


def make_filename(msg: dict) -> str:
    """Generate yyyy-mm-dd-hhmm-XX-subject-slug filename."""
    headers = msg.get("headers", {})
    date_str = headers.get("Date", "")
    dt = parse_date(date_str)
    if not dt and msg.get("internalDate"):
        dt = parse_internal_date(msg["internalDate"])
    if not dt:
        dt = datetime.now(tz=timezone.utc)

    initials = get_initials(headers.get("From", ""))
    subject = headers.get("Subject", "no-subject")
    slug = slugify(subject)

    return f"{dt.strftime('%Y-%m-%d-%H%M')}-{initials}-{slug}"


def msg_to_eml(msg: dict) -> str:
    """Convert a message dict to .eml content."""
    headers = msg.get("headers", {})
    body = msg.get("body", "")

    mime = MIMEText(body, "plain", "utf-8")
    mime["From"] = headers.get("From", "")
    mime["To"] = headers.get("To", "")
    if headers.get("Cc"):
        mime["Cc"] = headers["Cc"]
    mime["Subject"] = headers.get("Subject", "")
    mime["Date"] = headers.get("Date", "")
    mime["Message-ID"] = f"<{msg.get('messageId', 'unknown')}@gmail.com>"

    return mime.as_string()


def msg_to_markdown(msg: dict, eml_relpath: str, thread_msg_ids: set[str]) -> str:
    """Convert a message dict to markdown content."""
    headers = msg.get("headers", {})
    body = msg.get("body", "")

    date_str = headers.get("Date", "")
    from_hdr = headers.get("From", "")
    to_hdr = headers.get("To", "")
    cc_hdr = headers.get("Cc", "")
    subject = headers.get("Subject", "no subject")

    # Strip quoted replies if this thread has multiple messages
    if len(thread_msg_ids) > 1:
        body = strip_quoted_reply(body)

    # Clean up the body
    body = body.replace("\r\n", "\n").strip()

    # Build markdown
    lines = [
        f"# {subject}",
        "",
        f"- **From:** {from_hdr}",
        f"- **To:** {to_hdr}",
    ]
    if cc_hdr:
        lines.append(f"- **Cc:** {cc_hdr}")
    lines.extend([
        f"- **Date:** {date_str}",
        f"- **Source:** [eml]({eml_relpath})",
        "",
    ])

    # Attachments
    attachments = msg.get("attachments", [])
    if attachments:
        lines.append("## Attachments")
        lines.append("")
        for att in attachments:
            fname = att.get("filename", "unknown")
            size = att.get("size", 0)
            size_kb = size / 1024
            att_path = f"attachments/{msg.get('messageId', 'unknown')}/{fname}"
            lines.append(f"- [{fname}]({att_path}) ({size_kb:.0f} KB)")
        lines.append("")

    lines.extend([
        "---",
        "",
        body,
        "",
    ])

    return "\n".join(lines)


def process_thread(thread_data: dict, output_dir: Path):
    """Process a single thread's data into md + eml files."""
    messages = thread_data.get("messages", [])
    if not messages:
        return []

    eml_dir = output_dir / "eml"
    eml_dir.mkdir(parents=True, exist_ok=True)

    thread_msg_ids = {m["messageId"] for m in messages}
    created = []

    for msg in messages:
        # Skip drafts
        labels = msg.get("labelIds", [])
        if "DRAFT" in labels:
            continue

        fname = make_filename(msg)

        # Write .eml
        eml_path = eml_dir / f"{fname}.eml"
        eml_content = msg_to_eml(msg)
        eml_path.write_text(eml_content)

        # Write .md
        eml_relpath = f"eml/{fname}.eml"
        md_content = msg_to_markdown(msg, eml_relpath, thread_msg_ids)
        md_path = output_dir / f"{fname}.md"
        md_path.write_text(md_content)

        created.append(fname)

    return created


def main():
    parser = argparse.ArgumentParser(description="Process Gmail thread JSON into md + eml")
    parser.add_argument("--raw-dir", default="private/emails/_raw",
                        help="Directory containing thread JSON files")
    parser.add_argument("--output-dir", default="private/emails",
                        help="Output directory for md and eml files")
    args = parser.parse_args()

    raw_dir = Path(args.raw_dir)
    output_dir = Path(args.output_dir)

    if not raw_dir.exists():
        print(f"Raw directory {raw_dir} does not exist")
        sys.exit(1)

    output_dir.mkdir(parents=True, exist_ok=True)

    json_files = sorted(raw_dir.glob("*.json"))
    if not json_files:
        print(f"No JSON files found in {raw_dir}")
        sys.exit(1)

    total = 0
    for jf in json_files:
        with open(jf) as f:
            data = json.load(f)

        # Handle MCP wrapper format [{type, text}]
        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict) and "text" in item:
                    data = json.loads(item["text"])
                    break

        created = process_thread(data, output_dir)
        total += len(created)
        if created:
            print(f"{jf.name}: {len(created)} messages")

    print(f"\nTotal: {total} emails processed")


if __name__ == "__main__":
    main()
