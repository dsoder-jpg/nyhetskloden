// Nyhetskloden: features.js (lastes i rekkefølge fra index.html, deler globale navn med de andre filene)
// ---------- innstillinger fra motoren som styrer funksjoner ----------
let lastF='';
function applyFeatures(){OFF=new Set(SET.catsOff||[]);HOME=SET.home||null;const prev=F;F=SET.features||{};
  const ms0=JSON.stringify([SET.muteWords,SET.hiddenSrc]);if(ms0!==applyFeatures.m){applyFeatures.m=ms0;muteSetup();if(NEWS.length)buildEvents()}
  srcListSetup();if(typeof renderCal==='function')renderCal();localStatus();$('tabNear').hidden=!(F.near&&HOME);if(S.tab==='near'&&$('tabNear').hidden)S.tab='all';
  for(const i of $('layers').querySelectorAll('[data-f]'))i.checked=!!F[i.dataset.f];
  const sig=JSON.stringify([F,SET.marketWatch,SET.portfolio,HOME,SET.nearKm,SET.shipsClient]);if(sig===lastF){refresh();return}lastF=sig;
  tkCache.clear();renderMarket();loadMarket();loadPortfolio();nightImgUpdate();loadWeather();loadFlights();setShipLayer();loadWxMap();loadRadar();loadStorms();loadLights();loadTraffic();loadPower();refresh()}
function setFeature(k,v){F[k]=v;postSet({features:{...(SET.features||{}),...F,[k]:v}},true)}
async function initSettings(){try{SET=await (await fetch('/api/settings')).json()}catch(e){SET={}}applyFeatures();if(SET&&SET.onboarded===false&&!IS_LAN)setTimeout(openWelcome,600)}
// ---------- innsikt ----------
let INS_D=7;
function chg(n,p){if(!p)return n?'<span class="up">ny</span>':'';const r=Math.round((n-p)/p*100);return r===0?'<span class="fl">±0 %</span>':`<span class="${r>0?'up':'dn'}">${r>0?'+':'−'}${Math.abs(r)} %</span>`}
async function openInsight(){if(!$('ins').open)$('ins').showModal();$('iBody').innerHTML='<p class="meta">Regner ut …</p>';
  for(const b of $('iPer').children)b.setAttribute('aria-pressed',+b.dataset.d===INS_D);
  let d;try{d=await (await fetch('/api/insights?days='+INS_D)).json()}catch(e){$('iBody').innerHTML='<p class="meta">Fikk ikke regnet ut innsikt. Prøv igjen om litt.</p>';return}
  const P=INS_D===7?'uke':'måned',young=d.since&&Date.now()-new Date(d.since)<INS_D*2*864e5;
  let h=`<div class="wide"><p class="lead"><b>${d.total.toLocaleString('nb-NO')}</b> hendelser fra <b>${d.articles.toLocaleString('nb-NO')}</b> saker de siste ${INS_D} dagene`+(d.totalPrev&&!young?`, mot ${d.totalPrev.toLocaleString('nb-NO')} forrige ${P}.`:'.')+`</p>`+
    (young?`<p class="meta">Arkivet startet ${dfmt.format(new Date(d.since))}, så sammenligningen med forrige ${P} blir riktig først etter hvert.</p>`:'')+`</div>`;
  if(!d.total){$('iBody').innerHTML=h+'<p class="meta wide">Ingen saker i arkivet ennå. Innsikt fylles opp mens appen kjører.</p>';return}
  const mx=d.perDay.reduce((m,x)=>Math.max(m,x.n),1);
  h+=`<section class="wide"><h3>Hendelser per dag</h3><div class="iday">${d.perDay.map(x=>`<div style="height:${Math.max(2,x.n/mx*100)}%" title="${dfmt.format(new Date(x.day+'T12:00')).replace(/\s?kl\..*$/,'')}: ${x.n}"></div>`).join('')}</div><div class="idayl"><span>${new Date(d.perDay[0].day).toLocaleDateString('nb-NO',{day:'numeric',month:'short'})}</span><span>i dag</span></div></section>`;
  const bars=(rows,lab)=>{const m=rows.reduce((a,x)=>Math.max(a,x.n),1);return`<ul class="ibars">${rows.map(x=>`<li><span>${esc(lab(x))}</span><span class="bar"><i style="width:${x.n/m*100}%"></i></span><span class="n">${x.n}</span><span class="d">${young?'':chg(x.n,x.prev)}</span></li>`).join('')}</ul>`};
  h+=`<section><h3>Land med mest omtale</h3>${bars(d.countries,x=>cname(x.cc)||x.cc)}</section>`;
  h+=`<section><h3>Temaer</h3>${bars(d.cats,x=>(CATS[x.cat]||CATS.annet).n)}</section>`;
  if(d.rising.length)h+=`<section><h3>Ord som øker</h3><div class="iwords">${d.rising.map(r=>`<button data-w="${esc(r.w)}" title="${r.n} hendelser, ${r.prev} forrige ${P}">${esc(r.w)}${!young&&r.prev<r.n?`<small>+${r.n-r.prev}</small>`:''}</button>`).join('')}</div><p class="meta">Klikk på et ord for å søke etter det.</p></section>`;
  if(d.big.length)h+=`<section><h3>Saker flest kilder skrev om</h3><ul class="ibig">${d.big.map((b,i)=>`<li><button data-i="${i}">${esc(b.title)}<small>${b.srcs} kilder${b.place?', '+esc(b.place):''}, ${dfmt.format(new Date(b.date))}</small></button></li>`).join('')}</ul></section>`;
  $('iBody').innerHTML=h;
  for(const b of $('iBody').querySelectorAll('.iwords button'))b.onclick=()=>{$('ins').close();$('q').value=b.dataset.w;S.q=b.dataset.w;ARCH=null;setSide('news');refresh();searchArchive()};
  for(const b of $('iBody').querySelectorAll('.ibig button'))b.onclick=()=>{const x=d.big[+b.dataset.i];$('ins').close();const c=CATS[x.cat]||CATS.annet;S.sel=null;
    showCard({color:c.c,tag:c.n+', fra arkivet',title:x.title,meta:[x.place,dfmt.format(new Date(x.date)),x.srcs+' kilder'],srcs:[],url:x.url,urlText:'Les saken',star:false});
    if(x.lat!=null&&map)map.flyTo({center:[x.lon,x.lat],zoom:Math.max(map.getZoom(),4),duration:reduced?0:1600})}}
$('insBtn').onclick=openInsight;$('iX').onclick=()=>$('ins').close();
$('iPer').addEventListener('click',e=>{const b=e.target.closest('button');if(b){INS_D=+b.dataset.d;openInsight()}});

// ---------- oppstartsveiviser ----------
let wS=0;const W_STEPS=4;
async function openWelcome(){if($('wel').open)return;
  if(!PLACES.length)try{PLACES=await (await fetch('/api/places')).json();$('hList').innerHTML=PLACES.map(p=>`<option value="${esc(p[0]+(p[3]&&p[3]!=='NO'?', '+p[3]:''))}">`).join('')}catch(e){}
  if(SET.home)$('wHome').value=SET.home.name;
  const wc=$('wCats');wc.textContent='';const off=new Set(SET.catsOff||[]);
  for(const[k,c]of Object.entries(CATS)){const l=document.createElement('label');l.innerHTML=`<span class="sw" style="background:${c.c}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"><path d="${ICON[k]}"/></svg></span><span>${c.n}</span>`;
    const i=document.createElement('input');i.type='checkbox';i.checked=!off.has(k);i.dataset.c=k;l.append(i);wc.append(l)}
  if(!IS_APP){for(const x of document.querySelectorAll('#wel [data-s="2"]'))x.dataset.skip='1'}
  wS=0;wShow();$('wel').showModal()}
function wHomePick(){const v=$('wHome').value.trim().toLowerCase();if(!v)return null;
  return PLACES.find(p=>(p[0]+(p[3]&&p[3]!=='NO'?', '+p[3]:'')).toLowerCase()===v)||PLACES.find(p=>p[0].toLowerCase()===v)||PLACES.find(p=>p[0].toLowerCase().startsWith(v))||false}
function wShow(){for(const x of document.querySelectorAll('#wel .wstep'))x.hidden=+x.dataset.s!==wS;
  $('wStep').textContent=`Steg ${wS+1} av ${W_STEPS}`;$('wBack').hidden=wS===0;$('wNext').textContent=wS===W_STEPS-1?'Start':'Neste';$('wSkip').hidden=wS===W_STEPS-1;
  const f=document.querySelector(`#wel .wstep[data-s="${wS}"] input`);if(f)setTimeout(()=>f.focus(),50)}
$('wNext').onclick=()=>{
  if(wS===0&&$('wHome').value.trim()){const m=wHomePick();if(m===false){$('wHomeMsg').textContent='Fant ikke stedet. Velg fra lista som dukker opp når du skriver, eller la feltet stå tomt.';return}$('wHomeMsg').textContent=''}
  if(wS<W_STEPS-1){wS++;if(document.querySelector(`#wel .wstep[data-s="${wS}"]`).dataset.skip)wS++;wShow();return}
  wFinish(true)};
$('wBack').onclick=()=>{wS--;if(document.querySelector(`#wel .wstep[data-s="${wS}"]`).dataset.skip)wS--;wShow()};
$('wSkip').onclick=()=>wFinish(false);
$('welForm').addEventListener('submit',e=>{e.preventDefault();$('wNext').click()});
$('wel').addEventListener('cancel',e=>{e.preventDefault();wFinish(false)});
function wFinish(apply){const b={onboarded:true};
  if(apply){const m=wHomePick();if(m)b.home={name:m[0],lat:m[1],lon:m[2]};
    b.catsOff=[...document.querySelectorAll('#wCats input')].filter(i=>!i.checked).map(i=>i.dataset.c);if(b.catsOff.length>=KEYS.length)b.catsOff=[];
    if(IS_APP){const n=(document.querySelector('#wel input[name=wN]:checked')||{}).value;if(n==='off')b.notify=false;else if(n){b.notify=true;b.notifyMode=n}b.digest=$('wDigest').checked;
      if(window.nk.setNotify)window.nk.setNotify(b.notify!==false)}}
  $('wel').close();postSet(b,true)}

// ---------- utseende ----------
const LOOK=Object.assign({theme:'dark',zoom:1},store.get('nk-look',{}));
const darkMQ=matchMedia('(prefers-color-scheme: dark)');
function applyLook(){const t=LOOK.theme==='system'?(matchMedia('(forced-colors: active)').matches?'contrast':darkMQ.matches?'dark':'light'):LOOK.theme;document.documentElement.dataset.theme=t;
  if(window.nk&&window.nk.setZoom)window.nk.setZoom(+LOOK.zoom||1)}
darkMQ.addEventListener('change',applyLook);applyLook();
