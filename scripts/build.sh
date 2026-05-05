#!/usr/bin/env bash
# Build entry point for Paperclip Native.
#
# Targets:
#   web        — Next.js static export (./out)
#   desktop    — Tauri 2 desktop bundle (./src-tauri/target/release/bundle)
#   android    — Tauri 2 Android APK / AAB (./src-tauri/gen/android/...)
#   ios        — Tauri 2 iOS app (./src-tauri/gen/apple/...; macOS host only)
#   all        — web → desktop → android (skips ios outside macOS)
#
# Usage:
#   ./scripts/build.sh [target] [--release|--debug]
#
# Defaults:
#   target  = all
#   profile = --release
#
# Environment variables honoured:
#   NODE_ENV        forced to "production" if unset (Next requires this)
#   ANDROID_HOME    must point at an Android SDK with NDK installed
#   NDK_HOME        must point at the Android NDK root
#   JAVA_HOME       JDK 17 or newer
#   APPLE_CERTIFICATE / APPLE_SIGNING_IDENTITY etc. for signed iOS / macOS

set -euo pipefail

TARGET="${1:-all}"
PROFILE="${2:---release}"

cd "$(dirname "$0")/.."

if [ -z "${NODE_ENV:-}" ] || [ "${NODE_ENV}" != "production" ]; then
  export NODE_ENV=production
fi

log() { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
warn() { printf '\n\033[1;33m! %s\033[0m\n' "$*" >&2; }
die() { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

require() {
  command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

ensure_deps() {
  require node
  require pnpm
  if [ ! -d node_modules ]; then
    log "Installing JS dependencies"
    pnpm install --frozen-lockfile
  fi
}

build_web() {
  log "Building Next.js static export"
  pnpm build
  test -f out/index.html || die "Next.js export did not produce out/index.html"
  log "Web bundle ready at $(pwd)/out"
}

build_desktop() {
  require cargo
  log "Building Tauri desktop bundle ($PROFILE)"
  if [ "$PROFILE" = "--debug" ]; then
    pnpm tauri build --debug
  else
    pnpm tauri build
  fi
  log "Desktop artifacts under $(pwd)/src-tauri/target/release/bundle (or target/debug for --debug)"
}

build_android() {
  require cargo
  if [ -z "${ANDROID_HOME:-}" ] && [ -z "${ANDROID_SDK_ROOT:-}" ]; then
    die "ANDROID_HOME (or ANDROID_SDK_ROOT) must be set for Android builds"
  fi
  if [ -z "${NDK_HOME:-}" ]; then
    warn "NDK_HOME not set; Tauri will look under \$ANDROID_HOME/ndk"
  fi
  log "Building Tauri Android bundle ($PROFILE)"
  if [ "$PROFILE" = "--debug" ]; then
    pnpm android:build --debug
  else
    pnpm android:build --apk --aab
  fi
  log "Android artifacts under $(pwd)/src-tauri/gen/android/app/build/outputs"
}

build_ios() {
  if [ "$(uname -s)" != "Darwin" ]; then
    warn "iOS builds require macOS; skipping"
    return 0
  fi
  log "Building Tauri iOS app ($PROFILE)"
  if [ "$PROFILE" = "--debug" ]; then
    pnpm ios:build --debug
  else
    pnpm ios:build
  fi
}

ensure_deps

case "$TARGET" in
  web)     build_web ;;
  desktop) build_web; build_desktop ;;
  android) build_web; build_android ;;
  ios)     build_web; build_ios ;;
  all)
    build_web
    build_desktop
    build_android
    build_ios
    ;;
  *) die "unknown target: $TARGET (expected web|desktop|android|ios|all)" ;;
esac

log "Done."
