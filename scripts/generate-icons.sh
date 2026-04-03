#!/bin/bash
# Generate favicon and PWA icons from src/assets/images/toad-icon.webp

set -e

SRC="src/assets/images/toad-icon.webp"
TMP="/tmp/toad-icon-512.png"

dwebp "$SRC" -o "$TMP"

sips -z 192 192 "$TMP" --out public/icon-192.png
sips -z 512 512 "$TMP" --out public/icon-512.png
sips -z 180 180 "$TMP" --out public/apple-touch-icon.png

python3 -c "
from PIL import Image
img = Image.open('$TMP')
img.save('public/favicon.ico', format='ICO', sizes=[(32, 32), (16, 16)])
"

rm "$TMP"
echo "Icons generated from $SRC"
