#!/bin/bash
# Double-click this file to finish installing Solace.
# It copies the app to your Applications folder (if needed) and clears the
# "downloaded from the internet" flag that makes macOS block it.

set -e
echo "Setting up Solace..."
echo

APP="/Applications/Solace.app"

# If it's not in Applications yet, look for it on a mounted Solace disk image.
if [ ! -d "$APP" ]; then
  found=""
  for vol in /Volumes/Solace*; do
    if [ -d "$vol/Solace.app" ]; then
      echo "Copying Solace to your Applications folder..."
      rm -rf "$APP"
      cp -R "$vol/Solace.app" /Applications/
      found="yes"
      break
    fi
  done
  if [ -z "$found" ] && [ ! -d "$APP" ]; then
    echo "Couldn't find Solace."
    echo "Open Solace.dmg first and drag Solace onto the Applications folder,"
    echo "then run this again."
    echo
    read -n 1 -s -r -p "Press any key to close."
    exit 1
  fi
fi

echo "Clearing the download flag..."
xattr -cr "$APP" 2>/dev/null || true

echo "Opening Solace..."
open "$APP"

echo
echo "Done. Solace should be opening now, and it will open normally from now on."
echo
read -n 1 -s -r -p "Press any key to close."
