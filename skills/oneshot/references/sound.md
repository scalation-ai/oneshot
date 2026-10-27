# Sound

Every film has its own score, `films/<id>.score.cjs`, written by `engine/lib/sfx.js` (plain
JavaScript, 48 kHz stereo, seeded so the same score always writes the same file): a groove synthesized
note by note, and on top of it a few recorded element sounds from `engine/sounds/` (CC0). No stock
music, no generated tracks: each sound sits on the frame it belongs to, because the score reads the
same timeline as the picture.

## A score

    const { Mix, bed, cue, sample, sonic_logo } = require('sfx');

    const BPM = 128, B = 60 / BPM, BAR = 4 * B, BARS = 16, DUR = BARS * BAR;   // the film's own grid
    const TB = n => n * BAR;
    const M = new Mix(DUR);
    const REVEAL = TB(6);                                               // copy the film's event times, by name
    bed(M, 'drive', { bpm: BPM, bars: BARS, key: 2, variant: 1,         // the groove carries the film,
      breaks: [[REVEAL - 2 * B, REVEAL]] });                            // and stops dead for two beats before the reveal
    [TB(10)].forEach(t => cue(M, 'cut', t));                           // the style's sound on a change the music does not mark

    M.add(sample('impact/boom'), REVEAL, 0.26);                         // the reveal: the groove drops back in, with weight
    M.add(sample('ui/toggle'), TB(8) + 2 * B, 0.24);                    // the one sound the feature itself makes, once
    sonic_logo(M, TB(15) + 0.75 * B, TB(15) + 1.5 * B);                 // the end card: the dot lands, then the chime
    M.write(process.argv[2] || 'film.wav');

`film.sh new` writes a starting score in the mood, key and style it picked: the groove, a cue on each
change of scene, sounds for the template's own events and the sound signature on the end card.
Replace the events with the film's own. `film.sh <id> audio` writes the soundtrack; `film.sh <id>
onsets` lists its strongest hits next to the bar lines. (`film.sh` puts the sound kit on `NODE_PATH`,
which is why `require('sfx')` works from the project.)

## Moods and cues

`bed(M, mood, { bpm, bars, key, variant, from, breaks })` lays the groove from bar `from` (0 by default)
to the end card, and a closing chord on it. `key` is semitones from C (G, A, C, D or E: the keys the
signature's chime sits well in), `variant` 0 or 1 a second chord progression; `film.sh new` picks both,
so two films of one mood differ. `from: 2` leaves the first two bars to the film's own sounds (a prompt
typed in a quiet room) and drops the groove in on bar 2's downbeat: put the event it answers there (the
send), with a riser into it and a crash and a low boom on it.

`breaks: [[t0, t1], ...]` cuts the groove dead between those seconds (a 30 ms fade out, back on the beat
at `t1`; tails ring on): the event inside the silence is heard alone, and the groove dropping back in is
the reveal's sound. Put one before each reveal that matters (the next film growing out of the pill, the
logo landing), a beat or two long, ending on a downbeat:

    bed(M, 'drive', { bpm: 120, bars: 13, from: 2, breaks: [[11, 12], [15, 16], [21, 22]] });
    [12, 16].forEach(t => M.add(reverse_swell(0.4), t - 0.4, 0.07));   // a breath into the drop, nothing more

A licensed track the user supplies replaces `bed`: `const { sr, x } = readWav('track.wav');
M.add(resample(x, sr, SR), 0, 0.8)` (a WAV at any rate, mixed to mono), then cut the picture to its
downbeats and its drop rather than to a tempo of your choosing. Use only a track the user has the rights
to, and say so in the script.

    drive     the launch film's groove: a kick on every beat with the weight in the low end, a snare on
              2 and 4, a bass on the offbeats, chords, a crash every 4 bars, a quiet top. 112 to 128 BPM
    calm      soft pads, a low sub, a sparse marimba; a heartbeat kick from bar 3. 96 to 112 BPM
    upbeat    bright pads, four soft kicks a bar, offbeat hats, shaker, claps, an octave bass. 120 to 128
    bold      minor chords, a hard kick on every beat, claps, driving bass, a crash every 4 bars. 128 to 144
    playful   a marimba riff from frame 1, light kicks, a pop on the last eighth, a bouncing bass. 112 to 128
    minimal   no drums: a swell, a low note, a quiet clock on the beat; the few recorded sounds on top
              stand out over it. 96 to 120

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
mix for a beat (the groove's breathing, or room for a hit). `M.write(path)` masters to a peak of about
-1 dBFS and prints the peak and RMS.

## The instruments (the groove's)

These are synthesized: right for the music under a film, wrong for its element sounds, which are the
recordings above. A film whose effects were all `key`, `pop`, `blip` and `marimba` sounded cheap however
well it was timed.

    drums     kick({ big, soft })  clap()  hat({ open })  shaker(d)  crash(d)  sub_boom(d, f0, f1)
    motion    whoosh(d, f_lo, f_hi, up, shape)  riser(d, f0, f1)  reverse_swell(d)  glide(f0, f1, d)
    hits      blip(f)  tick(f, d)  pop(f0, f1, d)  thock(d)  thud(d)  clack(f)  key(d)  buzz(d)
    tonal     bell(f, d)  marimba(f, d, bright)  sonar(f, d)  pad_chord(notes, d, { cutoff, att, rel })
              bass_note(f, d)  sub_note(f, d)  odometer(d, n)
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

The music is the soundtrack; a sound on top is the exception. Before adding one, ask whether the groove
already says it (a cut on a downbeat needs no thump: the kick is there). What earns a place: keys while a
line is typed, a soft press on a send, the boom and crash of a drop, one whoosh under a big move, a sound
that is the feature's own (a phone buzz for a message arriving, a coin for money moving), once in the
film rather than on every repeat. About one a bar at most.

Never put pitched hits on the film's events: a marimba run as things appear, a pop as each lands, a blip on
a pin, a glide as a line stretches. Each is pleasant alone; thirty of them over a groove and a voice is the
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
line at one loudness. The groove ducks 10 dB around each clip, the film's events 3 dB (so a tap still
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

- Peak about -1 dBFS, RMS -12 to -16 dBFS, hats low-passed, gentle saturation only. A film with a
  voice sits near -17 dBFS: the voice's peaks set the level.
- **`film.sh <id> listen` must PASS.** It reads the soundtrack in four numbers against a launch film
  measured for the skill (or against `REF=<clip>`, any film whose sound the user likes):

      hits a second   distinct sounds starting (the reference: 2.7). BUSY above 1.3 times it: cut sounds on top
      low end         energy under 150 Hz (68%). THIN 15 points below: the kick and bass carry a film
      mud             energy at 150 to 600 Hz (18%). MUDDY 12 points above: a voice, pads, stacked notes
      dings           frames where one bright pitch stands out, the end card left out (8%). DINGY above 10% or 1.5 times it

  It also prints both per two seconds, so a busy or dingy stretch points at the lines of the score
  that make it. The sonic logo's chime is expected to show in the last two seconds.
- **The groove is louder than the events.** `onsets` lists the strongest hits: the kick on the bar
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
