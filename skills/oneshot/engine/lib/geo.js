/* A world map with hairline arcs (routes, flows, where users are). A film inlines the map and includes this file:
     const WORLD=/*INLINE data/countries-110m.json*\/null;   (build.cjs pastes the engine's map in)
     //INCLUDE geo.js
   then  const M=WorldMap(parent,WORLD,{x,y,w,h,lon:[-130,160],lat:[-50,72]});
   M.project(lon,lat) gives stage pixels, M.arc(from,to,bend) a hairline path's d, M.country(name) its path.
   Equirectangular inside the window; rings that cross the date line are split, not smeared. */
function WorldMap(parent,topo,o){
  const {x,y,w,h}=o,L=o.lon||[-180,180],A=o.lat||[-58,84];
  const {scale:[kx,ky],translate:[tx,ty]}=topo.transform;
  const arcs=topo.arcs.map(a=>{let px=0,py=0;return a.map(([qx,qy])=>{px+=qx;py+=qy;return [px*kx+tx,py*ky+ty];});});
  const project=(lon,lat)=>[x+(lon-L[0])/(L[1]-L[0])*w,y+(A[1]-lat)/(A[1]-A[0])*h];
  const ring=r=>{const pts=[];r.forEach(i=>{const a=i>=0?arcs[i]:arcs[~i].slice().reverse();a.forEach((p,j)=>{if(j||!pts.length)pts.push(p);});});return pts;};
  const d=rs=>rs.map(r=>{let s='',prev=null;ring(r).forEach(p=>{const q=project(p[0],p[1]);s+=(!prev||Math.abs(p[0]-prev[0])>180?'M':'L')+q[0].toFixed(1)+','+q[1].toFixed(1);prev=p;});return s+'Z';}).join('');
  const svg=sv('svg',{width:W,height:H,viewBox:`0 0 ${W} ${H}`,style:'position:absolute;left:0;top:0;overflow:visible'},parent);
  const g=sv('g',{},svg),byName={};
  topo.objects.countries.geometries.forEach(c=>{
    const polys=c.type==='Polygon'?[c.arcs]:c.type==='MultiPolygon'?c.arcs:[];if(!polys.length)return;
    const p=sv('path',{d:polys.map(d).join(''),fill:o.fill||'#1B2230',stroke:o.stroke||'#2A3345','stroke-width':o.strokeWidth||.8},g);
    byName[(c.properties&&c.properties.name)||c.id]=p;});
  return {svg,g,project,country:n=>byName[n],
    // a hairline flight arc from [lon,lat] to [lon,lat], bowed by bend (0.2 is gentle)
    arc:(a,b,bend)=>{const p=project(a[0],a[1]),q=project(b[0],b[1]),mx=(p[0]+q[0])/2,my=(p[1]+q[1])/2,dx=q[0]-p[0],dy=q[1]-p[1],k=bend==null?.2:bend;
      return `M${p[0]},${p[1]} Q${mx-dy*k},${my+dx*k} ${q[0]},${q[1]}`;}};
}
