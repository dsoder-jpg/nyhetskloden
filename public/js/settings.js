// Nyhetskloden: settings.js (lastes i rekkefølge fra index.html, deler globale navn med de andre filene)
// ---------- innstillinger ----------
const IS_APP=!!(window.nk&&window.nk.appInfo);document.body.classList.toggle('is-app',IS_APP);
const IS_LAN=!IS_APP&&location.port==='37852';document.body.classList.toggle('is-lan',IS_LAN);
const UI=Object.assign({anim:true,legend:true,timeline:true,layersBox:true},store.get('nk-ui',{}));
function applyUI(){document.querySelector('.legend').hidden=!UI.legend;$('tl').hidden=!UI.timeline;$('layers').hidden=!UI.layersBox;
  if(ready&&!UI.anim){map.setPaintProperty('pulse','circle-radius',15);map.setPaintProperty('pulse','circle-stroke-opacity',.55);map.setPaintProperty('arcs','line-dasharray',[2,2])}}
let saveT=null,pend={};
const savedFlash=()=>{const s=$('sSaved');s.textContent='Lagret ✓';s.classList.add('on');clearTimeout(savedFlash.t);savedFlash.t=setTimeout(()=>s.classList.remove('on'),1600)};
function postSet(patch,now){Object.assign(pend,patch);clearTimeout(saveT);saveT=setTimeout(async()=>{const body=pend;pend={};
  try{const r=await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw 0;SET=await r.json();savedFlash();renderSettings(true);applyFeatures()}
  catch(e){$('sSaved').textContent='Kunne ikke lagre';$('sSaved').classList.add('on')}},now?0:350)}
async function loadSettings(){try{SET=await (await fetch('/api/settings')).json()}catch(e){}}
const SECS={hidden:'Skjult',insight:'Innsikt',general:'Generelt',look:'Utseende',cats:'Kategorier',market:'Marked',home:'Vær og hjemsted',traffic:'Trafikk',mobile:'Mobil',notify:'Varsler',watch:'Følger',map:'Kart og visning',sources:'Kilder',translate:'Oversettelse',ticker:'Ticker',updates:'Oppdateringer',data:'Data og personvern',about:'Om'};
function showSec(id){for(const b of $('snav').querySelectorAll('button'))b.setAttribute('aria-current',b.dataset.sec===id);
  for(const s of document.querySelectorAll('.spanes section'))s.classList.toggle('on',s.dataset.sec===id);$('sTitle').textContent=SECS[id];store.set('nk-sec',id)}
$('snav').addEventListener('click',e=>{const b=e.target.closest('button[data-sec]');if(b)showSec(b.dataset.sec)});
async function openSettings(sec){await loadSettings();renderSettings();applyFeatures();if(IS_APP){const info=await window.nk.appInfo();$('sLogin').checked=info.openAtLogin;$('tNow').checked=info.ticker;
    $('dDir').textContent='Innstillinger og saker lagres i '+info.dataDir+'.';$('aVer').textContent='Versjon '+info.version+' (Electron '+info.electron+')'}
  else $('aVer').textContent='Nettleserversjon';
  showSec(sec||store.get('nk-sec','general'));if(!$('dlg').open)$('dlg').showModal()}
$('setBtn').onclick=()=>openSettings();
$('dlgX').onclick=()=>$('dlg').close();
$('dlg').addEventListener('click',e=>{if(e.target===$('dlg'))$('dlg').close()});
// generelle felt koblet til motoren (data-k)
function renderSettings(soft){
  for(const el of document.querySelectorAll('#dlg [data-k]')){const v=SET[el.dataset.k];if(v==null)continue;if(el.type==='checkbox')el.checked=!!v;else el.value=String(v)}
  const q=SET.quiet||{on:false,from:23,to:7};if(!$('qFrom').options.length)for(const s of [$('qFrom'),$('qTo')])for(let h=0;h<24;h++)s.add(new Option(String(h).padStart(2,'0')+':00',h));
  $('qOn').checked=q.on;$('qFrom').value=q.from;$('qTo').value=q.to;
  // følger
  const wc=$('wChips');wc.textContent='';for(const w of SET.watch||[]){const s=document.createElement('span');s.append(w);const b=document.createElement('button');b.type='button';b.textContent='×';b.title='Slutt å følge';b.setAttribute('aria-label','Slutt å følge '+w);
    b.onclick=()=>postSet({watch:(SET.watch||[]).filter(x=>x!==w)},true);s.append(b);wc.append(s)}
  if(!(SET.watch||[]).length){const p=document.createElement('p');p.className='meta';p.textContent='Du følger ingen ord ennå.';wc.append(p)}
  // kart
  $('mBase').value=S.base;for(const i of document.querySelectorAll('#dlg [data-layer]'))i.checked=!!S.layers[i.dataset.layer];for(const i of document.querySelectorAll('#dlg [data-ui]'))i.checked=!!UI[i.dataset.ui];
  // kilder
  const off=new Set(SET.disabledFeeds||[]),tb=$('srcTbl');tb.textContent='';
  const row=(f,custom)=>{const st=STATUS[f.url];const d=document.createElement('div');d.className='src-row';
    const n=document.createElement('div');n.append(f.src||f.url);const sm=document.createElement('small');sm.textContent=f.url;n.append(sm);
    const s=document.createElement('span');s.className='st '+(off.has(f.url)?'':stCls(st));s.textContent=off.has(f.url)?'av':st?(st.ok?(st.stale?'! ':'✓ '):'✗ ')+stText(st):'venter';if(st&&!st.ok&&st.since)s.title='Feilet første gang '+dfmt.format(new Date(st.since));
    let ctl;if(custom){ctl=document.createElement('button');ctl.className='btn';ctl.type='button';ctl.textContent='Fjern';ctl.onclick=()=>postSet({customFeeds:(SET.customFeeds||[]).filter(x=>x.url!==f.url)},true)}
    else{ctl=document.createElement('label');ctl.className='tg';ctl.title=off.has(f.url)?'Slå på':'Slå av';const i=document.createElement('input');i.type='checkbox';i.checked=!off.has(f.url);i.setAttribute('aria-label',(f.src||'')+' på');
      i.onchange=()=>{const s2=new Set(SET.disabledFeeds||[]);i.checked?s2.delete(f.url):s2.add(f.url);postSet({disabledFeeds:[...s2]},true)};ctl.append(i,document.createElement('i'))}
    d.append(n,s,ctl);return d};
  const rank=f=>{const st=STATUS[f.url];return off.has(f.url)?3:!st?2:st.ok?(st.stale?1:2):0};
  for(const f of [...(SET.builtinFeeds||[])].sort((a,b)=>rank(a)-rank(b)))tb.append(row(f,false));
  const c=srcCounts(Object.values(STATUS||{}).filter(x=>x.src&&!/^(Nyhetsmotor|Mobilvisning|DeepL)/.test(x.src)));
  $('srcHealth').innerHTML=`<b>${c.ok+c.stale}</b> kilder virker.`+(c.paused?` <b>${c.paused}</b> er satt på pause fordi de feilet flere ganger på rad, og prøves igjen automatisk.`:'')+(c.bad?` <b>${c.bad}</b> feilet sist.`:'')+(c.stale?` <b>${c.stale}</b> har ikke hatt nye saker på 14 dager.`:'');
  $('srcRetry').hidden=!(c.paused||c.bad);
  slRender();
  const cu=$('srcCustom');cu.textContent='';for(const f of SET.customFeeds||[])cu.append(row(f,true));
  // oversettelse
  $('kStatus').textContent=SET.hasKey?'✓ En nøkkel er lagret.':'Ingen nøkkel lagret ennå.';$('kDel').hidden=!SET.hasKey;
  $('kUsed').textContent=SET.hasKey?`Brukt i dag: ${(SET.usedToday||0).toLocaleString('nb-NO')} tegn.`:'Bremser bruken så du holder deg innenfor gratiskvoten.';
  // utseende
  $('lTheme').value=LOOK.theme;$('lZoom').value=String(LOOK.zoom);$('lZoom').disabled=!(window.nk&&window.nk.setZoom);
  if($('lZoom').disabled)$('lZoom').title='I nettleseren: bruk Ctrl + og Ctrl −';
  // funksjoner
  for(const i of document.querySelectorAll('#dlg [data-f]'))i.checked=!!(SET.features||{})[i.dataset.f];
  // kategorier
  const ct=$('catTbl'),off2=new Set(SET.catsOff||[]);ct.textContent='';
  for(const[k,c]of Object.entries(CATS)){const d=document.createElement('div');d.className='catrow';
    d.innerHTML=`<span class="sw" style="background:${c.c}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"><path d="${ICON[k]}"/></svg></span><span>${c.n}</span>`;
    const l=document.createElement('label');l.className='tg';const i=document.createElement('input');i.type='checkbox';i.checked=!off2.has(k);i.setAttribute('aria-label',c.n+' på');
    i.onchange=()=>{const o=new Set(SET.catsOff||[]);i.checked?o.delete(k):o.add(k);if(o.size>=KEYS.length){i.checked=true;return}postSet({catsOff:[...o]},true)};l.append(i,document.createElement('i'));d.append(l);ct.append(d)}
  // skjult
  const chipList=(box,arr,empty,onRemove)=>{box.textContent='';for(const t of arr){const sp=document.createElement('span');sp.append(t);const b=document.createElement('button');b.type='button';b.textContent='×';b.setAttribute('aria-label','Vis igjen: '+t);b.onclick=()=>onRemove(t);sp.append(b);box.append(sp)}
    if(!arr.length){const p=document.createElement('p');p.className='meta';p.textContent=empty;box.append(p)}};
  chipList($('muteChips'),SET.muteWords||[],'Ingen ord er skjult.',t=>postSet({muteWords:(SET.muteWords||[]).filter(x=>x!==t)},true));
  chipList($('hidSrcChips'),SET.hiddenSrc||[],'Ingen kilder er skjult.',t=>postSet({hiddenSrc:(SET.hiddenSrc||[]).filter(x=>x!==t)},true));
  // varsler per kategori
  const nc=$('nCats');nc.textContent='';const on=SET.notifyCats?new Set(SET.notifyCats):new Set(KEYS);
  for(const[k,c]of Object.entries(CATS)){const l=document.createElement('label');l.className='ncat';const i=document.createElement('input');i.type='checkbox';i.checked=on.has(k);
    i.onchange=()=>{const n=new Set(SET.notifyCats||KEYS);i.checked?n.add(k):n.delete(k);postSet({notifyCats:n.size===KEYS.length?null:[...n]},true)};
    const d=document.createElement('i');d.style.background=c.c;l.append(i,d,c.n);nc.append(l)}
  // aksjer jeg følger
  const tc=$('tkChips');tc.textContent='';for(const t of SET.marketWatch||[]){const sp=document.createElement('span');sp.append(t);const b=document.createElement('button');b.type='button';b.textContent='×';b.setAttribute('aria-label','Fjern '+t);
    b.onclick=()=>postSet({marketWatch:(SET.marketWatch||[]).filter(x=>x!==t)},true);sp.append(b);tc.append(sp)}
  if(!(SET.marketWatch||[]).length){const p=document.createElement('p');p.className='meta';p.textContent='Ingen aksjer lagt til.';tc.append(p)}
  // hjemsted
  $('hStatus').textContent=SET.home?'✓ Hjemsted: '+SET.home.name:'Ikke valgt ennå.';$('hDel').hidden=!SET.home;
  if(!$('hList').children.length)fetch('/api/places').then(r=>r.json()).then(a=>{PLACES=a;a.sort((x,y)=>(y[3]==='NO')-(x[3]==='NO')||x[0].localeCompare(y[0],'nb'));
    $('hList').innerHTML=a.map(p=>`<option value="${esc(p[0]+(p[3]&&p[3]!=='NO'?', '+p[3]:''))}">`).join('')}).catch(()=>{});
  // digest
  if(!$('dgTime').options.length)for(let h=4;h<24;h++)$('dgTime').add(new Option(String(h).padStart(2,'0')+':00',String(h).padStart(2,'0')+':00'));
  if(SET.digestTime)$('dgTime').value=SET.digestTime;
  // skip
  $('dxStatus').textContent=SET.datexUser?'✓ Lagret for '+SET.datexUser+(SET.hasDatexPass?'':' (mangler passord)'):'Ingen tilgang lagret.';if(!soft||document.activeElement!==$('dxUser'))$('dxUser').value=SET.datexUser||'';
  $('bwStatus').textContent=SET.shipsClient?'✓ Klient lagret: '+SET.shipsClient+(SET.hasShipsSecret?'':' (mangler hemmelighet)'):'Ingen klient lagret.';
  if(!soft||document.activeElement!==$('bwId'))$('bwId').value=SET.shipsClient||'';
  // mobil
  const lb=$('lanBox');lb.textContent='';
  if(SET.lan){const u=SET.lanUrls||[];
    if(!u.length)lb.innerHTML='<p class="meta">Starter mobilvisningen … Fant ingen nettverkstilkobling ennå hvis dette ikke forsvinner.</p>';
    else{lb.innerHTML=`<p class="meta">Skann koden med mobilkameraet, eller åpne lenken i nettleseren på mobilen:</p><div class="codebox">${esc(u[0])}</div>${u.length>1?'<p class="meta">Andre adresser: '+u.slice(1).map(esc).join(', ')+'</p>':''}`;
      const q=document.createElement('div');q.className='lanqr';try{q.innerHTML=qrSvg(u[0],5)}catch(e){}lb.append(q);
      const row=document.createElement('div');row.className='inl';const c=document.createElement('button');c.className='btn';c.type='button';c.textContent='Kopier lenke';c.onclick=async()=>{c.textContent=await copyText(u[0])?'Kopiert ✓':'Kunne ikke kopiere'};
      const n=document.createElement('button');n.className='btn';n.type='button';n.textContent='Lag ny lenke';n.title='Gamle lenker slutter å virke';n.onclick=()=>postSet({newLanToken:true},true);row.append(c,n);lb.append(row)}}
  // data
  $('dRead').textContent=READ.size+' saker er merket som lest.';$('dSaved').textContent=SAVED.size+' saker er lagret.';
}
let PLACES=[];
$('dlg').addEventListener('change',e=>{const el=e.target;
  if(el.dataset.f){setFeature(el.dataset.f,el.checked);return}
  if(el.id==='lTheme'||el.id==='lZoom'){LOOK.theme=$('lTheme').value;LOOK.zoom=+$('lZoom').value;store.set('nk-look',LOOK);applyLook();savedFlash();return}
  if(el.dataset.k){let v=el.type==='checkbox'?el.checked:el.value;if(el.dataset.num!=null)v=+v;postSet({[el.dataset.k]:v});if(el.dataset.restart!=null&&IS_APP)setTimeout(()=>window.nk.restartTicker(),700);return}
  if(el.dataset.layer){S.layers[el.dataset.layer]=el.checked;store.set('nk-layers',S.layers);applyLayers();updateMap();savedFlash();return}
  if(el.dataset.ui){UI[el.dataset.ui]=el.checked;store.set('nk-ui',UI);applyUI();savedFlash();return}
  if(el.id==='mBase'){S.base=el.value;store.set('nk-base',S.base);applyBase();savedFlash();return}
  if(el.id==='qOn'||el.id==='qFrom'||el.id==='qTo'){postSet({quiet:{on:$('qOn').checked,from:+$('qFrom').value,to:+$('qTo').value}});return}
  if(el.id==='sLogin'){window.nk.setLogin(el.checked);savedFlash();return}
  if(el.id==='tNow'){window.nk.toggleTicker();return}});
$('wForm').onsubmit=e=>{e.preventDefault();const v=$('wIn').value.trim();if(!v)return;$('wIn').value='';postSet({watch:[...(SET.watch||[]),v]},true)};
// lokalavis: hvilken avis som er valgt for hjemstedet
async function localStatus(){const el=$('localSt');if(!el)return;if(!SET.home){el.textContent='Legger til lokalavisa nærmest hjemstedet. Velg hjemsted først.';return}
  let r;try{r=await (await fetch('/api/local')).json()}catch(e){return}const p=r.paper,n=r.near;
  el.textContent=!n?'Fant ingen lokalavis innen 150 km fra hjemstedet.':n.builtin?n.name+' er nærmest, og den er allerede med blant kildene.':p&&p.name===n.name?(p.url?p.name+' er lagt til som kilde ('+p.km+' km unna).':p.name+' er nærmest, men RSS-strømmen virket ikke. Appen prøver igjen i morgen.'):n.name+' legges til ved neste henting.'}
// egne kildelister
let SL_EDIT=null;
function slRender(){const ch=$('slChips');ch.textContent='';for(const l of SET.srcLists||[]){const sp=document.createElement('span');sp.className='ed';sp.title='Endre lista';sp.append(l.name+' ('+l.srcs.length+')');
    sp.onclick=ev=>{if(ev.target.tagName==='BUTTON')return;SL_EDIT=l.name;$('slName').value=l.name;slPick(new Set(l.srcs))};
    const b=document.createElement('button');b.type='button';b.textContent='×';b.setAttribute('aria-label','Slett lista '+l.name);b.onclick=()=>{if(SRCSEL==='u:'+l.name){SRCSEL='';store.set('nk-srclist','')}postSet({srcLists:(SET.srcLists||[]).filter(x=>x.name!==l.name)},true)};sp.append(b);ch.append(sp)}
  if(!(SET.srcLists||[]).length){const p=document.createElement('p');p.className='meta';p.textContent='Ingen egne lister ennå. Gi lista et navn, kryss av kildene og lagre.';ch.append(p)}
  if(!$('slPick').children.length)slPick(new Set())}
function slPick(on){const box=$('slPick');box.textContent='';const names=[...new Set([...(SET.builtinFeeds||[]),...(SET.customFeeds||[])].map(f=>f.src).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'nb'));
  for(const n of names){const l=document.createElement('label');const i=document.createElement('input');i.type='checkbox';i.value=n;i.checked=on.has(n);l.append(i,n);box.append(l)}slFind()}
function slFind(){const q=$('slFind').value.trim().toLowerCase();for(const l of $('slPick').children)l.hidden=!!q&&!l.textContent.toLowerCase().includes(q)}
$('slFind').oninput=slFind;
$('slForm').onsubmit=e=>{e.preventDefault();const name=$('slName').value.trim(),srcs=[...$('slPick').querySelectorAll('input:checked')].map(i=>i.value);
  if(!name){$('slStatus').textContent='Gi lista et navn.';$('slName').focus();return}if(!srcs.length){$('slStatus').textContent='Kryss av minst én kilde.';return}
  const rest=(SET.srcLists||[]).filter(x=>x.name!==name&&x.name!==SL_EDIT);if(SL_EDIT&&SL_EDIT!==name&&SRCSEL==='u:'+SL_EDIT){SRCSEL='u:'+name;store.set('nk-srclist',SRCSEL)}
  postSet({srcLists:[...rest,{name,srcs}]},true);$('slStatus').textContent='Lagret «'+name+'» med '+srcs.length+(srcs.length===1?' kilde.':' kilder.')+' Velg den ved søkefeltet.';SL_EDIT=null;$('slName').value='';slPick(new Set())};
$('fForm').onsubmit=e=>{e.preventDefault();const url=$('fUrl').value.trim(),src=$('fName').value.trim();
  if(!/^https:\/\/[^\s]+$/.test(url)){$('fUrl').focus();$('sSaved').textContent='Adressen må starte med https://';$('sSaved').classList.add('on');return}
  $('fUrl').value='';$('fName').value='';postSet({customFeeds:[...(SET.customFeeds||[]),{src,url}]},true)};
$('kForm').onsubmit=e=>{e.preventDefault();const k=$('sKey').value.trim();if(!k)return;$('sKey').value='';postSet({deeplKey:k,translate:true},true)};
$('kDel').onclick=()=>postSet({deeplKey:''},true);
$('kShow').onclick=()=>{$('dlg').close();$('keys').showModal()};
$('muteForm').onsubmit=e=>{e.preventDefault();const v=$('muteIn').value.trim().toLowerCase();if(v.length<2)return;$('muteIn').value='';postSet({muteWords:[...new Set([...(SET.muteWords||[]),v])]},true)};
$('dxForm').onsubmit=e=>{e.preventDefault();const u=$('dxUser').value.trim(),p=$('dxPass').value;if(!u)return;$('dxPass').value='';postSet({datex:p?{user:u,pass:p}:{user:u}},true)};
$('srcRetry').onclick=async()=>{$('srcRetry').disabled=true;$('srcRetry').textContent='Prøver …';try{await fetch('/api/retry-feeds',{method:'POST'})}catch(e){}setTimeout(()=>{$('srcRetry').disabled=false;$('srcRetry').textContent='Prøv alle på nytt'},8000)};
$('tkForm').onsubmit=async e=>{e.preventDefault();const v=$('tkIn').value.trim().toUpperCase();if(!v)return;
  if(!/^[A-Z0-9^.=\-]{1,15}$/.test(v)){$('tkStatus').textContent='Ugyldig ticker.';return}
  if((SET.marketWatch||[]).includes(v)){$('tkStatus').textContent=v+' er allerede lagt til.';return}
  $('tkStatus').textContent='Sjekker '+v+' …';
  try{const r=await fetch('/api/quote?s='+encodeURIComponent(v));const q=await r.json();if(!r.ok)throw 0;
    $('tkStatus').textContent='✓ '+q.name+', '+fmtNum(q.price)+' '+(q.cur||'');$('tkIn').value='';postSet({marketWatch:[...(SET.marketWatch||[]),v]},true)}
  catch(x){$('tkStatus').textContent='Fant ikke '+v+' hos Yahoo Finance. Sjekk at du har med børsendelsen, for eksempel .OL.'}};
$('hForm').onsubmit=e=>{e.preventDefault();const v=$('hIn').value.trim().toLowerCase();if(!v)return;
  const m=PLACES.find(p=>(p[0]+(p[3]&&p[3]!=='NO'?', '+p[3]:'')).toLowerCase()===v)||PLACES.find(p=>p[0].toLowerCase()===v)||PLACES.find(p=>p[0].toLowerCase().startsWith(v));
  if(!m){$('hStatus').textContent='Fant ikke stedet. Velg et sted fra lista som dukker opp når du skriver.';return}
  $('hIn').value='';postSet({home:{name:m[0],lat:m[1],lon:m[2]}},true)};
$('hDel').onclick=()=>postSet({home:null},true);
$('bwForm').onsubmit=e=>{e.preventDefault();const id=$('bwId').value.trim(),sec=$('bwSec').value.trim();if(!id)return;$('bwSec').value='';
  postSet({ships:sec?{clientId:id,clientSecret:sec}:{clientId:id}},true)};
$('mReset').onclick=()=>{if(map)map.flyTo({center:[12,40],zoom:1.9,duration:reduced?0:1400});store.set('nk-view2',null);savedFlash()};
$('dCopy').onclick=async()=>{const txt=[...SAVED.values()].map(s=>`${s.title}\n${s.url||''}`).join('\n\n')||'(ingen lagrede saker)';
  try{await navigator.clipboard.writeText(txt);$('sSaved').textContent='Kopiert ✓';$('sSaved').classList.add('on')}catch(e){$('sSaved').textContent='Kunne ikke kopiere';$('sSaved').classList.add('on')}};
if(IS_APP)$('dOpen').onclick=()=>window.nk.openData();
// knapper som må trykkes to ganger
document.querySelectorAll('#dlg [data-confirm]').forEach(b=>{const label=b.textContent;b.onclick=async()=>{
  if(!b.classList.contains('danger')){b.classList.add('danger');b.textContent='Trykk igjen for å bekrefte';setTimeout(()=>{b.classList.remove('danger');b.textContent=label},4000);return}
  b.classList.remove('danger');b.textContent=label;const a=b.dataset.confirm;
  if(a==='readclear'){READ.clear();saveRead();list()}
  else if(a==='savedclear'){SAVED.clear();saveSaved();list()}
  else if(a==='newsclear'){await fetch('/api/clear',{method:'POST'}).catch(()=>{})}
  else if(a==='uireset'){for(const k of ['nk-cats','nk-period','nk-scope','nk-base','nk-layers','nk-ui','nk-view2','nk-sec'])store.set(k,null);location.reload();return}
  renderSettings();savedFlash()}});
// ---------- oppdateringer i appen ----------
function updUI(s){if(!s)return;const fmtMB=b=>b?' ('+(b/1048576).toFixed(b>1e7?0:1)+' MB)':'';
  $('verTxt').textContent='';$('uVer').textContent='Versjon '+(s.current||'–');
  const txt={idle:'Klar til å se etter oppdateringer.',checking:'Ser etter oppdateringer …',downloading:'Laster ned versjon '+s.ver+fmtMB(s.size)+' …',
    ready:'Versjon '+s.ver+' er lastet ned. Den installeres når du lukker appen, eller med en gang om du starter på nytt.',none:'Du har nyeste versjon.',
    error:'Kunne ikke se etter oppdateringer: '+(s.msg||'ukjent feil'),off:s.msg||'Oppdatering er ikke tilgjengelig her.'}[s.state]||'';
  $('updStatus').textContent=txt+(s.at&&s.state!=='checking'?' Sist sjekket kl. '+tfmt.format(new Date(s.at))+'.':'');
  $('updApply').hidden=s.state!=='ready';$('updCheck').disabled=s.state==='checking'||s.state==='downloading';$('navUpdDot').hidden=s.state!=='ready';
  const show=s.state==='ready'&&store.get('nk-upd-later')!==s.ver;$('updbar').hidden=!show;document.body.classList.toggle('has-upd',show);
  if(show)$('updTxt').innerHTML='<b>Nyhetskloden '+esc(s.ver)+'</b> er klar. Start på nytt for å oppdatere, eller la den installeres når du lukker appen.'}
if(IS_APP){window.nk.updateState().then(updUI);window.nk.onUpdate(updUI);
  $('updCheck').onclick=()=>window.nk.checkUpdates();$('updApply').onclick=$('updNow').onclick=()=>window.nk.applyUpdate();
  $('updLater').onclick=()=>{window.nk.updateState().then(s=>{store.set('nk-upd-later',s.ver);updUI(s)})};
  $('tickerBtn').hidden=false;$('tickerBtn').onclick=()=>window.nk.toggleTicker();
  if(window.nk.onOpenSettings)window.nk.onOpenSettings(()=>openSettings());
  if(window.nk.onOpenTab)window.nk.onOpenTab(t=>{S.tab=t;S.cc=null;S.cats=new Set(KEYS);S.tl=null;S.period=t==='top'&&+S.period<24?'24':S.period;tlSync();refresh();if($('dlg').open)$('dlg').close()});
  window.nk.onOpen(id=>{if(id==='nk:sources'){openSettings('sources');return}if(id==='nk:week'){setSide('news');SINCE=null;DIGW=true;store.set('nk-digw',true);$('digest').open=true;digest();return}if(id==='nk:cal'){setSide('news');loadCal();$('cal').open=true;$('cal').scrollIntoView({block:'nearest'});return}if(id.startsWith('nk:market:')){setSide('market');openDetail(id.slice(10));return}const n=NEWS.find(n=>n.id===id||n.eid===id);const e=n&&EVENTS.find(e=>e.items.includes(n));if(e){S.period='168';S.cats=new Set(KEYS);S.cc=null;S.tab='all';S.tl=null;tlSync();refresh();select(e.id,true)}})}
else{$('updStatus').textContent='Oppdateringer styres av Windows-appen. Du kjører nå nyhetsmotoren i en vanlig nettleser.';$('updCheck').hidden=true;$('uVer').textContent='Nettleserversjon'}
applyUI();
tlSync();
load().catch(err=>{$('liveTxt').textContent='Fant ikke nyhetsmotoren';console.error(err)});
