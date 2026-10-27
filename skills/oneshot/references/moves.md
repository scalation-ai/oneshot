# Moves: how one scene grows out of the last

A film reads as a slideshow when its scenes **replace** each other, however good each one is. It reads as one
film when something on screen **survives every change of scene and visibly moves into the next one**. That
survivor is the carry. Every change of scene needs one, and `film.sh <id> read` says which have none.

`engine/lib/moves.js` holds the moves. Include it after `lib.js` (and `desk.js`) and before `edit.js`; the
templates already do. Every move is a function of time, so `render(t)` stays pure.

## Which carry for which change

| The change | The carry | How |
|---|---|---|
| A list opens one of its rows | the row becomes the detail it opens | `carry:{from:ROW,to:DETAIL}` on the scene |
| A detail produces a result | the card becomes the result's card, tile or number | `carry:{from:DETAIL,to:TILE}` |
| A control leads to the next screen | the camera dives through the control (dive) | `via:` the control |
| Two screens of one flow | the cards slide as a row (deck) | the deck style |
| The screen stays, its part changes | the camera moves to the next part | the app style's shots, or `zoomShot` |
| A new place opens from the subject | the next screen opens as a circle from the subject | `Iris(el,{x,y,t0})` |
| The end card | the promise line's full stop flies into the wordmark | `keepDot:true` and `EndCard` (built in) |

**A hard cut is a carry only when it means something:** the punch style's downbeats, a burst of hits, the
jump from the result back to the start (`scene.cut:true`). `read` counts declared cuts as cuts and does not
judge them. An undeclared bare change is a slide.

**Anchored is half a carry.** When the device stays still and only its screen changes (a push inside a phone
that does not move), `read` calls the change anchored: the frame survives, nothing moves into the next scene.
Give the change a shared element or move the camera with it.

## Shared elements: `carry` and `Fly`

```js
{at:TB(SC[1]),el:ELS[1],...,carry:{from:ROWS[1],to:DET}}          // in SCENES: Cut flies it for you
{...,carry:{from:DET,to:TILE,lead:.12,dur:.8,arc:40}}              // lead: s before the change; dur: the flight; arc: px it bows up
```

Across the change, `from` leaves its place (hidden, so it is never on screen twice), a stand-in with a solid
body in the elements' own colour flies to where `to` sits on the new screen (size, corners and colour
changing on the way, rising a little toward camera), and becomes `to`. Its old contents leave in the first
third, the new ones arrive in the last half: never both half there, so it is not a cross-fade.

- **Both ends are measured once,** in `boot`, by rendering the film at the flight's start and end. So `to`
  must be where it lands at the end of the flight: let the new screen finish arriving inside `dur`.
- **Pick elements the viewer has been looking at:** the row the Lift raised, the card the number sits in.
  A shared element nobody noticed carries nothing.
- **One element in two flights is fine** (it arrives in one and leaves in the next): it stays hidden
  while any flight that names it is in the air.
- Outside `Cut`, make a flight with `Fly(from,to,{t0,t1,arc,lift})` and draw every flight with `flights(t)`
  in `render`.

## Springs: things that land

`spring(t,{f,z})` is a damped spring from 0 to 1 released at time 0, written as a formula (pure). `f` is its
frequency in Hz, `z` its damping. Below `z` 1 it overshoots by `overshoot(z)`: **the film's limit is 4%,
`z` .72**. Three presets stay inside it:

| | f | z | for |
|---|---|---|---|
| `SPRING.settle` | 1.4 | .9 | a card or a panel coming to rest |
| `SPRING.land` | 2.2 | .72 | a thing arriving with a little give (a chip, a dot, a number) |
| `SPRING.snap` | 3.4 | .86 | a fast, firm stop |

`spr(t,at,a,b,'land')` is a value springing from `a` to `b` from time `at`. `springV` is its speed.
**Pick the curve for the job, not one ease for everything.** One smooth S-curve on every move makes every
move feel the same. Snaps (`E.outExpo`) and springs are what lands; `E.inOutCubic` is for things that travel.

## Landing and the operator

- `squash(v)` gives `[along, across]` from a speed: stretched along the motion while fast, the area kept.
  Scale a moving dot or chip by it, rotated to its direction.
- `kick(t,[times],{amp,f,life})` is a decaying sine after each time: sum it into a scale or a y for the
  give of a landing.
- `Cut`'s `opt.operator:{float,shake,holds}` puts a hand on the camera: a slow float (a share of the shot's
  width, about .003), **dead still inside `holds`** (the rests, `[[t0,t1],...]`), and a landing shake on
  every hit and change of scene (about .012). The float must stop in the rests. A camera that never stops
  takes away the stillness that makes the moves land, and `read` will show the rests gone.
- `chase(fn,t,lag)` gives where a moving point was, on average, over the `lag` seconds before `t`: a camera
  aimed with it trails its subject and settles after it, as an operator does.

## The rig: an operator on the camera

Keyed shots alone move like a slide program: each key is reached on its curve and stops dead. `Rig` puts a
person behind them:

```js
function want(t){ /* the shot each beat needs, keyed hard: zoomShot between {l,t,w} shots */ }
const RIG=Rig(want,{dur:DUR,z:.88,hits:[14.1,19.55],shake:9,
  w:t=>t<3?5:t<7.4?6.5:t<13.3?9:t<14.3?16:6});      // rad/s: 5 to 7 a calm follow, 9 a dive, 14 to 16 a whip
const camAt=t=>operate(RIG(t),t,{float:.0012,holds:[[8.5,13.8],[18.5,DUR+1]]});
// in render: setCam(camAt(t))
```

- **The centre lags the same on screen at any zoom** (its error is measured in shot widths) and **the zoom
  springs in log space**, so a dive from 1x to 9x eases like one from 1x to 2x. Keyed zooms on one curve
  alone rush the deep end of a dive.
- **Lead, do not trail, a fast subject.** Key the shot 0.1 to 0.15 s ahead of what it follows (`want` can
  read the subject at `t+.12`). For a whip, key where it lands before the thing moves: a spring that starts
  late never catches a snap, and the subject leaves the frame.
- **Shake only on landings** (`hits`, `shake` in screen px, 8 to 12), and float only outside the rests
  (`operate`'s `holds`). A camera that never settles takes away the stillness that makes the moves land.
- It is integrated once at 240 Hz the first time it is called, so build it after anything it reads is
  measured (a caret's x, a frame's place); until then call `want(t)` directly.
- Its output is rounded, so a settled camera repeats its frame and the renderer captures it once.

## The lattice: a ground the camera moves against

A dark or flat ground gives a camera move nothing to read against: the subject moves, the frame looks
still. `Lattice(LW,{pitch,dot,color,depth})` lays a faint field of dots behind the world (created before
the world, so it sits under it) and `set(shot)` moves it with the camera at `depth` (.5: half as far, with
half the zoom in log). Keep it faint (dots at 7 to 10% of the ink) and call `set` with the world's shot
every frame.

## What `read` needs from a film

- `data-os="ground"` on the stage under everything, `data-os="chrome"` on what stays all film (the kicker,
  the wordmark), `data-os="veil"` on a wipe or a dimming layer. The library marks its own; mark yours.
- `data-keep` on an element that must stay wholly inside the frame whenever it is visible (the number the
  film is about, during a camera move). `read`'s framing leg fails a frame that loses it.
- `window.__os.cuts`: the hard cuts the film means. `Cut` writes the punch style's and every `scene.cut`.
