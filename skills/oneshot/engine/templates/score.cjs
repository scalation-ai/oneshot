// __ID__ soundtrack. __BPM__ BPM, __BARS__ bars, mood __MOOD__, style __STYLE__. The music is the film's track (films.json:
// film.sh __ID__ music shows it, sets another, and prints its bars), cut on its bar lines, and it carries the film: it is
// the loudest thing here. A few of the film's own events go on top, quieter than the music, each a recording from
// engine/sounds/ (sample, typing) on the picture's timeline (the same times as the film's render). The ding belongs to
// the sonic logo only. film.sh __ID__ listen must PASS.
const { Mix, music, cue, sample, sonic_logo, voice } = require('sfx');

const BPM = __BPM__, B = 60 / BPM, BAR = 4 * B, BARS = __BARS__, DUR = BARS * BAR;
const TB = n => n * BAR;
const LAST = BARS - 1, PROM = LAST - 1, SC = [0, Math.round(PROM * 0.36), Math.round(PROM * 0.68)];   // as in the film
const M = new Mix(DUR);
// the track's lead-in under the opening, its drop on the second scene: the moment the product does its thing.
// A cut of your own instead: music(M, '__ID__', { cut: [[film bar, track bar, bars], ...] }) (references/sound.md)
music(M, '__ID__', { drop: SC[1] });
//IF open:result
const CHANGES = [TB(1), TB(SC[1]), TB(SC[2])];
//IF open:problem open:closeup
const CHANGES = [TB(SC[1]), TB(SC[2])];
//END
CHANGES.forEach(t => cue(M, '__CHANGE__', t));
//IF kind:phone kind:desktop
// each shared element lands where the next scene needs it (the scene's carry: it lands 0.8 s after the change)
[TB(SC[1]), TB(SC[2])].forEach(t => M.add(sample('impact/soft'), t + 0.8, 0.2));
//END

// TODO the film's own sounds, named and timed as in its render: the few the music cannot say (references/sound.md)
const SHOWN = b => TB(b) + __VEIL__ * BAR;           // when a scene's screen is in full view
const TAP = SHOWN(SC[1]) + 2 * B, FLIP = TAP + B / 2, ROLLT = SHOWN(SC[2]) + 2 * B;
M.add(sample('ui/click'), TAP, 0.28);                                    // the tap or the click
M.add(sample('ui/toggle'), FLIP, 0.24);                                  // the status flips
M.add(sample('impact/soft'), ROLLT + 0.6, 0.26);                         // the number lands

// the end card: a swell into it, the dot lands in the wordmark, the chime
M.add(Float64Array.from(sample('motion/swoosh_long')).reverse(), TB(LAST) - 1.85, 0.12);   // a breath into the end card
sonic_logo(M, TB(LAST) + 0.75 * B, TB(LAST) + 1.5 * B);
//IF voice
// the narrator: each line's clip where its words appear on screen (film.sh __ID__ voice), the music ducked under it
voice(M, '__ID__');
//END
M.write(process.argv[2] || '__ID__.wav');
