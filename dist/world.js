import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { DRACOLoader } from './vendor/DRACOLoader.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { setupUI } from './world-ui.js';
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile=()=>innerWidth<700;
const scene=new THREE.Scene(),dayColor=new THREE.Color('#78cae6'),nightColor=new THREE.Color('#152d46');
scene.background=dayColor.clone();scene.fog=new THREE.Fog(dayColor,75,155);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,mobile()?1.5:1.75));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;
document.getElementById('world').appendChild(renderer.domElement);renderer.domElement.tabIndex=0;
renderer.domElement.setAttribute('aria-label','Cabbageland 三维花园。拖动旋转，滚轮或双指缩放。方向键旋转，加减键缩放，H 返回全景。');
const camera=new THREE.OrthographicCamera(-20,20,14,-14,.1,200),homePosition=new THREE.Vector3(13,21,31),homeTarget=new THREE.Vector3(0,4.4,-1.1);
camera.position.copy(homePosition);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.copy(homeTarget);
Object.assign(controls,{enableDamping:true,dampingFactor:.055,rotateSpeed:.45,minZoom:.64,maxZoom:3.3,minPolarAngle:.3,maxPolarAngle:1.41,enablePan:true,screenSpacePanning:false,panSpeed:.55,autoRotateSpeed:.35});
controls.mouseButtons={LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.PAN};controls.update();
const sun=new THREE.DirectionalLight('#fff2ce',3.2);sun.position.set(-14,30,18);sun.castShadow=true;sun.shadow.mapSize.set(mobile()?2048:3072,mobile()?2048:3072);
Object.assign(sun.shadow.camera,{left:-26,right:26,top:27,bottom:-25,near:1,far:90});sun.shadow.bias=-.00015;sun.shadow.normalBias=.035;scene.add(sun);
const ambient=new THREE.HemisphereLight('#c7eaff','#526436',1.65);scene.add(ambient);
const fill=new THREE.DirectionalLight('#bddfff',.7);fill.position.set(16,18,-14);scene.add(fill);
const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.06);scene.environment=env.texture;scene.environmentIntensity=.48;room.dispose();pmrem.dispose();
const places={
heart:{title:'卷心菜之心',icon:'✳',position:new THREE.Vector3(0,10.8,-5.5),target:new THREE.Vector3(0,5.2,-5.5)},
read:{title:'escape the void',icon:'▤',position:new THREE.Vector3(-9,4.4,.3),target:new THREE.Vector3(-9,1.85,-1)},
music:{title:'compose boredom',icon:'♫',position:new THREE.Vector3(-10,4.6,8.2),target:new THREE.Vector3(-10,1.8,7.2)},
nerd:{title:"nerd's farm",icon:'⌘',position:new THREE.Vector3(8,5.9,1),target:new THREE.Vector3(8,2.4,0)},
art:{title:'my world in XD',icon:'◈',position:new THREE.Vector3(10,4.5,8.1),target:new THREE.Vector3(10,1.9,7.1)}
};
let ui,model,night=false,nightMix=0,focusMotion=null,auto=false,count=0,loadingDone=false;
const plants=[],pickables=[],emissive=[],waterShaders=[],labels=[],clock=new THREE.Clock();
function defaultZoom(){return mobile()?1.23:1.03;}
function animateWater(material,isFall){const m=material.clone();m.onBeforeCompile=shader=>{
shader.uniforms.uGardenTime={value:0};waterShaders.push(shader);
shader.vertexShader='varying vec3 vGardenWorld;\n'+shader.vertexShader;
shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvGardenWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
shader.fragmentShader='uniform float uGardenTime;varying vec3 vGardenWorld;\n'+shader.fragmentShader;
const code=isFall?'float stream=sin((vGardenWorld.x+vGardenWorld.z)*39.0+sin(vGardenWorld.y*3.0+uGardenTime*2.0));float run=sin(vGardenWorld.y*25.0+uGardenTime*9.0);diffuseColor.rgb*=.87+.13*stream+.05*run;diffuseColor.rgb+=vec3(.08,.12,.15)*smoothstep(.8,.98,stream)*(.7+.3*run);':'float wave=sin(vGardenWorld.x*5.0+vGardenWorld.z*2.0-uGardenTime*1.6)+sin(vGardenWorld.z*7.0-vGardenWorld.x*2.0-uGardenTime);diffuseColor.rgb*=.89+.09*wave;diffuseColor.rgb+=vec3(.18,.23,.23)*smoothstep(1.72,1.99,wave);';
shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+code);
};m.customProgramCacheKey=()=>isFall?'cabbage-fall-v2':'cabbage-river-v2';return m;}
function visit(key){if(places[key]){focus(key);ui.open(key);}}
function focus(key){const p=places[key];controls.autoRotate=false;auto=false;document.getElementById('rotate').setAttribute('aria-pressed','false');focusMotion={start:controls.target.clone(),end:p.target.clone(),zoom:camera.zoom,endZoom:mobile()?1.9:1.7,time:performance.now()};document.querySelectorAll('[data-place]').forEach(b=>b.classList.toggle('active',b.dataset.place===key));}
function home(){focusMotion={start:controls.target.clone(),end:homeTarget.clone(),zoom:camera.zoom,endZoom:defaultZoom(),time:performance.now(),home:true,cam:camera.position.clone()};document.querySelectorAll('[data-place]').forEach(b=>b.classList.toggle('active',b.dataset.place==='heart'));}
function toggleNight(){night=!night;document.body.classList.toggle('night',night);document.getElementById('daynight').setAttribute('aria-pressed',String(night));document.getElementById('sun-icon').textContent=night?'☾':'☀';document.getElementById('time-label').textContent=night?'夜晚':'白昼';ui.toast(night?'夜色落在了花园里。':'阳光回来了。');}
function grow(p){if(p.userData.growth>=3){ui.toast('这颗已经长好了。试试旁边那颗。');return;}p.userData.growth++;p.userData.goal=1+p.userData.growth*.18;if(p.userData.growth===1){count++;document.getElementById('harvest-count').textContent=count;}ui.toast(['浇水成功，叶子舒展开了。','又长大了一点。','今天的脑洞收成不错。'][p.userData.growth-1]);ui.note(261.63+p.userData.growth*65.4,.65,.09);}
function growRandom(){const p=plants.find(p=>p.userData.growth<3);if(p)grow(p);else ui.toast(loadingDone?'整片菜地都长好了。':'花园还在载入，稍等一下。');}
ui=setupUI({visit,home,toggleNight,growRandom,places});
for(const [key,p] of Object.entries(places)){
 const b=document.createElement('button');b.className='place-label';b.innerHTML='<span>'+p.icon+'</span><em>'+p.title+'</em>';b.setAttribute('aria-label','探索 '+p.title);b.addEventListener('click',()=>visit(key));document.getElementById('labels').appendChild(b);labels.push({el:b,key,p:p.position});
 if(key!=='heart'){const hit=new THREE.Mesh(new THREE.BoxGeometry(5,4.1,4.1),new THREE.MeshBasicMaterial({visible:false}));hit.position.copy(p.target);hit.userData.place=key;scene.add(hit);pickables.push(hit);}
}
function loadingError(){const l=document.getElementById('loading');if(l){l.innerHTML='<b>花园暂时没有载入成功</b><span>请检查网络连接，再试一次。</span><button id="retry">重新载入</button>';document.getElementById('retry').onclick=()=>location.reload();}}
const draco=new DRACOLoader();draco.setDecoderPath('./vendor/draco/');draco.setWorkerLimit(mobile()?2:4);
new GLTFLoader().setDRACOLoader(draco).load('./models/cabbageland.glb',gltf=>{
 model=gltf.scene;scene.add(model);const adjusted=new Map();
 model.traverse(o=>{
  if(o.isMesh){o.castShadow=true;o.receiveShadow=true;const mats=Array.isArray(o.material)?o.material:[o.material];const mapped=mats.map(m=>{
   if(adjusted.has(m.uuid))return adjusted.get(m.uuid);let newM=m;
   if(m.name==='Waterfall'||m.name==='River water')newM=animateWater(m,m.name==='Waterfall');
   if(m.name==='Glass'){newM=m.clone();newM.transparent=true;newM.opacity=.19;newM.depthWrite=false;newM.roughness=.2;newM.metalness=.05;}
   if(m.name==='Lamplight'){newM=m.clone();newM.emissiveIntensity=.35;emissive.push(newM);}adjusted.set(m.uuid,newM);return newM;
  });o.material=Array.isArray(o.material)?mapped:mapped[0];if(mapped.some(m=>m.transparent||['Cloud','River water','Waterfall','Water foam'].includes(m.name)))o.castShadow=false;}
  if(o.userData.place==='plant'){o.userData.growth=0;o.userData.goal=1;o.userData.baseScale=o.scale.clone();plants.push(o);pickables.push(o);}
 });
 loadingDone=true;const l=document.getElementById('loading');l.classList.add('loaded');setTimeout(()=>l.remove(),700);
},e=>{if(e.total){const l=document.querySelector('#loading>span:last-child');if(l)l.textContent='正在载入花园模型 · '+Math.round(e.loaded/e.total*100)+'%';}},loadingError);
const stars=[];for(let i=0;i<150;i++)stars.push((Math.random()-.5)*85,15+Math.random()*38,(Math.random()-.5)*65);
const starG=new THREE.BufferGeometry();starG.setAttribute('position',new THREE.Float32BufferAttribute(stars,3));const starM=new THREE.PointsMaterial({color:'#f4ebc9',size:.10,transparent:true,opacity:0,depthWrite:false});scene.add(new THREE.Points(starG,starM));
const flies=[];for(let i=0;i<30;i++)flies.push((Math.random()-.5)*28,.5+Math.random()*5,(Math.random()-.5)*23);
const fireG=new THREE.BufferGeometry();fireG.setAttribute('position',new THREE.Float32BufferAttribute(flies,3));const fireM=new THREE.PointsMaterial({color:'#e5f98b',size:.065,transparent:true,opacity:0,depthWrite:false});scene.add(new THREE.Points(fireG,fireM));
document.getElementById('daynight').addEventListener('click',toggleNight);document.getElementById('reset-view').addEventListener('click',home);
function zoom(f){focusMotion=null;camera.zoom=THREE.MathUtils.clamp(camera.zoom*f,controls.minZoom,controls.maxZoom);camera.updateProjectionMatrix();}
document.getElementById('zoom-in').addEventListener('click',()=>zoom(1.17));document.getElementById('zoom-out').addEventListener('click',()=>zoom(1/1.17));
document.getElementById('rotate').addEventListener('click',()=>{auto=!auto;controls.autoRotate=auto;document.getElementById('rotate').setAttribute('aria-pressed',String(auto));});
controls.addEventListener('start',()=>focusMotion=null);
renderer.domElement.addEventListener('keydown',e=>{
if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','h','H'].includes(e.key))return;e.preventDefault();
if(e.key==='+'||e.key==='=')zoom(1.15);else if(e.key==='-')zoom(1/1.15);else if(e.key.toLowerCase()==='h')home();else{focusMotion=null;const s=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));s.theta+=e.key==='ArrowLeft'?.1:e.key==='ArrowRight'?-.1:0;s.phi=THREE.MathUtils.clamp(s.phi+(e.key==='ArrowUp'?-.09:e.key==='ArrowDown'?.09:0),controls.minPolarAngle,controls.maxPolarAngle);camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));controls.update();}});
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let down=null,lastHover=0;
function hitAt(e){const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects(pickables,true)[0];}
renderer.domElement.addEventListener('pointerdown',e=>down={x:e.clientX,y:e.clientY,id:e.pointerId,t:performance.now()});renderer.domElement.addEventListener('pointercancel',()=>down=null);
renderer.domElement.addEventListener('pointerup',e=>{if(!down||e.pointerId!==down.id||Math.hypot(e.clientX-down.x,e.clientY-down.y)>7||performance.now()-down.t>650){down=null;return;}down=null;const hit=hitAt(e);if(!hit)return;let o=hit.object;while(o&&!o.userData.place)o=o.parent;if(o?.userData.place==='plant')grow(o);else if(o?.userData.place)visit(o.userData.place);});
renderer.domElement.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse'||performance.now()-lastHover<90||!loadingDone)return;lastHover=performance.now();renderer.domElement.style.cursor=hitAt(e)?'pointer':'grab';});
function resize(){const a=innerWidth/innerHeight,w=Math.max(38,27*a),h=w/a;camera.left=-w/2;camera.right=w/2;camera.top=h/2;camera.bottom=-h/2;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);}
addEventListener('resize',resize);camera.zoom=defaultZoom();resize();
const projected=new THREE.Vector3();let t=0;
function frame(now){requestAnimationFrame(frame);const dt=Math.min(clock.getDelta(),.05);if(document.hidden)return;t+=dt;
nightMix=THREE.MathUtils.damp(nightMix,night?1:0,2,dt);scene.background.copy(dayColor).lerp(nightColor,nightMix);scene.fog.color.copy(scene.background);sun.intensity=THREE.MathUtils.lerp(3.2,.3,nightMix);ambient.intensity=THREE.MathUtils.lerp(1.65,.65,nightMix);fill.intensity=THREE.MathUtils.lerp(.7,.85,nightMix);scene.environmentIntensity=THREE.MathUtils.lerp(.48,.22,nightMix);
for(const m of emissive)m.emissiveIntensity=.35+nightMix*3;starM.opacity=nightMix*.95;fireM.opacity=nightMix*.75;
if(!reduced){for(const s of waterShaders)s.uniforms.uGardenTime.value=t;const p=fireG.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,flies[i*3+1]+Math.sin(t*.4+i)*.18);p.needsUpdate=true;}
if(focusMotion){const a=Math.min((now-focusMotion.time)/(reduced?1:1000),1),e=a*a*(3-2*a),old=controls.target.clone();controls.target.lerpVectors(focusMotion.start,focusMotion.end,e);camera.position.add(controls.target.clone().sub(old));camera.zoom=THREE.MathUtils.lerp(focusMotion.zoom,focusMotion.endZoom,e);if(focusMotion.home)camera.position.lerpVectors(focusMotion.cam,homePosition,e);camera.updateProjectionMatrix();if(a===1)focusMotion=null;}
for(const p of plants){const goal=p.userData.baseScale.clone().multiplyScalar(p.userData.goal);p.scale.lerp(goal,1-Math.exp(-dt*4));}
controls.update();renderer.render(scene,camera);
for(const l of labels){projected.copy(l.p).project(camera);const x=(projected.x*.5+.5)*innerWidth,y=(-projected.y*.5+.5)*innerHeight,off=!loadingDone||projected.z>1||x<25||x>innerWidth-25||y<90||y>innerHeight-130;l.el.style.transform=`translate(-50%,-50%) translate(${x}px,${y}px)`;l.el.style.opacity=off?'0':'1';l.el.style.pointerEvents=off?'none':'auto';l.el.tabIndex=off?-1:0;}
}
requestAnimationFrame(frame);
