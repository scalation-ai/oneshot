# Sound

Every film has its own score, `films/<id>.score.cjs`, written by `engine/lib/sfx.js` (plain
JavaScript, 48 kHz stereo): a real track, cut on its bar lines, and on top of it a few recorded element
sounds from `engine/sounds/` (CC0). Each sound sits on the frame it belongs to, because the score reads
the same timeline as the picture, and the film is at the track's tempo, so its bars are the track's.

## The music

**A track the user brings comes first:** `film.sh new <id> ... --music <file>`, or later `film.sh <id>
music <file>` (WAV, MP3, M4A or anything ffmpeg reads). Only one they may use in a published video: their
own, or licensed for it. Ask where it came from and write it into its licence file, `music/<name>.LICENSE.txt`.

**Otherwise a track from the catalogue,** `engine/data/music.json`: instrumental tracks dedicated to the
public domain (CC0 1.0), each licence read on its own Free Music Archive page. No credit is needed.
`film.sh music [mood]` lists them with their tempo, moods and drop; `film.sh new` picks one of the film's
mood that the last film did not use. The track is fetched into the project's `music/` and kept only if
every byte matches the catalogue's sha256; its licence file is written beside it, and a fresh checkout
fetches it again on the next `audio`. Never fetch music from anywhere else: a track not in the catalogue
comes from the user. To add one to the catalogue, read its licence on its own page, then add its row with
its size and sha256.

`film.sh <id> music` prints the film's track bar by bar: its tempo, where its first bar line falls, how loud
each bar is, and the bars where it rises (`up`), thins (`down`) and `drop`s. `film.sh <id> music <track>`
gives the film another; a film at another tempo moves to the track's (its bars stay, their length changes,
its seconds round to whole bars). A measured tempo can be half or double the felt one: a 166 BPM lo-fi track
may feel like 83. Check the drop it found against the bar list.

## A score

    const { Mix, music, cue, sample, sonic_logo } = require('sfx');

    const BPM = 160, B = 60 / BPM, BAR = 4 * B, BARS = 15, DUR = BARS * BAR;   // the track's tempo, the film's bars
    const TB = n => n * BAR;
    const M = new Mix(DUR);
    music(M, 'launch', { cut: [[0, 13, 3], [3, 16, 8], [11, 13, 2], [13, 16, 2]] });
    const REVEAL = TB(3);                                               // copy the film's event times, by name
    [TB(7)].forEach(t => cue(M, 'cut', t));                             // the style's sound on a change the music does not mark
    M.add(sample('impact/boom'), REVEAL, 0.22);                         // the reveal, on the drop
    M.add(sample('ui/toggle'), TB(8) + 2 * B, 0.24);                    // the one sound the feature itself makes, once
    sonic_logo(M, TB(14) + 0.75 * B, TB(14) + 1.5 * B);                 // the end card: the dot lands, then the chime
    M.write(process.argv[2] || 'film.wav', { lufs: -14 });

`film.sh new` writes a starting score in the style it picked: the music with its drop on the second
scene, a cue on each change of scene, sounds for the template's own events and the sound signature on the
end card. Replace the events with the film's own. `film.sh <id> audio` writes the soundtrack; `film.sh
<id> onsets` lists its strongest hits next to the bar lines. (`film.sh` puts the sound kit on
`NODE_PATH`, which is why `require('sfx')` works from the project.)

## Cutting the track

`music(M, id, { drop, cut, gain, fadeIn, fadeOut, breaks })` lays the film's track. `drop: n` puts the
track's drop on film bar `n` and plays its own lead-in under the bars before. `cut` shapes it freely: a list
of `[film bar, track bar, bars]`, track bars counted as `film.sh <id> music` prints them. The cut in the
score above, on a 160 BPM track that breaks on bars 13 to 15 and drops on 16:

    [0, 13, 3]    film bars 0-2: the break, quiet, under the prompt being typed
    [3, 16, 8]    film bars 3-10: the drop as the product answers, then every scene after it
    [11, 13, 2]   film bars 11-12: the break again, under the promise line
    [13, 16, 2]   film bars 13-14: the drop again on the end card, faded out over the last 1.5 s

Every splice is on a bar line, with 6 ms fades, so it is not heard as an edit. The track's own loud and
quiet bars keep their difference: that contrast is what makes a drop land, so never level it. Put the
quiet bars (an intro, a build, a break) under the set-up, and the drop on the reveal that matters most.
A film that opens on the drop has nowhere left to go.

`breaks: [[t0, t1], ...]` stops the track dead between those seconds (a 30 ms fade out, back at `t1`):
the event inside the silence (a send, the logo landing) is heard alone, and the music coming back is the
reveal's sound. A beat or two, ending on a downbeat. A break in the track itself usually does it better.

The track is set to -16 LUFS before `gain` (1 keeps it there), under the film's events. A finished track is
dense, so give the score `M.write(out, { lufs: -14 })` and every film of the series the same (see Mix and
checks). `track(M, file, { from, at, until, ... })` lays a file as it is, uncut, for a sound the score
names itself. A film whose music is `none` (`film.sh <id> music none`) has only its own sounds.

`cue(M, kind, t, gain)` is the sound of a change of scene at `t`, from the recorded sounds: `push`
(glide) a swoosh through the move, `cut` (punch) a dry thump and a click on the downbeat, `zoom` (dive)
a breath in and a low boom out, `veil` (type) the swoosh, then a soft impact, `slide` (deck) a low
swoosh.

## The recorded sounds

The film's element sounds are recordings in `engine/sounds/`, all CC0 (sources in
`sounds/LICENSE.md`). `sample(name)` returns one at `SR` with its peak at 1, so `M.add`'s gain sets its
level; `sounds()` lists them.

    keys/key01 to key14, space, enter   a real keyboard, high-passed so only the click is left
    motion/swoosh                       a short whip (0.6 s): a camera whip, a thing flying past
    motion/swoosh_long                  a slow pass (1.8 s); reversed, a breath into a drop
    motion/whoosh_low                   a low, dark pass: something big moving, a gather
    impact/soft, soft_heavy, plate      a landing: a card set down, a number arriving, the logo
    impact/boom                         a cinematic boom with a long tail: the drop, once or twice a film
    ui/click, switch, toggle, select    the hand: a tap, a toggle, a row checking off, a pick
    ui/tick, snap, drop, open, pluck    smaller UI moments, sparingly
    ui/ding, ding2, confirm             clean tones: the sonic logo's ding (keep it for that)

`typing(M, times, gain, { text, pan })` types a line: one recorded key per time, a different key each
(never the same twice in a row), the space bar on a space when `text` is given, each a little louder or
softer and a little left or right. Copy the film's own key times so each key sounds on the frame its
letter appears:

    const LINE = '/oneshot a launch film for oneshot', KEYS = keyTimes(LINE, 0.35, 0.082);   // as in render
    typing(M, KEYS, 0.3, { text: LINE });
    M.add(sample('keys/enter'), SEND, 0.45);
    M.add(sample('motion/swoosh'), SEND + 0.05, 0.28, { pan: 0.15 });

A reversed recording is a riser: `Float64Array.from(sample('motion/swoosh_long')).reverse()`, placed so
its end lands on the drop. Add a sound only from a CC0 source, with its row in `sounds/LICENSE.md`.

**Keep one set of times.** Name every event in the score after the film's own constants (`SHEET`,
`TAP`, `FLIP`) with the same values as in `render`. When the picture's timing changes, change both.

## The mixer

`const M = new Mix(seconds)`. `M.add(signal, t, gain, { pan, rev })` places a sound at `t` seconds, `pan`
from -1 (left) to 1 (right), `rev` the reverb send from 0 to 1. `M.pump(t, depth, tau)` ducks the whole
mix for a beat (room for a hit). `M.write(path)` masters to a peak of about
-1 dBFS and prints the peak and RMS.

## The synthesized hits

The old kit, for what no recording covers. Wrong for a film's element sounds, which are the recordings
above: a film whose effects were all `key`, `pop`, `blip` and `marimba` sounded cheap however well it was
timed.

    drums     kick({ big, soft })  clap()  hat({ open })  shaker(d)  crash(d)  sub_boom(d, f0, f1)
    motion    whoosh(d, f_lo, f_hi, up, shape)  riser(d, f0, f1)  reverse_swell(d)  glide(f0, f1, d)
    hits      blip(f)  tick(f, d)  pop(f0, f1, d)  thock(d)  thud(d)  clack(f)  key(d)  buzz(d)
    tonal     bell(f, d)  marimba(f, d, bright)  sonar(f, d)  odometer(d, n)
    helpers   hz('A4') a note's frequency; mul(signal, k) and mix(a, b, ...) to scale and sum signals;
              map(n, (t, i) => value) to build one; phaseOf(freqs) for a pitch sweep; lp, hp, bp filters;
              noise, saw, env_adsr; SR the sample rate

Signals are `Float64Array`s at `SR`. A new instrument is a function returning one, for example a
bird's chirp, a fast rising sine with a short tail:

    function chirp(f0, f1, d) {
      const n = Math.floor(d * SR), f = map(n, t => f0 * Math.pow(f1 / f0, Math.pow(t / d, 0.6))), ph = phaseOf(f);
      return map(n, (t, i) => Math.sin(ph[i]) * Math.min(1, t / 0.004) * Math.exp(-t / (d * 0.55)) * 0.8);
    }

## Fewer sounds, and the right ones

The music is the soundtrack; a sound on top is the exception. Before adding one, ask whether the music
already says it (a cut on a downbeat needs no thump: the kick is there). What earns a place: keys while a
line is typed, a soft press on a send, the boom and crash of a drop, one whoosh under a big move, a sound
that is the feature's own (a phone buzz for a message arriving, a coin for money moving), once in the
film rather than on every repeat. About one a bar at most.

Never put pitched hits on the film's events: a marimba run as things appear, a pop as each lands, a blip on
a pin, a glide as a line stretches. Each is pleasant alone; thirty of them over a track and a voice is the
clutter that sent one oneshot film back ("dring, dut, not clean"). `listen` measures it.

**The series signature:** every film closes on the same sound as the dot lands in the wordmark
(`sonic_logo(M, t_land, t_chime, gain)`: a soft recorded impact, then one clean ding; `gain` scales it,
default 1). Put it in a break, so the ding is heard alone.
Keep its timbre for the signature alone. A brand can have its own: write a `signature(M, t_land,
t_chime)` function in the score (a pop on the landing, then two notes of the brand's own, the chirp
above for a bird's name) and paste the same function into every film's score.

## The voice

A film started with `--voice` has a narrator: Kokoro, a small open text-to-speech model (English,
Apache 2.0) run on this computer. It needs `bash engine/setup.sh --voice` once: about 410 MB of
packages inside the engine and a 320 MB model in a shared cache (`~/Library/Caches/oneshot` on a
Mac, `~/.cache/oneshot` on Linux; a model already fetched into the older `motion-clip` cache is used
where it is), which an update of the skill keeps.

**It says the screen's words, when they appear.** Every `BandLine` speaks its own rows, starting 0.2 s
after its words begin to appear, and must finish before they leave. On a line:

    say:'Twenty-four hundred dollars, late.'   how to say it, when the words as written read badly aloud
    say:false                                  this line stays silent
    sayAt:3.1                                  when its voice starts, if not 0.2 s after tin

`say` only respells: a number in words, a name as it sounds, never a word the screen does not show.
A film of results with few words on it (`SKILL.md` section 2) narrates the picture instead, with
`Say(text, {at, until})` lines that end before what they describe leaves the frame; no caption bar.
Words on screen some other way (an end card's call to action) are spoken with `Say('Start free.', {at,
until})`. `film.sh <id> voice` reads the lines from the built film in every format, speaks each one
(kept in `films/voice/`, so only a changed line is spoken again, and the same words always give the
same clip), writes `films/<id>.voice.json` and lists each clip's start and end:

    v1: 4 lines in the voice af_heart (1 spoken now, 3 kept)
        0.20 to   2.94  "Four invoices, eleven days late."
        4.35 to   6.10  "Jo paid the next morning."
              warning: runs 0.35 s past its words leaving (5.75 s): fewer words, or hold the line longer

**Timing.** The voice speaks about three and a half words a second, so a line that keeps the reading
rules (on screen 1.2 s or more, three words a second at most) nearly always fits. The type style at 15
s shows each line for a bar only: keep those lines to three or four words, or pick another style.
Never run two lines' voices into each other; the report says when one does.

**In the score,** `voice(M, '<id>')` (the template writes it) places the clips, centred and dry, every
line at one loudness. The music ducks 10 dB around each clip, the film's events 3 dB (so a tap still
reads under a word), and the voice sits 10 dB above the music under it: `voice(M, id, { duck, over })`
changes either. `film.sh <id> audio` runs the voice step first; `onsets` measures the music without
the voice and lists the clips and the strong hits that land under a word.

**The brand's voice,** shared by every film of a series, in `brand.json`:

    "voice": { "name": "af_heart", "speed": 1, "words": { "paylark": "pay lark" } }

`words` respells a name everywhere it is spoken. `speed` stays between 0.9 and 1.1. The voices, by
Kokoro's own grades: af_heart (A, the default) and af_bella (A-), American women; bf_emma (B-), a
British woman; am_michael, am_fenrir and am_puck (C+), American men; bm_george and bm_fable (C),
British men. The others grade lower. You cannot listen: the user signs off the voice by ear, above
all how it says the brand's name and the numbers.

## Mix and checks

- The master holds the true peak at -1.5 dBTP (peaks between the samples included), so the film's AAC,
  which adds up to about 0.2 dB, stays under -1 dBTP and never clips on a phone. RMS -12 to -16 dBFS, hats
  low-passed, gentle saturation only. A film with a voice sits near -17 dBFS: the voice's peaks set the level.
- **Loudness, in LUFS** (BS.1770, as the platforms measure it). YouTube, Spotify and most feeds play
  everything at about -14 LUFS: a louder film is turned down, and a quieter one is not always turned up.
  A track comes in at -16, and a dense one plays louder once the events are on top. Two films of
  one series more than 2 LU apart play at different volumes next to each other: give every film's score
  the same `M.write(out, { lufs: -16 })` (the series' quietest, -14 at most), which only turns a film down,
  never up into its peaks. The score prints its LUFS and true peak each time it writes, the preview and
  the final print their AAC's.
- **`film.sh <id> listen` must PASS.** It reads the soundtrack in four numbers beside the film's own
  track alone, so what it judges is what the score adds on top: the track's sound is its producer's, and a
  lo-fi track is muddier than an electro one by nature (or against `REF=<clip>`, any film whose sound the
  user likes; a film with no music, against a launch film measured for the skill):

      hits a second   distinct sounds starting. BUSY above 1.3 times the track's: cut sounds on top
      low end         energy under 150 Hz. THIN 15 points below the track's: sounds on top cover its low end
      mud             energy at 150 to 600 Hz. MUDDY 12 points above: a voice, pads, stacked notes
      dings           frames where one bright pitch stands out, the end card left out. DINGY above 10% or 1.5 times it
      LUFS            loudness. LOUD above -10, QUIET under -18; SERIES when the project's films are more than 2 LU apart
      true peak       PEAKS over -1 dBTP: it clips once it is AAC

  It also prints both per two seconds, so a busy or dingy stretch points at the lines of the score
  that make it. The sonic logo's chime is expected to show in the last two seconds.
- **The music is louder than the events.** `onsets` lists the strongest hits: the kick on the bar
  lines, the drops, the logo. An event that needs to be louder than the music is an event that
  needs a break before it.
- **Every film must work with the sound off.** Most plays start muted (feeds, email previews,
  LinkedIn); the words and the moving number carry the argument alone.
- A lighter touch, when a full score is too much: three events only (one impact on the product's
  reveal, one tick on the number that matters most, one on the end card), and a silent beat right
  before the reveal.
- You cannot listen. `onsets` shows whether the loudest hits land on the bar lines and the film's
  events; the user signs off every soundtrack by ear before a final render. It measures what a phone
  speaker plays (above 100 Hz) and counts each hit once, so a deep kick's tail is not a list of hits.
