// Nyhetskloden: core.js (lastes i rekkefølge fra index.html, deler globale navn med de andre filene)
const CATS={
  krim:{n:'Krim og ulykker',c:'#ef5155'},forsvar:{n:'Krig og sikkerhet',c:'#4f8ef7'},
  politikk:{n:'Politikk',c:'#e0a526'},marked:{n:'Marked og økonomi',c:'#22c55e'},
  teknologi:{n:'Teknologi og KI',c:'#38bdf8'},helse:{n:'Helse',c:'#fb7185'},
  vitenskap:{n:'Vitenskap og romfart',c:'#a3e635'},energi:{n:'Energi og klima',c:'#facc15'},
  vaer:{n:'Natur og vær',c:'#14b8a6'},samferdsel:{n:'Samferdsel',c:'#9b6bff'},
  kultur:{n:'Kultur',c:'#e879f9'},kongehus:{n:'Kongehus',c:'#d946a8'},
  sport:{n:'Sport',c:'#f97316'},annet:{n:'Annet',c:'#7c8a9c'}
};
const ICON={
  krim:'M12 3.5 21.5 20h-19Z M12 9.5v4.5 M12 17v.5',
  politikk:'M3 9 12 4l9 5 M5.5 10.5v7 M10 10.5v7 M14 10.5v7 M18.5 10.5v7 M3 20h18',
  forsvar:'M12 3 20 6v5.5c0 4.5-3.3 8-8 9.5-4.7-1.5-8-5-8-9.5V6Z',
  marked:'M4 19.5h16 M5 15.5l4.5-4.5 3 3L18 8.5 M14.5 8.5H18V12',
  teknologi:'M7.5 7.5h9v9h-9Z M10.5 10.5h3v3h-3Z M10 4.5v3 M14 4.5v3 M10 16.5v3 M14 16.5v3 M4.5 10h3 M4.5 14h3 M16.5 10h3 M16.5 14h3',
  helse:'M10 4.5h4v5.5h5.5v4H14v5.5h-4V14H4.5v-4H10Z',
  vitenskap:'M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10Z M3.5 16c2.8 1.8 12.5-.8 17-7',
  energi:'M13.5 3 5.5 13.5h6L10.5 21l8-10.5h-6Z',
  vaer:'M10 4.5a2 2 0 0 1 4 0v9.2a4.2 4.2 0 1 1-4 0Z M12 9v7',
  samferdsel:'M8 3.5h8a2.5 2.5 0 0 1 2.5 2.5v8.5A2.5 2.5 0 0 1 16 17H8a2.5 2.5 0 0 1-2.5-2.5V6A2.5 2.5 0 0 1 8 3.5Z M5.5 10.5h13 M9 21l1.5-4 M15 21l-1.5-4',
  kultur:'M9.5 17.5V6l9.5-2v11.5 M9.5 17.5a2.5 2.5 0 1 1-5 0a2.5 2.5 0 1 1 5 0Z M19 15.5a2.5 2.5 0 1 1-5 0a2.5 2.5 0 1 1 5 0Z',
  kongehus:'M4 18 3 7.5l5 3.5 4-6 4 6 5-3.5L20 18Z',
  sport:'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17Z M12 7.5 15.8 10.3 14.4 14.8H9.6L8.2 10.3Z',
  annet:'M5 5h14v14H5Z M8 9h8 M8 12h8 M8 15h5'
};
const ALERT_COL={yellow:'#facc15',orange:'#fb923c',red:'#ef4444'};
const NOR_BOUNDS=[[4.3,57.8],[31.3,71.3]];
const $=id=>document.getElementById(id);
const tfmt=new Intl.DateTimeFormat('nb-NO',{hour:'2-digit',minute:'2-digit'});
const dfmt=new Intl.DateTimeFormat('nb-NO',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ms=d=>new Date(d).getTime();

let NEWS=[],EVENTS=[],meta={},CMETA={},A2ID={},COUNTRIES=null,BOUNDS=[],ALERTS={type:'FeatureCollection',features:[]},ready=false,STATUS={};
const KEYS=Object.keys(CATS);
let OFF=new Set(),HOME=null,F={},SET={},MKT=null,WX=null;
const act=()=>KEYS.filter(k=>!OFF.has(k)),allOn=()=>act().every(k=>S.cats.has(k));
const catOn=k=>S.cats.has(k)&&!OFF.has(k);
function distKm(a,b){const r=Math.PI/180,dLat=(b.lat-a.lat)*r,dLon=(b.lon-a.lon)*r;const h=Math.sin(dLat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dLon/2)**2;return 12742*Math.asin(Math.sqrt(h))}
const nearMe=e=>!!HOME&&e.lat!=null&&distKm(HOME,e)<=(SET.nearKm||50);
const S={cats:new Set(store.get('nk-cats',KEYS)),period:String(store.get('nk-period','24')),scope:store.get('nk-scope','all'),sel:null,cc:null,q:'',
  base:store.get('nk-base','sat'),tab:'all',tl:null,layers:store.get('nk-layers',{heat:true,arcs:true,alerts:true,night:true})};
if(S.period==='all')S.period='168';
const READ=new Set(store.get('nk-read',[])),SAVED=new Map(store.get('nk-saved',[]).map(s=>[s.id,s]));
const saveRead=()=>store.set('nk-read',[...READ].slice(-3000));
// lagrede saker sendes også til motoren, så den kan varsle om ny utvikling
const saveSaved=()=>{store.set('nk-saved',[...SAVED.values()]);if(!IS_LAN)try{postSet({followEids:[...SAVED.keys()].slice(-100)},true)}catch(e){}};
const SHORT={PS:'Palestina',US:'USA',GB:'Storbritannia',RU:'Russland',KR:'Sør-Korea',KP:'Nord-Korea',CD:'DR Kongo',CG:'Kongo',IR:'Iran',SY:'Syria',VE:'Venezuela',BO:'Bolivia',TZ:'Tanzania',MD:'Moldova',VN:'Vietnam',LA:'Laos',TW:'Taiwan',CZ:'Tsjekkia'};
const cname=a2=>SHORT[a2]||(CMETA[A2ID[a2]]||{}).nb||a2;
const REF=()=>S.tl??Date.now();
const age=e=>(REF()-ms(e.date))/6e4;            // minutter siden hendelsen startet
const fresh=e=>S.tl==null?(Date.now()-ms(e.last))/6e4<=60:(age(e)>=0&&age(e)<=60);
const when=e=>{const m=(Date.now()-ms(e.last||e.date))/6e4;return m<1?'nå':m<60?Math.round(m)+' min siden':m<1440?'kl. '+tfmt.format(new Date(e.last||e.date)):dfmt.format(new Date(e.last||e.date))};

// ---------- land ----------
function inRing(p,r){let c=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const[xi,yi]=r[i],[xj,yj]=r[j];if((yi>p[1])!==(yj>p[1])&&p[0]<(xj-xi)*(p[1]-yi)/(yj-yi)+xi)c=!c}return c}
function inPoly(p,poly){if(!inRing(p,poly[0]))return false;for(let k=1;k<poly.length;k++)if(inRing(p,poly[k]))return false;return true}
function countryAt(lon,lat){for(const b of BOUNDS){if(lon<b.bb[0]||lon>b.bb[2]||lat<b.bb[1]||lat>b.bb[3])continue;
  const g=b.f.geometry,ps=g.type==='Polygon'?[g.coordinates]:g.coordinates;if(ps.some(p=>inPoly([lon,lat],p)))return b.a2}return null}
const ccOf=e=>e.cc?e.cc:(e.lat!=null&&BOUNDS.length?(e.cc=countryAt(e.lon,e.lat)||''):'');
const centroid=a2=>{const m=CMETA[A2ID[a2]];return m?[m.lon,m.lat]:null};

// ---------- hendelser ----------
// skjulte kilder og ord (Innstillinger → Skjult)
let MUTE_RE=null;
function muteSetup(){const w=SET.muteWords||[];MUTE_RE=w.length?new RegExp('(?<![\\p{L}])('+w.map(reEsc).join('|')+')','iu'):null}
const mutedItem=n=>(SET.hiddenSrc||[]).includes(n.src)||(MUTE_RE&&MUTE_RE.test(n.title+' '+(n.titleNo||'')+' '+(n.text||'')));
function buildEvents(){
  const g=new Map();
  for(const n of NEWS){if(mutedItem(n))continue;const k=n.eid||n.id;if(!g.has(k))g.set(k,[]);g.get(k).push(n)}
  EVENTS=[...g].map(([id,it])=>{
    it.sort((a,b)=>ms(a.date)-ms(b.date));
    const srcs=[...new Set(it.map(n=>n.src))];
    const prim=it.find(n=>n.lang==='no'&&n.top)||it.find(n=>n.lang==='no')||it.find(n=>n.titleNo)||it.find(n=>n.top)||it[0];
    const geo=it.find(n=>n.exact)||it.find(n=>n.lat!=null&&!n.approx)||it.find(n=>n.lat!=null);
    const cc={};for(const n of it)if(n.cat!=='annet')cc[n.cat]=(cc[n.cat]||0)+1;
    const cat=Object.entries(cc).sort((a,b)=>b[1]-a[1])[0]?.[0]||prim.cat||'annet';
    const top=it.some(n=>n.top),sev=Math.max(...it.map(n=>n.sev||0));
    const translated=prim.lang!=='no'&&prim.titleNo;
    return{id,items:it,title:translated?prim.titleNo:prim.title,orig:translated?prim.title:null,text:prim.text,url:prim.url,src:prim.src,srcs,
      date:it[0].date,last:it[it.length-1].date,cat:CATS[cat]?cat:'annet',top,sev,score:+(sev+(srcs.length-1)*1.5+(top?2:0)).toFixed(1),
      lat:geo?geo.lat:null,lon:geo?geo.lon:null,place:geo?geo.place:prim.place,approx:geo&&geo.approx,cc:geo?geo.cc:null,exact:geo&&geo.exact,
      ccs:[...new Set(it.flatMap(n=>n.ccs||[]))],watch:[...new Set(it.flatMap(n=>n.watch||[]))],src0:prim.src}});
  EVENTS.sort((a,b)=>ms(b.last)-ms(a.last));
}
function inScope(e){if(S.scope==='all')return true;const no=ccOf(e)==='NO'||(e.lat==null&&/^(NRK|VG|Aftenposten|Dagbladet|E24)/.test(e.src||''));return S.scope==='no'?no:!no&&e.lat!=null}
function base(){const q=S.q.toLowerCase(),P=+S.period*60;
  return EVENTS.filter(e=>{const a=age(e);return a>=0&&a<=P&&inScope(e)&&(S.tab!=='watch'||e.watch.length)&&(S.tab!=='near'||nearMe(e))&&
    inSrcList(e)&&(!q||e.items.some(n=>qHit(n,q)))})}
// søk: eksakt treff først, ellers tåler det skrivefeil, bøyninger og andre stavemåter (Kharkov → Kharkiv)
const qHay=n=>n._hay||(n._hay=(n.title+' '+(n.titleNo||'')+' '+(n.text||'')+' '+(n.place||'')+' '+(n.src||'')).toLowerCase());
const qHit=(n,q)=>qHay(n).includes(q)||FUZZY.match(q,n._fz||(n._fz=FUZZY.prep(qHay(n))));
const shown=()=>base().filter(e=>catOn(e.cat)&&(!S.cc||ccOf(e)===S.cc||e.ccs.includes(S.cc)));
const view=()=>{const ev=shown();return S.tab==='top'?[...ev].sort((a,b)=>b.score-a.score||ms(b.last)-ms(a.last)).slice(0,25):ev};
const size=e=>e.score>=7?'x':(e.score>=3.5||e.top)?'t':'n';

// ---------- dag/natt ----------
function sun(date){const rad=Math.PI/180,d=(date-Date.UTC(2000,0,1,12))/864e5,g=(357.529+.98560028*d)*rad,q=280.459+.98564736*d,
  L=(q+1.915*Math.sin(g)+.02*Math.sin(2*g))*rad,e=(23.439-3.6e-7*d)*rad,ra=Math.atan2(Math.cos(e)*Math.sin(L),Math.cos(L)),dec=Math.asin(Math.sin(e)*Math.sin(L)),
  gmst=((18.697374558+24.06570982441908*d)%24+24)%24;let lon=(ra/rad/15-gmst)*15;lon=((lon+540)%360)-180;return{lon,dec}}
function nightBands(t){
  const s=sun(t||Date.now()),rad=Math.PI/180,sd=Math.sin(s.dec),cd=Math.cos(s.dec),feats=[];
  for(const h of [1,-2,-5,-8,-12]){const sh=Math.sin(h*rad),south=[],north=[];let anyS=false,anyN=false;
    for(let lon=-180;lon<=180;lon+=2){const H=(lon-s.lon)*rad,b=cd*Math.cos(H),A=Math.hypot(sd,b),al=Math.atan2(sd,b);
      let lo,hi;const r=sh/A;if(r>=1){lo=85;hi=-85}else if(r<=-1){lo=-85;hi=85}else{const dd=Math.acos(r);lo=(al-dd)/rad;hi=(al+dd)/rad}
      const L=Math.max(-85,Math.min(85,lo)),U=Math.max(-85,Math.min(85,hi));if(L>-85)anyS=true;if(U<85)anyN=true;south.push([lon,L]);north.push([lon,U])}
    if(anyS)feats.push({type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[...south,[180,-85],[-180,-85],south[0]]]}});
    if(anyN)feats.push({type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[...north,[180,85],[-180,85],north[0]]]}})}
  return{type:'FeatureCollection',features:feats}}

// ---------- buer ----------
function slerp(a,b,n=48){const r=Math.PI/180,toV=([lo,la])=>[Math.cos(la*r)*Math.cos(lo*r),Math.cos(la*r)*Math.sin(lo*r),Math.sin(la*r)];
  const A=toV(a),B=toV(b),d=Math.acos(Math.max(-1,Math.min(1,A[0]*B[0]+A[1]*B[1]+A[2]*B[2])));if(d<1e-6)return[a,b];const out=[];
  for(let i=0;i<=n;i++){const t=i/n,s1=Math.sin((1-t)*d)/Math.sin(d),s2=Math.sin(t*d)/Math.sin(d);const x=s1*A[0]+s2*B[0],y=s1*A[1]+s2*B[1],z=s1*A[2]+s2*B[2];
    out.push([Math.atan2(y,x)/r,Math.atan2(z,Math.hypot(x,y))/r])}
  for(let i=1;i<out.length;i++){while(out[i][0]-out[i-1][0]>180)out[i][0]-=360;while(out[i][0]-out[i-1][0]<-180)out[i][0]+=360}return out}
function arcs(ev){const feats=[];const cand=ev.filter(e=>e.ccs.length>=2).sort((a,b)=>b.score-a.score).slice(0,30);
  const sel=EVENTS.find(e=>e.id===S.sel);if(sel&&sel.ccs.length>=2&&!cand.includes(sel))cand.push(sel);
  for(const e of cand){const from=e.lat!=null?[e.lon,e.lat]:centroid(e.ccs[0]);if(!from)continue;const home=ccOf(e)||e.ccs[0];
    for(const c of e.ccs){if(c===home)continue;const to=centroid(c);if(!to)continue;
      feats.push({type:'Feature',properties:{col:CATS[e.cat].c,sel:e.id===S.sel?1:0},geometry:{type:'LineString',coordinates:slerp(from,to)}})}}
  return{type:'FeatureCollection',features:feats}}
