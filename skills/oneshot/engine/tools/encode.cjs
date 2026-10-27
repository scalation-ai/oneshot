// node encode.cjs <captures_dir> <K> <SS> <audio.wav|none> <out.mp4>
// turns render.cjs's captures into the film: each frame's captures (frames.json says how many) averaged in linear light
// into its motion blur, scaled down by SS (the 2x final), and encoded H.264 at 60 fps with BT.709 tags (without them,
// players shift the brand's colours). K is kept for the command line; frames.json decides.
// One ffmpeg decodes every capture once and scales it down; this script averages each frame's captures (a frame that
// held still has one, passed through as it is); a second ffmpeg encodes the frames as they arrive. Nothing is written
// to disk between the two, and the work grows with the captures taken, not with the shutter's most.
// ffmpeg comes from ffmpeg-static, or $FFMPEG.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const [,, dirA, , SSS, wav, out] = process.argv;
const SS = +SSS || 1, dir = path.resolve(dirA);   // absolute: ffmpeg reads the list's paths from the list's own folder
let FF = process.env.FFMPEG;
if (!FF) try { FF = require(path.join(__dirname, '..', 'node_modules', 'ffmpeg-static')); } catch (e) {}
if (!FF || !fs.existsSync(FF)) { console.error('ffmpeg not found. Run the engine setup once: bash setup.sh'); process.exit(1); }
const man = JSON.parse(fs.readFileSync(path.join(dir, 'frames.json'), 'utf8')), counts = man.counts;
const first = path.join(dir, `f000000_0.${man.ext}`);
// the captures' size, from the first one's header (PNG: IHDR; JPEG: the SOF marker)
function size(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  for (let i = 2; i < b.length;) { if (b[i] !== 0xff) { i++; continue; } const m = b[i + 1], len = b.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + len; }
  throw new Error('cannot read the size of ' + file);
}
const [CW, CH] = size(first), OW = Math.round(CW / SS), OH = Math.round(CH / SS), FB = OW * OH * 3;
// the list of captures, in order, for ffmpeg's concat reader (one image per entry)
const list = path.join(dir, 'captures.txt');
fs.writeFileSync(list, counts.flatMap((n, i) => Array.from({ length: n }, (_, k) =>
  `file '${path.join(dir, `f${String(i).padStart(6, '0')}_${k}.${man.ext}`).replace(/'/g, "'\\''")}'`)).join('\n') + '\n');
const dec = spawn(FF, ['-v', 'error', '-f', 'concat', '-safe', '0', '-i', list,
  '-vf', (SS > 1 ? `scale=${OW}:${OH}:flags=area,` : '') + 'setpts=N', '-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'],
  { stdio: ['ignore', 'pipe', 'inherit'] });   // each capture numbered in turn, passed through: one frame out per capture
const encArgs = ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${OW}x${OH}`, '-r', '60', '-i', 'pipe:0'];
if (wav && wav !== 'none') encArgs.push('-i', wav, '-map', '0:v', '-map', '1:a');
encArgs.push('-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv',
  '-r', '60', '-c:v', 'libx264', '-preset', 'slow', '-crf', '10', '-tune', 'animation', '-x264-params', 'aq-mode=3:aq-strength=0.9',
  '-profile:v', 'high', '-level', '4.2');
if (wav && wav !== 'none') encArgs.push('-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-shortest');
encArgs.push('-movflags', '+faststart', out);
const enc = spawn(FF, encArgs, { stdio: ['pipe', 'inherit', 'inherit'] });

// sRGB to linear and back, as tables
const LIN = new Float32Array(256); for (let v = 0; v < 256; v++) { const u = v / 255; LIN[v] = u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4); }
const SRGB = new Uint8Array(4097); for (let i = 0; i <= 4096; i++) { const l = i / 4096; SRGB[i] = Math.round(255 * (l <= 0.0031308 ? 12.92 * l : 1.055 * Math.pow(l, 1 / 2.4) - 0.055)); }
const acc = new Float32Array(FB);
const write = buf => new Promise(res => enc.stdin.write(buf) ? res() : enc.stdin.once('drain', res));
// a line every tenth of the frames, with the time left at the pace so far
const t0 = Date.now(), step = Math.max(1, Math.ceil(counts.length / 10));
const tell = f => { if (f % step || f === counts.length) return; const s = (Date.now() - t0) / 1000;
  console.log(`  encoded ${Math.round(f / counts.length * 100)}%, ${s.toFixed(0)}s, about ${(s / f * (counts.length - f)).toFixed(0)}s left`); };

(async () => {
  // one capture at a time, filled into one buffer as ffmpeg's chunks arrive
  let img = Buffer.allocUnsafe(FB), fill = 0, frame = 0, got = 0;
  const take = async () => {
    const n = counts[frame];
    if (n === 1) { await write(img); img = Buffer.allocUnsafe(FB); frame++; return; }
    if (got === 0) acc.fill(0);
    for (let i = 0; i < FB; i++) acc[i] += LIN[img[i]];
    if (++got === n) { const o = Buffer.allocUnsafe(FB), k = 4096 / n; for (let i = 0; i < FB; i++) o[i] = SRGB[Math.min(4096, Math.round(acc[i] * k))];
      await write(o); got = 0; frame++; }
  };
  for await (const chunk of dec.stdout) {
    let at = 0;
    while (at < chunk.length) { const m = Math.min(FB - fill, chunk.length - at); chunk.copy(img, fill, at, at + m); fill += m; at += m;
      if (fill === FB) { fill = 0; if (frame < counts.length) { const was = frame; await take(); if (frame > was) tell(frame); } } }
  }
  enc.stdin.end();
  const [dc, ec] = await Promise.all([new Promise(r => dec.on('close', r)), new Promise(r => enc.on('close', r))]);
  fs.rmSync(list, { force: true });
  if (dc !== 0 || ec !== 0 || frame !== counts.length) { console.error(`encode failed: ${frame} of ${counts.length} frames (decoder ${dc}, encoder ${ec})`); process.exit(1); }
  console.log('wrote', out, (fs.statSync(out).size / 1e6).toFixed(1) + ' MB');
})().catch(e => { console.error(e.stack || e.message); process.exit(1); });
