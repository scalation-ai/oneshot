// node framediff.cjs <dirA> <dirB>   compares same-named frames: proves a change to shared code altered nothing on screen
'use strict';
const fs = require('fs'), path = require('path');
const { PNG } = require(path.join(__dirname, '..', 'node_modules', 'pngjs'));
const [,, a, b] = process.argv;
const files = fs.readdirSync(a).filter(f => f.endsWith('.png')).sort();
let worst = 0; const bad = [];
for (const f of files) {
  if (!fs.existsSync(path.join(b, f))) { bad.push(`${f}: not in ${b}`); continue; }
  const A = PNG.sync.read(fs.readFileSync(path.join(a, f))), B = PNG.sync.read(fs.readFileSync(path.join(b, f)));
  if (A.width !== B.width || A.height !== B.height) { bad.push(`${f}: sizes differ`); continue; }
  let over = 0, m = 0;
  for (let i = 0; i < A.data.length; i += 4) { const d = Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2]));
    if (d > 8) over++; if (d > m) m = d; }
  const share = over / (A.width * A.height); worst = Math.max(worst, share);
  if (share > 0.0005) bad.push(`${f}: ${(share * 100).toFixed(2)}% of pixels differ (max ${m})`);
}
console.log(`${files.length} frames, worst ${(worst * 100).toFixed(3)}% of pixels differ`);
console.log(bad.length ? bad.join('\n') : 'identical within tolerance');
