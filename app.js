// 3D Logo Studio — Full Edition
(function(){
'use strict';

// ── STATE ─────────────────────────────────────────────
const S = {
  preset: 'chrome',

  // Geometry
  depth: 0.22, bevel: 0.005, bevelSegs: 16, curveSegs: 48, scale: 0.90,

  // Trace
  traceThreshold: 10, traceSimplify: 0.10,

  // Material
  matColor:              '#eeeeee',
  matRoughness:          1.0,
  matMetalness:          1.0,
  matClearcoat:          1.0,
  matClearcoatRoughness: 1.0,
  matEnv:                5.0,
  matEmissive:           '#000000',
  matEmissiveInt:        0,

  // Gradient — ON by default
  matGradient:   true,
  matGradColorA: '#004bff',
  matGradColorB: '#ff0000',
  matGradDir:    'vertical',

  // Lighting
  keyIntensity:     10,   keyColor:  '#ec0088',
  ambientIntensity: 0,    rimIntensity: 0,
  envIntensity:     0.30, exposure:   0.80,

  // Presentation
  speed: 0, floatAmt: 0.2, tiltX: 10, spinAxis: 'y',

  // Background
  bgMode: 'studio', bgColor: '#0d0d0d',
  shadowOpacity: 0.15,

  // Export
  exportRes: 1, gifFrames: 60, gifFPS: 30,

  // Internal
  rotY: 0, rotX: 0, rotZ: 0, t: 0,
  isRecording: false, userImgEl: null,
};

const PRESETS = {
  clay:      { matColor:'#ffffff', matRoughness:0.35, matMetalness:0.0,  matClearcoat:0.5,  matClearcoatRoughness:0.2,  matEnv:2.5, matEmissive:'#0044ff', matEmissiveInt:0 },
  plastic:   { matColor:'#111111', matRoughness:0.1,  matMetalness:0.1,  matClearcoat:1.0,  matClearcoatRoughness:0.05, matEnv:3.0, matEmissive:'#0044ff', matEmissiveInt:0 },
  glass:     { matColor:'#aaccff', matRoughness:0.0,  matMetalness:0.0,  matClearcoat:1.0,  matClearcoatRoughness:0.0,  matEnv:4.5, matEmissive:'#0044ff', matEmissiveInt:0 },
  gold:      { matColor:'#ffcc66', matRoughness:0.1,  matMetalness:1.0,  matClearcoat:0.8,  matClearcoatRoughness:0.05, matEnv:3.5, matEmissive:'#0044ff', matEmissiveInt:0 },
  chrome:    { matColor:'#eeeeee', matRoughness:0.0,  matMetalness:1.0,  matClearcoat:1.0,  matClearcoatRoughness:0.0,  matEnv:5.0, matEmissive:'#0044ff', matEmissiveInt:0 },
  neon:      { matColor:'#2200ff', matRoughness:0.4,  matMetalness:0.5,  matClearcoat:0.5,  matClearcoatRoughness:0.15, matEnv:1.0, matEmissive:'#1100aa', matEmissiveInt:2.0 },
  metallica: { matColor:'#555555', matRoughness:0.6,  matMetalness:1.0,  matClearcoat:0.2,  matClearcoatRoughness:0.4,  matEnv:2.0, matEmissive:'#0044ff', matEmissiveInt:0 },
};

// ── RENDERER ──────────────────────────────────────────
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true, preserveDrawingBuffer:true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = S.exposure;
renderer.outputEncoding = THREE.sRGBEncoding;

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.set(0, 0, 6);

function resize(){
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas);
resize();

// ── ENV MAP ───────────────────────────────────────────
function makeEnvMap(){
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const sz = 512, cvs = document.createElement('canvas');
  cvs.width = sz * 2; cvs.height = sz;
  const c = cvs.getContext('2d');
  const grad = c.createLinearGradient(0, 0, 0, sz);
  grad.addColorStop(0, '#444'); grad.addColorStop(1, '#111');
  c.fillStyle = grad; c.fillRect(0, 0, sz * 2, sz);
  function dl(x, y, r, a){
    const g = c.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(x-r, y-r, r*2, r*2);
  }
  dl(sz*.5,  sz*.25, sz*.3,  1.0);
  dl(sz*1.5, sz*.25, sz*.3,  0.8);
  dl(sz,     sz*.8,  sz*.2,  0.5);
  const tex = new THREE.CanvasTexture(cvs);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  const env = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose(); tex.dispose();
  return env;
}
scene.environment = makeEnvMap();

// ── LIGHTS ────────────────────────────────────────────
const ambient   = new THREE.AmbientLight(0xffffff, S.ambientIntensity);
scene.add(ambient);
const mainLight = new THREE.DirectionalLight(0xffffff, S.keyIntensity);
mainLight.position.set(5, 5, 10);
mainLight.castShadow = true;
mainLight.shadow.mapSize.set(2048, 2048);
mainLight.shadow.bias = -0.0001;
scene.add(mainLight);
const rimLight = new THREE.DirectionalLight(0xffffff, S.rimIntensity);
rimLight.position.set(-5, 5, -5);
scene.add(rimLight);
const bottomLight = new THREE.DirectionalLight(0xffffff, 0.5);
bottomLight.position.set(0, -5, 2);
scene.add(bottomLight);

function updateLights(){
  mainLight.intensity = S.keyIntensity;
  mainLight.color.set(S.keyColor);
  ambient.intensity   = S.ambientIntensity;
  rimLight.intensity  = S.rimIntensity;
}
function updateExposure(){ renderer.toneMappingExposure = S.exposure; }

// ── GRADIENT SHADER INJECTION ─────────────────────────
let gradUniforms = null;
const GRAD_DIRS = ['vertical','horizontal','diagonal','radial'];

function applyGradientShader(mat, bbox){
  gradUniforms = null;
  mat.customProgramCacheKey = () => `grad_${S.matGradient ? S.matGradDir : 'none'}`;
  if(!S.matGradient) return;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uColorA  = { value: new THREE.Color(S.matGradColorA) };
    shader.uniforms.uColorB  = { value: new THREE.Color(S.matGradColorB) };
    shader.uniforms.uBboxMin = { value: bbox.min.clone() };
    shader.uniforms.uBboxMax = { value: bbox.max.clone() };
    shader.uniforms.uGradDir = { value: GRAD_DIRS.indexOf(S.matGradDir) };
    gradUniforms = shader.uniforms;

    shader.vertexShader = 'varying vec3 vLocalPos;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvLocalPos = position;'
    );

    shader.fragmentShader =
      'varying vec3 vLocalPos;\n' +
      'uniform vec3 uColorA;\nuniform vec3 uColorB;\nuniform vec3 uBboxMin;\nuniform vec3 uBboxMax;\nuniform int uGradDir;\n' +
      shader.fragmentShader.replace(
        'vec4 diffuseColor = vec4( diffuse, opacity );',
        `vec3 _sz = uBboxMax - uBboxMin;
float _t;
if(uGradDir==0){      _t=(_sz.y>0.0)?(vLocalPos.y-uBboxMin.y)/_sz.y:0.5;
}else if(uGradDir==1){_t=(_sz.x>0.0)?(vLocalPos.x-uBboxMin.x)/_sz.x:0.5;
}else if(uGradDir==2){float _tx=(_sz.x>0.0)?(vLocalPos.x-uBboxMin.x)/_sz.x:0.5;
                       float _ty=(_sz.y>0.0)?(vLocalPos.y-uBboxMin.y)/_sz.y:0.5;_t=(_tx+_ty)*0.5;
}else{ vec2 _ctr=(uBboxMin.xy+uBboxMax.xy)*0.5;float _r=length(_sz.xy)*0.5;
       _t=(_r>0.0)?1.0-clamp(length(vLocalPos.xy-_ctr)/_r,0.0,1.0):0.5; }
_t=clamp(_t,0.0,1.0);
vec3 _gc=mix(uColorB,uColorA,_t);
vec4 diffuseColor=vec4(_gc,opacity);`
      );
  };
}

function updateGradientUniforms(){
  if(!gradUniforms) return;
  if(gradUniforms.uColorA)  gradUniforms.uColorA.value.set(S.matGradColorA);
  if(gradUniforms.uColorB)  gradUniforms.uColorB.value.set(S.matGradColorB);
  if(gradUniforms.uGradDir) gradUniforms.uGradDir.value = GRAD_DIRS.indexOf(S.matGradDir);
  updateGradPreview();
}

function updateGradPreview(){
  const p = document.getElementById('grad-preview');
  if(!p) return;
  const dirMap = { vertical:'to top', horizontal:'to right', diagonal:'to top right', radial:'circle' };
  p.style.background = S.matGradDir === 'radial'
    ? `radial-gradient(circle,${S.matGradColorA},${S.matGradColorB})`
    : `linear-gradient(${dirMap[S.matGradDir]||'to top'},${S.matGradColorA},${S.matGradColorB})`;
}

// ── MESH ──────────────────────────────────────────────
let meshGroup = null, shadowMat = null;

function disposeMesh(){
  if(!meshGroup) return;
  scene.remove(meshGroup);
  meshGroup.traverse(o=>{
    if(o.isMesh){ o.geometry.dispose(); [].concat(o.material).forEach(m=>m.dispose()); }
  });
  meshGroup = null; shadowMat = null; gradUniforms = null;
}

function getMat(bbox){
  const mat = new THREE.MeshPhysicalMaterial({
    color:               new THREE.Color(S.matGradient ? '#ffffff' : S.matColor),
    metalness:           S.matMetalness,
    roughness:           S.matRoughness,
    clearcoat:           S.matClearcoat,
    clearcoatRoughness:  S.matClearcoatRoughness,
    envMapIntensity:     S.matEnv * S.envIntensity,
    emissive:            new THREE.Color(S.matEmissive || '#000000'),
    emissiveIntensity:   S.matEmissiveInt,
    side: THREE.DoubleSide,
  });
  applyGradientShader(mat, bbox);
  return mat;
}

function updateMaterials(){
  if(!meshGroup) return;
  meshGroup.traverse(o=>{
    if(o.isMesh && o.material && !(o.material instanceof THREE.ShadowMaterial)){
      const m = o.material;
      if(!S.matGradient) m.color.set(S.matColor);
      m.roughness           = S.matRoughness;
      m.metalness           = S.matMetalness;
      m.clearcoat           = S.matClearcoat;
      m.clearcoatRoughness  = S.matClearcoatRoughness;
      m.envMapIntensity     = S.matEnv * S.envIntensity;
      m.emissive.set(S.matEmissive || '#000000');
      m.emissiveIntensity   = S.matEmissiveInt;
      m.needsUpdate = true;
    }
  });
}

function updateShadow(){ if(shadowMat) shadowMat.opacity = S.shadowOpacity; }

// ── CREASE-ANGLE NORMAL SMOOTHING ─────────────────────
// Correctly smooths curved surfaces while preserving hard edges (≥ creaseAngleDeg).
// This eliminates the horizontal ridges on extruded sides without corrupting the
// 90° corners between the front face and the extrusion walls.
function computeCreaseNormals(geo, creaseAngleDeg){
  // 65° default: smooths logo wall curves & bevel rings without blurring the
  // hard 90° front-face ↔ side-wall corner. Raise/lower to taste.
  const deg = (creaseAngleDeg !== undefined) ? creaseAngleDeg : 65;
  const cosCrease = Math.cos(deg * Math.PI / 180);

  // Work on a non-indexed copy — every face has 3 dedicated, unshared vertices
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  const pos = g.attributes.position;
  const N   = pos.count; // always a multiple of 3

  // Pass 1 — flat face normal per vertex
  const fnx = new Float32Array(N);
  const fny = new Float32Array(N);
  const fnz = new Float32Array(N);
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), fn = new THREE.Vector3();

  for(let i = 0; i < N; i += 3){
    va.fromBufferAttribute(pos, i);
    vb.fromBufferAttribute(pos, i+1);
    vc.fromBufferAttribute(pos, i+2);
    e1.subVectors(vb, va);
    e2.subVectors(vc, va);
    fn.crossVectors(e1, e2).normalize();
    fnx[i]=fnx[i+1]=fnx[i+2]=fn.x;
    fny[i]=fny[i+1]=fny[i+2]=fn.y;
    fnz[i]=fnz[i+1]=fnz[i+2]=fn.z;
  }

  // Pass 2 — hash vertices by position so we can find co-located groups.
  // Use 1e5 precision (5 decimal places) to avoid floating-point grouping misses
  // that cause un-smoothed ridges between otherwise identical vertex positions.
  const PREC = 1e5;
  const posMap = new Map();
  for(let i = 0; i < N; i++){
    const k = `${Math.round(pos.getX(i)*PREC)},${Math.round(pos.getY(i)*PREC)},${Math.round(pos.getZ(i)*PREC)}`;
    if(!posMap.has(k)) posMap.set(k, []);
    posMap.get(k).push(i);
  }

  // Pass 3 — averaged smooth normal per vertex (only within crease angle)
  const snx = new Float32Array(N);
  const sny = new Float32Array(N);
  const snz = new Float32Array(N);
  const avg = new THREE.Vector3();

  const keyOf = i =>
    `${Math.round(pos.getX(i)*PREC)},${Math.round(pos.getY(i)*PREC)},${Math.round(pos.getZ(i)*PREC)}`;

  for(let i = 0; i < N; i++){
    const mx = fnx[i], my = fny[i], mz = fnz[i];
    const group = posMap.get(keyOf(i));
    avg.set(0,0,0);
    for(const j of group){
      // only average faces whose normal is within crease angle of this face
      const dot = mx*fnx[j] + my*fny[j] + mz*fnz[j];
      if(dot >= cosCrease){ avg.x+=fnx[j]; avg.y+=fny[j]; avg.z+=fnz[j]; }
    }
    avg.normalize();
    snx[i]=avg.x; sny[i]=avg.y; snz[i]=avg.z;
  }

  // Apply
  const normals = new Float32Array(N * 3);
  for(let i = 0; i < N; i++){
    normals[i*3]=snx[i]; normals[i*3+1]=sny[i]; normals[i*3+2]=snz[i];
  }
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return g;
}

// ── DEBOUNCE for expensive rebuilds ───────────────────
let _buildTimer = null;
function debouncedBuild(){
  clearTimeout(_buildTimer);
  setStatus('…', true);
  _buildTimer = setTimeout(buildMesh, 380);
}

async function buildMesh(){
  clearTimeout(_buildTimer);
  setStatus('Processing...', true);
  disposeMesh();
  meshGroup = new THREE.Group();

  if(S.userImgEl){
    const shapes = await window.TraceImage(S.userImgEl, S.traceThreshold, S.traceSimplify);
    if(shapes && shapes.length){
      setStatus(`${shapes.length} Parts`, true);
      const extOpts = {
        depth:         S.depth,
        bevelEnabled:  true,
        bevelThickness:S.bevel,
        bevelSize:     S.bevel * 0.8,
        bevelSegments: Math.max(1, Math.round(S.bevelSegs)),
        curveSegments: Math.max(4, Math.round(S.curveSegs)),
      };
      let geo = new THREE.ExtrudeGeometry(shapes, extOpts);
      geo.center();
      geo = computeCreaseNormals(geo);
      const bbox = new THREE.Box3().setFromBufferAttribute(geo.attributes.position);
      const mesh = new THREE.Mesh(geo, getMat(bbox));
      mesh.castShadow = true; mesh.receiveShadow = true;
      meshGroup.add(mesh);
    } else {
      setStatus('Trace Failed', false);
      addFallback();
    }
  } else {
    addFallback();
  }

  // Shadow plane
  shadowMat = new THREE.ShadowMaterial({ opacity: S.shadowOpacity, transparent:true });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(20,20), shadowMat);
  plane.rotation.x = -Math.PI/2;
  const box = new THREE.Box3().setFromObject(meshGroup);
  plane.position.y = box.min.y - 0.05;
  plane.receiveShadow = true;
  meshGroup.add(plane);

  meshGroup.scale.setScalar(S.scale);
  scene.add(meshGroup);
  setStatus('', false);
}

function addFallback(){
  let geo = new THREE.TorusKnotGeometry(0.8, 0.3, 128, 32);
  geo = computeCreaseNormals(geo, 60);
  const bbox = new THREE.Box3().setFromBufferAttribute(geo.attributes.position);
  const mesh = new THREE.Mesh(geo, getMat(bbox));
  mesh.castShadow = true; mesh.receiveShadow = true;
  meshGroup.add(mesh);
}

// ── BACKGROUND ────────────────────────────────────────
const bgScene = new THREE.Scene();
const bgCam   = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
let bgMesh = null;

function buildBg(){
  if(bgMesh){ bgScene.remove(bgMesh); bgMesh.geometry.dispose(); bgMesh.material.dispose(); bgMesh=null; }
  const colorRow = document.getElementById('bg-color-row');
  if(S.bgMode==='trans'){
    renderer.setClearColor(0x000000, 0);
    if(colorRow) colorRow.style.display='none';
    return;
  }
  renderer.setClearColor(0x000000, 1);
  let frag;
  if(S.bgMode==='solid'){
    const c=new THREE.Color(S.bgColor);
    frag=`void main(){ gl_FragColor=vec4(${c.r.toFixed(4)},${c.g.toFixed(4)},${c.b.toFixed(4)},1.0); }`;
    if(colorRow) colorRow.style.display='';
  } else {
    frag=`varying vec2 v; void main(){
      float d=length(v-0.5);
      vec3 col=mix(vec3(0.15),vec3(0.02),d*1.5);
      gl_FragColor=vec4(col,1.0);
    }`;
    if(colorRow) colorRow.style.display='none';
  }
  const mat=new THREE.ShaderMaterial({ vertexShader:'varying vec2 v; void main(){ v=uv; gl_Position=vec4(position,1.); }', fragmentShader:frag, depthWrite:false, depthTest:false });
  bgMesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2), mat);
  bgScene.add(bgMesh);
}

// ── INTERACTION ───────────────────────────────────────
let isDragging=false, lmx=0, lmy=0;
canvas.addEventListener('mousedown', e=>{ isDragging=true; lmx=e.clientX; lmy=e.clientY; });
window.addEventListener('mouseup',   ()=>{ isDragging=false; });
window.addEventListener('mousemove', e=>{
  if(!isDragging) return;
  S.rotY+=(e.clientX-lmx)*0.01; S.rotX+=(e.clientY-lmy)*0.01;
  lmx=e.clientX; lmy=e.clientY;
});
canvas.addEventListener('wheel', e=>{
  e.preventDefault();
  camera.position.z=Math.max(2,Math.min(20,camera.position.z+e.deltaY*0.005));
},{passive:false});

// ── RENDER LOOP ───────────────────────────────────────
function tick(){
  requestAnimationFrame(tick);
  S.t+=0.01;
  if(meshGroup&&!isDragging&&!S.isRecording){
    meshGroup.position.y=Math.sin(S.t)*S.floatAmt*0.1;
    if(S.speed>0){
      if(S.spinAxis==='y')      S.rotY+=S.speed*0.01;
      else if(S.spinAxis==='x') S.rotX+=S.speed*0.01;
      else                      S.rotZ+=S.speed*0.01;
    }
  }
  if(meshGroup){
    meshGroup.rotation.y=S.rotY;
    meshGroup.rotation.x=S.rotX+S.tiltX*Math.PI/180;
    meshGroup.rotation.z=S.rotZ;
  }
  renderer.autoClear=false; renderer.clear();
  if(bgMesh) renderer.render(bgScene,bgCam);
  renderer.render(scene,camera);
}
tick(); buildBg(); buildMesh();

// ── EXPORTS ───────────────────────────────────────────
function doRender(){
  renderer.autoClear=false; renderer.clear();
  if(bgMesh) renderer.render(bgScene,bgCam);
  renderer.render(scene,camera);
}

document.getElementById('btn-png').addEventListener('click',()=>{
  const r=S.exportRes,w=canvas.clientWidth,h=canvas.clientHeight;
  if(r>1){ renderer.setSize(w*r,h*r,false); camera.aspect=w/h; camera.updateProjectionMatrix(); }
  doRender();
  const a=document.createElement('a'); a.download='logo-3d.png'; a.href=canvas.toDataURL('image/png'); a.click();
  if(r>1) resize();
});

document.getElementById('btn-webm').addEventListener('click',()=>{
  if(S.isRecording) return;
  S.isRecording=true;
  const btn=document.getElementById('btn-webm');
  btn.textContent='⏹ Recording...'; btn.classList.add('recording');
  const chunks=[],stream=canvas.captureStream(30);
  const rec=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9'});
  rec.ondataavailable=e=>{ if(e.data.size>0) chunks.push(e.data); };
  rec.onstop=()=>{
    const blob=new Blob(chunks,{type:'video/webm'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='logo-3d.webm'; a.click();
    S.isRecording=false; btn.textContent='Export Video'; btn.classList.remove('recording');
  };
  const startY=S.rotY; S.rotY=0; S.rotX=0; S.rotZ=0;
  let frame=0,total=90; rec.start();
  const ri=setInterval(()=>{
    frame++; S.rotY=(frame/total)*Math.PI*2;
    if(frame>=total){ clearInterval(ri); rec.stop(); S.rotY=startY; }
  },33);
});

document.getElementById('btn-gif').addEventListener('click',async()=>{
  if(S.isRecording) return;
  S.isRecording=true;
  const btn=document.getElementById('btn-gif'); btn.classList.add('recording');
  let workerBlobUrl;
  try{
    const resp=await fetch('https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js');
    if(!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const blob=new Blob([await resp.text()],{type:'application/javascript'});
    workerBlobUrl=URL.createObjectURL(blob);
  }catch(e){
    setStatus('Could not load GIF worker',true);
    S.isRecording=false; btn.classList.remove('recording'); return;
  }
  const delay=Math.round(1000/S.gifFPS);
  const gif=new GIF({workers:2,quality:10,width:canvas.width,height:canvas.height,workerScript:workerBlobUrl,transparent:S.bgMode==='trans'?0x000000:null});
  const frames=S.gifFrames,startY=S.rotY;
  for(let i=0;i<frames;i++){
    S.rotY=(i/frames)*Math.PI*2; doRender();
    gif.addFrame(canvas,{copy:true,delay});
    setStatus(`Capturing ${Math.round((i/frames)*100)}%`,true);
    await new Promise(r=>setTimeout(r,8));
  }
  S.rotY=startY; setStatus('Encoding GIF...',true);
  gif.on('finished',blob=>{
    URL.revokeObjectURL(workerBlobUrl);
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='logo-3d.gif'; a.click();
    S.isRecording=false; btn.classList.remove('recording'); setStatus('',false);
  });
  gif.render();
});

// 3D exports
function getExportGroup(){
  if(!meshGroup){ alert('No model loaded — upload a logo first.'); return null; }
  meshGroup.updateMatrixWorld(true);
  const group=new THREE.Group();
  meshGroup.traverse(o=>{
    if(o.isMesh&&!(o.material instanceof THREE.ShadowMaterial)){
      const geo=o.geometry.clone(); geo.applyMatrix4(o.matrixWorld);
      group.add(new THREE.Mesh(geo,o.material.clone()));
    }
  });
  return group;
}
function dlBlob(blob,name){ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),10000); }

document.getElementById('btn-glb').addEventListener('click',()=>{
  const g=getExportGroup(); if(!g) return;
  if(typeof THREE.GLTFExporter==='undefined'){ alert('GLTFExporter not loaded.'); return; }
  setStatus('Exporting GLB...',true);
  new THREE.GLTFExporter().parse(g,r=>{ dlBlob(new Blob([r],{type:'application/octet-stream'}),'logo-3d.glb'); setStatus('',false); },{binary:true});
});

document.getElementById('btn-obj').addEventListener('click',()=>{
  const g=getExportGroup(); if(!g) return;
  if(typeof THREE.OBJExporter==='undefined'){ alert('OBJExporter not loaded.'); return; }
  setStatus('Exporting OBJ...',true);
  const obj=new THREE.OBJExporter().parse(g);
  const c=new THREE.Color(S.matColor);
  const mtl=[`newmtl logo_mat`,`Kd ${c.r.toFixed(4)} ${c.g.toFixed(4)} ${c.b.toFixed(4)}`,`Ka 0.1 0.1 0.1`,`Ks ${S.matMetalness.toFixed(2)} ${S.matMetalness.toFixed(2)} ${S.matMetalness.toFixed(2)}`,`Ns ${Math.round((1-S.matRoughness)*900)}`,`d 1.0`].join('\n');
  dlBlob(new Blob(['mtllib logo-3d.mtl\nusemtl logo_mat\n'+obj],{type:'text/plain'}),'logo-3d.obj');
  dlBlob(new Blob([mtl],{type:'text/plain'}),'logo-3d.mtl');
  setStatus('',false);
});

document.getElementById('btn-stl').addEventListener('click',()=>{
  const g=getExportGroup(); if(!g) return;
  setStatus('Exporting STL...',true);
  const tris=[];
  g.traverse(o=>{
    if(!o.isMesh) return;
    const geo=o.geometry.clone();
    const ni=geo.index?geo.toNonIndexed():geo;
    const p=ni.attributes.position;
    for(let i=0;i<p.count;i+=3){
      const a=new THREE.Vector3().fromBufferAttribute(p,i);
      const b=new THREE.Vector3().fromBufferAttribute(p,i+1);
      const c=new THREE.Vector3().fromBufferAttribute(p,i+2);
      const n=new THREE.Vector3().crossVectors(new THREE.Vector3().subVectors(b,a),new THREE.Vector3().subVectors(c,a)).normalize();
      tris.push({n,a,b,c});
    }
    geo.dispose(); ni.dispose();
  });
  const buf=new ArrayBuffer(84+tris.length*50);
  const v=new DataView(buf);
  const hdr='Form Studio 3D Export';
  for(let i=0;i<80;i++) v.setUint8(i,i<hdr.length?hdr.charCodeAt(i):0);
  v.setUint32(80,tris.length,true);
  let off=84;
  for(const{n,a,b,c}of tris){
    [n.x,n.y,n.z,a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z].forEach(f=>{ v.setFloat32(off,f,true); off+=4; });
    v.setUint16(off,0,true); off+=2;
  }
  dlBlob(new Blob([buf],{type:'application/octet-stream'}),'logo-3d.stl');
  setStatus('',false);
});

// ── UI HELPERS ────────────────────────────────────────
function bindSl(id,key,cb,dec=2){
  const el=document.getElementById('sl-'+id),disp=document.getElementById('sv-'+id);
  if(!el) return;
  el.value=S[key];
  if(disp) disp.textContent=Number(S[key]).toFixed(dec);
  el.addEventListener('input',()=>{
    const val=parseFloat(el.value); S[key]=val;
    if(disp) disp.textContent=val.toFixed(dec);
    if(cb) cb();
  });
}
function bindColor(id,key,cb){
  const el=document.getElementById(id); if(!el) return;
  el.value=S[key];
  el.addEventListener('input',()=>{ S[key]=el.value; if(cb) cb(); });
}

function syncMaterialUI(){
  const map={
    'sl-mat-color':'matColor','sl-rough':'matRoughness','sl-metal':'matMetalness',
    'sl-coat':'matClearcoat','sl-coatrough':'matClearcoatRoughness',
    'sl-glow':'matEmissiveInt','sl-glow-color':'matEmissive',
  };
  Object.entries(map).forEach(([id,key])=>{
    const el=document.getElementById(id); if(!el) return;
    el.value=S[key];
    const svId='sv-'+id.replace('sl-','');
    const sv=document.getElementById(svId);
    if(sv) sv.textContent=Number(S[key]).toFixed(id.includes('glow')&&!id.includes('color')?1:2);
  });
}

// ── WIRE UP ───────────────────────────────────────────

// Presets
document.querySelectorAll('[data-p]').forEach(b=>{
  b.addEventListener('click',()=>{
    document.querySelectorAll('[data-p]').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    const p=PRESETS[b.dataset.p]; if(p) Object.assign(S,p);
    S.preset=b.dataset.p;
    syncMaterialUI();
    if(S.matGradient) buildMesh(); else updateMaterials();
  });
});

// Color mode toggle
document.querySelectorAll('[data-cmode]').forEach(b=>{
  b.addEventListener('click',()=>{
    document.querySelectorAll('[data-cmode]').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    S.matGradient=b.dataset.cmode==='gradient';
    document.getElementById('solid-color-row').style.display=S.matGradient?'none':'';
    document.getElementById('gradient-rows').style.display   =S.matGradient?''   :'none';
    buildMesh();
  });
});

// Solid color
bindColor('sl-mat-color','matColor',updateMaterials);
document.getElementById('btn-mat-color-reset')?.addEventListener('click',()=>{
  const p=PRESETS[S.preset]; if(p){ S.matColor=p.matColor; document.getElementById('sl-mat-color').value=S.matColor; updateMaterials(); }
});

// Gradient — color picks update live via uniforms; direction needs shader recompile
document.getElementById('sl-grad-a').addEventListener('input',e=>{ S.matGradColorA=e.target.value; updateGradientUniforms(); });
document.getElementById('sl-grad-b').addEventListener('input',e=>{ S.matGradColorB=e.target.value; updateGradientUniforms(); });
document.querySelectorAll('[data-gdir]').forEach(b=>{
  b.addEventListener('click',()=>{
    document.querySelectorAll('[data-gdir]').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    S.matGradDir=b.dataset.gdir;
    buildMesh();
  });
});

// Material sliders — instant
bindSl('rough',    'matRoughness',          updateMaterials);
bindSl('metal',    'matMetalness',          updateMaterials);
bindSl('coat',     'matClearcoat',          updateMaterials);
bindSl('coatrough','matClearcoatRoughness', updateMaterials);
bindSl('glow',     'matEmissiveInt',        updateMaterials, 1);
bindColor('sl-glow-color','matEmissive',    updateMaterials);

// Geometry — DEBOUNCED rebuild (eliminates lag while dragging)
bindSl('depth',    'depth',    debouncedBuild);
bindSl('bevel',    'bevel',    debouncedBuild, 3);
bindSl('bevelsegs','bevelSegs',debouncedBuild, 0);
bindSl('curvesegs','curveSegs',debouncedBuild, 0);
bindSl('scale',    'scale',    ()=>meshGroup&&meshGroup.scale.setScalar(S.scale));

// Lighting — instant
bindSl('key',     'keyIntensity',     updateLights, 1);
bindColor('sl-key-color','keyColor',  updateLights);
bindSl('ambient', 'ambientIntensity', updateLights);
bindSl('rim',     'rimIntensity',     updateLights, 1);
bindSl('envint',  'envIntensity',     updateMaterials);
bindSl('exposure','exposure',         updateExposure);

// Background
document.querySelectorAll('[data-bg]').forEach(b=>{
  b.addEventListener('click',()=>{
    document.querySelectorAll('[data-bg]').forEach(x=>x.classList.remove('active'));
    b.classList.add('active'); S.bgMode=b.dataset.bg; buildBg();
  });
});
bindColor('sl-bg-color','bgColor',buildBg);
bindSl('shadow','shadowOpacity',updateShadow);

// Presentation
bindSl('tilt', 'tiltX',    null, 0);
bindSl('float','floatAmt', null, 1);
bindSl('speed','speed',    null, 1);
document.querySelectorAll('[data-axis]').forEach(b=>{
  b.addEventListener('click',()=>{
    document.querySelectorAll('[data-axis]').forEach(x=>x.classList.remove('active'));
    b.classList.add('active'); S.spinAxis=b.dataset.axis;
  });
});

// Trace — DEBOUNCED rebuild
bindSl('thresh',  'traceThreshold', debouncedBuild, 0);
bindSl('simplify','traceSimplify',  debouncedBuild);

// Export
document.querySelectorAll('[data-res]').forEach(b=>{
  b.addEventListener('click',()=>{
    document.querySelectorAll('[data-res]').forEach(x=>x.classList.remove('active'));
    b.classList.add('active'); S.exportRes=parseInt(b.dataset.res);
  });
});
bindSl('gifframes','gifFrames',null,0);
bindSl('giffps',   'gifFPS',   null,0);

// ── IMAGE LOADING ─────────────────────────────────────
const fileIn=document.getElementById('file-in');
const load=f=>{
  const img=new Image();
  img.onload=()=>{ S.userImgEl=img; document.getElementById('drop-overlay').classList.add('hidden'); buildMesh(); };
  img.src=URL.createObjectURL(f);
};
document.getElementById('upload-btn').addEventListener('click',()=>fileIn.click());
document.getElementById('browse-btn').addEventListener('click',()=>fileIn.click());
fileIn.addEventListener('change',()=>fileIn.files[0]&&load(fileIn.files[0]));
const vp=document.getElementById('viewport');
vp.addEventListener('dragover',e=>{ e.preventDefault(); document.getElementById('drop-overlay').classList.add('drag-over'); });
vp.addEventListener('dragleave',()=>document.getElementById('drop-overlay').classList.remove('drag-over'));
vp.addEventListener('drop',e=>{ e.preventDefault(); document.getElementById('drop-overlay').classList.remove('drag-over'); if(e.dataTransfer.files[0]) load(e.dataTransfer.files[0]); });

// Init gradient preview on load
updateGradPreview();

// ── STATUS ────────────────────────────────────────────
function setStatus(msg,vis){ const el=document.getElementById('status-msg'); el.textContent=msg; el.classList.toggle('vis',vis); }

})();