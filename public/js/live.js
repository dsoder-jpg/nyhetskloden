// Nyhetskloden: live.js (lastes i rekkefølge fra index.html, deler globale navn med de andre filene)
// ---------- direkte ----------
function liveText(){if(!meta.lastPoll){$('liveTxt').textContent='Henter første gang …';return}
  const left=Math.max(0,Math.round((new Date(meta.nextPoll)-Date.now())/6e4));
  $('liveTxt').textContent=`Oppdatert ${tfmt.format(new Date(meta.lastPoll))}`;$('live').title=`Neste henting om ${left<1?'under 1':left} min`}
setInterval(()=>{liveText();if(!playing){list();updateMap();breaking()}},30e3);
let toastIds=[];
function toastMsg(txt){toastIds=[];$('toast').textContent=txt;$('toast').hidden=false;clearTimeout(toastMsg.t);toastMsg.t=setTimeout(()=>$('toast').hidden=true,5000)}
function toast(ids){if(!ids.length)return;undoFn=null;toastIds=ids;$('toast').textContent=ids.length===1?'1 ny sak – vis':ids.length+' nye saker – vis nyeste';$('toast').hidden=false;clearTimeout(toastMsg.t);toastMsg.t=setTimeout(()=>$('toast').hidden=true,12000)}
$('toast').onclick=e=>{if(undoFn){const f=undoFn;undoFn=null;f();$('toast').hidden=true;return}toastClick(e)};const toastClick=()=>{$('toast').hidden=true;const n=NEWS.find(n=>toastIds.includes(n.id));if(n){const e=EVENTS.find(e=>e.items.includes(n));if(e){S.cats=new Set(KEYS);S.tab='all';S.tl=null;tlSync();refresh();select(e.id,true)}}};
function apply(d,ids){if(HIST){LIVE={news:d.news||[]};meta={lastPoll:d.lastPoll,nextPoll:d.nextPoll};sources(d.status);liveText();return}NEWS=d.news||[];buildEvents();meta={lastPoll:d.lastPoll,nextPoll:d.nextPoll};sources(d.status);liveText();
  if(ids){for(const id of ids){const n=NEWS.find(x=>x.id===id);const e=n&&EVENTS.find(e=>e.items.includes(n));const cc=e&&ccOf(e);if(cc)flash.set(cc,performance.now())}toast(ids)}
  if(S.sel&&!EVENTS.some(e=>e.id===S.sel)){const n=NEWS.find(x=>x.id===S.sel);const e=n&&EVENTS.find(e=>e.items.includes(n));S.sel=e?e.id:null}
  breaking();if(!playing)refresh()}
async function loadAlerts(){try{ALERTS=await (await fetch('/api/alerts')).json();if(ready)map.getSource('alerts').setData(ALERTS);renderWx()}catch(e){}}

async function load(){
  initMap();initSettings();
  const [w50,cm,d]=await Promise.all(['/countries-50m.json','/countries-meta.json','/api/news'].map(u=>fetch(u).then(r=>r.json())));
  CMETA=cm;for(const id in cm)A2ID[cm[id].a2]=id;
  const fc=topojson.feature(w50,w50.objects.countries);fc.features=fc.features.filter(f=>cm[f.id]).map(f=>({type:'Feature',geometry:f.geometry,properties:{a2:cm[f.id].a2}}));
  COUNTRIES=fc;
  for(const f of fc.features){let x0=180,y0=90,x1=-180,y1=-90;const g=f.geometry,ps=g.type==='Polygon'?[g.coordinates]:g.coordinates;
    for(const p of ps)for(const[x,y]of p[0]){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}BOUNDS.push({f,a2:f.properties.a2,bb:[x0,y0,x1,y1]})}
  if(ready){map.getSource('countries').setData(fc);if(map.getSource('land'))map.getSource('land').setData(fc)}
  apply(d);loadAlerts();
  const es=new EventSource('/api/stream');
  es.addEventListener('hello',()=>$('live').classList.remove('off'));
  es.addEventListener('update',m=>{const d=JSON.parse(m.data);$('live').classList.remove('off');apply(d,d.added.length&&NEWS.length?d.added:null)});
  es.addEventListener('alerts',loadAlerts);
  es.onerror=()=>{$('live').classList.add('off');$('liveTxt').textContent='Mistet kontakt, prøver igjen …';clearTimeout(es.t);es.t=setTimeout(()=>{if(es.readyState!==1){OFFLINE.engine=true;offlineUI()}},8000)};
  es.addEventListener('open',()=>{OFFLINE.engine=false;offlineUI()});
}
$('refresh').onclick=async()=>{$('refresh').disabled=true;$('liveTxt').textContent='Henter …';try{await fetch('/api/refresh',{method:'POST'})}catch(e){}setTimeout(()=>$('refresh').disabled=false,4000)};
// hurtigtaster: J/K neste og forrige sak, / søk, M marked, O åpne saken, S lagre, I innsikt, ? hjelp
function stepSel(d){const ev=['saved','queue','threads'].includes(S.tab)?[]:view();if(!ev.length)return;let i=ev.findIndex(e=>e.id===S.sel);i=i<0?(d>0?0:ev.length-1):Math.min(ev.length-1,Math.max(0,i+d));
  select(ev[i].id,true);const b=$('list').querySelector('button[aria-pressed="true"]');if(b)b.scrollIntoView({block:'nearest'})}
document.addEventListener('keydown',e=>{if(e.target.matches('input,textarea,select')||e.ctrlKey||e.metaKey||e.altKey)return;if(document.querySelector('dialog[open]'))return;
  if(e.key==='Escape'){if(!$('card').hidden)select(null);else if(S.cc)setCountry(null);return}
  if(e.key===' '&&e.target===document.body){e.preventDefault();$('tlPlay').click();return}
  const k=e.key.toLowerCase();
  if(k==='j'||e.key==='ArrowDown'&&e.target===document.body){e.preventDefault();setSide('news');stepSel(1)}
  else if(k==='k'||e.key==='ArrowUp'&&e.target===document.body){e.preventDefault();setSide('news');stepSel(-1)}
  else if(e.key==='/'){e.preventDefault();setSide('news');$('q').focus()}
  else if(k==='m'&&F.market)setSide(SIDEV==='market'?'news':'market');
  else if(k==='o'&&!$('card').hidden&&!$('cSrc').hidden)$('cSrc').click();
  else if(k==='s'&&!$('card').hidden&&!$('cStar').hidden)$('cStar').click();
  else if(k==='i')openInsight();
  else if(e.key==='?'){e.preventDefault();$('keys').showModal()}});
