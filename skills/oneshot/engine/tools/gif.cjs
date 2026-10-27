// node gif.cjs <film.mp4> <out.gif> <W> <H> [width] [fps]   (film.sh <film> gif)
// A looping GIF of a rendered film, for a README, a doc or a chat, where video does not play: no sound, 12 frames a
// second, about 300,000 pixels a frame whatever the shape (730 x 410 for 16:9, 410 x 730 for 9:16, 548 x 548 for
// 1:1), one palette for the whole film, drawn from its own colours. ffmpeg comes from ffmpeg-static, or $FFMPEG.
'use strict';
const { spawnSync } = require('child_process'), fs = require('fs'), path = require('path');
const [,, src, out, WS, HS, wS, fpsS] = process.argv;
let FF = process.env.FFMPEG;
if (!FF) try { FF = require(path.join(__dirname, '..', 'node_modules', 'ffmpeg-static')); } catch (e) {}
if (!FF || !fs.existsSync(FF)) { console.error('ffmpeg not found. Run the engine setup once: bash setup.sh'); process.exit(1); }
const even = x => 2 * Math.round(x / 2);
const w = even(+wS || Math.sqrt(300000 * +WS / +HS)), fps = +fpsS || 12;
const vf = `fps=${fps},scale=${w}:-2:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff:max_colors=256[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`;
const r = spawnSync(FF, ['-y', '-hide_banner', '-loglevel', 'error', '-i', src, '-filter_complex', vf, '-loop', '0', out], { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status || 1);
const mb = fs.statSync(out).size / 1e6;
console.log(`wrote ${out} ${mb.toFixed(1)} MB, ${w} px wide, ${fps} fps`);
if (mb > 10) console.log('  over 10 MB, which GitHub and many chats will not show inline: make it narrower (GIFW=480) or slower (GIFFPS=10)');
