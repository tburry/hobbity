#!/usr/bin/env python3
"""Detect head in an image and crop a square avatar.

Usage: make-avatar.py <image> [--debug]

Produces a square avatar as <name>_avatar.<ext>
  - Head centered horizontally, vertical center at 0.6 from bottom
  - Head circle is 1/2 the avatar dimensions
With --debug, draws the detection circle on the avatar
"""

import sys
import os
import cv2
import numpy as np

# Detection
# Shrink step per scan pass. Lower finds more faces but is slower. Range: 1.01–1.3
SCALE_FACTOR = 1.01     
# How many overlapping hits before a face is confirmed. Lower = more sensitive, more false positives
MIN_NEIGHBORS = 6 
# Ignore faces smaller than this (pixels). Raise for large images to skip noise        
MIN_FACE_SIZE = 100       

# Crop
HEAD_RATIO = 0.4          # How much of the avatar the head fills. 0.5 = head is half the avatar width
HEAD_VERTICAL = 0.5       # Where the head sits vertically. 0.0 = top edge, 0.5 = centered, 1.0 = bottom edge


def make_avatar(image_path, debug=False):
    img = cv2.imread(image_path, cv2.IMREAD_UNCHANGED)
    if img is None:
        print(f"Error: cannot read {image_path}", file=sys.stderr)
        sys.exit(1)

    if img.shape[2] == 4:
        gray = cv2.cvtColor(img[:, :, :3], cv2.COLOR_BGR2GRAY)
    else:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )
    profile_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_profileface.xml"
    )

    detect_args = dict(scaleFactor=SCALE_FACTOR, minNeighbors=MIN_NEIGHBORS, minSize=(MIN_FACE_SIZE, MIN_FACE_SIZE))
    faces = face_cascade.detectMultiScale(gray, **detect_args)

    if len(faces) == 0:
        faces = profile_cascade.detectMultiScale(gray, **detect_args)

    if len(faces) == 0:
        print("No face detected", file=sys.stderr)
        sys.exit(1)

    img_h, img_w = img.shape[:2]
    upper = [(x, y, w, h) for (x, y, w, h) in faces if y + h // 2 < img_h // 2]
    candidates = upper if len(upper) > 0 else faces

    areas = [w * h for (x, y, w, h) in candidates]
    x, y, w, h = candidates[np.argmax(areas)]

    cx = x + w // 2
    cy = y + h // 2
    radius = max(w, h) // 2

    print(f"Face detected: center=({cx},{cy}) radius={radius}")

    avatar_size = int(radius * 2 / HEAD_RATIO)

    crop_x = cx - avatar_size // 2
    crop_y = cy - int(avatar_size * HEAD_VERTICAL)

    # Clamp to image bounds
    crop_x = max(0, min(crop_x, img_w - avatar_size))
    crop_y = max(0, min(crop_y, img_h - avatar_size))

    # If avatar would exceed image dimensions, shrink to fit
    avatar_size = min(avatar_size, img_w, img_h)
    crop_x = max(0, min(crop_x, img_w - avatar_size))
    crop_y = max(0, min(crop_y, img_h - avatar_size))

    avatar = img[crop_y:crop_y + avatar_size, crop_x:crop_x + avatar_size]

    if debug:
        color = (0, 0, 255, 255) if avatar.shape[2] == 4 else (0, 0, 255)
        dcx = cx - crop_x
        dcy = cy - crop_y
        cv2.circle(avatar, (dcx, dcy), radius, color, 12)

    base, ext = os.path.splitext(image_path)
    avatar_path = f"{base}_avatar{ext}"
    cv2.imwrite(avatar_path, avatar)
    print(f"Avatar: {avatar_path}", file=sys.stderr)


if __name__ == "__main__":
    args = sys.argv[1:]
    positional = [a for a in args if not a.startswith("--")]

    if "--help" in args or "-h" in args or len(positional) == 0:
        print(__doc__)
        sys.exit(0)

    debug = "--debug" in args
    make_avatar(positional[0], debug)
