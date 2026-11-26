// Nyhetskloden: news.js – bekreftelse og kildebalanse, døgnoppsummering, tråder, lesekø og lyd

// ---------- medier og hvor de er fra ----------
const OUTLET=src=>String(src||'').replace(/^(NRK|BBC)\b.*$/,'$1');
const ORIGIN={NRK:'Norge',VG:'Norge',Aftenposten:'Norge',Dagbladet:'Norge',E24:'Norge',SVT:'Norden',DR:'Norden',Yle:'Norden',
  BBC:'Europa','The Guardian':'Europa','Sky News':'Europa','The Independent':'Europa',Euronews:'Europa','Politico Europe':'Europa','Le Monde':'Europa',RFI:'Europa','France 24':'Europa',DW:'Europa','Kyiv Independent':'Europa',
  'New York Times':'Nord-Amerika','Washington Post':'Nord-Amerika',NPR:'Nord-Amerika','CBS News':'Nord-Amerika','ABC News':'Nord-Amerika',CBC:'Nord-Amerika','The Verge':'Nord-Amerika','Ars Technica':'Nord-Amerika',NASA:'Nord-Amerika','STAT News':'Nord-Amerika',
  'Al Jazeera':'Midtøsten','Times of Israel':'Midtøsten','Times of India':'Asia','South China Morning Post':'Asia',CNA:'Asia','The Japan Times':'Asia',Yonhap:'Asia',
  AllAfrica:'Afrika',MercoPress:'Latin-Amerika','ABC Australia':'Oseania',USGS:'Offisiell',GDACS:'Offisiell','MET farevarsler':'Offisiell'};
const originOf=src=>ORIGIN[OUTLET(src)]||ORIGIN[src]||'Annet';
function coverage(e){const outs=[...new Set(e.items.map(n=>OUTLET(n.src)))],by=new Map();
  for(const o of outs){const g=originOf(o);by.set(g,(by.get(g)||0)+1)}
  return{outs,by,official:outs.length&&outs.every(o=>originOf(o)==='Offisiell')}}
function coverageText(e){const c=coverage(e);
  if(c.official)return'Offisiell kilde: '+c.outs.join(', ')+'.';
  if(c.outs.length<2)return'Bare meldt av '+(c.outs[0]||'én kilde')+' så langt. Ikke bekreftet av andre medier ennå.';
  const parts=[...c.by].sort((a,b)=>b[1]-a[1]).map(([g,n])=>`${g} ${n}`);
  return`Bekreftet av ${c.outs.length} uavhengige medier (${parts.join(', ')}).`+(c.by.size===1&&!c.by.has('Offisiell')?` Bare ${[...c.by.keys()][0]==='Norge'?'norske':'medier fra '+[...c.by.keys()][0]} så langt.`:'')}

// ---------- døgnet oppsummert ----------
function digest(){const box=$('digestList');if(!box)return;const cut=REF()-864e5;
  const top=EVENTS.filter(e=>catOn(e.cat)&&inScope(e)&&ms(e.last)>=cut).sort((a,b)=>b.score-a.score||ms(b.last)-ms(a.last)).slice(0,5);
  $('digest').hidden=!top.length;box.textContent='';
  for(const e of top){const li=document.createElement('li'),b=document.createElement('button');b.type='button';
    const t=document.createElement('span');t.textContent=e.title;const m=document.createElement('small');const n=coverage(e).outs.length;
    m.textContent=[e.place,n>1?n+' medier':e.src].filter(Boolean).join(', ');b.append(t,m);b.onclick=()=>{S.tab='all';S.cats=new Set(KEYS);refresh();select(e.id,true)};li.append(b);box.append(li)}}
$('digest').open=store.get('nk-digest-open',true);$('digest').addEventListener('toggle',()=>store.set('nk-digest-open',$('digest').open));

// ---------- tråder: saker som henger sammen over flere dager ----------
const TSTOP=new Set(('etter mellom eller blir ble skal kan vil ikke dette denne disse også både mens fordi under over mange flere sier mener nytt første siste største norske norge norsk året dager timer uker '+
  'about after again against amid could first former great into last more most news over says said still their there these they three under until video watch were what when where which while will with would years people world report reports that this from have been their').split(' '));
const ttok=e=>{if(e._tt)return e._tt;const s=new Set();const t=((e.lang==='no'?e.title:(e.titleNo||e.title))+' '+(e.place||'')).toLowerCase();
  for(const w of t.match(/[\p{L}][\p{L}-]{3,}/gu)||[])if(!TSTOP.has(w))s.add(w.replace(/(ene|en|et|er|s)$/,''));return(e._tt=s)};
let THREADS=[],threadsAt=0;
function buildThreads(){if(Date.now()-threadsAt<60e3&&THREADS.length)return THREADS;threadsAt=Date.now();
  const ev=EVENTS.filter(e=>catOn(e.cat)&&inScope(e)),idx=new Map(),par=ev.map((_,i)=>i);
  const find=i=>par[i]===i?i:(par[i]=find(par[i]));
  ev.forEach((e,i)=>{for(const w of ttok(e)){if(!idx.has(w))idx.set(w,[]);idx.get(w).push(i)}});
  ev.forEach((e,i)=>{const cnt=new Map();for(const w of ttok(e)){const l=idx.get(w);if(l.length>60)continue;for(const j of l)if(j>i)cnt.set(j,(cnt.get(j)||0)+1)}
    for(const[j,n]of cnt){const f=ev[j],a=ttok(e),b=ttok(f),jac=n/(a.size+b.size-n);
      if(Math.abs(ms(e.date)-ms(f.date))<6*36e5)continue;
      if(jac>=.34||(n>=2&&e.cc&&e.cc===f.cc&&e.cat===f.cat&&jac>=.2))par[find(i)]=find(j)}});
  const groups=new Map();ev.forEach((e,i)=>{const r=find(i);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(e)});
  THREADS=[...groups.values()].filter(g=>{if(g.length<3)return false;const d=new Set(g.map(e=>new Date(e.date).toDateString()));return d.size>=2})
    .map(g=>{g.sort((a,b)=>ms(a.date)-ms(b.date));const main=[...g].sort((a,b)=>b.score-a.score||ms(b.last)-ms(a.last))[0];
      const wc=new Map();for(const e of g)for(const w of ttok(e))wc.set(w,(wc.get(w)||0)+1);
      const key=[...wc].filter(([w,n])=>n>=Math.max(2,g.length*.4)).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([w])=>w);
      return{id:'t:'+main.id,events:g,main,key,first:ms(g[0].date),last:Math.max(...g.map(e=>ms(e.last))),cat:main.cat,place:main.place}})
    .sort((a,b)=>b.last-a.last);
  return THREADS}
function threadRow(t){const c=CATS[t.cat]||CATS.annet,el=document.createElement('li'),b=document.createElement('button');b.style.setProperty('--cc',c.c);
  const days=Math.max(1,Math.round((t.last-t.first)/864e5));
  const tt=document.createElement('span');tt.className='lt';tt.textContent=t.main.title;
  const m=document.createElement('span');m.className='lm';
  for(const[x,cl]of[[c.n,'c'],[t.place,''],[t.events.length+' saker over '+days+(days===1?' dag':' dager'),''],['sist '+when({last:new Date(t.last).toISOString(),date:new Date(t.last).toISOString()}),'']])if(x){const sp=document.createElement('span');if(cl)sp.className=cl;sp.textContent=x;m.append(sp)}
  b.append(tt,m);if(t.key.length){const k=document.createElement('span');k.className='ls';k.innerHTML='<b>Stikkord:</b> '+esc(t.key.join(', '));b.append(k)}
  b.onclick=()=>showThread(t);el.append(b);return el}
function showThread(t){S.sel=null;cardEv=null;const c=CATS[t.cat]||CATS.annet;
  showCard({color:c.c,tag:'Tråd, '+c.n.toLowerCase(),title:t.main.title,meta:[t.place,t.events.length+' saker','startet '+dfmt.format(new Date(t.first))],
    srcs:t.events.map(e=>({date:e.date,src:coverage(e).outs.length>1?coverage(e).outs.length+' medier':e.src,title:e.title,url:e.url})),url:t.main.url,urlText:'Les den viktigste saken',star:false});
  $('cFlow').textContent=`Tråden startet ${dfmt.format(new Date(t.first))} og har ${t.events.length} saker. Siste nytt ${when({last:new Date(t.last).toISOString(),date:new Date(t.last).toISOString()})}.`;
  const pts=t.events.filter(e=>e.lat!=null);if(pts.length&&map){const lo=pts.map(e=>e.lon),la=pts.map(e=>e.lat);
    if(Math.max(...lo)-Math.min(...lo)<1&&Math.max(...la)-Math.min(...la)<1)map.flyTo({center:[lo[0],la[0]],zoom:Math.max(map.getZoom(),5),duration:reduced?0:1600});
    else map.fitBounds([[Math.min(...lo),Math.min(...la)],[Math.max(...lo),Math.max(...la)]],{padding:120,maxZoom:6,duration:reduced?0:1600})}
  list()}

// ---------- lesekø ----------
const QUEUE=new Map((store.get('nk-queue',[])||[]).map(x=>[x.id,x]));
const saveQueue=()=>{store.set('nk-queue',[...QUEUE.values()]);$('tabQueue').textContent='Lesekø'+(QUEUE.size?' '+QUEUE.size:'')};
function queueToggle(e){if(QUEUE.has(e.id))QUEUE.delete(e.id);else QUEUE.set(e.id,{id:e.id,title:e.title,url:e.url,src:e.src,date:e.date,last:e.last,cat:e.cat,place:e.place,lat:e.lat,lon:e.lon,text:e.text,added:new Date().toISOString()});
  saveQueue();queueBtn()}
function queueBtn(){const b=$('cQueue');if(!cardEv){b.hidden=true;return}b.hidden=false;const on=QUEUE.has(cardEv.id);b.setAttribute('aria-pressed',on);b.textContent=on?'I lesekøen ✓':'Les senere'}
$('cQueue').onclick=()=>{if(cardEv)queueToggle(cardEv);if(S.tab==='queue')list()};
function queueRows(ul){const q=[...QUEUE.values()].filter(e=>catOn(e.cat)).reverse();$('count2').textContent=q.length+(q.length===1?' sak':' saker')+' i lesekøen';
  if(!q.length){const l=document.createElement('li');l.className='empty';l.textContent='Lesekøen er tom. Trykk «Les senere» i en sak for å legge den her.';ul.append(l);return}
  for(const e of q){const el=li(e,true);const d=document.createElement('button');d.className='btn qdone';d.type='button';d.textContent='Lest';d.title='Fjern fra lesekøen';
    d.onclick=ev=>{ev.stopPropagation();QUEUE.delete(e.id);saveQueue();list()};el.append(d);ul.append(el)}}
// påminnelse kl. 20 hvis det ligger saker i køen
setInterval(()=>{if(!IS_APP||!QUEUE.size||store.get('nk-qrem',true)===false)return;const d=new Date(),k=d.toDateString();
  if(d.getHours()===20&&store.get('nk-qrem-day','')!==k){store.set('nk-qrem-day',k);try{const n=new Notification('Lesekøen',{body:`Du har ${QUEUE.size} ${QUEUE.size===1?'sak':'saker'} du ville lese senere.`});n.onclick=()=>{S.tab='queue';setSide('news');refresh()}}catch(e){}}},60e3);
saveQueue();

// ---------- lyd: radio og podkaster ----------
const RADIO=[{name:'NRK P1',url:'https://lyd.nrk.no/nrk_radio_p1_ostlandssendingen_mp3_h'},{name:'NRK P2',url:'https://lyd.nrk.no/nrk_radio_p2_mp3_h'},
  {name:'NRK Alltid nyheter',url:'https://lyd.nrk.no/nrk_radio_alltid_nyheter_mp3_h'},{name:'BBC World Service',url:'https://stream.live.vc.bbcmedia.co.uk/bbc_world_service'}];
let PODS=null;const aud=$('aud');
function playAudio(url,label){aud.src=url;aud.play().then(()=>{$('audNow').textContent=label;audUI()}).catch(()=>{$('audNow').textContent='Kunne ikke spille av «'+label+'». Prøv en annen kanal.';audUI()})}
function audUI(){const on=!aud.paused&&aud.src;$('audBtn').classList.toggle('on',!!on);$('audBtn').querySelector('span').textContent=on?($('audNow').textContent.length<28?$('audNow').textContent:'Spiller'):'Lytt';$('audToggle').textContent=on?'Pause':'Spill';$('audToggle').disabled=!aud.src}
aud.addEventListener('pause',audUI);aud.addEventListener('play',audUI);
$('audToggle').onclick=()=>{if(aud.paused)aud.play().catch(()=>{});else aud.pause()};
$('audVol').oninput=()=>{aud.volume=+$('audVol').value;store.set('nk-vol',aud.volume)};aud.volume=$('audVol').value=store.get('nk-vol',.8);
async function renderAudio(){const box=$('audList');let h='<h4>Direkte</h4><div class="aradio">'+RADIO.map((r,i)=>`<button class="btn" data-r="${i}">${esc(r.name)}</button>`).join('')+'</div>';
  if(!PODS){h+='<p class="meta">Henter podkaster …</p>';box.innerHTML=h;try{PODS=await (await fetch('/api/podcasts')).json()}catch(e){PODS={pods:[]}}return renderAudio()}
  for(const[pi,p]of (PODS.pods||[]).entries()){h+=`<h4>${esc(p.name)} <small>${esc(p.by)}</small></h4>`;
    h+=p.eps.length?'<ul class="apods">'+p.eps.map((e,ei)=>`<li><button data-p="${pi}" data-e="${ei}"><span>${esc(e.title)}</span><small>${e.date?dfmt.format(new Date(e.date)):''}${e.dur?', '+esc(e.dur):''}</small></button></li>`).join('')+'</ul>':'<p class="meta">Fikk ikke hentet episodene.</p>'}
  box.innerHTML=h;
  for(const b of box.querySelectorAll('[data-r]'))b.onclick=()=>{const r=RADIO[+b.dataset.r];playAudio(r.url,r.name)};
  for(const b of box.querySelectorAll('[data-p]'))b.onclick=()=>{const p=PODS.pods[+b.dataset.p],e=p.eps[+b.dataset.e];playAudio(e.audio,p.name+': '+e.title)}}
$('audBtn').onclick=()=>{const p=$('audPop');p.hidden=!p.hidden;if(!p.hidden)renderAudio()};
$('audX').onclick=()=>{$('audPop').hidden=true};
