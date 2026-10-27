# Edit styles, openings and scenes

Every film is cut in one of five styles and opens one of three ways. `film.sh new` picks both at random
among those that fit the mood and the length, the series' least used style first and never the last
film's style or opening. It also picks the tempo and the musical key. `films.json` keeps each film's
picks. So two films of one feature, or the same feature for two products, never come out cut the same
way.

Keep the pick and write the script in it. Change it only when the feature cannot be told that way, and
say why in the script. When the user asks for a look ("fast cuts", "calm"), choose it with `--style` and
`--open`.

## The five styles

| Style | Camera | From one scene to the next | Lines | Moods |
|---|---|---|---|---|
| glide | one continuous shot, drifting toward the scene's close shot | the new screen pushes the old one out, one direction all film | letters rise and sink under the product | calm, minimal, upbeat, drive |
| punch | a hard cut on every downbeat between the scene's wide and close shots, a 7% zoom punch on each event | a hard cut on the downbeat | whole words pop in; a line is gone on the downbeat of the change | upbeat, bold, playful, drive |
| dive | lands close, out of a deeper shot; pulls back in the scene's second bar, creeps toward `via` and zooms through it | the zoom through `via` cuts on the downbeat into the next screen, still deep, easing out | letters rise and sink | calm, upbeat, bold, minimal, drive |
| type | wide under the veil, then a push to the close shot | a veil in the stage's colour sweeps across; the screen changes under it | each scene's line, large and centred over the veil; none while the product plays | bold, playful, upbeat, minimal |
| deck | drifts toward the close shot | the row of cards slides to the next card | letters rise and sink | calm, upbeat, playful, minimal, drive |

Both screens are fully opaque in every change: none of them is a cross-fade. A native desktop app has
no deck (it has one screen).

**What carries each change, by style** (`references/moves.md`; `film.sh read` checks every one):

| Style | Carries on its own | Give it |
|---|---|---|
| glide | nothing: the device stands still while the screen pushes (anchored) | a shared element on every scene (`carry`), the templates' default |
| punch | its downbeats are declared cuts, and need nothing | a shared element across each change of scene, so the cut lands on something the eye already holds |
| dive | the zoom through `via` | a shared element when the next screen does not grow out of `via` |
| type | nothing: the veil hides the change | a shared element flying over the veil (it is drawn above it) |
| deck | the slide of the row of cards | a shared element for the thing that moves from one card to the next |

- **glide** suits a product people trust with something: money, health, their work. The rhythm comes
  from the lines and the events, so give each scene a beat every bar or two.
- **punch** suits a launch, a consumer app, a feature with a visible payoff. Every cut changes the
  framing. `seq` picks the shot for each bar of a scene ('w' wide, 'c' close, repeating); put the
  event's bar on 'c'. Punch one event per beat at most.
- **dive** suits a detailed interface and one precise action. Close shots are the style: frame each
  scene on its detail. `via` is the control the user taps to reach the next screen, so the zoom reads
  as going in. The whole device shows only under the promise (`reveal`).
- **type** suits a strong claim in few words. The product plays each scene without a line, so its
  motion must carry the scene. Lines of two to six words, 140 px (150 on 16:9). Frame 1 is the hook,
  large over the product showing through the veil: the one exception to "the product is the biggest
  thing in frame 1". On 16:9 the product moves to the middle while no line is up. It needs scenes of two
  bars or more (8 bars at least).
- **deck** suits several screens: a tour, before and after, one flow in three steps. Each screen is a
  card (`PhoneCard`; on a desktop, one `BrowserCard` per page, in a column). A scene's `card` is the
  card it centres. The cards either side stay dimmed, never read.

## Openings

- **problem:** frame 1 is the product showing the problem the hook names, the hook under it.
- **closeup:** frame 1 is close on the detail the hook names (the late row, the number), and the camera
  pulls back over the first bar (punch: a cut to wide on bar 2). Frame 1 is a strong thumbnail.
- **result:** the first bar shows the end state (the result screen, the number already landed) under
  the hook; then the story from its start. It needs 7 bars or more. The screen's values stay final
  until the result has left, then go back.

## Scenes: what to show

A film is three scenes at 15 and 30 s (the situation, the action, the result) and four or five at 45
and 60 s (a tour). A scene is one screen, its wide and close shots, and a beat or two. At 30 s the
scenes run four or five bars each: give each a beat every bar or two, or it reads as a still. Pick the
beats that prove the feature:

- **The Lift:** the row that matters rises toward camera, the rest dims.
- **A pin:** a dot, a hairline, a few words. Three per film at most.
- **A tap or a click** (`Tap`), then what it changes within two beats: a status flips, a row moves,
  the app says what it did.
- **A count:** a number rolls to its value (`Roller.odometer`).
- **A sweep:** rows fill in, 60 ms apart.
- **A notice arrives:** a phone banner, a desktop notification.
- **A scroll:** the list moves to the row that matters (move the screen's content, not the camera).
- **Before and after in place:** the same screen, the state flipped under a pin.
- **Side by side:** two cards (deck), the old way and the new.

Across a series, vary the beats as well: two films with the same three beats in the same order read as
one film twice. Write each film's beats into its script.

## In the film

`const LOOK=Look('dive')` sets the style: its lines (`...LOOK.line` in each `BandLine`), when a line
may enter after a change (`LOOK.settle`) and leave before one (`LOOK.lead`), and the stage's glow
(`LOOK.glow`). The scene list, `SCENES`, goes to `Cut(LOOK,SCENES,{...})`: each scene's start, screen,
card, shots (`aim(x,y,z)`: the point to centre and how much larger), `via`, `hits` and `seq`. The
library: `references/engine.md`. The score's groove is the mood's `bed()`, and a change of scene the
music does not already mark gets the style's `cue()`, a recorded sound: `references/sound.md`.

To change the style of a film already begun, start a new one with `--style` and move the screens
across: the templates differ by style in how the world is built (the deck's cards) and in the lines
(type's).
