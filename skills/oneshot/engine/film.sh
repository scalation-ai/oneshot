#!/bin/bash
# film.sh: the one entry point. Run it from the user's folder: the film project is ./oneshot-output there
# (or the folder holding films.json, or MOTION_PROJECT, or an older ./motion-clip-output), and everything a film makes
# lands inside it.
#   init      film.sh init [folder]   set up the project in ./oneshot-output (or [folder]): brand.json,
#             story.md, rules.md, films.json, films/, reference/; renders/ fills as films are made
#   brand     film.sh brand [folder] [--write]   read the product's own fonts, colours, theme and name into brand.json
#   list      the project's films and their formats
#   new       film.sh new <id> phone|desktop|app [seconds] [bpm] [--mood m[,m]] [--voice [name]] [--format f[,f]]   start
#             a film from a template, registered (phone: a phone app; desktop: a web app in a browser; app: a native
#             desktop app on its computer's screen); it picks the edit style, the opening, the tempo and the key, unlike
#             the last film (--style, --open to choose); --voice: a narrator says each line as it appears; --format:
#             its cuts, of 9:16, 16:9, 1:1 and 4:5 (or all)
#   capture   film.sh capture <url or file> <name> [width] [height]   a reference screenshot into reference/<name>.png
#   ref       film.sh ref <video>   a reference film in numbers (cuts, shot lengths, bursts, stillness, energy) into
#             reference/<video name>/ref.html, before a script is written against its feel
#   studio    open studio.html: every film of the project, both formats, with sound, scrubbable
#   and per film, film.sh <film> <command> [format]:
#   build     inline the brand, fonts and library into films/<film>.html (every command does this first)
#   check     page errors, the engine's warnings, and whether render(t) is pure (frames out of order match)
#   read      the film in numbers before anyone watches it: what carries each change of scene (or nothing does), the
#             rhythm and the rests, speed, cross-fades, legibility, the feed's safe zone, framing; into
#             renders/<film>-<format>/read.html (STRICT=1: exit 1 when a leg fails)
#   play      open the film alone in Chrome (it loops; space pauses, arrow keys step a frame)
#   stills    full-size frames at T="0,2.5,5" (default: one a second) into renders/<film>-<format>/stills (cleared first)
#   sheet     contact sheets, one frame every 0.125 s, into renders/<film>-<format>/
#   poster    the poster frame (T= or the film's "poster" second) into renders/
#   voice     a film with a voice: speak its lines (films/voice/), time each where its words appear, say which run long
#   audio     write the soundtrack from its score (films/<film>.score.cjs), the voice first if the film has one
#   onsets    the soundtrack's strongest hits against the bar lines (does the sound land on the picture)
#   listen    the soundtrack in numbers: hits a second, low end, mud, dings, loudness against the series' other films
#             (REF=<clip> to compare with a reference)
#   preview   the film the user watches: 1x with motion blur (up to 8 captures on a moving frame, one on a hold), into
#             renders/. A preview without the shutter strobes on every fast move and is judged on that
#   quick     1x, one capture a frame, no motion blur: a fast look for yourself, never what the user is shown
#   final     2x supersampled with motion blur sized per frame (1 capture on a hold, up to 16 on the fastest move,
#             never across a cut); only once the preview is approved
#   gif       a looping GIF of the final (or the preview, rendered first if there is none), no sound (GIFW, GIFFPS)
# The format defaults to the film's first: phone (9x16), wide (16x9), square (1x1), 4x5, or all of the film's in turn.
set -e
ENGINE="$(cd "$(dirname "$0")" && pwd)"; CALLER="$PWD"
usage(){ sed -n '2,/^set -e/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'; }
OUT_DIR=oneshot-output                                 # the project's folder inside the user's folder
OLD_DIR=motion-clip-output                             # the same, from before the skill was renamed
[ -z "$1" ] && { usage; exit 1; }
command -v node >/dev/null || { echo "Node.js is missing. Install the LTS from https://nodejs.org, then run: bash \"$ENGINE/setup.sh\""; exit 1; }
[ -d "$ENGINE/node_modules/playwright" ] || { echo "The engine is not set up yet. Run once: bash \"$ENGINE/setup.sh\""; exit 1; }
export NODE_PATH="$ENGINE/lib${NODE_PATH:+:$NODE_PATH}"   # scores load the sound kit: require('sfx')
json(){ node -e "$1" "${@:2}"; }

if [ "$1" = init ]; then
  P="${2:-$PWD/$OUT_DIR}"; P="$(mkdir -p "$P" && cd "$P" && pwd)"; mkdir -p "$P/films" "$P/reference"
  for f in brand.json story.md rules.md; do [ -e "$P/$f" ] || cp "$ENGINE/templates/$f" "$P/$f"; done
  [ -e "$P/films.json" ] || echo '{}' > "$P/films.json"
  [ -e "$P/.gitignore" ] || cp "$ENGINE/templates/gitignore" "$P/.gitignore"
  cp "$ENGINE/templates/studio.html" "$P/studio.html"; node "$ENGINE/meta.cjs" "$P" >/dev/null
  echo "Project ready in $P"
  echo "Fill in brand.json (colours, fonts, name), story.md (the numbers) and rules.md (what films may say),"
  echo "then start a film: bash \"$ENGINE/film.sh\" new <id> phone|desktop|app"; exit 0
fi

# the project: MOTION_PROJECT, else this folder if it holds films.json, else ./oneshot-output (or an older
# ./motion-clip-output when only that one exists)
if [ -n "$MOTION_PROJECT" ]; then PROJ="$MOTION_PROJECT"
elif [ -f "$PWD/films.json" ]; then PROJ="$PWD"
elif [ ! -f "$PWD/$OUT_DIR/films.json" ] && [ -f "$PWD/$OLD_DIR/films.json" ]; then PROJ="$PWD/$OLD_DIR"
else PROJ="$PWD/$OUT_DIR"; fi
if [ "$1" = ref ]; then   # a reference film: into the project's reference/ if there is a project, else next to the caller
  [ -n "$2" ] || { echo "usage: film.sh ref <video>"; exit 1; }
  V="$(cd "$CALLER" && cd "$(dirname "$2")" 2>/dev/null && pwd)/$(basename "$2")"; [ -f "$V" ] || { echo "'$2' is not a file"; exit 1; }
  N="$(basename "${2%.*}")"; if [ -f "$PROJ/films.json" ]; then O="$PROJ/reference/$N"; else O="$CALLER/$N-ref"; fi
  node "$ENGINE/tools/ref.cjs" "$V" "$O"; exit $?
fi
[ -f "$PROJ/films.json" ] || { echo "No film project here. Set one up with: bash \"$ENGINE/film.sh\" init (it makes ./$OUT_DIR)"; exit 1; }
PROJ="$(cd "$PROJ" && pwd)"; export MOTION_PROJECT="$PROJ"   # so the commands film.sh runs itself find it too
mkdir -p "$PROJ/films"; cd "$PROJ/films"
F=$1; CMD=$2
if [ "$F" = list ]; then json 'for(const[k,v]of Object.entries(require(process.argv[1])))console.log(`  ${k.padEnd(10)} ${v.title.padEnd(30)} ${v.formats.join(" ")}`)' "$PROJ/films.json"; exit 0; fi
if [ "$F" = studio ]; then
  cp "$ENGINE/templates/studio.html" "$PROJ/studio.html"; node "$ENGINE/meta.cjs" "$PROJ" >/dev/null
  for f in *.src.html; do [ -e "$f" ] && node "$ENGINE/build.cjs" "$PROJ" "$(basename "$f" .src.html)" >/dev/null; done
  URL="file://$PROJ/studio.html"; if command -v open >/dev/null; then open "$URL"; else xdg-open "$URL" >/dev/null 2>&1 || echo "$URL"; fi; exit 0
fi
if [ "$F" = new ]; then node "$ENGINE/tools/new.cjs" "$PROJ" "${@:2}"; exit $?; fi
if [ "$F" = brand ]; then   # the product is the folder film.sh runs in (the one holding oneshot-output), or a given one
  SRC="$CALLER"; WR=""
  for a in "${@:2}"; do if [ "$a" = --write ]; then WR=--write; else SRC="$a"; fi; done
  SRC="$(cd "$CALLER" && cd "$SRC" 2>/dev/null && pwd)" || { echo "'$SRC' is not a folder"; exit 1; }
  case "$(basename "$SRC")" in "$OUT_DIR"|"$OLD_DIR") SRC="$(dirname "$SRC")";; esac
  node "$ENGINE/tools/brand.cjs" "$SRC" "$PROJ" $WR; exit 0
fi
if [ "$F" = capture ]; then
  [ -n "$2" ] && [ -n "$3" ] || { echo "usage: film.sh capture <url or file> <name> [width] [height]"; exit 1; }
  SRC="$2"
  if [[ "$SRC" != *://* ]]; then   # a file, relative to the folder film.sh was run from
    SRC="$(cd "$CALLER" && cd "$(dirname "$2")" 2>/dev/null && pwd)/$(basename "$2")"
    [ -f "$SRC" ] || { echo "'$2' is neither a file nor an address (https://...)"; exit 1; }
  fi
  mkdir -p "$PROJ/reference"; node "$ENGINE/tools/capture.cjs" "$SRC" "$PROJ/reference/$3.png" "${4:-1440}" "${5:-900}"; exit 0
fi
[ -z "$CMD" ] && { usage; exit 1; }
if [ "$3" = all ]; then   # every format of the film, in turn (an unknown film fails here: a loop over nothing would pass)
  FMTS="$(json 'const f=require(process.argv[1])[process.argv[2]];if(!f){console.error("Unknown film "+process.argv[2]);process.exit(1)}console.log(f.formats.join(" "))' "$PROJ/films.json" "$F")" || exit 1
  for x in $FMTS; do
    echo "== $F $x"; bash "$ENGINE/film.sh" "$F" "$CMD" "$x" || exit $?; done; exit 0
fi
META="$(node "$ENGINE/meta.cjs" "$PROJ" "$F" "$3")" || exit 1
eval "$META"
WORK="$OUTD/$ID-$FMT"; mkdir -p "$WORK"
node "$ENGINE/build.cjs" "$PROJ" "$ID" >/dev/null
T_="$ENGINE/tools"
soundtrack(){   # the voice's clips first, then the score
  if [ -n "$VOICE" ]; then node "$T_/voice.cjs" "$PROJ" "$ID" || exit $?; fi
  node "$SCORE" "$WAV" || exit $?; }
case $CMD in
  build) echo "built films/$HTML";;
  check) node "$T_/errs.cjs" "$HTML" "$Q" $W $H;;
  read)  node "$T_/read.cjs" "$HTML" $W $H "$Q" "$WORK" --fmt "$FMT" --title "$TITLE" ${STRICT:+--strict};;
  play)  URL="file://$PROJ/films/$HTML?${Q#&}"
         # a Chrome binary keeps the ?w=1 query; open(1) and xdg-open may drop it
         CH=""; for c in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" google-chrome google-chrome-stable chromium chromium-browser; do
           if [ -x "$c" ] || command -v "$c" >/dev/null 2>&1; then CH="$c"; break; fi; done
         if [ -n "$CH" ]; then ("$CH" "$URL" >/dev/null 2>&1 &)
         elif command -v open >/dev/null; then open "$URL"; else xdg-open "$URL" >/dev/null 2>&1; fi;;
  stills) T=${T:-$(json 'console.log(Array.from({length:Math.ceil(+process.argv[1])},(_,i)=>i).join(","))' "$DUR")}
          rm -rf "$WORK/stills"; node "$T_/still.cjs" "$WORK/stills" "$T" "$HTML" $W $H "$Q"; echo "stills in $WORK/stills";;
  poster) T=${T:-$POSTER}; T=${T%%,*}; rm -rf "$WORK/poster"
          node "$T_/still.cjs" "$WORK/poster" "$T" "$HTML" $W $H "$Q"
          cp "$WORK/poster/"*.png "$OUTD/$TITLE $FMT poster.png"; echo "$OUTD/$TITLE $FMT poster.png";;
  voice) node "$T_/voice.cjs" "$PROJ" "$ID";;
  audio) soundtrack;;
  onsets) [ -f "$WAV" ] || soundtrack
          if [ -n "$VOICE" ]; then   # the hits are the music's: measured without the voice, whose clips are listed after them
            NOVOICE=1 node "$SCORE" "$WORK/music.wav" >/dev/null; node "$T_/onsets.cjs" "$WORK/music.wav" "$BPM" 16 "$ID.voice.json"; rm -f "$WORK/music.wav"
          else node "$T_/onsets.cjs" "$WAV" "$BPM"; fi;;
  listen) [ -f "$WAV" ] || soundtrack; node "$T_/listen.cjs" "$WAV" ${REF:+"$REF"};;
  sheet) node "$T_/sheet.cjs" "$HTML" "$WORK/sheet" $DUR 0.125 $W $H "$Q";;
  quick|preview|final)
    # the final's shutter holds up to 16 captures a frame, the preview's 8; render.cjs takes only as many as each frame's
    # motion needs, and encode.cjs blends each frame's own (frames.json)
    case $CMD in final) DSF=2; K=16; SS=2;; preview) DSF=1; K=8; SS=1;; *) DSF=1; K=1; SS=1;; esac
    rm -rf "$WORK/raw"
    node "$T_/render.cjs" "$HTML" "$WORK/raw" $DSF $K 4 0 $FR $W $H "$Q" > "$WORK/render.log" 2>&1 || { echo "The renderer stopped: see $WORK/render.log"; tail -3 "$WORK/render.log"; exit 1; }
    tail -1 "$WORK/render.log"
    [ -f "$WAV" ] || soundtrack
    if [ $CMD = final ]; then TAG=""; elif [ $CMD = preview ]; then TAG=" PREVIEW"; else TAG=" QUICK"; fi
    node "$T_/encode.cjs" "$WORK/raw" $K $SS "$WAV" "$OUTD/$TITLE $FMT$TAG.mp4"
    [ -n "$KEEP" ] || rm -rf "$WORK/raw";;
  gif) SRC="$OUTD/$TITLE $FMT.mp4"; [ -f "$SRC" ] || SRC="$OUTD/$TITLE $FMT PREVIEW.mp4"
       [ -f "$SRC" ] || { bash "$ENGINE/film.sh" "$F" preview "$FMT" || exit $?; }
       node "$T_/gif.cjs" "$SRC" "$OUTD/$TITLE $FMT.gif" $W $H "$GIFW" "$GIFFPS";;
  *) usage; exit 1;;
esac
