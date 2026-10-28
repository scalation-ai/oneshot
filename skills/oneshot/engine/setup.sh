#!/bin/bash
# One-time setup of the motion engine, on macOS or Linux. Needs Node.js 22 or newer (https://nodejs.org, LTS).
# Installs the rest inside this folder (node_modules: HyperFrames and GSAP, which render the films; Playwright, which
# reads and checks them; ffmpeg; a PNG reader), a headless Chrome in Playwright's cache and HyperFrames' own Chrome in
# its cache, then runs a self-test: a throwaway project and film, built, checked, scored, read and rendered.
# setup.sh --voice adds the narrator, for films with a voice: Kokoro, a small open text-to-speech model that runs on
# this computer (about 410 MB of packages in voice/, and a 320 MB model in a shared cache, downloaded once).
set -e
cd "$(dirname "$0")"; E="$(pwd)"
command -v node >/dev/null || { echo "Node.js is missing. Install the LTS from https://nodejs.org, then run this again."; exit 1; }
[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 22 ] || { echo "Node.js 22 or newer is needed (you have $(node -v)). Install the LTS from https://nodejs.org."; exit 1; }
# HyperFrames: no anonymous telemetry, no update check and no notice about its own agent skills (oneshot pins its version)
export HYPERFRAMES_NO_TELEMETRY=1 DO_NOT_TRACK=1 HYPERFRAMES_NO_UPDATE_CHECK=1 HYPERFRAMES_SKIP_SKILLS=1
VOICE=""; [ "$1" = --voice ] && VOICE=1

if [ -z "$VOICE" ] || [ ! -d "$E/node_modules/playwright" ]; then
  echo "1/3  Packages: HyperFrames and GSAP (render), Playwright (reads and checks), ffmpeg, a PNG reader"
  npm install --no-audit --no-fund --loglevel=error
  echo "2/3  The headless Chromes: Playwright's, and the one HyperFrames renders with"
  PLAYWRIGHT_SKIP_BROWSER_GC=1 npx playwright install chromium   # never prune browsers other projects use
  node "$E/node_modules/hyperframes/bin/hyperframes.mjs" browser ensure >/dev/null
  [ "$(uname)" = Darwin ] || echo "     On Linux, if Chromium will not start, run once: npx playwright install-deps chromium"
  cp "$E/package-lock.json" "$E/node_modules/.oneshot-setup"   # what was set up: film.sh asks again when the lock changes
  echo "3/3  Self-test: a throwaway project and film, built, checked, scored, read and rendered"
  T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
  bash "$E/film.sh" init "$T" >/dev/null
  OK="$(cd "$T" && bash "$E/film.sh" new selftest phone 15 --style glide --open problem --mood calm >/dev/null && bash "$E/film.sh" selftest check)"
  echo "$OK" | sed 's/^/     /'
  [ "$(printf '%s\n' "$OK" | head -1)" = "ready true" ] && printf '%s\n' "$OK" | grep -q '^pure:' || { echo "The self-test film did not load cleanly. Run this again, or see the message above."; exit 1; }
  [ -s "$T/films/selftest.wav" ] || { echo "The self-test score did not write its soundtrack."; exit 1; }
  node "$E/tools/test-moves.cjs" | sed 's/^/     /' || { echo "The motion library's self-test failed (above)."; exit 1; }
  RD="$(cd "$T" && STRICT=1 bash "$E/film.sh" selftest read)" || { printf '%s\n' "$RD" | sed 's/^/     /'; echo "The self-test film did not read cleanly (above)."; exit 1; }
  echo "     read: $(printf '%s\n' "$RD" | grep '^  carry' | sed 's/^  carry *//')"
  echo "     sound: $(cd "$T/films" && NODE_PATH="$E/lib" node selftest.score.cjs selftest.wav | sed 's/.*s  peak/peak/')"
  RN="$(cd "$T" && bash "$E/film.sh" selftest quick 2>&1)" || { printf '%s\n' "$RN" | tail -15 | sed 's/^/     /'; echo "HyperFrames could not render the self-test film (above)."; exit 1; }
  echo "     render: $(printf '%s\n' "$RN" | grep '^wrote' | sed 's/.* \([0-9.]* MB in [0-9]*s\)$/\1/')"
fi
if [ -n "$VOICE" ]; then
  echo "The voice 1/2  Packages: Kokoro and the runtime it needs (about 410 MB, in the engine's voice/ folder)"
  (cd "$E/voice" && npm install --no-audit --no-fund --loglevel=error)
  echo "The voice 2/2  The model (320 MB, downloaded once into a shared cache) and a test line"
  node "$E/tools/voice.cjs" --setup
  cp "$E/voice/package-lock.json" "$E/voice/node_modules/.oneshot-setup"
fi
echo
echo "Ready. From your project's folder:  bash \"$E/film.sh\" init   (it makes ./oneshot-output)"
echo "then start a film:                  bash \"$E/film.sh\" new <id> phone|desktop|app$([ -n "$VOICE" ] && echo ' [--voice]')"
