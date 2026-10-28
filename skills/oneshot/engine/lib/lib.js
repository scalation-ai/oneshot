/* The film library. Every film is render(t): a pure function of time, so any frame renders on its own.
   Coordinates are stage pixels: 1080 x 1920 for a phone film, 1920 x 1080 for its 16:9 cut and for desktop films. */
// HF: the page is a HyperFrames composition (tools/hf.cjs), loaded without a query: its format is written into the
// page as __OS_Q, and HyperFrames seeks the film through the timeline boot() registers
const HF=window.__OS_Q!=null;
// TL: the film's own GSAP timeline, paused. boot() seeks it to t before every render(t), so a tween put on it
// (TL.to(el,{x:200,ease:'back.out(1.6)',duration:.5},TB(2))) is as pure a function of time as render(t)
// (references/engine.md, GSAP in a film)
if(window.MotionPathPlugin)gsap.registerPlugin(MotionPathPlugin);
const TL=gsap.timeline({paused:true});
const Q=new URLSearchParams(HF?window.__OS_Q:location.search);
const CAPTURE=Q.has('capture')||HF;
// ?w=1 renders the 16:9 cut: the same phone world (authored at 1080 x 1920) placed on the left,
// the type band set as a panel on the right, the end card re-centred. Everything else is shared.
// A desktop film declares `const FILM_FORMAT='desktop';` before its includes: 16:9 always, no phone.
const DESKTOP=typeof FILM_FORMAT!=='undefined'&&FILM_FORMAT==='desktop';
// ?f=1x1 or ?f=4x5, a feed post (BOX): the product above, scaled into the frame (placeWorld), the line band below it
// at full size, the kicker and the wordmark along the top. The world is authored as ever (1080 x 1920 for a phone
// film, 1920 x 1080 for a desktop one); only where it lands changes.
const FMT=['1x1','4x5'].includes(Q.get('f'))?Q.get('f'):DESKTOP||Q.has('w')?'16x9':'9x16';
const BOX=FMT==='1x1'||FMT==='4x5';
const WIDE=FMT==='16x9';
const W=WIDE?1920:1080,H={'16x9':1080,'9x16':1920,'1x1':1080,'4x5':1350}[FMT],CXS=W/2,CYS=H/2;
const BOXL={top:40,bottom:H-44};                      // BOX: the kicker's top, the line band's bottom
const BOX_BAND=250;                                   // BOX: the band's height a card keeps clear (three rows at 72 px)
const PW={k:.9,x:61,y:-178};                          // 16:9: phone world scale and offset
const PANEL=DESKTOP?{x:1240,w:600,cy:330}:{x:1060,w:790,cy:560};   // 16:9: the type panel (desktop: above the numbered points)
const MASK=WIDE?[1390,1500]:[1250,1340];               // where the phone fades into the night

/* ---------- math ---------- */
const clamp=(x,a=0,c=1)=>x<a?a:x>c?c:x;
const lerp=(a,c,t)=>a+(c-a)*t;
const inv=(a,c,x)=>clamp((x-a)/(c-a));
const E={
  lin:t=>t,
  inQuad:t=>t*t, outQuad:t=>1-(1-t)*(1-t),
  inOutQuad:t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2,
  inCubic:t=>t*t*t, outCubic:t=>1-Math.pow(1-t,3),
  inOutCubic:t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,
  inQuart:t=>t*t*t*t, outQuart:t=>1-Math.pow(1-t,4),
  inOutQuart:t=>t<.5?8*t*t*t*t:1-Math.pow(-2*t+2,4)/2,
  outQuint:t=>1-Math.pow(1-t,5),
  inExpo:t=>t<=0?0:Math.pow(2,10*t-10),
  outExpo:t=>t>=1?1:1-Math.pow(2,-10*t),
  inOutExpo:t=>t<=0?0:t>=1?1:t<.5?Math.pow(2,20*t-10)/2:(2-Math.pow(2,-20*t+10))/2,
  outBack:t=>{const s=1.70158,c=s+1;return 1+c*Math.pow(t-1,3)+s*Math.pow(t-1,2)},
  outBackSoft:t=>{const s=0.9,c=s+1;return 1+c*Math.pow(t-1,3)+s*Math.pow(t-1,2)},
};
const tw=(u,a,d,e)=>E[e||'outExpo'](inv(a,a+d,u));
// keyframed value: K=[[t,v],...], eased between keys
function kf(K,t,e){if(t<=K[0][0])return K[0][1];for(let i=0;i<K.length-1;i++){const[a,va]=K[i],[b,vb]=K[i+1];if(t<b)return lerp(va,vb,E[e||'inOutCubic'](inv(a,b,t)));}return K[K.length-1][1];}
const hx=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
const mixc=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
const rgb=(c,al)=>al==null?`rgb(${c[0]|0},${c[1]|0},${c[2]|0})`:`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${al})`;
const hex=c=>'#'+c.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');

/* ---------- brand: colours, fonts and the wordmark come from brand.json (build.cjs pastes it in) ---------- */
// Anything brand.json leaves out falls back to a neutral default. The accent is the one colour that carries
// attention; green, amber and red are for data only. The tones on the night stage derive from the accent
// unless brand.json sets them.
const BRAND=/*BRAND*/null||{};
const BC=BRAND.colors||{};
const C={accent:BC.accent||'#3E63DD',ink:BC.ink||'#16181F',body:BC.body||'#3A3D46',muted:BC.muted||'#6B7280',
  border:BC.border||'#E2E5E9',surf:BC.surface||'#F8F9FB',night:BC.night||'#0B0E14',
  green:BC.green||'#16A34A',amber:BC.amber||'#B26A00',red:BC.red||'#DC2626',
  redT:BC.redTint||'#FDECEC',greenT:BC.greenTint||'#E6F6EC',amberT:BC.amberTint||'#FFF8E6'};
C.accentRGB=hx(C.accent).join(',');
const tone=(k,d)=>BC[k]||hex(mixc(hx(C.accent),[255,255,255],d));
C.accentT=tone('accentTint',.94);     // a fill behind accent text on white
C.accentHL=tone('highlight',.82);     // a marker highlight behind a word
C.accentLine=tone('accentLine',.25);  // rings and chip borders on the night stage
C.accentPale=tone('accentPale',.72);  // chip text on the night stage
C.eyebrow=tone('eyebrow',.5);         // small caps over a line
// the stage the product sits on: "dark" (the night, the default) or "light" (brand.json "theme"), in the brand's
// own colours either way. ST holds every colour drawn straight on the stage; the dark values are the originals.
const LIGHT=BRAND.theme==='light',INK_RGB=hx(C.ink).join(',');
C.stage=BC.stage||(LIGHT?'#F5F6F8':C.night);
const ST=LIGHT?{text:C.ink,mark:C.ink,kick:`rgba(${INK_RGB},.72)`,quiet:C.muted,eyebrow:C.accent,
    chipText:C.accent,chipLine:`rgba(${C.accentRGB},.45)`,chipBg:`rgba(${C.accentRGB},.08)`,ripple:`rgba(${C.accentRGB},.45)`,
    stopGlow:`0 0 18px rgba(${C.accentRGB},.30)`,glowK:.55,
    ptRing:'#D0D5DD',ptNum:'#4B5563',ptRow:C.body,ptOff:C.muted,ptOn:C.ink,
    cardShadow:`0 30px 80px rgba(${INK_RGB},.16),0 0 0 1px rgba(${INK_RGB},.08),0 0 120px rgba(${C.accentRGB},.10)`}
  :{text:'#F4F6FA',mark:'#F3F5F9',kick:'rgba(236,240,248,.88)',quiet:'#9AA3B5',eyebrow:C.eyebrow,
    chipText:C.accentPale,chipLine:`rgba(${hx(C.accentLine).join(',')},.9)`,chipBg:`rgba(${C.accentRGB},.16)`,ripple:C.accentLine,
    stopGlow:`0 0 22px rgba(${C.accentRGB},.75)`,glowK:1,
    ptRing:'#3D4658',ptNum:'#C9D1E0',ptRow:'#DDE3EE',ptOff:'#AEB6C6',ptOn:'#FFFFFF',
    cardShadow:`0 50px 120px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.08),0 0 120px rgba(${C.accentRGB},.14)`};
// the three slow lights of the night stage, as "r,g,b"
const GLOW=BRAND.glow||[C.accentRGB,...[.08,.3].map(d=>mixc(hx(C.accent),[255,255,255],d).map(Math.round).join(','))];
const FONT={head:(BRAND.fonts&&BRAND.fonts.head&&BRAND.fonts.head.family)||'Space Grotesk',
  body:(BRAND.fonts&&BRAND.fonts.body&&BRAND.fonts.body.family)||'DM Sans'};
FONT.mark=(BRAND.fonts&&BRAND.fonts.wordmark&&BRAND.fonts.wordmark.family)||FONT.head;   // the wordmark's own face, if it has one
const WORDMARK=BRAND.wordmark||'yourbrand',WORDMARK_SP=BRAND.wordmarkSpacing||'-.04em';
const WORDMARK_GAP=BRAND.wordmarkDotGap!=null?+BRAND.wordmarkDotGap:.12;   // the end card's gap before the dot, in em: faces differ

/* ---------- dom ---------- */
const stage=document.getElementById('stage');
stage.style.width=W+'px';stage.style.height=H+'px';
[['--accent',C.accent],['--acc-rgb',C.accentRGB],['--hl',C.accentHL],['--eyebrow',ST.eyebrow],['--night',C.night],['--ink',C.ink],
 ['--stage',C.stage],['--stage-text',ST.text],['--kick',ST.kick],
 ['--font-head',`"${FONT.head}"`],['--font-body',`"${FONT.body}"`]].forEach(([k,v])=>stage.style.setProperty(k,v));
function el(tag,cls,parent,html){const e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;if(parent)parent.appendChild(e);return e;}
const NS='http://www.w3.org/2000/svg';
function sv(tag,at,parent){const e=document.createElementNS(NS,tag);for(const k in at)e.setAttribute(k,at[k]);if(parent)parent.appendChild(e);return e;}
function box(e,x,y,w,h){e.style.left=x+'px';e.style.top=y+'px';if(w!=null)e.style.width=w+'px';if(h!=null)e.style.height=h+'px';return e;}
function css(e,s){e.style.cssText+=s;return e;}
// the brand's own logo, when brand.json names one (build.cjs pastes the SVG in). LogoParts(parent, theme) draws it in
// parent (as wide as parent, `theme` 'light' or 'dark', the other if only one is given) and returns {svg, parts}: each
// shape of the logo, with the stacked copies that draw its outline and shadow, gathered in its own <g> in drawing order,
// so a film can bring the parts in one at a time and land them as the logo. A part turns about its own centre
// (transform-box fill-box). Null when the brand has no logo.
function LogoParts(parent,theme){const L=BRAND.logoSvg;if(!L)return null;const txt=L[theme]||L.light||L.dark;
  const h=el('div','',parent,txt),svg=h.querySelector('svg');svg.removeAttribute('width');svg.removeAttribute('height');css(svg,'display:block;width:100%;height:auto;overflow:visible');
  const groups=new Map();
  for(const u of [...svg.querySelectorAll('use')]){const id=(u.getAttribute('href')||u.getAttribute('xlink:href')||'').slice(1);
    let g=groups.get(id);if(!g){g=document.createElementNS(NS,'g');u.parentNode.insertBefore(g,u);groups.set(id,g);g.style.transformBox='fill-box';g.style.transformOrigin='50% 50%';}
    g.appendChild(u);}
  return {svg,parts:[...groups.values()]};}
// one span a letter as the reader sees it: a letter with its marks (Thai vowels and tones, accents) stays one span, or
// each mark is drawn alone on a dotted circle
const SEG=typeof Intl!=='undefined'&&Intl.Segmenter?new Intl.Segmenter():null;
const graphemes=s=>SEG?Array.from(SEG.segment(s),g=>g.segment):Array.from(s);
// a line with marks over its letters (Thai, Vietnamese, Devanagari) gets room above each, mask and letter alike, so a
// stacked tone mark is not cut off and the letter still leaves the mask whole, and taller rows, so it clears the row above
function letters(e,text){e.textContent='';const out=[],gs=graphemes(text),tall=gs.some(g=>/\p{Mn}/u.test(g));if(tall)e.style.lineHeight=1.45;for(const ch of gs){const m=el('span',tall?'lm tall':'lm',e);const c=el('span','lc',m);c.textContent=ch===' '?' ':ch;out.push(c);}return out;}
function rise(sp,u,st,stag,dur,ease){sp.forEach((s,i)=>{const p=E[ease||'outExpo'](inv(st+i*stag,st+i*stag+dur,u));s.style.transform=`translateY(${(1-p)*108}%)`;});}
function sink(sp,u,st,stag,dur,ease){sp.forEach((s,i)=>{const p=E[ease||'inCubic'](inv(st+i*stag,st+i*stag+dur,u));if(p>0)s.style.transform=`translateY(${-p*108}%)`;});}
function vis(e,on){e.style.visibility=on?'visible':'hidden';}
// the 16:9-free fit for preview in a browser window
function fit(){const s=Math.min(innerWidth/W,innerHeight/H);stage.style.transform=`translate(${(innerWidth-W*s)/2}px,${(innerHeight-H*s)/2}px) scale(${s})`;}

/* ---------- layers ---------- */
const LB=el('div','layer',stage);       // night + aurora
LB.dataset.os='ground';                  // `film.sh read`: the stage, never content (tools/reader.js)
const LP=el('div','layer',stage);       // where the world sits: all of the frame, except in a feed post (placeWorld)
const LW=el('div','layer',LP);          // the phone world
if(WIDE&&!DESKTOP){css(LW,`width:1080px;height:1920px;transform-origin:0 0;transform:translate(${PW.x}px,${PW.y}px) scale(${PW.k})`);}
// 16:9 only: c=0 keeps the phone on the left beside the type panel, c=1 glides it to the centre for bars with no line
function wideGlide(c){if(!WIDE||DESKTOP)return;LW.style.transform=`translate(${PW.x+413*c}px,${PW.y}px) scale(${PW.k})`;}
// BOX: the world's product (a rectangle in world px: the phone's screen, the browser card) scaled into the frame
// between the kicker and the band, centred; `under`: the rectangle's bottom goes down to the band's bottom (a phone
// fades under the lines, as on 9:16), else it ends above the band (a card). Called by Phone, BrowserCard and
// ScreenCard; a film may call it itself.
function placeWorld(r,under){if(!BOX)return;
  const top=BOXL.top+56,bot=under?BOXL.bottom:BOXL.bottom-BOX_BAND-16,k=Math.min((W-80)/r.w,(bot-top)/r.h);
  const x=(W-r.w*k)/2-r.x*k,y=top+(under?0:(bot-top-r.h*k)/2)-r.y*k;WORLD_AT={k,x,y};   // a card: centred in its room
  css(LP,`width:${DESKTOP?1920:1080}px;height:${DESKTOP?1080:1920}px;transform-origin:0 0;transform:translate(${x}px,${y}px) scale(${k})`);
  // the world shows only what a 9:16 frame would (a desktop film: the card and its shadow): a zoomed screen never
  // spills over the frame's sides
  const [a,b]=DESKTOP?[r.x-50,r.x+r.w+50]:[0,1080];
  const m=`linear-gradient(to right,transparent ${a}px,#000 ${a+24}px,#000 ${b-24}px,transparent ${b}px)`;
  css(LP,`-webkit-mask-image:${m};mask-image:${m}`);}
let WORLD_AT={k:1,x:0,y:0};
const LT=el('div','layer',stage);       // type band
const LC=el('div','layer',stage);       // kicker + mark
LC.dataset.os='chrome';                  // on screen all film: never what carries one scene into the next
const LE=el('div','layer',stage);       // end card

/* ---------- aurora: slow light in the accent on the night stage ---------- */
const BLOBS=(WIDE?[
  {w:1500,h:1150,x:-420,y:-200,c:GLOW[0],a:.34,sx:70,sy:50,f:.19,p:0},
  {w:1400,h:1100,x:900,y:260,c:GLOW[1],a:.22,sx:90,sy:60,f:.15,p:2.1},
  {w:1100,h:900,x:600,y:-520,c:GLOW[2],a:.14,sx:60,sy:40,f:.23,p:4.2},
]:[
  {w:1500,h:1150,x:-260,y:40,c:GLOW[0],a:.34,sx:70,sy:50,f:.19,p:0},
  {w:1300,h:1200,x:420,y:980,c:GLOW[1],a:.24,sx:90,sy:60,f:.15,p:2.1},
  {w:1100,h:900,x:560,y:-260,c:GLOW[2],a:.14,sx:60,sy:40,f:.23,p:4.2},
]).map(b=>{b.a*=ST.glowK;b.e=el('div','blob',LB);box(b.e,0,0,b.w,b.h);b.e.style.background=`radial-gradient(closest-side,rgba(${b.c},${b.a}) 0%,rgba(${b.c},${b.a*.45}) 45%,rgba(${b.c},0) 100%)`;return b;});
function aurora(t,k){BLOBS.forEach(b=>{const x=b.x+b.sx*Math.sin(t*b.f+b.p),y=b.y+b.sy*Math.cos(t*b.f*.8+b.p);b.e.style.transform=`translate(${x}px,${y}px)`;b.e.style.opacity=k==null?1:k;});}

/* ---------- the phone ---------- */
const PH={x:66,y:276,w:948,h:2054,b:16,r:124};
const PHONE_RECT={x:PH.x,y:PH.y,w:PH.w,h:1494-PH.y};   // BOX: the phone from its top to where the 9:16 band ends
PH.sx=PH.x+PH.b;PH.sy=PH.y+PH.b;PH.sw=PH.w-2*PH.b;PH.sh=PH.h-2*PH.b;
function statusIcons(col){
  return `<svg width="150" height="34" viewBox="0 0 150 34" style="display:block"><g fill="${col}">
  <rect x="0" y="22" width="7" height="10" rx="2"/><rect x="11" y="16" width="7" height="16" rx="2"/><rect x="22" y="10" width="7" height="22" rx="2"/><rect x="33" y="4" width="7" height="28" rx="2"/>
  <path d="M68 31 L53.5 15.5 A21 21 0 0 1 82.5 15.5 Z"/>
  <rect x="98" y="5" width="44" height="24" rx="7.5" fill="none" stroke="${col}" stroke-opacity=".42" stroke-width="2.4"/><rect x="102" y="9" width="33" height="16" rx="4"/><rect x="144.5" y="13" width="4" height="8" rx="2" fill-opacity=".42"/></g></svg>`;
}
function Phone(parent,opt){
  opt=opt||{};
  const P={};
  P.wrap=el('div','layer',parent);
  P.cam=el('div','layer',P.wrap);P.cam.style.transformOrigin='0 0';
  P.body=box(el('div','phone',P.cam),PH.x,PH.y,PH.w,PH.h);
  [[-7,300,120],[-7,470,190],[-7,690,190],[PH.w+1,520,280]].forEach(([x,y,h])=>box(el('div','pbtn',P.body),x,y,6,h));
  P.screen=box(el('div','screen',P.cam),PH.sx,PH.sy,PH.sw,PH.sh);
  if(opt.clip)P.screen.style.overflow='hidden';
  P.app=el('div','layer',P.screen);
  P.sb=el('div','layer',P.screen);P.sb.style.height='120px';P.sb.style.zIndex=40;
  P.time=box(el('div','sbt',P.sb,opt.time||'07:12'),0,40,332);P.time.style.textAlign='center';
  P.icons=box(el('div','a',P.sb,statusIcons(C.ink)),PH.sw-332+91,42);
  P.island=box(el('div','island',P.sb),(PH.sw-250)/2,20,250,76);
  P.setStatus=(col)=>{P.time.style.color=col;P.icons.innerHTML=statusIcons(col);};
  P.setStatus(opt.sbColor||C.ink);
  P.lift=box(el('div','a',P.cam),PH.sx,PH.sy,PH.sw,PH.sh);P.lift.style.pointerEvents='none';
  // camera: scale s about anchor (ax,ay), then shift (dx,dy)
  P.setCam=(s,ax,ay,dx,dy,rot)=>{P.cam.style.transform=`translate(${(dx||0)+ax}px,${(dy||0)+ay}px) rotate(${rot||0}deg) scale(${s}) translate(${-ax}px,${-ay}px)`;};
  // the fade into the stage at the bottom (y0 to y1); top (0 to 1) also fades the top 360 px, so a zoomed screen
  // never runs under the kicker and the wordmark
  P.mask=(y0,y1,top)=>{const m=top?`linear-gradient(to bottom,rgba(0,0,0,${1-top}) 0px,rgba(0,0,0,${1-top}) 270px,#000 360px,#000 ${y0}px,rgba(0,0,0,0) ${y1}px)`
    :`linear-gradient(to bottom,#000 0px,#000 ${y0}px,rgba(0,0,0,0) ${y1}px)`;P.wrap.style.webkitMaskImage=m;P.wrap.style.maskImage=m;};
  P.maskDef=top=>P.mask(MASK[0],MASK[1],top);
  P.maskDef();
  placeWorld(PHONE_RECT,true);
  return P;
}

/* ---------- type band: one line per bar, left aligned, bottom anchored ---------- */
const BAND_BOTTOM=BOX?BOXL.bottom:1494;
/* ---------- the voice: what a film with a narrator says, and when (film.sh <id> voice reads it) ---------- */
// Every BandLine says its own words; Say() adds words that are on screen some other way (an end card's call to
// action). say: how to say them, if not as written; at: when the voice starts (default: 0.2 s after the words start to
// appear, tin); until: when they leave
const SPOKEN=[];window.__said=SPOKEN;
function Say(text,{say,at,tin,until}={}){SPOKEN.push({text,say,at,tin:tin==null?at:tin,until});}

function BandLine(spec){
  // spec: {rows:[...], size, eyebrow, tin, tout, keepDot}; on 16:9 also rowsW, sizeW, toutW, cyW (the line's centre y).
  // enter: 'rise' (letter by letter, the default) or 'pop' (whole words one after another, `step` s apart);
  // leave: 'sink' (the default) or 'cut' (gone on the frame of tout); at: 'band' (the default) or 'mid' (large and
  // centred on the whole frame, over the product: the type style's lines)
  // say, sayAt: in a film with a voice, what the line says (its own words by default; a respelling, or false for silence)
  const words=spec.rows.join(' ');
  const g=el('div','bandg',LT),MID=spec.at==='mid';
  // 16:9: lines of different heights share the panel's centre, so the outgoing line leaves earlier (toutW)
  if(MID){css(g,`left:${WIDE?110:72}px;width:${WIDE?1700:936}px;top:${WIDE?540:BOX?CYS-40:900}px;transform:translateY(-50%);text-align:center`);
    spec={...spec,rows:(WIDE&&spec.rowsW)||spec.rows,size:(WIDE&&spec.sizeW)||spec.size||(WIDE?150:140),tout:WIDE&&spec.toutW!=null?spec.toutW:spec.tout};}
  else if(WIDE){css(g,`left:${PANEL.x}px;width:${PANEL.w}px;top:${spec.cyW!=null?spec.cyW:PANEL.cy}px;transform:translateY(-50%)`);spec={...spec,rows:spec.rowsW||spec.rows,size:spec.sizeW||104,tout:spec.toutW!=null?spec.toutW:spec.tout};}
  else g.style.bottom=(H-BAND_BOTTOM)+'px';
  if(spec.say!==false)Say(words,{say:typeof spec.say==='string'?spec.say:null,at:spec.sayAt,tin:spec.tin,until:spec.tout});
  const L={g,spec,rows:[],eb:null};
  if(spec.eyebrow){const e=el('div','eyebrow',g);L.eb=letters(e,spec.eyebrow);}
  spec.rows.forEach(r=>{const d=el('div','bandrow',g);d.style.fontSize=(spec.size||76)+'px';L.rows.push({d,sp:letters(d,r)});});
  const last=L.rows[L.rows.length-1].sp;const lc=last[last.length-1];
  if(/[.?]/.test(lc.textContent)){lc.style.color=C.accent;lc.style.textShadow=ST.stopGlow;L.stop=lc;}
  L.all=[...(L.eb||[]),...L.rows.flatMap(r=>r.sp)];
  // the words, for 'pop': the eyebrow counts as one
  L.words=L.eb?[L.eb]:[];
  L.rows.forEach(r=>{let w=[];r.sp.forEach(s=>{if(/^\s$/.test(s.textContent)){if(w.length)L.words.push(w);w=[];}else w.push(s);});if(w.length)L.words.push(w);});
  const FITW=MID?(WIDE?1680:930):WIDE?PANEL.w-20:930;
  L.fit=()=>{let s=spec.size||76;L.rows.forEach(r=>{r.d.style.fontSize=s+'px';});const wmax=Math.max(...L.rows.map(r=>r.d.scrollWidth));if(wmax>FITW){s=Math.floor(s*FITW/wmax);L.rows.forEach(r=>{r.d.style.fontSize=s+'px';});}
    // a row too wide for its space is shrunk to fit: say so when that takes it under the legible size (film.sh check
    // prints it). 100 px on 16:9 is 56 px on 9:16 once both play at a phone's width
    const MIN=WIDE?100:56;if(s<MIN)console.warn(`film: the line "${spec.rows.join(' ')}" is set at ${s} px; headlines need ${MIN} px or more here. Break it into shorter rows${WIDE?' (rowsW)':''}.`);};
  if(WIDE&&L.eb)L.eb[0].parentNode.parentNode.style.fontSize='40px';
  const POP=spec.enter==='pop',CUT=spec.leave==='cut';
  L.render=(t)=>{
    const on=t>=spec.tin-.05&&t<spec.tout+(CUT?0:.6);vis(g,on);if(!on)return;
    const n=L.all.length;
    if(POP){const st=spec.step||Math.min(.18,.9/L.words.length);
      L.words.forEach((w,i)=>{const p=tw(t,spec.tin+i*st,.3,'outExpo'),o=p>0?Math.min(1,p*5):0;
        // at rest, no transform at all: a word left scaled by 1 is drawn a pixel differently from one never scaled
        w.forEach(s=>{s.style.transform='none';const m=s.parentNode;m.style.opacity=o;m.style.transform=p<1?`translateY(${(1-p)*.22}em) scale(${.9+.1*p})`:'none';});});}
    else rise(L.all,t,spec.tin,Math.min(.014,.22/n),.5,'outExpo');
    if(CUT)return;
    const keep=spec.keepDot&&L.stop;
    const sp=keep?L.all.filter(s=>s!==L.stop):L.all;
    sink(sp,t,spec.tout,Math.min(.007,.16/n),.24,'inCubic');
  };
  // stop position in stage px (measured once, untransformed)
  L.stopXY=()=>{const r=L.stop.getBoundingClientRect(),sr=stage.getBoundingClientRect(),k=sr.width/W;return [(r.left-sr.left)/k+r.width/k/2,(r.top-sr.top)/k+r.height/k*.74,r.width/k];};
  return L;
}

/* ---------- kicker top left (the feature's name), the wordmark top right ---------- */
// Kicker('Reports') or Kicker([{t:0,text:'Reports'},{t:6.2,text:'Alerts'}]) to change name mid-film
function Kicker(items){
  if(typeof items==='string')items=[{t:0,text:items}];
  const k=el('div','kick',LC);el('i','',k);if(WIDE)css(k,`left:60px;top:30px`);if(BOX)css(k,`left:60px;top:${BOXL.top}px`);
  const sp=items.map(it=>el('span','',k,it.text));
  const mk=el('div','a',LC,`${WORDMARK}<span style="color:${C.accent}">.</span>`);
  css(mk,`right:${WIDE||BOX?60:72}px;top:${WIDE?24:BOX?BOXL.top-6:222}px;font-family:"${FONT.mark}";font-weight:700;font-size:36px;letter-spacing:${WORDMARK_SP};line-height:42px;color:${ST.mark};white-space:nowrap`);
  return {k,mk,render(t,o){
    k.style.opacity=o;mk.style.opacity=o;
    items.forEach((it,i)=>{const nx=items[i+1];
      const pin=i===0?1:tw(t,it.t+.15,.45,'outExpo');const pout=nx?tw(t,nx.t,.14,'inCubic'):0;
      sp[i].style.transform=`translateY(${(1-pin)*40-pout*40}px)`;sp[i].style.opacity=(t>=it.t+.15||i===0)&&(!nx||t<nx.t+.14)?1:0;});
  }};
}

/* ---------- pin: a dot in the accent, a hairline, a worded chip ---------- */
function Pin(parent,{x,y,cx,cy,html,size}){
  const P={};
  P.svg=sv('svg',{width:1,height:1,style:'position:absolute;left:0;top:0;overflow:visible'},parent);
  P.line=sv('line',{x1:x,y1:y,x2:x,y2:y,stroke:C.accent,'stroke-width':3,'stroke-linecap':'round'},P.svg);
  P.ring=sv('circle',{cx:x,cy:y,r:0,fill:'none',stroke:C.accent,'stroke-width':2.5},P.svg);
  P.dot=el('div','pdot',parent);
  P.chip=el('div','chip',parent,html);
  css(P.chip,`left:${cx}px;top:${cy}px;transform-origin:50% 100%;background:#fff;color:${C.ink};border-radius:22px;padding:16px 28px 18px;font-family:"${FONT.head}";font-weight:700;font-size:${size||44}px;letter-spacing:-.02em;line-height:1.1;box-shadow:0 18px 44px rgba(11,14,20,.35),0 0 0 2px ${C.accent}`);
  P.render=(u,out)=>{ // u: local time since the pin starts
    const o=1-clamp(out||0);
    const d=tw(u,0,.32,'outBack');const R=12;
    P.dot.style.width=P.dot.style.height=2*R+'px';P.dot.style.transform=`translate(${x-R}px,${y-R}px) scale(${d})`;P.dot.style.opacity=o*(u>0?1:0);
    P.dot.style.boxShadow=`0 0 0 5px rgba(255,255,255,.95),0 0 22px rgba(${C.accentRGB},.7)`;
    const rp=tw(u,.05,.6,'outExpo');P.ring.setAttribute('r',lerp(12,60,rp));P.ring.setAttribute('opacity',u>0?(1-rp)*.7*o:0);
    const lp=tw(u,.18,.34,'outCubic');const yb=cy+P.chip.offsetHeight;
    P.line.setAttribute('y2',lerp(y,yb,lp));P.line.setAttribute('opacity',u>.18?o:0);
    const cp=tw(u,.36,.45,'outBack');P.chip.style.opacity=clamp((u-.36)/.12)*o;P.chip.style.transform=`scale(${lerp(.7,1,cp)})`;
  };
  return P;
}

/* ---------- digit roller ---------- */
function Roller(parent,{digits,size,color,lh}){
  const h=Math.round(size*(lh||1.08));
  const R={el:el('span','',parent),cols:[]};
  css(R.el,`display:inline-flex;font-family:"${FONT.head}";font-weight:700;font-size:${size}px;line-height:${h}px;height:${h}px;color:${color};font-variant-numeric:tabular-nums;letter-spacing:-.01em;vertical-align:top`);
  for(let i=0;i<digits;i++){const c=el('span','',R.el);css(c,`display:inline-block;overflow:hidden;height:${h}px`);
    const s=el('span','',c,[0,1,2,3,4,5,6,7,8,9,0].map(n=>`<b style="display:block;height:${h}px;font-weight:700">${n}</b>`).join(''));s.style.display='block';R.cols.push(s);}
  R.set=v=>{v.forEach((x,i)=>{const vv=((x%10)+10)%10;R.cols[i].style.transform=`translateY(${-vv*h}px)`;});};
  // roll from digits a to digits b, each wheel landing at its own time, extra full turns on the right
  R.roll=(a,b,u,lands,turns)=>{R.set(a.map((d,i)=>{const steps=((b[i]-d)+10)%10+10*(turns?turns[i]:0);return d+steps*E.outCubic(clamp(u/lands[i]));}));};
  // a real odometer from a to b (whole numbers, a<b), p the eased progress 0..1: the ones wheel turns continuously and
  // every higher wheel turns only while the wheel below it carries, so no frame ever reads above the landing value
  R.odometer=(a,b,p)=>{const v=lerp(a,b,clamp(p)),n=R.cols.length;
    R.set(Array.from({length:n},(_,i)=>{const m=Math.pow(10,n-1-i);if(m===1)return v;
      return Math.floor(v/m)+clamp((v%m)-(m-1));}));};
  return R;
}

/* ---------- end card: the line's full stop flies into the wordmark and becomes its dot, a chip, the call to action ---------- */
// EndCard({chip, cta, small}): each may be left out (a film can close on the wordmark alone); small is a quiet line under the CTA.
// EC.render(u, from, B): u is the time since the end card starts, from the [x,y,r] the dot flies from (the promise line's
// full stop, L.stopXY()), B the beat length. The wordmark is measured the first time the card shows (a hidden layer measures 0).
function EndCard({chip:chipText,cta,small}={}){
  const EC={};
  const EY=WIDE?{logo:250,chip:540,cta:650}:{logo:640,chip:915,cta:1030};
  if(BOX)for(const k in EY)EY[k]+=(H-1920)/2;   // a feed post: the 9:16 card, centred the same way
  const WM=WIDE?196:184,DR=Math.round(WM*.105),GAP=Math.round(WM*WORDMARK_GAP);   // the gap also absorbs the tight letter spacing
  const g=el('div','a',LE);
  css(g,`left:0;top:${EY.logo}px;width:${W}px;text-align:center;font-family:"${FONT.mark}";font-weight:700;font-size:${WM}px;letter-spacing:${WORDMARK_SP};line-height:1.15;color:${ST.text};white-space:nowrap;transform-origin:50% 60%`);
  const sp=letters(g,WORDMARK);
  const stopS=el('span','',g);css(stopS,`display:inline-block;width:${GAP+2*DR}px;height:0;vertical-align:baseline`);   // room for the dot, on the baseline
  const dot=el('div','pdot',LE);
  const ov=sv('svg',{width:W,height:H,style:'position:absolute;left:0;top:0;overflow:visible'},LE);
  const rip=sv('circle',{cx:0,cy:0,r:0,fill:'none',stroke:ST.ripple,'stroke-width':2.5},ov);
  const fdot=el('div','pdot',LE);fdot.style.boxShadow=`0 0 26px rgba(${C.accentRGB},.85)`;
  const chipE=el('div','chip',LE,chipText||'');if(!chipText)chipE.style.display='none';
  css(chipE,`left:0;top:0;font-family:"${FONT.head}";font-weight:700;font-size:30px;letter-spacing:.2em;color:${ST.chipText};padding:14px 26px 14px 32px;border-radius:40px;border:2px solid ${ST.chipLine};background:${ST.chipBg}`);
  const ctaE=el('div','a',LE,cta||'');css(ctaE,`left:0;width:${W}px;top:${EY.cta}px;text-align:center;font-family:"${FONT.body}";font-weight:500;font-size:54px;letter-spacing:-.015em;color:${ST.text}`);
  const smallE=el('div','a',LE,small||'');css(smallE,`left:0;width:${W}px;top:${EY.cta+84}px;text-align:center;font-family:"${FONT.body}";font-weight:500;font-size:${WIDE?26:30}px;color:${ST.quiet}`);
  let TX=CXS,TY=EY.logo+WM,measured=false;
  EC.measure=()=>{const d=LE.style.display;LE.style.display='block';g.style.transform='none';
    const r=stopS.getBoundingClientRect(),sr=stage.getBoundingClientRect(),k=sr.width/W;
    TX=(r.left-sr.left)/k+GAP+DR;TY=(r.top-sr.top)/k-DR;LE.style.display=d;measured=true;};
  EC.T={land:0};
  EC.render=(u,from,b)=>{
    const on=u>=0;LE.style.display=on?'block':'none';if(!on)return;
    if(!measured)EC.measure();
    const Bt=b||B,land=.75*Bt;EC.T.land=land;
    const f=E.inOutCubic(inv(0,land,u));
    if(u<land){const x=lerp(from[0],TX,f),y=lerp(from[1],TY,f)-120*Math.sin(Math.PI*f),r=lerp(from[2],DR,f);
      fdot.style.display='block';fdot.style.width=fdot.style.height=2*r+'px';fdot.style.transform=`translate(${x-r}px,${y-r}px)`;dot.style.opacity=0;}
    else{fdot.style.display='none';const s=lerp(1.3,1,E.outBack(inv(land,land+.22,u)));
      dot.style.opacity=1;dot.style.width=dot.style.height=2*DR+'px';dot.style.transform=`translate(${TX-DR}px,${TY-DR}px) scale(${s})`;
      dot.style.boxShadow=`0 0 ${lerp(30,10,inv(land,land+.8,u))}px rgba(${C.accentRGB},.8)`;}
    const rp=tw(u,land,.7,'outExpo');rip.setAttribute('cx',TX);rip.setAttribute('cy',TY);rip.setAttribute('r',lerp(DR,170,rp));rip.setAttribute('opacity',u>=land?(1-rp)*.7:0);
    // the word rises while the dot is in flight, so the dot lands as the full stop of a word already there
    sp.forEach((s,i)=>{const st=.05+i*.035;s.style.transform=`translateY(${(1-E.outExpo(inv(st,st+.5,u)))*108}%)`;});
    const cp=tw(u,.5*Bt,.5,'outExpo');chipE.style.opacity=cp;chipE.style.transform=`translate(${CXS-chipE.offsetWidth/2}px,${EY.chip+(1-cp)*22}px)`;
    const tp=tw(u,.62*Bt,.5,'outExpo');ctaE.style.opacity=tp;ctaE.style.transform=`translateY(${(1-tp)*22}px)`;
    const sq=tw(u,.8*Bt,.55,'outExpo');smallE.style.opacity=sq;smallE.style.transform=`translateY(${(1-sq)*16}px)`;
    g.style.transform=`scale(${1+.02*inv(land,land+2,u)})`;
  };
  return EC;
}

/* ---------- boot: fonts, fit, seek interface ---------- */
function boot(DUR,film,after){
  const render=t=>{TL.seek(t,false);film(t);};   // the timeline's tweens first, then render(t) over them
  window.__seek=t=>{render(t);return true;};
  window.__DUR=DUR;window.__FPS=60;
  // what `film.sh read` needs to know about the film: its tempo, and the hard cuts it means (Cut adds the punch style's)
  window.__os=Object.assign({cuts:[]},window.__os||{},{dur:DUR,bpm:typeof BPM!=='undefined'?BPM:null});
  Promise.all([
    document.fonts.load(`700 100px "${FONT.head}"`),document.fonts.load(`500 100px "${FONT.head}"`),document.fonts.load(`700 100px "${FONT.mark}"`),
    document.fonts.load(`400 40px "${FONT.body}"`),document.fonts.load(`500 40px "${FONT.body}"`),document.fonts.load(`600 40px "${FONT.body}"`),document.fonts.load(`700 40px "${FONT.body}"`)
  ]).then(()=>document.fonts.ready).then(()=>{
    const prev=stage.style.transform;stage.style.transform='none';
    render(0);
    (window.__osFlights||[]).forEach(f=>f.measure(render));   // moves.js: each shared element's two ends, measured once
    if(after)after();render(0);
    stage.style.transform=prev;
    // HyperFrames renders the film by seeking one paused timeline, the film's length, that calls render(t). Its
    // shutter takes several times around each frame's own (a quarter frame either side); one on the far side of a
    // declared cut is held on the frame's side of it, so a cut is never blurred into a dissolve
    if(HF){const P={t:0},cuts=window.__os.cuts,tl=gsap.timeline({paused:true});
      const at=t=>{const T=Math.round(t*60)/60;
        for(const c of cuts){if(T<c&&t>=c)return c-1e-4;if(T>=c&&t<c)return c;}return t;};
      tl.to(P,{t:DUR,duration:DUR,ease:'none',onUpdate:()=>render(at(P.t))});window.__timelines.film=tl;}
    if(CAPTURE){window.__ready=true;const t=parseFloat(Q.get('t')||'0');render(t);return;}
    //PLAYER{  the film playing on its own in a browser; tools/hf.cjs leaves this out of a HyperFrames composition
    fit();addEventListener('resize',fit);
    let t0=performance.now(),paused=false,tp=0;
    const qt=parseFloat(Q.get('t'));if(!isNaN(qt)){paused=true;tp=qt;}
    function frame(now){const t=paused?tp:((now-t0)/1000)%DUR;render(t);if(!paused)tp=t;requestAnimationFrame(frame);}
    requestAnimationFrame(frame);
    addEventListener('keydown',e=>{if(e.code==='Space'){paused=!paused;if(!paused)t0=performance.now()-tp*1000;}
      if(e.code==='ArrowRight'){paused=true;tp=Math.min(DUR-1e-3,tp+1/60);}if(e.code==='ArrowLeft'){paused=true;tp=Math.max(0,tp-1/60);}});
    stage.addEventListener('click',()=>{paused=!paused;if(!paused)t0=performance.now()-tp*1000;});
    // studio.html drives the film from its soundtrack: {seek:t} holds the film on that time
    addEventListener('message',e=>{const d=e.data||{};if(typeof d.seek==='number'){paused=true;tp=clamp(d.seek,0,DUR-1e-3);}});
    //}PLAYER
  });
}
