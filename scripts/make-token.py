#!/usr/bin/env python3
"""Generate a Foundry VTT dynamic token ring subject from an avatar image.

Usage: make-token.py [--padding RATIO] <avatar_image> [...]

Options:
  --padding PCT  Percentage of canvas reserved for ring padding (default: 0).
                 Foundry dynamic token rings expect 33 (subject fills inner 2/3).

Takes a square avatar image and crops it to a circle. Output is a 512x512 webp
with transparent background.

Produces <name>_token.webp alongside the input file.
"""

import sys
import os
import numpy as np
import cv2

TOKEN_SIZE = 512
# Percentage of canvas reserved for ring padding. 0 = no padding, 33 = Foundry default.
PADDING_PCT = 100/6


def make_token(image_path, padding_pct=PADDING_PCT):
    img = cv2.imread(image_path, cv2.IMREAD_UNCHANGED)
    if img is None:
        print(f"Error: cannot read {image_path}", file=sys.stderr)
        sys.exit(1)

    h, w = img.shape[:2]
    if h != w:
        print(f"Error: image is not square ({w}x{h})", file=sys.stderr)
        sys.exit(1)

    padding = padding_pct / 100
    subject_size = round(TOKEN_SIZE * (1 - padding))
    img = cv2.resize(img, (subject_size, subject_size), interpolation=cv2.INTER_AREA)

    # Ensure 4 channels (BGRA)
    if img.shape[2] == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)

    # Apply circular mask
    mask = np.zeros((subject_size, subject_size), dtype=np.uint8)
    center = subject_size // 2
    cv2.circle(mask, (center, center), center, 255, -1)
    img[:, :, 3] = cv2.bitwise_and(img[:, :, 3], mask)

    if padding > 0:
        canvas = np.zeros((TOKEN_SIZE, TOKEN_SIZE, 4), dtype=np.uint8)
        offset = (TOKEN_SIZE - subject_size) // 2
        canvas[offset:offset + subject_size, offset:offset + subject_size] = img
    else:
        canvas = img

    # Write output
    base, _ = os.path.splitext(image_path)
    # Strip _avatar suffix if present
    if base.endswith("_avatar"):
        base = base[:-7]
    out_path = f"{base}_token.webp"
    cv2.imwrite(out_path, canvas, [cv2.IMWRITE_WEBP_QUALITY, 85])
    pad_px = (TOKEN_SIZE - subject_size) // 2 if padding > 0 else 0
    print(f"Token: {out_path}, size: {TOKEN_SIZE}px, padding: {pad_px}px", file=sys.stderr)


if __name__ == "__main__":
    args = sys.argv[1:]

    if "--help" in args or "-h" in args or len(args) == 0:
        print(__doc__)
        sys.exit(0)

    # Parse --padding
    padding_pct = PADDING_PCT
    filtered = []
    skip_next = False
    for i, a in enumerate(args):
        if skip_next:
            skip_next = False
            continue
        if a == "--padding" and i + 1 < len(args):
            padding_pct = int(args[i + 1])
            skip_next = True
        elif a.startswith("--padding="):
            padding_pct = int(a.split("=", 1)[1])
        elif a.startswith("--"):
            continue
        else:
            filtered.append(a)

    if len(filtered) == 0:
        print(__doc__)
        sys.exit(0)

    for path in filtered:
        make_token(path, padding_pct=padding_pct)
