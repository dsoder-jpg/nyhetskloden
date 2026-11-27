// Nyhetskloden: tools.js (lastes sist, deler globale navn med de andre filene)
// ---------- opplesning ----------
// Bruker stemmene i Windows. Norsk stemme velges hvis den finnes.
let SAY=null;
function sayReset(){if(!SAY)return;const b=SAY.btn;SAY=null;if(b){b.setAttribute('aria-pressed','false');b.textContent='Les opp'}}
function say(lines,btn){const ss=window.speechSynthesis;
  if(!ss){toastMsg('Opplesning støttes ikke her.');return}
  if(SAY){const same=SAY.btn===btn;ss.cancel();sayReset();if(same)return}
  // korte biter, ellers stopper enkelte stemmer midt i
  const parts=[];for(const l of lines){for(const s of String(l).match(/[^.!?]+[.!?]*\s*/g)||[]){const t=s.trim();if(!t)continue;const last=parts[parts.length-1];if(last&&last.length+t.length<220)parts[parts.length-1]=last+' '+t;else parts.push(t)}}
  if(!parts.length)return;
  const vs=ss.getVoices(),v=vs.find(x=>/^nb|^no/i.test(x.lang))||vs.find(x=>/^nn|^da|^sv/i.test(x.lang))||null;
  SAY={btn};if(btn){btn.setAttribute('aria-pressed','true');btn.textContent='Stopp'}
  parts.forEach((t,i)=>{const u=new SpeechSynthesisUtterance(t);u.lang=v?v.lang:'nb-NO';if(v)u.voice=v;u.rate=1.02;
    if(i===parts.length-1)u.onend=()=>{if(SAY&&SAY.btn===btn)sayReset()};u.onerror=()=>{if(SAY&&SAY.btn===btn)sayReset()};ss.speak(u)})}
if(window.speechSynthesis)speechSynthesis.getVoices();

// ---------- lesemodus ----------
let RD=null;
$('cRead').onclick=()=>{if(cardEv)openReader(cardEv)};
async function openReader(e){const d=$('reader');RD=e.url;$('rSrc').textContent=e.src||'';$('rOpen').href=e.url;$('rBody').innerHTML='<p class="meta">Henter saken …</p>';$('rSay').hidden=true;
  if(!d.open)d.showModal();
  let a;try{a=await (await fetch('/api/read?url='+encodeURIComponent(e.url))).json()}catch(x){a={error:'ingen kontakt med appen'}}
  if(RD!==e.url)return;const b=$('rBody');b.textContent='';
  if(a.error){b.innerHTML=`<h1>${esc(e.title)}</h1><p class="rnote">Fikk ikke hentet saken (${esc(a.error)}). Åpne den hos kilden i stedet.</p>`;return}
  const h=document.createElement('h1');h.id='rTitle';h.textContent=a.title||e.title;b.append(h);
  const m=document.createElement('p');m.className='meta';m.textContent=[a.byline,a.date&&!isNaN(new Date(a.date))?dfmt.format(new Date(a.date)):null,a.words>80?'ca. '+Math.max(1,Math.round(a.words/220))+' min lesing':null].filter(Boolean).join(', ');b.append(m);
  if(a.img&&F.images!==false){const im=document.createElement('img');im.alt='';im.referrerPolicy='no-referrer';im.onerror=()=>im.remove();im.src=a.img;b.append(im)}
  if(a.paywall){const p=document.createElement('p');p.className='rnote';p.textContent='Saken ser ut til å være for abonnenter. Her er det som er åpent. Resten kan du lese hos kilden.';b.append(p)}
  if(!a.blocks.length&&a.desc){const p=document.createElement('p');p.className='lead';p.textContent=a.desc;b.append(p)}
  let ul=null;
  for(const x of a.blocks){if(x.t==='li'){if(!ul){ul=document.createElement('ul');b.append(ul)}const li=document.createElement('li');li.textContent=x.text;ul.append(li);continue}ul=null;
    const el=document.createElement(x.t==='h'?'h2':x.t==='q'?'blockquote':'p');el.textContent=x.text;b.append(el)}
  $('rSay').hidden=false;$('rSay').onclick=()=>say([a.title||e.title,...(a.blocks.length?a.blocks.map(x=>x.text):[a.desc||''])],$('rSay'));
  b.scrollTop=0}
$('rX').onclick=()=>$('reader').close();
$('reader').addEventListener('close',()=>{RD=null;if(SAY&&SAY.btn===$('rSay')){speechSynthesis.cancel();sayReset()}});
$('reader').addEventListener('click',e=>{if(e.target===$('reader'))$('reader').close()});

// ---------- når kildene oppgir ulike tall ----------
const FIG_K='drept|drepte|døde|død|omkom|omkommet|dødsofre|killed|dead|deaths|died',FIG_I='skadd|skadde|skadet|såret|sårede|injured|wounded|hurt';
// «kills 15», «dødstallet er nå 40»: tallet kommer etter ordet, med bare småord imellom
const FIG_B={drepte:'kill|kills|killing|dreper|death toll|dødstallet|dødstall',skadde:'injuring|injures|skader'},FIG_FILL='(?:(?:at|least|minst|over|more|than|er|is|has|har|nå|now|rises|risen|stiger|steget|to|til|nearly|nesten|ca\\.?|about)\\s+){0,4}';
function figures(t){const out=[],s=' '+String(t||'').toLowerCase().replace(/(\d)[ .](\d{3})\b/g,'$1$2')+' ';
  for(const [kind,w] of [['drepte',FIG_K],['skadde',FIG_I]]){
    const a=new RegExp('(\\d{1,6})\\s+(?:(?!og\\b|and\\b)[\\p{L}-]+\\s+){0,2}?(?:'+w+')\\b','gu'),b=new RegExp('\\b(?:'+FIG_B[kind]+')\\s+'+FIG_FILL+'(\\d{1,6})\\b','gu');
    for(const re of [a,b])for(const m of s.matchAll(re)){const n=+m[1],after=s.slice(m.index+m[0].length,m.index+m[0].length+8),mid=m[0].split(/\s+/)[1]||'';
      if(!n||n>2e6||/^(19|20)\d\d$/.test(m[1])||/^\s*(%|prosent)/.test(after)||/^(år|years|year|åring)/.test(mid))continue;
      if(!out.some(x=>x.kind===kind&&x.n===n))out.push({kind,n})}}
  return out}
function disagree(e){const by={};
  for(const n of e.items)for(const f of figures(n.title+' '+(n.titleNo||''))){(by[f.kind]=by[f.kind]||new Map());const m=by[f.kind];const r=m.get(f.n)||{n:f.n,srcs:new Set(),last:''};r.srcs.add(n.src);if(n.date>r.last)r.last=n.date;m.set(f.n,r)}
  const lines=[];
  for(const kind of ['drepte','skadde']){const m=by[kind];if(!m||m.size<2)continue;const rows=[...m.values()].sort((a,b)=>a.n-b.n),newest=[...rows].sort((a,b)=>b.last.localeCompare(a.last))[0];
    lines.push(`Kildene oppgir ulike tall for ${kind}: `+rows.map(r=>`${nf0.format(r.n)} (${[...r.srcs].slice(0,3).join(', ')})`).join(', ')+`. Nyeste melding sier ${nf0.format(newest.n)}.`)}
  return lines.join(' ')}

// ---------- kalender ----------
let CALS=[];
const CALK={rente:'Rente',valg:'Valg'};
async function loadCal(){clearTimeout(loadCal.t);try{const r=await (await fetch('/api/calendar')).json();if(Array.isArray(r))CALS=r}catch(e){}renderCal();loadCal.t=setTimeout(loadCal,6*3600e3)}
function renderCal(){const box=$('calList'),now=new Date(),lim=Date.now()+45*864e5;
  const ev=CALS.filter(e=>Date.parse(e.date+'T23:59:59')>=Date.now()&&Date.parse(e.date)<=lim).slice(0,8);
  $('cal').hidden=!ev.length||F.calendar===false;box.textContent='';
  const dayTxt=d=>{const t=new Date(d+'T12:00:00'),diff=Math.round((t-new Date(now.getFullYear(),now.getMonth(),now.getDate(),12))/864e5);return diff===0?'I dag':diff===1?'I morgen':diff<7?new Intl.DateTimeFormat('nb-NO',{weekday:'long'}).format(t).replace(/^./,c=>c.toUpperCase()):new Intl.DateTimeFormat('nb-NO',{day:'numeric',month:'short'}).format(t)};
  const soon=ev.filter(e=>{const d=dayTxt(e.date);return d==='I dag'||d==='I morgen'}).length;
  $('calT').textContent='Kommer'+(soon?` (${soon} snart)`:'');
  for(const e of ev){const li=document.createElement('li');li.className='k-'+(CALK[e.kind]?e.kind:'annet');
    const w=document.createElement('time');w.dateTime=e.date;w.textContent=dayTxt(e.date);
    const t=e.url?document.createElement('a'):document.createElement('span');t.textContent=e.title;if(e.url){t.href=e.url;t.target='_blank';t.rel='noopener'}
    const m=document.createElement('small');m.textContent=[CALK[e.kind]||null,e.time?'kl. '+e.time:null].filter(Boolean).join(', ');
    const d=document.createElement('div');d.append(t,m);li.append(w,d);box.append(li)}}

// ---------- område på kartet ----------
let AREA=store.get('nk-area',null),areaPick=false;
const inArea=e=>!AREA||(e.lat!=null&&distKm(AREA,e)<=AREA.km);
function areaCircle(a){const pts=[],R=6371,d=a.km/R,lat=a.lat*Math.PI/180,lon=a.lon*Math.PI/180;
  for(let i=0;i<=72;i++){const b=i/72*2*Math.PI,la=Math.asin(Math.sin(lat)*Math.cos(d)+Math.cos(lat)*Math.sin(d)*Math.cos(b)),lo=lon+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(lat),Math.cos(d)-Math.sin(lat)*Math.sin(la));pts.push([lo*180/Math.PI,la*180/Math.PI])}
  return{type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'Polygon',coordinates:[pts]},properties:{}}]}}
function areaDraw(){if(!ready)return;if(!map.getSource('area')){map.addSource('area',{type:'geojson',data:EMPTY});
    map.addLayer({id:'area-fill',type:'fill',source:'area',paint:{'fill-color':'#5fb3ff','fill-opacity':.07}},'pts');
    map.addLayer({id:'area-line',type:'line',source:'area',paint:{'line-color':'#5fb3ff','line-width':1.6,'line-dasharray':[3,2],'line-opacity':.9}},'pts')}
  map.getSource('area').setData(AREA?areaCircle(AREA):EMPTY);
  $('areaBar').hidden=!AREA&&!areaPick;$('bArea')&&$('bArea').setAttribute('aria-pressed',String(!!AREA||areaPick));
  if(AREA){$('areaKm').value=String(AREA.km);$('areaN').textContent=base().length+' hendelser'}
  $('areaHint').hidden=!areaPick;$('areaCtl').hidden=!AREA}
function areaStart(){if(AREA&&!areaPick){areaPick=false;AREA=null;store.set('nk-area',null);areaDraw();refresh();return}
  areaPick=!areaPick;map.getCanvas().style.cursor=areaPick?'crosshair':'';areaDraw()}
function areaSet(ll){areaPick=false;map.getCanvas().style.cursor='';AREA={lon:+ll.lng.toFixed(3),lat:+ll.lat.toFixed(3),km:AREA?AREA.km:+($('areaKm').value||250)};store.set('nk-area',AREA);areaDraw();refresh()}
$('areaKm').onchange=()=>{if(!AREA)return;AREA.km=+$('areaKm').value;store.set('nk-area',AREA);areaDraw();refresh();
  const b=new maplibregl.LngLatBounds();for(const p of areaCircle(AREA).features[0].geometry.coordinates[0])b.extend(p);map.fitBounds(b,{padding:80,duration:reduced?0:900,maxZoom:7})};
$('areaMove').onclick=()=>{areaPick=true;map.getCanvas().style.cursor='crosshair';areaDraw()};
$('areaX').onclick=()=>{areaPick=false;AREA=null;store.set('nk-area',null);map.getCanvas().style.cursor='';areaDraw();refresh()};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&areaPick){areaPick=false;map.getCanvas().style.cursor='';areaDraw()}});

// ---------- på vei opp ----------
// Land og temaer der det siste døgnet har mye mer omtale enn et vanlig døgn den siste uka.
function trending(){const now=REF(),d1=now-864e5,d7=now-7*864e5,cc=new Map(),cat=new Map();
  for(const e of EVENTS){const t=ms(e.date);if(t<d7||t>now||!catOn(e.cat))continue;const k=ccOf(e),n=t>=d1;
    if(k){const r=cc.get(k)||{k,now:0,before:0};n?r.now++:r.before++;cc.set(k,r)}
    const r2=cat.get(e.cat)||{k:e.cat,now:0,before:0};n?r2.now++:r2.before++;cat.set(e.cat,r2)}
  const span=Math.min(6,Math.max(1,(now-Math.min(...EVENTS.map(e=>ms(e.date)),now))/864e5-1));
  const up=(m,min)=>[...m.values()].map(r=>({...r,x:(r.now+.5)/(r.before/span+.5)})).filter(r=>r.now>=min&&r.x>=2.5).sort((a,b)=>b.x-a.x);
  return{cc:up(cc,3).slice(0,3),cat:up(cat,5).slice(0,1),enough:span>=2}}
function trendUI(){const box=$('upList');if(!box)return;box.textContent='';if(HIST||!EVENTS.length){box.hidden=true;return}
  const t=trending(),rows=[...t.cc.map(r=>({n:cname(r.k),x:r.x,go:()=>setCountry(r.k)})),...t.cat.map(r=>({n:CATS[r.k].n,x:r.x,go:()=>{S.cats=new Set([r.k]);refresh()}}))];
  box.hidden=!t.enough||!rows.length;if(box.hidden)return;
  const h=document.createElement('h3');h.textContent='På vei opp';box.append(h);
  for(const r of rows){const b=document.createElement('button');b.type='button';b.title='Mer omtale siste døgn enn ellers denne uka';const n=document.createElement('span');n.textContent=r.n;
    const x=document.createElement('span');x.className='upx';x.textContent='↑ '+(r.x>=10?'10+':Math.round(r.x))+'×';b.append(n,x);b.onclick=r.go;box.append(b)}}

// ---------- fly og skip: velg hva som vises ----------
const FLF={pax:a=>/^A[345]$/.test(a.cat),small:a=>/^A[12]$/.test(a.cat)||/^B/.test(a.cat),heli:a=>a.cat==='A7',mil:a=>a.mil,sos:a=>/^(7500|7600|7700)$/.test(a.sq)};
const SHF={pax:t=>t>=60&&t<70,fast:t=>t>=40&&t<50,cargo:t=>t>=70&&t<80,tank:t=>t>=80&&t<90,fish:t=>t===30,sar:t=>t===51||t===52||t===31||t===32||t===50,leis:t=>t===36||t===37};
$('flF').value=store.get('nk-flf','');$('shF').value=store.get('nk-shf','');
$('flF').onchange=()=>{store.set('nk-flf',$('flF').value);loadFlights()};
$('shF').onchange=()=>{store.set('nk-shf',$('shF').value);setShipLayer()};
const flOk=a=>{const f=FLF[$('flF').value];return!f||f(a)},shOk=v=>{const f=SHF[$('shF').value];return!f||f(v.type||0)};

// ---------- valutakalkulator ----------
const FXC=['NOK','USD','EUR','SEK','DKK','GBP','CHF','JPY','PLN','ISK','CAD','AUD','CNY','THB','TRY'];
const FXN={NOK:'norske kroner',USD:'amerikanske dollar',EUR:'euro',SEK:'svenske kroner',DKK:'danske kroner',GBP:'britiske pund',CHF:'sveitsiske franc',JPY:'japanske yen',PLN:'polske zloty',ISK:'islandske kroner',CAD:'kanadiske dollar',AUD:'australske dollar',CNY:'kinesiske yuan',THB:'thailandske baht',TRY:'tyrkiske lira'};
let FXS=store.get('nk-fx',{a:100,f:'USD',t:'NOK'});
function fxHtml(){const o=c=>FXC.map(x=>`<option value="${x}"${x===c?' selected':''}>${x}</option>`).join('');
  return`<div class="mh">Valutakalkulator</div><form class="fxc" id="fxC" onsubmit="return false"><input type="text" inputmode="decimal" id="fxA" value="${esc(String(FXS.a).replace('.',','))}" aria-label="Beløp">
    <select id="fxF" aria-label="Fra valuta">${o(FXS.f)}</select><button type="button" class="btn" id="fxSw" title="Bytt om" aria-label="Bytt om valutaene">⇄</button><select id="fxT" aria-label="Til valuta">${o(FXS.t)}</select>
    <output id="fxOut" for="fxA fxF fxT"></output></form>`}
async function fxCalc(){const out=$('fxOut');if(!out)return;const a=+String($('fxA').value).replace(/\s/g,'').replace(',','.');FXS={a:isFinite(a)?a:0,f:$('fxF').value,t:$('fxT').value};store.set('nk-fx',FXS);
  if(!isFinite(a)){out.textContent='Skriv et tall';return}
  let r;try{r=await (await fetch(`/api/fx?from=${FXS.f}&to=${FXS.t}`)).json()}catch(e){r={error:'ingen kontakt'}}
  if(!$('fxOut'))return;if(r.error){out.textContent='Fant ikke kursen';return}
  const v=a*r.rate,f2=new Intl.NumberFormat('nb-NO',{maximumFractionDigits:v>=100?2:4});
  out.innerHTML=`<b>${esc(f2.format(v))} ${esc(FXS.t)}</b><small>1 ${esc(FXS.f)} = ${esc(new Intl.NumberFormat('nb-NO',{maximumFractionDigits:4}).format(r.rate))} ${esc(FXS.t)}, ${esc(FXN[FXS.f]||FXS.f)} til ${esc(FXN[FXS.t]||FXS.t)}</small>`}
function fxWire(){if(!$('fxC'))return;let t=null;$('fxA').oninput=()=>{clearTimeout(t);t=setTimeout(fxCalc,250)};$('fxF').onchange=fxCalc;$('fxT').onchange=fxCalc;
  $('fxSw').onclick=()=>{const f=$('fxF').value;$('fxF').value=$('fxT').value;$('fxT').value=f;fxCalc()};fxCalc()}

loadCal();
