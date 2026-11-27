// Nyhetskloden: map.js (lastes i rekkefølge fra index.html, deler globale navn med de andre filene)
// ---------- kart ----------
const LOCAL_STYLE={version:8,projection:{type:'globe'},glyphs:'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',sources:{},
  layers:[{id:'background',type:'background',paint:{'background-color':'#0d2238'}}]};
let FONT=['Noto Sans Regular'],FONT_B=['Noto Sans Bold'],usingLocal=false,fontFound=false;
async function loadStyle(){
  try{const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),7000);
    const st=await (await fetch('https://tiles.openfreemap.org/styles/dark',{signal:ctrl.signal})).json();clearTimeout(t);
    if(!st.layers)throw 0;tuneStyle(st);return st}
  catch(e){usingLocal=true;return LOCAL_STYLE}}
function tuneStyle(st){
  st.projection={type:'globe'};
  const name=['coalesce',['get','name:nb'],['get','name:no'],['get','name:latin'],['get','name']];
  const fill={background:'#162231',water:'#0a1828',landcover_ice_shelf:'#1d2a39',landcover_glacier:'#1d2a39',landuse_residential:'#1b2635',landcover_wood:'#15202d',landuse_park:'#15202d',building:'#1e2a38','aeroway-area':'#1b2735',road_area_pier:'#162231'};
  const line={waterway:'#0a1828',highway_path:'#1f2c3b',highway_minor:'#223042',highway_major_casing:'#0d1520',highway_major_inner:'#2b3c52',highway_major_subtle:'#273649',highway_motorway_casing:'#0d1520',highway_motorway_inner:'#3a5170',highway_motorway_subtle:'#2a3b51',railway:'#2b3646',railway_minor:'#26313f',railway_transit:'#26313f',boundary_state:'#2f4157','boundary_country_z0-4':'#5d728b','boundary_country_z5-':'#5d728b','aeroway-runway':'#26344a','aeroway-taxiway':'#1e2a3a'};
  for(const l of st.layers){const p=l.paint||(l.paint={}),lay=l.layout||(l.layout={});
    if(l.type==='background')p['background-color']=fill.background;
    else if(l.type==='fill'&&fill[l.id])p['fill-color']=fill[l.id];
    else if(l.type==='line'&&line[l.id])p['line-color']=line[l.id];
    if(/^boundary_country/.test(l.id))p['line-width']=['interpolate',['linear'],['zoom'],1,.6,5,1.2,10,2];
    if(l.type==='symbol'&&lay['text-field']&&/name/.test(JSON.stringify(lay['text-field']))){lay['text-field']=name;p['text-halo-color']='rgba(6,11,19,.92)';p['text-halo-width']=1.3;
      if(/^place_country/.test(l.id))p['text-color']='#b9c9db';else if(/^place_city/.test(l.id))p['text-color']='#dbe5f0';else if(/^place/.test(l.id))p['text-color']='#94a7bc';
      else if(l.id==='water_name')p['text-color']='#4d6f93';else p['text-color']='#7f93a9'}
    if(lay['text-font']&&!fontFound){FONT=lay['text-font'];fontFound=true}}
  if(st.sources.ne2_shaded){const i=st.layers.findIndex(l=>l.id==='water');
    st.layers.splice(i<0?1:i,0,{id:'relief',type:'raster',source:'ne2_shaded',maxzoom:7,paint:{'raster-opacity':['interpolate',['linear'],['zoom'],0,.55,5,.35,7,0],'raster-saturation':-.75,'raster-brightness-max':.42,'raster-contrast':.15,'raster-hue-rotate':200}})}
  if(FONT[0]&&/Regular/.test(FONT[0]))FONT_B=[FONT[0].replace('Regular','Bold')];
}
let map,beforeLabels;
async function initMap(){
  const style=await loadStyle();
  try{const c=document.createElement('canvas');if(!(c.getContext('webgl2')||c.getContext('webgl')))throw 0}catch(e){$('boot').textContent='Kartet trenger WebGL. Slå på maskinvareakselerasjon eller oppdater skjermkortdriveren.';return}
  const view=store.get('nk-view2',{center:[12,40],zoom:1.9});
  map=new maplibregl.Map({container:'map',style,center:view.center,zoom:view.zoom,minZoom:.6,maxZoom:18,attributionControl:{compact:true},
    renderWorldCopies:false,fadeDuration:150,dragRotate:false,pitchWithRotate:false,touchPitch:false});
  map.touchZoomRotate.disableRotation();
  map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');
  map.addControl(new Tools(),'top-right');
  map.on('moveend',()=>store.set('nk-view2',{center:map.getCenter().toArray(),zoom:map.getZoom()}));
  map.on('style.load',()=>{map.setProjection({type:'globe'});
    try{map.setSky({'sky-color':'#0a1a2e','horizon-color':'#2b5b8f','fog-color':'#0a1a2e','sky-horizon-blend':.6,'horizon-fog-blend':.6,'fog-ground-blend':.9,'atmosphere-blend':['interpolate',['linear'],['zoom'],0,1,5,1,7,0]})}catch(e){}});
  map.on('load',onLoad);
}
class Tools{onAdd(){const d=document.createElement('div');d.className='maplibregl-ctrl maplibregl-ctrl-group';
  const mk=(id,title,svg)=>{const b=document.createElement('button');b.type='button';b.id=id;b.className='nk';b.title=title;b.setAttribute('aria-label',title);b.innerHTML='<span>'+svg+'</span>';d.append(b);return b};
  mk('bWorld','Hele kloden','<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/></svg>').onclick=()=>map.flyTo({center:map.getCenter(),zoom:1.9,duration:reduced?0:1400});
  mk('bNor','Norge','<b style="font-size:11px">NO</b>').onclick=()=>map.fitBounds(NOR_BOUNDS,{padding:60,duration:reduced?0:1600});
  const sp=mk('bSpin','Snurr kloden','<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4.5h-4.5"/></svg>');
  const ar=mk('bArea','Vis bare et område','<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-dasharray="3 2.4"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/></svg>');ar.setAttribute('aria-pressed','false');ar.onclick=()=>areaStart();
  sp.setAttribute('aria-pressed','false');sp.onclick=()=>{spin=!spin;sp.setAttribute('aria-pressed',spin);if(spin)spinStep()};
  return d}onRemove(){}}
let spin=false;
function spinStep(){if(!spin||!map)return;if(map.isMoving()||map.getZoom()>4){setTimeout(spinStep,500);return}
  const c=map.getCenter();map.easeTo({center:[c.lng+6,c.lat],duration:3000,easing:t=>t});map.once('moveend',spinStep)}
let lastTouch=Date.now();
['mousedown','touchstart','wheel'].forEach(ev=>$('map').addEventListener(ev,()=>{lastTouch=Date.now();if(spin){spin=false;const b=$('bSpin');if(b)b.setAttribute('aria-pressed','false')}},{passive:true}));
document.addEventListener('keydown',()=>{lastTouch=Date.now()},true);
// kloden snurrer sakte av seg selv når ingen har rørt den på et minutt og hele kloden vises
setInterval(()=>{if(!ready||spin||F.spin===false||reduced||document.hidden||playing||S.sel||Date.now()-lastTouch<60e3||map.getZoom()>3||map.isMoving())return;
  spin=true;const b=$('bSpin');if(b)b.setAttribute('aria-pressed','true');spinStep()},5e3);

function iconImage(cat,kind){const r=kind==='x'?17:kind==='t'?13:10,pad=kind==='x'?9:3,s=(r+pad)*2,pr=2,c=document.createElement('canvas');c.width=c.height=s*pr;const x=c.getContext('2d');x.scale(pr,pr);
  if(kind==='x'){const g=x.createRadialGradient(s/2,s/2,r*.8,s/2,s/2,r+pad);g.addColorStop(0,CATS[cat].c+'aa');g.addColorStop(1,CATS[cat].c+'00');x.fillStyle=g;x.beginPath();x.arc(s/2,s/2,r+pad,0,7);x.fill()}
  x.shadowColor='rgba(0,0,0,.55)';x.shadowBlur=5;x.shadowOffsetY=1;x.fillStyle=CATS[cat].c;x.beginPath();x.arc(s/2,s/2,r,0,7);x.fill();
  x.shadowColor='transparent';x.lineWidth=kind==='n'?1.6:2.3;x.strokeStyle='#fff';x.stroke();
  const k=r*1.25/24;x.translate(s/2-12*k,s/2-12*k);x.scale(k,k);x.strokeStyle='#fff';x.lineWidth=2.3;x.lineJoin='round';x.lineCap='round';x.stroke(new Path2D(ICON[cat]));
  if(cat==='sport'){x.fillStyle='#fff';x.fill(new Path2D('M12 7.5 15.8 10.3 14.4 14.8H9.6L8.2 10.3Z'))}
  return{width:s*pr,height:s*pr,data:x.getImageData(0,0,s*pr,s*pr).data}}

const EMPTY={type:'FeatureCollection',features:[]};
function onLoad(){
  $('boot').hidden=true;
  beforeLabels=(map.getStyle().layers.find(l=>l.type==='symbol')||{}).id;
  for(const k in CATS)for(const z of ['n','t','x'])map.addImage(z+'-'+k,iconImage(k,z),{pixelRatio:2});
  map.addSource('sat',{type:'raster',tileSize:256,maxzoom:18,attribution:'Satellittbilder: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?blankTile=false']});
  map.on('error',e=>{if(!(e&&e.sourceId))console.warn(e&&e.error)});
  const firstLine=(map.getStyle().layers.find(l=>l.type==='line')||{}).id;
  if(usingLocal){map.addSource('land',{type:'geojson',data:COUNTRIES||EMPTY});
    map.addLayer({id:'land',type:'fill',source:'land',paint:{'fill-color':'#1c2836'}});
    map.addLayer({id:'land-line',type:'line',source:'land',paint:{'line-color':'#3d5168','line-width':.6}})}
  map.addLayer({id:'sat',type:'raster',source:'sat',paint:{'raster-saturation':0,'raster-brightness-max':1,'raster-contrast':.08,'raster-fade-duration':200}},usingLocal?'land-line':firstLine);
  DETAIL=map.getStyle().layers.filter(l=>/^(transportation|transportation_name|building|aeroway|landuse|landcover)$/.test(l['source-layer']||'')).map(l=>({id:l.id,min:l.minzoom||0,max:l.maxzoom||24,
    hybrid:/^transportation/.test(l['source-layer'])&&(l.type==='line'||l.type==='symbol')}));
  map.addSource('countries',{type:'geojson',data:COUNTRIES||EMPTY,promoteId:'a2'});
  map.addLayer({id:'heat',type:'fill',source:'countries',paint:{'fill-color':['interpolate',['linear'],['coalesce',['feature-state','h'],0],0,'rgba(0,0,0,0)',.001,'#7a2a12',.35,'#d9480f',.7,'#fb7a1e',1,'#fcc419'],'fill-opacity':0}},beforeLabels);
  map.addLayer({id:'flash',type:'fill',source:'countries',paint:{'fill-color':'#ffd166','fill-opacity':['*',.55,['coalesce',['feature-state','f'],0]]}},beforeLabels);
  map.addLayer({id:'c-hover',type:'line',source:'countries',paint:{'line-color':'#c9dcf2','line-width':['case',['boolean',['feature-state','hover'],false],1.4,0]}},beforeLabels);
  map.addLayer({id:'c-sel',type:'line',source:'countries',paint:{'line-color':'#5b9bff','line-width':['case',['boolean',['feature-state','sel'],false],2.4,0]}},beforeLabels);
  map.addSource('alerts',{type:'geojson',data:ALERTS});
  map.addLayer({id:'alerts',type:'fill',source:'alerts',paint:{'fill-color':['match',['get','level'],'red',ALERT_COL.red,'orange',ALERT_COL.orange,ALERT_COL.yellow],'fill-opacity':['interpolate',['linear'],['zoom'],2,.35,8,.22]}},beforeLabels);
  map.addLayer({id:'alerts-line',type:'line',source:'alerts',paint:{'line-color':['match',['get','level'],'red',ALERT_COL.red,'orange',ALERT_COL.orange,ALERT_COL.yellow],'line-width':1.3}},beforeLabels);
  map.addSource('night',{type:'geojson',data:nightBands()});
  // natt: fem bånd fra skumring til dyp natt. Sammen gir de rundt 70 % mørke der det er natt, og blir svakere når du zoomer inn.
  map.addLayer({id:'night',type:'fill',source:'night',paint:{'fill-color':'#00040c','fill-opacity':['interpolate',['linear'],['zoom'],2,.21,6,.13,10,.06],'fill-antialias':false}},beforeLabels);
  setInterval(()=>map.getSource('night').setData(nightBands(REF())),60e3);
  map.addSource('arcs',{type:'geojson',data:EMPTY,lineMetrics:true});
  map.addLayer({id:'arcs-base',type:'line',source:'arcs',layout:{'line-cap':'round'},paint:{'line-color':['get','col'],'line-width':['case',['==',['get','sel'],1],2.6,1.4],'line-opacity':['case',['==',['get','sel'],1],.55,.22]}});
  map.addLayer({id:'arcs',type:'line',source:'arcs',layout:{'line-cap':'round'},paint:{'line-color':['get','col'],'line-width':['case',['==',['get','sel'],1],3,1.8],'line-opacity':['case',['==',['get','sel'],1],1,.75],'line-dasharray':[0,4,3]}});
  addExtraLayers();
  map.addSource('news',{type:'geojson',data:EMPTY,cluster:true,clusterRadius:34,clusterMaxZoom:5,
    clusterProperties:{top:['+',['get','top']],recent:['+',['get','recent']],maxs:['max',['get','score']]}});
  map.addLayer({id:'cl-halo',type:'circle',source:'news',filter:['has','point_count'],paint:{'circle-color':['case',['>=',['get','maxs'],7],'#ef4444','#ff6a3d'],'circle-opacity':['case',['>',['get','recent'],0],.24,0],
    'circle-radius':['+',8,['step',['get','point_count'],12,5,15,15,19,40,24]]}});
  map.addLayer({id:'clusters',type:'circle',source:'news',filter:['has','point_count'],paint:{'circle-color':'#101b28','circle-opacity':.95,
    'circle-radius':['step',['get','point_count'],12,5,15,15,19,40,24],'circle-stroke-width':['case',['>=',['get','maxs'],7],3,2],'circle-stroke-color':['case',['>=',['get','maxs'],7],'#ef4444',['>',['get','top'],0],'#ff6a3d','#7f93ab']}});
  map.addLayer({id:'cl-count',type:'symbol',source:'news',filter:['has','point_count'],layout:{'text-field':['get','point_count_abbreviated'],'text-font':FONT_B,'text-size':12.5,'text-allow-overlap':true},paint:{'text-color':'#fff'}});
  map.addLayer({id:'pulse',type:'circle',source:'news',filter:['all',['!',['has','point_count']],['==',['get','recent'],1]],paint:{'circle-radius':12,'circle-color':'rgba(0,0,0,0)','circle-stroke-width':2,'circle-stroke-color':['get','col'],'circle-stroke-opacity':.8}});
  map.addLayer({id:'pts',type:'symbol',source:'news',filter:['!',['has','point_count']],layout:{'icon-image':['concat',['get','size'],'-',['get','cat']],
    'icon-allow-overlap':true,'icon-ignore-placement':true,'symbol-sort-key':['get','sort'],
    'text-field':['case',['>',['get','nsrc'],1],['to-string',['get','nsrc']],''],'text-font':FONT_B,'text-size':10.5,'text-offset':[1.15,-1.05],'text-allow-overlap':true,'text-ignore-placement':true},
    paint:{'text-color':'#fff','text-halo-color':'#1d4ed8','text-halo-width':3}});
  // nye saker «popper» opp under avspilling av tidslinjen
  map.addSource('pop',{type:'geojson',data:EMPTY});
  map.addLayer({id:'pop',type:'circle',source:'pop',paint:{'circle-radius':['get','r'],'circle-color':['get','col'],'circle-opacity':['*',.25,['get','o']],'circle-stroke-width':2,'circle-stroke-color':['get','col'],'circle-stroke-opacity':['get','o']}});
  map.addLayer({id:'pt-sel',type:'circle',source:'news',filter:['==',['get','id'],''],paint:{'circle-radius':21,'circle-color':'rgba(0,0,0,0)','circle-stroke-width':2.5,'circle-stroke-color':'#fff'}});
  // samspill
  const pop=new maplibregl.Popup({closeButton:false,closeOnClick:false,offset:16,maxWidth:'300px'});
  map.on('mousemove','pts',e=>{map.getCanvas().style.cursor='pointer';const f=e.features[0];const ev=EVENTS.find(x=>x.id===f.properties.id);if(!ev)return;
    pop.setLngLat(f.geometry.coordinates).setHTML(`<div class="pt"><b>${esc(ev.title)}</b><span>${esc(when(ev))}, ${ev.srcs.length>1?'kilder: '+esc(ev.srcs.slice(0,3).join(', '))+(ev.srcs.length>3?' og '+(ev.srcs.length-3)+' til':''):esc(ev.src)}</span></div>`).addTo(map)});
  map.on('mouseleave','pts',()=>{map.getCanvas().style.cursor='';pop.remove()});
  map.on('mouseenter','clusters',()=>map.getCanvas().style.cursor='pointer');map.on('mouseleave','clusters',()=>map.getCanvas().style.cursor='');
  map.on('click','clusters',async e=>{const f=e.features[0];const z=await map.getSource('news').getClusterExpansionZoom(f.properties.cluster_id);map.easeTo({center:f.geometry.coordinates,zoom:z+.3,duration:reduced?0:700})});
  map.on('click',e=>{if(areaPick){areaSet(e.lngLat);return}const hit=map.queryRenderedFeatures(e.point,{layers:['pts','clusters']});if(hit.length){if(hit[0].layer.id==='pts')select(hit[0].properties.id,false);return}
    const al=S.layers.alerts&&map.queryRenderedFeatures(e.point,{layers:['alerts']})[0];if(al){showAlert(al.properties);return}
    const a2=countryAt(e.lngLat.lng,e.lngLat.lat);setCountry(a2&&a2!==S.cc?a2:null)});
  let hov=null;map.on('mousemove',e=>{if(!COUNTRIES)return;const a2=countryAt(e.lngLat.lng,e.lngLat.lat);if(a2===hov)return;
    if(hov)map.setFeatureState({source:'countries',id:hov},{hover:false});hov=a2;if(a2)map.setFeatureState({source:'countries',id:a2},{hover:true})});
  ready=true;applyLayers();applyBase();applyUI();refresh();animate();extraEvents();setMarketLayer();loadFlights();setShipLayer();loadWxMap();loadRadar();loadStorms();loadLights();loadTraffic();loadPower();areaDraw();
}
let DETAIL=[];
function applyBase(){if(!map||!map.getLayer('sat'))return;const sat=S.base==='sat';
  map.setLayoutProperty('sat','visibility',sat?'visible':'none');
  // satellitt: veier og navn vises oppå bildene fra zoom 12, så det aldri blir tomt der Esri mangler bilder
  for(const d of DETAIL)if(map.getLayer(d.id)){map.setLayoutProperty(d.id,'visibility',sat&&!d.hybrid?'none':'visible');map.setLayerZoomRange(d.id,sat&&d.hybrid?Math.max(d.min,12):d.min,d.max)}
  if(map.getLayer('relief'))map.setLayoutProperty('relief','visibility',sat?'none':'visible');
  const h=['>',['coalesce',['feature-state','h'],0],0],o=sat?[.42,.18,.05]:[.6,.26,.08];
  map.setPaintProperty('heat','fill-opacity',['interpolate',['linear'],['zoom'],1,['case',h,o[0],0],4,['case',h,o[1],0],7,['case',h,o[2],0]]);
  for(const x of $('basemap').children)x.setAttribute('aria-pressed',x.dataset.b===S.base)}
$('basemap').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;S.base=b.dataset.b;store.set('nk-base',S.base);applyBase()});
for(const x of $('basemap').children)x.setAttribute('aria-pressed',x.dataset.b===S.base);
const LAYER_IDS={heat:['heat'],arcs:['arcs','arcs-base'],alerts:['alerts','alerts-line'],night:['night']};
function applyLayers(){for(const i of $('layers').querySelectorAll('input[data-l]'))i.checked=!!S.layers[i.dataset.l];if(!ready)return;
  for(const[k,ids]of Object.entries(LAYER_IDS))for(const id of ids)if(map.getLayer(id))map.setLayoutProperty(id,'visibility',S.layers[k]?'visible':'none')}
$('layers').addEventListener('change',e=>{const i=e.target;if(i.dataset.f){setFeature(i.dataset.f,i.checked);return}if(!i.dataset.l)return;S.layers[i.dataset.l]=i.checked;store.set('nk-layers',S.layers);applyLayers();if(i.dataset.l==='night'){loadLights();nightImgUpdate()}});

const DASH=[[0,4,3],[.5,4,2.5],[1,4,2],[1.5,4,1.5],[2,4,1],[2.5,4,.5],[3,4,0],[0,.5,3,3.5],[0,1,3,3],[0,1.5,3,2.5],[0,2,3,2],[0,2.5,3,1.5],[0,3,3,1],[0,3.5,3,.5]];
let t0=performance.now(),dashStep=-1;const flash=new Map();
function animate(){if(!ready)return;const t=(performance.now()-t0)/1000;
  if(!reduced&&UI.anim){const k=(t%2)/2;map.setPaintProperty('pulse','circle-radius',11+k*16);map.setPaintProperty('pulse','circle-stroke-opacity',.85*(1-k));
    const ds=Math.floor(t*12)%DASH.length;if(ds!==dashStep&&S.layers.arcs){dashStep=ds;map.setPaintProperty('arcs','line-dasharray',DASH[ds])}}
  const now=performance.now();for(const[a2,st]of flash){const k=1-(now-st)/9000;if(k<=0){flash.delete(a2);map.setFeatureState({source:'countries',id:a2},{f:0})}else map.setFeatureState({source:'countries',id:a2},{f:Math.abs(Math.sin(k*Math.PI*4))*k})}
  requestAnimationFrame(animate)}

let prevHeat=new Set(),prevSel=null;
function heatMap(){const h=new Map();for(const e of (S.tab==='top'?view():base())){if(!catOn(e.cat))continue;const cc=ccOf(e);if(!cc)continue;h.set(cc,(h.get(cc)||0)+1+e.score/5)}return h}
// ringer som vokser og blekner der en ny sak dukker opp
let POPS=[],popRaf=null;
function popAdd(evs){if(!ready||reduced||UI.anim===false)return;const t0=performance.now();for(const e of evs)if(e.lat!=null)POPS.push({t0,lon:e.lon,lat:e.lat,col:CATS[e.cat].c,big:e.score>=3.5});
  if(POPS.length>60)POPS=POPS.slice(-60);if(!popRaf)popRaf=requestAnimationFrame(popTick)}
function popTick(now){POPS=POPS.filter(p=>now-p.t0<1100);
  map.getSource('pop').setData({type:'FeatureCollection',features:POPS.map(p=>{const k=(now-p.t0)/1100;return{type:'Feature',geometry:{type:'Point',coordinates:[p.lon,p.lat]},properties:{r:6+k*(p.big?34:24),o:1-k,col:p.col}}})});
  popRaf=POPS.length?requestAnimationFrame(popTick):null}
function updateMap(){
  if(!ready)return;
  const ev=view(),feats=[];
  for(const e of ev){if(e.lat==null)continue;
    feats.push({type:'Feature',geometry:{type:'Point',coordinates:[e.lon,e.lat]},properties:{id:e.id,cat:e.cat,size:size(e),top:e.top?1:0,recent:fresh(e)?1:0,score:e.score,nsrc:e.srcs.length,col:CATS[e.cat].c,sort:e.score*1e13+ms(e.last)/1e3}})}
  map.getSource('news').setData({type:'FeatureCollection',features:feats});
  map.getSource('arcs').setData(S.layers.arcs?arcs(ev):EMPTY);
  if(map.getSource('quakes'))map.getSource('quakes').setData(F.quakes?{type:'FeatureCollection',features:base().filter(e=>e.mag>=4&&e.lat!=null).map(e=>({type:'Feature',geometry:{type:'Point',coordinates:[e.lon,e.lat]},properties:{mag:Math.round(e.mag*10)/10,id:e.id}}))}:EMPTY);
  map.setFilter('pt-sel',['==',['get','id'],S.sel||'']);
  const h=heatMap(),max=Math.max(4,...h.values());
  for(const a2 of prevHeat)if(!h.has(a2))map.setFeatureState({source:'countries',id:a2},{h:0});
  for(const[a2,v]of h)map.setFeatureState({source:'countries',id:a2},{h:Math.sqrt(v/max)});prevHeat=new Set(h.keys());
  if(prevSel)map.setFeatureState({source:'countries',id:prevSel},{sel:false});if(S.cc)map.setFeatureState({source:'countries',id:S.cc},{sel:true});prevSel=S.cc;
}
