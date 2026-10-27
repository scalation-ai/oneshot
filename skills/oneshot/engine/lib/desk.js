/* Desktop 16:9 films. The product in a card on the left (about 60%): a web app in a white browser card
   (BrowserCard: three dots, a URL bar with the product's own address, a camera inside the page), or a native app on its computer's
   screen (ScreenCard, with MenuBar and AppWindow). A text panel on the right: the kicker (top left of the
   frame), the headline (a BandLine, which sits in PANEL when FILM_FORMAT is 'desktop'), and numbered
   points that match the pins. A desktop film declares `const FILM_FORMAT='desktop';` before its //INCLUDE lines. */
const DK={x:84,y:150,w:1080,h:780,bar:58};               // the card on the 1920 x 1080 stage
// url: the address shown in the bar, as the real product shows it (e.g. 'app.yourproduct.com/reports')
function BrowserCard(parent,{url}){
  const D={};
  D.cam=el('div','layer',parent);D.cam.style.transformOrigin='0 0';
  D.card=box(el('div','a',D.cam),DK.x,DK.y,DK.w,DK.h);
  css(D.card,`background:#fff;border-radius:16px;overflow:hidden;box-shadow:${ST.cardShadow}`);
  const bar=box(el('div','a',D.card),0,0,DK.w,DK.bar);css(bar,`background:#F3F4F6;box-shadow:inset 0 -1px 0 #E5E7EB`);
  [24,46,68].forEach(x=>css(box(el('i','a',bar),x,23,12,12),`border-radius:50%;background:#D1D5DB`));
  D.url=box(el('div','a',bar,url||''),104,13,560,32);
  css(D.url,`border-radius:16px;background:#fff;box-shadow:inset 0 0 0 1px #E5E7EB;font-family:"${FONT.body}";font-weight:500;font-size:17px;line-height:32px;padding-left:18px;color:#6B7280;white-space:nowrap`);
  // the rebuilt page goes in D.app (page coordinates: 1080 wide, from under the bar)
  D.vp=box(el('div','a',D.card),0,DK.bar,DK.w,DK.h-DK.bar);D.vp.style.overflow='hidden';
  D.app=box(el('div','a',D.vp),0,0,DK.w,DK.h-DK.bar);D.app.style.transformOrigin='0 0';
  // camera inside the page, the bar staying put: D.view(l,t,w) shows the rectangle of the page w px wide whose top
  // left is (l,t), the viewport's shape (as ScreenCard's S.view)
  D.view=(l,t,w)=>{const k=DK.w/w;D.app.style.transform=`scale(${k}) translate(${-l}px,${-t}px)`;};
  // camera on the whole card: scale s about stage point (ax,ay), then shift
  D.setCam=(s,ax,ay,dx,dy)=>{D.cam.style.transform=`translate(${(dx||0)+ax}px,${(dy||0)+ay}px) scale(${s}) translate(${-ax}px,${-ay}px)`;};
  placeWorld({x:DK.x,y:DK.y,w:DK.w,h:DK.h});
  return D;
}
/* A native desktop app (a Mac app, not a web page): the computer's screen is the card, and a camera chooses the
   rectangle of it the card shows, so an app's small panels and notices can fill the frame. Build everything in
   S.scr in the screen's own points (1440 x 900 by default, a 16:10 laptop), matched to a capture at that size.
   S.view(l,t,w): the card shows the rectangle w points wide whose top left is (l,t) (the screen's shape).
   S.shot(a,b,p): the view between shots a and b ({l,t,w}) at eased progress p, a zoom about the one point the two
   rectangles share, so every edge moves one way and nothing crosses the frame; equal widths are a pan.
   S.setCam(...) moves the whole card on the stage, as BrowserCard's does. No wallpaper of the computer's maker:
   `wall` is any CSS background, a soft neutral one by default. The interface face is the system's (SYS), which
   cannot be bundled: render a Mac app's films on a Mac.                                                          */
const SYS='-apple-system,BlinkMacSystemFont,"Helvetica Neue",Helvetica,Arial,sans-serif';
function ScreenCard(parent,{sw,sh,wall}={}){
  sw=sw||1440;sh=sh||900;
  const S={sw,sh,w:DK.w,h:Math.round(DK.w*sh/sw)};S.x=DK.x;S.y=Math.round((1080-S.h)/2);   // on the 1920 x 1080 world, whatever the frame
  S.cam=el('div','layer',parent);S.cam.style.transformOrigin='0 0';
  S.card=box(el('div','a',S.cam),S.x,S.y,S.w,S.h);
  css(S.card,`border-radius:16px;overflow:hidden;background:#20242E;box-shadow:${ST.cardShadow}`);
  S.scr=box(el('div','a',S.card),0,0,sw,sh);
  css(S.scr,`transform-origin:0 0;overflow:hidden;font-family:${SYS};color:#1D1D1F;-webkit-font-smoothing:antialiased;background:${wall||
    `radial-gradient(70% 60% at 18% 12%,rgba(${C.accentRGB},.30),transparent 70%),radial-gradient(60% 55% at 85% 95%,rgba(${GLOW[1]},.22),transparent 70%),linear-gradient(160deg,#A7AEC2 0%,#7D869E 100%)`}`);
  S.view=(l,t,w)=>{const k=S.w/w;S.scr.style.transform=`scale(${k}) translate(${-l}px,${-t}px)`;};
  S.shot=(a,b,p)=>{if(Math.abs(a.w-b.w)<1e-6)return {l:lerp(a.l,b.l,p),t:lerp(a.t,b.t,p),w:a.w};
    const w=a.w*Math.pow(b.w/a.w,p),k=w/a.w,px=(a.l*b.w-b.l*a.w)/(b.w-a.w),py=(a.t*b.w-b.t*a.w)/(b.w-a.w);
    return {l:px+(a.l-px)*k,t:py+(a.t-py)*k,w};};
  S.setCam=(s,ax,ay,dx,dy)=>{S.cam.style.transform=`translate(${(dx||0)+ax}px,${(dy||0)+ay}px) scale(${s}) translate(${-ax}px,${-ay}px)`;};
  S.view(0,0,sw);
  placeWorld({x:S.x,y:S.y,w:S.w,h:S.h});
  return S;
}
// The menu bar across the top of the screen: the app in front and its menus on the left, status items (html, the
// product's own menu-bar icon among them) and the clock on the right. No maker's logo: it is not ours to draw.
// M.clock is the clock's element: set its text from t (a clock that must roll is a Roller of its own).
function MenuBar(S,{app,menus,items,time,dark}={}){
  const M={bar:box(el('div','a',S.scr),0,0,S.sw,28)};
  css(M.bar,`z-index:40;display:flex;align-items:center;gap:20px;padding:0 16px;font-size:13px;letter-spacing:-.005em;white-space:nowrap;
    color:${dark?'#1D1D1F':'#fff'};background:${dark?'rgba(255,255,255,.55)':'rgba(20,24,34,.22)'};box-shadow:inset 0 -1px 0 rgba(0,0,0,.06)`);
  if(app)el('span','',M.bar,app).style.fontWeight='700';
  (menus||[]).forEach(m=>el('span','',M.bar,m));
  el('div','',M.bar).style.flex='1';
  M.items=(items||[]).map(h=>{const s=el('span','',M.bar,h);css(s,'display:flex;align-items:center');return s;});
  M.clock=el('span','',M.bar,time||'');M.clock.style.fontVariantNumeric='tabular-nums';
  return M;
}
// A window of the app: title bar with the three window buttons, a title, the content in Wn.app (window points,
// under the title bar). bar: the title bar's height (a toolbar window is taller); dark for a dark-mode app.
function AppWindow(S,{x,y,w,h,title,bar,dark}={}){
  const bh=bar||38,Wn={bar:bh};
  Wn.win=box(el('div','a',S.scr),x,y,w,h);
  css(Wn.win,`border-radius:12px;overflow:hidden;background:${dark?'#1E1E20':'#FFFFFF'};box-shadow:0 24px 70px rgba(0,0,0,.35),0 0 0 .5px rgba(0,0,0,.25)${dark?',inset 0 0 0 .5px rgba(255,255,255,.12)':''}`);
  Wn.head=box(el('div','a',Wn.win),0,0,w,bh);
  css(Wn.head,`background:${dark?'#2A2A2D':'#F4F4F6'};box-shadow:inset 0 -1px 0 ${dark?'rgba(255,255,255,.07)':'rgba(0,0,0,.08)'}`);
  ['#FF5F57','#FEBC2E','#28C840'].forEach((c,i)=>css(box(el('i','a',Wn.head),14+i*20,bh/2-6,12,12),`border-radius:50%;background:${c};box-shadow:inset 0 0 0 .5px rgba(0,0,0,.18)`));
  if(title)css(box(el('div','a',Wn.head,title),0,0,w,bh),`text-align:center;line-height:${bh}px;font-size:13px;font-weight:600;color:${dark?'#E5E5E7':'#3A3A3C'}`);
  Wn.app=box(el('div','a',Wn.win),0,bh,w,h-bh);
  return Wn;
}
// Numbered points on the right, under the headline; point i lights up while its pin is on screen. A feed post (1:1,
// 4:5) has no panel for them: they stay hidden there, and the pins carry the words.
function Points(items,{x,y,w}={}){
  x=x||PANEL.x;y=y||560;w=w||PANEL.w;
  const root=box(el('div','a',LT),x,y,w);if(BOX)root.style.display='none';
  const rows=items.map((t,i)=>{
    const r=el('div','',root);css(r,`display:flex;gap:18px;align-items:flex-start;margin-bottom:26px;opacity:0`);
    const n=el('span','',r,String(i+1));css(n,`flex:none;width:44px;height:44px;border-radius:50%;box-shadow:inset 0 0 0 2px ${ST.ptRing};color:${ST.ptNum};font-family:"${FONT.head}";font-weight:700;font-size:22px;line-height:44px;text-align:center`);
    const tx=el('span','',r,t);css(tx,`font-family:"${FONT.body}";font-weight:500;font-size:30px;line-height:1.3;color:${ST.ptRow};padding-top:4px`);
    return {r,n,tx};});
  return {root,rows,render(t,tin,active){
    rows.forEach((o,i)=>{const p=tw(t,tin+i*.12,.5,'outExpo');o.r.style.opacity=p;o.r.style.transform=`translateY(${(1-p)*20}px)`;
      const on=i===active;o.n.style.background=on?C.accent:'transparent';o.n.style.boxShadow=on?`0 0 18px rgba(${C.accentRGB},.7)`:`inset 0 0 0 2px ${ST.ptRing}`;o.n.style.color=on?'#fff':ST.ptNum;o.tx.style.color=on?ST.ptOn:ST.ptOff;});
  }};
}
