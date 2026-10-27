# Reading a film in numbers

`film.sh <id> read [format]` reads a film before anyone watches it and says what would read as a slideshow.
It seeks the film 20 times a second, asks the page what is on screen (every element that paints something
of its own, with its box, its effective opacity and an identity that stays the same between reads:
`engine/tools/reader.js`), and measures. It writes `renders/<id>-<format>/read.html` (the curves, a
before-and-after thumbnail of every change of scene, a strip of the film) and `read.json`, and prints one
line per leg. `STRICT=1` makes it exit 1 when a leg fails.

Run it as soon as the film plays end to end, and after every change to its timing. A bare change is an edit
to the film, not a re-render. Give the report to both reviewers (`references/review.md`).

## The legs

| leg | what it measures | pass | warn | fail |
|---|---|---|---|---|
| carry | every change of scene: carried (something survives it and moves or grows into the next scene, or hands over to something growing out of its place), anchored (something large survives, standing still), bare (nothing survives). score = (carried + anchored / 2) / changes judged | 0.6 and up | 0.4 to 0.6 | under 0.4 |
| rhythm | the shot lengths' variation (standard deviation over mean, 4 shots or more), and the share of the film at rest | variation 0.3 and up, rest 15% and up | either lower | variation under 0.18, or rest under 8% |
| speed | the fastest travel on screen, px per 60 fps frame, cuts left out | 40 or less | faster: it strobes in a quick render and smears in the preview and the final | |
| crossfade | two interfaces overlapping, one fading in as the other fades out | none | | any |
| legible | text that never reaches the format's size on screen: 22 px on 9:16 and feed posts, 16 px on 16:9 | none | any | |
| safe | 9:16: words resting half a second or more above y 220, outside x 60 to 1020, or at x 950+ between y 1000 and 1650 | none | any | |
| framing | elements marked `data-keep` leaving the frame while visible | none | | any |

## How a change of scene is found and judged

- **A change** is a 0.4 s window across which half or more of the content changes identity. Content
  is weighted by its area times its opacity, with **no one element counting for more than 4% of the frame**
  (a phone or a card that stays would otherwise outweigh everything changing inside it). Ground, chrome and
  veils are not content. Two changes closer than 0.5 s are one.
- **Survivors** are looked for 0.3 s either side. A survivor **moves** when its centre travels 2% of the
  frame's diagonal or its size changes by 10%. One from about 14 px square up carries (the end card's dot);
  one standing still must cover 0.3% of the frame to count toward an anchor, and the anchors 3%.
- **A hand-off** is something leaving as something new arrives where it was (centres within 0.75 of the
  larger one's size, areas within 12x), and the new one then moves or grows, followed for up to a second
  while it stays (a stand-in that starts slowly still travels). What arrives must be a shape or a picture,
  never words: one line rising where the last one sank is one line replacing another.
- **Not judged:** a change within 0.2 s of a cut the film declares (`window.__os.cuts`), and changes inside a
  burst (three or more within 1.5 s).

## What the numbers were checked against

Every template in every style, read on 15 s films (the verdicts of each change checked on its frames).
"Before" is the template as it was before shared elements were added:

| | before | now |
|---|---|---|
| phone, glide | 0.67: both scene changes anchored (the phone stands still while its screen pushes) | 1.00 |
| phone, punch | 1.00, but only the end card was judged: every other change is a declared cut | 0.80 |
| desktop, dive | 1.00: the zoom through `via` carries on its own | 0.80 |
| phone: dive, type, deck | | 0.80, 0.88, 1.00 |
| desktop: glide, punch, type, deck | | 1.00, 0.83, 0.88, 1.00 |
| app, glide; phone, glide opening on the result | | 1.00, 1.00 |

The anchored changes left are the second half of a dive or a punch change: the stand-in lands and the camera
pulls back while the card it became stands still. A punch film now has more changes judged than before (each
flight is found as a change), so its score went down while its film got better: compare verdicts, not scores.

The end card read bare until a moving survivor could be as small as the dot, and a hand-off could be made
by position as well as by overlap (the line's full stop is a 20 x 90 px glyph box; the dot that replaces it
is 15 px). Dive's flights read anchored until a hand-off's new element was followed for a second: in the
first 0.3 s its stand-in moved 1.7% of the diagonal and grew 9.6%, just under the bar. Two hand-offs read as
carries before arrivals had to be shapes: a letter of one line paired with a
letter of the next, and an element with a wordmark letter that happened to land near it.

**The thresholds are measured on these films, not on many.** When a verdict disagrees with what the frames
show, look at the frames (the report's thumbnails, then `T="..." film.sh <id> stills`), then fix the
threshold in `read.cjs` (all of them sit in one table, `T`) and add the film to this table.

## What it cannot see

- **Masks and clip paths.** An element faded by a mask (the phone's bottom) or cut by a `clip-path` counts as
  visible. `overflow` clipping is honoured.
- **Inside a canvas.** A canvas is one element; what it draws inside is not tracked. A film that moves
  things inside one should mark the canvas `data-os="ground"` and define `window.__motion(t0,t1)` (the
  farthest anything travels between two times, in px) for the renderer's shutter.
- **Meaning.** It knows that something carried a change, not that the carry says anything. A row flying
  into a card nobody needed reads as decoration. That judgement stays with the reviewers.
