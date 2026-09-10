#!/bin/bash
# Sign Solace.app with the local self-signed certificate.
#
# WHY: a naked ad-hoc signature ("codesign --sign -") reuses the stock Electron
# binary's cdhash, which Apple has revoked on the Gatekeeper blocklist — that
# produces the un-bypassable "contains malware" wall on other Macs. Signing with
# our own certificate gives the binary a unique cdhash, so Gatekeeper falls back
# to the ordinary "unidentified developer" prompt (which Open Anyway / xattr can
# clear). It is NOT notarization — that still needs a paid Apple account — but it
# turns an un-openable app into an openable one.
#
# Usage: scripts/sign-adhoc.sh path/to/Solace.app
set -euo pipefail

APP="${1:?usage: sign-adhoc.sh <Solace.app>}"
KC="${SOLACE_SIGN_KEYCHAIN:-$HOME/.solace-signing/solace-sign.keychain-db}"
ID="${SOLACE_SIGN_IDENTITY:-Solace Notes (self-signed)}"
KCPASS="${SOLACE_SIGN_KEYCHAIN_PASS:-solace}"

if [ ! -f "$KC" ]; then
  echo "signing keychain not found at $KC — run scripts/make-signing-cert.sh first" >&2
  exit 1
fi

security unlock-keychain -p "$KCPASS" "$KC"
security list-keychains -d user -s "$KC" $(security list-keychains -d user | sed 's/"//g') >/dev/null

sign() { codesign --force --timestamp=none --sign "$ID" --keychain "$KC" "$@"; }

FW="$APP/Contents/Frameworks"

# 1. nested dylibs
find "$FW/Electron Framework.framework" -name "*.dylib" -print0 | while IFS= read -r -d '' f; do
  sign "$f"
done

# 2. crashpad helper
sign "$FW/Electron Framework.framework/Versions/A/Helpers/chrome_crashpad_handler"

# 3. frameworks
sign "$FW/Electron Framework.framework"
for fw in Mantle ReactiveObjC Squirrel; do
  sign "$FW/$fw.framework"
done

# 4. helper apps (inner executables first, then the .app)
for h in "Solace Helper" "Solace Helper (GPU)" "Solace Helper (Plugin)" "Solace Helper (Renderer)"; do
  [ -d "$FW/$h.app" ] || continue
  sign "$FW/$h.app/Contents/MacOS/$h"
  sign "$FW/$h.app"
done

# 5. the app itself
sign "$APP"

echo
echo "verify:"
codesign --verify --deep --strict --verbose=2 "$APP"
codesign -dvv "$APP" 2>&1 | grep -E "Authority|CDHash|Signature|Identifier"
