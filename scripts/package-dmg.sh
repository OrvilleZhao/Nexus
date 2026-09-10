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

echo "=== Packaging $APP_NAME v$VERSION ($ARCH) ==="

# Clean
rm -rf "$DIST_DIR"
mkdir -p "$STAGE_DIR/$APP_NAME.app/Contents/MacOS"
mkdir -p "$STAGE_DIR/$APP_NAME.app/Contents/Resources"

# Copy binary
cp "$BINARY_DIR/nexus-desktop" "$STAGE_DIR/$APP_NAME.app/Contents/MacOS/$APP_NAME"
chmod +x "$STAGE_DIR/$APP_NAME.app/Contents/MacOS/$APP_NAME"

# Copy frontend assets
cp -R src/dist "$STAGE_DIR/$APP_NAME.app/Contents/Resources/web"

# Info.plist
cat > "$STAGE_DIR/$APP_NAME.app/Contents/Info.plist" << PLIST
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
echo -n "APPL????" > "$STAGE_DIR/$APP_NAME.app/Contents/PkgInfo"

# Symlink for Applications
ln -s /Applications "$STAGE_DIR/Applications"

# Verify
echo "=== Verifying bundle ==="
test -f "$STAGE_DIR/$APP_NAME.app/Contents/Info.plist"
test -f "$STAGE_DIR/$APP_NAME.app/Contents/PkgInfo"
test -x "$STAGE_DIR/$APP_NAME.app/Contents/MacOS/$APP_NAME"
test -L "$STAGE_DIR/Applications"
plutil -lint "$STAGE_DIR/$APP_NAME.app/Contents/Info.plist"

# Create DMG
echo "=== Creating DMG ==="
hdiutil create \
  -volname "$APP_NAME" \
  -srcfolder "$STAGE_DIR" \
  -ov \
  -format UDZO \
  "$DIST_DIR/${APP_NAME}-${VERSION}-${ARCH}.dmg"

echo "=== Done ==="
ls -la "$DIST_DIR"/*.dmg
