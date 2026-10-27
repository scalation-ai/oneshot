# The three project files

`film.sh init` writes all three with placeholders, in `oneshot-output/`. Every film reads them,
and the reviewers check every film against them. They are what makes twenty films read as one series.

## brand.json

`film.sh brand [folder]` fills it from the product's own code: colours from CSS variables (hex, rgb,
hsl, oklch; `.dark` blocks set aside), Tailwind configs, Xcode colour sets and Android `colors.xml`;
fonts from `@font-face`, `next/font`, Google Fonts links, `@fontsource` packages and font files; the
theme from the product's background; the name from the README, `Info.plist` or `package.json`. Font
files are copied into `fonts/`, Google fonts fetched there. It prints each value with the file and
line it came from and writes `brand.found.json`. It fills `brand.json` only while it is still the
template (`--write` overrides). Lines marked "guess" and every note go to the user before a film.

    {
     "name": "paylark",                      the brand, for people reading the file
     "theme": "dark",                        the stage: "dark" (the default) or "light"
     "wordmark": "paylark",                  the name as drawn top right and on the end card, in the head face
     "wordmarkSpacing": "-.05em",            its letter spacing
     "wordmarkDotGap": 0.12,                 optional: the end card's gap before the dot, in em (faces differ)
     "colors": {
      "accent": "#6A4DFF",                   the one colour that carries attention
      "ink": "#16181F", "body": "#3A3D46", "muted": "#6B7280",    text: headlines, body, labels
      "border": "#E2E5E9", "surface": "#F8F9FB",                  card edges, the app's page
      "night": "#0B0E14",                    the dark stage the product sits on
      "stage": "#F5F6F8",                    optional: the light stage (the product's own background)
      "green": "#16A34A", "amber": "#B26A00", "red": "#DC2626"     data states only
     },
     "glow": ["106,77,255", "126,96,255", "170,150,255"],          optional: the three lights of the stage
     "fonts": {
      "head": {"family": "Space Grotesk", "file": "SpaceGrotesk.ttf", "weight": "300 700"},
      "body": {"family": "DM Sans", "file": "DMSans.ttf", "weight": "100 1000"}
     }
    }

A series with a narrator adds its voice, so every film speaks alike (`references/sound.md`):
`"voice": {"name": "af_heart", "speed": 1, "words": {"paylark": "pay lark"}}`, where `words` respells
the names the voice gets wrong.

**A logo.** When the brand has one, use it: never redraw a logo in a font. Put its SVG files in the
project's `brand/` folder and name them: `"logo": {"light": "logo.svg", "dark": "logo-dark.svg"}`
(one alone is fine; `light` is for a light ground). The build pastes them in, and
`LogoParts(parent, 'dark')` draws the logo and hands back each of its shapes (with the copies that
draw its outline and shadow) as its own group, in drawing order: the end of a film brings the parts
in one at a time out of the film's own material (a frame becomes a square, the playhead's dot becomes
the dot) and lands them as the logo, rather than fading a finished logo in. Take the series' colours
from the logo too. A logo in raster (PNG) only: ask for the SVG.

A static font (one file per weight) lists them: `{"family": "Poppins", "files": [{"file":
"Poppins-400.woff2", "weight": "400"}, {"file": "Poppins-700.woff2", "weight": "700"}]}`.

**The theme:** the stage the product sits on, in the brand's colours either way. Dark is a night
with slow light in the accent; light is the product's own background with dark type. Pick the one
closer to the product; a pale accent (a yellow, a mint) cannot carry a light stage, so keep dark.

Anything left out falls back to a neutral default. Optional colours, each derived from the accent
unless set: `accentTint` (a fill behind accent text), `highlight` (a marker behind a word),
`accentLine` (rings and chip borders on the night), `accentPale` (chip text on the night),
`eyebrow`, and the tints `greenTint`, `redTint`, `amberTint`.

**Fonts:** `.ttf`, `.otf`, `.woff2` or `.woff`, found in the project's `fonts/` folder, the project
folder, `films/`, or the engine's own `fonts/` (Space Grotesk and DM Sans, both SIL Open Font
Licence). A film embeds its fonts, so it plays anywhere. Use two faces at most; no italics. A brand
that draws its name in a third face adds `"wordmark": {"family", "file", "weight"}` under `fonts`:
it is used for the wordmark alone (top right and the end card). Check each font's licence allows
embedding; keep its licence file next to it. A face must draw every character the films show: a name
in Thai or Japanese, an accented name, a ✓. `film.sh <id> check` names any it lacks.

**The interface's face** is the product's own, whatever the brand's two are: rebuilt screens use it.
A web app's face is a file like any other. A native app often uses the system's face (SF Pro on a
Mac), which may not be bundled: `desk.js` gives `SYS`, the system stack, so render those films on
the system they belong to.

**Filling it in:** take the values from the product itself, never from memory. The site's CSS (its
custom properties and computed styles) or the design tokens give the accent, the greys and the
fonts. If the brand has two accents, pick the one its buttons use and ask. If its buttons are ink or
grey, take its logo's colour or the one its site uses for links and highlights, and ask. The night
colour is the darkest neutral the brand already uses, or the default.

## story.md

Every number and name that may appear on screen, with the screen or data each comes from. Write it
as one story (one user or customer, one week) so the films can share it: tonight's figure in film 2
is the same figure in film 7. For a product people use for themselves, the story can be about "you",
never named, with fictional names only for the people around them. A film that needs a new number waits until the number is added here, and the
number comes from the user, never from a guess.

- Use a fictional customer and fictional names. Real customers appear only with their written
  permission and their result exactly as they published it, with its period.
- When a real screen and the story disagree (a date, a total), the story wins; note it as re-lettered.
- Relative time words ("this Friday", "last month") keep a film true for longer than dates do.

## rules.md

- **Promise lines,** one per feature, word for word from the product's own site or menu. A film
  closes on it. One wording, never paraphrased, so the series does not drift.
- **Calls to action,** and when each is allowed (a free trial line only when everything the film
  shows works in the trial, for example).
- **Claims:** what may be said, what never (competitors' names, results that are not on a screen,
  what the product does not do today, on the plan the film names).
- **Words:** the product's own vocabulary, the jargon to avoid in anything big, punctuation rules.
