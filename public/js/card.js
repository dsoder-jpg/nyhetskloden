// Nyhetskloden: card.js (lastes i rekkefølge fra index.html, deler globale navn med de andre filene)
// ---------- kort ----------
let cardEv=null;
function showCard({color,tag,title,orig,meta,text,srcs,url,urlText,star,img}){
  const c=$('card');c.hidden=false;cardImg(img);c.style.setProperty('--cc',color);$('cTag').textContent=tag;$('cTitle').textContent=title;
  $('cCov').hidden=true;$('cQueue').hidden=true;
  $('cOrig').textContent=orig?'Original: '+orig:'';$('cOrig').hidden=!orig;const mm=$('cMeta');mm.textContent='';for(const x of (Array.isArray(meta)?meta:[meta]).filter(Boolean)){const sp=document.createElement('span');sp.textContent=x;mm.append(sp)}$('cText').textContent=text||'';$('cText').hidden=!text;
  const ul=$('cSrcs');ul.textContent='';const many=srcs&&srcs.length>1;ul.hidden=!many;$('cFlow').hidden=!many;
  if(many){const so=[...srcs].sort((a,b)=>a.date.localeCompare(b.date)),t0=new Date(so[0].date),t1=new Date(so[so.length-1].date),hrs=(t1-t0)/36e5;
    const sameDay=t0.toDateString()===t1.toDateString(),fmt=d=>sameDay?tfmt.format(d):dfmt.format(d);
    const nS=new Set(so.map(n=>n.src)).size;
    $('cFlow').textContent=`Først meldt av ${so[0].src} ${sameDay?'kl. ':''}${fmt(t0)}. `+(nS>1?`Fulgt opp av ${nS-1} ${nS-1===1?'kilde':'andre kilder'}`:`${so.length} oppdateringer`)+(hrs>=1?` over ${hrs<24?Math.round(hrs)+' '+(Math.round(hrs)===1?'time':'timer'):Math.round(hrs/24)+' døgn'}.`:hrs>0?` i løpet av ${Math.max(1,Math.round(hrs*60))} minutter.`:'.');
    for(const n of so){const li=document.createElement('li');const tm=document.createElement('time');tm.textContent=fmt(new Date(n.date));
      const d=document.createElement('div');const b=document.createElement('b');b.textContent=n.src;d.append(b,' ');
      if(n.url&&n.url.startsWith('https://')){const a=document.createElement('a');a.href=n.url;a.target='_blank';a.rel='noopener';a.textContent=n.titleNo||n.title;d.append(a)}else d.append(n.titleNo||n.title);
      li.append(tm,d);ul.append(li)}}
  const ok=typeof url==='string'&&url.startsWith('https://');$('cSrc').hidden=!ok;if(ok){$('cSrc').href=url;$('cSrc').textContent=urlText}
  $('cStar').hidden=!star;
  $('cShare').hidden=!ok;$('cShareBox').hidden=true;shareUrl=ok?url:null;$('cTk').hidden=true;$('cLess').hidden=!star;$('cLessBox').hidden=true;
}
let shareUrl=null;
// bilde fra kilden (skjules hvis det ikke lastes, eller hvis bilder er slått av)
function cardImg(src){const im=$('cImg');const ok=typeof src==='string'&&src.startsWith('https://')&&F.images!==false;im.hidden=true;im.removeAttribute('src');
  if(!ok)return;im.onload=()=>{if(im.naturalWidth>=120)im.hidden=false};im.onerror=()=>{im.hidden=true};im.src=src}
$('cLess').onclick=()=>{const b=$('cLessBox');if(!cardEv)return;b.hidden=!b.hidden;if(b.hidden)return;$('cShareBox').hidden=true;
  const e=cardEv,c=CATS[e.cat]||CATS.annet,srcs=[...new Set(e.items.map(n=>n.src))];
  const stop=new Set('etter mellom eller blir skal ikke dette denne disse også mens fordi under over mange flere sier nytt første siste about after their there these says said with from into over amid more what when where while would could'.split(' '));
  const words=[...new Set(((e.lang==='no'?e.title:e.title)||'').match(/[\p{L}][\p{L}-]{3,}/gu)||[])].filter(w=>!stop.has(w.toLowerCase())).slice(0,6);
  if(e.place&&!words.includes(e.place))words.unshift(e.place);
  b.innerHTML=`<p>Skjul fremtidige saker som ligner. Du kan angre under Innstillinger → Skjult.</p><div class="lessrow">${srcs.map(x=>`<button class="btn" data-src="${esc(x)}">Fra ${esc(x)}</button>`).join('')}<button class="btn" data-cat="${e.cat}">Om ${esc(c.n.toLowerCase())}</button></div>
    <div class="lessrow"><span>Som nevner</span>${words.map(w=>`<button class="btn" data-w="${esc(w)}">${esc(w)}</button>`).join('')}</div>`;
  for(const x of b.querySelectorAll('button'))x.onclick=()=>{
    if(x.dataset.src){const v=[...new Set([...(SET.hiddenSrc||[]),x.dataset.src])];postSet({hiddenSrc:v},true);undoMsg('Skjuler saker fra '+x.dataset.src,()=>postSet({hiddenSrc:(SET.hiddenSrc||[]).filter(y=>y!==x.dataset.src)},true))}
    else if(x.dataset.cat){const k=x.dataset.cat,o=new Set(SET.catsOff||[]);o.add(k);if(o.size>=KEYS.length)return;postSet({catsOff:[...o]},true);undoMsg('Skjuler '+CATS[k].n.toLowerCase(),()=>postSet({catsOff:(SET.catsOff||[]).filter(y=>y!==k)},true))}
    else if(x.dataset.w){const w=x.dataset.w.toLowerCase();postSet({muteWords:[...new Set([...(SET.muteWords||[]),w])]},true);undoMsg('Skjuler saker som nevner «'+x.dataset.w+'»',()=>postSet({muteWords:(SET.muteWords||[]).filter(y=>y!==w)},true))}
    select(null)}};
let undoFn=null;
function undoMsg(t,fn){undoFn=fn;toastIds=[];$('toast').textContent=t+'. Angre';$('toast').hidden=false;clearTimeout(toastMsg.t);toastMsg.t=setTimeout(()=>{$('toast').hidden=true;undoFn=null},8000)}
const qrSvg=(txt,cell)=>{const q=qrcode(0,'M');q.addData(txt);q.make();return q.createSvgTag({cellSize:cell||4,margin:0,scalable:true})};
$('cShare').onclick=()=>{const b=$('cShareBox');if(!shareUrl)return;b.hidden=!b.hidden;if(!b.hidden)try{$('cQr').innerHTML=qrSvg(shareUrl)}catch(e){$('cQr').textContent='Lenken er for lang for QR-kode.'}};
async function copyText(t){try{await navigator.clipboard.writeText(t);return true}catch(e){const a=document.createElement('textarea');a.value=t;document.body.append(a);a.select();let ok=false;try{ok=document.execCommand('copy')}catch(x){}a.remove();return ok}}
$('cCopy').onclick=async()=>{if(!shareUrl)return;const ok=await copyText(shareUrl);$('cCopy').textContent=ok?'Kopiert ✓':'Kunne ikke kopiere';setTimeout(()=>$('cCopy').textContent='Kopier lenke',1800)};
function cardTickers(e){const box=$('cTk');box.textContent='';const t=tickersFor(e);box.hidden=!t.length;
  for(const q of t){const s=document.createElement('span');s.className='tkb';s.title=q.name+(q.price!=null?': '+fmtNum(q.price)+' '+(q.cur||''):'');
    const a=document.createElement('span');a.textContent=q.sym.replace(/\.OL$/,'');const b=document.createElement('span');b.className=q.pct>0?'up':q.pct<0?'dn':'fl';b.textContent=pctTxt(q.pct);s.append(a,b);box.append(s)}}
function select(id,go){
  const e=EVENTS.find(x=>x.id===id);S.sel=e?e.id:null;
  if(!e){$('card').hidden=true;cardEv=null;list();updateMap();return}
  cardEv=e;READ.add(e.id);saveRead();
  const c=CATS[e.cat];
  showCard({color:c.c,tag:c.n+(e.score>=7?', stor sak':''),title:e.title,orig:e.orig,
    meta:[e.place||(e.lat==null?'Uten sted':null),when(e),e.watch.length?'Følger «'+e.watch.join('», «')+'»':null,(e.srcs.length>1?'Kilder: ':'Kilde: ')+e.srcs.join(', ')],
    text:e.text,srcs:e.items,url:e.url,urlText:'Les saken hos '+(e.src||'kilden'),star:true,img:(e.items.find(n=>n.img&&n.url===e.url)||e.items.find(n=>n.img)||{}).img});
  $('cStar').setAttribute('aria-pressed',SAVED.has(e.id));$('cStar').textContent=SAVED.has(e.id)?'★':'☆';cardTickers(e);
  $('cCov').textContent=coverageText(e);$('cCov').hidden=false;queueBtn();
  if(go&&e.lat!=null&&map){const no=ccOf(e)==='NO';map.flyTo({center:[e.lon,e.lat],zoom:Math.max(map.getZoom(),no?5.2:e.exact?4.5:4),duration:reduced?0:1800,essential:true})}
  list();updateMap();
}
$('cStar').onclick=()=>{if(!cardEv)return;const e=cardEv;
  if(SAVED.has(e.id))SAVED.delete(e.id);else SAVED.set(e.id,{id:e.id,title:e.title,url:e.url,src:e.src,date:e.date,last:e.last,cat:e.cat,lat:e.lat,lon:e.lon,place:e.place,text:e.text});
  saveSaved();$('cStar').setAttribute('aria-pressed',SAVED.has(e.id));$('cStar').textContent=SAVED.has(e.id)?'★':'☆';if(S.tab==='saved')list()};
function showAlert(p){S.sel=null;cardEv=null;
  const t=p.from&&p.to?`${dfmt.format(new Date(p.from))} – ${dfmt.format(new Date(p.to))}`:'';
  showCard({color:ALERT_COL[p.level]||ALERT_COL.yellow,tag:'Farevarsel, '+({yellow:'gult',orange:'oransje',red:'rødt'}[p.level]||'')+' nivå',title:p.title,meta:[p.area,t].filter(Boolean),
    text:[p.desc,p.consequences,p.instruction].filter(Boolean).join(' '),srcs:[],url:'https://www.yr.no/nb/farevarsler',urlText:'Se farevarsler på Yr',star:false});list();updateMap()}
$('cardX').onclick=()=>select(null);
