// Nyhetskloden: explore.js – bylys om natta, landfakta, tidsreise, veitrafikk og strømpris

// ---------- byer som lyser på nattsiden ----------
let LIGHT_PL=null;
function sunAlt(t,lat,lon){const s=sun(t),r=Math.PI/180;return Math.asin(Math.sin(lat*r)*Math.sin(s.dec)+Math.cos(lat*r)*Math.cos(s.dec)*Math.cos((lon-s.lon)*r))/r}
async function loadLights(){clearTimeout(loadLights.t);if(!ready||!map.getSource('lights'))return;
  const on=F.lights&&S.layers.night;$('lightsLbl').classList.toggle('off',!S.layers.night);
  if(!on){map.getSource('lights').setData(EMPTY);return}
  if(!LIGHT_PL)try{LIGHT_PL=await (await fetch('/api/places')).json()}catch(e){LIGHT_PL=[]}
  const t=REF(),f=[];
  for(const p of LIGHT_PL){const a=sunAlt(t,p[1],p[2]);if(a<-3)f.push({type:'Feature',geometry:{type:'Point',coordinates:[p[2],p[1]]},properties:{k:Math.min(1,.3+(-a-3)/8),w:p[4]??1}})}
  map.getSource('lights').setData({type:'FeatureCollection',features:f});loadLights.t=setTimeout(loadLights,5*60e3)}

// ---------- landfakta ----------
const CFACT=new Map(),dnLang=new Intl.DisplayNames(['nb'],{type:'language'}),dnCur=new Intl.DisplayNames(['nb'],{type:'currency'});
const fmtPop=n=>n>=1e6?(n/1e6).toLocaleString('nb-NO',{maximumFractionDigits:n>=1e7?0:1})+' millioner':n.toLocaleString('nb-NO');
async function countryFacts(cc){const box=$('ctFacts');if(!cc){box.textContent='';return}
  let d=CFACT.get(cc);if(!d){box.innerHTML='<p class="meta">Henter fakta …</p>';try{d=await (await fetch('/api/country?cc='+cc)).json()}catch(e){d={error:true}}CFACT.set(cc,d)}
  if(S.cc!==cc)return;if(!d||d.error){box.textContent='';return}
  let time='';try{time=new Intl.DateTimeFormat('nb-NO',{hour:'2-digit',minute:'2-digit',timeZone:d.tz}).format(new Date())}catch(e){}
  const langs=(d.langs||[]).slice(0,3).map(l=>{try{return dnLang.of(l)}catch(e){return l}}).join(', '),cur=(d.curr||[]).slice(0,2).map(c=>{try{return dnCur.of(c)}catch(e){return c}}).join(', ');
  const rows=[['Hovedstad',d.capital],['Folketall',d.population?fmtPop(d.population)+(d.popYear?' ('+d.popYear+')':''):null],['Klokka',time&&d.tz?time+' i '+(d.capital||cname(cc)):null],
    ['Vær',d.weather?`${deg(d.weather.temp)} og ${(WXTXT(d.weather.sym)||'').toLowerCase()||'skiftende'} i ${d.capital}`:null],['Areal',d.area?d.area.toLocaleString('nb-NO')+' km²':null],['Språk',langs],['Valuta',cur]].filter(r=>r[1]);
  box.innerHTML='<dl>'+rows.map(([k,v])=>`<dt>${k}</dt><dd>${k==='Vær'&&d.weather?wxSvg(d.weather.sym,16):''}${esc(v)}</dd>`).join('')+'</dl><p class="mnote">Fakta fra World Bank og world-countries. Vær fra Yr.</p>'}

// ---------- tidsreise ----------
let HIST=null,LIVE=null;
function histUI(){const b=$('hist');b.hidden=!HIST;$('tlLive').hidden=!!HIST;if(!HIST)return;
  const d=new Date(HIST.day+'T12:00:00'),t=new Intl.DateTimeFormat('nb-NO',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(d);
  $('histTxt').innerHTML=`<b>Tidsreise:</b> ${esc(t)}, ${HIST.n} saker`;
  const today=new Date().toLocaleDateString('sv-SE');$('histNext').disabled=HIST.day>=new Date(Date.now()-864e5).toLocaleDateString('sv-SE');$('histDay').max=new Date(Date.now()-864e5).toLocaleDateString('sv-SE');$('histDay').value=HIST.day;void today}
async function travelTo(day){if(!day)return;let d;try{d=await (await fetch('/api/archive?date='+day)).json()}catch(e){toastText('Fikk ikke hentet arkivet.');return}
  if(!HIST)LIVE={news:NEWS};
  NEWS=(d.items||[]).map(n=>({...n,ccs:n.cc?[n.cc]:[],sev:0,text:'',top:false,watch:[]}));HIST={day,n:NEWS.length};
  S.period='24';S.tl=+new Date(day+'T23:59:59');S.sel=null;$('card').hidden=true;buildEvents();tlSync();refresh();histUI();
  if(!NEWS.length)toastText('Arkivet har ingen saker fra denne dagen.')}
function travelHome(){if(!HIST)return;HIST=null;NEWS=(LIVE&&LIVE.news)||NEWS;LIVE=null;S.tl=null;S.period='24';buildEvents();tlSync();refresh();histUI();fetch('/api/news').then(r=>r.json()).then(d=>apply(d)).catch(()=>{})}
const shiftDay=(day,n)=>{const d=new Date(day+'T12:00:00');d.setDate(d.getDate()+n);return d.toLocaleDateString('sv-SE')};
$('tlHist').onclick=()=>{const i=$('histDay');i.max=new Date(Date.now()-864e5).toLocaleDateString('sv-SE');i.min=new Date(Date.now()-90*864e5).toLocaleDateString('sv-SE');
  travelTo(HIST?HIST.day:i.max)};
$('histDay').onchange=()=>travelTo($('histDay').value);
$('histPrev').onclick=()=>HIST&&travelTo(shiftDay(HIST.day,-1));$('histNext').onclick=()=>HIST&&travelTo(shiftDay(HIST.day,1));$('histBack').onclick=travelHome;
function toastText(t){undoFn=null;toastIds=[];$('toast').textContent=t;$('toast').hidden=false;clearTimeout(toastMsg.t);toastMsg.t=setTimeout(()=>{$('toast').hidden=true},5000)}

// ---------- veitrafikk (Statens vegvesen) ----------
const TRAF_COL={ulykke:'#ef4444',stengt:'#f97316',veiarbeid:'#facc15',føre:'#60a5fa',ferje:'#a78bfa',melding:'#94a3b8'};
async function loadTraffic(){clearTimeout(loadTraffic.t);if(!ready||!map.getSource('traffic'))return;
  if(!F.traffic){map.getSource('traffic').setData(EMPTY);trafMsg.v='';showTraf();return}
  try{const d=await (await fetch('/api/traffic')).json();if(d.error)throw new Error(d.error);
    map.getSource('traffic').setData({type:'FeatureCollection',features:d.items.map(x=>({type:'Feature',geometry:{type:'Point',coordinates:[x.lon,x.lat]},properties:{kind:x.kind,text:x.text,col:TRAF_COL[x.kind]||TRAF_COL.melding}}))});
    trafMsg.v=d.items.length+' trafikkmeldinger'}
  catch(e){trafMsg.v=/mangler/.test(e.message)?'Veitrafikk: legg inn DATEX-tilgang i Innstillinger':'Veitrafikk: '+e.message}
  showTraf();loadTraffic.t=setTimeout(loadTraffic,5*60e3)}

// ---------- strømpris ----------
let POWER=null;
const kr=v=>v==null?'–':(v).toLocaleString('nb-NO',{minimumFractionDigits:2,maximumFractionDigits:2})+' kr';
const pcol=v=>v==null?'#94a3b8':v<.5?'#3ddc84':v<1?'#facc15':v<2?'#fb923c':'#ef4444';
async function loadPower(){clearTimeout(loadPower.t);if(!F.power){POWER=null;powerUI();return}
  try{POWER=await (await fetch('/api/power')).json()}catch(e){POWER={error:true,zones:[]}}
  powerUI();loadPower.t=setTimeout(loadPower,10*60e3)}
function powerUI(){if(ready&&map.getSource('power'))map.getSource('power').setData(POWER&&POWER.zones?{type:'FeatureCollection',features:POWER.zones.filter(z=>z.now!=null).map(z=>({type:'Feature',geometry:{type:'Point',coordinates:[z.lon,z.lat]},
  properties:{label:z.name+'\n'+kr(z.now),col:pcol(z.now)}}))}:EMPTY);
  const box=$('mPower');if(!box)return;box.hidden=!(F.power&&POWER&&POWER.zones&&POWER.zones.some(z=>z.now!=null));if(box.hidden)return;
  box.innerHTML='<div class="mh">Strømpris nå</div><table class="ptab"><tbody>'+POWER.zones.map(z=>`<tr><th>${esc(z.name)} <small>${z.id}</small></th><td style="color:${pcol(z.now)}"><b>${kr(z.now)}</b></td><td class="meta">snitt ${kr(z.avg)}, ${kr(z.min)} til ${kr(z.max)}</td></tr>`).join('')+
    '</tbody></table><div class="mnote">Spotpris per kWh uten mva. og nettleie, fra hvakosterstrommen.no.</div>'}

// ---------- eksport: bilde av kloden og dagens saker som PDF ----------
const DAYFMT=new Intl.DateTimeFormat('nb-NO',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
function grabMap(){return new Promise(res=>{if(!map)return res(null);map.once('render',()=>{try{res(map.getCanvas().toDataURL('image/png'))}catch(e){res(null)}});map.triggerRepaint()})}
function topOfDay(n){const ev=S.tab==='top'?view():[...view()].sort((a,b)=>b.score-a.score||ms(b.last)-ms(a.last));return ev.slice(0,n)}
const dayLabel=()=>DAYFMT.format(new Date(HIST?HIST.day+'T12:00:00':Date.now()));
async function exportPng(){const src=await grabMap();if(!src){toastText('Fikk ikke laget bilde av kloden.');return}
  const img=new Image();await new Promise(r=>{img.onload=r;img.src=src});
  const top=topOfDay(4),W=img.width,pad=Math.round(W*.02),fs=Math.max(14,Math.round(W/70)),lh=Math.round(fs*1.5),foot=pad*2+lh*(top.length+1.4);
  const c=document.createElement('canvas');c.width=W;c.height=img.height+foot;const x=c.getContext('2d');
  x.fillStyle='#070c14';x.fillRect(0,0,c.width,c.height);x.drawImage(img,0,0);
  x.fillStyle='#e6edf3';x.font=`600 ${Math.round(fs*1.2)}px "Segoe UI",system-ui,sans-serif`;x.fillText('Nyhetskloden, '+dayLabel(),pad,img.height+pad+fs);
  x.font=`${fs}px "Segoe UI",system-ui,sans-serif`;
  top.forEach((e,i)=>{const c2=(CATS[e.cat]||CATS.annet).c;x.fillStyle=c2;x.beginPath();x.arc(pad+fs*.35,img.height+pad+lh*(i+1.4)+fs*.1-fs*.35,fs*.3,0,7);x.fill();
    x.fillStyle='#c9d4de';let t=e.title;while(x.measureText(t).width>W-pad*3&&t.length>10)t=t.slice(0,-2);if(t!==e.title)t=t.slice(0,-1)+'…';x.fillText(t,pad+fs,img.height+pad+lh*(i+1.4)+fs*.1)});
  const url=c.toDataURL('image/png'),name='nyhetskloden-'+(HIST?HIST.day:new Date().toLocaleDateString('sv-SE'))+'.png';
  if(window.nk&&window.nk.savePng){const r=await window.nk.savePng(url,name);if(r&&r.ok)toastText('Bildet er lagret.');}
  else{const a=document.createElement('a');a.href=url;a.download=name;a.click()}}
async function exportPdf(){const src=await grabMap(),ev=topOfDay(30),day=dayLabel();
  const rows=ev.map(e=>{const c=CATS[e.cat]||CATS.annet,cov=coverage(e).outs;
    return`<li><b>${esc(e.title)}</b><span><i style="background:${c.c}"></i>${esc(c.n)}${e.place?', '+esc(e.place):''}, ${tfmt.format(new Date(e.date))}. ${cov.length>1?'Kilder: '+esc(cov.join(', ')):'Kilde: '+esc(e.src)}</span>${e.url&&e.url.startsWith('https://')?`<a href="${esc(e.url)}">${esc(e.url.replace(/^https:\/\/(www\.)?/,'').slice(0,70))}</a>`:''}</li>`}).join('');
  const html=`<!DOCTYPE html><html lang="nb"><meta charset="utf-8"><title>Nyhetskloden ${esc(day)}</title><style>
    body{font:11pt/1.45 "Segoe UI",system-ui,sans-serif;color:#122033;margin:0}h1{font-size:20pt;margin:0 0 2pt}p.s{color:#4f6276;margin:0 0 12pt}
    img{width:100%;border-radius:6pt;margin-bottom:14pt}ol{padding-left:16pt;margin:0}li{margin:0 0 9pt;break-inside:avoid}li b{display:block}
    li span{color:#4f6276;font-size:9.5pt}li i{display:inline-block;width:7pt;height:7pt;border-radius:50%;margin-right:5pt}li a{display:block;font-size:8.5pt;color:#1d4ed8;text-decoration:none}
    footer{margin-top:16pt;color:#6f8094;font-size:8.5pt}</style>
    <h1>Nyhetskloden</h1><p class="s">${esc(day[0].toUpperCase()+day.slice(1))}. De ${ev.length} viktigste hendelsene${S.cc?' i '+esc(cname(S.cc)):''}.</p>${src?`<img src="${src}">`:''}<ol>${rows}</ol>
    <footer>Laget med Nyhetskloden. Sakene tilhører kildene de kommer fra. Kart: OpenFreeMap, OpenStreetMap, Esri.</footer></html>`;
  const name='nyhetskloden-'+(HIST?HIST.day:new Date().toLocaleDateString('sv-SE'))+'.pdf';
  if(window.nk&&window.nk.savePdf){const r=await window.nk.savePdf(html,name);if(r&&r.ok)toastText('PDF-en er lagret.')}
  else{const w=window.open('','_blank');if(w){w.document.write(html);w.document.close();w.focus();w.print()}}}
$('tlExp').onclick=e=>{e.stopPropagation();$('expMenu').hidden=!$('expMenu').hidden};
document.addEventListener('click',e=>{if(!e.target.closest('#expMenu'))$('expMenu').hidden=true});
$('expPng').onclick=()=>{$('expMenu').hidden=true;exportPng()};$('expPdf').onclick=()=>{$('expMenu').hidden=true;exportPdf()};

// kartlag-panelet kan lukkes, og husker om det var åpent
$('layers').open=store.get('nk-layers-open',false);$('layers').addEventListener('toggle',()=>store.set('nk-layers-open',$('layers').open));
// ---------- nattbilder fra NASA ----------
// Vises når natt er på, du har zoomet inn, og det er natt (sola under horisonten) midt i bildet.
const LIGHTS_OP=['interpolate',['linear'],['zoom'],1,.85,7,.7,10,.4],LIGHTS_OP_BM=['interpolate',['linear'],['zoom'],1,.85,3.4,.6,4.6,0];
function nightImgUpdate(){if(!ready||!map.getLayer('bm'))return;const c=map.getCenter();
  const on=F.nightImg!==false&&!!S.layers.night&&map.getZoom()>=3.2&&sunAlt(REF(),c.lat,c.lng)<-3;
  if(on===nightImgUpdate.on)return;nightImgUpdate.on=on;map.setLayoutProperty('bm','visibility',on?'visible':'none');
  if(map.getLayer('lights'))map.setPaintProperty('lights','heatmap-opacity',on?LIGHTS_OP_BM:LIGHTS_OP)}
setInterval(nightImgUpdate,60e3);
