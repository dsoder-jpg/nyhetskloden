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
function renderMarket(){const box=$('mkt');box.hidden=!F.market;$('sideTabs').hidden=!F.market;setSide(SIDEV);
  const o0=MKT&&(MKT.indices||[]).find(q=>q.sym==='OSEBX.OL');$('sideMkt').innerHTML=o0?`<span class="${pcls(o0.pct)}">${pctTxt(o0.pct)}</span>`:'';
  if(!F.market)return;
  if(!MKT||MKT.error||!(MKT.indices||[]).length&&!(MKT.other||[]).length){$('mSum').innerHTML='<span class="fl">'+(MKT?'ingen kontakt':'henter …')+'</span>';$('mBody').innerHTML='<div class="mnote">'+(MKT?'Fant ikke kursene akkurat nå. Prøver igjen om noen minutter.':'Henter kurser …')+'</div>';return}
  const ix=MKT.indices||[],o=ix.find(q=>q.sym==='OSEBX.OL'),sp=ix.find(q=>q.sym==='^GSPC');
  $('mSum').innerHTML=[o&&`<span>OSEBX <b class="${pcls(o.pct)}">${pctTxt(o.pct)}</b></span>`,sp&&`<span>S&amp;P <b class="${pcls(sp.pct)}">${pctTxt(sp.pct)}</b></span>`].filter(Boolean).join('');
  let h=`<div class="qg">${ix.map(q=>qCard(q,q.name.replace('Oslo Børs (OSEBX)','OSEBX'))).join('')}</div>`;
  if((MKT.other||[]).length)h+=`<div class="mh">Valuta og råvarer</div><div class="qg">${MKT.other.map(q=>qCard(q)).join('')}</div>`;
  if(F.movers&&(MKT.up||[]).length)h+=`<div class="mh">Oslo Børs i dag</div><div class="mv"><div><div class="mnote">Best</div>${moverList(MKT.up)}</div><div><div class="mnote">Dårligst</div>${moverList(MKT.down)}</div></div>`;
  if((MKT.watch||[]).length)h+=`<div class="mh">Aksjer jeg følger</div><div class="qg">${MKT.watch.map(q=>qCard(q,q.name)).join('')}</div>`;
  h+=`<div class="mnote">Kurser fra Yahoo Finance, oppdatert ${tfmt.format(new Date(MKT.at))}. De kan være forsinket.</div>`;
  $('mBody').innerHTML=h.replace('<div class="mnote">Kurser','<div id="mPower" hidden></div><div class="mnote">Kurser');if(typeof powerUI==='function')powerUI()}
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
