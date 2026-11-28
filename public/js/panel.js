// Nyhetskloden: panel.js (lastes i rekkefølge fra index.html, deler globale navn med de andre filene)
// ---------- panel ----------
function setCountry(a2){S.cc=a2;refresh();if(a2&&map){const c=centroid(a2);if(c&&map.getZoom()<2.6)map.flyTo({center:c,zoom:3,duration:reduced?0:1400})}}
$('ctX').onclick=()=>setCountry(null);
function countryPanel(){const box=$('ctry');box.hidden=!S.cc;if(!S.cc){$('lhName').textContent={saved:'Lagrede saker',queue:'Lesekø',threads:'Tråder: saker som pågår over flere dager',watch:'Saker du følger',top:'De viktigste sakene',near:'Nær '+(HOME?HOME.name:'deg')}[S.tab]||'Hendelser';return}
  $('ctName').textContent=cname(S.cc);if(countryPanel.cc!==S.cc){countryPanel.cc=S.cc;countryFacts(S.cc)}$('lhName').textContent='Hendelser i '+cname(S.cc);
  const all=EVENTS.filter(e=>ccOf(e)===S.cc||e.ccs.includes(S.cc)),bins=new Array(28).fill(0),now=REF();
  for(const e of all){const b=Math.floor((now-ms(e.date))/(6*3600e3));if(b>=0&&b<28)bins[27-b]++}
  const mx=Math.max(1,...bins),W=280,H=46,pts=bins.map((v,i)=>[i*(W/27),H-3-(v/mx)*(H-8)]);
  const line=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  $('ctSpark').innerHTML=`<path d="${line} L${W} ${H} L0 ${H}Z" fill="rgba(255,106,61,.18)"/><path d="${line}" fill="none" stroke="#ff6a3d" stroke-width="1.8"/>`;
  const d24=all.filter(e=>now-ms(e.date)<864e5).length,top=all.filter(e=>e.score>=3.5).length;
  $('ctMeta').innerHTML=`<b>${all.length}</b> hendelser siste 7 døgn, <b>${d24}</b> siste døgn og <b>${top}</b> store saker`}
function cats(){const b=base(),all=allOn();
  $('cats').innerHTML=`<button class="cat all" data-c="*" aria-pressed="${all}"><span class="sw" style="background:#33465c"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></span>Alle<span class="n">${b.length}</span></button>`+
  Object.entries(CATS).filter(([k])=>!OFF.has(k)).map(([k,c])=>`<button class="cat" data-c="${k}" aria-pressed="${!all&&S.cats.has(k)}"><span class="sw" style="background:${c.c}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"><path d="${ICON[k]}"/></svg></span>${c.n}<span class="n">${b.filter(e=>e.cat===k).length}</span></button>`).join('')}
$('cats').addEventListener('wheel',e=>{if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){$('cats').scrollLeft+=e.deltaY;e.preventDefault()}},{passive:false});
$('cats').addEventListener('click',e=>{const b=e.target.closest('.cat');if(!b)return;const k=b.dataset.c,all=allOn();
  if(k==='*')S.cats=new Set(KEYS);
  else if(e.ctrlKey||e.metaKey){if(all)S.cats=new Set([k]);else{S.cats.has(k)?S.cats.delete(k):S.cats.add(k);if(!act().some(x=>S.cats.has(x)))S.cats=new Set(KEYS)}}
  else S.cats=(!all&&act().filter(x=>S.cats.has(x)).length===1&&S.cats.has(k))?new Set(KEYS):new Set([k]);
  store.set('nk-cats',[...S.cats]);refresh()});
function segUI(){for(const x of $('period').children)x.setAttribute('aria-pressed',x.dataset.p===S.period);for(const x of $('scope').children)x.setAttribute('aria-pressed',x.dataset.s===S.scope);
  for(const x of $('tabs').children)x.setAttribute('aria-pressed',x.dataset.t===S.tab)}
$('period').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;S.period=b.dataset.p;store.set('nk-period',S.period);tlSync();refresh()});
$('scope').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;S.scope=b.dataset.s;store.set('nk-scope',S.scope);refresh();
  if(!map)return;if(S.scope==='no')map.fitBounds(NOR_BOUNDS,{padding:60,duration:reduced?0:1600});else if(map.getZoom()>3)map.flyTo({center:map.getCenter(),zoom:1.9,duration:reduced?0:1400})});
$('tabs').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;S.tab=b.dataset.t;refresh()});
// ---------- kildelister ----------
const SRC_BUILTIN=[{id:'',name:'Alle kilder'},{id:'b:no',name:'Bare norske',f:f=>f.lang==='no'&&f.src!=='USGS'},{id:'b:nordic',name:'Norden',f:f=>['no','sv','da'].includes(f.lang)&&f.src!=='USGS'||f.src==='Yle'},
  {id:'b:intl',name:'Internasjonale',f:f=>f.lang!=='no'},{id:'b:eco',name:'Økonomi',f:f=>f.cat==='marked'||/^(E24|CNBC|Financial Times|The Economist|Nikkei Asia)$/.test(f.src)},
  {id:'b:tech',name:'Teknologi og forskning',f:f=>['teknologi','vitenskap'].includes(f.cat)}];
let SRCSEL=store.get('nk-srclist',''),SRCSET=null;
function srcListSetup(){const feeds=SET.builtinFeeds||[],mine=SET.srcLists||[];const b=SRC_BUILTIN.find(x=>x.id===SRCSEL);
  if(!SRCSEL)SRCSET=null;else if(b)SRCSET=new Set(feeds.filter(b.f).map(f=>f.src));else{const l=mine.find(x=>'u:'+x.name===SRCSEL);if(l)SRCSET=new Set(l.srcs);else{SRCSEL='';SRCSET=null}}
  const sel=$('srcSel');sel.textContent='';const opt=(v,t)=>{const o=document.createElement('option');o.value=v;o.textContent=t;return o};
  for(const x of SRC_BUILTIN)sel.append(opt(x.id,x.name));
  if(mine.length){const g=document.createElement('optgroup');g.label='Mine lister';for(const l of mine)g.append(opt('u:'+l.name,l.name));sel.append(g)}
  sel.append(opt('new','Lag ny liste …'));sel.value=SRCSEL;sel.classList.toggle('on',!!SRCSEL)}
const inSrcList=e=>!SRCSET||e.items.some(n=>SRCSET.has(n.src));
$('srcSel').onchange=e=>{const v=e.target.value;if(v==='new'){e.target.value=SRCSEL;openSettings('sources');setTimeout(()=>{const n=$('slName');if(n)n.focus()},120);return}
  SRCSEL=v;store.set('nk-srclist',v);srcListSetup();refresh()};
let qT;$('q').addEventListener('input',e=>{clearTimeout(qT);qT=setTimeout(()=>{S.q=e.target.value.trim();if(ARCH&&ARCH.q!==S.q)ARCH=null;refresh()},150)});
$('q').addEventListener('keydown',e=>{if(e.key==='Enter'&&S.q.length>=2&&!view().length)searchArchive()});

function li(e,saved){
  const c=CATS[e.cat]||CATS.annet,el=document.createElement('li'),b=document.createElement('button');
  if(READ.has(e.id)&&e.id!==S.sel)el.className='read';
  b.style.setProperty('--cc',c.c);b.setAttribute('aria-pressed',e.id===S.sel);
  b.onclick=()=>{if(EVENTS.some(x=>x.id===e.id))select(e.id,true);else{S.sel=null;showCard({color:c.c,tag:c.n+', lagret',title:e.title,meta:[e.place,dfmt.format(new Date(e.last||e.date)),e.src?'Kilde: '+e.src:null],text:e.text,srcs:[],url:e.url,urlText:'Les saken hos '+(e.src||'kilden'),star:false});
    if(e.lat!=null&&map)map.flyTo({center:[e.lon,e.lat],zoom:Math.max(map.getZoom(),4),duration:reduced?0:1600})}};
  const t=document.createElement('span');t.className='lt';t.textContent=e.title;
  const m=document.createElement('span');m.className='lm';
  const add=(txt,cls)=>{if(!txt)return;const s=document.createElement('span');if(cls)s.className=cls;s.textContent=txt;m.append(s)};
  if(!saved&&fresh(e))add('Ny','new');
  add(c.n,'c');if(!saved&&e.score>=7){add('Stor sak','big');el.classList.add('big')}
  add(e.place||(e.lat==null&&!saved?'Uten sted':''));add(saved?dfmt.format(new Date(e.last||e.date)):when(e));
  if(!saved&&e.srcs.length<2)add(e.src);if(!saved&&e.items){const n=coverage(e).outs.length;if(n>=3)add('Bekreftet av '+n,'ok')}
  if(!saved){if(e.watch.length)add('Følger «'+e.watch[0]+'»','wt');const tq=tickersFor(e)[0];if(tq)add(tq.sym.replace(/\.OL$/,'')+' '+pctTxt(tq.pct),tq.pct>0?'up':tq.pct<0?'dn':'fl')}
  if(SAVED.has(e.id))add('★ Lagret','');
  b.append(t,m);
  if(!saved&&e.srcs.length>1){const k=document.createElement('span');k.className='ls';const n=e.srcs.length,shown=e.srcs.slice(0,4);
    k.innerHTML='<b>Kilder:</b> '+esc(shown.join(', '))+(n>4?' og '+(n-4)+' til':'');k.title='Kilder: '+e.srcs.join(', ');b.append(k)}
  el.append(b);return el}
let ARCH=null;
async function searchArchive(){const q=S.q;if(q.length<2)return;$('count2').textContent='Søker i arkivet …';
  try{const d=await (await fetch('/api/archive?q='+encodeURIComponent(q))).json();ARCH={q,items:d.items||[]}}catch(e){ARCH={q,items:[],err:true}}list()}
function archiveRow(n){const c=CATS[n.cat]||CATS.annet,el=document.createElement('li'),b=document.createElement('button');b.style.setProperty('--cc',c.c);
  b.onclick=()=>{S.sel=null;showCard({color:c.c,tag:c.n+', fra arkivet',title:n.lang==='no'?n.title:(n.titleNo||n.title),orig:n.lang!=='no'&&n.titleNo?n.title:null,meta:[n.place,dfmt.format(new Date(n.date)),'Kilde: '+n.src],srcs:[],url:n.url,urlText:'Les saken hos '+n.src,star:false});
    if(n.lat!=null&&map)map.flyTo({center:[n.lon,n.lat],zoom:Math.max(map.getZoom(),4),duration:reduced?0:1600})};
  const t=document.createElement('span');t.className='lt';t.textContent=n.lang==='no'?n.title:(n.titleNo||n.title);
  const m=document.createElement('span');m.className='lm';for(const[x,cl]of[[c.n,'c'],[n.place,''],[dfmt.format(new Date(n.date)),''],[n.src,'']])if(x){const sp=document.createElement('span');if(cl)sp.className=cl;sp.textContent=x;m.append(sp)}
  b.append(t,m);el.append(b);return el}
function list(){
  const ul=$('list');ul.textContent='';
  if(ARCH&&ARCH.q===S.q&&S.q.length>=2){$('count2').textContent=ARCH.items.length+(ARCH.items.length===1?' treff':' treff')+' i arkivet';
    const bk=document.createElement('li');bk.className='empty';const bb=document.createElement('button');bb.className='btn';bb.type='button';bb.textContent='Tilbake til dagens saker';bb.onclick=()=>{ARCH=null;list()};
    bk.append(ARCH.err?'Fikk ikke søkt i arkivet. ':ARCH.items.length?'':'Ingen treff for «'+S.q+'» de siste 90 dagene. ',bb);ul.append(bk);
    for(const n of ARCH.items)ul.append(archiveRow(n));return}
  if(S.tab==='queue'){queueRows(ul);return}
  if(S.tab==='threads'){const th=buildThreads();$('count2').textContent=th.length+(th.length===1?' tråd':' tråder');
    if(!th.length){const l=document.createElement('li');l.className='empty';l.textContent='Ingen tråder ennå. En tråd er en sak som har fått nye oppdateringer over minst to dager.';ul.append(l)}
    for(const t of th.slice(0,80))ul.append(threadRow(t));return}
  if(S.tab==='saved'){const sv=[...SAVED.values()].filter(e=>catOn(e.cat)).reverse();$('count2').textContent=sv.length+(sv.length===1?' sak':' saker');
    if(!sv.length){const l=document.createElement('li');l.className='empty';l.textContent='Ingen lagrede saker. Åpne en sak og trykk på stjerna for å lagre den.';ul.append(l)}
    for(const e of sv)ul.append(li(e,true));return}
  const ev=view();$('count2').textContent=ev.length+(ev.length===1?' hendelse':' hendelser');
  if(S.tab==='foryou'&&typeof forYouNote==='function'&&forYouNote()){const l=document.createElement('li');l.className='empty';l.textContent=forYouNote();ul.append(l)}
  if(!ev.length&&!(S.q.length>=2)){const l=document.createElement('li');l.className='empty';l.textContent=!EVENTS.length?'Henter nyheter …':S.tab==='watch'?'Ingen saker nevner ordene du følger ennå. Legg til ord under Innstillinger.':S.tab==='near'?'Ingen saker innenfor '+(SET.nearKm||50)+' km fra '+(HOME?HOME.name:'hjemstedet')+' i denne perioden.':'Ingen hendelser med disse filtrene.';ul.append(l);return}
  for(const e of ev.slice(0,300))ul.append(li(e));
  if(S.q.length>=2){const l=document.createElement('li');l.className='empty';const b=document.createElement('button');b.className='btn';b.type='button';b.textContent='Søk etter «'+S.q+'» i arkivet (90 dager)';b.onclick=searchArchive;l.append(b);ul.append(l)}
}
function kpis(){const b=base(),h=heatMap(),n1=EVENTS.filter(e=>{const a=age(e);return a>=0&&a<=60&&inScope(e)}).length,n2=b.filter(e=>e.score>=3.5).length;
  if(EVENTS.length){const P={1:'siste time',6:'siste seks timer',24:'siste døgn',168:'siste uke'}[S.period]||'';
    $('sumline').innerHTML=(n1?`<b>${n1}</b> ${n1===1?'ny hendelse':'nye hendelser'} siste time.`:'Ingen nye hendelser siste time.')+` <b>${n2}</b> ${n2===1?'stor sak':'store saker'} i <b>${h.size}</b> ${h.size===1?'land':'land'} ${P}.`}
  const top=[...h.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6),max=top.length?top[0][1]:1,ul=$('hot');ul.textContent='';
  if(!top.length){const l=document.createElement('li');l.className='meta';l.textContent='Ingen hendelser med sted ennå';ul.append(l)}
  for(const[a2,v]of top){const l=document.createElement('li'),b=document.createElement('button');b.onclick=()=>setCountry(a2);
    const n=document.createElement('span');n.textContent=cname(a2);const r=document.createElement('span');r.className='bars';const i=document.createElement('i');i.style.width=Math.max(6,60*v/max)+'px';
    r.append(i,String(base().filter(e=>catOn(e.cat)&&ccOf(e)===a2).length));b.append(n,r);l.append(b);ul.append(l)}
  trendUI();if(AREA&&ready)$('areaN').textContent=base().length+' hendelser'}
let brIdx=0,brList=[];
function breaking(){brList=EVENTS.filter(e=>e.score>=6&&(Date.now()-ms(e.date))/6e4<=90).sort((a,b)=>b.score-a.score).slice(0,5);
  const on=brList.length>0;$('breaking').hidden=!on;document.body.classList.toggle('has-breaking',on);if(on)showBr()}
function showBr(){if(!brList.length)return;const e=brList[brIdx%brList.length];$('brTxt').textContent=e.title;$('brMeta').textContent=[e.place,when(e),e.srcs.length>1?e.srcs.length+' kilder':e.src].filter(Boolean).join(', ');$('breaking').dataset.id=e.id}
setInterval(()=>{brIdx++;showBr()},7000);
$('breaking').onclick=()=>{const id=$('breaking').dataset.id;if(id){S.cats=new Set(KEYS);S.tab='all';refresh();select(id,true)}};
const shortDate=new Intl.DateTimeFormat('nb-NO',{day:'numeric',month:'short'});
function stText(st){if(!st)return'venter';if(st.ok)return st.stale&&st.lastNew?'Ingen nye saker siden '+shortDate.format(new Date(st.lastNew)):st.n+' saker';
  return(st.paused&&st.until?'På pause til '+tfmt.format(new Date(st.until))+': ':'')+(st.err||'feil')}
const stCls=st=>!st?'':st.ok?(st.stale?'warn':'ok'):'bad';
function srcCounts(v){return{ok:v.filter(s=>s.ok&&!s.stale).length,paused:v.filter(s=>s.paused).length,stale:v.filter(s=>s.ok&&s.stale).length,bad:v.filter(s=>!s.ok&&!s.paused).length}}
let OFFLINE={net:false,engine:false};
function offlineUI(){const o=$('offline');const lp=meta.lastPoll?tfmt.format(new Date(meta.lastPoll)):null;
  if(OFFLINE.engine){o.innerHTML='<b>Mistet kontakt med nyhetsmotoren.</b> Prøver igjen …';o.hidden=false}
  else if(OFFLINE.net||!navigator.onLine){o.innerHTML='<b>Uten nett.</b> '+(NEWS.length?`Viser lagrede saker${lp?' fra kl. '+lp:''}. Kloden oppdateres når nettet er tilbake.`:'Kloden fylles opp når nettet er tilbake.');o.hidden=false}
  else o.hidden=true}
addEventListener('online',offlineUI);addEventListener('offline',offlineUI);
function sources(st){if(!st)return;OFFLINE.net=!!(st.net&&st.net.offline);offlineUI();st=Object.fromEntries(Object.entries(st).filter(([k,v])=>!v.hidden&&k!=='net'));STATUS=st;const v=Object.values(st),c=srcCounts(v);
  $('srcSum').textContent=`Kilder: ${c.ok+c.stale} av ${v.length} virker`+(c.paused?`, ${c.paused} på pause`:'');
  if($('dlg').open&&$('srcTbl').children.length)renderSettings(true);
  const ul=$('srcList');ul.textContent='';
  for(const s of [...v].sort((a,b)=>(a.ok-b.ok)||a.src.localeCompare(b.src,'nb'))){const l=document.createElement('li');const sp=document.createElement('span');sp.className=stCls(s);sp.textContent=s.ok?(s.stale?'! ':'✓ '):'✗ ';l.append(sp,s.src+': '+stText(s));ul.append(l)}}
function refresh(){segUI();cats();countryPanel();list();kpis();updateMap();digest()}

// ---------- tidslinje ----------
let playing=null;
const span=()=>+S.period*3600e3;
function tlSync(){const r=$('tlRange');if(S.tl==null){r.value=1000;$('tlWhen').textContent='';$('tlLive').setAttribute('aria-pressed','true')}
  else{r.value=Math.round(1000*(1-(Date.now()-S.tl)/span()));$('tlWhen').textContent=dfmt.format(new Date(S.tl));$('tlLive').setAttribute('aria-pressed','false')}
  $('tlPlay').textContent=playing?'❚❚':'▶';}
function setTl(t){S.tl=t==null||t>=Date.now()-30e3?null:t;tlSync();refresh();if(ready){map.getSource('night').setData(nightBands(REF()));nightImgUpdate()}}
$('tlRange').addEventListener('input',e=>{stopPlay();const v=+e.target.value;setTl(v>=1000?null:Date.now()-span()*(1-v/1000))});
$('tlLive').onclick=()=>{stopPlay();setTl(null)};
function stopPlay(){if(playing){cancelAnimationFrame(playing);playing=null;tlSync()}}
$('tlPlay').onclick=()=>{if(playing){stopPlay();return}let t=S.tl??Date.now()-span();if(Date.now()-t<60e3)t=Date.now()-span();
  const dur=25000,rate=span()/dur;let last=performance.now(),acc=0,seen=null;
  const step=now=>{t+=(now-last)*rate;acc+=now-last;last=now;if(t>=Date.now()){playing=null;setTl(null);return}
    if(acc>120){acc=0;S.tl=t;tlSync();refresh();map.getSource('night').setData(nightBands(t));nightImgUpdate();
      const ids=view();if(seen)popAdd(ids.filter(e=>!seen.has(e.id)));seen=new Set(ids.map(e=>e.id))}playing=requestAnimationFrame(step)};
  playing=requestAnimationFrame(step);tlSync()};
