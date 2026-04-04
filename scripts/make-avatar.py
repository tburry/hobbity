#!/usr/bin/env python3
"""Detect head in an image and crop a square avatar.

Usage: make-avatar.py [--model MODEL] [--debug] <image>

Models:
  haar       OpenCV Haar cascades (default). Best recall on stylized art.
  yunet      OpenCV DNN-based YuNet. Good on photos, weaker on illustrations.
  retinaface InsightFace RetinaFace. State-of-the-art accuracy, heaviest model.

Produces a square avatar as <name>_avatar.<ext>
  - Head centered horizontally, vertical center at 0.5 from top
  - Head circle is 0.4 of the avatar dimensions

With --debug, writes a full-size (uncropped) copy of the image with all
models' detections overlaid as colored circles and crop squares.
Output: <name>_debug.<ext>
"""

import sys
import os
import cv2

# Detection — shared

# Minimum face size in pixels. Detections smaller than this are discarded.
# Raise for large images to skip noise; lower if faces are small in the frame.
MIN_FACE_SIZE = 100

# Detection — Haar

# Image scale reduction per scan pass. Range: 1.01–1.3.
# Lower values scan more scales, catching more faces but running much slower.
# Higher values are faster but may skip faces between scale steps.
HAAR_SCALE_FACTOR = 1.01

# How many overlapping detection rectangles are needed to confirm a face.
# Range: 1–10+. Lower values are more sensitive but produce more false positives.
# Higher values require more agreement, reducing noise but missing weaker detections.
HAAR_MIN_NEIGHBORS = 6

# Minimum weight (neighbor count) to show a Haar detection in debug mode.
# Detections below this are noise. Typical real faces score 5–20+.
HAAR_DEBUG_MIN_WEIGHT = 2.5

# Detection — YuNet

# Minimum confidence score to keep a detection. Range: 0.0–1.0.
# Lower values return more candidates (including weak/false ones).
# Higher values are stricter, only keeping high-confidence faces.
YUNET_SCORE_THRESHOLD = 0.4

# Non-maximum suppression overlap threshold. Range: 0.0–1.0.
# Controls how much two detections can overlap before the weaker one is dropped.
# Lower values are stricter (more aggressive dedup); higher values keep more overlapping boxes.
YUNET_NMS_THRESHOLD = 0.3

# Maximum number of candidate detections to consider before NMS filtering.
# Only relevant for images with many potential faces. Safe to leave high.
YUNET_TOP_K = 5000

# Minimum confidence to show a YuNet detection in debug mode. Range: 0.0–1.0.
# Detections below this are noise.
YUNET_DEBUG_MIN_CONF = 0.5

# Detection — RetinaFace

# Minimum detection confidence. Range: 0.0–1.0.
# Lower values return more candidates (including weak/false ones).
# Higher values only keep high-confidence faces.
RETINAFACE_DET_THRESH = 0.2

# Minimum confidence to show a RetinaFace detection in debug mode. Range: 0.0–1.0.
# Detections below this are noise.
RETINAFACE_DEBUG_MIN_CONF = 0.3

# Crop

# How much of the avatar the head fills. Range: 0.0–1.0.
# 0.5 = head is half the avatar width. Lower values zoom out more.
HEAD_RATIO = 0.4

# Where the head center sits vertically in the crop. Range: 0.0–1.0.
# 0.0 = head at the very top edge, 0.5 = centered, 1.0 = bottom edge.
HEAD_VERTICAL = 0.5

# Maximum avatar output size in pixels. Avatars larger than this are
# downscaled after cropping. Set to 0 to disable.
AVATAR_MAX_SIZE = 512

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(SCRIPT_DIR, "models")

# BGR colors for debug overlay
DEBUG_COLORS = {
    "haar": (0, 0, 255),         # red
    "yunet": (0, 255, 0),        # green
    "retinaface": (255, 0, 255), # magenta
}


def detect_haar(img, gray):
    """OpenCV Haar cascade detection.

    Returns list of (cx, cy, radius, confidence) tuples.
    Haar doesn't provide confidence, so neighbor count is used as a proxy.
    """
    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )
    profile_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_profileface.xml"
    )

    detect_args = dict(
        scaleFactor=HAAR_SCALE_FACTOR,
        minNeighbors=HAAR_MIN_NEIGHBORS,
        minSize=(MIN_FACE_SIZE, MIN_FACE_SIZE),
    )
    rects, _, weights = face_cascade.detectMultiScale3(
        gray, outputRejectLevels=True, **detect_args
    )

    if len(rects) == 0:
        rects, _, weights = profile_cascade.detectMultiScale3(
            gray, outputRejectLevels=True, **detect_args
        )

    if len(rects) == 0:
        return []

    results = []
    for (x, y, w, h), weight in zip(rects, weights):
        cx = x + w // 2
        cy = y + h // 2
        r = max(w, h) // 2
        results.append((cx, cy, r, float(weight)))

    return results


def detect_yunet(img, gray):
    """OpenCV YuNet DNN detection.

    Returns list of (cx, cy, radius, confidence) tuples.
    """
    model_path = os.path.join(MODELS_DIR, "face_detection_yunet_2023mar.onnx")
    if not os.path.exists(model_path):
        return []

    h, w = img.shape[:2]
    det = cv2.FaceDetectorYN.create(model_path, "", (w, h), YUNET_SCORE_THRESHOLD, YUNET_NMS_THRESHOLD, YUNET_TOP_K)
    _, faces = det.detect(img)

    if faces is None or len(faces) == 0:
        return []

    results = []
    for f in faces:
        x, y, fw, fh = int(f[0]), int(f[1]), int(f[2]), int(f[3])
        conf = float(f[14])
        results.append((x + fw // 2, y + fh // 2, max(fw, fh) // 2, conf))

    return results


def detect_retinaface(img, gray):
    """InsightFace RetinaFace detection.

    Returns list of (cx, cy, radius, confidence) tuples.
    """
    try:
        from insightface.app import FaceAnalysis
    except ImportError:
        return []

    app = FaceAnalysis(allowed_modules=["detection"], providers=["CPUExecutionProvider"])
    app.prepare(ctx_id=-1, det_thresh=RETINAFACE_DET_THRESH, det_size=(640, 640))

    # RetinaFace expects 3-channel BGR
    det_img = img[:, :, :3] if img.shape[2] == 4 else img
    faces = app.get(det_img)

    if not faces:
        return []

    results = []
    for f in faces:
        x1, y1, x2, y2 = [int(v) for v in f.bbox]
        w = x2 - x1
        h = y2 - y1
        conf = float(f.det_score)
        results.append((x1 + w // 2, y1 + h // 2, max(w, h) // 2, conf))

    return results


DETECTORS = {
    "haar": detect_haar,
    "yunet": detect_yunet,
    "retinaface": detect_retinaface,
}


def pick_best(faces, img_h):
    """Pick the best face from a list: prefer upper-half, then largest radius."""
    upper = [(cx, cy, r, c) for cx, cy, r, c in faces if cy < img_h // 2]
    candidates = upper if upper else faces
    return max(candidates, key=lambda f: f[2])


def compute_crop(cx, cy, radius, img_w, img_h):
    """Compute the crop square for a given face detection."""
    avatar_size = int(radius * 2 / HEAD_RATIO)
    crop_x = cx - avatar_size // 2
    crop_y = cy - int(avatar_size * HEAD_VERTICAL)
    crop_x = max(0, min(crop_x, img_w - avatar_size))
    crop_y = max(0, min(crop_y, img_h - avatar_size))
    avatar_size = min(avatar_size, img_w, img_h)
    crop_x = max(0, min(crop_x, img_w - avatar_size))
    crop_y = max(0, min(crop_y, img_h - avatar_size))
    return crop_x, crop_y, avatar_size


def make_debug(image_path, img, gray):
    """Write uncropped image with all models' detections overlaid."""
    debug_img = img.copy()
    has_alpha = debug_img.shape[2] == 4

    # Detectors need 3-channel BGR
    if has_alpha:
        img_bgr = img[:, :, :3].copy()
    else:
        img_bgr = img

    img_h, img_w = img.shape[:2]
    label_scale = max(0.5, min(img_h, img_w) / 800)
    label_thickness = max(1, int(label_scale * 2))
    shadow_offset = max(1, int(label_scale))
    line_height = int(25 * label_scale)

    debug_min_conf = {
        "haar": HAAR_DEBUG_MIN_WEIGHT,
        "yunet": YUNET_DEBUG_MIN_CONF,
        "retinaface": RETINAFACE_DEBUG_MIN_CONF,
    }

    for i, (name, detect_fn) in enumerate(DETECTORS.items()):
        faces = detect_fn(img_bgr, gray)
        min_conf = debug_min_conf.get(name, 0)
        color = DEBUG_COLORS[name]
        if has_alpha:
            color = (*color, 255)

        if faces:
            for cx, cy, radius, conf in faces:
                thickness = 2 if conf >= min_conf else 1
                cv2.circle(debug_img, (cx, cy), radius, color, thickness)

            # Draw crop square for the best face
            best_cx, best_cy, best_r, _ = pick_best(faces, img_h)
            crop_x, crop_y, crop_size = compute_crop(best_cx, best_cy, best_r, img_w, img_h)
            cv2.rectangle(
                debug_img,
                (crop_x, crop_y),
                (crop_x + crop_size, crop_y + crop_size),
                color, 2,
            )
            label = f"{name}: {len(faces)}"
        else:
            label = f"{name}: MISS"

        label_y = img_h - 20 - (len(DETECTORS) - 1 - i) * line_height
        shadow_color = (0, 0, 0, 255) if has_alpha else (0, 0, 0)
        cv2.putText(
            debug_img, label, (20 + shadow_offset, label_y + shadow_offset),
            cv2.FONT_HERSHEY_SIMPLEX, label_scale, shadow_color, label_thickness,
        )
        cv2.putText(
            debug_img, label, (20, label_y),
            cv2.FONT_HERSHEY_SIMPLEX, label_scale, color, label_thickness,
        )

    base, ext = os.path.splitext(image_path)
    debug_path = f"{base}_debug{ext}"
    cv2.imwrite(debug_path, debug_img)
    print(f"Debug: {debug_path}", file=sys.stderr)


def make_avatar(image_path, model="retinaface", debug=False):
    img = cv2.imread(image_path, cv2.IMREAD_UNCHANGED)
    if img is None:
        print(f"Error: cannot read {image_path}", file=sys.stderr)
        sys.exit(1)

    if img.shape[2] == 4:
        gray = cv2.cvtColor(img[:, :, :3], cv2.COLOR_BGR2GRAY)
    else:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    if debug:
        make_debug(image_path, img, gray)
        return

    detect_fn = DETECTORS[model]
    faces = detect_fn(img, gray)

    if not faces and model != "haar":
        print(f"No face detected ({model}), falling back to haar", file=sys.stderr)
        faces = detect_haar(img, gray)

    if not faces:
        print(f"No face detected", file=sys.stderr)
        sys.exit(1)

    img_h, img_w = img.shape[:2]
    cx, cy, radius, _ = pick_best(faces, img_h)
    print(f"Face detected: center=({cx},{cy}) radius={radius}")

    crop_x, crop_y, avatar_size = compute_crop(cx, cy, radius, img_w, img_h)
    avatar = img[crop_y : crop_y + avatar_size, crop_x : crop_x + avatar_size]

    if AVATAR_MAX_SIZE and avatar_size > AVATAR_MAX_SIZE:
        avatar = cv2.resize(avatar, (AVATAR_MAX_SIZE, AVATAR_MAX_SIZE), interpolation=cv2.INTER_AREA)

    base, ext = os.path.splitext(image_path)
    avatar_path = f"{base}_avatar{ext}"
    cv2.imwrite(avatar_path, avatar)
    print(f"Avatar: {avatar_path}", file=sys.stderr)


if __name__ == "__main__":
    args = sys.argv[1:]

    if "--help" in args or "-h" in args or len(args) == 0:
        print(__doc__)
        sys.exit(0)

    debug = "--debug" in args
    model = "retinaface"

    # Parse --model
    filtered = []
    skip_next = False
    for i, a in enumerate(args):
        if skip_next:
            skip_next = False
            continue
        if a == "--model" and i + 1 < len(args):
            model = args[i + 1]
            skip_next = True
        elif a.startswith("--model="):
            model = a.split("=", 1)[1]
        elif a.startswith("--"):
            continue
        else:
            filtered.append(a)

    if model not in DETECTORS:
        print(f"Error: unknown model '{model}'. Choose from: {', '.join(DETECTORS)}", file=sys.stderr)
        sys.exit(1)

    if len(filtered) == 0:
        print(__doc__)
        sys.exit(0)

    make_avatar(filtered[0], model=model, debug=debug)
