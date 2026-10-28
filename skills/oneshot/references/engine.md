# The engine

## A project

`film.sh init` makes the project as `oneshot-output/` in the user's current folder (or in a folder
given as `film.sh init <folder>`). Every command finds it by itself: `MOTION_PROJECT` if set, else the
current folder if it holds `films.json`, else `./oneshot-output` (or an older `./motion-clip-output`). Inside it:

    brand.json  story.md  rules.md    what every film reads (references/brand.md)
    films.json                        one entry per film: title, dur, bpm, tag, formats, score, wav, out, poster
    films/<id>.src.html               the film: edit this
    films/<id>.score.cjs              its score: edit this (references/sound.md)
    films/<id>.html, <id>.wav         made by film.sh on every command: never edit
    films/<id>.voice.json, voice/     a film with a voice: its clips and their times (film.sh <id> voice)
    renders/                          previews, finals, posters, stills and contact sheets
    fonts/                            the brand's font files, if they are not the engine's two
    reference/                        captures of the real screens to match (film.sh capture); never in a film

`film.sh` builds `films/<id>.html` from the source on every command: it pastes in `brand.json`, the
fonts, `lib.css` and every `//INCLUDE <file>` line (looked up in the project's `films/` first, then
`engine/lib/`), and every `/*INLINE <path>*/null` data file (`films/` first, then `engine/`). A built
film plays on its own anywhere. A screen that a second film needs becomes its own file in `films/`,
pulled in with `//INCLUDE`.

## A film file

Start from `film.sh new <id> phone|desktop|app`: `phone` for a phone app (9:16, its 16:9 cut free),
`desktop` for a web app in a browser card, `app` for a native desktop app on its computer's screen
(both 16:9). It writes the template with the blocks for the style and opening it picked
(`references/styles.md`). The phone template has this shape:

    //INCLUDE lib.js                                   (desktop films: const FILM_FORMAT='desktop'; before it, then //INCLUDE desk.js)
    //INCLUDE moves.js                                 the carries and springs (references/moves.md); before edit.js
    //INCLUDE edit.js                                  the edit styles
    const BPM=128,B=60/BPM,BAR=4*B,DUR=16*BAR,TB=n=>n*BAR;  the grid: TB(n) is the start of bar n
    const LAST=Math.round(DUR/BAR)-1,PROM=LAST-1;           the end card's bar, the promise line's bar
    const SC=[0,...];                                   the bar each scene starts on
    const LOOK=Look('punch');                           the style
    const KICK=Kicker('Feature name');
    const P=Phone(LW,{time:'08:30'});                  the drawn phone; the three screens are layers in P.app
    ...the rebuilt screens, the pins, the rollers, the beats' times (TAP, FLIP, ROLLT)...
    const SCENES=[{at,el,wide,close,via,hits,carry},...];   each scene's screen, shots and what carries it in
    const CUT=Cut(LOOK,SCENES,{...});                   cuts, camera, changes, in the style
    const L1=BandLine({...LOOK.line,...}), ..., L4=BandLine({...,keepDot:true});   a line per scene; the last is the promise
    const EC=EndCard({chip:'...',cta:'...'});
    function render(t){ CUT.render(t); ...every element set from t alone... EC.render(t-TB(LAST),FROM,B); }
    boot(DUR,render,()=>{ LINES.forEach(L=>L.fit()); render(TB(LAST)-.05); const s=L4.stopXY(); FROM=[s[0],s[1],Math.max(5,s[2]*.36)]; });

`render(t)` is a pure function of time. It must set every property it ever changes, on every call:
a frame is rendered in any order (the renderer runs several pages in parallel, the studio scrubs
backwards), so nothing may depend on the frame before. `film.sh <id> check` proves it: it renders
eight frames in order and again in reverse, and names any that differ.

`check` also names every character the film's own fonts cannot draw (a name in Thai, a ✓, a kana):
Chrome would draw it in a system font the brand never chose, and a frame shows two faces. It sets each
character of the page's text again in its font and asks Chrome which fonts drew it, so it sees text
in the page only, not text drawn on a canvas. Fix it with a font that has them (`references/brand.md`)
or other words.

## Captions

`film.sh <id> subs [format]` writes the film's words as `renders/<title> <format>.srt` and `.vtt`, and
`preview` and `final` write them beside each MP4, for a platform's own captions. A film with a voice is
captioned as it speaks (`films/<id>.voice.json`: each line from when its voice starts to when its words
leave); one without, as its lines show (each `BandLine` and `Say()`, from when its words appear to when
they leave). One caption at a time, each ending where the next begins; one over 42 characters goes on two
lines. The words are the screen's, never a respelling (`say`). Words the film shows some other way
(a number on a card) are not captioned unless a `Say()` names them.

## The library (`engine/lib/lib.js`)

**Stage.** `W`, `H` (1080 x 1920, or 1920 x 1080 when `WIDE`), `CXS`, `CYS` the centre. `WIDE` is true
for a desktop film and for a phone film's 16:9 cut (`?w=1`). Layers, bottom to top: `LB` night and
aurora, `LP` with `LW` inside it, the phone or card world, `LT` the lines, `LC` kicker and wordmark, `LE` the
end card. **A feed post** (`?f=1x1`, 1080 x 1080, or `?f=4x5`, 1080 x 1350) sets `FMT` and `BOX`: the world is
authored as ever (the phone world, or the desktop 1920 x 1080), and `placeWorld(rect,under)` scales its product
into the frame between the kicker and the line band, through `LP`, so a film still moves `LW` as it likes.
`Phone`, `PhoneCard`, `BrowserCard` and `ScreenCard` call it themselves (a phone runs under the band and fades,
a card stops above it); a film with another product calls it once with the product's rectangle. Lines use their
`rows`, bottom-anchored as on 9:16, 56 px or more; `Points` stay hidden (no panel); anything 16:9 only (the type
style's card glide) checks `WIDE`.

**Brand.** `C` holds the colours: `C.accent`, `C.accentRGB` (as "r,g,b" for `rgba()`), `C.accentT`,
`C.accentHL`, `C.accentLine`, `C.accentPale`, `C.eyebrow`, `C.ink`, `C.body`, `C.muted`, `C.border`,
`C.surf`, `C.night`, `C.green`, `C.amber`, `C.red`, `C.greenT`, `C.redT`, `C.amberT`. `FONT.head`,
`FONT.body` are the font family names; use them as `font-family:"${FONT.head}"`. `WORDMARK` is the
brand's name as drawn. The theme: `LIGHT` is true on a light stage, `C.stage` is the stage's colour,
and `ST` holds every colour drawn straight on the stage (`ST.text`, `ST.quiet`, `ST.chipText`,
`ST.cardShadow`...). Anything a film draws on the stage itself takes its colours from `ST`, so it
works on both themes; `C.night` stays the dark tone for a dimming veil.

**Time and easing.** `inv(a,b,t)` linear progress of `t` from `a` to `b`, clamped 0 to 1.
`tw(t,start,dur,ease)` eased progress over a window (default `outExpo`). `kf([[t0,v0],[t1,v1],...],t,ease)`
a keyframed value (default `inOutCubic`). `E` the easings: `lin`, `inQuad`, `outQuad`, `inOutQuad`,
`inCubic`, `outCubic`, `inOutCubic`, `inQuart`, `outQuart`, `inOutQuart`, `outQuint`, `inExpo`,
`outExpo`, `inOutExpo`, `outBack`, `outBackSoft`. `clamp`, `lerp`, `hx` (hex to [r,g,b]), `mixc`, `rgb`, `hex`.

**DOM helpers.** `el(tag,cls,parent,html)`, `sv(tag,attrs,parent)` for SVG, `box(e,x,y,w,h)` absolute
position, `css(e,text)` append styles, `vis(e,on)` visibility, `letters(e,text)` split into letter
spans for `rise(spans,t,start,stagger,dur)` and `sink(...)`. CSS classes: `.a` absolute, `.layer` full
size, `.card` white card with a border, `.lbl` small caps label, `.num` and `.sg` head face numbers,
`.hl` a marker highlight, `.bub` a chat bubble.

**`Phone(LW,{time,clip,sbColor})`** a drawn phone (never a photographed one), fading into the night at
the bottom. Build the rebuilt screen inside `P.app` (916 px wide). `P.setCam(scale,ax,ay,dx,dy)` the
camera, scaling about the anchor (ax, ay); a film cut with `Cut` sets `P.cam` through `camTo` instead.
`P.maskDef(top)` fades the top as well when `top` is 1, so a zoomed screen never runs under the kicker.
`P.time` the status bar clock, `P.setStatus(colour)`.

**`BandLine({rows,rowsW,size,sizeW,cyW,eyebrow,tin,tout,toutW,keepDot,enter,leave,at,step})`** one line
on screen: rows of the head face, bottom-anchored at y 1494 on 9:16, set as a panel on the right on
16:9 (`rowsW` are its line breaks there, `sizeW` its size, `cyW` its centre's y, `toutW` its earlier
exit). Letters rise in at `tin` (about 0.7 s until the last is up) and sink out at `tout` (about 0.4 s):
the next line's `tin` comes after the last one's `tout` plus 0.4. `enter:'pop'` brings whole words in
one after another (`step` s apart), `leave:'cut'` takes the line off on the frame of `tout`, `at:'mid'`
sets it large and centred on the whole frame (the type style); `...LOOK.line` gives the style's own.
A final full stop or question mark takes the
accent; `keepDot` keeps it on screen, so it can fly into the end card (`L.stopXY()` gives its
position). Call `L.fit()` in `boot`'s callback: a row too wide for its space is shrunk, and `check`
warns when that takes it under 56 px on 9:16 or 100 px on 16:9. The desktop panel is 600 px wide,
about ten characters a row at 100 px, so break a 16:9 line into short rows. In a film with a voice,
`say` respells what the line says (`say:false` keeps it silent) and `sayAt` moves when it starts;
**`Say(text,{say,at,until})`** voices words that are on screen some other way (`references/sound.md`).

**`Kicker('Name')`** the feature's name top left and the wordmark top right. Change the name mid-film
with `Kicker([{t:0,text:'First'},{t:6.2,text:'Second'}])`. `KICK.render(t,opacity)`.

**`Pin(parent,{x,y,cx,cy,html,size})`** a dot on (x, y), a hairline, a worded chip whose top left is
(cx, cy). The hairline is vertical, at the dot's x, so place the chip across that x (above or below
the dot, not on the words the dot points at); near a screen's edge let the chip hang to the inside.
`PIN.render(t-start, fadeOut)`, and hide its chip outside its window with `vis(PIN.chip,...)`. A pin
built inside a zoomed screen (`S.scr`) grows with the view: size it for the shot it is seen in.

**`Roller(parent,{digits,size,color})`** a number on wheels. `R.set([5,5,0])`;
`R.odometer(550,600,p)` a real odometer for progress `p` 0 to 1 (ease it yourself): each wheel turns
only on the carry from the one below, so no frame ever reads above the landing value. Its wheels are
decimal: a clock's minutes need their own wheels (tens 0 to 5), or the clock changes at a cut.

**`EndCard({chip,cta,small})`** the promise line's full stop flies into the wordmark and becomes its
dot, then the chip, the call to action and an optional quiet line. Each may be left out: when
`rules.md` allows no call to action yet, close on the wordmark and the chip. `EC.render(t-TB(LAST),FROM,B)`.
It measures the wordmark itself the first time it shows.

**`aurora(t,k)`** the slow light on the night stage (call it every frame; `k` its opacity).
**`wideGlide(c)`** on a phone film's 16:9 cut, 0 keeps the phone left of the line panel, 1 centres it
for bars with no line. **`boot(DUR,render,after)`** loads the fonts, runs `after` once, then plays
live (space pauses, arrows step a frame) or, in capture mode, waits for the renderer. On every frame it
seeks the film's GSAP timeline, `TL`, to the time first, then calls `render(t)`.

## GSAP in a film

Every built film has [GSAP](https://gsap.com) 3 and its MotionPathPlugin inlined (free to use under GSAP's
own licence, commercial work included), and the library gives
it one paused timeline, `TL`. `boot` seeks `TL` to `t` before each `render(t)`, so a tween on it is as
pure a function of time as `render` itself, and HyperFrames blurs what it moves like anything else.
Use it where the library has no move: an ease with character (`back.out(1.7)`, `elastic.out(1,.5)`,
`expo.inOut`), a flight along an arc, a stagger across a list, a counter.

    // in boot's after(), or once the elements exist: times in seconds, from the film's own grid
    gsap.set(CHIP, { x: 120, y: 900 });                                     // every start state, set once
    TL.to(CHIP, { motionPath: { path: [{x:120,y:900},{x:520,y:300},{x:940,y:860}], curviness: 1.4 },
                  duration: 1.2, ease: 'power2.inOut' }, TB(4));
    TL.from(ROWS, { y: 40, opacity: 0, stagger: B / 4, duration: .5, ease: 'back.out(1.7)', immediateRender: true }, TB(5));
    const N = { v: 0 };
    TL.to(N, { v: 240, duration: 1, ease: 'power3.out', onUpdate: () => { AMT.textContent = '$' + Math.round(N.v); } }, TB(6));

The rules, each learned on a real film:

- **One owner per property.** A property a tween moves is never set by `render(t)` too: `render` runs
  after the seek and wins, and the tween seems dead. GSAP composes `x`, `y`, `scale` and `rotation`
  into the element's `transform`, so an element GSAP moves takes no `style.transform` from `render`:
  move its parent there instead.
- **Set every start state.** `gsap.set` (or `TL.set(el, {...}, 0)`) before the tweens, and
  `immediateRender: true` on a `from` or `fromTo` whose start must show before it begins. Switch an
  element on with `TL.set(el, { autoAlpha: 1 }, t)`, never only through a `fromTo`'s from values:
  HyperFrames' blur can lose an element that is only ever shown that way.
- **Measure before, never during.** Read layout once (in `after`) and keep the numbers; an `onUpdate`
  that measures the page reads a different page at every seek. An `onUpdate` only writes.
- **No `TL.call`.** A seek jumps; a callback that fires on the way past runs in one order and not the
  other. Anything a call would do, a `set` at that time does purely.
- **Animate transforms and opacity,** not `left`, `top`, `width` or `height`: they lay the page out
  again on every frame and blur badly.
- `film.sh <id> check` proves the purity as before: eight frames in order and in reverse must match.

## Desktop films (`engine/lib/desk.js`)

`const FILM_FORMAT='desktop';` before the includes. The product is a card on the left, the headline a
`BandLine` in the right-hand panel: one line per scene, then the promise. At 15 s a scene may have a
single bar, so keep its line short enough to read in it (1.2 s fully on screen).

**A web app: `BrowserCard(LW,{url})`**, the product in a white browser card (1080 x 780 at x 84,
y 150), the real address in its bar (`D.url`); build the page in `D.app` (page coordinates, 1080 x
722, from under the bar). `D.view(l,t,w)` is the camera inside the page, the card staying put (the
page's rectangle w px wide whose top left is (l, t)); `D.setCam(...)` moves the whole card. **`Points(['...','...'])`** numbered points under the headline;
`PTS.render(t,tin,active)` lights point `active` while its pin is on screen.

**A native desktop app: `ScreenCard(LW,{sw,sh,wall})`**, the computer's screen as the card (1440 x 900
points by default, drawn 1080 px wide), because the product is what sits on that screen: its window,
its panel over another app, its notice in the corner. Build everything in `S.scr`, in screen points,
matched to a capture at that size. The camera is a shot: `S.view(l,t,w)` shows the rectangle `w`
points wide whose top left is (l, t); `S.shot(a,b,p)` gives the view between two shots `{l,t,w}` at
eased progress `p`, a zoom about the one point they share, so every edge moves one way. The card
draws the screen at 1080/w: 13 to 15 point interface text needs `w` of 900 or less to reach 16 px,
and the words a viewer must read want 600 or less. So frame each beat on what it is about, never the
whole screen for long. `S.setCam(...)` moves the whole card on the stage.
- **`MenuBar(S,{app,menus,items,time,dark})`** the menu bar: the app in front and its menus, status
  items (HTML, the product's own menu-bar icon among them) and the clock (`M.clock`). No maker's logo.
- **`AppWindow(S,{x,y,w,h,title,bar,dark})`** a window with its three buttons and title; build in
  `Wn.app` (window points, under the title bar). The buttons' colours are the system's, not data.
- **`SYS`** the system's interface face (SF Pro on a Mac). It is not bundled: render on that system.
- `wall` is any CSS background; the default is a soft neutral one. Never the maker's wallpaper art.
Without `Points`, set each line's `cyW:540` so it sits at the middle of the panel.

## Edit styles (`engine/lib/edit.js`)

A shot is the rectangle of the camera's space the frame shows, `{l,t,w}`, w wide and the frame's shape:
for a phone film the world (1080 x 1920, the phone's screen at x 82, y 292), for a web app the page,
for a native app the screen's points. The templates' `aim(x,y,z)` builds one around a point.

- **`Look(name)`** the style: `change`, `line` (spread into each `BandLine`), `settle` (how long after a
  change a line may enter), `lead` (how long before one it leaves), `glow` (the aurora's strength).
- **`Cut(LOOK,SCENES,opt)`** cuts the film. Each scene: `at` its start, `el` its screen (left out when the
  scenes share one screen), `card` (deck), `wide` and `close` its shots, `via` (dive: the shot it zooms
  through into the next scene), `hits` (punch: the times it punches on), `seq` (punch: 'w' or 'c' per
  bar). `opt`: `bar`, `prom` (the promise's start: from there the camera eases to `reveal`), `end` (when
  the product leaves), `open`, `aspect` (the space's height over width), `apply(shot,i)` (sets the
  camera), `push` ({w,dir}), `deck`, `operator` ({float,shake,holds}: a hand on the camera, moves.md). Per
  scene, `carry` ({from,to,lead,dur,arc}: a shared element flown across the change into this scene) and
  `cut` (true: this change is a hard cut on purpose, declared to `read`). `CUT.render(t)` shows the right screen, runs the change and sets
  the camera; `CUT.shown(i)` is when scene i is in full view, `CUT.lift(i)` when the type style's veil
  starts to leave, `CUT.cover` how much of the frame the veil covers now. `check` warns about a scene
  with less than half a second.
- **`camTo(layer,sw)`** a camera for `apply`: a layer showing shot `{l,t,w}` of a space sw wide.
  **`zoomShot(a,b,p)`** the shot between two, zooming about the one point they share.
- **`Tap(parent,{x,y,at,kind,size})`** a touch (`'touch'`, a phone) or a pointer (`'pointer'`) on its
  target 0.2 s before `at`, pressing at `at`, gone 0.4 s after. Build it inside the screen.
- **`Deck(els,{axis,step,origin,shade})`** cards in a row or a column; `DECK.render(f)` centres card f.
  The others dim under a veil laid over each card's face (`shade`), not by their own opacity: a card
  whose opacity changes is cached by Chrome and redrawn a pixel off, which `check` reports as impure.
  **`PhoneCard(parent,{k,y,time})`** a phone screen as a flat card (build in `Cd.app`, 916 px wide as in
  a phone). **`Faded(parent)`** a world layer that fades into the stage like the phone (`e.fade(top)`).
- **`wideWindow()`** on a phone film's 16:9 cut, keeps a zooming world in a soft-edged window left of
  the lines. **`wideGlide(c)`** moves it to the middle (the type style, while no line is up).

## Moves (`engine/lib/moves.js`)

`spring`, `spr`, `SPRING` (settle, land, snap: all within the 4% bounce), `squash`, `kick`, `operate`, `chase`,
`Fly` and `flights(t)` (shared elements), `Iris`, `stageRect`. Recipes and which carry for which change:
`references/moves.md`.

**What `film.sh read` reads from a film** (`references/read.md`): `data-os="ground"` (the stage under
everything), `"chrome"` (on screen all film: the kicker, the wordmark), `"veil"` (a wipe or a dim) on an element
and everything in it; `data-keep` on an element that must stay inside the frame whenever it is visible;
`window.__os.cuts`, the hard cuts the film means (`Cut` writes the punch style's and every `scene.cut`). The
library marks its own layers; mark what a film adds.

## Maps (`engine/lib/geo.js`)

    const WORLD=/*INLINE data/countries-110m.json*/null;
    //INCLUDE geo.js
    const M=WorldMap(LW,WORLD,{x,y,w,h,lon:[-130,160],lat:[-50,72]});

`M.project(lon,lat)` gives stage pixels, `M.arc([lon,lat],[lon,lat],bend)` a hairline arc's path,
`M.country(name)` a country's path. The map is world-atlas 2.0.2 (Mike Bostock, ISC licence, in
`engine/data/`), drawn from Natural Earth's public-domain data.

## Traps (each one cost a real render)

- **Measure layout only while it is displayed.** A hidden layer measures 0 and silently misplaces
  everything laid out from it. Measure in `boot`'s callback, or show the layer for the measurement.
- **z-index works only inside one stacking context.** A dimming veil and the element lifted above it
  must share one; anything under a transformed parent cannot rise above a veil outside it. That is
  how to build the Lift: a veil layer (`background:C.night`, opacity about .6) inside the screen, and
  the lifted element above it (z-index, a scale about 1.1, a deeper shadow), both in the same parent.
- **A child's `visibility:visible` beats a hidden parent.** `vis()` and `BandLine` hide with
  `visibility:hidden` on the group, so a letter or a clone set to `'visible'` stays on screen. Set
  `''` to follow the parent. Cloned nodes copy inline styles, this one included.
- **Keep 3D transforms off anything scaled far up.** With a 2D scale only, Chrome repaints it sharp.
- **A deep zoom through CSS goes soft** (Chrome scales a cached texture). Draw what you zoom into
  on a canvas with your own projection.
- **`setAttribute('opacity')` works on SVG and does nothing on HTML.** Check the element's type.
- **Screens change in the style's own way**, both fully opaque (a push goes the same direction all
  film). A cross-fade that scales reads as a double exposure.
- **A word left scaled by 1 is drawn a pixel off** from one never scaled, and which one Chrome draws
  depends on the frames before: at rest, set `transform:none`. `BandLine`'s pop does.
- **A rolling number must never pass a value above its landing value** (use `Roller.odometer`).
- **When timing changes, move the matching hits in the score.** Then run `onsets`.
- **Quote every path in the shell**; zsh does not split words, so pass width and height as two
  arguments, never as "1080 1920" in one variable.
- **Declare every hard cut** (`cut:true` on a scene; the punch style declares its own). The shutter
  takes times a quarter frame either side of each frame's own, and across a declared cut it holds
  them on the frame's side, so the cut stays clean. A jump it was not told about is blurred into a
  one-frame smear of both shots.
- **Let a parent settle before something inside it lands still.** HyperFrames blurs each moving
  element from its own poses, and a still element inside one that is still scaling or sliding can
  drop out of a frame. Look at the preview's frames around such a landing, not only at stills.
- The pipeline already handles these: fonts load before the first frame, every format is written
  into the composition (HyperFrames loads the page without a query), and the MP4 is tagged BT.709
  so players do not shift the accent colour.
- **After changing shared code**, render stills of the existing films before and after and compare
  them with `node engine/tools/framediff.cjs <before> <after>`: they must match unless the change is
  meant for them.
