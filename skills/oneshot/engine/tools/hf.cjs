// node hf.cjs <film.html> <soundtrack.wav|none> <W> <H> <DUR> <query> <workdir> <out.mp4> quick|preview|final
// Renders a built film with HyperFrames (https://github.com/heygen-com/hyperframes, Apache-2.0): the film's page made a
// composition in <workdir>, one paused GSAP timeline the film's length that calls render(t) (lib.js, boot), rendered
// at 60 fps by HyperFrames' own Chrome, with its motion blur.
//   quick    no motion blur: a fast look for yourself
//   preview  motion blur, a 180 degree shutter (open for half of each frame, as a film camera's)
//   final    the same at twice the size (4K for 16:9, 9:16 and 1:1; 4:5 has no such size and stays at 1x), scaled back
//            down with an area filter: every edge drawn from four pixels
// A line every tenth of the way, with the time left; HyperFrames' full output is kept in <workdir>/render.log. Then the
// film's own sound, decoded again: its loudness and true peak (AAC can draw a peak a little over the wav's).
// HyperFrames runs without its anonymous telemetry, its update check and its notice about its own agent skills.
'use strict';
const { spawn, execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const [,, html, wav, WS, HS, DURS, query, work, out, mode] = process.argv;
const W = +WS, H = +HS, DUR = +DURS, NM = path.join(__dirname, '..', 'node_modules');
const die = m => { console.error(m); process.exit(1); };
if (!['quick', 'preview', 'final'].includes(mode)) die('usage: hf.cjs <film.html> <wav|none> <W> <H> <DUR> <query> <workdir> <out.mp4> quick|preview|final');
const HFBIN = path.join(NM, 'hyperframes', 'bin', 'hyperframes.mjs'), GSAP = path.join(NM, 'gsap', 'dist', 'gsap.min.js');
if (!fs.existsSync(HFBIN) || !fs.existsSync(GSAP)) die('HyperFrames is not installed. Run the engine setup once: bash setup.sh');
let FF = process.env.FFMPEG, FP = null;
if (!FF) try { FF = require(path.join(NM, 'ffmpeg-static')); } catch (e) {}
try { FP = require(path.join(NM, '@ffprobe-installer', 'ffprobe')).path; } catch (e) {}

// the composition: the film's page without its player, its format written in, GSAP inlined, the stage inside a root
// that tells HyperFrames the frame's size, the film's length and the shutter, and the soundtrack as its audio
let src = fs.readFileSync(html, 'utf8');
src = src.replace(/\/\/PLAYER\{[\s\S]*?\/\/\}PLAYER/, '');
if (!src.includes('<div id="stage"></div>')) die(`${html}: no <div id="stage"></div> to render`);
const head = `<script>window.__OS_Q=${JSON.stringify(query || '')};</script>\n<script>${fs.readFileSync(GSAP, 'utf8')}</script>`;
src = src.replace('<head>', () => '<head>\n' + head);
const blur = mode === 'quick' ? '' : ' data-motion-blur="on" data-motion-blur-shutter="180" data-motion-blur-events="on"';
const audio = wav !== 'none' ? `\n<audio id="soundtrack" src="film.wav" data-start="0" data-duration="${DUR}" data-volume="1"></audio>` : '';
src = src.replace('<div id="stage"></div>', () => `<div id="root" data-composition-id="film" data-start="0" data-width="${W}" ` +
  `data-height="${H}" data-duration="${DUR}"${blur} style="position:relative;width:100%;height:100%;overflow:hidden">\n` +
  `<div id="stage" data-layout-allow-overflow></div>${audio}\n</div>`);
fs.rmSync(work, { recursive: true, force: true }); fs.mkdirSync(work, { recursive: true });
fs.writeFileSync(path.join(work, 'index.html'), src);
if (wav !== 'none') fs.copyFileSync(wav, path.join(work, 'film.wav'));

const UP = { '1920x1080': 'landscape-4k', '1080x1920': 'portrait-4k', '1080x1080': 'square-4k' }[`${W}x${H}`];
const big = mode === 'final' && UP;
const master = big ? path.join(work, 'master.mp4') : out;
const args = [HFBIN, 'render', work, '--fps', '60', '--output', master, '--crf', mode === 'quick' ? '18' : mode === 'preview' ? '12' : '10'];
if (mode === 'quick') args.push('--page-motion-blur', 'off');
if (big) args.push('--resolution', UP);
// HyperFrames encodes with the engine's own ffmpeg and ffprobe, so the computer needs none of its own
const env = { ...process.env, HYPERFRAMES_NO_TELEMETRY: '1', DO_NOT_TRACK: '1', HYPERFRAMES_NO_UPDATE_CHECK: '1', HYPERFRAMES_SKIP_SKILLS: '1' };
if (!env.HYPERFRAMES_FFMPEG_PATH && FF && fs.existsSync(FF)) env.HYPERFRAMES_FFMPEG_PATH = FF;
if (!env.HYPERFRAMES_FFPROBE_PATH && FP && fs.existsSync(FP)) env.HYPERFRAMES_FFPROBE_PATH = FP;
const log = fs.createWriteStream(path.join(work, 'render.log'));
const t0 = Date.now();
let told = 0, buf = '', tail = [], blurLine = '';
const hf = spawn(process.execPath, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
const read = chunk => {
  log.write(chunk); buf += chunk.toString();
  let i; while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).replace(/\x1b\[[0-9;]*m/g, ''); buf = buf.slice(i + 1);
    tail.push(line); if (tail.length > 30) tail.shift();
    if (line.startsWith('[motion-blur]')) blurLine = line;
    const m = line.match(/^@hf-progress (\{.*\})$/); if (!m) continue;
    let p; try { p = JSON.parse(m[1]); } catch (e) { continue; }
    const pct = Math.floor((p.pct || 0) / 10) * 10;
    if (pct > told && pct < 100) { told = pct; const s = (Date.now() - t0) / 1000;
      console.log(`  ${pct}%  ${s.toFixed(0)}s, about ${(s / pct * (100 - pct)).toFixed(0)}s left`); }
  }
};
hf.stdout.on('data', read); hf.stderr.on('data', read);
hf.on('close', code => {
  log.end();
  if (code !== 0 || !fs.existsSync(master)) { console.error(tail.filter(l => l.trim() && !l.startsWith('@hf-progress')).slice(-12).join('\n'));
    die(`HyperFrames stopped (exit ${code}): see ${path.join(work, 'render.log')}`); }
  if (blurLine && !/failedFrames=0\b/.test(blurLine)) console.log('WARN', blurLine);
  if (big) execFileSync(FF, ['-v', 'error', '-y', '-i', master, '-map', '0:v', '-map', '0:a?',
    '-vf', `scale=${W}:${H}:flags=area,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '10', '-tune', 'animation', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-c:a', 'copy', '-movflags', '+faststart', out]);
  console.log(`wrote ${out} ${(fs.statSync(out).size / 1e6).toFixed(1)} MB in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  if (wav === 'none') return;
  const { loudness } = require(path.join(__dirname, '..', 'lib', 'sfx.js'));
  const raw = execFileSync(FF, ['-v', 'error', '-i', out, '-vn', '-ac', '2', '-ar', '48000', '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  const x = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4), n = x.length >> 1, L = new Float64Array(n), R = new Float64Array(n);
  for (let i = 0; i < n; i++) { L[i] = x[2 * i]; R[i] = x[2 * i + 1]; }
  const ld = loudness([L, R]);
  console.log(`sound in the film: ${ld.lufs.toFixed(1)} LUFS, true peak ${ld.tp.toFixed(2)} dBTP`);
  if (ld.tp > -1) console.log('WARN the AAC peaks over -1 dBTP and may clip on a phone: write the soundtrack again (film.sh <film> audio), or lower a track');
});
