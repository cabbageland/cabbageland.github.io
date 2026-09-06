import { ART_WIDTH, ART_HEIGHT, DAY_ART, NIGHT_ART, BUILDINGS } from './world-art.js';
import { constrainView, fitView, zoomView, resizeView } from './map-camera.js';
import { createStreamSound } from './stream-audio.js';
import { scheduleTone } from './soundtrack.js';
import { t, setText, setAttributeText, localize, initLanguage } from './i18n.js';
import { createRooms } from './pixel-rooms.js';
const stage=document.getElementById('map-stage'),viewport=document.getElementById('map-viewport'),mapImage=document.getElementById('map-image');
const artworkStyle=document.documentElement.style;
artworkStyle.setProperty('--art-width',ART_WIDTH+'px');
artworkStyle.setProperty('--art-height',ART_HEIGHT+'px');
artworkStyle.setProperty('--art-ratio',ART_WIDTH+'/'+ART_HEIGHT);
artworkStyle.setProperty('--day-art',`url("${DAY_ART}")`);
artworkStyle.setProperty('--night-art',`url("${NIGHT_ART}")`);
const locations={
read:{get name(){return t('location.read.name');},get sub(){return t('location.read.sub');},get tag(){return t('location.read.tag');},number:'01',...BUILDINGS.read},
music:{name:'compose boredom',get sub(){return t('location.music.sub');},get tag(){return t('location.music.tag');},number:'02',...BUILDINGS.music},
nerd:{name:'nerd’s farm',get sub(){return t('location.nerd.sub');},get tag(){return t('location.nerd.tag');},number:'03',...BUILDINGS.nerd},
art:{name:'my-world-in-XD',get sub(){return t('location.art.sub');},get tag(){return t('location.art.tag');},number:'04',...BUILDINGS.art},
pets:{get name(){return t('location.pets.name');},get sub(){return t('location.pets.sub');},get tag(){return t('location.pets.tag');},number:'05',landmark:true,...BUILDINGS.pets},
great:{get name(){return t('location.great.name');},get sub(){return t('location.great.sub');},get tag(){return t('location.great.tag');},number:'06',landmark:true,...BUILDINGS.great}
};
let s=1,x=0,y=0,night=false,dragged=false,lastPointer=null,mapMotion=null,toastTimer,enterTimer;
const pointers=new Map();let pinch=null;
const nightImage=document.getElementById('map-night-image');
const nightSource=NIGHT_ART;
let hintKey=null;
let nightArtwork=null;
function loadNightArtwork(){
 if(!nightArtwork){
  const images=[nightImage,...document.querySelectorAll('.building-night')];
  images.forEach(img=>{img.src=nightSource;});
  nightArtwork=Promise.all(images.map(img=>img.decode())).catch(error=>{
   nightArtwork=null;
   images.forEach(img=>img.removeAttribute('src'));
   throw error;
  });
 }
 return nightArtwork;
}
async function toggleNight(){
 const button=document.getElementById('daynight'),nextNight=!night;
 if(button.disabled)return;
 button.disabled=true;
 button.setAttribute('aria-busy','true');
 try{
  if(nextNight){
   setText(document.getElementById('day-text'),'world.nightLoading');
   await loadNightArtwork();
  }
  night=nextNight;
  document.body.classList.toggle('night',night);
  button.setAttribute('aria-pressed',String(night));
  setAttributeText(button,'aria-label',night?'world.toDay':'world.toNight');
  document.getElementById('day-symbol').textContent=night?'☾':'☀';
  setAttributeText(mapImage,'alt',night?'world.nightAlt':'world.dayAlt');
 }catch{
  toast('world.nightError');
 }finally{
  setText(document.getElementById('day-text'),night?'world.night':'world.day');
  button.disabled=false;
  button.removeAttribute('aria-busy');
 }
}
function canvasSize(){return {width:viewport.clientWidth,height:viewport.clientHeight};}
function draw(){
 const size=canvasSize();if(!size.width||!size.height)return;
 ({s,x,y}=constrainView({s,x,y},size));
 stage.style.transform=`translate(${x}px,${y}px) scale(${s})`;
 stage.style.setProperty('--label-scale',Math.min(1.65,Math.max(.65,.85/s)));
 stage.style.setProperty('--great-label-scale',Math.min(1.05,Math.max(.65,.8/s)));
}
function home(){
 mapMotion=null;
 const size=canvasSize();if(!size.width||!size.height)return;
 ({s,x,y}=fitView(size));draw();
}
function zoom(factor,clientX,clientY){
 mapMotion=null;
 const size=canvasSize(),rect=viewport.getBoundingClientRect();
 if(!size.width||!size.height)return;
 const point={x:clientX===undefined?size.width/2:clientX-rect.left,y:clientY===undefined?size.height/2:clientY-rect.top};
 ({s,x,y}=zoomView({s,x,y},size,factor,point));draw();
}
let previousSize={width:0,height:0};
const mapObserver=new ResizeObserver(()=>{
 const next=canvasSize();if(!next.width||!next.height)return;
 ({s,x,y}=resizeView({s,x,y},previousSize,next));previousSize=next;draw();
});
mapObserver.observe(viewport);
function toast(key,values={}){clearTimeout(toastTimer);const e=document.getElementById('toast');setText(e,key,values);e.classList.add('show');toastTimer=setTimeout(()=>e.classList.remove('show'),2600);}
function locationHint(key){
 hintKey=key;
 const p=locations[key],e=document.getElementById('location-hint'),name=e.querySelector('b');
 if(p){delete name.dataset.i18n;name.textContent=p.name;}
 else setText(name,'world.welcome');
 setText(e.querySelector('small'),p?'location.'+key+'.sub':'world.welcomeHint');
}
function refreshWorldLanguage(){
 for(const [key,p] of Object.entries(locations)){
  const b=document.querySelector('.building-hotspot[data-enter="'+key+'"]');
  if(!b)continue;
  setAttributeText(b,'aria-label','world.enter',{name:p.name,category:p.sub});
  b.querySelector('.hotspot-tag').textContent=p.sub+' ↗';
 }
 locationHint(hintKey);
}

const audio={ctx:null,ambientGain:null,on:false,
ensure(){if(!this.ctx||this.ctx.state==='closed'){const C=window.AudioContext||window.webkitAudioContext;if(!C){toast('world.soundUnsupported');return null;}this.ctx=new C();}if(this.ctx.state!=='running')this.ctx.resume().catch(()=>{});return this.ctx;},
note(f,duration=.45,volume=.07){const ctx=this.ensure();if(!ctx)return;if(ctx.state==='running')scheduleTone(ctx,f,duration,volume);else ctx.resume().then(()=>{if(ctx.state==='running')scheduleTone(ctx,f,duration,volume);}).catch(()=>toast('world.soundUnsupported'));},
toggle(){
 const ctx=this.ensure();if(!ctx)return;
 if(!this.ambientGain)this.ambientGain=createStreamSound(ctx).gain;
 this.on=!this.on;
 this.ambientGain.gain.setTargetAtTime(this.on?.38:0,ctx.currentTime,.65);
 document.getElementById('ambient').setAttribute('aria-pressed',String(this.on));
 setAttributeText(document.getElementById('ambient'),'aria-label',this.on?'world.soundOff':'world.soundOn');
 toast(this.on?'world.soundPlaying':'world.soundStopped');
}
};
const rooms=createRooms({locations,audio,toast,onClose:()=>{document.querySelectorAll('[data-enter]').forEach(b=>b.classList.remove('active'));}});
function enter(key){if(dragged)return;clearTimeout(enterTimer);locationHint(key);document.querySelectorAll('[data-enter]').forEach(b=>b.classList.toggle('active',b.dataset.enter===key));rooms.open(key);}
for(const [key,p] of Object.entries(locations)){
const [left,top,w,h]=p.rect,b=document.createElement('button');b.className='building-hotspot';b.dataset.enter=key;b.style.cssText=`left:${left}px;top:${top}px;width:${w}px;height:${h}px;--outline:${p.polygon}`;setAttributeText(b,'aria-label','world.enter',{name:p.name,category:p.sub});
b.innerHTML=`<span class="building-image"><img class="building-day" src="${DAY_ART}" draggable="false" alt="" style="left:${-left}px;top:${-top}px"><img class="building-night" draggable="false" alt="" style="left:${-left}px;top:${-top}px"></span><span class="hotspot-tag">${p.sub} ↗</span>`;
if(p.landmark){b.classList.add('landmark-hotspot');const label=document.createElement('span');label.className='landmark-label';const title=document.createElement('b');setText(title,'location.'+key+'.label');label.append(title);if(key==='great'){const sub=document.createElement('small');setText(sub,'location.great.sub');label.append(sub);}b.append(label);}
b.addEventListener('mouseenter',()=>locationHint(key));b.addEventListener('mouseleave',()=>locationHint(null));b.addEventListener('focus',()=>locationHint(key));b.addEventListener('blur',()=>locationHint(null));document.getElementById('map-hotspots').append(b);
}
document.querySelectorAll('[data-enter]').forEach(b=>b.addEventListener('click',()=>enter(b.dataset.enter)));
viewport.addEventListener('pointerdown',e=>{if(e.button!==0&&e.pointerType==='mouse')return;mapMotion=null;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1){dragged=false;lastPointer={x:e.clientX,y:e.clientY};}if(pointers.size===2){const a=[...pointers.values()];pinch={distance:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)};dragged=true;}});
viewport.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;const prev=pointers.get(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const a=[...pointers.values()],d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(pinch?.distance)zoom(d/pinch.distance,(a[0].x+a[1].x)/2,(a[0].y+a[1].y)/2);pinch={distance:d};return;}if(!lastPointer)return;if(!dragged&&Math.hypot(e.clientX-lastPointer.x,e.clientY-lastPointer.y)>5){dragged=true;viewport.setPointerCapture(e.pointerId);viewport.classList.add('dragging');}if(dragged){x+=e.clientX-prev.x;y+=e.clientY-prev.y;draw();}});
function endPointer(e){pointers.delete(e.pointerId);if(pointers.size<2)pinch=null;if(!pointers.size){viewport.classList.remove('dragging');lastPointer=null;setTimeout(()=>dragged=false,40);}else lastPointer=[...pointers.values()][0];}
viewport.addEventListener('pointerup',endPointer);viewport.addEventListener('pointercancel',endPointer);
viewport.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(-e.deltaY*.0014),e.clientX,e.clientY);},{passive:false});
viewport.addEventListener('dblclick',e=>{if(e.target.closest('.building-hotspot'))return;zoom(1.25,e.clientX,e.clientY);});
viewport.addEventListener('keydown',e=>{if(e.target!==viewport)return;const keys=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','h','H'];if(!keys.includes(e.key))return;e.preventDefault();if(e.key==='+'||e.key==='=')zoom(1.2);else if(e.key==='-')zoom(1/1.2);else if(e.key.toLowerCase()==='h')home(true);else{x+=e.key==='ArrowLeft'?55:e.key==='ArrowRight'?-55:0;y+=e.key==='ArrowUp'?55:e.key==='ArrowDown'?-55:0;draw();}});
document.getElementById('home').onclick=()=>{home();locationHint(null);};document.getElementById('fit-map').onclick=()=>home(true);document.getElementById('zoom-in').onclick=()=>zoom(1.2);document.getElementById('zoom-out').onclick=()=>zoom(1/1.2);
document.getElementById('ambient').onclick=()=>audio.toggle();document.getElementById('daynight').onclick=toggleNight;
const help=document.getElementById('help');document.getElementById('help-open').onclick=()=>help.showModal();document.querySelectorAll('.close-help').forEach(b=>b.onclick=()=>help.close());
function ready(){home();const l=document.getElementById('loading');l.classList.add('ready');setTimeout(()=>l.remove(),450);}
initLanguage();
refreshWorldLanguage();
document.addEventListener('languagechange',()=>{refreshWorldLanguage();rooms.refreshLanguage();});
if(mapImage.complete&&mapImage.naturalWidth)ready();else mapImage.addEventListener('load',ready,{once:true});mapImage.addEventListener('error',()=>{document.getElementById('loading').innerHTML='<h1 data-i18n="world.loadError">地图暂时无法打开</h1><p data-i18n="world.loadHint">请检查网络后刷新页面。</p><button class="pixel-button" onclick="location.reload()" data-i18n="common.retry">重试</button>';localize(document.getElementById('loading'));});
addEventListener('resize',()=>rooms.resize());document.addEventListener('visibilitychange',()=>{if(document.hidden){rooms.pause();audio.ctx?.suspend();}else if(audio.on)audio.ctx?.resume();});
