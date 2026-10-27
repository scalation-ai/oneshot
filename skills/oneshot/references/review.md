# Before anything is called done

1. **The film in numbers, in every format.** `film.sh <id> read all`: carry 0.6 or more with no bare change
   of scene, rhythm and cross-fade not failing, legibility and safe-zone warnings fixed or explained
   (`references/read.md`). Open each report and look at the frames either side of every change: a verdict
   that disagrees with the frames is a finding about `read`, and the frames win.
2. **Every frame, in every format.** `film.sh <id> sheet all` makes contact sheets of every format, a
   frame every 0.125 s. Look at all of them, not a sample.
3. **A muted watch** in `film.sh studio`. The situation, the number and the promise must come
   through with no sound at all. An agent cannot watch: read the contact sheets in order for it, and
   ask the user to watch once muted when they see the preview.
4. **Two independent reviewers**, sent at the same time as separate subagents with the briefs below,
   the film's script, `story.md`, `rules.md`, the read reports (`read.json` and the path of `read.html`),
   the onsets and listen reports (and the voice report, for a film with a voice) and the paths of its contact sheets and
   stills. Every review so far has found real problems; run them even when the film looks right.
   **Keep them fast: every image a reviewer opens costs time.** Give them the contact sheets and one
   full-size still per bar plus one at each event (`T="..." film.sh <id> stills`, the times from the
   script), not every still you have. Tell each to read the sheets first, open a still only to check
   something the sheets show, render at most five extra frames and only to confirm a finding, and
   report in one pass. A 15 s film's review should take minutes, not an hour.
   **Draft mode** (the user asked for a draft, or `--draft`): one reviewer with both briefs, the
   contact sheets and the per-bar stills only, reporting the three most serious problems of each
   kind. The full two-reviewer pass still runs before the film the user will publish.
5. **The poster frame.** Freeze on the frame most likely to become the thumbnail (usually the
   product's reveal, not frame 1): would the number alone make someone open it? `film.sh <id> poster`
   (T= sets the second; the default is the film's `poster` in `films.json`).
6. **Verify every finding on a full-size frame before fixing it** (`T="4.2" film.sh <id> stills`), then
   re-render and look again. Reviewers read small thumbnails and are sometimes wrong.
7. **The user watches the preview.** A final render happens only after their yes.

## Brief 1: product truth

    You are reviewing a short product film for truth, not taste. You have its script, story.md
    (every number and name allowed on screen), rules.md (promise lines, calls to action, claims,
    words), and full-size stills and contact sheets of every format. Report each problem with its
    time, format and exact on-screen text, and why it is wrong. Check:
    - Every number on screen is in story.md, and matches every other film in the series.
    - Every name is fictional and listed in story.md. No real customer, no competitor.
    - The promise line is rules.md's, word for word. The call to action is the one rules.md allows
      for this film.
    - Nothing claims more than the product does today, on the plan the film names.
    - The screen is a native rebuild of the real product: no screenshot, no invented interface, no
      capture leftovers (cursors, real names, dates, internal menus, developer badges, test banners).
    - Words follow rules.md (jargon, punctuation). Nothing a viewer could read as a promise the
      product does not keep.
    - A film with a voice (its report from film.sh <id> voice): every spoken line is a line on
      screen, and a respelling ("says ...") means the same words and numbers, nothing added.

## Brief 2: motion craft

    You are reviewing a short product film for motion craft. You have its script and full-size
    stills and contact sheets (a frame every 0.125 s) of every format, the onsets and listen reports
    of its soundtrack, and its score. Report each problem with its time and format, what you see, and
    the fix. Check:
    - Frame 1: the hook line is fully on screen and the product is already the biggest thing in
      the frame, showing the problem the hook names (never a title card).
    - Carry: at every change of scene, something the viewer was already looking at survives and
      moves into the next scene (the read report names what, per change; check it on the frames
      either side). A carry nobody would notice, or one that says nothing about the feature, is a
      finding even when the report passes it. A flying element stays inside the product.
    - Cause and effect: when a state flips, what it changes moves within two beats; nothing that
      flies from one place to another leaves a copy behind; the end card rises onto an empty stage.
    - Rhythm: shots of different lengths, at least one rest where nothing moves; the camera still in
      the rests.
    - Dead stretches: any second where nothing moves and no line is on screen.
    - Reading time: every line is fully on screen for 1.2 s or more; one line per bar; the end card
      holds 1.5 s or more, and 3 s at most once its last line has landed.
    - The result, not the process: most of the running time shows what the product makes or
      changes, full frame; no stretch of machinery (a timeline, a log, a strip of thumbnails).
    - Collisions and clipping: text over text, text cut by the frame or the phone's edge, a lifted
      element under a veil, a chip over the number it explains.
    - Transitions: the film's style (glide, punch, dive, type or deck, in films.json) cut its own
      way, both screens opaque, never a cross-fade; no blank or half-drawn frames; a close shot keeps
      its element whole, never a row cut at both sides.
    - Legibility at phone size (hero numbers 110 px, labels 24 px, nothing under 22 px on 9:16;
      labels 16 px on 16:9) and key content inside x 60 to 1020, y 220 to 1500 on 9:16, and left of
      x 950 below y 1000 (the feed's buttons).
    - One accent element per frame; green, amber and red on data only.
    - Rolling numbers never pass a value above where they land.
    - Sound against picture: the strongest hits land on bar lines and on the film's events.
    - Sound, clean: the listen report passes; every element sound in the score is a recording
      (`sample`, `typing`, `cue`, `sonic_logo`), never a synthesized `key`, `pop`, `blip`, `tick`,
      `thock`, `marimba` or `glide`; about one sound on top a bar, none pitched but the logo's ding;
      a break in the groove before the reveal that matters most.
    - A film with a voice: each clip starts as its words appear and ends before they leave (no
      warning in its voice report), and no two clips run into each other.

## After changing shared code

Render stills of the existing films before and after the change, at the same times, and compare:
`node engine/tools/framediff.cjs <before> <after>`. They must be identical
within tolerance unless the change was meant to alter them.
