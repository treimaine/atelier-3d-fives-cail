'use strict';
// Atelier 3D. One world unit is one metre. X/Z: floor, Y: elevation.
const $=id=>document.getElementById(id), clone=o=>JSON.parse(JSON.stringify(o));
const KEY='hub_fives_cail_atelier_v3'+(globalThis.location?.search.includes('validation=1')?'_validation':''), LEGACY='hub_fives_cail_state_v2';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=(v,min,max,label)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error(label+' : valeur attendue entre '+min+' et '+max+'.');return v;};
const color=v=>/^#[0-9a-f]{6}$/i.test(v)?v:'#a8b29d';
const wallLength=w=>Math.hypot(w.x2-w.x1,w.z2-w.z1);
const inside=(x,z)=>Arch.contains(buildingOutline(),{x,z});
const rectInside=r=>[[r.x,r.z],[r.x+r.w,r.z],[r.x,r.z+r.d],[r.x+r.w,r.z+r.d]].every(([x,z])=>inside(x,z));
const SURFACES={concrete:'Béton poli',oak:'Parquet chêne',carpet:'Moquette acoustique',tile:'Carrelage clair'};
// Taille physique du motif, en mètres : les UV des sols sont exprimés en mètres.
const SURFACE_SIZE={concrete:3,oak:1.8,carpet:1.2,tile:.6};
// Un objet posé sur un plateau tient son élévation de son support. Références inconnues,
// cycles et objets sortis de l'emprise du support sont détachés, jamais silencieusement conservés.
function resolveSupports(clean){
 const byId=new Map(clean.furniture.map(f=>[f.id,f]));
 for(const f of clean.furniture){
  if(!f.support)continue;
  let cur=byId.get(f.support),seen=new Set([f.id]),ok=!!cur&&cur!==f;
  while(ok&&cur){if(seen.has(cur.id)){ok=false;break;}seen.add(cur.id);cur=cur.support?byId.get(cur.support):null;}
  if(!ok){delete f.support;continue;}
  const s=byId.get(f.support);
  if(!Arch.contains(Arch.footprint(s),{x:f.x,z:f.z}))delete f.support;
 }
 for(let pass=0;pass<8;pass++)for(const f of clean.furniture){const s=f.support?byId.get(f.support):null;if(s)f.y=+Math.min(20,s.y+s.h).toFixed(4);}
}
function validate(s){
 if(!s||!Array.isArray(s.zones)||!Array.isArray(s.walls)||!Array.isArray(s.furniture))throw Error('Projet invalide : zones, murs et mobilier requis.');
 if(s.zones.length>150||s.walls.length>400||s.furniture.length>500)throw Error('Limite : 150 zones, 400 murs et 500 objets.');
 const clean={schemaVersion:7,meta:{name:String(s.meta?.name||'Étude Fives Cail').slice(0,100),revision:Math.max(0,Math.min(9999,Math.round(+s.meta?.revision||0))),exported:String(s.meta?.exported||'').slice(0,10)},zones:[],walls:[],furniture:[],assets:{}};
 clean.building=validateBuilding(s.building);
 clean.clearance=num(s.clearance??.6,0,5,'Marge de dégagement');
 clean.variants=validateVariants(s.variants);
 clean.views=validateViews(s.views);
 for(const [id,a] of Object.entries(s.assets||{})){
  if(a.builtin&&BUNDLED_MODELS[a.builtin]){clean.assets[id]={builtin:a.builtin,name:BUNDLED_MODELS[a.builtin].name,credit:BUNDLED_MODELS[a.builtin].credit,source:BUNDLED_MODELS[a.builtin].source};continue;}
  if(!/^asset_[\w-]+$/.test(id)||typeof a.data!=='string'||a.data.length>17000000||!/^data:application\/octet-stream;base64,[A-Za-z0-9+/=]+$/.test(a.data))throw Error('Ressource GLB invalide.');
  clean.assets[id]={name:String(a.name||'Modèle importé').slice(0,100),data:a.data,credit:String(a.credit||'').slice(0,500),source:String(a.source||'').slice(0,500)};
 }
 s.zones.forEach(z=>{const vertices=z.vertices?Arch.validatePolygon(z.vertices):null,b=vertices?Arch.bounds(vertices):z;clean.zones.push({n:String(z.n||'Espace').slice(0,100),t:String(z.t||'').slice(0,3000),c:color(z.c),x:num(b.x,-100,100,'X zone'),z:num(b.z,-100,100,'Z zone'),w:num(b.w,.05,100,'Largeur zone'),d:num(b.d,.05,100,'Profondeur zone'),surface:SURFACES[z.surface]?z.surface:'concrete',...(vertices?{vertices}:{}),...(z.nodes?{nodes:z.nodes.map(String)}:{})});});
 if(clean.zones.reduce((n,z)=>n+Arch.polygon(z).length,0)>1200)throw Error('Maximum 1 200 sommets de pièces par projet.');
 if(s.reference){const r=s.reference;if(typeof r.data!=='string'||r.data.length>12000000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(r.data))throw Error('Fond de plan invalide.');clean.reference={name:String(r.name||'Plan').slice(0,200),data:r.data,widthPx:num(r.widthPx,1,10000,'Largeur image'),heightPx:num(r.heightPx,1,10000,'Hauteur image'),x:num(r.x,-100,100,'Origine X du plan'),z:num(r.z,-100,100,'Origine Z du plan'),scale:num(r.scale,.000001,10,'Échelle du plan'),rotation:num(r.rotation??0,-360,360,'Rotation du plan'),opacity:num(r.opacity??.85,.05,1,'Opacité'),visible:r.visible!==false,calibrated:!!r.calibrated};if(Math.max(r.widthPx,r.heightPx)*r.scale>200)throw Error('Le fond de plan dépasse 200 m.');if(r.calibration)clean.reference.calibration=clone(r.calibration);}

 s.walls.forEach(w=>{
  const o={x1:num(w.x1,-100,100,'X1'),z1:num(w.z1,-100,100,'Z1'),x2:num(w.x2,-100,100,'X2'),z2:num(w.z2,-100,100,'Z2'),h:num(w.h,.3,15,'Hauteur mur'),t:num(w.t,.04,2,'Épaisseur'),mat:['plein','cloison','vitre'].includes(w.mat)?w.mat:'plein',op:[]};
  Object.assign(o,Arch.normalizeWall(w));
  const L=wallLength(o);if(L<.1)throw Error('Un mur doit mesurer au moins 10 cm.');
  if(!Array.isArray(w.op??[])||(w.op||[]).length>40)throw Error('Ouvertures invalides.');
  (w.op||[]).forEach(a=>{
   if(!OPEN_TYPES[a.type])throw Error('Type d’ouverture inconnu.');
   const b={type:a.type,w:num(a.w,.2,L,'Largeur ouverture'),h:num(a.h,.2,o.h,'Hauteur ouverture'),sill:num(a.sill??0,0,o.h,'Allège'),d:num(a.d,0,L,'Position ouverture')};
   if(b.sill+b.h>o.h+.001||b.d-b.w/2<-.001||b.d+b.w/2>L+.001)throw Error('Une ouverture dépasse de son mur.');
   if(o.op.some(p=>Math.abs(p.d-b.d)<(p.w+b.w)/2+.05))throw Error('Les ouvertures doivent être séparées d’au moins 5 cm.');
   b.swing=a.swing===-1?-1:1;b.hinge=a.hinge==='right'?'right':'left';o.op.push(b);
  });clean.walls.push(o);
 });
 const usedIds=new Set();
 const furnitureId=v=>{let id=typeof v==='string'&&/^[\w-]{1,40}$/.test(v)?v:'obj_'+(clean.furniture.length+1)+'_'+Math.random().toString(36).slice(2,8);while(usedIds.has(id))id+='_2';usedIds.add(id);return id;};
 s.furniture.forEach(f=>{
  const builtin=FURN_ASSETS[f.type];if(builtin)clean.assets["asset_builtin_"+builtin]=builtinAsset(builtin);
  const t=FURN_TYPES[f.type];if(!t&&!(f.type==='custom'&&clean.assets[f.assetId]))throw Error('Objet ou modèle importé inconnu.');
  clean.furniture.push({id:furnitureId(f.id),type:f.type,lockAspect:f.lockAspect!==false,locked:!!f.locked,front:FRONT_AXES[f.front]?f.front:'+z',...(f.bespoke?{bespoke:true}:{}),...(f.ref?{ref:String(f.ref).slice(0,120)}:{}),...(f.support?{support:String(f.support).slice(0,40)}:{}),...(FURN_TYPES[f.lastType]?{lastType:f.lastType}:{}),...(f.groupId?{groupId:String(f.groupId).slice(0,100)}:{}),...(f.assetId?{assetId:f.assetId}:{}),...(f.clearance==null?{}:{clearance:num(f.clearance,0,5,'Dégagement objet')}),n:String(f.n||t?.n||clean.assets[f.assetId]?.name||'Objet').slice(0,100),x:num(f.x,-100,100,'X mobilier'),z:num(f.z,-100,100,'Z mobilier'),y:num(f.y??0,0,20,'Élévation'),r:num(f.r??0,-10000,10000,'Rotation'),w:num(f.w??t?.w??1,.05,30,'Largeur'),d:num(f.d??t?.d??1,.05,30,'Profondeur'),h:num(f.h??t?.h??1,.05,15,'Hauteur'),c:color(f.c??('#'+(t?.c??0x8c9a83).toString(16).padStart(6,'0')))});
 });resolveSupports(clean);Arch.checkConstraints(clean);return clean;
}
let state=validate(DEFAULT_STATE), selection=null, tool='select', placing=null, firstPoint=null, measurement=null;
const LAMP_LIMIT=8;
let view='3d', cut=true, roofOn=false, dirty=true, buildPending=false, pointer=null, busy=false;
const undoStack=[],redoStack=[],assetCache=new Map();let saved=true,noticeTimer;
function notify(message){$('notice').textContent=message;$('notice').style.display='block';clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').style.display='none',5500);}
function snapshot(){return JSON.stringify(state);}
function persist(){persistProject();}
function record(before){if(before===snapshot())return;circulationStale=true;undoStack.push(before);if(undoStack.length>40)undoStack.shift();redoStack.length=0;persist();}
function commit(fn){if(busy)return;const before=snapshot(),beforeSelection=clone(selection);try{fn();isolateEdit(JSON.parse(before),state);Arch.propagate(JSON.parse(before),state);state=validate(state);record(before);refresh();}catch(e){state=JSON.parse(before);selection=beforeSelection;notify(e.message);refresh();}}
function historyStep(redo=false){if(busy)return;circulationStale=true;const src=redo?redoStack:undoStack,dst=redo?undoStack:redoStack;if(!src.length)return;dst.push(snapshot());state=JSON.parse(src.pop());selection=null;persist();refresh();}
// Les poteaux vivent dans state.building : une collection de plus, sélectionnable comme les autres.
const collection=kind=>kind==='columns'?state.building?.columns:state[kind];
function selected(){return selection?.kind==='open'?state.walls[selection.wi]?.op[selection.oi]:selection?collection(selection.kind)?.[selection.i]:null;}
function select(s){selection=s;refresh();}
function setTool(t,p=null){if(t!==tool||t!=='place')cancelPlacement();endRotation(true);stopNavigation();if($('navigateTool'))$('navigateTool').classList.toggle('active',t==='navigate');if(t!==tool)architectureCancel();tool=t;placing=p;firstPoint=null;pointer=null;$('selectTool').classList.toggle('active',t==='select');$('measureTool').classList.toggle('active',t==='measure');$('drawWall').classList.toggle('active',t==='wall');dirty=true;rebuild();}
const snap=v=>{const step=+$('snap').value;return step?Math.round(v/step)*step:v;};

// Shared, deterministic materials. Geometry and label resources are released on rebuild.
const pool=new Set(),texturePool=new Set();
function texture(kind){const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
 ctx.fillStyle=kind==='oak'?'#b9976c':kind==='carpet'?'#7c827a':kind==='tile'?'#cecec3':'#b3b4ac';ctx.fillRect(0,0,256,256);
 for(let i=0;i<8500;i++){let v=Math.floor(80+rnd()*130);ctx.fillStyle=`rgba(${v},${v},${v},${kind==='carpet'?.3:.12})`;ctx.fillRect(rnd()*256,rnd()*256,kind==='oak'?25:2,1);}
 ctx.strokeStyle=kind==='oak'?'#7f694e':'#a6aa9f';ctx.lineWidth=1;
 if(kind==='oak'){for(let y=0;y<256;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(256,y);ctx.moveTo((y%64?60:185),y);ctx.lineTo((y%64?60:185),y+32);ctx.stroke();}}
 if(kind==='tile'){ctx.strokeRect(1,1,254,254);ctx.beginPath();ctx.moveTo(128,0);ctx.lineTo(128,256);ctx.moveTo(0,128);ctx.lineTo(256,128);ctx.stroke();}
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.encoding=THREE.sRGBEncoding;t.anisotropy=4;texturePool.add(t);return t;
}
const textures=Object.fromEntries(Object.keys(SURFACES).map(k=>[k,texture(k)]));
function material(opts){const m=new THREE.MeshStandardMaterial(opts);pool.add(m);return m;}
const mats={wood:material({color:0xffffff,map:textures.oak,roughness:.55}),metal:material({color:0x333d39,metalness:.75,roughness:.32}),cream:material({color:0xe1dcd0,roughness:.82}),black:material({color:0x1c2326,roughness:.7}),white:material({color:0xf0ede2,roughness:.4}),leaf:material({color:0x526d37,roughness:.8}),soil:material({color:0x3e3021,roughness:1}),pot:material({color:0xad7960,roughness:.85}),glass:material({color:0xb7d4d0,transparent:true,opacity:.24,roughness:.12,metalness:.15,depthWrite:false}),wall:material({color:0xe5e0d5,roughness:.94}),concrete:material({color:0xe5e3d9,map:textures.concrete,roughness:.85}),light:material({color:0xffeac4,emissive:0xffd798,emissiveIntensity:1.2})};
function box(g,w,h,d,x,y,z,m){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o;}
function cylinder(g,rt,rb,h,x,y,z,m,n=24){const o=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,n),m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o;}
function sphere(g,r,x,y,z,m,sx=1,sy=1,sz=1){const o=new THREE.Mesh(new THREE.SphereGeometry(r,12,10),m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;g.add(o);return o;}
function furnitureModel(f){
 const g=new THREE.Group(),t=FURN_TYPES[f.type],cloth=new THREE.MeshStandardMaterial({color:f.c,roughness:.93});
 const legs=(w,d,top,h=.7)=>{for(const x of [-w/2+.08,w/2-.08])for(const z of [-d/2+.08,d/2-.08])box(g,.045,h,.045,x,top-h/2,z,mats.metal);};
 if(f.type==='custom'||FURN_ASSETS[f.type]&&assetCache.has('asset_builtin_'+FURN_ASSETS[f.type])){
  const cached=assetCache.get(f.type==='custom'?f.assetId:'asset_builtin_'+FURN_ASSETS[f.type]);
  if(cached){const model=cached.clone(true);model.traverse(o=>{o.userData={assetShared:!!o.isMesh};});g.add(model);g.scale.set(f.w,f.h,f.d);}
  // Modèle encore en cours de chargement : un volume d'attente vaut mieux qu'un objet invisible.
  else{const w=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0xb9bcae,roughness:.95,transparent:true,opacity:.75}));w.position.y=.5;w.castShadow=w.receiveShadow=true;g.add(w);g.scale.set(f.w,f.h,f.d);}
  cloth.dispose();return g;
 }
 switch(f.type){
 case 'table':cylinder(g,.45,.45,.045,0,.727,0,mats.wood,48);cylinder(g,.045,.06,.69,0,.35,0,mats.metal);cylinder(g,.27,.29,.035,0,.018,0,mats.metal);break;
 case 'table2':case 'desk':box(g,t.w,.045,t.d,0,t.h-.023,0,mats.wood);legs(t.w,t.d,t.h-.045,t.h-.045);if(f.type==='desk'){box(g,.46,.29,.025,0,t.h+.23,-.15,mats.black);box(g,.04,.14,.04,0,t.h+.07,-.15,mats.metal);box(g,.28,.014,.1,0,t.h+.008,-.15,mats.metal);box(g,.35,.014,.12,0,t.h+.008,.13,mats.black);}break;
 case 'chair':box(g,.43,.07,.43,0,.45,0,cloth);box(g,.43,.35,.055,0,.675,-.19,cloth);legs(.43,.43,.43,.43);break;
 case 'sofa':box(g,1.8,.2,.8,0,.25,0,cloth);box(g,1.9,.46,.15,0,.57,-.35,cloth);for(const x of [-.88,.88])box(g,.14,.4,.8,x,.48,0,cloth);for(const x of [-.43,.43])box(g,.8,.15,.62,x,.43,.04,cloth);legs(1.8,.72,.2,.2);break;
 case 'counter':box(g,2.94,1.02,.62,0,.51,0,mats.wood);box(g,3,.07,.7,0,1.065,0,mats.white);for(let x=-1.4;x<1.5;x+=.13)box(g,.025,.9,.025,x,.51,.32,mats.wood);box(g,.55,.36,.4,.7,1.31,-.08,mats.metal);cylinder(g,.06,.06,.12,-.6,1.16,.06,mats.white);break;
 case 'booth':box(g,2,.08,1.5,0,.04,0,mats.wood);for(const x of [-.94,.94])box(g,.12,2.2,1.5,x,1.1,0,cloth);box(g,2,2.2,.12,0,1.1,-.69,cloth);box(g,1.76,2.05,.04,0,1.1,.7,mats.glass);for(const x of [-.86,.86])box(g,.05,2.1,.06,x,1.1,.71,mats.metal);box(g,2,.1,1.5,0,2.15,0,mats.black);break;
 case 'stage':box(g,3,.35,2,0,.175,0,mats.black);box(g,3,.05,2,0,.375,0,mats.wood);box(g,1,.17,.35,0,.085,1.15,mats.black);break;
 case 'rack':for(const x of [-.96,.96])box(g,.055,1.8,.4,x,.9,0,mats.metal);for(let y=.07;y<1.81;y+=.43)box(g,2,.04,.4,0,y,0,mats.wood);for(let i=0;i<7;i++)box(g,.07,.28,.24,-.7+i*.13,.66,0,i%2?cloth:mats.cream);break;
 case 'plant':cylinder(g,.22,.15,.4,0,.2,0,mats.pot);cylinder(g,.2,.2,.025,0,.4,0,mats.soil);cylinder(g,.022,.03,.95,0,.86,0,mats.wood);for(let i=0;i<9;i++){const a=i*2.4;const o=sphere(g,.2,Math.sin(a)*.16,.75+i*.07,Math.cos(a)*.16,mats.leaf,.6,1.7,.3);o.rotation.set(.5*Math.cos(a),a,.55*Math.sin(a));}break;
 case 'piano':box(g,1.4,.2,.5,0,.82,0,mats.black);legs(1.3,.4,.72,.72);box(g,1.25,.028,.22,0,.94,.13,mats.white);for(let i=0;i<26;i++)box(g,.023,.02,.13,-.6+i*.047,.964,.085,mats.black);box(g,1.4,.05,.5,0,.99,0,mats.black).scale.z=.2;break;
 case 'machine':box(g,.78,.36,.5,0,.18,0,mats.metal);box(g,.7,.16,.44,0,.44,0,mats.black);for(const x of [-.2,.2]){box(g,.11,.17,.13,x,.14,.2,mats.metal);cylinder(g,.02,.02,.1,x,.03,.24,mats.black,10);}box(g,.62,.03,.28,0,.015,.06,mats.black);cylinder(g,.035,.035,.22,.34,.55,-.05,mats.metal,12);break;
 case 'vitrine':box(g,1.2,.5,.7,0,.25,0,mats.metal);box(g,1.16,.72,.66,0,.88,0,mats.glass);for(const y of [.62,.92])box(g,1.1,.025,.56,0,y,0,mats.white);box(g,1.2,.06,.7,0,1.27,0,mats.metal);box(g,1.16,.05,.06,0,.52,.33,mats.black);break;
 case 'frigo':box(g,.75,1.94,.78,0,.97,0,mats.metal);box(g,.7,.9,.03,0,1.42,.4,mats.glass);box(g,.7,.86,.03,0,.48,.4,mats.metal);for(const y of [1.42,.48])box(g,.04,.5,.05,.3,y,.44,mats.black);box(g,.75,.06,.78,0,.03,0,mats.black);break;
 case 'lave':box(g,.6,.78,.6,0,.39,0,mats.metal);box(g,.5,.46,.03,0,.42,.3,mats.black);box(g,.44,.04,.05,0,.68,.33,mats.metal);box(g,.6,.04,.6,0,.8,0,mats.white);break;
 case 'armoire':box(g,1,1.72,.45,0,.9,0,mats.wood);for(const x of [-.24,.24])box(g,.46,1.6,.02,x,.9,.23,mats.cream);for(const x of [-.03,.03])box(g,.02,.24,.03,x,.95,.25,mats.metal);box(g,1,.08,.45,0,.04,0,mats.black);break;
 case 'caisson':box(g,.42,.5,.6,0,.31,0,mats.metal);for(let i=0;i<3;i++)box(g,.38,.14,.02,0,.14+i*.16,.3,mats.cream);for(const x of [-.14,.14])for(const z of [-.22,.22])cylinder(g,.03,.03,.06,x,.03,z,mats.black,8);break;
 case 'bureauregie':box(g,1.8,.05,.9,0,.72,0,mats.wood);legs(1.8,.9,.7,.7);box(g,1.7,.28,.12,0,.9,-.38,mats.black);for(const x of [-.6,.6])box(g,.5,.02,.36,x,.76,.06,mats.black);box(g,.5,.4,.5,-.72,.2,-.15,mats.metal);break;
 case 'moniteur':box(g,.25,.4,.28,0,.2,0,mats.black);cylinder(g,.08,.08,.02,0,.14,.145,mats.metal,16);cylinder(g,.028,.028,.02,0,.31,.145,mats.metal,12);box(g,.2,.03,.02,0,.36,.145,mats.black);break;
 case 'panneau':box(g,1.16,1.96,.06,0,1,0,cloth);box(g,1.2,.06,.1,0,1.97,0,mats.wood);box(g,1.2,.06,.1,0,.03,0,mats.wood);for(const x of [-.57,.57])box(g,.06,1.9,.1,x,1,0,mats.wood);break;
 case 'tablepodcast':box(g,1.6,.05,.9,0,.715,0,mats.wood);legs(1.5,.8,.69,.69);for(const x of [-.45,.45]){cylinder(g,.025,.03,.34,x,.91,-.1,mats.metal,12);cylinder(g,.022,.022,.24,x,1.12,.06,mats.metal,10);box(g,.07,.07,.12,x,1.19,.16,mats.black);}break;
 case 'fond':for(const x of [-1.1,1.1]){cylinder(g,.028,.04,2.1,x,1.05,0,mats.metal,12);box(g,.5,.04,.5,x,.02,0,mats.metal);}cylinder(g,.055,.055,2.2,0,2.12,0,mats.metal,16);box(g,2.2,1.9,.02,0,1.15,.02,mats.cream);break;
 case 'gradin':for(let i=0;i<3;i++){const d=1.8/3;box(g,4,.4+i*.4,d,0,(.4+i*.4)/2,.9-d/2-i*d,mats.wood);box(g,3.9,.05,d*.9,0,.42+i*.4,.9-d/2-i*d,mats.black);}break;
 case 'regie':box(g,1.6,.05,.8,0,.875,0,mats.black);box(g,1.5,.55,.06,0,.6,-.35,mats.metal);for(const x of [-.72,.72])box(g,.1,.86,.76,x,.44,0,mats.metal);box(g,1.3,.03,.5,0,.9,.05,mats.metal);break;
 case 'socle':box(g,.4,.96,.4,0,.48,0,mats.white);box(g,.44,.04,.44,0,.98,0,mats.white);box(g,.36,.03,.36,0,.015,0,mats.black);break;
 case 'lavabo':box(g,.6,.14,.46,0,.72,0,mats.white);box(g,.44,.06,.3,0,.76,.02,mats.cream);cylinder(g,.03,.03,.16,0,.85,-.16,mats.metal,12);box(g,.14,.02,.1,0,.93,-.11,mats.metal);box(g,.6,.5,.06,0,.44,-.2,mats.cream);break;
 case 'luminaire':cylinder(g,.01,.01,.22,0,.34,0,mats.metal,8);cylinder(g,.2,.08,.2,0,.13,0,mats.black,24);cylinder(g,.055,.055,.07,0,.05,0,mats.light,12);box(g,.09,.02,.09,0,.45,0,mats.metal);break;
 case 'wc':box(g,.08,2.2,1.4,-.76,1.1,0,mats.cream);box(g,1.6,2.2,.08,0,1.1,-.66,mats.cream);box(g,.44,.62,.17,0,.36,-.45,mats.white);sphere(g,.25,0,.33,-.12,mats.white,.88,.5,1.25);cylinder(g,.17,.12,.28,0,.14,-.18,mats.white);break;
 }
 // Dispose the optional upholstery material when unused.
 if(!g.children.some(o=>o.material===cloth))cloth.dispose();
 const bounds=new THREE.Box3().setFromObject(g),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());for(const child of g.children){child.position.x-=center.x;child.position.z-=center.z;child.position.y-=bounds.min.y;}g.scale.set(f.w/size.x,f.h/size.y,f.d/size.z);return g;
}

// Renderer and architectural shell.
const canvas=$('c'),scene=new THREE.Scene(),world=new THREE.Group(),helpers=new THREE.Group(),hoverGroup=new THREE.Group();scene.add(world,helpers,hoverGroup);
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});}catch(e){$('loading').textContent='WebGL indisponible. Activez l’accélération graphique puis rechargez.';throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.88;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.localClippingEnabled=true;
scene.background=new THREE.Color(0xd4d9ce);
const persp=new THREE.PerspectiveCamera(43,1,.05,400),ortho=new THREE.OrthographicCamera(-20,20,20,-20,.1,400);let camera=persp;
const sun=new THREE.DirectionalLight(0xfff3dd,1.5);sun.position.set(-8,25,16);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-30,right:30,top:30,bottom:-30,near:.1,far:90});sun.shadow.bias=-.00025;sun.shadow.normalBias=.03;const hemi=new THREE.HemisphereLight(0xe7efff,0xa2997e,.65);scene.add(sun,hemi);
const fill=new THREE.DirectionalLight(0xd8e5ef,.4);fill.position.set(20,12,-15);scene.add(fill);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(240,240),material({color:0xc9d0c2,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.23;ground.receiveShadow=true;scene.add(ground);
const grid=new THREE.GridHelper(80,80,0x97a58f,0xb4bfac);grid.position.set(-.5,-.215,-.5);grid.material.transparent=true;grid.material.opacity=.48;scene.add(grid);
const clipPlane=new THREE.Plane(new THREE.Vector3(0,-1,0),1.2);
let theta=-.72,phi=.83,dist=44,target=new THREE.Vector3(0,0,0),eye=new THREE.Vector3(18-CX,1.65,6-CZ),yaw=-Math.PI/2,pitch=0;
function cameraProjection(){persp.updateProjectionMatrix();ortho.left=-dist*persp.aspect/2;ortho.right=dist*persp.aspect/2;ortho.top=dist/2;ortho.bottom=-dist/2;ortho.updateProjectionMatrix();}
function resize(){const r=canvas.getBoundingClientRect();renderer.setSize(r.width,r.height,false);persp.aspect=r.width/Math.max(1,r.height);cameraProjection();dirty=true;}
new ResizeObserver(resize).observe($('viewport'));
function updateCamera(){if(view==='interior'){camera=persp;camera.position.copy(eye);camera.lookAt(eye.clone().add(new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch))));}else if(view==='plan'){camera=ortho;camera.position.set(target.x,70,target.z);camera.up.set(0,0,-1);camera.lookAt(target.x,0,target.z);}else{camera=persp;camera.up.set(0,1,0);camera.position.set(target.x+dist*Math.sin(phi)*Math.sin(theta),target.y+dist*Math.cos(phi),target.z+dist*Math.sin(phi)*Math.cos(theta));camera.lookAt(target);}cameraProjection();camera.updateMatrixWorld(true);dirty=true;}
function frame(){stopNavigation();target.set(0,0,0);theta=-.72;phi=.83;dist=view==='plan'?32:Math.max(41,38/Math.max(.6,persp.aspect));eye.set(20-CX,1.65,3.5-CZ);yaw=-Math.PI+.28;pitch=-.12;updateCamera();}
function setView(v){if(view===v)return;stopNavigation();endPointer(true);rememberCamera();view=v;persp.fov=v==='interior'?65:43;
 if(!restoreCamera(v)){cut=v!=='interior';roofOn=v==='interior';frame();}
 $('view3d').classList.toggle('active',v==='3d');$('viewPlan').classList.toggle('active',v==='plan');$('viewInterior').classList.toggle('active',v==='interior');$('sceneCaption').hidden=v!=='3d';$('viewDescription').textContent=v==='plan'?'Projection orthographique · les cotes sont en mètres.':'Volumes, matières et usages à l’échelle.';navigationHint();updateCamera();rebuild();}

function disposeGroup(root){const geometries=new Set(),materials=new Set(),maps=new Set();root.traverse(o=>{if(o.userData.assetShared)return;if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){if(!pool.has(m)){materials.add(m);if(m.map&&!texturePool.has(m.map))maps.add(m.map);}}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());maps.forEach(t=>t.dispose());root.clear();}
function line(points,col=0x506849,parent=helpers){const g=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));const o=new THREE.Line(g,new THREE.LineBasicMaterial({color:col,depthTest:false}));o.renderOrder=3;parent.add(o);return o;}
function label(text,x,y,z,size=2.1){const c=document.createElement('canvas');c.width=512;c.height=96;const ctx=c.getContext('2d');ctx.fillStyle='rgba(241,243,232,.96)';ctx.fillRect(0,0,512,96);ctx.fillStyle='#344631';ctx.font='600 64px Segoe UI';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,48,492);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthTest:false}));s.position.set(x,y,z);s.scale.set(size,size*96/512,1);s.renderOrder=5;helpers.add(s);return s;}
function dimension(a,b,text){line([a,b]);for(const p of[a,b])line([[p[0]-.15,p[1],p[2]-.15],[p[0]+.15,p[1],p[2]+.15]]);label(text,(a[0]+b[0])/2,.23,(a[2]+b[2])/2,3.2);}
function wallModel(w,i){const g=new THREE.Group(),L=wallLength(w);g.position.set((w.x1+w.x2)/2-CX,0,(w.z1+w.z2)/2-CZ);g.rotation.y=-Math.atan2(w.z2-w.z1,w.x2-w.x1);g.userData.pick={kind:'walls',i};
 const m=(w.mat==='vitre'?mats.glass:w.mat==='plein'?mats.concrete:mats.wall).clone();m.clippingPlanes=cut?[clipPlane]:[];m.clipShadows=true;
 const piece=(a,b,y0,y1)=>{if(b-a>.005&&y1-y0>.005)box(g,b-a,y1-y0,w.t,(a+b-L)/2,(y0+y1)/2,0,m);};let cursor=0;
 [...w.op.map((o,oi)=>({...o,oi}))].sort((a,b)=>a.d-b.d).forEach(o=>{const a=o.d-o.w/2,b=o.d+o.w/2;piece(cursor,a,0,w.h);piece(a,b,0,o.sill);piece(a,b,o.sill+o.h,w.h);cursor=b;
  const opening=new THREE.Group();opening.userData.pick={kind:'open',wi:i,oi:o.oi};g.add(opening);opening.position.x=o.d-L/2;
  const frameMat=mats.metal.clone();frameMat.clippingPlanes=cut?[clipPlane]:[];
  for(const x of[-o.w/2+.025,o.w/2-.025])box(opening,.05,o.h+.05,w.t+.035,x,o.sill+o.h/2,0,frameMat);
  box(opening,o.w,.06,w.t+.035,0,o.sill+o.h,0,frameMat);
  const glazed=o.type==='fenetre'||o.type==='baie';const fm=(glazed?mats.glass:mats.wood).clone();fm.clippingPlanes=cut?[clipPlane]:[];
  box(opening,o.w-.09,o.h-.05,.045,0,o.sill+o.h/2,0,fm);
  if(o.type==='double'||o.type==='baie')box(opening,.035,o.h,.06,0,o.sill+o.h/2,0,frameMat);
  if(!glazed){box(opening,.14,.025,.065,o.w/2-.17,1,.055,frameMat);if(o.type==='double')box(opening,.14,.025,.065,-o.w/2+.17,1,.055,frameMat);}
 });piece(cursor,L,0,w.h);
 if(w.mat==='vitre'){for(let d=.05;d<L;d+=2.5){if(w.op.some(o=>Math.abs(o.d-d)<o.w/2))continue;const fm=mats.metal.clone();fm.clippingPlanes=cut?[clipPlane]:[];box(g,.06,w.h,.09,d-L/2,w.h/2,0,fm);}}
 // Actual skirting pieces stop at door openings.
 const skirtingMat=mats.cream;let edge=0;const doors=w.op.filter(o=>o.sill<.12).sort((a,b)=>a.d-b.d);for(const o of [...doors,{d:L,w:0}]){const end=o.d-o.w/2;if(end-edge>.01&&w.mat!=='vitre')box(g,end-edge,.1,w.t+.025,(edge+end-L)/2,.05,0,skirtingMat);edge=o.d+o.w/2;}
 world.add(g);return g;
}
// Une sélection devenue vide (annulation, suppression, import) ne doit jamais atteindre le rendu.
function rebuild(){buildPending=false;if(selection&&!selected())selection=null;manipulationDispose();disposeGroup(world);disposeGroup(helpers);setHover(hovered,true);grid.visible=$('showGrid').checked;$('cut').classList.toggle('active',cut);$('roof').classList.toggle('active',roofOn);
 buildingSlab(-.2,.2,mats.concrete,'Dalle').userData.pick={kind:'slab'};
 buildingColumns().forEach(({x,z,w,d,h},i)=>{const g=new THREE.Group();g.userData.pick={kind:'columns',i};box(g,w,h,d,x-CX,h/2,z-CZ,mats.concrete);box(g,w+.07,.12,d+.07,x-CX,.06,z-CZ,mats.metal);world.add(g);});
 state.zones.forEach((z,i)=>{const tex=textures[z.surface].clone();tex.needsUpdate=true;const metre=1/(SURFACE_SIZE[z.surface]||2);tex.repeat.set(metre,metre);const mat=new THREE.MeshStandardMaterial({color:$('showZoning').checked?z.c:0xffffff,map:$('showZoning').checked?null:tex,roughness:z.surface==='concrete'?.6:.85});if($('showZoning').checked)tex.dispose();const points=Arch.polygon(z),shape=new THREE.Shape(points.map(v=>new THREE.Vector2(v.x-CX,-(v.z-CZ)))),geometry=new THREE.ExtrudeGeometry(shape,{depth:.025,bevelEnabled:false}),f=new THREE.Mesh(geometry,mat);f.rotation.x=-Math.PI/2;f.position.y=.006+i*.0001;f.receiveShadow=true;f.userData.pick={kind:'zones',i};world.add(f);
  if($('showLabels').checked&&view!=='interior')label(z.n+' · '+Arch.area(points).toFixed(1)+' m²',z.x+z.w/2-CX,cut?1.45:H+.3,z.z+z.d/2-CZ,Math.min(z.w,5));
 });
 state.walls.forEach(wallModel);
 state.furniture.forEach((f,i)=>{const g=furnitureModel(f);g.position.set(f.x-CX,f.y+.04,f.z-CZ);g.rotation.y=f.r;g.userData.pick={kind:'furniture',i};g.name=f.n;world.add(g);});
 if(roofOn)buildingRoof();
 const evening=$('lighting').value==='evening',lamps=state.furniture.filter(f=>FURN_TYPES[f.type]?.light).slice(0,LAMP_LIMIT);
 for(const f of lamps){const lamp=new THREE.PointLight(0xffd9a0,evening?1.5:.45,7,2);lamp.position.set(f.x-CX,f.y+f.h*.35,f.z-CZ);world.add(lamp);}
 if($('lampCount'))$('lampCount').textContent=lamps.length?lamps.length+' luminaire(s) actif(s)'+(state.furniture.filter(f=>FURN_TYPES[f.type]?.light).length>LAMP_LIMIT?' sur '+state.furniture.filter(f=>FURN_TYPES[f.type]?.light).length+' — '+LAMP_LIMIT+' maximum éclairent la scène':''):'Aucun luminaire posé.';
 const o=selected();if(o){let bounds;if(selection.kind==='zones')bounds=new THREE.Box3(new THREE.Vector3(o.x-CX,.04,o.z-CZ),new THREE.Vector3(o.x+o.w-CX,.12,o.z+o.d-CZ));else{world.traverse(m=>{if(m.userData.pick&&JSON.stringify(m.userData.pick)===JSON.stringify(selection))bounds=new THREE.Box3().setFromObject(m);});}if(bounds){const helper=new THREE.Box3Helper(bounds,0xb16d35);helper.material.depthTest=false;helper.renderOrder=4;helpers.add(helper);}if(selection.kind==='walls'){for(const [x,z,end] of [[o.x1,o.z1,0],[o.x2,o.z2,1]]){const h=sphere(helpers,.16,x-CX,.2,z-CZ,new THREE.MeshBasicMaterial({color:0xe9b58a}));h.userData.pick={kind:'end',i:selection.i,end};}dimension([o.x1-CX,.15,o.z1-CZ],[o.x2-CX,.15,o.z2-CZ],wallLength(o).toFixed(2)+' m');}}
 if($('showDimensions').checked&&view!=='interior'){const outline=buildingOutline();outline.forEach((p,i)=>{const q=outline[(i+1)%outline.length];dimension([p.x-CX,.13,p.z-CZ],[q.x-CX,.13,q.z-CZ],Arch.distance(p,q).toFixed(2)+' m');});}
 if(measurement){const [a,b]=measurement;dimension([a.x-CX,.25,a.z-CZ],[b.x-CX,.25,b.z-CZ],Math.hypot(b.x-a.x,b.z-a.z).toFixed(2)+' m');}
 if(firstPoint)sphere(helpers,.12,firstPoint.x-CX,.15,firstPoint.z-CZ,new THREE.MeshBasicMaterial({color:0xb77740}));architectureRebuild();manipulationRebuild();equipmentRebuild();roomRebuild();circulationRender();dirty=true;
}
function requestBuild(){buildPending=true;dirty=true;}

// Inspector values are committed atomically through the same validator as imports.
function field(key,title,value,type='number',step='.05'){if(type==='number'&&Number.isFinite(value))value=+value.toFixed(3);return `<label>${title}<input data-field="${key}" type="${type}" value="${esc(value)}" ${type==='number'?`step="${step}"`:''}></label>`;}
function selectField(key,title,value,choices){return `<label class="wide">${title}<select data-field="${key}">${Object.entries(choices).map(([k,n])=>`<option value="${k}" ${value===k?'selected':''}>${n}</option>`).join('')}</select></label>`;}
function properties(){const o=selected(),p=$('properties');p.innerHTML='';$('emptySelection').hidden=!!o;if(typeof Workspace!=='undefined')Workspace.followSelection(o?selection:null);$('selectionTitle').textContent=o?(o.n|| (selection.kind==='walls'?'Mur '+(selection.i+1):selection.kind==='columns'?'Poteau '+(selection.i+1):OPEN_TYPES[o.type]?.n)):'Votre espace de travail';if(!o)return;
 let html='<div class="fields">';
 if(selection.kind==='zones')html+=field('n','Nom',o.n,'text')+field('c','Couleur du zonage',o.c,'color')+(o.vertices?'':field('x','Position X · m',o.x)+field('z','Position Z · m',o.z)+field('w','Largeur · m',o.w)+field('d','Profondeur · m',o.d))+selectField('surface','Revêtement',o.surface,SURFACES)+`<label class="wide">Notes<textarea data-field="t">${esc(o.t)}</textarea></label>`;
 if(selection.kind==='walls')html+=selectField('mat','Construction',o.mat,{plein:'Béton',cloison:'Cloison claire',vitre:'Façade vitrée'})+field('t','Épaisseur · m',o.t)+field('h','Hauteur · m',o.h)+field('x1','Départ X · m',o.x1)+field('z1','Départ Z · m',o.z1)+field('x2','Arrivée X · m',o.x2)+field('z2','Arrivée Z · m',o.z2);
 if(selection.kind==='columns')html+=field('x','Position X · m',o.x)+field('z','Position Z · m',o.z)+field('w','Largeur · m',o.w)+field('d','Profondeur · m',o.d)+field('h','Hauteur · m',o.h);
 if(selection.kind==='open')html+=field('w','Largeur · m',o.w)+field('h','Hauteur · m',o.h)+field('sill','Allège · m',o.sill)+field('d','Depuis le début du mur · m',o.d);
 if(selection.kind==='furniture')html+=field('n','Nom',o.n,'text')+(['booth','rack'].includes(o.type)?field('c','Tissu / éléments colorés',o.c,'color'):'')+field('x','Position X · m',o.x)+field('z','Position Z · m',o.z)+field('y','Élévation · m',o.y)+field('degrees','Rotation · °',+(o.r*180/Math.PI).toFixed(1),'number','1')+field('w','Largeur · m',o.w)+field('d','Profondeur · m',o.d)+field('h','Hauteur totale · m',o.h);
 html+='</div>';
 if(selection.kind==='walls')html+='<h3>Ouvertures</h3>'+Object.entries(OPEN_TYPES).map(([k,t])=>`<button data-opening="${k}">＋ ${t.n}</button>`).join('')+o.op.map((a,oi)=>`<button data-open-select="${oi}">${OPEN_TYPES[a.type].n} · ${a.w.toFixed(2)} m</button>`).join('');
 if(selection.kind==='open')html+='<button id="parentWall">← Sélectionner le mur</button>';
 html+='<h3>Actions</h3>'+(selection.kind!=='open'?'<button id="duplicate">Dupliquer</button>':'')+'<button id="deleteSelection" class="danger">Supprimer</button>';
 p.innerHTML=html;
 p.querySelectorAll('[data-field]').forEach(el=>el.onchange=()=>{const s=clone(selection);commit(()=>{const k=el.dataset.field;const obj=s.kind==='open'?state.walls[s.wi].op[s.oi]:collection(s.kind)[s.i];if(s.kind==='furniture'){editFurnitureProperty(k,el.type==='number'?(el.value.trim()===''?NaN:Number(el.value)):el.value);return;}if(k==='degrees')obj.r=Number(el.value)*Math.PI/180;else obj[k]=el.type==='number'?(el.value.trim()===''?NaN:Number(el.value)):el.value;});});
 p.querySelectorAll('[data-opening]').forEach(b=>b.onclick=()=>addOpening(b.dataset.opening));
 p.querySelectorAll('[data-open-select]').forEach(b=>b.onclick=()=>select({kind:'open',wi:selection.i,oi:+b.dataset.openSelect}));
 if($('parentWall'))$('parentWall').onclick=()=>select({kind:'walls',i:selection.wi});
 if($('duplicate'))$('duplicate').onclick=duplicate;
 $('deleteSelection').onclick=removeSelection;architectureProperties();roomProperties();manipulationProperties();equipmentProperties();buildingProperties();
}
function addOpening(type){commit(()=>{const w=selected(),t=OPEN_TYPES[type],L=wallLength(w);if(!w?.op)return;const intervals=[...w.op].sort((a,b)=>a.d-b.d);let start=.05,center=null;for(const a of [...intervals,{d:L+.05,w:0}]){const end=a.d-a.w/2-.05;if(end-start>=t.w){center=start+t.w/2;break;}start=a.d+a.w/2+.05;}if(center===null)throw Error('Pas assez de place sur ce mur.');const sill=t.sill,h=Math.min(t.h,w.h-sill);w.op.push({type,w:t.w,h,sill,d:center});selection={kind:'open',wi:selection.i,oi:w.op.length-1};});}
function removeSelection(){if(deleteFurniture())return;if(!selected())return;commit(()=>{if(selection.kind==='open')state.walls[selection.wi].op.splice(selection.oi,1);else collection(selection.kind).splice(selection.i,1);selection=null;});}
function duplicate(){if(duplicateFurniture())return;const o=selected();if(!o||selection.kind==='open')return;commit(()=>{const n=clone(o);if(selection.kind==='walls'){n.x1+=.5;n.x2+=.5;n.n1=uid();n.n2=uid();}else if(selection.kind==='columns'){n.x+=.5;n.z+=.5;}else{n.x+=.5;n.z+=.5;n.n+=' · copie';if(n.vertices)n.vertices=n.vertices.map(v=>({x:v.x+.5,z:v.z+.5}));delete n.nodes;}collection(selection.kind).push(n);selection={kind:selection.kind,i:collection(selection.kind).length-1};});}
function unionInside(zones){return Arch.unionArea(zones.map(Arch.polygon),buildingOutline());}
function footprint(f){const c=Math.cos(f.r),s=Math.sin(f.r);return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>({x:f.x+x*f.w/2*c+z*f.d/2*s,z:f.z-x*f.w/2*s+z*f.d/2*c}));}
function checks(){const out=state.zones.filter(z=>Arch.area(Arch.polygon(z))-Arch.overlapArea(Arch.polygon(z),buildingOutline())>.001),over=[];state.zones.forEach((a,i)=>state.zones.slice(i+1).forEach(b=>{const area=Arch.overlapArea(Arch.polygon(a),Arch.polygon(b));if(area>.01)over.push(`${a.n} / ${b.n} : ${area.toFixed(1)} m²`);}));const outsideObjects=state.furniture.filter(f=>Arch.area(footprint(f))-Arch.overlapArea(footprint(f),buildingOutline())>.001),coverage=unionInside(state.zones),msgs=[];
 const strayColumns=buildingColumns().filter(c=>!rectInside({x:c.x-c.w/2,z:c.z-c.d/2,w:c.w,d:c.d}));
 if(strayColumns.length)msgs.push(`${strayColumns.length} poteau(x) débordent de l’emprise.`);
 if(out.length)msgs.push(`${out.length} pièce(s) sortent de l’emprise en L.`);if(over.length)msgs.push('Chevauchement de zones : '+over.join(' ; '));if(outsideObjects.length)msgs.push(`${outsideObjects.length} objet(s) débordent de l’emprise.`);
 $('checks').innerHTML=(msgs.length?msgs.map(m=>`<div class="check-result warn">△ ${esc(m)}</div>`).join(''):'<div class="check-result">✓ Pièces, poteaux et objets dans l’emprise, sans chevauchement.</div>')+equipmentChecks()+'<p class="note">Contrôles d’implantation indicatifs ; dimensions et contraintes du bâtiment à confirmer.</p>';
 $('areas').textContent=`${coverage.toFixed(1)} m² couverts sans double comptage · ${(Arch.area(buildingOutline())-coverage).toFixed(1)} m² hors zonage.`;architectureChecks();circulationChecks();
}
function refresh(){rebuild();$('projectName').value=state.meta.name;$('undo').disabled=!undoStack.length;$('redo').disabled=!redoStack.length;
 $('zoneList').innerHTML=state.zones.map((z,i)=>`<button class="item ${selection?.kind==='zones'&&selection.i===i?'selected':''}" data-zone="${i}"><span class="swatch" style="background:${z.c}"></span><span class="name">${esc(z.n)}</span><small>${Arch.area(Arch.polygon(z)).toFixed(1)} m²</small></button>`).join('');$('zoneList').querySelectorAll('button').forEach(b=>b.onclick=()=>select({kind:'zones',i:+b.dataset.zone}));
 $('wallList').innerHTML=state.walls.map((w,i)=>`<button class="item" data-wall="${i}"><span class="name">Mur ${i+1} · ${w.mat==='vitre'?'vitrage':w.mat==='cloison'?'cloison':'béton'}</span><small>${wallLength(w).toFixed(2)} m</small></button>`).join('');$('wallList').querySelectorAll('button').forEach(b=>b.onclick=()=>select({kind:'walls',i:+b.dataset.wall}));
 properties();checks();buildingRefresh();projectRefresh();$('counts').textContent=`${state.zones.length} espaces · ${state.walls.length} murs · ${state.furniture.length} objets`;
}
function catalogDraft(type){const t=FURN_TYPES[type],s=catalogSize(type);
 return {type,n:t.n,w:s.w,h:s.h,d:s.d,y:t.y??0,front:'+z',mount:t.mount||'sol',c:'#'+t.c.toString(16).padStart(6,'0'),...(t.bespoke?{bespoke:true}:{})};}
function catalog(){const q=$('search').value.toLowerCase(),found=Object.entries(FURN_TYPES).filter(([k,t])=>(t.n+' '+FURN_CATEGORIES[t.cat]).toLowerCase().includes(q));
 $('furnitureList').innerHTML=Object.entries(FURN_CATEGORIES).map(([cat,title])=>{const items=found.filter(([k,t])=>t.cat===cat);return items.length?`<div class="section-title">${esc(title)}</div>`+items.map(([k,t])=>{const s=catalogSize(k);return `<button data-furn="${k}">${esc(t.n)}<small>${s.w.toFixed(2)} × ${s.d.toFixed(2)} m${s.native?' · modèle détaillé':''}</small></button>`;}).join(''):'';}).join('')||'<p class="note">Aucun objet ne correspond à cette recherche.</p>';
 $('furnitureList').querySelectorAll('button').forEach(b=>b.onclick=()=>{startCatalogPlacement(b.dataset.furn);});}
function demo(){if(state.furniture.some(f=>f.n.includes('[proposition]'))){notify('La proposition est déjà présente. Vous pouvez modifier ou supprimer ses objets.');return;}commit(()=>{
  const put=(type,x,z,r=0)=>state.furniture.push({type,x,z,r,n:FURN_TYPES[type].n+' [proposition]',...(FURN_TYPES[type].bespoke?{bespoke:true}:{})});
  for(const z of[2,5.8,9.6])for(const x of[16.5,19.5]){put('table',x,z);put('chair',x-.7,z,Math.PI/2);put('chair',x+.7,z,-Math.PI/2);}
  put('counter',18,14.4);put('plant',20.4,1);put('plant',20.4,14.3);put('sofa',18.15,17.2);put('rack',16,19,Math.PI/2);put('rack',20,19,Math.PI/2);
  put('desk',2.4,3);put('chair',2.4,4,Math.PI);put('piano',2.2,5.9);put('booth',4.7,1.2);put('rack',.5,4,Math.PI/2);
  put('table2',3.2,9.3);put('chair',2.2,9.3,Math.PI/2);put('chair',4.2,9.3,-Math.PI/2);put('plant',.6,10.8);
  put('stage',12.3,5.5);for(const z of[8,9.5])for(const x of[11,12.3,13.6])put('chair',x,z);
  put('desk',1.5,12.7);put('chair',1.5,13.5,Math.PI);put('desk',5,12.7);put('chair',5,13.5,Math.PI);put('wc',7.7,6.6);put('counter',18,23.8);
  state.zones.forEach(z=>z.surface=/studio|podcast/i.test(z.n)?'carpet':/thé|publishing/i.test(z.n)?'oak':/cuisine|sanitaires/i.test(z.n)?'tile':'concrete');selection=null;
 });notify('Proposition ajoutée : mobilier et revêtements modifiables. Annuler pour la retirer.');}

// Pointer interactions. A click never changes coordinates or fills the undo stack.
const ray=new THREE.Raycaster(),mouse=new THREE.Vector2();
function cast(e){const r=canvas.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(mouse,camera);}
// Un objet posé en hauteur se déplace dans son propre plan : sinon le curseur et le meuble
// divergent d'autant plus que la vue est rasante.
const dragPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
function planePoint(e,y=0){cast(e);dragPlane.constant=-y;const p=ray.ray.intersectPlane(dragPlane,new THREE.Vector3());return p?{x:p.x+CX,z:p.z+CZ}:null;}
function floorPoint(e){return planePoint(e,0);}
// Un objet déjà sélectionné garde la priorité sous le curseur, mais seulement à profondeur
// comparable : un poteau noyé dans un mur redevient attrapable sans qu'un sol sélectionné
// vole les clics sur les meubles posés dessus.
const samePick=(a,b)=>!!a&&!!b&&a.kind===b.kind&&a.i===b.i&&a.wi===b.wi&&a.oi===b.oi;
const PICK_TOLERANCE=.6;
// Une poignée est dessinée pour être saisie : elle passe avant le corps de l'objet, sinon le
// sol d'un espace sélectionné vole les clics destinés à ses propres poignées.
const HANDLE_KINDS=new Set(['room','end','vertex','rotate']);
// Un poteau noyé dans une cloison est touché juste derrière la face du mur : il passe avant
// ce mur, sinon il faudrait le chercher dans la liste pour pouvoir le saisir.
const WALL_KINDS=new Set(['walls','open']);
function choosePick(hits,current=selection){let nearest=null,preferred=null,column=null;
 for(const h of hits){
  if(HANDLE_KINDS.has(h.data.kind))return h.data;
  if(!nearest)nearest=h;
  if(!preferred&&samePick(h.data,current))preferred=h;
  if(!column&&h.data.kind==='columns')column=h;
 }
 if(!nearest)return null;
 if(column&&WALL_KINDS.has(nearest.data.kind)&&column.dist-nearest.dist<=PICK_TOLERANCE)return column.data;
 if(preferred&&preferred.dist-nearest.dist<=PICK_TOLERANCE)return preferred.data;
 return nearest.data;
}
// Survol : le curseur et un contour bleu montrent ce qui se saisit avant le clic. Le contour vit
// dans son propre groupe, pour ne jamais reconstruire la scène à chaque mouvement de souris.
let hovered=null,hoverKey='',hoverEvent=null,hoverScheduled=false;
const HOVER_COLOR=0x3f8fe0,GRAB_KINDS=new Set(['furniture','walls','columns','zones','open']);
function hoverOutline(h){
 if(h?.kind==='furniture'){const f=state.furniture[h.i];return f&&{pts:Arch.footprint(f),y:f.y+.1};}
 if(h?.kind==='walls'){const w=state.walls[h.i];return w&&{pts:Arch.wallRect(w),y:.14};}
 if(h?.kind==='columns'){const c=buildingColumns()[h.i];return c&&{pts:[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>({x:c.x+a*c.w/2,z:c.z+b*c.d/2})),y:.14};}
 if(h?.kind==='zones'){const z=state.zones[h.i];return z&&{pts:Arch.polygon(z),y:.08};}
 return null;}
function setHover(h,force=false){const key=h?JSON.stringify(h):'';if(key===hoverKey&&!force)return;hovered=h;hoverKey=key;
 for(const o of [...hoverGroup.children]){o.geometry.dispose();o.material.dispose();hoverGroup.remove(o);}
 const o=h&&!samePick(h,selection)?hoverOutline(h):null;
 if(o)line([...o.pts,o.pts[0]].map(v=>[v.x-CX,o.y,v.z-CZ]),HOVER_COLOR,hoverGroup);
 dirty=true;}
function cursorFor(h){
 if(tool==='navigate')return 'grab';if(tool!=='select')return 'crosshair';if(view==='interior'||!h)return 'default';
 if(HANDLE_KINDS.has(h.kind))return h.kind==='room'&&h.mode==='resize'?'nwse-resize':'move';
 if(h.kind==='furniture'&&state.furniture[h.i]?.locked)return 'not-allowed';
 return GRAB_KINDS.has(h.kind)?'grab':'default';}
function hoverAt(e){hoverEvent=e;if(hoverScheduled)return;hoverScheduled=true;
 requestAnimationFrame(()=>{hoverScheduled=false;if(pointer||busy||roomDragState||rotationDrag)return;
  let h=tool==='select'&&view!=='interior'&&hoverEvent?pick(hoverEvent):null;if(h?.kind==='slab')h=null;
  setHover(h);canvas.style.cursor=cursorFor(h);});}
// La coupe à 1,20 m est un plan de découpe : la section d'un mur n'a pas de face, le rayon la
// traverse jusqu'au sol. On retrouve donc le mur coupé par sa trace à la hauteur de coupe, avec
// une marge de quelques pixels pour qu'une cloison fine reste attrapable en plan.
const CUT_HEIGHT=1.2;
function cutWallAt(q,tolerance){let best=null;
 state.walls.forEach((w,i)=>{if(w.h<CUT_HEIGHT)return;const L=wallLength(w);if(L<1e-6)return;
  const t=((q.x-w.x1)*(w.x2-w.x1)+(q.z-w.z1)*(w.z2-w.z1))/(L*L),d=Math.max(0,Math.min(1,t))*L;
  const gap=Math.hypot(q.x-(w.x1+(w.x2-w.x1)*d/L),q.z-(w.z1+(w.z2-w.z1)*d/L))-w.t/2;
  if(gap>tolerance||t<-.02||t>1.02||best&&gap>=best.gap)return;
  const oi=w.op.findIndex(o=>Math.abs(o.d-d)<=o.w/2);
  best={gap,data:oi>=0?{kind:'open',wi:i,oi}:{kind:'walls',i}};});
 return best?.data||null;}
function pick(e){cast(e);const hits=[];
 for(const h of ray.intersectObjects([...helpers.children,...world.children],true)){
  if(h.object.isSprite||h.object.isLine)continue;
  let o=h.object,data;while(o){if(o.userData.pick){data=o.userData.pick;break;}o=o.parent;}
  if(!data)continue;if(cut&&(data.kind==='walls'||data.kind==='open')&&h.point.y>CUT_HEIGHT)continue;
  hits.push({data,dist:h.distance});
  if(HANDLE_KINDS.has(data.kind))break;
 }
 if(cut&&view!=='interior'){const q=planePoint(e,CUT_HEIGHT);
  const tolerance=view==='plan'?Math.max(.05,7*dist/Math.max(1,canvas.clientHeight)):.05;
  const data=q&&cutWallAt(q,tolerance);
  if(data){hits.push({data,dist:ray.ray.origin.distanceTo(new THREE.Vector3(q.x-CX,CUT_HEIGHT,q.z-CZ))});hits.sort((a,b)=>a.dist-b.dist);}}
 return choosePick(hits);
}
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerleave',()=>{hoverEvent=null;if(!pointer){setHover(null);canvas.style.cursor=cursorFor(null);}});
canvas.addEventListener('dblclick',e=>{if(busy||tool!=='select')return;const hit=pick(e);if(hit&&hit.kind!=='slab')return;const p=floorPoint(e);if(p)createRoomAt(p);});
canvas.addEventListener('pointerdown',e=>{if(busy||e.button>2)return;stopNavigation();canvas.focus();const p=floorPoint(e),navGesture=e.button!==0||e.altKey||e.shiftKey||tool==='navigate';if(manipulationPointerDown(e,p))return;if(!navGesture&&architecturePointerDown(e,p))return;if(!navGesture&&tool!=='select'&&e.button===0){if(!p)return;const point=nearbyPoint(p);
 if(!firstPoint){firstPoint=point;rebuild();notify('Cliquez le deuxième point. Échap pour annuler.');return;}
 if(tool==='measure'){measurement=[firstPoint,point];notify('Distance au sol : '+Math.hypot(point.x-firstPoint.x,point.z-firstPoint.z).toFixed(2)+' m');setTool('select');return;}
 if(tool==='wall'){const a=firstPoint;commit(()=>{state.walls.push({...DW(a.x,a.z,point.x,point.z,'cloison',.15),n1:nodeAt(a),n2:nodeAt(point),axis:Math.abs(a.z-point.z)<.0001?'x':Math.abs(a.x-point.x)<.0001?'z':'free'});selection={kind:'walls',i:state.walls.length-1};});setTool('select');return;}}
 const hit=!navGesture?pick(e):null;
 if(hit?.kind==='slab'){selection=null;roomFloorClick(p);refresh();return;}
 if(hit?.kind==='room'&&p){selection={kind:'zones',i:hit.i};if(roomPointerDown(hit,p)){canvas.setPointerCapture(e.pointerId);refresh();return;}}
 if(hit?.kind==='furniture'){chooseFurniture(hit.i);}else if(hit?.kind==='end')selection={kind:'walls',i:hit.i};else if(hit?.kind==='vertex')selection={kind:'zones',i:hit.i};else if(hit)selection=hit;else if(!navGesture)selection=null;
 const planeY=hit?.kind==='furniture'?state.furniture[hit.i]?.y||0:0;
 pointer={id:e.pointerId,startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY,point:planeY?planePoint(e,planeY):p,planeY,b:e.button,pan:e.button===1||e.button===2||e.shiftKey||tool==='navigate',hit:view==='interior'||hit?.kind==='furniture'&&selected()?.locked?null:hit,ids:hit?.kind==='furniture'?furnitureIndices():[],roomIds:hit?.kind==='zones'&&roomCarry?roomContents(state.zones[hit.i]):null,before:snapshot(),original:clone(selected()),moved:false};canvas.setPointerCapture(e.pointerId);setHover(null);canvas.style.cursor='grabbing';refresh();
});
canvas.addEventListener('pointermove',e=>{if(roomDragState){const q=planePoint(e,0);if(q)roomDragMove(q);return;}if(manipulationPointerMove(e))return;architecturePointerMove(e);if(!pointer){hoverAt(e);return;}const d=pointer;const dx=e.clientX-d.lastX,dy=e.clientY-d.lastY;d.lastX=e.clientX;d.lastY=e.clientY;if(Math.hypot(e.clientX-d.startX,e.clientY-d.startY)>4)d.moved=true;if(!d.moved)return;
 if(!d.hit){
  if(view==='interior'){yaw+=dx*.004;pitch=Math.max(-1.3,Math.min(1.3,pitch-dy*.004));}else if(d.pan||view==='plan'){panCamera(dx,dy);}else{theta-=dx*.006;phi=Math.max(.08,Math.min(1.5,phi-dy*.006));}updateCamera();return;}
 const p=planePoint(e,d.planeY||0),a=d.original;state=JSON.parse(d.before);const o=selected();if(!p||!d.point||!o)return;const x=snap(p.x-d.point.x),z=snap(p.z-d.point.z);
 if(d.hit.kind==='vertex'){o.vertices[d.hit.vi]=nearbyPoint(p);Object.assign(o,Arch.bounds(o.vertices));}
 else if(d.hit.kind==='end'){const q=nearbyPoint(p);o[d.hit.end?'x2':'x1']=q.x;o[d.hit.end?'z2':'z1']=q.z;}
 else if(selection.kind==='furniture'){if(d.ids.some(i=>state.furniture[i].locked)){notify('Groupe verrouillé.');return;}transformFurniture(d.ids,JSON.parse(d.before),x,z);}
 else if(selection.kind==='zones'){roomTranslate(o,a.x+x-o.x,a.z+z-o.z,d.roomIds,JSON.parse(d.before));}
 else if(selection.kind==='walls'){o.x1=a.x1+x;o.x2=a.x2+x;o.z1=a.z1+z;o.z2=a.z2+z;}
 else if(selection.kind==='columns'){o.x=+(a.x+x).toFixed(4);o.z=+(a.z+z).toFixed(4);}
 else if(selection.kind==='open'){const w=state.walls[selection.wi],L=wallLength(w);o.d=Math.max(o.w/2,Math.min(L-o.w/2,snap(((p.x-w.x1)*(w.x2-w.x1)+(p.z-w.z1)*(w.z2-w.z1))/L)));}
 try{isolateEdit(JSON.parse(d.before),state);Arch.propagate(JSON.parse(d.before),state);state=validate(state);d.error=null;}catch(e){d.error=e.message;state=JSON.parse(d.before);}requestBuild();
});
function endPointer(cancel=false){endRotation(cancel);roomDragEnd(cancel);canvas.style.cursor=cursorFor(null);if(!pointer)return;const d=pointer;pointer=null;if(d.hit&&d.moved){try{if(cancel)state=JSON.parse(d.before);else{if(d.error)throw Error(d.error);state=validate(state);record(d.before);}}catch(e){state=JSON.parse(d.before);notify(e.message+' Déplacement annulé.');}refresh();}}
canvas.addEventListener('pointerup',()=>endPointer());canvas.addEventListener('pointercancel',()=>endPointer(true));
canvas.addEventListener('wheel',navigationWheel,{passive:false});
addEventListener('keydown',e=>{if(editingText(e.target)||busy||document.querySelector?.('dialog[open]'))return;if(manipulationKey(e))return;if(e.key==='Enter'&&tool==='polygon'){e.preventDefault();finishPolygon();return;}if(e.key==='Escape'){stopNavigation();architectureCancel();endPointer(true);setTool('select');notify('Outil annulé.');return;}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();historyStep(e.shiftKey);return;}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();historyStep(true);return;}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){e.preventDefault();duplicate();return;}if(e.key==='Delete'){removeSelection();return;}navigationKeyDown(e);});

// Embedded GLB only: a project must not fetch arbitrary external dependencies.
function glbBuffer(data){const bytes=atob(data.split(',')[1]);return Uint8Array.from(bytes,c=>c.charCodeAt(0)).buffer;}
function inspectGlb(buffer){const v=new DataView(buffer);if(v.byteLength<20||v.getUint32(0,true)!==0x46546c67||v.getUint32(4,true)!==2||v.getUint32(8,true)!==v.byteLength)throw Error('Fichier GLB 2.0 invalide.');const len=v.getUint32(12,true);if(v.getUint32(16,true)!==0x4e4f534a||len+20>v.byteLength)throw Error('Structure GLB invalide.');const json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,len)).trim());if((json.extensionsRequired||[]).some(e=>['KHR_draco_mesh_compression','KHR_texture_basisu','EXT_meshopt_compression'].includes(e)))throw Error('GLB compressé non pris en charge : exportez sans Draco, KTX2 ou Meshopt.');for(const resource of [...json.buffers||[],...json.images||[]])if(resource.uri&&!resource.uri.startsWith('data:'))throw Error('Les textures et ressources doivent être intégrées au GLB.');return json;}
async function parseAsset(asset){const buffer=glbBuffer(await assetData(asset));inspectGlb(buffer);const manager=new THREE.LoadingManager();manager.setURLModifier(url=>{if(url.startsWith('blob:')||url.startsWith('data:'))return url;throw Error('Ressource externe interdite : utilisez un GLB autonome.');});const gltf=await new Promise((resolve,reject)=>new THREE.GLTFLoader(manager).parse(buffer,'',resolve,reject));const model=gltf.scene;model.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());if(size.x<.001||size.y<.001||size.z<.001)throw Error('Le modèle doit contenir un volume 3D non vide.');let triangles=0;model.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;o.castShadow=o.receiveShadow=true;}if(o.isLight||o.isCamera)o.visible=false;});if(triangles>500000)throw Error('Modèle trop dense : maximum 500 000 triangles.');const root=new THREE.Group();model.position.x-=center.x;model.position.y-=bounds.min.y;model.position.z-=center.z;root.add(model);root.scale.set(1/size.x,1/size.y,1/size.z);const normalized=new THREE.Group();normalized.add(root);normalized.userData.originalSize=size;return {model:normalized,size};}
function releaseAsset(model){model.traverse(o=>{o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose();}});}
async function loadAssets(s){const results=new Map();try{for(const [id,a] of Object.entries(s.assets)){if(assetCache.has(id)&&state.assets[id]?.data===a.data&&state.assets[id]?.builtin===a.builtin)results.set(id,assetCache.get(id));else results.set(id,(await parseAsset(a)).model);}return results;}catch(e){for(const [id,m] of results)if(m!==assetCache.get(id))releaseAsset(m);throw e;}}
let downloadURL=null;
function download(blob,name){
 if(downloadURL)URL.revokeObjectURL(downloadURL);downloadURL=URL.createObjectURL(blob);
 let panel=$('downloadReady');if(!panel){panel=document.createElement('div');panel.id='downloadReady';panel.className='download-ready';$('viewport').appendChild(panel);}panel.replaceChildren();
 const a=document.createElement('a');a.href=downloadURL;a.download=name;a.textContent='↓ Télécharger '+name;panel.appendChild(a);
 const close=document.createElement('button');close.textContent='×';close.title='Fermer';close.onclick=()=>{panel.remove();URL.revokeObjectURL(downloadURL);downloadURL=null;};panel.appendChild(close);
}

function fileName(ext){return 'HubFivesCail_'+state.meta.name.replace(/[^a-z0-9_-]+/gi,'_')+'_r'+String(state.meta.revision||0).padStart(3,'0')+'.'+ext;}
// Chaque export porte son numéro de révision : deux fichiers d'une même étude restent distinguables.
async function exportJson(){commit(()=>{state.meta.revision=(state.meta.revision||0)+1;state.meta.exported=new Date().toISOString().slice(0,10);});const project=clone(state);for(const asset of Object.values(project.assets)){if(asset.builtin){asset.data=await assetData(asset);}}download(new Blob([JSON.stringify(project,null,2)],{type:'application/json'}),fileName('json'));notify('Projet prêt en révision '+project.meta.revision+'. Cliquez sur le lien de téléchargement.');}
async function importJson(file){if(!file)return;if(file.size>150*1024*1024){notify('Projet trop volumineux (150 Mo maximum).');return;}busy=true;try{const raw=JSON.parse(await file.text());if(raw.zones&&!raw.walls)raw.walls=clone(DEFAULT_STATE.walls);if(!raw.furniture)raw.furniture=[];const candidate=validate(raw);for(const id of Object.keys(candidate.assets)){if(state.assets[id]&&(state.assets[id].data!==candidate.assets[id].data||state.assets[id].builtin!==candidate.assets[id].builtin)){const next=id+'_'+Date.now();candidate.assets[next]=candidate.assets[id];delete candidate.assets[id];candidate.furniture.forEach(f=>{if(f.assetId===id)f.assetId=next;});}}const assets=await loadAssets(candidate),before=snapshot();await backupBeforeReplace('l’import de « '+file.name+' »');for(const [id,m] of assets)assetCache.set(id,m);state=candidate;selection=null;record(before);refresh();notify('Projet importé. Votre travail précédent est dans la copie de secours (Fichiers & exports).');}catch(e){notify('Import refusé : '+e.message);}finally{busy=false;}}
async function importGlb(file){if(!file)return;if(!/\.glb$/i.test(file.name)||file.size>12*1024*1024){notify('Choisissez un GLB de moins de 12 Mo.');return;}busy=true;try{const data=await new Promise((res,rej)=>{const reader=new FileReader();reader.onload=()=>res(reader.result);reader.onerror=rej;reader.readAsDataURL(file);});const asset={name:file.name.replace(/\.glb$/i,''),data:'data:application/octet-stream;base64,'+data.split(',')[1]},result=await parseAsset(asset),id='asset_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);busy=false;assetCache.set(id,result.model);beginPlacement({type:'custom',assetId:id,n:asset.name,r:0,y:0,w:Math.min(30,result.size.x),h:Math.min(15,result.size.y),d:Math.min(30,result.size.z)},{key:id,value:asset});notify('Modèle importé aux dimensions du fichier. Déplacez le curseur puis cliquez pour le poser.');}catch(e){notify('Import GLB refusé : '+e.message);}finally{busy=false;}}
async function exportGlb(){if(busy)return;busy=true;const prevCut=cut,prevSelection=selection,prevZoning=$('showZoning').checked;try{
 cut=false;selection=null;$('showZoning').checked=false;rebuild();
 const result=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Délai d’export dépassé. Essayez avec moins d’objets.')),30000);try{new THREE.GLTFExporter().parse(world,result=>{clearTimeout(timer);resolve(result);},{binary:true,onlyVisible:true});}catch(e){clearTimeout(timer);reject(e);}});
 download(new Blob([result],{type:'model/gltf-binary'}),fileName('glb'));notify('GLB prêt à télécharger : échelle métrique, murs complets.');
 }catch(e){notify('Export GLB impossible : '+e.message);}finally{cut=prevCut;selection=prevSelection;$('showZoning').checked=prevZoning;busy=false;refresh();}}
function exportPng(){renderer.render(scene,camera);canvas.toBlob(blob=>{if(blob)download(blob,fileName('png'));else notify('Capture impossible.');},'image/png');}
function lighting(){const mood=$('lighting').value,evening=mood==='evening';
 sun.color.set(evening?0x9db4d6:mood==='warm'?0xffcf92:0xfff3dd);
 sun.intensity=evening?.18:mood==='studio'?1.1:1.5;
 fill.intensity=evening?.12:mood==='studio'?.8:.4;
 hemi.intensity=evening?.18:.65;hemi.color.set(evening?0x5d6f8c:0xe7efff);
 sun.position.set(mood==='warm'?-25:-8,mood==='warm'?12:25,16);
 scene.background.set(evening?0x26303a:0xd4d9ce);
 renderer.toneMappingExposure=evening?1.1:mood==='warm'?.95:.88;
 rebuild();}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(t=>{t.classList.toggle('active',t===b);$('tab-'+t.dataset.tab).hidden=t!==b;});});
$('undo').onclick=()=>historyStep();$('redo').onclick=()=>historyStep(true);$('projectName').onchange=()=>commit(()=>state.meta.name=$('projectName').value.trim()||'Étude Fives Cail');
$('addZone').onclick=()=>commit(()=>{state.zones.push({n:'Nouvel espace',c:'#b8c499',x:6.5,z:0,w:3,d:3,t:''});selection={kind:'zones',i:state.zones.length-1};});
$('drawWall').onclick=()=>{setTool(tool==='wall'?'select':'wall');if(tool==='wall'){setView('plan');notify('Cliquez le premier point du mur.');}};
$('selectTool').onclick=()=>setTool('select');$('measureTool').onclick=()=>{setTool('measure');notify('Cliquez deux points au sol pour mesurer.');};$('search').oninput=catalog;
$('view3d').onclick=()=>setView('3d');$('viewPlan').onclick=()=>setView('plan');$('viewInterior').onclick=()=>{setView('interior');notify('Flèches / ZQSD : marcher · glisser : regarder · Maj : accélérer. Visite libre sans collision.');};$('frame').onclick=frame;
$('cut').onclick=()=>{cut=!cut;if(cut)roofOn=false;rebuild();};$('roof').onclick=()=>{roofOn=!roofOn;rebuild();};
for(const id of['showLabels','showGrid','showDimensions','showZoning'])$(id).onchange=rebuild;
$('lighting').onchange=lighting;$('demo').onclick=demo;$('demoShortcut').onclick=demo;$('createRoomHere').onclick=()=>createRoomAt(lastFloorPoint);
$('reset').onclick=async()=>{if(busy||!confirm('Revenir à l’étude initiale ? Votre maquette actuelle sera mise dans la copie de secours, récupérable depuis « Fichiers & exports ».'))return;try{await backupBeforeReplace('le retour à l’étude initiale');}catch(e){notify(e.message);return;}commit(()=>{state=validate(DEFAULT_STATE);selection=null;notify('Étude initiale restaurée. Votre travail précédent est dans la copie de secours (Fichiers & exports).');});};
$('exportJson').onclick=exportJson;$('exportGlb').onclick=exportGlb;$('exportPng').onclick=exportPng;
$('importJson').onclick=()=>$('jsonFile').click();$('importGlb').onclick=()=>$('glbFile').click();
$('jsonFile').onchange=e=>{importJson(e.target.files[0]);e.target.value='';};$('glbFile').onchange=e=>{importGlb(e.target.files[0]);e.target.value='';};
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();$('loading').hidden=false;$('loading').textContent='Contexte graphique perdu. Exportez votre JSON puis rechargez la page.';});
addEventListener('error',e=>{if(e.message){$('status').textContent='Erreur : '+e.message;console.error(e.error);}});
async function init(){busy=true;let migrated=false,shared=false;try{const stored=await loadProject();if(stored){shared=stored.source==='partage';const candidate=validate(JSON.parse(stored.raw));state=candidate;migrated=stored.source==='localstorage';
   loadAssets(candidate).then(loaded=>{for(const [id,m] of loaded)assetCache.set(id,m);requestBuild();}).catch(e=>notify('Modèles du projet indisponibles : '+e.message));}}catch(e){notify('Sauvegarde non chargée : '+e.message+' Le fichier original reste disponible.');}
 preloadFurniture().then(()=>{if(!busy)rebuild();}).catch(e=>notify('Certains modèles détaillés sont indisponibles : '+e.message));
 busy=false;if(typeof Workspace!=='undefined')Workspace.setup();architectureSetup();setupNavigation();manipulationSetup();buildingSetup();circulationSetup();projectSetup();catalog();resize();frame();refresh();$('loading').hidden=true;$('status').textContent=shared?'Projet partagé du dépôt · vos modifications restent sur ce poste':migrated?'Sauvegarde reprise et transférée vers le stockage étendu':'Prêt · vos modifications sont sauvegardées sur cet appareil';if(migrated)persist();
 let lastFrame=0;function loop(now=0){requestAnimationFrame(loop);const dt=lastFrame?Math.min((now-lastFrame)/1000,.05):0;lastFrame=now;navigationStep(dt);if(buildPending)rebuild();if(dirty){renderer.render(scene,camera);dirty=false;}}loop();}
if(typeof AtelierCloud!=='undefined')AtelierCloud.boot();else init();
