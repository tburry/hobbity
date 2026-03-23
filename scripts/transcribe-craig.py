#!/usr/bin/env python3
"""
Transcribe D&D session tracks (from Craig bot) into a single speaker-labeled transcript.

Usage:
    transcribe_dnd [options] [directory]

See transcribe_dnd --help for all options.
"""

import argparse
import csv
import glob
import io
import os
import re
import subprocess
import time
import venv
import warnings

warnings.filterwarnings("ignore", message="FP16 is not supported on CPU")

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
VENV_DIR = os.path.join(SCRIPT_DIR, ".venv")
DEFAULT_MODEL = "medium"


# ── track discovery ───────────────────────────────────────────────────────────

def parse_info(audio_dir):
    """Parse Craig's info.txt for session metadata."""
    info_path = os.path.join(audio_dir, "info.txt")
    meta = {}
    if not os.path.exists(info_path):
        return meta
    with open(info_path) as f:
        for line in f:
            line = line.strip()
            if line.startswith("Start time:"):
                meta["start_time"] = line.split("\t")[-1].strip()
            elif line.startswith("Guild:"):
                meta["guild"] = line.split("\t")[-1].strip()
            elif line.startswith("Channel:"):
                meta["channel"] = line.split("\t")[-1].strip()
            elif line.startswith("Recording"):
                meta["recording_id"] = line.split()[-1].strip()
    return meta


def discover_tracks(audio_dir):
    """Find .flac files and derive speaker names from filenames like '1-olblacky.flac'."""
    flacs = sorted(glob.glob(os.path.join(audio_dir, "*.flac")))
    if not flacs:
        print(f"[error] No .flac files found in {audio_dir}")
        raise SystemExit(1)

    tracks = []
    for path in flacs:
        basename = os.path.splitext(os.path.basename(path))[0]
        speaker = re.sub(r"^\d+-", "", basename)
        tracks.append((path, speaker))

    print(f"[tracks] Found {len(tracks)} tracks in {audio_dir}:")
    for path, speaker in tracks:
        print(f"  {os.path.basename(path)} -> {speaker}")
    print()
    return tracks


# ── dependency management ─────────────────────────────────────────────────────

def check_for_updates():
    pip = os.path.join(VENV_DIR, "bin", "pip")
    print("[setup] Checking for whisper updates...")
    result = subprocess.run(
        [pip, "install", "--upgrade", "openai-whisper"],
        capture_output=True, text=True,
    )
    if "Successfully installed" in result.stdout:
        print("[setup] Updated whisper to latest version.")
    else:
        print("[setup] Whisper is up to date.")


# ── formatting helpers ────────────────────────────────────────────────────────

def format_ts(seconds):
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def format_dur(seconds):
    m, s = divmod(int(seconds), 60)
    return f"{m}m {s}s" if m else f"{s}s"


def format_size(path):
    size = os.path.getsize(path)
    if size >= 1024 * 1024:
        return f"{size / (1024 * 1024):.1f} MB"
    return f"{size / 1024:.1f} KB"


# ── step 1: transcribe to CSV ────────────────────────────────────────────────

def get_audio_duration(path):
    """Get audio duration in seconds using whisper's audio loader."""
    from whisper.audio import SAMPLE_RATE, log_mel_spectrogram, N_FRAMES, HOP_LENGTH, N_SAMPLES
    mel = log_mel_spectrogram(path, padding=0)
    return float(mel.shape[-1] * HOP_LENGTH / SAMPLE_RATE)


CHUNK_SECONDS = 300  # 5 minutes per chunk


def transcribe_to_csv(model, tracks, csv_path, trim=None):
    """
    Transcribe each track sequentially, appending rows to a CSV file.
    Processes in 5-minute chunks so segments stream to the CSV as they're decoded.
    """
    with open(csv_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["speaker", "start", "end", "text"])
        f.flush()

        for i, (path, speaker) in enumerate(tracks, 1):
            size = format_size(path)
            duration = get_audio_duration(path)
            if trim:
                duration = min(duration, trim * 60)

            print(f"[{i}/{len(tracks)}] Transcribing {os.path.basename(path)} "
                  f"({speaker}, {size}, {format_dur(duration)})...")
            t0 = time.time()
            seg_count = 0

            # Process in chunks, flushing after each
            offset = 0.0
            while offset < duration:
                end = min(offset + CHUNK_SECONDS, duration)
                clip_ts = f"{offset},{end}"
                result = model.transcribe(path, language="en", verbose=False,
                                          clip_timestamps=clip_ts)
                for seg in result["segments"]:
                    text = seg["text"].strip()
                    if not text:
                        continue
                    writer.writerow([speaker, f"{seg['start']:.2f}",
                                     f"{seg['end']:.2f}", text])
                    seg_count += 1
                f.flush()

                pct = min(100, int(end / duration * 100))
                print(f"  [{speaker}] {format_ts(end)} / "
                      f"{format_ts(duration)} ({pct}%) - {seg_count} segments")
                offset = end

            elapsed = time.time() - t0
            print(f"  [{speaker}] Done — {seg_count} segments in {format_dur(elapsed)}")

    print()


# ── step 2: merge CSV into markdown ──────────────────────────────────────────

def merge_csv_to_markdown(csv_path, md_path, meta, speakers, model_size):
    """Read CSV, merge per-speaker blocks, dedup, write markdown."""
    # Read all rows
    rows = []
    with open(csv_path) as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append({
                "speaker": row["speaker"],
                "start": float(row["start"]),
                "end": float(row["end"]),
                "text": row["text"],
            })

    rows.sort(key=lambda r: r["start"])

    # Merge per-speaker: group consecutive segments from the same speaker,
    # allowing other speakers to interleave (since tracks are recorded separately).
    from collections import defaultdict
    by_speaker = defaultdict(list)
    for row in rows:
        by_speaker[row["speaker"]].append(row)

    blocks = []
    for speaker, segs in by_speaker.items():
        segs.sort(key=lambda s: s["start"])
        current = None
        for seg in segs:
            if current and (seg["start"] - current["end"]) < 30.0:
                current["text"] += " " + seg["text"]
                current["end"] = seg["end"]
            else:
                if current:
                    blocks.append(current)
                current = dict(seg)
        if current:
            blocks.append(current)

    blocks.sort(key=lambda b: b["start"])

    # Dedup: remove blocks where the same speaker says the exact same text
    # within 60 seconds (whisper hallucination)
    deduped = []
    for block in blocks:
        is_dup = False
        for prev in reversed(deduped[-10:]):
            if (prev["speaker"] == block["speaker"]
                    and prev["text"] == block["text"]
                    and (block["start"] - prev["start"]) < 60.0):
                is_dup = True
                break
        if not is_dup:
            deduped.append(block)

    removed = len(blocks) - len(deduped)
    if removed:
        print(f"[merge] Removed {removed} duplicate blocks (hallucinations).")

    # Write markdown
    with open(md_path, "w") as f:
        f.write(format_header(meta, speakers, model_size))
        for block in deduped:
            f.write(f"**[{format_ts(block['start'])}] {block['speaker']}:** {block['text']}\n\n")

    print(f"[merge] {len(deduped)} blocks -> {md_path}")


def format_header(meta, speakers, model_size=None):
    from datetime import datetime
    lines = []
    if "start_time" in meta:
        try:
            dt = datetime.fromisoformat(meta["start_time"].replace("Z", "+00:00"))
            lines.append(f"# D&D Session — {dt.strftime('%B %d, %Y')}")
            lines.append("")
            lines.append(f"**Start time:** {dt.strftime('%I:%M %p %Z')}")
        except ValueError:
            lines.append("# D&D Session")
            lines.append("")
            lines.append(f"**Start time:** {meta['start_time']}")
    else:
        lines.append("# D&D Session")
        lines.append("")

    if "channel" in meta:
        channel = re.sub(r"\s*\(\d+\)$", "", meta["channel"])
        lines.append(f"**Channel:** {channel}")

    lines.append(f"**Speakers:** {', '.join(speakers)}")
    if model_size:
        lines.append(f"**Model:** whisper-{model_size}")
    lines.append("")
    lines.append("")
    return "\n".join(lines)


# ── main ──────────────────────────────────────────────────────────────────────

def parse_args():
    parser = argparse.ArgumentParser(
        description="Transcribe D&D session tracks (from Craig bot) into a "
                    "single speaker-labeled transcript.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "directory", nargs="?", default=".",
        help="Directory containing .flac track files (default: current directory).",
    )
    parser.add_argument(
        "-m", "--model", default=DEFAULT_MODEL,
        choices=["tiny", "base", "small", "medium", "large"],
        help="Whisper model size (default: medium). Larger = more accurate but slower.",
    )
    parser.add_argument(
        "-o", "--out", default=None, metavar="FILE",
        help="Output transcript file (default: transcript.md in the audio directory).",
    )
    parser.add_argument(
        "-t", "--trim", type=float, default=None, metavar="N",
        help="Only process the first N minutes of each track (useful for debugging).",
    )
    parser.add_argument(
        "--merge-only", action="store_true",
        help="Skip transcription, just re-merge existing CSV into markdown.",
    )
    parser.add_argument(
        "--no-update", action="store_true",
        help="Skip checking for whisper package updates.",
    )
    return parser.parse_args()


def main():
    opts = parse_args()
    audio_dir = os.path.abspath(opts.directory)

    if not os.path.isdir(audio_dir):
        print(f"[error] Not a directory: {audio_dir}")
        raise SystemExit(1)

    md_path = os.path.abspath(opts.out) if opts.out else os.path.join(audio_dir, "transcript.md")
    csv_path = os.path.splitext(md_path)[0] + ".csv"

    print("=== D&D Session Transcription ===\n")

    meta = parse_info(audio_dir)
    tracks = discover_tracks(audio_dir)
    speakers = [s for _, s in tracks]

    if "start_time" in meta:
        print(f"[info] Session start: {meta['start_time']}")
    if opts.trim:
        print(f"[config] Limiting to first {opts.trim} minutes of each track.")
    if opts.out:
        print(f"[config] Output: {md_path}")
    print()

    if not opts.merge_only:
        if not opts.no_update:
            check_for_updates()

        import whisper

        print(f"[model] Loading Whisper '{opts.model}' model...")
        t0 = time.time()
        # MPS (Apple GPU) produces NaN values with whisper — known PyTorch bug.
        # Stick with CPU for now.
        model = whisper.load_model(opts.model)
        print(f"[model] Loaded in {format_dur(time.time() - t0)} "
              f"(device: {model.device})\n")

        print(f"[transcribe] Writing segments to {csv_path}")
        print(f"[transcribe] You can watch progress: tail -f {csv_path}\n")
        t0 = time.time()
        transcribe_to_csv(model, tracks, csv_path, opts.trim)
        print(f"[transcribe] Done in {format_dur(time.time() - t0)}\n")
    else:
        if not os.path.exists(csv_path):
            print(f"[error] CSV not found: {csv_path}")
            raise SystemExit(1)
        print(f"[merge-only] Reading existing {csv_path}\n")

    merge_csv_to_markdown(csv_path, md_path, meta, speakers, opts.model)
    print("\n=== Done ===")


if __name__ == "__main__":
    main()
