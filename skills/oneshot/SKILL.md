---
name: oneshot
description: Make short product films from a product's real screens, rendered from code, where every scene grows out of the last instead of replacing it. 30 seconds by default (15 for one feature, 45 or 60 for a tour), in 9:16 for the phone feed and 16:9, as a series that shares one brand, one set of numbers and one set of rules. It starts from three concepts that differ in their central idea, rebuilds every screen natively and matched to the pixel (never a screenshot, never an AI-made interface), carries each scene into the next with a shared element, a camera move or a declared cut, scores it on the picture's own timeline (one groove that stops before each reveal, and a few recorded element sounds on top; a narrator only if asked), reads the film in numbers (carry, rhythm, legibility, safe zone) before anyone watches it, and passes two independent reviews before the user sees it. The final has real motion blur. Use when asked for a product video, feature video, launch clip, teaser, app or SaaS demo film or social video about a product, to match the feel of a reference clip, or to find out why a product video reads like a slideshow. Not for talking-head footage, captions, or explainers about a topic.
---

# Product films that never cut to the next slide

A product film shows **the product doing one job, one number that moves, one line in plain words.**
Nothing else earns screen time. And it is **one film, not a stack of scenes**: at every change of scene
something on screen survives and moves into the next one (the row the film lifted opens into its detail,
the detail becomes the card whose number moved, the full stop flies into the wordmark). Scenes that replace
each other read as a slideshow however good each one is.

Each film is one HTML page whose `render(t)` sets every element from the time alone, so any frame renders on
its own. A headless Chrome captures 60 frames a second, a sound kit writes the score on the same timeline (a
synthesized groove, and recorded element sounds placed on their frames), ffmpeg joins them. Everything runs on Node. Paths below are relative to this skill's folder; run
the engine as `bash "<this skill>/engine/film.sh" ...` from the user's current folder. Everything the skill
makes goes in one folder there, `oneshot-output/`; nothing else in the user's folder changes.

## Options

The user may set these in words or as flags (`/oneshot --duration 15 --draft`). For anything not given,
decide from the product and its audience, and state the choice in the concepts you show.

- `--duration <seconds>`: 30 by default. 15 for one feature and one number, 30 for one feature told as a
  short story (or two or three small ones), 45 or 60 for a tour of the product or the company.
- `--sound <mood>`: drive, calm, upbeat, bold, playful or minimal. Without it, decide which moods fit the
  product (a launch film drives, a meditation app is calm, a game playful, a finance tool calm or minimal).
- `--voice [name]`: off by default. A narrator reads each line aloud as it appears, in English (the voices:
  `references/sound.md`). The first time it needs `bash engine/setup.sh --voice`: tell the user it downloads
  about 730 MB once, then run it.
- `--format <list>`: the cuts, of 9:16, 16:9, 1:1 and 4:5 (or `all`); the first is the main one. By default
  9:16 and 16:9 for a phone film, 16:9 for the others. Render, read and review every format the film has.
- `--ref <video>`: a clip whose feel the film should have. Read it first (section 3).
- `--draft`: a quick first cut: one concept instead of three, the preview only, one reviewer instead of two
  (`references/review.md`). The full concept round and review run before the film the user will publish.

## 1. Before the first film

1. **Set up once per machine,** and again after the skill is updated (`film.sh` says when):
   `bash engine/setup.sh` (Playwright, ffmpeg and a PNG reader inside `engine/`, a headless Chrome in
   Playwright's shared cache, then a self-test). It needs Node 18 or newer. If Node is missing, say so and
   offer to install it with the user's approval; never install silently.
2. **Set up the project:** `film.sh init` makes `oneshot-output/` in the user's folder (a project made under
   the skill's old name, `motion-clip-output/`, is still found). It starts with three files every film reads:
   - `brand.json`: accent colour, greys, the stage (dark or light), two fonts, the wordmark. Fill it with
     `film.sh brand`: it reads the product's own code (CSS variables, Tailwind, `next/font`, Google Fonts,
     font files, Xcode and Android colours) and prints where each value came from. Never keep the engine's
     fonts or colours when the product has its own. Confirm every line marked "guess" with the user.
   - `story.md`: every number and name that may appear on screen. One fictional user or customer, one set
     of figures, shared by every film so no two films contradict each other.
   - `rules.md`: each feature's promise line word for word, the call to action per film, the claims allowed
     and never allowed, the words to use and avoid.
   **Never invent a number, a promise or a claim.** If a film needs one that is not in these files, ask, add
   it to the file, then use it.
3. **Get the real screens:** a screenshot or recording of each screen a film will show. It is the reference
   the rebuild is matched against and never appears in the film. A web page or an HTML prototype:
   `film.sh capture <address or file> <name>`. A native app: ask the user for screenshots.

## 2. What goes in a film, and what never does

- **The result, not the process.** Show what the product makes or changes for its user, filling the
  frame, never the machinery that gets there: terminals, logs, settings, option tables, report pages and
  transcripts are not screen material. A frame with more than about a dozen small readable words is a
  document, and a viewer reads none of it. A product whose job is an output (a generator, an editor, an
  agent, a skill) shows its outputs, finished and in full colour, each in its own look; its input is one
  line at most, in a pill, typed close. (The first film oneshot made of itself was a dark terminal with
  a script table and a report page. It read as a screen recording. The fourth was a timeline with a
  playhead rendering a strip of thumbnails: machinery again, 40% of the film on a dark screen with
  nothing bigger than a stamp, and it showed one output where the reference film showed three.)
- **Most of the running time is the result, full frame.** In the reference launch films the outputs
  fill the frame for about three quarters of the film; the input, the hand-offs and the end card share
  the rest. Count the seconds in the script before building.
- **Small things on a big ground, and a camera that goes to them.** Most of a good frame is ground (60 to
  70% in the reference films). A thing reads big because the camera goes close to it, not because it was
  drawn big: several things at once stay small, so the camera visits each one, and goes wide only to show
  that there are many. A page shown as a thumbnail never reads its motion: show it full frame, or one
  component of it, live.
- **The product surface, rebuilt natively,** matched to its capture, loaded with `story.md`'s numbers,
  inside the product's real chrome (its header, sidebar, cards), never as a floating pitch graphic. Rebuilt,
  so cells flip, numbers roll, rows lift and fly, and it stays sharp at any zoom. Show the two or three
  elements that carry the point, at a readable size.
- **The frame follows the user.** A phone app: a 9:16 phone film, the screen rebuilt at phone width (its
  16:9 cut comes free). A web app: a 16:9 film in a browser card with its real address (`desktop`). A native
  desktop app: its computer's screen, the camera framing each beat close enough to read (`app`). Any film can
  also be cut as a feed post, 1:1 or 4:5.
- **Always:** the feature's name as a small kicker top left, the wordmark top right, the end card.
- **Never:** timecodes, progress bars, HUD labels ("DEMO", "SAMPLE DATA"), stock photos, AI images,
  photographed devices, a screenshot of any kind, abstract shapes standing in for a feature, any AI-generated
  interface, chat window or logo, particles or confetti.
- **Only when the concept asks for them:** a caption bar under the voice, handwritten notes with arrows,
  keycaps for each key pressed. Each one adds words and boxes to a frame that should have fewer; used on
  every beat, they turn a film into a tutorial.

## 3. Three concepts before any script (the hard rule)

A concept is one sentence about the **picture**, not the product: the single idea the film is made of.
Write **three that differ in that idea**, not three stories told with the same screens:

- **one thing travels through everything:** the row the user worries about is lifted, opens into its
  detail, becomes the card whose number moved, and its dot lands in the wordmark;
- **one camera move through scale:** start close on the number, pull back through the screen to the whole
  day, dive into the next screen through the control that changes it; or one take from the whole (a year,
  a timeline, a list of thousands) down to the one thing that matters and back, every level inside the one
  before, so nothing is ever replaced;
- **before and after in one frame:** the old way and the new side by side, until the new one takes the frame;
- **a chain reaction:** each beat is the cause of the next (the tap flips the status, the status moves the
  total, the total lands the pin);
- **one line in, the thing out:** for a product that makes things. A big pill on a neutral ground (warm
  paper suits it: every output's colours read against it), the first line typed close. Each line grows out
  of the pill into a finished output that fills the frame and plays its own short story, already moving;
  done, it shrinks onto a shelf above the pill, and the next line is typed. Three outputs, in three looks
  deliberately unlike each other (a light editorial one, a dark calm one, a loud one): the range is the
  argument. With all three on the shelf, the pill holds their lines as chips, a rest; then they drop into
  the pill, and the pill becomes the plate the logo lands on. None of the product's own screens;
- **what it does, with its own material:** for a film about a tool itself (a launch of the tool, not a film
  of its users' products, which is what its user may mean by "a film of it"). One beat per thing it does,
  each shown with the tool's own material, not a made-up customer's: oneshot's own launch film types its
  line, raises its three ideas as cards, grows the picked one into a film, scrubs its clock, whips a shape
  across it for the motion blur, draws this film's own soundtrack under it, checks it in numbers, reshapes
  it into three formats, and drops everything back into the pill for the logo. Ask which of the two is
  meant before writing either;
- **the input becomes the output:** the thing the user types or taps turns, in one piece, into what the
  product makes, and the output fills the frame within two seconds. Never stop on the machinery between
  them (a timeline, a progress bar, a strip of frames): that is the process, not the result;
- or the product's own metaphor, one continuous surface, a typographic system.

**End on the film's own material.** The wordmark is written by the caret the film began with, spelled in
its grid, or landed as its dot: never a logo that fades in over an emptied stage.

For each, give: the hook frame (frame 1), **what carries every change of scene**, what it rules out (no
cards? no cuts?), its edit style and opening (`references/styles.md`): no two of the three in the same
style, and **its look**: the ground (one flat field: paper, a near-black room, the brand's own colour full
bleed), the one accent, the type. Choose the look fresh for each film; the last film's look, or the
templates' light stage, is never a silent default. Explain each in plain words, recommend one, and let the user pick. Then start the film in the picked
style and opening: `film.sh new <id> phone|desktop|app [secs] --style s --open o --mood m [--voice]
[--format f,f]` (without `--style`, `new` picks one unlike the series' last film; offer that pick as one of
the three).

**A reference clip comes first** (`--ref`, or the user names one): `film.sh ref <video>` reads its cuts, shot
lengths, bursts, stillness and energy into `reference/<name>/ref.html`. Write the numbers down and build the
concepts to land near them, or to depart from them on purpose (say which). A film is often half still and its
cuts come in bursts; watching once does not show that.

**Never default to the template's story** (situation, action, result in three screens). It is a working
start, not a concept. A new film told in the template's beats reads as the template. Its frame is the same
trap: a product card with a headline panel beside it and a logo end card is what an agent makes with no
skill at all. Use the templates for a quick
draft and their library, never for a concept's picture.

## 4. Structure and timing

Pick a tempo where the length is a whole number of bars, so every cut lands on a downbeat:

| Length | Tempos that fit (bars) |
|---|---|
| 15 s | 96, 112, 128, 144 BPM (6, 7, 8, 9 bars). 120 does not fit |
| 30, 45 and 60 s | 96, 112, 120, 128 or 144 BPM |
| 10 s | 144 BPM (6 bars): the templates need 6 bars or more, the type style 8 |

    bar 1            the hook: the product already filling the frame, one line with a number
    the scenes       the concept, told as the situation, the action and the result (or a tour's touchpoints)
    second to last   the promise line (from rules.md, word for word) lands over the product
    last bar         the end card: the full stop flies into the wordmark, a chip, the call to action

- **The script** is a bar-by-bar table: time, picture, words on screen, sound, and **what carries into the
  next scene** (the shared element, the camera move, or "declared cut" and why). A row with nothing in that
  column is a slide change: fix it in the script, not after the render.
- **Frame 1 is what the feed shows before the film plays.** The whole hook line is already on screen and
  the product is already the biggest thing in the frame (the type style sets the hook large over the
  product instead). The poster is a second picture, usually the result (`poster` in `films.json`).
- **Rhythm is shot lengths that differ.** Vary them by bars (a half-bar hit next to a three-bar hold), and
  leave at least one rest where nothing moves for a beat or more: the rests are what make the moves land.
  Shots of one length read as slides even on a beat grid.
- **Words:** about 25 to read in 15 s, 60 in 30 s, 80 in 45 s (lines only). At most one line per bar, three
  words a second, **every line on screen 1.2 s or more**, the end card 1.5 s or more and 3 s at most once its
  last line has landed: a long still end card is dead air (one film held its own for 4.5 s).
- **One idea per film.** A second number that wants in is a second film. **One signature technique per
  film** that no other film in the series uses.
- A 30 s film tells one feature in three or four scenes of three or four bars; a 45 or 60 s film is a day or
  a week with the product for one audience, four or five touchpoints.

## 5. Motion

- **Carry every change of scene** (`references/moves.md`): a shared element (`carry:{from,to}` on the scene:
  the thing leaves its place and flies into its counterpart on the next screen, inside the product), a camera
  move that survives the change (dive's zoom through `via`, deck's slide, the app style's shot to the next
  part), an iris opening from the subject, or a cut the film means (`scene.cut:true`, the punch style's
  downbeats, a burst of hits). A device standing still while its screen swaps is only anchored: half a carry.
- **Moves:** Rise (enters 24 px from below, about 420 ms), Count (a real number ticks to its value, about
  700 ms), Sweep (a row fills, 60 ms apart), Fly (a shared element), Change (the style's own).
- **Curves by the job:** snaps (`E.outExpo`) and springs (`SPRING.land`, `.settle`, `.snap`) for things
  that arrive, `E.inOutCubic` for things that travel. **A bounce never passes 4%** (spring damping .72 or
  more). One soft S-curve on every move makes every move the same.
- **The Lift:** the one element that matters rises toward camera (1.0 to 1.6x, shadow deepening) while the
  rest dims to about 35%. Lift what will fly: the lifted row is the natural shared element.
- **Pins:** a dot lands, a hairline draws to a chip with words. Three at most, never a bare circle.
- **Camera: an operator, not keys alone.** Key the shot each beat needs, then put a `Rig` on the keys
  (`references/moves.md`): it chases them on springs, lags and settles as a person does, dives through
  scale evenly (its zoom springs in log space) and shakes on a landing. Lead what it follows by 0.1 s; key a
  whip's landing before the thing moves. Dives and whips are fast on purpose, and the motion blur (in the
  preview too) is what makes them read. Behind an empty or flat ground put a far `Lattice`, or a move has
  nothing to read against. Dead still in the rests; whip only between two shots of the same thing. Mark the
  number the film is about `data-keep` during camera moves.
- **The reference's grammar, beat by beat:** while a line is typed the camera stays close and follows the
  caret; on the send it whips out, and the next picture rises from below rather than fading in. Each
  headline is written in a word at a time over the picture it belongs to, and leaves the same way before the
  next one comes. Between beats the camera whips or the subject flies; nothing cross-fades. At the end
  everything the film showed gathers (into a row, then into the pill) and the name is typed where the line
  was.
- **Cause and effect within two beats,** and **a thing that moves leaves its place** (a flight hides its
  origin; two of the same number read as a mistake). **The end card rises onto an empty stage.**
- **Never:** a cross-fade between two interfaces, a wandering cursor (it appears 200 ms before a click, on
  the target), parallax between interface layers (a far lattice behind the ground is not that), 3D tilt,
  floating device mockups, a frame that is always in motion. A rolling
  number never passes through a value above where it lands.

## 6. Legibility

Phone cuts are read at about a third of their pixel size. On the 1080 x 1920 canvas: hero number 110 px or
more, headline words 56 px or more, labels 24 px or more, nothing under 22 px. On 16:9: labels 16 px or more,
headline words 100 px or more. A native app's 13 point text reads only when the camera frames it close
(`references/engine.md`). Feed apps draw over the top 220 px, the bottom 420 px and a 130 px column on the
right between y 1000 and 1650: keep key content inside x 60 to 1020 and y 220 to 1500, and left of x 950 below
y 1000. `read` measures both on the real frames.

## 7. Colour, type, copy

- **One accent element per frame carries attention.** Green, amber and red mean data states only.
- **Two typefaces**, from `brand.json`: the head face for headlines, numbers and kickers, the body face for
  the rest. Rebuilt screens keep the product's interface face. Headlines of seven words or fewer, the full
  stop in the accent. The accent dot is the motif: it lands in the wordmark at the end.
- **Plain words.** No jargon in anything big. No blanket claims ("most teams"): one situation, one number.
- **Nothing the product does not do today,** on the plan the film names. Prefer relative time.
- **Names only from `story.md`,** all fictional. A real customer appears only with written permission.

## 8. Sound

- **The music carries the film.** One score per film (`films/<id>.score.cjs`), from `engine/lib/sfx.js`, on
  the picture's timeline. The groove (`bed`) is the loudest thing in it, with its weight in the kick and
  the bass, and the cuts land on its downbeats. A launch film's mood is `drive`.
- **Element sounds are recordings.** Every sound on top of the music comes from `engine/sounds/` (CC0: a
  real keyboard, swooshes, impacts, short UI clicks and one ding): `typing(M, times, gain, { text })` for a
  line typed, `sample('motion/swoosh')` for a whip, `sample('impact/soft')` for a landing. The synthesized
  hits in `sfx.js` (`key`, `pop`, `blip`, `tick`, `thock`, `marimba`, `glide`) are the old kit: a film whose
  every effect was one of them sounded cheap next to the reference, whatever its timing. Keep them for the
  groove.
- **Few sounds on top, and none of them pitched.** A sound goes on top only where the music cannot say it:
  keys while a line is typed (the reference's most frequent effect), the send, a swoosh under a whip, a soft
  impact on a landing, a click per row as a list checks off. About one a bar, never one per event. Marimba
  runs, pops, blips, glides and bells on events made one film sound like a pinball machine ("dring, dut");
  the one pitched sound is the sonic logo's ding, placed in a silence, which every film of a series closes
  on (`sonic_logo`, or the brand's own).
- **Stop the music to make a reveal land.** `bed(M, mood, { breaks: [[t0, t1]] })` cuts the groove dead for a
  beat or two before a reveal: the line typed or the send is heard alone, and the groove drops back in on
  the reveal. The music may also wait for the first event (`from: 2`): a prompt typed in a quiet room, the
  drop on the send. A groove from frame 1 under someone typing sounds like a template. A licensed track
  the user supplies beats the kit's groove: cut the film to its downbeats (`references/sound.md`).
- **No voice unless the user asks for one.** A film of results carries its words on screen and its feeling
  in the music. A voice, a groove and effects all share the middle of the spectrum: the one narrated
  oneshot film put half its energy at 150 to 600 Hz and read as clutter. When there is a voice, it says
  what the screen says, and the effects drop to the keys and the logo.
- **Every film must work muted:** the picture alone tells the story.
- **Measure it, because you cannot listen:** `film.sh <id> listen` must PASS (busy, thin, muddy and dingy are
  measured against a launch film the user liked; `REF=<clip>` compares with any reference). `onsets` checks
  that the hits land on the bar lines. Mix: peak about -1 dBFS, RMS -12 to -16 dBFS. The user still signs
  off every soundtrack by ear. Details: `references/sound.md`.

## 9. The loop

    film.sh ref <video>                               a reference clip in numbers, before the concepts
    film.sh new <id> phone|desktop|app [secs] --style s --open o --mood m [--voice] [--format f,f]
    film.sh capture <address or file> <name>          a reference screenshot into reference/
    film.sh <id> check                                page errors, warnings, render(t) purity, characters the fonts lack
    film.sh <id> read [format]                        carry, rhythm, speed, cross-fades, legibility, safe zone
    T="0,2.5,5" film.sh <id> stills [format]          full-size frames to look at
    film.sh <id> sheet [format]                       a frame every 0.125 s: look at all of them
    film.sh <id> voice                                a film with a voice: each line spoken, timed, checked
    film.sh <id> audio | onsets                       write the score | its hits against the bar lines
    [REF=<clip>] film.sh <id> listen                  the soundtrack in numbers: busy, thin, muddy, dingy
    film.sh <id> poster [format]                      the poster frame
    film.sh <id> quick [format]                       1x, no motion blur: a fast look for yourself
    film.sh <id> preview [format]                     the MP4 the user watches: 1x, with motion blur
    film.sh <id> final [format]                       2x with motion blur, only after the user's yes
    film.sh <id> gif [format]                         a looping GIF of it (no sound)
    film.sh <id> subs [format]                        caption files (.srt, .vtt); preview and final write them too
    (a format is phone, wide, square or 4x5; `all` runs a command for every format the film has)
    film.sh studio                                    every film, every format, with sound

1. The concepts (section 3), the user's pick, then `new` in that style and opening. Then the **script**:
   the bar-by-bar table with the carry column, numbers from `story.md`, lines checked against `rules.md`.
   Show it before building.
2. Rebuild the screens, set the shots, the beats and each scene's carry. The library and its traps:
   `references/engine.md`; the carries and springs: `references/moves.md`.
3. Write the score. Then `check` (it must say pure), then **`read` in every format**: carry 0.6 or more with
   no bare change, rhythm and cross-fade not failing, every legibility and safe-zone warning fixed or
   explained (`references/read.md`). Look at the frames either side of every change in its report: a
   verdict is a measurement, not a judgement. Then stills of every frame you changed, the `sheet`, `audio`,
   `listen` (it must PASS), `onsets`.
4. **Two independent reviewers**, one for product truth, one for motion craft, with the read report
   (`references/review.md`). Verify every finding on a full-size frame before fixing it.
5. `poster` and `preview`. The user watches. `final` only after their yes: it gives every moving frame as
   many motion-blur captures as its speed needs (up to 16), one to a still frame, and never blurs across a cut.
   Each MP4 comes with its words as `.srt` and `.vtt` beside it, for the platform's own captions (most feed
   video plays muted); tell the user they are there. They are never burned into the picture.

## References

- `references/styles.md`: the five edit styles, the three openings, the beats a scene can show.
- `references/moves.md`: carries (shared elements, iris), springs, landing, the operator, what `read` needs.
- `references/read.md`: what each leg of `film.sh read` measures, its thresholds, what it cannot see.
- `references/engine.md`: how a film file is laid out, every library function, the traps.
- `references/brand.md`: `brand.json`, `story.md` and `rules.md`, field by field.
- `references/sound.md`: the instruments, the mixer, how a score is laid out.
- `references/review.md`: the checks before anything is called done, and the two reviewer briefs.
