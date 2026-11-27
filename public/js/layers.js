// Nyhetskloden: layers.js (lastes i rekkefølge fra index.html, deler globale navn med de andre filene)
// ---------- fly og skip ----------
function vehicleIcon(kind){const s=40,c=document.createElement('canvas');c.width=c.height=s;const x=c.getContext('2d');x.translate(s/2,s/2);
  x.shadowColor='rgba(0,0,0,.6)';x.shadowBlur=3;x.lineJoin='round';
  if(kind==='plane'){x.fillStyle='#ffd166';x.strokeStyle='#3a2a00';x.lineWidth=1.2;
    x.fill(new Path2D('M0-15c1.6 0 2.2 1.6 2.2 3.4V-4l11 6v3l-11-3v6.5l3.5 2.8V14L0 12.5-5.7 14v-2.7l3.5-2.8V2l-11 3V2l11-6v-7.6C-2.2-13.4-1.6-15 0-15Z'));
    x.shadowColor='transparent';x.stroke(new Path2D('M0-15c1.6 0 2.2 1.6 2.2 3.4V-4l11 6v3l-11-3v6.5l3.5 2.8V14L0 12.5-5.7 14v-2.7l3.5-2.8V2l-11 3V2l11-6v-7.6C-2.2-13.4-1.6-15 0-15Z'))}
  else{x.fillStyle='#5eead4';x.strokeStyle='#04312b';x.lineWidth=1.4;const p=new Path2D('M0-12 6 6 0 3-6 6Z');x.fill(p);x.shadowColor='transparent';x.stroke(p)}
  return{width:s,height:s,data:x.getImageData(0,0,s,s).data}}
function addExtraLayers(){
  map.on('moveend',()=>nightImgUpdate());
  // ekte nattbilder fra NASA (VIIRS Black Marble) når du zoomer inn der det er natt
  map.addSource('bm',{type:'raster',tiles:['https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png'],tileSize:256,maxzoom:8,
    attribution:'Nattbilder: <a href="https://earthobservatory.nasa.gov/features/NightLights" target="_blank" rel="noopener">NASA Black Marble</a>'});
  map.addLayer({id:'bm',type:'raster',source:'bm',minzoom:3.2,layout:{visibility:'none'},paint:{'raster-opacity':['interpolate',['linear'],['zoom'],3.2,0,4.6,.9],'raster-fade-duration':300}});
  // bylys om natta (ligger under alt annet)
  map.addSource('lights',{type:'geojson',data:EMPTY});
  // varmemodell: byer som ligger tett smelter sammen til et mykt lys, slik det ser ut fra verdensrommet
  map.addLayer({id:'lights',type:'heatmap',source:'lights',paint:{
    'heatmap-weight':['*',['get','k'],['get','w']],
    'heatmap-intensity':['interpolate',['linear'],['zoom'],1,.9,5,1,8,1.2],
    'heatmap-radius':['interpolate',['linear'],['zoom'],1,5,3,8,5,11,8,18],
    'heatmap-opacity':['interpolate',['linear'],['zoom'],1,.85,7,.7,10,.4],
    'heatmap-color':['interpolate',['linear'],['heatmap-density'],0,'rgba(0,0,0,0)',.08,'rgba(120,70,10,0)',.22,'rgba(190,120,40,.35)',.45,'rgba(240,175,80,.6)',.7,'rgba(255,214,130,.82)',1,'rgba(255,244,214,.95)']}});
  // strømpris i de fem prisområdene
  map.addSource('power',{type:'geojson',data:EMPTY});
  map.addLayer({id:'power',type:'symbol',source:'power',minzoom:3.4,maxzoom:6.4,layout:{'text-field':['get','label'],'text-font':FONT_B,'text-size':11.5,'text-justify':'center','text-allow-overlap':false,'text-padding':6},
    paint:{'text-color':['get','col'],'text-halo-color':'rgba(5,10,18,.95)','text-halo-width':1.8}});
  // veitrafikk
  map.addSource('traffic',{type:'geojson',data:EMPTY});
  map.addLayer({id:'traffic',type:'circle',source:'traffic',minzoom:4.5,paint:{'circle-radius':['interpolate',['linear'],['zoom'],5,3,10,6],'circle-color':['get','col'],'circle-stroke-width':1.2,'circle-stroke-color':'#08111b'}});
  // jordskjelv: ringer som blir større med styrken (magnitude)
  map.addSource('quakes',{type:'geojson',data:EMPTY});
  const qr=k=>['interpolate',['linear'],['zoom'],1,['*',k,['^',1.6,['-',['get','mag'],3]]],6,['*',k*2.2,['^',1.6,['-',['get','mag'],3]]]];
  for(const[k,o]of[[3.4,.25],[2.2,.45],[1.1,.8]])map.addLayer({id:'qk'+k,type:'circle',source:'quakes',paint:{'circle-radius':qr(k),'circle-color':'rgba(0,0,0,0)','circle-stroke-width':1.4,'circle-stroke-opacity':o,
    'circle-stroke-color':['step',['get','mag'],'#facc15',5,'#fb923c',6,'#ef4444',7,'#f0abfc']}});
  map.addLayer({id:'qk-txt',type:'symbol',source:'quakes',minzoom:2.5,layout:{'text-field':['concat','M',['to-string',['get','mag']]],'text-font':FONT_B,'text-size':11,'text-offset':[0,1.6],'text-anchor':'top','text-allow-overlap':false},
    paint:{'text-color':['step',['get','mag'],'#facc15',5,'#fb923c',6,'#ff7a7a'],'text-halo-color':'rgba(5,10,18,.95)','text-halo-width':1.5}});
  // tropiske stormer fra GDACS: varslingsområde, bane og navn
  map.addSource('storms',{type:'geojson',data:EMPTY});
  map.addLayer({id:'st-cone',type:'fill',source:'storms',filter:['==',['get','role'],'cone'],paint:{'fill-color':'#f0abfc','fill-opacity':.12}});
  map.addLayer({id:'st-track',type:'line',source:'storms',filter:['==',['get','role'],'track'],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':['match',['get','level'],'red','#ef4444','orange','#fb923c','#f0abfc'],'line-width':2.2,'line-dasharray':[2,1.5]}});
  map.addLayer({id:'st-now',type:'symbol',source:'storms',filter:['==',['get','role'],'now'],layout:{'text-field':['concat','🌀 ',['get','name']],'text-font':FONT_B,'text-size':12.5,'text-allow-overlap':true},
    paint:{'text-color':['match',['get','level'],'red','#ff7a7a','orange','#ffb38a','#f5d0fe'],'text-halo-color':'rgba(5,10,18,.95)','text-halo-width':1.8}});
  map.addSource('radar',{type:'raster',tiles:[],tileSize:256,maxzoom:7,attribution:'Radar: <a href="https://www.rainviewer.com" target="_blank" rel="noopener">RainViewer</a>'});
  map.addLayer({id:'radar',type:'raster',source:'radar',layout:{visibility:'none'},paint:{'raster-opacity':.7,'raster-fade-duration':0}});
  map.addSource('wxmap',{type:'geojson',data:EMPTY});
  map.addLayer({id:'wxmap',type:'symbol',source:'wxmap',minzoom:4.3,layout:{'icon-image':['concat','wx-',['get','icon']],'icon-size':.5,'icon-allow-overlap':false,'icon-padding':6,'text-padding':4,
    'text-field':['get','t'],'text-font':FONT_B,'text-size':12,'text-anchor':'left','text-offset':[1.05,0],'text-optional':true,'symbol-sort-key':['get','rank']},
    paint:{'text-color':['case',['>',['get','temp'],0],'#ff8a7a','#7cc0ff'],'text-halo-color':'rgba(5,10,18,.95)','text-halo-width':1.6}});
  map.moveLayer('power'); // strømprisen vinner over værsymbolene når de kolliderer
  map.addSource('mkts',{type:'geojson',data:EMPTY});
  map.addLayer({id:'mk-glow',type:'circle',source:'mkts',maxzoom:5,paint:{'circle-radius':16,'circle-color':['get','col'],'circle-opacity':.22,'circle-blur':.8}});
  map.addLayer({id:'mk-dot',type:'circle',source:'mkts',maxzoom:5,paint:{'circle-radius':5,'circle-color':['get','col'],'circle-stroke-width':1.5,'circle-stroke-color':'#08111b'}});
  map.addLayer({id:'mk-txt',type:'symbol',source:'mkts',maxzoom:4.2,layout:{'text-field':['get','label'],'text-font':FONT_B,'text-size':11,'text-anchor':'top','text-offset':[0,.9],'text-justify':'center','text-max-width':30,'text-allow-overlap':false},
    paint:{'text-color':['get','col'],'text-halo-color':'rgba(5,10,18,.95)','text-halo-width':1.6}});
  map.addImage('plane',vehicleIcon('plane'),{pixelRatio:2});map.addImage('ship',vehicleIcon('ship'),{pixelRatio:2});
  map.addSource('ships',{type:'geojson',data:EMPTY});
  map.addLayer({id:'ships',type:'symbol',source:'ships',layout:{'icon-image':'ship','icon-rotate':['get','r'],'icon-rotation-alignment':'map','icon-allow-overlap':true,'icon-ignore-placement':true,
    'icon-size':['interpolate',['linear'],['zoom'],3,.55,8,.9,12,1.2]},paint:{'icon-opacity':['interpolate',['linear'],['zoom'],3,.7,7,1]}});
  map.addSource('planes',{type:'geojson',data:EMPTY});
  map.addLayer({id:'planes',type:'symbol',source:'planes',layout:{'icon-image':'plane','icon-rotate':['get','r'],'icon-rotation-alignment':'map','icon-allow-overlap':true,'icon-ignore-placement':true,
    'icon-size':['interpolate',['linear'],['zoom'],4,.6,8,.9,12,1.2]}});}
// værsymboler som bilder på kartet
const wxImg=new Set();
function wxIcon(sym){const k=(sym||'x').replace(/[^a-z_]/g,'');if(wxImg.has(k)||!ready)return k;wxImg.add(k);
  const im=new Image(48,48);im.onload=()=>{if(!map.hasImage('wx-'+k))map.addImage('wx-'+k,im,{pixelRatio:1})};
  im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(wxSvg(sym,48).replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" '));return k}
async function loadWxMap(){clearTimeout(loadWxMap.t);if(!ready||!map.getSource('wxmap'))return;
  if(!F.wxmap){map.getSource('wxmap').setData(EMPTY);return}
  try{const d=await (await fetch('/api/wxmap')).json();
    map.getSource('wxmap').setData({type:'FeatureCollection',features:(d.cities||[]).map((c,i)=>({type:'Feature',geometry:{type:'Point',coordinates:[c.lon,c.lat]},
      properties:{icon:wxIcon(c.sym),t:deg(c.temp),temp:Math.round(c.temp),name:c.name,rank:i}}))})}catch(e){}
  loadWxMap.t=setTimeout(loadWxMap,30*60e3)}
async function loadStorms(){clearTimeout(loadStorms.t);if(!ready||!map.getSource('storms'))return;
  if(!F.storms){map.getSource('storms').setData(EMPTY);return}
  try{const d=await (await fetch('/api/storms')).json();map.getSource('storms').setData(d.features?d:EMPTY)}catch(e){}
  loadStorms.t=setTimeout(loadStorms,30*60e3)}
async function loadRadar(){clearTimeout(loadRadar.t);if(!ready||!map.getSource('radar'))return;
  if(!F.radar){map.setLayoutProperty('radar','visibility','none');trafMsg.r='';showTraf();return}
  try{const d=await (await fetch('/api/radar')).json();if(d.error)throw new Error(d.error);
    map.getSource('radar').setTiles([d.host+d.path+'/256/{z}/{x}/{y}/2/1_1.png']);map.setLayoutProperty('radar','visibility','visible');
    trafMsg.r='Radar kl. '+tfmt.format(new Date(d.time))}
  catch(e){trafMsg.r='Radar: fikk ikke kontakt'}
  showTraf();loadRadar.t=setTimeout(loadRadar,10*60e3)}
function extraEvents(){const pop=new maplibregl.Popup({closeButton:false,closeOnClick:false,offset:12});
  map.on('click','st-now',e=>{const p=e.features[0].properties;if(p.url)window.open(p.url,'_blank','noopener')});
  map.on('mousemove','st-now',e=>{const p=e.features[0].properties;map.getCanvas().style.cursor='pointer';pop.setLngLat(e.features[0].geometry.coordinates).setHTML(`<div class="pt"><b>Syklon ${esc(p.name)}</b><span>${{red:'Rødt',orange:'Oransje'}[p.level]||'Grønt'} varsel fra GDACS. Klikk for detaljer.</span></div>`).addTo(map)});
  map.on('mouseleave','st-now',()=>{map.getCanvas().style.cursor='';pop.remove()});
  map.on('mousemove','wxmap',e=>{const p=e.features[0].properties;map.getCanvas().style.cursor='pointer';pop.setLngLat(e.features[0].geometry.coordinates).setHTML(`<div class="pt"><b>${esc(p.name)}</b><span>${esc(p.t)}, fra Yr</span></div>`).addTo(map)});
  map.on('mouseleave','wxmap',()=>{map.getCanvas().style.cursor='';pop.remove()});
  map.on('click','wxmap',e=>{const p=e.features[0].properties;if(HOME&&p.name===HOME.name){$('wxPop').hidden=false;renderWx()}});
  map.on('mousemove','traffic',e=>{const p=e.features[0].properties;map.getCanvas().style.cursor='pointer';pop.setLngLat(e.features[0].geometry.coordinates).setHTML(`<div class="pt"><b>${esc(p.kind[0].toUpperCase()+p.kind.slice(1))}</b><span>${esc(p.text||'Ingen beskrivelse')}</span></div>`).addTo(map)});
  map.on('mouseleave','traffic',()=>{map.getCanvas().style.cursor='';pop.remove()});
  for(const id of ['planes','ships']){map.on('mousemove',id,e=>{map.getCanvas().style.cursor='pointer';const p=e.features[0].properties;pop.setLngLat(e.features[0].geometry.coordinates).setHTML(`<div class="pt"><b>${esc(p.t)}</b><span>${esc(p.d)}</span></div>`).addTo(map)});
    map.on('mouseleave',id,()=>{map.getCanvas().style.cursor='';pop.remove()})}
  map.on('moveend',()=>{clearTimeout(loadFlights.d);loadFlights.d=setTimeout(loadFlights,600)})}
const trafNote=t=>{$('trafNote').textContent=t||'';$('trafNote').hidden=!t};
let trafMsg={};const showTraf=()=>trafNote([trafMsg.f,trafMsg.s,trafMsg.r].filter(Boolean).join('. '));
async function loadFlights(){clearTimeout(loadFlights.t);if(!ready)return;const src=map.getSource('planes');
  if(!F.flights){src.setData(EMPTY);trafMsg.f='';showTraf();return}
  if(map.getZoom()<3.8){src.setData(EMPTY);trafMsg.f='Zoom inn for å se fly';showTraf();loadFlights.t=setTimeout(loadFlights,30e3);return}
  const c=map.getCenter();
  try{const d=await (await fetch(`/api/flights?lat=${c.lat.toFixed(2)}&lon=${c.lng.toFixed(2)}`)).json();if(d.error)throw new Error(d.error);
    src.setData({type:'FeatureCollection',features:(d.ac||[]).map(a=>({type:'Feature',geometry:{type:'Point',coordinates:[a.lon,a.lat]},
      properties:{r:a.track||0,t:a.cs||a.reg||'Ukjent fly',d:[a.type,a.alt!=null?Math.round(a.alt*0.3048).toLocaleString('nb-NO')+' moh.':'',a.reg&&a.cs?a.reg:''].filter(Boolean).join(', ')}}))});
    trafMsg.f=(d.ac||[]).length+' fly i området'}
  catch(e){trafMsg.f='Fly: fikk ikke kontakt'}
  showTraf();loadFlights.t=setTimeout(loadFlights,30e3)}
const SHIPT=t=>t>=60&&t<70?'Passasjerskip':t>=70&&t<80?'Lasteskip':t>=80&&t<90?'Tankskip':t===30?'Fiskefartøy':t===52||t===31||t===32?'Slepebåt':t===36?'Seilbåt':t===37?'Fritidsbåt':'Fartøy';
async function setShipLayer(){clearTimeout(setShipLayer.t);if(!ready)return;const src=map.getSource('ships');
  if(!F.ships){src.setData(EMPTY);trafMsg.s='';showTraf();return}
  try{const d=await (await fetch('/api/ships')).json();if(d.error)throw new Error(d.error);
    src.setData({type:'FeatureCollection',features:(d.ships||[]).map(v=>({type:'Feature',geometry:{type:'Point',coordinates:[v.lon,v.lat]},
      properties:{r:v.cog||0,t:v.name||'MMSI '+v.mmsi,d:[SHIPT(v.type),v.sog!=null?nf0.format(v.sog)+' knop':''].filter(Boolean).join(', ')}}))});
    trafMsg.s=(d.ships||[]).length+' skip'}
  catch(e){trafMsg.s=/mangler/.test(e.message)?'Skip: legg inn BarentsWatch-klient i Innstillinger':'Skip: '+e.message}
  showTraf();setShipLayer.t=setTimeout(setShipLayer,90e3)}
