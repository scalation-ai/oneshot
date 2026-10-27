/* moves.js: the moves that make one scene grow out of the last, and the physics that make things land.
   Every move is a function of time, so render(t) stays pure. Include it after lib.js and before edit.js:
     //INCLUDE lib.js
     //INCLUDE moves.js
     //INCLUDE edit.js
   The recipes, and which carry suits which change of scene: references/moves.md. */

/* ---------- springs, in closed form ---------- */
// A damped spring released from 0 toward 1 at time 0, at rest: f its natural frequency (Hz), z its damping ratio. z 1
// settles without passing 1; under 1 it overshoots by exp(-z*pi/sqrt(1-z*z)): z .72 overshoots 4%, the most a film
// allows (references/moves.md). Written as a formula, not integrated, so any t gives the same value on any call.
function spring(t,{f=2,z=.8}={}){if(t<=0)return 0;const w=2*Math.PI*f;
  if(z<1){const wd=w*Math.sqrt(1-z*z);return 1-Math.exp(-z*w*t)*(Math.cos(wd*t)+z*w/wd*Math.sin(wd*t));}
  if(z===1)return 1-Math.exp(-w*t)*(1+w*t);
  const r=Math.sqrt(z*z-1),a=-w*(z-r),b=-w*(z+r);return 1-(b*Math.exp(a*t)-a*Math.exp(b*t))/(b-a);}
// its speed, in units a second (for squash and stretch)
function springV(t,o){const h=1/240;return (spring(t+h,o)-spring(Math.max(0,t-h),o))/(t>h?2*h:t+h);}
// the overshoot a damping ratio gives (0 when it does not overshoot)
const overshoot=z=>z>=1?0:Math.exp(-z*Math.PI/Math.sqrt(1-z*z));
// three springs that keep within the 4% overshoot: settle (a card coming to rest), land (a thing arriving with a
// little give), snap (a fast, firm stop)
const SPRING={settle:{f:1.4,z:.9},land:{f:2.2,z:.72},snap:{f:3.4,z:.86}};
// a value springing from a to b, released at `at`
const spr=(t,at,a,b,o)=>lerp(a,b,spring(t-at,typeof o==='string'?SPRING[o]:o||SPRING.land));

/* ---------- landing ---------- */
// squash and stretch from a speed: stretched along the motion while fast, the area kept (returns [along, across])
function squash(v,k=.0009,max=.12){const s=1+Math.min(max,Math.abs(v)*k);return [s,1/s];}
// a kick that dies away after each time in `at` (a landing, a tap): amp at the moment, a decaying sine after it.
// Sum it into a scale, a y or a camera's width; it is zero before the first and fades to nothing within `life`
function kick(t,at,{amp=1,f=7,life=.45}={}){let v=0;for(const a of[].concat(at)){const u=t-a;if(u<0||u>life)continue;
  v+=amp*Math.exp(-5*u/life)*Math.cos(2*Math.PI*f*u)*(1-u/life);}return v;}

/* ---------- the operator: a camera with a hand on it ---------- */
// operate(shot, t, {float, holds, shake, hits}) returns the shot moved as by a person holding the camera: a slow float
// (two sines whose periods never line up, `float` a share of the shot's width), faded to nothing inside `holds`
// ([[t0,t1],...]: the rests stay dead still, which is what makes the moves read), and a landing shake on each of
// `hits` (`shake` a share of the width, gone in 0.45 s). Off unless asked for: Cut takes it as opt.operator.
// aspect: the shot's height over its width (Cut passes its own), so a shake zooms about the shot's centre.
function operate(sh,t,{float=0,holds=[],shake=0,hits=[],aspect=9/16}={}){
  let k=1;for(const [a,b] of holds){if(t>a-.4&&t<b+.4)k=Math.min(k,1-E.inOutQuad(Math.min(inv(a-.4,a,t),1-inv(b,b+.4,t))));}
  const fx=float*k*(Math.sin(t*1.13+.7)*.6+Math.sin(t*.47+2.1)*.4),fy=float*k*(Math.sin(t*.83+1.9)*.6+Math.sin(t*.31+.4)*.4);
  const z=shake?kick(t,hits,{amp:shake,f:6,life:.45}):0,w=sh.w*(1-z);
  return {l:sh.l+(sh.w-w)/2+fx*sh.w,t:sh.t+(sh.w-w)/2*aspect+fy*sh.w,w};}
// the camera chasing a subject: where a point that moves (fn(t) -> [x, y]) was, on average, over the `lag` seconds
// before t (sampled, so it stays pure). It trails the subject and settles after it, as an operator does
function chase(fn,t,lag=.18,n=8){let x=0,y=0;for(let i=0;i<n;i++){const p=fn(t-lag*(i+.5)/n);x+=p[0];y+=p[1];}return [x/n,y/n];}

/* ---------- the rig: a camera that chases its shots on springs ---------- */
// Rig(want, {dur, w, z, hits, shake}) returns cam(t) -> {l,t,w}. want(t) is where the shot should be (keyed shots, hard
// as they are); the rig follows it the way an operator does: the shot's centre on a spring whose lag is the same on
// screen at any zoom (its error is measured in shot widths), the zoom on a spring of its own in log space, so a dive
// from 1x to 40x eases the same as one from 1x to 2x. w: how fast it answers (rad/s, or a function of t: 6 a calm
// follow, 14 a whip), z its damping (.85 by default: no visible overshoot). Integrated once at 240 Hz over the film the
// first time it is called, then sampled, so cam(t) is pure. Its output is rounded (1/16 px, 1/2000 of the zoom) so a
// settled camera gives the same frame twice and the renderer takes one capture of it. hits: landing times; shake: the
// screen px a landing shakes. Key a shot 0.1 s ahead of what it follows to lead it; key a whip's landing before the
// thing moves.
function Rig(want,{dur,w=7,z=.85,hits=[],shake=0}={}){
  const HZ=240,n=Math.ceil(dur*HZ)+2,X=new Float64Array(n),Y=new Float64Array(n),L=new Float64Array(n);let built=false;
  const wOf=typeof w==='function'?w:()=>w;
  function build(){const s0=want(0);let x=s0.l+s0.w/2,y=s0.t+s0.w*9/32,l=Math.log(s0.w),vx=0,vy=0,vl=0;const h=1/HZ;
    for(let i=0;i<n;i++){const t=i*h,s=want(t),om=wOf(t),W=Math.exp(l);
      X[i]=x;Y[i]=y;L[i]=l;
      const ex=(s.l+s.w/2-x)/W,ey=(s.t+s.w*9/32-y)/W,el=Math.log(s.w)-l;   // the errors, in shot widths and in log zoom
      vx+=(om*om*ex-2*z*om*vx)*h;vy+=(om*om*ey-2*z*om*vy)*h;vl+=(om*om*el-2*z*om*vl)*h;
      x+=vx*h*W;y+=vy*h*W;l+=vl*h;}
    built=true;}
  return t=>{if(!built)build();const f=clamp(t,0,dur)*HZ,i=Math.min(n-2,Math.floor(f)),u=f-i;
    let x=lerp(X[i],X[i+1],u),y=lerp(Y[i],Y[i+1],u),W=Math.exp(lerp(L[i],L[i+1],u));
    if(shake&&hits.length){x+=kick(t,hits,{amp:shake,f:7,life:.5})*W/1920;y+=kick(t,hits,{amp:shake*.6,f:9,life:.4})*W/1920;}
    W=Math.exp(Math.round(Math.log(W)*2000)/2000);const q=W/1920/16;x=Math.round(x/q)*q;y=Math.round(y/q)*q;
    return {l:x-W/2,t:y-W*9/32,w:W};};}

/* ---------- a far lattice: what the camera moves against ---------- */
// Lattice(parent, {pitch, dot, color, depth}): a field of dots behind the world, drawn in screen space, that moves with
// the camera at `depth` (1 with the world; .5 half as far, with half the zoom in log). On an empty or flat ground a
// camera move does not read; against a faint far lattice it does. Call set(shot) in render with the world's shot.
function Lattice(parent,{pitch=48,dot=1.4,color='rgba(255,255,255,.09)',depth=.55}={}){
  const e=el('div','layer',parent);e.dataset.os='ground';
  return {e,set(sh){const kw=1920/sh.w,k=Math.pow(kw,depth),p=pitch*k,r=Math.max(.6,dot*Math.min(2.2,Math.sqrt(k)));
    const cx=(sh.l+sh.w/2)*kw*depth,cy=(sh.t+sh.w*9/32)*kw*depth,m=(a,b)=>((a%b)+b)%b;
    e.style.backgroundImage=`radial-gradient(circle,${color} ${r}px,transparent ${r+.8}px)`;
    e.style.backgroundSize=`${p}px ${p}px`;e.style.backgroundPosition=`${m(960-cx,p)}px ${m(540-cy,p)}px`;}};}

/* ---------- carries: how one scene grows out of the last ---------- */
// stage px of an element's box as it is now (the stage's own scale removed)
function stageRect(e){const r=e.getBoundingClientRect(),s=stage.getBoundingClientRect(),k=s.width/W;
  return {x:(r.left-s.left)/k,y:(r.top-s.top)/k,w:r.width/k,h:r.height/k};}
const FLIGHTS=window.__osFlights=window.__osFlights||[];
// Fly(from, to, {t0, t1, ease, arc, lift}): a shared element. Between t0 and t1 the thing on the old screen leaves its
// place (it is hidden, so it is never on screen twice) and a stand-in flies from where it was to where `to` sits on
// the new screen, changing size, corners and colour on the way, and becomes it (`to` shows again at t1). The stand-in
// has a solid body in the elements' own colour; its old contents go first and the new ones come in after, never both
// half there: one card becoming the next, not a cross-fade.
// arc: px the path bows up in the middle; lift: how far it rises toward camera in flight (a scale, 0.05 by default).
// clip: the stand-in flies inside the product, never over the stage or the lines: by default it is cut to the
// screens its two ends are cut by (the first ancestor of each that clips: the phone's screen, the browser card, a
// deck's card), both together when they differ, followed as the camera moves; an element to use that instead; null
// to let it fly free.
// Both ends are measured once, in boot, by rendering the film at t0 and at t1 (so `to` must be where it lands at t1),
// and copied as they look then. Draw every flight each frame with flights(t) (Cut does it for its own): an element may
// arrive in one flight and leave in the next, and it stays hidden while any flight that names it is in the air.
const rgbaOf=c=>{const m=String(c).match(/rgba?\(([^)]+)\)/);if(!m)return [255,255,255,0];const p=m[1].split(/[ ,/]+/).filter(Boolean).map(parseFloat);return [p[0],p[1],p[2],p.length>3?p[3]:1];};
const clipOf=e=>{for(let p=e.parentElement;p&&p!==stage;p=p.parentElement){const s=getComputedStyle(p);if(s.overflowX!=='visible'||s.overflowY!=='visible')return p;}return null;};
function Fly(from,to,{t0,t1,ease='inOutCubic',arc=0,lift=.05,layer,clip='auto'}={}){
  const F={from,to,t0,t1};
  const host=layer||(()=>{let L=document.getElementById('os-fly');if(!L){L=el('div','layer');L.id='os-fly';stage.insertBefore(L,LT);}return L;})();
  const wrap=el('div','layer',host),g=el('div','a',wrap);css(g,'overflow:hidden;visibility:hidden;transform-origin:0 0;pointer-events:none');
  const clips=clip==='auto'?[...new Set([clipOf(from),clipOf(to)])].filter(Boolean):clip?[clip]:[];
  let ca=null,cb=null;
  // the copy carries no ids, so getElementById and #id rules keep finding the real element, never the stand-in
  const copy=e=>{const c=e.cloneNode(true);c.removeAttribute('id');c.querySelectorAll('[id]').forEach(d=>d.removeAttribute('id'));css(c,`position:absolute;left:0;top:0;margin:0;width:${e.offsetWidth}px;transform-origin:0 0;transform:none;visibility:inherit;box-shadow:none`);g.appendChild(c);return c;};
  const look=e=>{const s=getComputedStyle(e);return {bg:rgbaOf(s.backgroundColor),r:parseFloat(s.borderTopLeftRadius)||0};};
  F.measure=render=>{
    render(t0);from.style.visibility='';F.a=stageRect(from);F.aw=from.offsetWidth;F.al=look(from);if(ca)ca.remove();ca=copy(from);
    render(t1-1e-3);to.style.visibility='';F.b=stageRect(to);F.bw=to.offsetWidth;F.bl=look(to);if(cb)cb.remove();cb=copy(to);
    // the corners in stage px: each element's own radius, at the size it is drawn; a body with no colour of its own
    // takes the other end's
    F.ra=F.al.r*F.a.w/Math.max(1,F.aw);F.rb=F.bl.r*F.b.w/Math.max(1,F.bw);
    if(F.al.bg[3]<.05)F.al.bg=F.bl.bg;if(F.bl.bg[3]<.05)F.bl.bg=F.al.bg;};
  FLIGHTS.push(F);
  F.on=t=>!!(ca&&cb)&&t>=t0&&t<t1;   // not until both ends are measured (boot)
  F.draw=t=>{
    const on=F.on(t);g.style.visibility=on?'':'hidden';if(!on)return;
    // the screens it flies in, where they are now (the camera may be moving them)
    if(clips.length){const r=clips.map(stageRect),x0=Math.min(...r.map(q=>q.x)),y0=Math.min(...r.map(q=>q.y));
      const x1=Math.max(...r.map(q=>q.x+q.w)),y1=Math.max(...r.map(q=>q.y+q.h)),rad=clips.length===1?(parseFloat(getComputedStyle(clips[0]).borderTopLeftRadius)||0)*r[0].w/Math.max(1,clips[0].offsetWidth):0;
      wrap.style.clipPath=`inset(${y0}px ${W-x1}px ${H-y1}px ${x0}px round ${rad}px)`;}
    const p=E[ease](inv(t0,t1,t)),a=F.a,b=F.b,arcP=Math.sin(Math.PI*p);
    const x=lerp(a.x,b.x,p),y=lerp(a.y,b.y,p)-arc*arcP,w=lerp(a.w,b.w,p),h=lerp(a.h,b.h,p),s=1+lift*arcP,bg=F.al.bg.map((v,i)=>lerp(v,F.bl.bg[i],p));
    css(g,`left:${x}px;top:${y}px;width:${w}px;height:${h}px;transform:translate(${-(s-1)*w/2}px,${-(s-1)*h/2}px) scale(${s});border-radius:${lerp(F.ra,F.rb,p)}px;`+
      `background:rgba(${bg[0]|0},${bg[1]|0},${bg[2]|0},${bg[3]});box-shadow:0 ${30*arcP}px ${70*arcP}px rgba(0,0,0,${.28*arcP})`);
    // the old contents leave in the first third, the new ones arrive in the last half: never both half there
    ca.style.opacity=1-E.outCubic(inv(0,.32,p));cb.style.opacity=E.inOutCubic(inv(.5,.9,p));
    ca.style.transform=`scale(${w/Math.max(1,F.aw)})`;cb.style.transform=`scale(${w/Math.max(1,F.bw)})`;
  };
  return F;
}
// draw the flights at t (all of them by default): each element any flight in the air names is hidden, every other one
// a flight names shows (visibility '' follows its parent, so a screen that is off stays off)
function flights(t,list=FLIGHTS){const hide=new Set();list.forEach(f=>{if(f.on(t)){hide.add(f.from);hide.add(f.to);}});
  list.forEach(f=>{f.from.style.visibility=hide.has(f.from)?'hidden':'';f.to.style.visibility=hide.has(f.to)?'hidden':'';f.draw(t);});}
// Iris(el, {x, y, t0, dur}): the next screen opens out of a point (x, y in the element's own px), as a circle growing
// until it covers it: the stage opening from the subject. Before t0 the element is closed, after t0 + dur fully open.
function Iris(e,{x,y,t0,dur=.6,ease='inOutCubic'}){
  const R=Math.hypot(Math.max(x,(e.offsetWidth||W)-x),Math.max(y,(e.offsetHeight||H)-y));   // to the farthest corner
  return {render(t){const p=E[ease](inv(t0,t0+dur,t));e.style.clipPath=p>=1?'none':`circle(${(p*R).toFixed(1)}px at ${x}px ${y}px)`;}};}
