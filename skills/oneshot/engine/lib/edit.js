/* Edit styles: how a film cuts, where its camera looks and how its lines arrive. film.sh new picks a style per film,
   unlike the series' last film, and writes it into the film as Look('...'). The recipes: references/styles.md.
     glide  one continuous shot: slow pushes, one screen pushes the next along, letters rise. Calm.
     punch  hard cuts on the downbeat between a wide and a close shot, a zoom punch on every event, words pop.
     dive   the camera lives close in the interface: it lands on details and zooms through into the next screen.
     type   the words lead: each scene opens on its line, large, over a veil; then the product plays it out.
     deck   the screens are flat cards in a row: the camera slides from one to the next, the others dimmed.
   A shot is the rectangle of the camera's space the frame shows, {l,t,w}: w wide, the frame's shape. */
const LOOKS={
  glide:{change:'push',line:{enter:'rise',leave:'sink'},glow:1,settle:.4,lead:.3},
  punch:{change:'cut',line:{enter:'pop',leave:'cut'},glow:.55,settle:.06,lead:0,punch:.07},
  dive:{change:'zoom',line:{enter:'rise',leave:'sink'},glow:.8,settle:.45,lead:.3},
  type:{change:'veil',line:{enter:'pop',leave:'sink',at:'mid'},glow:.6,settle:0,lead:.25},
  deck:{change:'slide',line:{enter:'rise',leave:'sink'},glow:1,settle:.5,lead:.3},
};
function Look(name){const L=LOOKS[name];if(!L)throw new Error(`film: unknown style "${name}" (glide, punch, dive, type or deck)`);return {name,...L};}

// between two shots at eased progress p: a zoom about the one point they share, so every edge moves one way
function zoomShot(a,b,p){if(Math.abs(a.w-b.w)<1e-6)return {l:lerp(a.l,b.l,p),t:lerp(a.t,b.t,p),w:a.w};
  const w=a.w*Math.pow(b.w/a.w,p),k=w/a.w,px=(a.l*b.w-b.l*a.w)/(b.w-a.w),py=(a.t*b.w-b.t*a.w)/(b.w-a.w);
  return {l:px+(a.l-px)*k,t:py+(a.t-py)*k,w};}
// a camera: a layer whose transform shows shot {l,t,w} of its space (sw wide) across the frame
function camTo(layer,sw){layer.style.transformOrigin='0 0';
  return sh=>{const k=sw/sh.w;layer.style.transform=`scale(${k}) translate(${-sh.l}px,${-sh.t}px)`;};}

/* ---------- Cut: which screen shows, how one screen becomes the next, where the camera looks ---------- */
// scenes, in order: {at, el, card, wide, close, via, hits, seq}. at: the scene's start (s). el: its screen (leave it out
// when the scenes share one screen and only the camera moves); card: its card, in the deck style. wide and close: its
// two shots. via (dive): the shot the camera zooms through into the next scene, the close shot by default. hits
// (punch): the event times the camera punches on. seq (punch): the shot for each bar, 'w' wide or 'c' close ('wc').
// opt: bar (a bar's length); prom (the promise's start: the camera eases to `reveal` from there, by default the last
// scene's wide shot); end (when the product leaves); open ('problem', 'closeup' or 'result'); apply(shot, i) (sets the
// camera); aspect (the space's height over its width); push ({w, dir}: how far a screen travels, dir 1 from the
// right); deck (a Deck). CUT.render(t) returns {i, shot}; CUT.shown(i) is when scene i's product is in full view.
// What carries a scene into the next (moves.js; `film.sh read` checks every change has one):
//   scene.carry {from, to, lead, dur, arc}  a shared element: `from` on the last screen flies into `to` on this one
//                                           across the change (lead s before it, for dur s); the row that was lifted
//                                           becoming the card it opens, a total becoming the next screen's number
//   opt.operator {float, shake, holds}      a hand on the camera: a slow float (a share of the shot's width), dead
//                                           still inside holds ([[t0,t1],...]), and a landing shake on every hit and
//                                           change of scene (a share of the width)
function Cut(look,scenes,opt){
  const n=scenes.length,bar=opt.bar,prom=opt.prom,ASP=opt.aspect,reveal=opt.reveal||scenes[n-1].wide;
  scenes.forEach((s,i)=>{const nx=i<n-1?scenes[i+1].at:prom;if(!(nx-s.at>=.5))console.warn(`film: scene ${i+1} starts at ${s.at.toFixed(2)} s and has ${(nx-s.at).toFixed(2)} s before the next; give every scene a bar or more.`);});
  const PUSH=opt.push||{w:1080,dir:1},PD=.6,SD=.65,X={scenes,look};
  const next=i=>i<n-1?scenes[i+1].at:prom;
  // the hard cuts the punch style means (every downbeat, wide to close, and the promise), declared for `film.sh read`,
  // which counts them as cuts rather than as scenes replacing each other
  X.cuts=[];
  if(look.name==='punch'){for(let b=scenes[0].at+bar;b<prom-1e-6;b+=bar)X.cuts.push(+b.toFixed(4));X.cuts.push(+prom.toFixed(4));}
  scenes.forEach((s,i)=>{if(i&&s.cut)X.cuts.push(+s.at.toFixed(4));});   // scene.cut: this change is a hard cut on purpose
  const OS=window.__os=window.__os||{};OS.cuts=[...new Set([...(OS.cuts||[]),...X.cuts])];
  const cur=t=>{let i=0;while(i<n-1&&t>=scenes[i+1].at)i++;return i;};
  const deeper=(s,k)=>{const cx=s.l+s.w/2,cy=s.t+s.w*ASP/2;return {l:cx-(cx-s.l)/k,t:cy-(cy-s.t)/k,w:s.w/k};};
  X.deeper=deeper;
  X.shown=i=>scenes[i].at+(look.change==='veil'?bar:0);
  // glide: .12 of the way from wide to close across the scene, deck .3 (the closeup opening pulls back over its first bar)
  const DRIFT=look.name==='deck'?.3:.12;
  const glideAt=(i,t)=>{const s=scenes[i],a=i===0&&opt.open==='closeup'?bar:s.at;
    const drift=zoomShot(s.wide,s.close,DRIFT*E.inOutQuad(inv(a,next(i),t)));
    return i===0&&opt.open==='closeup'&&t<bar?zoomShot(s.close,s.wide,E.inOutCubic(inv(0,bar,t))):drift;};
  // punch: a hard cut to the bar's shot on every downbeat, a punch on each hit and on each change of scene
  const punchAt=(i,t)=>{const s=scenes[i],b=Math.max(0,Math.floor((t-s.at)/bar+1e-6));
    const seq=s.seq||(i===0&&opt.open==='closeup'?'cw':'wc');let k=0;
    [...(i>0?[s.at]:[]),...(s.hits||[])].forEach(h=>{const u=t-h;if(u>=0&&u<.7)k=Math.max(k,u<.05?E.outQuad(u/.05):1-E.outCubic(inv(.05,.7,u)));});
    return deeper(seq[b%seq.length]==='c'?s.close:s.wide,1+look.punch*k);};
  // dive: land on the close shot out of a deeper one, hold, pull back to wide in the second bar, creep toward `via`,
  // then zoom through it into the next scene
  const diveAt=(i,t)=>{const s=scenes[i],a=s.at,nx=next(i),bars=Math.round((nx-a)/bar),v=s.via||s.close;
    let sh=i>0?zoomShot(deeper(s.close,2.4),s.close,E.outQuart(inv(a,a+.6,t))):s.close;
    sh=zoomShot(sh,deeper(s.close,1.04),E.inOutQuad(inv(a+.6,a+(bars>1?bar:nx-a),t)));
    if(bars>1){sh=zoomShot(sh,s.wide,E.inOutCubic(inv(a+bar,a+bar+1.3,t)));sh=zoomShot(sh,v,.22*E.inOutQuad(inv(a+bar+1.3,nx-.42,t)));}
    if(i<n-1)sh=zoomShot(sh,deeper(v,2),E.inQuart(inv(nx-.42,nx,t)));
    return sh;};
  // type: wide under the veil, then a push to the close shot once the veil has gone
  const typeAt=(i,t)=>{const s=scenes[i],u=X.shown(i);return zoomShot(s.wide,s.close,E.inOutCubic(inv(u+.2,u+1.6,t)));};
  const at={glide:glideAt,punch:punchAt,dive:diveAt,type:typeAt,deck:glideAt}[look.name];
  function camera(t,i){
    const s=scenes[i];
    if(t>=prom){const p=inv(prom,prom+1.4,t);
      if(look.name==='punch')return deeper(reveal,1+look.punch*(p<.036?E.outQuad(p/.036):1-E.outCubic(inv(.036,.5,p))));
      return zoomShot(at(n-1,prom),reveal,E.inOutCubic(p));}
    // glide and deck move the camera with the change: with the push, or on its own over 1.1 s when the scenes share a screen
    const MD=s.el||opt.deck?PD:1.1;
    if(i>0&&(look.name==='glide'||look.name==='deck')&&t<s.at+MD)return zoomShot(at(i-1,s.at),at(i,s.at+MD),E.inOutCubic(inv(s.at,s.at+MD,t)));
    return at(i,t);
  }
  // screens: the current one shows; a push shows both, fully opaque, the old one leaving as the new one arrives
  const els=[...new Set(scenes.map(s=>s.el).filter(Boolean))];
  function screens(t,i){
    els.forEach(e=>{e.style.visibility='hidden';e.style.transform='none';});
    const s=scenes[i],A=i>0?scenes[i-1].el:null;if(!s.el)return;
    s.el.style.visibility='';
    if(look.change==='push'&&A&&A!==s.el&&t<s.at+PD){const p=E.inOutCubic(inv(s.at,s.at+PD,t));
      A.style.visibility='';A.style.transform=`translateX(${-PUSH.dir*p*PUSH.w}px)`;s.el.style.transform=`translateX(${PUSH.dir*(1-p)*PUSH.w}px)`;}
  }
  // type: a veil in the stage's colour sweeps in from the right before each scene and before the promise, holds a bar
  // under the line, and leaves to the left
  let V=null;
  if(look.change==='veil'){V=el('div','layer');V.dataset.os='veil';stage.insertBefore(V,LT);css(V,`background:${C.stage};opacity:.9`);}
  X.lift=i=>scenes[i].at+bar;
  function veil(t){if(!V)return;
    const wins=scenes.map((s,i)=>({a:i?s.at-.3:-2,b:i?s.at:-1,o:X.lift(i)})).concat([{a:prom-.3,b:prom,o:opt.end}]);
    let x=100;for(const w of wins){if(t<w.a)break;x=t<w.o?(1-E.inOutQuart(inv(w.a,w.b,t)))*100:-E.inOutQuart(inv(w.o,w.o+.45,t))*100;}
    V.style.transform=`translateX(${x}%)`;V.style.visibility=Math.abs(x)>=100?'hidden':'';X.cover=1-Math.min(1,Math.abs(x)/100);}
  X.cover=0;   // type: how much of the frame the veil covers, 0 to 1 (a 16:9 film centres its product while it is 0)
  // the shared elements, made after the veil so they fly over it
  X.flights=scenes.map((s,i)=>i>0&&s.carry&&typeof Fly==='function'?Fly(s.carry.from,s.carry.to,
    {t0:s.at-(s.carry.lead!=null?s.carry.lead:.12),t1:s.at+(s.carry.dur!=null?s.carry.dur:PD+.2),arc:s.carry.arc||0}):null).filter(Boolean);
  if(scenes.some(s=>s.carry)&&typeof Fly!=='function')console.warn('film: a scene has a carry but moves.js is not included (//INCLUDE moves.js before edit.js)');
  const HITS=scenes.flatMap((s,i)=>[...(i?[s.at]:[]),...(s.hits||[])]);
  X.render=t=>{
    const i=cur(t);
    screens(t,i);veil(t);if(X.flights.length)flights(t,X.flights);
    if(opt.deck){const c=j=>scenes[j].card!=null?scenes[j].card:j,s=scenes[i];
      opt.deck.render(i>0&&t<s.at+SD?lerp(c(i-1),c(i),E.inOutCubic(inv(s.at,s.at+SD,t))):c(i));}
    let shot=camera(t,i);
    if(opt.operator&&typeof operate==='function')shot=operate(shot,t,{hits:HITS,aspect:ASP,...opt.operator});
    opt.apply(shot,i);X.i=i;return {i,shot};};
  return X;
}

/* ---------- a tap: a touch on a phone, a pointer on a desktop ---------- */
// on (x,y) of its parent at time `at`: it shows 0.2 s before, already on its target (it never wanders in), presses,
// and leaves 0.4 s after. TAP.render(t). Build it inside the screen, so it moves with the camera.
function Tap(parent,{x,y,at,kind='touch',size}){
  const T={},d=size||(kind==='touch'?92:30);
  const ring=el('div','a',parent);css(ring,`left:${x-50}px;top:${y-50}px;width:100px;height:100px;border-radius:50%;border:3px solid rgba(${INK_RGB},.32);z-index:61;pointer-events:none`);
  if(kind==='touch'){T.e=el('div','a',parent);css(T.e,`left:${x-d/2}px;top:${y-d/2}px;width:${d}px;height:${d}px;border-radius:50%;background:rgba(${INK_RGB},.18);box-shadow:inset 0 0 0 3px rgba(255,255,255,.92),0 6px 18px rgba(0,0,0,.2);z-index:62;pointer-events:none`);}
  else{T.e=el('div','a',parent,`<svg width="${d}" height="${Math.round(d*1.4)}" viewBox="0 0 20 28" style="display:block;overflow:visible"><path d="M2 2v19.6l4.9-4.7 3.2 7.5 3.3-1.4-3.2-7.4h6.9z" fill="#111" stroke="#fff" stroke-width="1.7" stroke-linejoin="round"/></svg>`);
    css(T.e,`left:${x-d*.1}px;top:${y-d*.1}px;z-index:62;pointer-events:none;transform-origin:${d*.1}px ${d*.1}px`);}
  T.render=t=>{const u=t-at,on=u>=-.2&&u<.55;T.e.style.visibility=on?'':'hidden';
    if(kind==='touch'){T.e.style.transform=`scale(${u<0?lerp(1.25,1,E.outCubic(inv(-.2,0,u))):lerp(.86,1,E.outCubic(inv(0,.22,u)))})`;
      T.e.style.opacity=Math.min(E.outCubic(inv(-.2,-.08,u)),1-inv(.3,.55,u));}
    else{const g=(1-E.outCubic(inv(-.2,-.03,u)))*14;T.e.style.transform=`translate(${g}px,${g}px) scale(${1-.12*Math.sin(Math.PI*clamp(u/.16))})`;
      T.e.style.opacity=Math.min(inv(-.2,-.1,u),1-inv(.4,.55,u));}
    const rp=tw(u,0,.5,'outExpo');ring.style.visibility=u>=0&&u<.5?'':'hidden';ring.style.transform=`scale(${lerp(.3,1.4,rp)})`;ring.style.opacity=1-rp;};
  return T;
}

/* ---------- the deck style: screens as flat cards ---------- */
// Deck(els,{axis,step,origin,shade}): the cards in a row (axis 'x') or a column ('y'), step px apart. DECK.render(f)
// centres card f (a fraction while sliding); the others shrink a little and dim, under a veil in the stage's colour
// laid over each card's face (shade: those faces, the cards themselves by default; a veil, not the card's opacity,
// which makes Chrome cache the card and redraw its edges a pixel off). origin: the point the cards shrink about.
function Deck(els,{axis='x',step,dim=.55,shrink=.08,origin,shade}={}){
  if(origin)els.forEach(e=>{e.style.transformOrigin=origin;});
  const veils=(shade||els).map(e=>{const v=el('div','layer',e);v.dataset.os='veil';css(v,`background:${C.stage};z-index:90;pointer-events:none;border-radius:inherit`);return v;});
  return {els,render(f){els.forEach((e,i)=>{const d=i-f,a=Math.min(1,Math.abs(d));
    e.style.transform=`translate${axis==='y'?'Y':'X'}(${d*step}px) scale(${1-shrink*a})`;veils[i].style.opacity=dim*a;e.style.visibility=Math.abs(d)>2.2?'hidden':'';});}};
}
// a phone screen as a flat card, without the phone: build in Cd.app exactly as in a Phone's P.app (916 px wide)
function PhoneCard(parent,{k=.8,y=300,time}={}){
  const w=PH.sw*k,h=PH.sh*k,Cd={k,x:(1080-w)/2,y};
  placeWorld(PHONE_RECT,true);
  Cd.el=box(el('div','a',parent),Cd.x,y,w,h);css(Cd.el,`border-radius:${Math.round(108*k)}px;overflow:hidden;background:#fff;box-shadow:${ST.cardShadow}`);
  Cd.app=box(el('div','a',Cd.el),0,0,PH.sw,PH.sh);css(Cd.app,`transform-origin:0 0;transform:scale(${k})`);
  const sb=el('div','layer',Cd.app);css(sb,'height:120px;z-index:40');
  const tm=box(el('div','sbt',sb,time||'07:12'),0,40,332);css(tm,`text-align:center;color:${C.ink}`);
  box(el('div','a',sb,statusIcons(C.ink)),PH.sw-332+91,42);
  return Cd;
}
// a layer of the phone world that fades into the stage at the bottom, as the phone does; e.fade(top) also fades the
// top when top is 1 (a zoomed world never runs under the kicker and the wordmark)
function Faded(parent){const e=el('div','layer',parent);
  e.fade=top=>{const m=`linear-gradient(to bottom,rgba(0,0,0,${1-(top||0)}) 0px,rgba(0,0,0,${1-(top||0)}) 270px,#000 360px,#000 ${MASK[0]}px,rgba(0,0,0,0) ${MASK[1]}px)`;
    e.style.webkitMaskImage=m;e.style.maskImage=m;};e.fade(0);return e;}
// the 16:9 cut of a phone film whose camera zooms: the world shows through a soft-edged window on the left, so
// nothing zoomed runs under the line panel
function wideWindow(){if(!WIDE||DESKTOP)return;
  const m='linear-gradient(to right,transparent 0,#000 24px,#000 1056px,transparent 1080px),linear-gradient(to bottom,transparent 210px,#000 262px,#000 1338px,transparent 1380px)';
  css(LW,`-webkit-mask-image:${m};mask-image:${m};-webkit-mask-composite:source-in;mask-composite:intersect`);}
