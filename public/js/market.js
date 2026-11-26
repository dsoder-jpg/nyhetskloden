// Nyhetskloden: market.js (lastes i rekkefølge fra index.html, deler globale navn med de andre filene)
// ---------- marked ----------
const nf2=new Intl.NumberFormat('nb-NO',{maximumFractionDigits:2,minimumFractionDigits:2}),nf0=new Intl.NumberFormat('nb-NO',{maximumFractionDigits:0});
const fmtNum=v=>v==null?'–':(Math.abs(v)>=10000?nf0:nf2).format(v);
const pctTxt=p=>p==null?'–':(p>0?'+':p<0?'−':'')+nf2.format(Math.abs(p))+' %';
const pcls=p=>p>0?'up':p<0?'dn':'fl';
function spark(v,p){if(!v||v.length<2)return'';const mn=Math.min(...v),mx=Math.max(...v),r=mx-mn||1,W=100,H=18;
  const pts=v.map((y,i)=>(i*W/(v.length-1)).toFixed(1)+','+(H-1-(y-mn)/r*(H-2)).toFixed(1)).join(' ');
  return`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${p>0?'#3ddc84':p<0?'#ff6b6b':'#8a9bb0'}" stroke-width="1.4" vector-effect="non-scaling-stroke"/></svg>`}
const qCard=(q,label)=>`<div class="q" title="${esc(q.long||q.name)}"><span class="nm">${esc(label||q.name)}</span><span class="px">${fmtNum(q.price)}</span><span class="${pcls(q.pct)}" style="grid-column:2;text-align:right;font-variant-numeric:tabular-nums">${pctTxt(q.pct)}</span>${spark(q.spark,q.pct)}</div>`;
const moverList=a=>'<ol>'+a.map(q=>`<li><span title="${esc(q.name)}">${esc(q.sym.replace(/\.OL$/,''))}</span><span class="${pcls(q.pct)}">${pctTxt(q.pct)}</span></li>`).join('')+'</ol>';
let SIDEV=store.get('nk-side','news');
function setSide(v){SIDEV=F.market&&v==='market'?'market':'news';store.set('nk-side',SIDEV);$('side').classList.toggle('v-market',SIDEV==='market');
  for(const b of $('sideTabs').children)b.setAttribute('aria-selected',b.dataset.v===SIDEV);if(SIDEV==='market')$('mkt').open=true}
$('sideTabs').addEventListener('click',e=>{const b=e.target.closest('button');if(b)setSide(b.dataset.v)});
// periode for oversikten og detaljene
const MRANGES=[['1d','1D'],['5d','5D'],['1mo','1M'],['6mo','6M'],['ytd','I år'],['1y','1 år'],['5y','5 år'],['max','Maks']];
const MRANGE_TXT={'1d':'i dag','5d':'siste 5 dager','1mo':'siste måned','6mo':'siste 6 måneder','ytd':'i år','1y':'siste år','5y':'siste 5 år','max':'hele perioden'};
let MR=store.get('nk-mrange','1d'),MKV=null,MDET=null,MDETD=null;
$('mRange').innerHTML=MRANGES.map(([k,l])=>`<button type="button" data-r="${k}" aria-pressed="${k===MR}">${l}</button>`).join('');
$('mRange').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;MR=b.dataset.r;store.set('nk-mrange',MR);
  for(const x of $('mRange').children)x.setAttribute('aria-pressed',x.dataset.r===MR);if(MDET)openDetail(MDET);else loadRange()});
async function loadRange(){if(MR==='1d'){MKV=null;renderMarket();return}
  $('mBody').innerHTML='<div class="mnote">Henter kurser for '+MRANGE_TXT[MR]+' …</div>';
  try{MKV=await (await fetch('/api/market?range='+MR)).json();if(MKV.off||MKV.error)MKV=null}catch(e){MKV=null}renderMarket()}
const qBtn=(q,label)=>`<button type="button" class="q" data-s="${esc(q.sym)}" title="${esc(q.long||q.name)}"><span class="nm">${esc(label||q.name)}</span><span class="px">${fmtNum(q.price)}</span><span class="${pcls(q.pct)} pc">${pctTxt(q.pct)}</span>${spark(q.spark,q.pct)}</button>`;
function renderMarket(){const box=$('mkt');box.hidden=!F.market;$('sideTabs').hidden=!F.market;setSide(SIDEV);
  const o0=MKT&&(MKT.indices||[]).find(q=>q.sym==='OSEBX.OL');$('sideMkt').innerHTML=o0?`<span class="${pcls(o0.pct)}">${pctTxt(o0.pct)}</span>`:'';
  if(!F.market)return;
  const D=MR==='1d'?MKT:MKV;
  const ix0=(MKT&&MKT.indices)||[],o=ix0.find(q=>q.sym==='OSEBX.OL'),sp=ix0.find(q=>q.sym==='^GSPC');
  $('mSum').innerHTML=[o&&`<span>OSEBX <b class="${pcls(o.pct)}">${pctTxt(o.pct)}</b></span>`,sp&&`<span>S&amp;P <b class="${pcls(sp.pct)}">${pctTxt(sp.pct)}</b></span>`].filter(Boolean).join('');
  if(MDET){renderDetail();return}
  if(!D||D.error||!(D.indices||[]).length&&!(D.other||[]).length){$('mBody').innerHTML='<div class="mnote">'+(D?'Fant ikke kursene akkurat nå. Prøver igjen om noen minutter.':'Henter kurser …')+'</div>';return}
  let h='';const grp=new Map();for(const q of D.indices){const r=q.region||'Andre';if(!grp.has(r))grp.set(r,[]);grp.get(r).push(q)}
  if((D.watch||[]).length)h+=`<div class="mh">Aksjer jeg følger</div><div class="qg">${D.watch.map(q=>qBtn(q,q.name)).join('')}</div>`;
  for(const[r,a]of grp)h+=`<div class="mh">${esc(r)}</div><div class="qg">${a.map(q=>qBtn(q,q.name.replace('Oslo Børs (OSEBX)','OSEBX'))).join('')}</div>`;
  const kinds=[['fx','Valuta'],['cmd','Råvarer'],['crypto','Krypto']];
  for(const[k,l]of kinds){const a=(D.other||[]).filter(q=>q.kind===k);if(a.length)h+=`<div class="mh">${l}</div><div class="qg">${a.map(q=>qBtn(q)).join('')}</div>`}
  if(F.movers&&(D.up||[]).length)h+=`<div class="mh">Oslo Børs ${MRANGE_TXT[D.range||'1d']}</div><div class="mv"><div><div class="mnote">Best</div>${moverList(D.up)}</div><div><div class="mnote">Dårligst</div>${moverList(D.down)}</div></div>`;
  h+=`<div id="mPower" hidden></div><div class="mnote">Endring ${MRANGE_TXT[D.range||'1d']}. Kurser fra Yahoo Finance, oppdatert ${tfmt.format(new Date(D.at))}. De kan være forsinket. Klikk på en kurs for graf og detaljer.</div>`;
  $('mBody').innerHTML=h;if(typeof powerUI==='function')powerUI()}
$('mBody').addEventListener('click',e=>{const b=e.target.closest('[data-s]');if(b)openDetail(b.dataset.s);const bk=e.target.closest('#mBack');if(bk){MDET=null;MDETD=null;renderMarket()}});
// ---------- detaljer med graf ----------
async function openDetail(sym){MDET=sym;$('mRes').hidden=true;
  $('mBody').innerHTML='<button type="button" class="btn mback" id="mBack">‹ Tilbake</button><div class="mnote">Henter '+esc(sym)+' …</div>';$('mBody').scrollTop=0;
  try{const d=await (await fetch(`/api/mdetail?s=${encodeURIComponent(sym)}&range=${MR}`)).json();if(MDET!==sym)return;MDETD=d.error?{error:d.error,sym}:d}catch(e){MDETD={error:'ingen kontakt',sym}}
  renderDetail()}
const DFMT={'1d':{hour:'2-digit',minute:'2-digit'},'5d':{weekday:'short',hour:'2-digit',minute:'2-digit'},'1mo':{day:'numeric',month:'short'},'6mo':{day:'numeric',month:'short'},'ytd':{day:'numeric',month:'short'},'1y':{day:'numeric',month:'short',year:'2-digit'},'5y':{month:'short',year:'numeric'},'max':{year:'numeric'}};
function renderDetail(){const d=MDETD;if(!d)return;
  if(d.error){$('mBody').innerHTML=`<button type="button" class="btn mback" id="mBack">‹ Tilbake</button><div class="mnote">Fant ikke ${esc(d.sym)} hos Yahoo Finance.</div>`;return}
  const pts=d.points||[],following=(SET.marketWatch||[]).includes(d.sym),df=new Intl.DateTimeFormat('nb-NO',DFMT[d.range]||DFMT['1mo']);
  let svg='<p class="mnote">Ingen kurser i perioden.</p>';
  if(pts.length>1){const W=600,H=190,P={l:8,r:52,t:10,b:22},xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),x0=xs[0],x1=xs[xs.length-1],y0=Math.min(...ys,d.first??Infinity),y1=Math.max(...ys,d.first??-Infinity),yr=(y1-y0)||1;
    const X=t=>P.l+(t-x0)/((x1-x0)||1)*(W-P.l-P.r),Y=v=>P.t+(1-(v-y0)/yr)*(H-P.t-P.b),col=d.pct>0?'#3ddc84':d.pct<0?'#ff6b6b':'#9fb0c4';
    const line=pts.map((p,i)=>(i?'L':'M')+X(p[0]).toFixed(1)+' '+Y(p[1]).toFixed(1)).join(''),area=line+`L${X(x1).toFixed(1)} ${H-P.b}L${X(x0).toFixed(1)} ${H-P.b}Z`;
    const ticks=[y1,(y0+y1)/2,y0].map(v=>`<text x="${W-P.r+6}" y="${Y(v)+4}">${fmtNum(v)}</text><line x1="${P.l}" x2="${W-P.r}" y1="${Y(v)}" y2="${Y(v)}"/>`).join('');
    const base=d.first!=null?`<line class="base" x1="${P.l}" x2="${W-P.r}" y1="${Y(d.first)}" y2="${Y(d.first)}"/>`:'';
    svg=`<svg class="mchart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Kursgraf for ${esc(d.short)} ${MRANGE_TXT[d.range]}">
      <defs><linearGradient id="mg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".28"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
      <g class="grid">${ticks}</g>${base}<path d="${area}" fill="url(#mg)"/><path d="${line}" fill="none" stroke="${col}" stroke-width="1.8" vector-effect="non-scaling-stroke"/>
      <text class="xl" x="${P.l}" y="${H-6}">${esc(df.format(new Date(x0)))}</text><text class="xl" x="${W-P.r}" y="${H-6}" text-anchor="end">${esc(df.format(new Date(x1)))}</text>
      <line id="mHx" class="hx" y1="${P.t}" y2="${H-P.b}" hidden/><circle id="mHd" r="4" fill="${col}" hidden/></svg><div class="mtip" id="mTip" hidden></div>`;
    MDETD._geo={W,P,x0,x1,X,Y,df}}
  const st=[['Kurs',fmtNum(d.price)+' '+esc(d.cur)],['Endring '+MRANGE_TXT[d.range],`<span class="${pcls(d.pct)}">${pctTxt(d.pct)}</span>`],
    d.dayHigh!=null?['I dag',fmtNum(d.dayLow)+' til '+fmtNum(d.dayHigh)]:null,d.high52!=null?['Siste 52 uker',fmtNum(d.low52)+' til '+fmtNum(d.high52)]:null,
    d.vol?['Omsatt i dag',nf0.format(d.vol)]:null,['Børs',esc(d.exch||'–')]].filter(Boolean);
  $('mBody').innerHTML=`<button type="button" class="btn mback" id="mBack">‹ Tilbake</button>
    <div class="mdh"><div><h3>${esc(d.name)}</h3><div class="mnote">${esc(d.sym)}${d.type?', '+esc(d.type.toLowerCase()):''}</div></div>
    <div class="mdp"><b>${fmtNum(d.price)}</b> <small>${esc(d.cur)}</small><div class="${pcls(d.pct)}">${pctTxt(d.pct)} ${MRANGE_TXT[d.range]}</div></div></div>
    <div class="mcw">${svg}</div>
    <dl class="mstats">${st.map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
    <div class="mact"><button type="button" class="btn ${following?'':'primary'}" id="mFollow">${following?'Slutt å følge':'Følg'}</button><a class="btn" href="https://finance.yahoo.com/quote/${encodeURIComponent(d.sym)}" target="_blank" rel="noopener">Se hos Yahoo Finance</a></div>
    <div class="mnote">Kurser fra Yahoo Finance${d.time?', sist oppdatert '+dfmt.format(new Date(d.time)):''}. De kan være forsinket.</div>`;
  $('mFollow').onclick=()=>{const w=SET.marketWatch||[];postSet({marketWatch:following?w.filter(x=>x!==d.sym):[...w,d.sym].slice(-30)},true);setTimeout(()=>{renderDetail();loadMarket()},400)};
  const sv=$('mBody').querySelector('.mchart');if(sv&&MDETD._geo){const g=MDETD._geo;
    sv.addEventListener('mousemove',e=>{const r=sv.getBoundingClientRect(),t=g.x0+((e.clientX-r.left)/r.width*g.W-g.P.l)/(g.W-g.P.l-g.P.r)*(g.x1-g.x0);
      let best=pts[0];for(const p of pts)if(Math.abs(p[0]-t)<Math.abs(best[0]-t))best=p;
      const hx=$('mHx'),hd=$('mHd'),tip=$('mTip');hx.setAttribute('x1',g.X(best[0]));hx.setAttribute('x2',g.X(best[0]));hx.hidden=false;hd.setAttribute('cx',g.X(best[0]));hd.setAttribute('cy',g.Y(best[1]));hd.hidden=false;
      tip.hidden=false;tip.textContent=fmtNum(best[1])+' · '+g.df.format(new Date(best[0]));tip.style.left=Math.min(r.width-120,Math.max(0,g.X(best[0])/g.W*r.width-60))+'px'});
    sv.addEventListener('mouseleave',()=>{$('mHx').hidden=true;$('mHd').hidden=true;$('mTip').hidden=true})}}
// ---------- søk ----------
let mqT=null;
$('mQ').addEventListener('input',()=>{clearTimeout(mqT);const q=$('mQ').value.trim();if(!q){$('mRes').hidden=true;return}
  mqT=setTimeout(async()=>{let r=[];try{r=await (await fetch('/api/msearch?q='+encodeURIComponent(q))).json()}catch(e){}
    if($('mQ').value.trim()!==q)return;const ul=$('mRes');ul.hidden=false;
    ul.innerHTML=Array.isArray(r)&&r.length?r.map(x=>`<li><button type="button" data-s="${esc(x.sym)}"><b>${esc(x.name)}</b><small>${esc(x.sym)}, ${esc(x.exch)}${x.type?', '+esc(x.type.toLowerCase()):''}</small></button></li>`).join(''):'<li class="mnote">Ingen treff. Prøv navnet på selskapet eller tickeren.</li>'},300)});
$('mQ').addEventListener('keydown',e=>{if(e.key==='Escape'){$('mQ').value='';$('mRes').hidden=true}if(e.key==='Enter'){const b=$('mRes').querySelector('button');if(b)b.click()}});
$('mRes').addEventListener('click',e=>{const b=e.target.closest('button[data-s]');if(!b)return;$('mQ').value='';$('mRes').hidden=true;openDetail(b.dataset.s)});
$('mkt').addEventListener('toggle',()=>store.set('nk-mkt-open',$('mkt').open));$('mkt').open=store.get('nk-mkt-open',true);
// selskaper som nevnes i saker
let CO=[];const tkCache=new Map();
const reEsc=t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function buildCo(){tkCache.clear();CO=(MKT&&MKT.cos||[]).filter(c=>c.pct!=null).map(c=>({...c,res:c.names.filter(n=>n.length>=4&&!/^(Aker|Norsk|Norske|Bank|Group)$/i.test(n)).map(n=>new RegExp('(^|[^\\p{L}\\p{N}])('+reEsc(n)+')(?![\\p{L}\\p{N}])','iu'))})).filter(c=>c.res.length)}
function tickersFor(e){if(!F.tickersInNews||!CO.length||!e.items)return[];if(tkCache.has(e.id))return tkCache.get(e.id);
  const txt=e.items.map(n=>n.title+' '+(n.titleNo||'')+' '+(n.text||'')).join(' '),out=[];
  for(const c of CO){for(const re of c.res){const m=txt.match(re);if(m&&/\p{Lu}/u.test(m[2][0])){out.push(c);break}}if(out.length>=3)break}
  tkCache.set(e.id,out);return out}
async function loadMarket(){clearTimeout(loadMarket.t);
  if(!(F.market||F.marketGlobe||F.tickersInNews)){MKT=null;CO=[];renderMarket();setMarketLayer();return}
  try{const r=await fetch('/api/market');MKT=await r.json();if(MKT.off)MKT=null}catch(e){MKT={error:true}}
  buildCo();renderMarket();setMarketLayer();list();if(cardEv)cardTickers(cardEv);loadMarket.t=setTimeout(loadMarket,5*60e3)}
function setMarketLayer(){if(!ready||!map.getSource('mkts'))return;const on=F.marketGlobe&&MKT&&MKT.indices;
  const g=new Map();if(on)for(const q of MKT.indices){if(q.lat==null)continue;const k=q.city;if(!g.has(k))g.set(k,[]);g.get(k).push(q)}
  map.getSource('mkts').setData({type:'FeatureCollection',features:[...g.values()].map(a=>({type:'Feature',geometry:{type:'Point',coordinates:[a[0].lon,a[0].lat]},
    properties:{label:a.map(q=>q.name.replace('Oslo Børs (OSEBX)','OSEBX')+' '+pctTxt(q.pct)).join('\n'),col:a[0].pct>0?'#3ddc84':a[0].pct<0?'#ff6b6b':'#9fb0c4',pct:a[0].pct||0}}))});
  for(const id of ['mk-glow','mk-dot','mk-txt'])if(map.getLayer(id))map.setLayoutProperty(id,'visibility',on?'visible':'none')}
