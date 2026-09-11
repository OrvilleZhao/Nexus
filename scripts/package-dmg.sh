#!/usr/bin/env bash
# package-dmg.sh — Build .app bundle + .dmg from Tauri Rust binary
# Usage: BINARY_DIR=./src-tauri/target/release bash scripts/package-dmg.sh VERSION ARCH
set -euo pipefail

VERSION="${1:-0.0.0}"
ARCH="${2:-arm64}"
BINARY_DIR="${BINARY_DIR:-./src-tauri/target/release}"
APP_NAME="Nexus Desktop"
BUNDLE_ID="ai.nexus.desktop"
DIST_DIR="./dist/macos"
STAGE_DIR="$DIST_DIR/stage"
APP_BUNDLE="$STAGE_DIR/$APP_NAME.app"

echo "=== Packaging $APP_NAME v$VERSION ($ARCH) ==="

# Verify inputs (fail fast with clear message)
if [ ! -f "$BINARY_DIR/nexus-desktop" ]; then
  echo "ERROR: binary not found at $BINARY_DIR/nexus-desktop" >&2
  exit 1
fi
if [ ! -d "./dist" ]; then
  echo "ERROR: frontend dist/ not found — run 'node build.mjs' first" >&2
  exit 1
fi

# Clean
rm -rf "$DIST_DIR"
mkdir -p "$APP_BUNDLE/Contents/MacOS"
mkdir -p "$APP_BUNDLE/Contents/Resources"

# Copy binary
cp "$BINARY_DIR/nexus-desktop" "$APP_BUNDLE/Contents/MacOS/$APP_NAME"
chmod +x "$APP_BUNDLE/Contents/MacOS/$APP_NAME"

# Copy frontend assets (embedded in binary via custom-protocol; kept for reference)
cp -R dist "$APP_BUNDLE/Contents/Resources/web"

# Copy app icon (Info.plist references AppIcon)
if [ -f src-tauri/icons/icon.icns ]; then
  cp src-tauri/icons/icon.icns "$APP_BUNDLE/Contents/Resources/AppIcon.icns"
else
  echo "WARN: icon.icns missing — app will use default icon"
fi

# Info.plist
cat > "$APP_BUNDLE/Contents/Info.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>$APP_NAME</string>
  <key>CFBundleDisplayName</key>
  <string>$APP_NAME</string>
  <key>CFBundleIdentifier</key>
  <string>$BUNDLE_ID</string>
  <key>CFBundleVersion</key>
  <string>$VERSION</string>
  <key>CFBundleShortVersionString</key>
  <string>$VERSION</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleExecutable</key>
  <string>$APP_NAME</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>LSMinimumSystemVersion</key>
  <string>11.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSSupportsAutomaticGraphicsSwitching</key>
  <true/>
</dict>
</plist>
PLIST

# PkgInfo
echo -n "APPL????" > "$APP_BUNDLE/Contents/PkgInfo"

# Symlink for Applications
ln -s /Applications "$STAGE_DIR/Applications"

# Ad-hoc code sign (required to avoid "damaged app" Gatekeeper errors;
# a real Developer ID signature + notarization replaces this when secrets exist)
if command -v codesign >/dev/null 2>&1; then
  echo "=== Ad-hoc code signing ==="
  codesign --force --sign - "$APP_BUNDLE"
  codesign --verify "$APP_BUNDLE"
else
  echo "WARN: codesign not available — app will trigger Gatekeeper 'damaged' errors"
fi

# Verify
echo "=== Verifying bundle ==="
test -f "$APP_BUNDLE/Contents/Info.plist"
test -f "$APP_BUNDLE/Contents/PkgInfo"
test -x "$APP_BUNDLE/Contents/MacOS/$APP_NAME"
test -L "$STAGE_DIR/Applications"
plutil -lint "$APP_BUNDLE/Contents/Info.plist"

# Create DMG
echo "=== Creating DMG ==="
hdiutil create \
  -volname "$APP_NAME" \
  -srcfolder "$STAGE_DIR" \
  -ov \
  -format UDZO \
  "$DIST_DIR/${APP_NAME}-${VERSION}-${ARCH}.dmg"

# Verify DMG integrity
echo "=== Verifying DMG ==="
hdiutil verify "$DIST_DIR/${APP_NAME}-${VERSION}-${ARCH}.dmg"

echo "=== Done ==="
ls -la "$DIST_DIR"/*.dmg
