#!/bin/bash
# Create a local self-signed code-signing certificate for Solace and stash it in
# its own keychain at ~/.solace-signing/. Run once per build machine.
#
# This certificate is NOT trusted by Apple — it only gives our builds a stable,
# unique cdhash so Gatekeeper stops matching them against Apple's revoked
# stock-Electron hash. See scripts/sign-adhoc.sh for the why.
set -euo pipefail

DIR="$HOME/.solace-signing"
KC="$DIR/solace-sign.keychain-db"
KCPASS="${SOLACE_SIGN_KEYCHAIN_PASS:-solace}"
CN="Solace Notes (self-signed)"

mkdir -p "$DIR"
cd "$DIR"

cat > sign.cnf <<'EOF'
[req]
distinguished_name = dn
x509_extensions = v3
prompt = no
[dn]
CN = Solace Notes (self-signed)
[v3]
basicConstraints = critical,CA:false
keyUsage = critical,digitalSignature
extendedKeyUsage = critical,codeSigning
EOF

openssl req -x509 -newkey rsa:2048 -keyout sign.key -out sign.crt -days 3650 -nodes -config sign.cnf
openssl pkcs12 -export -out sign.p12 -inkey sign.key -in sign.crt \
  -passout pass:"$KCPASS" -name "$CN" \
  -legacy -macalg sha1 -keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES

security delete-keychain "$KC" 2>/dev/null || true
security create-keychain -p "$KCPASS" "$KC"
security unlock-keychain -p "$KCPASS" "$KC"
security import sign.p12 -k "$KC" -P "$KCPASS" -A
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KCPASS" "$KC" >/dev/null

rm -f sign.p12 sign.cnf
echo "created $KC with identity: $CN"
