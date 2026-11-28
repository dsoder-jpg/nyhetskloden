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
  h+=pfHtml();
  if((D.watch||[]).length)h+=`<div class="mh">Aksjer jeg følger</div><div class="qg">${D.watch.map(q=>qBtn(q,q.name)).join('')}</div>`;
  for(const[r,a]of grp)h+=`<div class="mh">${esc(r)}</div><div class="qg">${a.map(q=>qBtn(q,q.name.replace('Oslo Børs (OSEBX)','OSEBX'))).join('')}</div>`;
  const kinds=[['fx','Valuta'],['cmd','Råvarer'],['crypto','Krypto']];
  for(const[k,l]of kinds){const a=(D.other||[]).filter(q=>q.kind===k);if(a.length)h+=`<div class="mh">${l}</div><div class="qg">${a.map(q=>qBtn(q)).join('')}</div>`}
  if(F.movers&&(D.up||[]).length)h+=`<div class="mh">Oslo Børs ${MRANGE_TXT[D.range||'1d']}</div><div class="mv"><div><div class="mnote">Best</div>${moverList(D.up)}</div><div><div class="mnote">Dårligst</div>${moverList(D.down)}</div></div>`;
  h+=`<div id="mPower" hidden></div><div id="mPowerT" class="mpt" hidden></div><div id="mRate"></div><div class="mnote">Endring ${MRANGE_TXT[D.range||'1d']}. Kurser fra Yahoo Finance, oppdatert ${tfmt.format(new Date(D.at))}. De kan være forsinket. Klikk på en kurs for graf og detaljer.</div>`;
  h+=fxHtml();
  $('mBody').innerHTML=h;if(typeof powerUI==='function')powerUI();fxWire();if(PF&&(PF.rows||[]).length){pfHist();divLoad()}rateLoad();powerTomorrow()}
$('mBody').addEventListener('keydown',e=>{const r=e.target.closest('tr[data-s]');if(r&&e.key==='Enter')openDetail(r.dataset.s)});
$('mBody').addEventListener('click',e=>{const b=e.target.closest('[data-s]');if(b)openDetail(b.dataset.s);const bk=e.target.closest('#mBack');if(bk){MDET=null;MDETD=null;renderMarket()}});
// ---------- detaljer med graf ----------
let MCMP=null,MCMPD=null;
async function openDetail(sym){if(MDET!==sym){MCMP=null;MCMPD=null}MDET=sym;$('mRes').hidden=true;
  $('mBody').innerHTML='<button type="button" class="btn mback" id="mBack">‹ Tilbake</button><div class="mnote">Henter '+esc(sym)+' …</div>';$('mBody').scrollTop=0;
  const get=async s=>{try{const d=await (await fetch(`/api/mdetail?s=${encodeURIComponent(s)}&range=${MR}`)).json();return d.error?{error:d.error,sym:s}:d}catch(e){return{error:'ingen kontakt',sym:s}}};
  const [d,c]=await Promise.all([get(sym),MCMP?get(MCMP):null]);if(MDET!==sym)return;MDETD=d;MCMPD=c;renderDetail()}
async function setCompare(sym){MCMP=sym||null;MCMPD=null;if(MDET)openDetail(MDET)}
const DFMT={'1d':{hour:'2-digit',minute:'2-digit'},'5d':{weekday:'short',hour:'2-digit',minute:'2-digit'},'1mo':{day:'numeric',month:'short'},'6mo':{day:'numeric',month:'short'},'ytd':{day:'numeric',month:'short'},'1y':{day:'numeric',month:'short',year:'2-digit'},'5y':{month:'short',year:'numeric'},'max':{year:'numeric'}};
// navn et selskap kan ha i nyhetene: «Equinor ASA» → Equinor, «Kongsberg Gruppen» → Kongsberg Gruppen og Kongsberg
function coNames(d){const clean=x=>String(x||'').replace(/\b(ASA|AS|Inc\.?|Corporation|Corp\.?|Ltd\.?|plc|Holding(s)?|Group|SE|AG|N\.V\.|Class [A-C]|Common Stock)\b/gi,'').replace(/[.,()]/g,' ').replace(/\s+/g,' ').trim();
  const n=new Set([clean(d.name),clean(d.short)].filter(x=>x.length>=3).map(x=>x.split(' ').slice(0,2).join(' ')));for(const x of [...n]){const f=x.split(' ')[0];if(f.length>=5)n.add(f)}
  return [...n].filter(x=>!/^(Oslo|Norsk|Norske|Bank|Global|First|American|United)$/i.test(x))}
function coNews(d){if(/^\^|=X$|-USD$|=F$/.test(d.sym))return[];const res=coNames(d).map(n=>new RegExp('(^|[^\\p{L}\\p{N}])'+reEsc(n)+'(?![\\p{L}\\p{N}])','u'));if(!res.length)return[];
  return EVENTS.filter(e=>e.items.some(n=>res.some(re=>re.test(n.title+' '+(n.titleNo||'')+' '+(n.text||''))))).sort((a,b)=>ms(b.last)-ms(a.last)).slice(0,6)}
function renderDetail(){const d=MDETD;if(!d)return;
  if(d.error){$('mBody').innerHTML=`<button type="button" class="btn mback" id="mBack">‹ Tilbake</button><div class="mnote">Fant ikke ${esc(d.sym)} hos Yahoo Finance.</div>`;return}
  const pts=d.points||[],following=(SET.marketWatch||[]).includes(d.sym),df=new Intl.DateTimeFormat('nb-NO',DFMT[d.range]||DFMT['1mo']);
  const cmp=MCMPD&&!MCMPD.error&&(MCMPD.points||[]).length>1?MCMPD:null;
  let svg='<p class="mnote">Ingen kurser i perioden.</p>';
  if(pts.length>1){const W=600,H=190,P={l:8,r:58,t:10,b:22};
    // med sammenligning vises begge som prosent fra start av perioden
    const pc=a=>{const b0=a[0][1]||1;return a.map(p=>[p[0],(p[1]/b0-1)*100])};
    const S1=cmp?pc(pts):pts,S2=cmp?pc(cmp.points):null,all=S2?S1.concat(S2):S1,xs=all.map(p=>p[0]),ys=all.map(p=>p[1]);
    const x0=Math.min(...xs),x1=Math.max(...xs),bl=cmp?0:d.first,y0=Math.min(...ys,bl??Infinity),y1=Math.max(...ys,bl??-Infinity),yr=(y1-y0)||1;
    const X=t=>P.l+(t-x0)/((x1-x0)||1)*(W-P.l-P.r),Y=v=>P.t+(1-(v-y0)/yr)*(H-P.t-P.b);
    const col=cmp?'#5fb3ff':d.pct>0?'#3ddc84':d.pct<0?'#ff6b6b':'#9fb0c4',col2='#ffb347';
    const path=a=>a.map((p,i)=>(i?'L':'M')+X(p[0]).toFixed(1)+' '+Y(p[1]).toFixed(1)).join(''),line=path(S1),area=line+`L${X(S1[S1.length-1][0]).toFixed(1)} ${H-P.b}L${X(S1[0][0]).toFixed(1)} ${H-P.b}Z`;
    const lab=v=>cmp?pctTxt(v):fmtNum(v);
    const ticks=[y1,(y0+y1)/2,y0].map(v=>`<text x="${W-P.r+6}" y="${Y(v)+4}">${lab(v)}</text><line x1="${P.l}" x2="${W-P.r}" y1="${Y(v)}" y2="${Y(v)}"/>`).join('');
    const base=bl!=null?`<line class="base" x1="${P.l}" x2="${W-P.r}" y1="${Y(bl)}" y2="${Y(bl)}"/>`:'';
    svg=`<svg class="mchart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Kursgraf for ${esc(d.short)} ${MRANGE_TXT[d.range]}${cmp?', sammenlignet med '+esc(cmp.short):''}">
      <defs><linearGradient id="mg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity="${cmp?.14:.28}"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
      <g class="grid">${ticks}</g>${base}<path d="${area}" fill="url(#mg)"/>${S2?`<path d="${path(S2)}" fill="none" stroke="${col2}" stroke-width="1.8" vector-effect="non-scaling-stroke"/>`:''}<path d="${line}" fill="none" stroke="${col}" stroke-width="1.8" vector-effect="non-scaling-stroke"/>
      <text class="xl" x="${P.l}" y="${H-6}">${esc(df.format(new Date(x0)))}</text><text class="xl" x="${W-P.r}" y="${H-6}" text-anchor="end">${esc(df.format(new Date(x1)))}</text>
      <line id="mHx" class="hx" y1="${P.t}" y2="${H-P.b}" hidden/><circle id="mHd" r="4" fill="${col}" hidden/></svg><div class="mtip" id="mTip" hidden></div>`;
    MDETD._geo={W,P,x0,x1,X,Y,df,S1,S2,lab}}
  const st=[['Kurs',fmtNum(d.price)+' '+esc(d.cur)],['Endring '+MRANGE_TXT[d.range],`<span class="${pcls(d.pct)}">${pctTxt(d.pct)}</span>`],
    d.dayHigh!=null?['I dag',fmtNum(d.dayLow)+' til '+fmtNum(d.dayHigh)]:null,d.high52!=null?['Siste 52 uker',fmtNum(d.low52)+' til '+fmtNum(d.high52)]:null,
    d.vol?['Omsatt i dag',nf0.format(d.vol)]:null,['Børs',esc(d.exch||'–')]].filter(Boolean);
  const news=coNews(d);
  const quick=[['OSEBX.OL','OSEBX'],['^GSPC','S&P 500'],['^IXIC','Nasdaq'],['GC=F','Gull']].filter(([s])=>s!==d.sym);
  $('mBody').innerHTML=`<button type="button" class="btn mback" id="mBack">‹ Tilbake</button>
    <div class="mdh"><div><h3>${esc(d.name)}</h3><div class="mnote">${esc(d.sym)}${d.type?', '+esc(d.type.toLowerCase()):''}</div></div>
    <div class="mdp"><b>${fmtNum(d.price)}</b> <small>${esc(d.cur)}</small><div class="${pcls(d.pct)}">${pctTxt(d.pct)} ${MRANGE_TXT[d.range]}</div></div></div>
    <div class="mcw">${svg}</div>
    ${cmp?`<div class="mleg"><span><i style="background:#5fb3ff"></i>${esc(d.short)} <b class="${pcls(d.pct)}">${pctTxt(d.pct)}</b></span><span><i style="background:#ffb347"></i>${esc(cmp.short)} <b class="${pcls(cmp.pct)}">${pctTxt(cmp.pct)}</b></span><button type="button" class="btn" id="mCmpX">Fjern sammenligning</button></div>`
      :MCMPD&&MCMPD.error?`<div class="mnote">Fant ikke ${esc(MCMPD.sym)} å sammenligne med.</div>`:''}
    <div class="mcmp"><span class="mnote">Sammenlign med</span>${quick.map(([s,l])=>`<button type="button" class="btn" data-cmp="${esc(s)}" aria-pressed="${MCMP===s}">${esc(l)}</button>`).join('')}
      <div class="msearch"><input type="search" id="mCq" placeholder="Annen aksje eller indeks" aria-label="Sammenlign med" autocomplete="off"><ul id="mCres" hidden></ul></div></div>
    <dl class="mstats">${st.map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
${tradeHtml(d)}
    ${news.length?`<div class="mh">I nyhetene</div><ul class="mnews">${news.map(e=>`<li><button type="button" data-ev="${esc(e.id)}"><span>${esc(e.title)}</span><small>${esc(e.srcs.slice(0,3).join(', '))}, ${esc(when(e))}</small></button></li>`).join('')}</ul>`:''}
    <div id="mNw"></div>
    <div class="mact"><button type="button" class="btn ${following?'':'primary'}" id="mFollow">${following?'Slutt å følge':'Følg'}</button>${/^\^|=X$|-USD$|=F$/.test(d.sym)?'':`<button type="button" class="btn" id="mArch">Søk i arkivet</button>`}<a class="btn" href="https://finance.yahoo.com/quote/${encodeURIComponent(d.sym)}" target="_blank" rel="noopener">Se hos Yahoo Finance</a></div>
    <div class="mnote">Kurser fra Yahoo Finance${d.time?', sist oppdatert '+dfmt.format(new Date(d.time)):''}. De kan være forsinket og er ikke investeringsråd.</div>`;
  $('mFollow').onclick=()=>{const w=SET.marketWatch||[];postSet({marketWatch:following?w.filter(x=>x!==d.sym):[...w,d.sym].slice(-30)},true);setTimeout(()=>{renderDetail();loadMarket()},400)};
  if($('mArch'))$('mArch').onclick=()=>{const n=coNames(d)[0]||d.short;$('q').value=n;S.q=n;ARCH=null;setSide('news');refresh();searchArchive()};
  for(const b of $('mBody').querySelectorAll('[data-cmp]'))b.onclick=()=>setCompare(MCMP===b.dataset.cmp?null:b.dataset.cmp);
  if($('mCmpX'))$('mCmpX').onclick=()=>setCompare(null);
  for(const b of $('mBody').querySelectorAll('[data-ev]'))b.onclick=()=>{setSide('news');S.period='168';S.cc=null;S.tab='all';S.cats=new Set(KEYS);refresh();select(b.dataset.ev,true)};
  if(typeof nwLoad==='function')nwLoad(d);
  mSearchBox($('mCq'),$('mCres'),sym=>setCompare(sym));
  tradeWire(d);
  const sv=$('mBody').querySelector('.mchart');if(sv&&MDETD._geo){const g=MDETD._geo;
    const near=(a,t)=>{let best=a[0];for(const p of a)if(Math.abs(p[0]-t)<Math.abs(best[0]-t))best=p;return best};
    sv.addEventListener('mousemove',e=>{const r=sv.getBoundingClientRect(),t=g.x0+((e.clientX-r.left)/r.width*g.W-g.P.l)/(g.W-g.P.l-g.P.r)*(g.x1-g.x0);
      const best=near(g.S1,t);
      const hx=$('mHx'),hd=$('mHd'),tip=$('mTip');hx.setAttribute('x1',g.X(best[0]));hx.setAttribute('x2',g.X(best[0]));hx.hidden=false;hd.setAttribute('cx',g.X(best[0]));hd.setAttribute('cy',g.Y(best[1]));hd.hidden=false;
      tip.hidden=false;tip.textContent=g.lab(best[1])+(g.S2?' / '+g.lab(near(g.S2,t)[1]):'')+' · '+g.df.format(new Date(best[0]));tip.style.left=Math.min(r.width-150,Math.max(0,g.X(best[0])/g.W*r.width-70))+'px'});
    sv.addEventListener('mouseleave',()=>{$('mHx').hidden=true;$('mHd').hidden=true;$('mTip').hidden=true})}}
// søkefelt mot Yahoo (brukes i markedet og til sammenligning)
function mSearchBox(inp,ul,pick){let t=null;
  inp.addEventListener('input',()=>{clearTimeout(t);const q=inp.value.trim();if(!q){ul.hidden=true;return}
    t=setTimeout(async()=>{let r=[];try{r=await (await fetch('/api/msearch?q='+encodeURIComponent(q))).json()}catch(e){}
      if(inp.value.trim()!==q)return;ul.hidden=false;
      ul.innerHTML=Array.isArray(r)&&r.length?r.map(x=>`<li><button type="button" data-s="${esc(x.sym)}"><b>${esc(x.name)}</b><small>${esc(x.sym)}, ${esc(x.exch)}${x.type?', '+esc(x.type.toLowerCase()):''}</small></button></li>`).join(''):'<li class="mnote">Ingen treff. Prøv navnet på selskapet eller tickeren.</li>'},300)});
  inp.addEventListener('keydown',e=>{if(e.key==='Escape'){inp.value='';ul.hidden=true}if(e.key==='Enter'){e.preventDefault();const b=ul.querySelector('button');if(b)b.click()}});
  ul.addEventListener('click',e=>{const b=e.target.closest('button[data-s]');if(!b)return;e.stopPropagation();inp.value='';ul.hidden=true;pick(b.dataset.s)})}
// ---------- portefølje ----------
let PF=null;
async function loadPortfolio(){clearTimeout(loadPortfolio.t);if(!F.market||!(SET.trades||[]).length||IS_LAN){PF=null;if(!MDET)renderMarket();return}
  try{PF=await (await fetch('/api/portfolio')).json()}catch(e){PF={error:true,rows:[]}}if(!MDET)renderMarket();loadPortfolio.t=setTimeout(loadPortfolio,5*60e3)}
const kr0=v=>v==null?'–':nf0.format(Math.round(v))+' kr';
const krS=v=>v==null?'–':(v>0?'+':v<0?'−':'')+nf0.format(Math.abs(Math.round(v)))+' kr';
function pfHtml(){if(!PF||!(PF.rows||[]).length)return'';
  return`<div class="mh">Min portefølje</div><div class="pf"><div class="pfh"><div><small>Verdi</small><b>${kr0(PF.value)}</b></div><div><small>I dag</small><b class="${pcls(PF.day)}">${krS(PF.day)}</b><span class="${pcls(PF.dayPct)}">${pctTxt(PF.dayPct)}</span></div>${PF.realized?`<div><small>Realisert</small><b class="${pcls(PF.realized)}">${krS(PF.realized)}</b></div>`:''}${PF.gain!=null?`<div><small>Siden kjøp</small><b class="${pcls(PF.gain)}">${krS(PF.gain)}</b><span class="${pcls(PF.gainPct)}">${pctTxt(PF.gainPct)}</span></div>`:''}</div>
    <table class="pft"><thead><tr><th>Aksje</th><th>Antall</th><th>Verdi</th><th>I dag</th><th>Siden kjøp</th></tr></thead><tbody>${PF.rows.map(r=>r.error?`<tr><td>${esc(r.sym)}</td><td colspan="4" class="mnote">Fant ikke kursen</td></tr>`:
      `<tr data-s="${esc(r.sym)}" tabindex="0"><td title="${esc(r.name)}">${esc(r.name)}</td><td>${nf2.format(r.qty).replace(/,00$/,'')}</td><td>${kr0(r.value)}</td><td class="${pcls(r.pct)}">${pctTxt(r.pct)}</td><td class="${pcls(r.gainPct)}">${r.gainPct==null?'–':pctTxt(r.gainPct)}</td></tr>`).join('')}</tbody></table>
    <div class="pfg"><div class="seg" role="group" aria-label="Periode for porteføljen">${PFR.map(([k,l])=>`<button type="button" data-pr="${k}" aria-pressed="${k===PFRANGE}">${l}</button>`).join('')}</div><div id="pfChart" class="pfc"><div class="mnote">Regner ut historikken …</div></div></div><div id="pfDiv" class="pfdiv"></div>
    <div class="mnote">Regnet om til kroner med valutakursen hver dag. Legg inn kjøp og salg i detaljvisningen til hver aksje.</div></div>`}
// porteføljens verdi over tid, med det du har betalt som stiplet linje
const PFR=[['1mo','1 mnd'],['6mo','6 mnd'],['ytd','I år'],['1y','1 år'],['5y','5 år']];
let PFRANGE=store.get('nk-pfr','6mo'),PFH={};
async function pfHist(){const box=$('pfChart');if(!box)return;const k=PFRANGE,hit=PFH[k];
  if(!hit||Date.now()-hit.at>30*60e3){try{PFH[k]={at:Date.now(),d:await (await fetch('/api/portfolio/history?range='+k)).json()}}catch(e){PFH[k]={at:Date.now(),d:{error:'ingen kontakt',points:[]}}}}
  if(!$('pfChart')||k!==PFRANGE)return;pfDraw($('pfChart'),PFH[k].d)}
function pfDraw(box,d){const pts=(d.points||[]).filter(p=>p[1]>0);if(pts.length<2){box.innerHTML='<div class="mnote">'+(d.error?'Fikk ikke hentet historikken.':'For lite historikk i perioden.')+'</div>';return}
  const W=600,H=150,P={l:6,r:62,t:8,b:20},xs=pts.map(p=>p[0]),ys=pts.flatMap(p=>[p[1],p[2]].filter(v=>v>0)),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),yr=(y1-y0)||1;
  const X=t=>P.l+(t-x0)/((x1-x0)||1)*(W-P.l-P.r),Y=v=>P.t+(1-(v-y0)/yr)*(H-P.t-P.b),path=i=>pts.filter(p=>p[i]>0).map((p,j)=>(j?'L':'M')+X(p[0]).toFixed(1)+' '+Y(p[i]).toFixed(1)).join('');
  const first=pts[0][1],last=pts[pts.length-1][1],ch=last-first,col=ch>0?'#3ddc84':ch<0?'#ff6b6b':'#9fb0c4',df=new Intl.DateTimeFormat('nb-NO',{day:'numeric',month:'short',year:'2-digit'});
  const lab=v=>nf0.format(Math.round(v/1000))+'k';
  box.innerHTML=`<div class="pfch"><b class="${pcls(ch)}">${krS(ch)}</b> <span class="${pcls(ch)}">${pctTxt(first?ch/first*100:null)}</span> <small>i perioden</small></div>
    <svg class="mchart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Porteføljens verdi fra ${esc(df.format(new Date(x0)))} til ${esc(df.format(new Date(x1)))}">
    <g class="grid">${[y1,(y0+y1)/2,y0].map(v=>`<text x="${W-P.r+6}" y="${Y(v)+4}">${lab(v)}</text><line x1="${P.l}" x2="${W-P.r}" y1="${Y(v)}" y2="${Y(v)}"/>`).join('')}</g>
    <path d="${path(2)}" fill="none" stroke="#9fb0c4" stroke-width="1.3" stroke-dasharray="4 3" vector-effect="non-scaling-stroke"/><path d="${path(1)}" fill="none" stroke="${col}" stroke-width="1.8" vector-effect="non-scaling-stroke"/>
    <text class="xl" x="${P.l}" y="${H-5}">${esc(df.format(new Date(x0)))}</text><text class="xl" x="${W-P.r}" y="${H-5}" text-anchor="end">${esc(df.format(new Date(x1)))}</text></svg>
    <div class="mleg"><span><i style="background:${col}"></i>Verdi</span><span><i style="background:#9fb0c4"></i>Det du har betalt</span></div>`}
$('mBody').addEventListener('click',e=>{const b=e.target.closest('[data-pr]');if(!b)return;PFRANGE=b.dataset.pr;store.set('nk-pfr',PFRANGE);for(const x of $('mBody').querySelectorAll('[data-pr]'))x.setAttribute('aria-pressed',String(x===b));pfHist()});
// kjøp og salg for én aksje
const isoDay=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
function tradeHtml(d){const tr=(SET.trades||[]).filter(t=>t.sym===d.sym).sort((a,b)=>(a.date||'').localeCompare(b.date||'')),hold=(SET.portfolio||[]).find(h=>h.sym===d.sym);
  const num=v=>nf2.format(v).replace(/,00$/,''),df=new Intl.DateTimeFormat('nb-NO',{day:'numeric',month:'short',year:'numeric'});
  return`<div class="mhold"><b>Mine kjøp og salg</b>
    ${tr.length?`<table class="pft trt"><thead><tr><th>Dato</th><th></th><th>Antall</th><th>Kurs</th><th></th></tr></thead><tbody>${tr.map(t=>`<tr><td>${t.date?esc(df.format(new Date(t.date+'T12:00:00'))):'Uten dato'}</td><td>${t.side==='sell'?'Salg':'Kjøp'}</td><td>${num(t.qty)}</td><td>${t.price?num(t.price):'–'}</td><td><button type="button" class="tdel" data-tid="${esc(t.id)}" aria-label="Slett denne">×</button></td></tr>`).join('')}</tbody></table>
      <div class="mnote">${hold?`Du eier ${num(hold.qty)} til en snittkurs på ${num(hold.price)} ${esc(d.cur||'')}.`:'Du eier ingen nå.'}</div>`:''}
    <form class="trf" id="mTr"><select id="mtSide" aria-label="Kjøp eller salg"><option value="buy">Kjøp</option><option value="sell"${hold?'':' disabled'}>Salg</option></select>
      <label>Antall<input type="text" id="mtQty" inputmode="decimal" autocomplete="off"></label><label>Kurs (${esc(d.cur||'')})<input type="text" id="mtPx" inputmode="decimal" value="${d.price!=null?esc(String(+d.price.toFixed(4)).replace('.',',')):''}" autocomplete="off"></label>
      <label>Dato<input type="date" id="mtDate" value="${isoDay(new Date())}" max="${isoDay(new Date())}"></label><button class="btn primary" type="submit">Legg til</button></form><div class="mnote" id="mtMsg"></div></div>`}
function tradeWire(d){const f=$('mTr');if(!f)return;const n=v=>+String(v).replace(/\s/g,'').replace(',','.');
  f.onsubmit=e=>{e.preventDefault();const side=$('mtSide').value,qty=n($('mtQty').value),px=n($('mtPx').value),date=$('mtDate').value||null;
    if(!(qty>0)){$('mtMsg').textContent='Skriv inn antall.';$('mtQty').focus();return}
    const hold=(SET.portfolio||[]).find(h=>h.sym===d.sym);if(side==='sell'&&(!hold||qty>hold.qty+1e-9)){$('mtMsg').textContent='Du kan ikke selge flere enn du eier.';return}
    const t={id:'t'+Date.now().toString(36),sym:d.sym,side,qty,price:px>0?px:0,date};
    postSet({trades:[...(SET.trades||[]),t]},true);PFH={};setTimeout(()=>{renderDetail();loadPortfolio()},400)};
  for(const b of $('mBody').querySelectorAll('[data-tid]'))b.onclick=()=>{postSet({trades:(SET.trades||[]).filter(t=>t.id!==b.dataset.tid)},true);PFH={};setTimeout(()=>{renderDetail();loadPortfolio()},400)}}
// ---------- søk ----------
mSearchBox($('mQ'),$('mRes'),sym=>openDetail(sym));
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
  buildCo();renderMarket();setMarketLayer();list();if(cardEv)cardTickers(cardEv);if(!loadMarket.pf){loadMarket.pf=1;loadPortfolio()}loadMarket.t=setTimeout(loadMarket,5*60e3)}
function setMarketLayer(){if(!ready||!map.getSource('mkts'))return;const on=F.marketGlobe&&MKT&&MKT.indices;
  const g=new Map();if(on)for(const q of MKT.indices){if(q.lat==null)continue;const k=q.city;if(!g.has(k))g.set(k,[]);g.get(k).push(q)}
  map.getSource('mkts').setData({type:'FeatureCollection',features:[...g.values()].map(a=>({type:'Feature',geometry:{type:'Point',coordinates:[a[0].lon,a[0].lat]},
    properties:{label:a.map(q=>q.name.replace('Oslo Børs (OSEBX)','OSEBX')+' '+pctTxt(q.pct)).join('\n'),col:a[0].pct>0?'#3ddc84':a[0].pct<0?'#ff6b6b':'#9fb0c4',pct:a[0].pct||0}}))});
  for(const id of ['mk-glow','mk-dot','mk-txt'])if(map.getLayer(id))map.setLayoutProperty(id,'visibility',on?'visible':'none')}
// ---------- utbytte ----------
let DIV=null;
async function divLoad(){const box=$('pfDiv');if(!box)return;
  if(!DIV||Date.now()-DIV.at>6*3600e3){try{DIV={at:Date.now(),d:await (await fetch('/api/dividends')).json()}}catch(e){DIV={at:Date.now(),d:{error:true}}}}
  const d=DIV.d;if(!$('pfDiv'))return;if(d.error||!(d.rows||[]).length||(!d.total&&!d.next12)){$('pfDiv').innerHTML=d.error?'':'<div class="mnote">Ingen utbytte registrert for aksjene dine.</div>';return}
  const yrs=(d.years||[]).slice(-6),mx=Math.max(...yrs.map(y=>y.kr),1);
  $('pfDiv').innerHTML=`<div class="mh">Utbytte</div><div class="pfh"><div><small>Fått totalt</small><b>${kr0(d.total)}</b></div><div><small>Neste 12 mnd (anslag)</small><b>${kr0(d.next12)}</b></div></div>
    ${yrs.length?`<div class="dbars" role="img" aria-label="Utbytte per år">${yrs.map(y=>`<div><span style="height:${Math.max(3,Math.round(y.kr/mx*52))}px"></span><small>${esc(y.year)}</small><b>${nf0.format(Math.round(y.kr/100)*100)}</b></div>`).join('')}</div>`:''}
    <div class="mnote">Regnet ut fra hvor mange aksjer du eide på utbyttedagen. Anslaget bruker utbyttet de siste 12 månedene.</div>`}

// ---------- rente og boliglån ----------
let RATE=null,LOAN=store.get('nk-loan',{sum:3000000,years:25,add:1.6});
async function rateLoad(){const box=$('mRate');if(!box)return;
  if(!RATE||Date.now()-RATE.at>3*3600e3){try{RATE={at:Date.now(),d:await (await fetch('/api/rate')).json()}}catch(e){RATE={at:Date.now(),d:{error:true}}}}
  if(!$('mRate'))return;const d=RATE.d;if(d.error||d.rate==null){$('mRate').innerHTML='';return}
  const next=(typeof CALS!=='undefined'?CALS:[]).find(e=>/Norges Bank/.test(e.title)&&Date.parse(e.date+'T23:59')>=Date.now());
  const df=new Intl.DateTimeFormat('nb-NO',{day:'numeric',month:'long',year:'numeric'}),f2=v=>String(v.toFixed(2)).replace('.',',');
  const ch=(d.changes||[]).slice(-12),W=600,H=60,x0=Date.parse(ch[0][0]),x1=Date.now(),ys=ch.map(c=>c[1]),y0=Math.min(...ys),y1=Math.max(...ys);
  const X=t=>4+(t-x0)/((x1-x0)||1)*(W-8),Y=v=>6+(1-(v-y0)/((y1-y0)||1))*(H-12);
  let path='';ch.forEach((c,i)=>{const x=X(Date.parse(c[0]));path+=(i?`H${x.toFixed(1)}V`:`M${x.toFixed(1)} `)+Y(c[1]).toFixed(1)});path+=`H${W-4}`;
  $('mRate').innerHTML=`<div class="mh">Rente og boliglån</div><div class="rate"><div class="pfh"><div><small>Styringsrenten</small><b>${f2(d.rate)} %</b>${d.since?`<span class="mnote">siden ${esc(df.format(new Date(d.since)))}</span>`:''}</div>${next?`<div><small>Neste rentemøte</small><b class="rnext">${esc(df.format(new Date(next.date+'T12:00:00')))}</b></div>`:''}</div>
    <svg class="rchart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Styringsrenten de siste årene"><path d="${path}" fill="none" stroke="#9fd3ff" stroke-width="1.8" vector-effect="non-scaling-stroke"/></svg>
    <form class="loan" id="loanF" onsubmit="return false"><label>Lån (kr)<input type="text" inputmode="numeric" id="lnSum" value="${nf0.format(LOAN.sum)}"></label><label>År<input type="number" id="lnYears" min="1" max="40" value="${LOAN.years}"></label><label title="Det banken legger på styringsrenten">Påslag (%)<input type="text" inputmode="decimal" id="lnAdd" value="${f2(LOAN.add)}"></label></form>
    <div class="loanout" id="lnOut"></div><div class="mnote">Fra Norges Bank. Påslaget er det banken din legger på; sjekk lånet ditt for riktig tall.</div></div>`;
  const calc=()=>{const n=v=>+String(v).replace(/\s/g,'').replace(/ /g,'').replace(',','.');LOAN={sum:n($('lnSum').value)||0,years:Math.max(1,Math.min(40,n($('lnYears').value)||25)),add:n($('lnAdd').value)||0};store.set('nk-loan',LOAN);
    const pay=r=>{const i=r/100/12,k=LOAN.years*12;return i?LOAN.sum*i/(1-Math.pow(1+i,-k)):LOAN.sum/k},r=d.rate+LOAN.add,base=pay(r),up=pay(r+.25),dn=pay(Math.max(0,r-.25));
    $('lnOut').innerHTML=`<b>${kr0(base)} i måneden</b><small>med ${f2(r)} % rente. Opp 0,25: ${krS(up-base)}. Ned 0,25: ${krS(dn-base)} i måneden.</small>`};
  for(const i of $('loanF').querySelectorAll('input'))i.oninput=calc;calc()}

// ---------- strømpris i morgen ----------
let PTM=null;
async function powerTomorrow(){const box=$('mPowerT');if(!box||!F.power)return;
  const day=new Date(Date.now()+864e5).toLocaleDateString('sv-SE',{timeZone:'Europe/Oslo'});
  if(!PTM||PTM.day!==day||(PTM.d.error&&Date.now()-PTM.at>30*60e3)){try{PTM={day,at:Date.now(),d:await (await fetch('/api/powerday?day='+day+(SET.powerZone?'&zone='+SET.powerZone:''))).json()}}catch(e){PTM={day,at:Date.now(),d:{error:'ingen kontakt'}}}}
  if(!$('mPowerT'))return;const d=PTM.d,el=$('mPowerT');if(d.error||!d.sum){el.hidden=false;el.textContent=`I morgen (${d.name||d.zone||'ditt område'}): prisene kommer rundt kl. 13.`;return}
  const t=x=>tfmt.format(new Date(x)),k=v=>String(v.toFixed(2)).replace('.',',')+' kr';
  el.hidden=false;el.innerHTML=`<b>I morgen i ${esc(d.name)}</b> snitt ${k(d.sum.avg)}. Billigst kl. ${t(d.sum.cheap.from)}–${t(Date.parse(d.sum.cheap.from)+3*3600e3)} (${k(d.sum.cheap.avg)}), dyrest kl. ${t(d.sum.dear.t)} (${k(d.sum.dear.kr)}).`}
