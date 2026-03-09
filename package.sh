#!/usr/bin/env bash
# Package the extension into a .zip for Chrome Web Store submission.
# Excludes development files, notes, and version control.

set -euo pipefail

NAME="video-playback-speed-controller"
VERSION=$(grep '"version"' manifest.json | head -1 | sed 's/.*: *"\(.*\)".*/\1/')
OUTFILE="${NAME}-v${VERSION}.zip"

rm -f "$OUTFILE"

zip -r "$OUTFILE" . \
  -x "notes/*" \
  -x ".git/*" \
  -x ".claude/*" \
  -x "package.sh" \
  -x "*.zip" \
  -x "*.crx" \
  -x "*.pem" \
  -x ".gitignore" \
  -x ".DS_Store"

echo "Packaged: $OUTFILE"
