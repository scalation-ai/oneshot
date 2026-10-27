// node test-moves.cjs   checks the spring maths in lib/moves.js: every preset settles on its target and keeps inside
// the 4% bounce a film allows, the closed form agrees with a step-by-step simulation, and a kick dies away. setup.sh runs it.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'moves.js'), 'utf8');
// the maths only: the DOM half of moves.js is never called here
const box = { window: {}, lerp: (a, b, t) => a + (b - a) * t, clamp: (x, a = 0, c = 1) => x < a ? a : x > c ? c : x,
  E: { inOutQuad: t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2 } };
box.inv = (a, c, x) => box.clamp((x - a) / (c - a));
vm.runInNewContext(src + '\n;this.out={spring,springV,overshoot,SPRING,kick};', box);
const { spring, overshoot, SPRING, kick } = box.out;
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } };
for (const [k, o] of Object.entries(SPRING)) {
  let peak = 0; for (let t = 0; t < 4; t += 1 / 480) peak = Math.max(peak, spring(t, o));
  ok(peak - 1 <= 0.04 + 1e-9, `${k} overshoots ${((peak - 1) * 100).toFixed(1)}%, the limit is 4%`);
  ok(Math.abs(spring(6, o) - 1) < 1e-3, `${k} does not settle on 1 (${spring(6, o)})`);
  ok(Math.abs(peak - 1 - overshoot(o.z)) < 0.002, `${k}: overshoot(z) says ${overshoot(o.z)}, measured ${peak - 1}`);
}
// the closed form against a semi-implicit Euler simulation at 10 kHz, for an underdamped, a critical and an overdamped spring
for (const o of [{ f: 2, z: .5 }, { f: 2, z: 1 }, { f: 2, z: 1.6 }]) {
  const w = 2 * Math.PI * o.f; let x = 0, v = 0, worst = 0; const dt = 1e-4;
  for (let i = 1; i <= 20000; i++) { v += (-2 * o.z * w * v - w * w * (x - 1)) * dt; x += v * dt; if (i % 100 === 0) worst = Math.max(worst, Math.abs(x - spring(i * dt, o))); }
  ok(worst < 0.003, `z ${o.z}: the formula is ${worst.toFixed(4)} away from the simulation`);
}
ok(spring(0) === 0 && spring(-1) === 0, 'a spring before its release is not 0');
ok(kick(0.5, 1) === 0 && Math.abs(kick(1.46, 1)) < 1e-9, 'a kick is not zero outside its life');
ok(spring(1.234, SPRING.land) === spring(1.234, SPRING.land), 'spring is not pure');
console.log(bad ? `moves: ${bad} failed` : 'moves: springs within 4%, closed forms match the simulation');
process.exit(bad ? 1 : 0);
