// Nyhetskloden: world.js (lastes sist, deler globale navn med de andre filene)
// ---------- tidslinje for en sak ----------
let STEV=null;
$('cStory').onclick=()=>{if(cardEv)openStory(cardEv)};
async function openStory(e){STEV=e;const d=$('story'),b=$('stBody');b.innerHTML='<p class="meta">Leter i arkivet …</p>';if(!d.open)d.showModal();
  const eid=(e.items.find(n=>n.eid)||{}).eid||e.id;let r=[];
  try{r=await (await fetch(`/api/story?title=${encodeURIComponent(e.title)}&eid=${encodeURIComponent(eid)}&days=${$('stDays').value}`)).json()}catch(x){}
  if(STEV!==e)return;b.textContent='';
  const h=document.createElement('h1');h.id='stTitle';h.textContent=e.title;b.append(h);
  if(!Array.isArray(r)||!r.length){const p=document.createElement('p');p.className='rnote';p.textContent='Fant ingen andre artikler om saken i arkivet.';b.append(p);return}
  const days=new Map();for(const n of r){const k=n.date.slice(0,10);if(!days.has(k))days.set(k,[]);days.get(k).push(n)}
  const first=r[0],last=r[r.length-1],srcs=new Set(r.map(n=>n.src));
  const m=document.createElement('p');m.className='meta';m.textContent=`${r.length} artikler fra ${srcs.size} ${srcs.size===1?'kilde':'kilder'}, fra ${dfmt.format(new Date(first.date))} til ${dfmt.format(new Date(last.date))}.`;b.append(m);
  const df=new Intl.DateTimeFormat('nb-NO',{weekday:'long',day:'numeric',month:'long'});
  const ol=document.createElement('ol');ol.className='story';
  for(const [k,list] of [...days].reverse()){const li=document.createElement('li');const hd=document.createElement('h2');hd.textContent=df.format(new Date(k+'T12:00:00')).replace(/^./,c=>c.toUpperCase())+(list.length>1?` (${list.length})`:'');li.append(hd);
    const ul=document.createElement('ul');for(const n of list.slice().reverse()){const it=document.createElement('li');const t=document.createElement('time');t.textContent=tfmt.format(new Date(n.date));
      const s=document.createElement('b');s.textContent=n.src;const a=document.createElement('a');a.href=n.url;a.target='_blank';a.rel='noopener';a.textContent=n.titleNo||n.title;it.append(t,s,a);ul.append(it)}
    li.append(ul);ol.append(li)}
  b.append(ol);b.scrollTop=0}
$('stDays').onchange=()=>{if(STEV)openStory(STEV)};
$('stX').onclick=()=>$('story').close();
$('story').addEventListener('click',e=>{if(e.target===$('story'))$('story').close()});

// ---------- bakgrunn fra Wikipedia ----------
let WK=null;
function wikiName(e){const p=String(e.place||'').split(',')[0].replace(/\b\d+\s*km\s*(N|S|E|W|NE|NW|SE|SW|NNE|NNW|ENE|ESE|SSE|SSW|WNW|WSW)\s+of\s+/i,'').trim();
  if(p&&p.length>=3&&!/^(ukjent|unknown)/i.test(p)&&!e.approx)return p;const cc=ccOf(e);return cc?cname(cc):null}
function wikiSetup(e){const n=wikiName(e);WK={n,done:false};$('cWiki').hidden=!n;$('cWiki').open=false;$('cWikiT').textContent=n?'Om '+n:'Bakgrunn';$('cWikiB').textContent=''}
$('cWiki').addEventListener('toggle',async()=>{if(!$('cWiki').open||!WK||WK.done)return;const w=WK;w.done=true;const b=$('cWikiB');b.innerHTML='<p class="meta">Henter fra Wikipedia …</p>';
  let r=null;try{r=await (await fetch('/api/wiki?q='+encodeURIComponent(w.n))).json()}catch(x){}
  if(WK!==w)return;b.textContent='';
  if(!r||r.error){const p=document.createElement('p');p.className='meta';p.textContent='Fant ingen artikkel om '+w.n+' på Wikipedia.';b.append(p);return}
  if(r.thumb&&F.images!==false){const im=document.createElement('img');im.src=r.thumb;im.alt='';im.referrerPolicy='no-referrer';im.onerror=()=>im.remove();b.append(im)}
  const p=document.createElement('p');p.textContent=r.extract;b.append(p);
  if(r.url){const a=document.createElement('a');a.href=r.url;a.target='_blank';a.rel='noopener';a.textContent='Les mer på Wikipedia'+(r.lang==='en'?' (engelsk)':'');b.append(a)}});

// ---------- ShakeMap: hvor kraftig det ristet ----------
const MMI_COL=['interpolate',['linear'],['get','mmi'],2,'#9be7ff',4,'#7cf29a',5,'#fff25a',6,'#ffc531',7,'#ff8a1e',8,'#ff4d2e',9,'#d61f1f'];
function shakeEnsure(){if(!ready||map.getSource('shake'))return;map.addSource('shake',{type:'geojson',data:EMPTY});
  map.addLayer({id:'shake',type:'line',source:'shake',paint:{'line-color':MMI_COL,'line-width':['interpolate',['linear'],['zoom'],2,1.2,7,2.4],'line-opacity':.9}},'pts')}
function shakeClear(){if(ready&&map.getSource('shake'))map.getSource('shake').setData(EMPTY)}
async function shakeLoad(e){if(!F.shakemap||e.src!=='USGS'||!/eventpage\//.test(e.url||''))return;const m=+(String(e.title).match(/M(\d+(?:\.\d)?)/)||[])[1];if(!(m>=5))return;
  shakeEnsure();let r;try{r=await (await fetch('/api/shakemap?url='+encodeURIComponent(e.url))).json()}catch(x){return}
  if(cardEv!==e||!r||r.error)return;
  if(r.none||!(r.features||[]).length){$('cShake').textContent='USGS har ikke laget kart over ristingen for dette skjelvet ennå.';$('cShake').hidden=false;return}
  map.getSource('shake').setData(r);const max=Math.max(...r.features.map(f=>f.properties.mmi));
  $('cShake').textContent=`Linjene viser hvor kraftig det ristet (fra USGS). Sterkest: ${['','ikke merkbart','svakt','svakt','lett','moderat','kraftig','svært kraftig','alvorlig','voldsomt','ekstremt'][Math.min(10,Math.round(max))]||''} (styrke ${Math.round(max)} av 10).`;$('cShake').hidden=false}

// ---------- kategorier på kartet ----------
function mapCatsUI(){const box=$('mapCats');if(!box)return;box.textContent='';const hide=new Set(SET.mapHideCats||[]);
  for(const k of KEYS){const l=document.createElement('label');const i=document.createElement('input');i.type='checkbox';i.checked=!hide.has(k);i.dataset.mc=k;l.append(i,CATS[k].n);box.append(l)}}
$('mapCats').addEventListener('change',e=>{const i=e.target;if(!i.dataset||!i.dataset.mc)return;e.stopPropagation();
  const hide=[...$('mapCats').querySelectorAll('input[data-mc]')].filter(x=>!x.checked).map(x=>x.dataset.mc);SET.mapHideCats=hide;postSet({mapHideCats:hide},true);updateMap();if(F.heatArchive)loadAHeat()});

// ---------- varmekart fra arkivet ----------
$('ahDays').value=String(store.get('nk-ahdays',30));
$('ahDays').onchange=()=>{store.set('nk-ahdays',+$('ahDays').value);loadAHeat()};
async function loadAHeat(){if(!ready)return;if(!map.getSource('aheat')){map.addSource('aheat',{type:'geojson',data:EMPTY});
    map.addLayer({id:'aheat',type:'heatmap',source:'aheat',maxzoom:9,paint:{'heatmap-weight':['interpolate',['linear'],['get','n'],1,.15,10,.6,60,1],'heatmap-intensity':['interpolate',['linear'],['zoom'],1,.8,6,1.6],
      'heatmap-radius':['interpolate',['linear'],['zoom'],1,10,4,26,8,50],'heatmap-opacity':.75,
      'heatmap-color':['interpolate',['linear'],['heatmap-density'],0,'rgba(0,0,0,0)',.15,'rgba(120,60,220,.35)',.4,'#c2409a',.65,'#ff6a3d',.9,'#ffd166']}},'heat')}
  if(!F.heatArchive||SAVER()){map.getSource('aheat').setData(EMPTY);return}
  let r;try{r=await (await fetch('/api/heat?days='+$('ahDays').value)).json()}catch(e){return}
  map.getSource('aheat').setData({type:'FeatureCollection',features:(r.pts||[]).map(([lon,lat,n])=>({type:'Feature',geometry:{type:'Point',coordinates:[lon,lat]},properties:{n}}))})}

// ---------- skogbranner ----------
async function loadFires(){clearTimeout(loadFires.t);if(!ready)return;if(!map.getSource('fires')){map.addSource('fires',{type:'geojson',data:EMPTY});
    map.addLayer({id:'fires',type:'circle',source:'fires',paint:{'circle-radius':['interpolate',['linear'],['zoom'],1,['interpolate',['linear'],['get','n'],2,1.6,30,4],6,['interpolate',['linear'],['get','n'],2,4,30,10]],
      'circle-color':['interpolate',['linear'],['get','frp'],10,'#ffb347',200,'#ff5a1f',1000,'#d7191c'],'circle-opacity':.8,'circle-blur':.35}},'pts')}
  if(!F.fires){map.getSource('fires').setData(EMPTY);return}
  let r;try{r=await (await fetch('/api/fires')).json()}catch(e){r={pts:[]}}
  map.getSource('fires').setData({type:'FeatureCollection',features:(r.pts||[]).map(([lon,lat,n,frp])=>({type:'Feature',geometry:{type:'Point',coordinates:[lon,lat]},properties:{n,frp}}))});
  trafMsg.fi=r.error?'Fikk ikke hentet branner':(r.pts||[]).length+' brannområder siste døgn (NASA)';showTraf();loadFires.t=setTimeout(loadFires,60*60e3)}

// ---------- nordlys ----------
let AUR=null;
async function loadAurora(){clearTimeout(loadAurora.t);if(!ready)return;if(!map.getSource('aurora')){map.addSource('aurora',{type:'geojson',data:EMPTY});
    map.addLayer({id:'aurora',type:'heatmap',source:'aurora',maxzoom:7,paint:{'heatmap-weight':['interpolate',['linear'],['get','v'],3,.05,20,.5,60,1],'heatmap-intensity':1,'heatmap-radius':['interpolate',['linear'],['zoom'],1,8,4,30],'heatmap-opacity':.6,
      'heatmap-color':['interpolate',['linear'],['heatmap-density'],0,'rgba(0,0,0,0)',.2,'rgba(60,220,140,.25)',.5,'rgba(80,255,160,.55)',.85,'rgba(190,255,120,.8)']}},'heat')}
  const st=$('auroraSt');if(!F.aurora){map.getSource('aurora').setData(EMPTY);st.hidden=true;AUR=null;return}
  try{AUR=await (await fetch('/api/aurora?grid=1')).json()}catch(e){AUR=null}
  if(!AUR||AUR.error){st.textContent='Fikk ikke hentet nordlysvarselet.';st.hidden=false;return}
  map.getSource('aurora').setData({type:'FeatureCollection',features:(AUR.pts||[]).map(([lon,lat,v])=>({type:'Feature',geometry:{type:'Point',coordinates:[lon>180?lon-360:lon,lat]},properties:{v}}))});
  st.textContent=(AUR.level&&HOME?`Nordlys der du bor: ${AUR.level} sjanse`:'Nordlysovalen nå')+(AUR.kpMax!=null?`, Kp opp mot ${String(AUR.kpMax.toFixed(1)).replace('.',',')}`:'')+' (NOAA).';st.hidden=false;
  loadAurora.t=setTimeout(loadAurora,15*60e3)}

// laster lagene når kartet er klart og når valgene endres
let worldSig='';
function worldLayers(){if(!ready)return;mapCatsUI();const sig=JSON.stringify([F.heatArchive,F.fires,F.aurora,SET.mapHideCats,SAVER(),HOME&&HOME.lat]);if(sig===worldSig)return;worldSig=sig;loadAHeat();loadFires();loadAurora()}
