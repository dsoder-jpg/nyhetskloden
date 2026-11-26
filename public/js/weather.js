// Nyhetskloden: weather.js (lastes i rekkefølge fra index.html, deler globale navn med de andre filene)
// ---------- vær ----------
// værsymboler tegnet som enkle ikoner (MET symbol_code)
function wxSvg(c,sz){c=c||'';const n=/_night|polartwilight/.test(c),S=sz||22;
  const sun='<g stroke="#f5b83d" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="4" fill="#f5b83d"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/></g>';
  const moon='<path d="M15.5 4.5a7.5 7.5 0 1 0 4 12.6A6 6 0 0 1 15.5 4.5Z" fill="#c9d3df"/>';
  const cloud=(x,y,k,f)=>`<path transform="translate(${x} ${y}) scale(${k})" d="M7 18h10.5a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6-1.2A4.5 4.5 0 0 0 7 18Z" fill="${f||'#a9b7c6'}"/>`;
  const small=n?'<g transform="translate(-2 -3) scale(.62)">'+moon+'</g>':'<g transform="translate(-2 -3) scale(.62)">'+sun+'</g>';
  const drops=k=>'<g stroke="#4ea1ff" stroke-width="1.7" stroke-linecap="round">'+[[8,19.5],[12,21],[16,19.5],[10,23.5]].slice(0,k).map(([x,y])=>`<path d="M${x} ${y-2.5}l-1 3"/>`).join('')+'</g>';
  const flakes=k=>'<g fill="#eef3f8">'+[[8,19.5],[12,21.5],[16,19.5]].slice(0,k).map(([x,y])=>`<circle cx="${x}" cy="${y}" r="1.6"/>`).join('')+'</g>';
  let g;
  const heavy=/heavy/.test(c)?3:/light/.test(c)?1:2,base=/showers/.test(c)?small+cloud(1,-2.5,.95):cloud(0,-2.5,1);
  if(/thunder/.test(c))g=cloud(0,-3,1,'#8e9caa')+'<path d="M12.5 14 9.5 19h3l-1.5 4 4.5-6h-3l1.5-3Z" fill="#f5b83d"/>';
  else if(/sleet/.test(c))g=base+drops(1)+'<g transform="translate(4 0)">'+flakes(1).replace('cx="8"','cx="10"')+'</g>';
  else if(/snow/.test(c))g=base+flakes(heavy);
  else if(/rain/.test(c))g=base+drops(heavy+(heavy===3?1:0));
  else if(/fog/.test(c))g='<g stroke="#a9b7c6" stroke-width="1.8" stroke-linecap="round"><path d="M4 9h16M6 13h12M4 17h16"/></g>';
  else if(/^cloudy/.test(c))g=cloud(-1,-1,1.05,'#8e9caa');
  else if(/partlycloudy/.test(c))g=small+cloud(1,0,.95);
  else if(/fair/.test(c))g=(n?'<g transform="translate(-1 -1) scale(.85)">'+moon+'</g>':'<g transform="translate(-1 -1) scale(.85)">'+sun+'</g>')+cloud(6,6,.6);
  else if(/clearsky/.test(c))g=n?moon:sun;
  else g=cloud(0,-1,1);
  return`<svg class="wxi" width="${S}" height="${S}" viewBox="0 0 24 24" aria-hidden="true">${g}</svg>`}
const WXTXT=c=>{c=(c||'').replace(/_(day|night|polartwilight)$/,'');return({clearsky:'Klarvær',fair:'Lettskyet',partlycloudy:'Delvis skyet',cloudy:'Skyet',fog:'Tåke'})[c]||
  (/thunder/.test(c)?'Torden':'')+(/thunder/.test(c)&&/(rain|snow|sleet)/.test(c)?' og ':'')+(/heavy/.test(c)?'kraftig ':/light/.test(c)?'lett ':'')+(/rainshowers/.test(c)?'regnbyger':/rain/.test(c)?'regn':/snowshowers/.test(c)?'snøbyger':/snow/.test(c)?'snø':/sleet/.test(c)?'sludd':'')||''};
const deg=t=>{if(t==null)return'–';const r=Math.round(t)||0;return(r<0?'−':'')+Math.abs(r)+'°'};
const tcol=t=>t==null?'':Math.round(t)>0?'warm':'cold';
const WD=new Intl.DateTimeFormat('nb-NO',{weekday:'long',day:'numeric',month:'long'});
function dayName(iso,i){if(i===0)return'I dag';if(i===1)return'I morgen';const d=new Date(iso+'T12:00:00');const t=WD.format(d);return t[0].toUpperCase()+t.slice(1)}
function homeAlerts(){if(!HOME)return[];const pt=[HOME.lon,HOME.lat];return (ALERTS.features||[]).filter(f=>{const g=f.geometry;if(!g)return false;const ps=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];return ps.some(p=>inPoly(pt,p))})}
function renderWx(){const b=$('wxBtn');b.hidden=!F.weather;if(!F.weather){$('wxPop').hidden=true;return}
  if(!HOME){b.innerHTML=wxSvg('partlycloudy_day',18)+'<span>Velg sted</span>';$('wxPop').hidden=true;return}
  const al=homeAlerts(),lvl=al.some(f=>f.properties.level==='red')?'red':al.some(f=>f.properties.level==='orange')?'orange':al.length?'yellow':null;
  b.innerHTML=(WX&&WX.now?wxSvg(WX.now.sym,18)+`<b class="${tcol(WX.now.temp)}">${deg(WX.now.temp)}</b>`:wxSvg('',18))+`<span>${esc(HOME.name)}</span>`+(lvl?`<span class="warn" style="background:${ALERT_COL[lvl]}" title="Farevarsel"></span>`:'');
  if($('wxPop').hidden)return;
  let h=`<button class="x" id="wxX" aria-label="Lukk">×</button><h3>${esc(HOME.name)}</h3>`;
  if(!WX||!WX.now)h+=`<p class="meta">${WX&&WX.error?'Fikk ikke kontakt med Yr. Prøver igjen om noen minutter.':'Henter været …'}</p>`;
  else{const nw=WX.now;
    h+=`<div class="wxnow">${wxSvg(nw.sym,48)}<b class="${tcol(nw.temp)}">${deg(nw.temp)}</b><div><div>${esc(WXTXT(nw.sym))}</div><div class="meta">Vind ${nf0.format(nw.wind||0)} m/s${nw.rain?', '+String(nw.rain).replace('.',',')+' mm neste time':''}</div></div></div>`;
    h+=`<h4>Time for time</h4><div class="wxh">${WX.hours.map(x=>`<div><span>${String(new Date(x.time).getHours()).padStart(2,'0')}</span>${wxSvg(x.sym,24)}<b class="${tcol(x.temp)}">${deg(x.temp)}</b><i>${x.rain?String(x.rain).replace('.',','):''}</i></div>`).join('')}</div>`;
    if((WX.days||[]).length)h+=`<h4>Neste dager</h4><table class="wxd"><tbody>${WX.days.map((d,i)=>`<tr><th>${dayName(d.date,i)}</th><td>${wxSvg(d.sym,24)}</td><td><b class="${tcol(d.max)}">${deg(d.max)}</b> / <span class="${tcol(d.min)}">${deg(d.min)}</span></td><td class="r">${d.rain?String(d.rain).replace('.',',')+' mm':''}</td><td class="w">${nf0.format(d.wind)} m/s</td></tr>`).join('')}</tbody></table>`}
  if(al.length)h+=`<h4>Farevarsler</h4><div class="wxal">${al.map((f,i)=>`<button data-i="${i}"><i style="background:${ALERT_COL[f.properties.level]||ALERT_COL.yellow}"></i>${esc(f.properties.title||'Farevarsel')}</button>`).join('')}</div>`;
  h+=`<p class="mnote">Værvarsel fra Yr, levert av Meteorologisk institutt og NRK.${WX&&WX.at?' Oppdatert '+tfmt.format(new Date(WX.at))+'.':''}</p>`;
  $('wxPop').innerHTML=h;$('wxX').onclick=()=>{$('wxPop').hidden=true};
  for(const x of $('wxPop').querySelectorAll('.wxal button'))x.onclick=()=>showAlert(al[+x.dataset.i].properties)}
$('wxBtn').onclick=()=>{if(!HOME){openSettings('home');return}$('wxPop').hidden=!$('wxPop').hidden;renderWx()};
async function loadWeather(){clearTimeout(loadWeather.t);if(!(F.weather&&HOME)){WX=null;renderWx();return}
  try{const d=await (await fetch('/api/weather')).json();WX=d.off?null:d}catch(e){WX={error:true}}
  renderWx();loadWeather.t=setTimeout(loadWeather,20*60e3)}
