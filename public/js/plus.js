// Nyhetskloden: plus.js (lastes sist, deler globale navn med de andre filene)
// ---------- egen lyd for store saker ----------
let AC=null;
function chime(kind){try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();const t0=AC.currentTime+.02;
  const notes=kind==='alarm'?[[880,0,.18],[660,.22,.18],[880,.44,.18],[660,.66,.3]]:[[784,0,.5],[1047,.16,.7]];
  for(const[f,at,len]of notes){const o=AC.createOscillator(),g=AC.createGain();o.type=kind==='alarm'?'square':'sine';o.frequency.value=f;
    g.gain.setValueAtTime(0,t0+at);g.gain.linearRampToValueAtTime(kind==='alarm'?.09:.18,t0+at+.02);g.gain.exponentialRampToValueAtTime(.0001,t0+at+len);o.connect(g).connect(AC.destination);o.start(t0+at);o.stop(t0+at+len+.05)}}catch(e){}}
if(window.nk&&window.nk.onChime)window.nk.onChime(chime);
if($('sndTest'))$('sndTest').onclick=()=>chime(SET.bigSound==='alarm'?'alarm':'chime');

// ---------- «Til deg»: lærer av hva du åpner (lagres bare på denne PC-en) ----------
let TASTE=store.get('nk-taste',{n:0,cat:{},cc:{},src:{},w:{}});
function tasteLearn(e,k=1){const T=TASTE,dec=.985,bump=(o,key)=>{if(key)o[key]=(o[key]||0)+k};
  for(const o of [T.cat,T.cc,T.src,T.w])for(const x in o){o[x]*=dec;if(o[x]<.05)delete o[x]}
  bump(T.cat,e.cat);bump(T.cc,ccOf(e));for(const s of new Set(e.srcs))bump(T.src,OUTLET(s));
  for(const w of FUZZY.tokens(e.title))if(!/^\d+$/.test(w))bump(T.w,w);
  T.n++;store.set('nk-taste',T)}
function tasteScore(e){const T=TASTE,l=v=>Math.log1p(v||0);let s=l(T.cat[e.cat])*1.2+l(T.cc[ccOf(e)])*.9;
  let src=0;for(const x of new Set(e.srcs))src=Math.max(src,l(T.src[OUTLET(x)]));s+=src*.5;
  let w=0;for(const t of FUZZY.tokens(e.title))w+=l(T.w[t]);s+=Math.min(w,4)*.7;
  const age=(REF()-ms(e.last))/3600e3;return s+e.score*.35-Math.min(age,48)*.04}
const forYou=ev=>[...ev].sort((a,b)=>tasteScore(b)-tasteScore(a)).slice(0,40);
function forYouNote(){return TASTE.n<5?'«Til deg» lærer av sakene du åpner. Åpne noen saker, så blir lista bedre.':''}

// ---------- faktasjekk fra Faktisk.no ----------
// Viser en faktasjekk når den deler mange ord med saken.
function factFor(e){if(e.items.some(n=>OUTLET(n.src)==='Faktisk.no'))return null;const t=FUZZY.tokens(e.title+' '+e.items.map(n=>n.titleNo||n.title).join(' '));let best=null;
  for(const f of EVENTS){if(!f.items.some(n=>OUTLET(n.src)==='Faktisk.no'))continue;const ft=FUZZY.tokens(f.title);let sh=0;for(const w of ft)if(t.has(w))sh++;
    if(sh>=3&&(!best||sh>best.sh))best={sh,f}}return best&&best.f}

// ---------- vinkling: norske og utenlandske titler side om side ----------
function anglesHtml(e){const no=[],ut=[];for(const n of e.items){const g=originOf(OUTLET(n.src));if(g==='Offisiell')continue;(g==='Norge'?no:ut).push(n)}
  if(!no.length||!ut.length)return'';const li=n=>`<li><b>${esc(OUTLET(n.src))}</b> ${esc(n.title)}</li>`;
  return`<div><h4>Norske medier</h4><ul>${no.slice(0,4).map(li).join('')}</ul></div><div><h4>Utenlandske medier</h4><ul>${ut.slice(0,4).map(li).join('')}</ul></div>`}

// ---------- om kildene ----------
// [type, eier, land]. Eierskap kan endre seg; dette er slik det var i 2026.
const SRC_INFO={NRK:['allmennkringkaster','eid av staten','Norge'],VG:['avis','Schibsted','Norge'],Aftenposten:['avis','Schibsted','Norge'],E24:['nettavis om økonomi','Schibsted','Norge'],
  'Bergens Tidende':['avis','Schibsted','Norge'],'Stavanger Aftenblad':['avis','Schibsted','Norge'],Dagbladet:['avis','Aller Media','Norge'],Nettavisen:['nettavis','Amedia','Norge'],
  Adresseavisen:['avis','Polaris Media','Norge'],'iTromsø':['avis','Polaris Media','Norge'],'Fædrelandsvennen':['avis','Polaris Media','Norge'],'Sunnmørsposten':['avis','Polaris Media','Norge'],
  Telemarksavisa:['lokalavis','Amedia','Norge'],'Forskning.no':['nettavis om forskning','eid av norske forsknings- og utdanningsinstitusjoner','Norge'],'Digi.no':['nettavis om teknologi','Teknisk Ukeblad Media','Norge'],
  'Faktisk.no':['faktasjekker','eid av flere norske medier','Norge'],Regjeringen:['myndighet','regjeringen','Norge'],Stortinget:['myndighet','Stortinget','Norge'],
  SVT:['allmennkringkaster','eid av en stiftelse','Sverige'],DR:['allmennkringkaster','eid av staten','Danmark'],Yle:['allmennkringkaster','eid av staten','Finland'],
  BBC:['allmennkringkaster','finansiert av lisens','Storbritannia'],'The Guardian':['avis','The Scott Trust','Storbritannia'],'Sky News':['TV','Comcast','Storbritannia'],'The Independent':['nettavis','privat eid','Storbritannia'],
  Euronews:['TV','Alpac Capital','EU'],'Politico Europe':['nettavis','Axel Springer','EU'],'Le Monde':['avis','Le Monde-gruppen','Frankrike'],RFI:['radio','eid av den franske staten','Frankrike'],'France 24':['TV','eid av den franske staten','Frankrike'],
  DW:['allmennkringkaster','finansiert av den tyske staten','Tyskland'],'Kyiv Independent':['nettavis','eid av de ansatte','Ukraina'],
  'New York Times':['avis','The New York Times Company','USA'],'Washington Post':['avis','Jeff Bezos','USA'],NPR:['allmennradio','ideell organisasjon','USA'],'CBS News':['TV','Paramount','USA'],'ABC News':['TV','Disney','USA'],
  CBC:['allmennkringkaster','eid av staten','Canada'],'The Verge':['nettavis om teknologi','Vox Media','USA'],'Ars Technica':['nettavis om teknologi','Condé Nast','USA'],NASA:['myndighet','den amerikanske staten','USA'],'STAT News':['nettavis om helse','Boston Globe Media','USA'],
  'NBC News':['TV','Comcast','USA'],CNBC:['TV om økonomi','Comcast','USA'],'Fox News':['TV','Fox Corporation','USA'],'Los Angeles Times':['avis','Patrick Soon-Shiong','USA'],Axios:['nettavis','Cox Enterprises','USA'],
  'Financial Times':['avis om økonomi','Nikkei','Storbritannia'],'The Economist':['ukemagasin','The Economist Group','Storbritannia'],Euractiv:['nettavis om EU','Mediahuis','EU'],
  'The Moscow Times':['nettavis i eksil','uavhengig','Russland'],Meduza:['nettavis i eksil','uavhengig','Russland'],'Notes from Poland':['nettavis','uavhengig','Polen'],'Balkan Insight':['nettavis','BIRN, ideell','Balkan'],
  'Al Jazeera':['TV','finansiert av Qatars stat','Qatar'],'Times of Israel':['nettavis','privat eid','Israel'],'Arab News':['avis','Saudi Research & Media Group','Saudi-Arabia'],'Middle East Eye':['nettavis','privat eid','Storbritannia'],
  Anadolu:['nyhetsbyrå','eid av den tyrkiske staten','Tyrkia'],'Times of India':['avis','Bennett, Coleman & Co','India'],'The Hindu':['avis','THG Publishing','India'],NDTV:['TV','Adani-gruppen','India'],Dawn:['avis','Dawn Media Group','Pakistan'],
  'South China Morning Post':['avis','Alibaba','Hongkong'],CNA:['TV','Mediacorp, eid av staten','Singapore'],'The Straits Times':['avis','SPH Media Trust','Singapore'],'Taipei Times':['avis','Liberty Times-gruppen','Taiwan'],
  'The Japan Times':['avis','privat eid','Japan'],'Nikkei Asia':['magasin om økonomi','Nikkei','Japan'],Yonhap:['nyhetsbyrå','statsstøttet','Sør-Korea'],'Bangkok Post':['avis','Post Publishing','Thailand'],
  AllAfrica:['samler saker fra afrikanske medier','privat eid','Afrika'],'Premium Times':['nettavis','uavhengig','Nigeria'],'Daily Maverick':['nettavis','uavhengig','Sør-Afrika'],'The East African':['ukeavis','Nation Media Group','Kenya'],
  MercoPress:['nyhetsbyrå','privat eid','Uruguay'],'Mexico News Daily':['nettavis på engelsk','privat eid','Mexico'],'Buenos Aires Times':['avis på engelsk','Perfil','Argentina'],'Rio Times':['nettavis på engelsk','privat eid','Brasil'],
  'ABC Australia':['allmennkringkaster','eid av staten','Australia'],RNZ:['allmennkringkaster','eid av staten','New Zealand'],'The Guardian Australia':['avis','The Scott Trust','Australia'],
  USGS:['myndighet','den amerikanske staten','USA'],GDACS:['varslingssystem','FN og EU','Internasjonalt'],'MET farevarsler':['myndighet','Meteorologisk institutt','Norge']};
const srcInfo=s=>{const i=SRC_INFO[OUTLET(s)]||SRC_INFO[s];return i?`${i[0]}, ${i[1]} (${i[2]})`:originOf(OUTLET(s))!=='Annet'?originOf(OUTLET(s)):''};

// ---------- tillegg i saken: faktasjekk, vinkling, om kildene ----------
function cardExtras(e){const f=factFor(e);$('cFact').hidden=!f;
  if(f){const n=f.items.find(x=>OUTLET(x.src)==='Faktisk.no');$('cFact').innerHTML=`<b>Faktisk.no har sjekket noe lignende:</b> <a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.title)}</a>`}
  const a=anglesHtml(e);$('cAng').hidden=!a;$('cAngB').innerHTML=a;$('cAng').open=false;
  const outs=[...new Set(e.items.map(n=>OUTLET(n.src)))];$('cWho').hidden=!outs.length;$('cWhoB').innerHTML=outs.map(o=>`<li><b>${esc(o)}</b> ${esc(srcInfo(o)||'ingen opplysninger')}</li>`).join('');$('cWho').open=false}

// ---------- snøskred, flom og jordskred (Varsom) ----------
const VARSOM_COL={2:'#ffd400',3:'#ff8a00',4:'#e3262b',5:'#000'};
async function loadVarsom(){clearTimeout(loadVarsom.t);if(!ready)return;if(!map.getSource('varsom')){map.addSource('varsom',{type:'geojson',data:EMPTY});
    map.addLayer({id:'varsom',type:'circle',source:'varsom',minzoom:2.5,paint:{'circle-radius':['interpolate',['linear'],['zoom'],3,5,7,10],'circle-color':['match',['get','level'],2,VARSOM_COL[2],3,VARSOM_COL[3],4,VARSOM_COL[4],VARSOM_COL[5]],'circle-stroke-width':2,'circle-stroke-color':'#fff','circle-opacity':.9}},'pts');
    map.addLayer({id:'varsom-txt',type:'symbol',source:'varsom',minzoom:4.5,layout:{'text-field':['concat',['get','kind'],' ',['to-string',['get','level']]],'text-font':FONT_B,'text-size':11,'text-offset':[0,1.3],'text-anchor':'top'},paint:{'text-color':'#fff','text-halo-color':'rgba(5,10,18,.95)','text-halo-width':1.4}});
    map.on('click','varsom',ev=>{const p=ev.features[0].properties;new maplibregl.Popup({closeButton:true,maxWidth:'280px'}).setLngLat(ev.lngLat).setHTML(`<b>${esc(p.kind[0].toUpperCase()+p.kind.slice(1))}, faregrad ${p.level}: ${esc(p.name)}</b><p>${esc(p.text)}</p><a href="${esc(p.url)}" target="_blank" rel="noopener">Se varselet på Varsom</a>`).addTo(map)});
    map.on('mouseenter','varsom',()=>map.getCanvas().style.cursor='pointer');map.on('mouseleave','varsom',()=>map.getCanvas().style.cursor='')}
  if(!F.varsom){map.getSource('varsom').setData(EMPTY);trafMsg.va='';showTraf();return}
  let r;try{r=await (await fetch('/api/varsom')).json()}catch(e){r={items:[]}}
  map.getSource('varsom').setData({type:'FeatureCollection',features:(r.items||[]).map(i=>({type:'Feature',geometry:{type:'Point',coordinates:[i.lon,i.lat]},properties:i}))});
  trafMsg.va=(r.items||[]).length?(r.items.length+' varsler fra Varsom'):'Ingen varsler om snøskred, flom eller jordskred';showTraf();loadVarsom.t=setTimeout(loadVarsom,60*60e3)}

// ---------- luftkvalitet (MET) ----------
const AQ_COL=['interpolate',['linear'],['get','aqi'],1,'#3ddc84',2,'#ffd400',3,'#ff5a1f',4,'#9c27b0'];
const AQ_TXT=a=>a==null?'ukjent':a<2?'lite forurenset':a<3?'moderat':a<4?'høy forurensning':'svært høy forurensning';
const AQ_MAIN={no2:'NO₂ (eksos)',pm10:'svevestøv PM10',pm25:'svevestøv PM2,5',o3:'ozon'};
async function loadAQ(){clearTimeout(loadAQ.t);if(!ready)return;if(!map.getSource('aq')){map.addSource('aq',{type:'geojson',data:EMPTY});
    map.addLayer({id:'aq',type:'circle',source:'aq',minzoom:3.5,paint:{'circle-radius':['interpolate',['linear'],['zoom'],4,5,8,9],'circle-color':AQ_COL,'circle-stroke-width':1.5,'circle-stroke-color':'rgba(5,10,18,.8)'}},'pts');
    map.on('click','aq',ev=>{const p=ev.features[0].properties;new maplibregl.Popup({maxWidth:'260px'}).setLngLat(ev.lngLat).setHTML(`<b>Luft i ${esc(p.name)}: ${AQ_TXT(+p.aqi)}</b><p>${p.main&&p.main!=='null'?'Mest av '+esc(AQ_MAIN[p.main]||p.main)+'. ':''}Varsel fra Meteorologisk institutt for denne timen.</p>`).addTo(map)});
    map.on('mouseenter','aq',()=>map.getCanvas().style.cursor='pointer');map.on('mouseleave','aq',()=>map.getCanvas().style.cursor='')}
  if(!F.airQuality){map.getSource('aq').setData(EMPTY);return}
  let r;try{r=await (await fetch('/api/aq')).json()}catch(e){r={cities:[]}}
  map.getSource('aq').setData({type:'FeatureCollection',features:(r.cities||[]).filter(c=>c.aqi!=null).map(c=>({type:'Feature',geometry:{type:'Point',coordinates:[c.lon,c.lat]},properties:c}))});loadAQ.t=setTimeout(loadAQ,60*60e3)}

// ---------- forsinkelser på norske flyplasser (Avinor) ----------
async function loadAirports(){clearTimeout(loadAirports.t);if(!ready)return;if(!map.getSource('apt')){map.addSource('apt',{type:'geojson',data:EMPTY});
    map.addLayer({id:'apt',type:'circle',source:'apt',minzoom:3,paint:{'circle-radius':['interpolate',['linear'],['zoom'],3,5,8,10],'circle-color':['step',['get','bad'],'#3ddc84',.15,'#ffd400',.3,'#ff8a00',.5,'#e3262b'],'circle-stroke-width':2,'circle-stroke-color':'#0b131d'}},'pts');
    map.addLayer({id:'apt-txt',type:'symbol',source:'apt',minzoom:4.2,layout:{'text-field':['get','code'],'text-font':FONT_B,'text-size':10.5,'text-offset':[0,1.2],'text-anchor':'top'},paint:{'text-color':'#fff','text-halo-color':'rgba(5,10,18,.95)','text-halo-width':1.3}});
    map.on('click','apt',ev=>{const p=ev.features[0].properties,w=JSON.parse(p.worst||'[]');new maplibregl.Popup({maxWidth:'280px'}).setLngLat(ev.lngLat).setHTML(`<b>${esc(p.name)}: avganger neste fire timer</b><p>${p.total} fly, ${p.late} forsinket, ${p.canc} innstilt.</p>${w.length?'<ul>'+w.map(f=>`<li>${esc(f.id)} til ${esc(f.to)}: ${esc(f.kind)}</li>`).join('')+'</ul>':''}<small>Fra Avinor</small>`).addTo(map)});
    map.on('mouseenter','apt',()=>map.getCanvas().style.cursor='pointer');map.on('mouseleave','apt',()=>map.getCanvas().style.cursor='')}
  if(!F.airports){map.getSource('apt').setData(EMPTY);trafMsg.ap='';showTraf();return}
  let r;try{r=await (await fetch('/api/airports')).json()}catch(e){r={airports:[]}}
  const ap=r.airports||[];map.getSource('apt').setData({type:'FeatureCollection',features:ap.map(a=>({type:'Feature',geometry:{type:'Point',coordinates:[a.lon,a.lat]},properties:{...a,bad:a.total?(a.late+2*a.canc)/a.total:0,worst:JSON.stringify(a.worst)}}))});
  const late=ap.reduce((s,a)=>s+a.late,0),canc=ap.reduce((s,a)=>s+a.canc,0);trafMsg.ap=ap.length?`Flyplasser: ${late} forsinket, ${canc} innstilt`:'Fikk ikke hentet data fra Avinor';showTraf();loadAirports.t=setTimeout(loadAirports,5*60e3)}

let plusSig='';
function plusLayers(){if(!ready)return;const sig=JSON.stringify([F.varsom,F.airQuality,F.airports]);if(sig===plusSig)return;plusSig=sig;loadVarsom();loadAQ();loadAirports()}

// ---------- børsmeldinger i detaljvisningen ----------
async function nwLoad(d){const box=$('mNw');if(!box||!/\.OL$/.test(d.sym))return;box.innerHTML='<div class="mnote">Henter børsmeldinger …</div>';
  let r;try{r=await (await fetch('/api/newsweb?s='+encodeURIComponent(d.sym))).json()}catch(e){r={error:true}}
  if(!$('mNw')||MDET!==d.sym)return;if(r.error||!Array.isArray(r)||!r.length){$('mNw').innerHTML='';return}
  const df=new Intl.DateTimeFormat('nb-NO',{day:'numeric',month:'short'}),kind=c=>/MELDEPLIKTIG HANDEL/i.test(c)?'Innsidehandel':/RAPPORT|FINANSIELL/i.test(c)?'Resultater':/INNSIDEINFO/i.test(c)?'Innsideinformasjon':/UTBYTTE|KAPITAL/i.test(c)?'Kapital og utbytte':'';
  $('mNw').innerHTML=`<div class="mh">Børsmeldinger</div><ul class="mnews">${r.slice(0,8).map(m=>`<li><a href="${esc(m.url)}" target="_blank" rel="noopener"><span>${esc(m.title)}</span><small>${esc(df.format(new Date(m.time)))}${kind(m.cat)?', '+esc(kind(m.cat)):''}</small></a></li>`).join('')}</ul>`}

// ---------- tilgjengelighet: tastatur og skjermleser ----------
// N og P går til neste og forrige sak på kartet, og valgt sak leses opp av skjermleseren.
function announce(t){const a=$('srLive');if(a){a.textContent='';setTimeout(()=>{a.textContent=t},30)}}
document.addEventListener('keydown',e=>{if(e.target.closest&&e.target.closest('input,textarea,select,[contenteditable],dialog'))return;if(e.ctrlKey||e.metaKey||e.altKey)return;
  const k=e.key.toLowerCase();if(k!=='n'&&k!=='p')return;const ev=view().filter(x=>x.lat!=null);if(!ev.length)return;
  let i=ev.findIndex(x=>x.id===S.sel);i=k==='n'?(i+1)%ev.length:(i<=0?ev.length-1:i-1);e.preventDefault();select(ev[i].id,true);
  const x=ev[i];announce(`${i+1} av ${ev.length}: ${x.title}. ${CATS[x.cat].n}, ${x.place||'uten sted'}, ${when(x)}.`)});
if(ready&&map)map.getCanvas().setAttribute('aria-label','Kart over saker. Bruk piltastene for å flytte kartet, pluss og minus for å zoome, og N og P for neste og forrige sak.');

// ---------- raskere oppstart og bruk uten nett ----------
// Kartfliser, skrifter og kartstil lagres av en service worker, så kartet virker også uten nett.
if('serviceWorker' in navigator&&location.protocol==='http:'&&/^(127\.0\.0\.1|localhost)$/.test(location.hostname)&&!IS_LAN)navigator.serviceWorker.register('/sw.js').catch(()=>{});
