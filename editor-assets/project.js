'use strict';
// Lot D — conserver. Sauvegarde locale en IndexedDB (les projets avec modèles intégrés dépassent
// le quota de localStorage), variantes d'implantation comparables, et vues de caméra mémorisées
// dans le projet. localStorage reste le filet de secours et la source de migration.
const DB_NAME='hub_fives_cail_atelier',DB_STORE='projets',MAX_VARIANTS=8,MAX_VIEWS=12;
let dbHandle=null,dbBroken=false;
// Une ouverture peut rester en attente indéfiniment (autre onglet en cours de mise à jour,
// suppression de base en cours) : sans délai, le chargement de l'atelier ne se terminerait jamais.
const DB_TIMEOUT=4000;
const projectStorageKey=()=>typeof AtelierCloud!=='undefined'?AtelierCloud.storageKey():'courant';
const projectLocalKey=key=>typeof AtelierCloud!=='undefined'?AtelierCloud.localKey(key):key;
const withTimeout=(promise,ms,fallback)=>Promise.race([promise,new Promise(resolve=>setTimeout(()=>resolve(fallback),ms))]);
function openProjectDb(){
 if(dbBroken||!globalThis.indexedDB)return Promise.resolve(null);
 if(dbHandle)return Promise.resolve(dbHandle);
 return withTimeout(new Promise(resolve=>{let request;
  try{request=indexedDB.open(DB_NAME,1);}catch(e){dbBroken=true;resolve(null);return;}
  request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(DB_STORE))db.createObjectStore(DB_STORE);};
  request.onsuccess=()=>{dbHandle=request.result;dbHandle.onversionchange=()=>{dbHandle.close();dbHandle=null;};resolve(dbHandle);};
  request.onerror=()=>{dbBroken=true;resolve(null);};
  request.onblocked=()=>resolve(null);}),DB_TIMEOUT,null);}
function dbPut(key,value){return withTimeout(openProjectDb().then(db=>db&&new Promise((resolve,reject)=>{
 const tx=db.transaction(DB_STORE,'readwrite');tx.objectStore(DB_STORE).put(value,key);
 tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error||Error('Écriture refusée.'));tx.onabort=()=>reject(tx.error||Error('Écriture interrompue.'));})),DB_TIMEOUT,null);}
function dbGet(key){return openProjectDb().then(db=>db&&new Promise(resolve=>{
 const tx=db.transaction(DB_STORE,'readonly'),request=tx.objectStore(DB_STORE).get(key);
 request.onsuccess=()=>resolve(request.result??null);request.onerror=()=>resolve(null);}));}

// Écriture différée : un glissement ne doit pas déclencher une transaction par image.
let persistTimer=null,persistPending=null;
function persistProject(){
 persistPending={payload:snapshot(),key:projectStorageKey(),localKey:projectLocalKey(KEY)};
 if(persistTimer)return;
 persistTimer=setTimeout(()=>{persistTimer=null;const {payload,key,localKey}=persistPending;persistPending=null;
  dbPut(key,payload).then(ok=>{
   if(ok){saved=true;$('status').textContent='● Sauvegardé sur cet appareil';try{localStorage.setItem(localKey,'{"movedTo":"indexeddb"}');}catch(e){}return;}
   try{localStorage.setItem(localKey,payload);saved=true;$('status').textContent='● Sauvegardé sur cet appareil (stockage simple)';}
   catch(e){saved=false;$('status').textContent='● Sauvegarde locale impossible — exportez le JSON';}
  }).catch(()=>{try{localStorage.setItem(localKey,payload);saved=true;$('status').textContent='● Sauvegardé sur cet appareil (stockage simple)';}
   catch(e){saved=false;$('status').textContent='● Sauvegarde locale saturée — exportez le JSON';}});
 },400);}
// Projet partagé : le fichier projet.json versionné à côté de la page sert de point de départ
// commun. Chacun travaille ensuite sur sa copie locale ; republier passe par le dépôt.
const SHARED_PROJECT='projet.json';
async function fetchSharedProject(){
 if(!globalThis.fetch||location.protocol==='file:')return null;
 try{const response=await fetch(SHARED_PROJECT,{cache:'no-store'});
  if(!response.ok)return null;
  const raw=await response.text();
  JSON.parse(raw);return raw;}catch(e){return null;}}
async function loadProject(){
 const stored=await withTimeout(dbGet(projectStorageKey()).catch(()=>null),DB_TIMEOUT,null);
 if(typeof stored==='string'&&stored.length>2)return {raw:stored,source:'indexeddb'};
 let local=null;try{local=localStorage.getItem(projectLocalKey(KEY))||localStorage.getItem(projectLocalKey(LEGACY));}catch(e){}
 if(local&&!local.includes('"movedTo"'))return {raw:local,source:'localstorage'};
 if(typeof AtelierCloud!=='undefined'&&AtelierCloud.configured()){const cloud=await AtelierCloud.initialProject();if(cloud)return cloud;}
 const shared=await fetchSharedProject();
 if(shared)return {raw:shared,source:'partage'};
 return null;}
async function reloadSharedProject(){
 if(busy)return;
 const raw=await fetchSharedProject();
 if(!raw){notify('Aucun projet partagé publié à côté de l’application.');return;}
 busy=true;
 try{const candidate=validate(JSON.parse(raw)),assets=await loadAssets(candidate),before=snapshot();
  for(const [id,m] of assets)assetCache.set(id,m);
  state=candidate;selection=null;record(before);refresh();
  notify('Projet partagé du dépôt chargé en révision '+(state.meta.revision||0)+'. Annuler revient à votre version.');}
 catch(e){notify('Projet partagé illisible : '+e.message);}finally{busy=false;}}
async function exportSharedProject(){
 const project=clone(state);
 for(const asset of Object.values(project.assets))if(asset.builtin)asset.data=await assetData(asset);
 download(new Blob([JSON.stringify(project,null,2)],{type:'application/json'}),SHARED_PROJECT);
 notify('projet.json prêt. Déposez-le à la racine du dépôt pour le partager avec vos associés.');}

// --- Variantes d'implantation -------------------------------------------------
// Une variante fige le mobilier et son zonage, pas le bâti : on compare des aménagements
// d'un même local. Les ressources GLB restent partagées par le projet.
function variantSnapshot(name){return {id:'var_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6),
 n:String(name||'Variante').slice(0,80),date:new Date().toISOString().slice(0,10),
 furniture:clone(state.furniture),zones:clone(state.zones)};}
function variantMetrics(v){const scene={...state,furniture:v.furniture,zones:v.zones};
 const report=Arch.collisions(scene,state.clearance??.6);
 return {objects:v.furniture.length,bespoke:v.furniture.filter(f=>f.bespoke).length,
  hard:report.hard.length,doors:report.doors.length,clear:report.clear.length,
  area:v.furniture.reduce((n,f)=>n+f.w*f.d,0)};}
function saveLayoutVariant(name){commit(()=>{state.variants=[...(state.variants||[]),variantSnapshot(name)].slice(-MAX_VARIANTS);});}
function applyLayoutVariant(id){const v=(state.variants||[]).find(x=>x.id===id);if(!v)return;
 commit(()=>{state.furniture=clone(v.furniture);state.zones=clone(v.zones);selection=null;});
 notify('Variante « '+v.n+' » appliquée. Annuler revient à l’implantation précédente.');}
function deleteLayoutVariant(id){commit(()=>{state.variants=(state.variants||[]).filter(v=>v.id!==id);});}
function compareVariants(){const list=state.variants||[];
 const current={n:'Implantation courante',date:'',furniture:state.furniture,zones:state.zones};
 const rows=[current,...list].map(v=>({n:v.n,date:v.date,m:variantMetrics(v)}));
 return `<table class="compare"><thead><tr><th>Implantation</th><th>Objets</th><th>Sur mesure</th><th>Collisions</th><th>Portes</th><th>Emprise m²</th></tr></thead><tbody>`
  +rows.map(r=>`<tr><td>${esc(r.n)}${r.date?'<small> · '+r.date+'</small>':''}</td><td>${r.m.objects}</td><td>${r.m.bespoke}</td><td class="${r.m.hard?'bad':''}">${r.m.hard}</td><td class="${r.m.doors?'bad':''}">${r.m.doors}</td><td>${r.m.area.toFixed(1)}</td></tr>`).join('')
  +'</tbody></table><p class="note">Comparaison des encombrements et des contrôles implémentés. Le bâti et les ressources ne sont pas dupliqués : une variante ne fige que le mobilier et le zonage.</p>';}

// --- Vues de caméra mémorisées ------------------------------------------------
function captureView(name){return {id:'view_'+Date.now().toString(36),n:String(name||'Vue').slice(0,80),mode:view,
 target:[+target.x.toFixed(3),+target.y.toFixed(3),+target.z.toFixed(3)],eye:[+eye.x.toFixed(3),+eye.y.toFixed(3),+eye.z.toFixed(3)],
 theta:+theta.toFixed(4),phi:+phi.toFixed(4),dist:+dist.toFixed(3),yaw:+yaw.toFixed(4),pitch:+pitch.toFixed(4),cut,roof:roofOn};}
function saveNamedView(name){commit(()=>{state.views=[...(state.views||[]),captureView(name)].slice(-MAX_VIEWS);});}
function restoreView(id){const v=(state.views||[]).find(x=>x.id===id);if(!v)return;
 stopNavigation();endPointer(true);
 if(view!==v.mode)setView(v.mode);
 target.set(...v.target);eye.set(...v.eye);theta=v.theta;phi=v.phi;dist=v.dist;yaw=v.yaw;pitch=v.pitch;cut=v.cut;roofOn=v.roof;
 rememberCamera();updateCamera();rebuild();notify('Vue « '+v.n+' » restaurée.');}
function deleteView(id){commit(()=>{state.views=(state.views||[]).filter(v=>v.id!==id);});}

function validateVariants(list){if(!Array.isArray(list))return [];
 if(list.length>MAX_VARIANTS)throw Error('Maximum '+MAX_VARIANTS+' variantes par projet.');
 return list.map(v=>({id:String(v.id||'var_'+Math.random().toString(36).slice(2,8)).slice(0,60),
  n:String(v.n||'Variante').slice(0,80),date:String(v.date||'').slice(0,10),
  furniture:(v.furniture||[]).slice(0,500).map(clone),zones:(v.zones||[]).slice(0,150).map(clone)}));}
function validateViews(list){if(!Array.isArray(list))return [];
 if(list.length>MAX_VIEWS)throw Error('Maximum '+MAX_VIEWS+' vues par projet.');
 // Une valeur nulle est une valeur, pas une absence : seuls null, undefined et NaN prennent le défaut.
 const fallback=(v,d)=>Number.isFinite(+v)?+v:d;
 const trio=(v,min,max,label)=>{const a=Array.isArray(v)?v:[0,0,0];return a.slice(0,3).map(n=>num(fallback(n,0),min,max,label));};
 return list.map(v=>({id:String(v.id||'view_'+Math.random().toString(36).slice(2,8)).slice(0,60),
  n:String(v.n||'Vue').slice(0,80),mode:['3d','plan','interior'].includes(v.mode)?v.mode:'3d',
  target:trio(v.target,-200,200,'Cible de vue'),eye:trio(v.eye,-200,200,'Position de vue'),
  theta:num(fallback(v.theta,0),-100,100,'Orientation'),phi:num(fallback(v.phi,.8),.01,3.14,'Inclinaison'),
  dist:num(fallback(v.dist,30),.5,400,'Distance'),yaw:num(fallback(v.yaw,0),-100,100,'Cap'),pitch:num(fallback(v.pitch,0),-2,2,'Tangage'),
  cut:v.cut!==false,roof:!!v.roof}));}

function projectRefresh(){
 if(!$('variantList'))return;
 const variants=state.variants||[],views=state.views||[];
 $('variantList').innerHTML=variants.length?variants.map(v=>`<div class="row"><button class="item" data-variant="${esc(v.id)}"><span class="name">${esc(v.n)}</span><small>${v.furniture.length} objets · ${esc(v.date)}</small></button><button data-variant-del="${esc(v.id)}" class="danger" title="Supprimer">×</button></div>`).join('')
  :'<p class="note">Aucune variante enregistrée.</p>';
 $('variantList').querySelectorAll('[data-variant]').forEach(b=>b.onclick=()=>applyLayoutVariant(b.dataset.variant));
 $('variantList').querySelectorAll('[data-variant-del]').forEach(b=>b.onclick=()=>deleteLayoutVariant(b.dataset.variantDel));
 $('viewList').innerHTML=views.length?views.map(v=>`<div class="row"><button class="item" data-view="${esc(v.id)}"><span class="name">${esc(v.n)}</span><small>${v.mode==='plan'?'plan':v.mode==='interior'?'intérieur':'perspective'}</small></button><button data-view-del="${esc(v.id)}" class="danger" title="Supprimer">×</button></div>`).join('')
  :'<p class="note">Aucune vue enregistrée.</p>';
 $('viewList').querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>restoreView(b.dataset.view));
 $('viewList').querySelectorAll('[data-view-del]').forEach(b=>b.onclick=()=>deleteView(b.dataset.viewDel));
 if($('variantCompare').open)$('compareTable').innerHTML=compareVariants();}

function projectSetup(){
 $('panel-selection').insertAdjacentHTML('beforeend','<details id="variantCompare"><summary>Variantes &amp; vues</summary>'
  +'<div class="section-title">VARIANTES D’IMPLANTATION <button id="saveVariant">＋ Figer</button></div><div id="variantList"></div>'
  +'<div id="compareTable"></div>'
  +'<div class="section-title">VUES MÉMORISÉES <button id="saveView">＋ Cadrage</button></div><div id="viewList"></div>'
  +'<p class="note">Une variante fige le mobilier et le zonage courants ; une vue mémorise le cadrage. Les deux sont enregistrés dans le projet et suivent l’export JSON.</p></details>');
 $('saveVariant').onclick=()=>{const name=prompt('Nom de la variante','Implantation '+((state.variants||[]).length+1));if(name!==null)saveLayoutVariant(name.trim()||'Variante');};
 $('saveView').onclick=()=>{const name=prompt('Nom de la vue','Vue '+((state.views||[]).length+1));if(name!==null)saveNamedView(name.trim()||'Vue');};
 $('variantCompare').addEventListener('toggle',()=>{if($('variantCompare').open)$('compareTable').innerHTML=compareVariants();});
 if(typeof AtelierCloud==='undefined'){$('panel-selection').insertAdjacentHTML('beforeend','<details><summary>Projet partagé</summary>'
  +'<button id="publishShared">Préparer projet.json pour le dépôt</button>'
  +'<button id="reloadShared">Recharger le projet du dépôt</button>'
  +'<p class="note">L’application repart du fichier <code>projet.json</code> publié à côté d’elle. Vos modifications restent sur votre poste tant que ce fichier n’est pas remplacé dans le dépôt : préparez-le, déposez-le, chacun le recharge.</p></details>');
 $('publishShared').onclick=exportSharedProject;
 $('reloadShared').onclick=reloadSharedProject;}
 projectRefresh();}
