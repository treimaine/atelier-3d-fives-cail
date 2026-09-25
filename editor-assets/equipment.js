'use strict';
// Lot C — objets fidèles : face avant, point de pose, surfaces de support, variantes.
// La face avant est une convention locale : +Z est l'avant des objets paramétriques.
const FRONT_AXES={'+z':{n:'Avant du modèle (+Z)',a:0},'+x':{n:'Côté droit (+X)',a:Math.PI/2},'-z':{n:'Arrière du modèle (−Z)',a:Math.PI},'-x':{n:'Côté gauche (−X)',a:-Math.PI/2}};
function frontOf(f){return FRONT_AXES[f.front]?f.front:'+z';}
function frontAngle(f){return (f.r||0)+FRONT_AXES[frontOf(f)].a;}
function frontVector(f){const a=frontAngle(f);return {x:Math.sin(a),z:Math.cos(a)};}
function frontReach(f){const k=frontOf(f);return k==='+z'||k==='-z'?f.d/2:f.w/2;}
function furnitureById(id,source=state){return source.furniture.find(f=>f.id===id)||null;}

// Un objet posé sur un plateau suit son support, ainsi que tout ce qui repose sur lui.
function supportedBy(ids,source=state){const out=[...ids];for(let n=0;n<out.length;n++){const parent=source.furniture[out[n]];if(!parent)continue;source.furniture.forEach((f,i)=>{if(f.support&&f.support===parent.id&&!out.includes(i))out.push(i);});}return out;}
function supportChainIds(i,source=state){return supportedBy([i],source).map(n=>source.furniture[n].id);}
function supportCandidates(i){const f=state.furniture[i];if(!f)return [];const banned=new Set(supportChainIds(i));
 return state.furniture.map((s,j)=>({s,j})).filter(({s,j})=>j!==i&&!banned.has(s.id)&&canHost(s)&&Arch.contains(Arch.footprint(s),{x:f.x,z:f.z}));}
// Support sous le curseur : la surface de pose la plus haute qui couvre le point. `ignore` écarte
// l'objet déplacé et tout ce qui repose sur lui (un meuble ne se pose pas sur son propre contenu).
function supportAt(p,ignore=null){let best=null;const skip=ignore instanceof Set?ignore:new Set(ignore?[ignore]:[]);
 for(const s of state.furniture){if(skip.has(s.id)||!canHost(s))continue;if(!Arch.contains(Arch.footprint(s),p))continue;
  const top=surfaceTop(s);if(!best||top>best.top)best={s,top};}
 return best;}
// Aimantation murale : dos contre le parement le plus proche, face avant vers la pièce, centré sur
// la portion de mur disponible. Les ouvertures que l'objet masquerait sont évitées.
function wallSnap(f,p,reach=1.2){let best=null;const side=frontOf(f)==='+z'||frontOf(f)==='-z',span=side?f.w:f.d,depth=side?f.d:f.w;
 for(const w of state.walls){const dx=w.x2-w.x1,dz=w.z2-w.z1,L=Math.hypot(dx,dz);if(L<span+.02)continue;const ux=dx/L,uz=dz/L;
  const along=(p.x-w.x1)*ux+(p.z-w.z1)*uz,off=-(p.x-w.x1)*uz+(p.z-w.z1)*ux,gap=Math.abs(off)-w.t/2;
  if(gap>reach||along<-.4||along>L+.4)continue;const d=Math.max(span/2,Math.min(L-span/2,along));
  if(f.y<(w.h??H)&&(w.op||[]).some(o=>Math.abs(o.d-d)<o.w/2+span/2&&f.y<o.sill+o.h&&f.y+f.h>o.sill))continue;
  if(best&&gap>=best.gap)continue;const sgn=off>=0?1:-1,nx=-uz*sgn,nz=ux*sgn,push=w.t/2+depth/2+.004;
  best={gap,x:w.x1+ux*d+nx*push,z:w.z1+uz*d+nz*push,nx,nz};}
 if(!best)return null;return {x:+best.x.toFixed(4),z:+best.z.toFixed(4),r:Math.atan2(best.nx,best.nz)-FRONT_AXES[frontOf(f)].a};}
// Glisser un objet : un objet mural suit les murs, un objet de plateau se pose sur le meuble survolé,
// et redescend au sol quand il le quitte.
function dragSnap(i,p){const f=state.furniture[i];if(!f||f.locked)return;const mount=mountOf(f);
 if(mount==='mur'){const s=wallSnap(f,{x:p?.x??f.x,z:p?.z??f.z});if(s){f.x=s.x;f.z=s.z;f.r=s.r;}return;}
 if(mount==='plafond')return;
 const chain=new Set(supportChainIds(i)),host=mount==='support'||f.support?supportAt({x:f.x,z:f.z},chain):null;
 if(host){f.support=host.s.id;f.y=+Math.min(20,host.top).toFixed(4);}
 else if(f.support){delete f.support;f.y=FURN_TYPES[f.type]?.y??0;}}
function setSupport(i,id){commit(()=>{requireUnlocked([i]);const f=state.furniture[i];if(!id){delete f.support;return;}const s=furnitureById(id);if(!s)throw Error('Support introuvable.');f.support=id;f.y=Math.min(20,surfaceTop(s));});}

// Orienter la face avant à l'opposé du mur le plus proche.
function nearestWallNormal(f){let best=null;
 for(const w of state.walls){const dx=w.x2-w.x1,dz=w.z2-w.z1,L2=dx*dx+dz*dz;if(L2<1e-9)continue;
  const t=Math.max(0,Math.min(1,((f.x-w.x1)*dx+(f.z-w.z1)*dz)/L2)),q={x:w.x1+dx*t,z:w.z1+dz*t},dist=Arch.distance({x:f.x,z:f.z},q);
  if(!best||dist<best.dist)best={dist,q,w};}
 if(!best)return null;
 let nx=f.x-best.q.x,nz=f.z-best.q.z,len=Math.hypot(nx,nz);
 if(len<.001){const dx=best.w.x2-best.w.x1,dz=best.w.z2-best.w.z1,L=Math.hypot(dx,dz);nx=-dz/L;nz=dx/L;len=1;}
 return {x:nx/len,z:nz/len,dist:best.dist};}
function orientToWall(){const ids=furnitureIndices();if(!ids.length)return;commit(()=>{requireUnlocked(ids);
 for(const i of ids){const f=state.furniture[i],n=nearestWallNormal(f);if(!n)throw Error('Aucun mur dans le projet.');f.r=Math.atan2(n.x,n.z)-FRONT_AXES[frontOf(f)].a;}});}

// Changer de variante conserve le point de pose : centre, élévation, support et rotation.
function furnitureVariants(f){const list=[];
 if(f.type!=='custom')list.push({key:'type:'+f.type,n:'Paramétrique · '+(FURN_TYPES[f.type]?.n||f.type),current:true});
 else if(FURN_TYPES[f.lastType])list.push({key:'type:'+f.lastType,n:'Paramétrique · '+FURN_TYPES[f.lastType].n,current:false});
 for(const [id,m] of Object.entries(BUNDLED_MODELS))list.push({key:'builtin:'+id,n:'Détaillé · '+m.name,current:f.type==='custom'&&f.assetId==='asset_builtin_'+id});
 if(f.type==='custom'&&!/^asset_builtin_/.test(f.assetId||''))list.push({key:'asset:'+f.assetId,n:'Importé · '+(state.assets[f.assetId]?.name||'modèle'),current:true});
 return list;}
async function applyVariant(i,key){if(busy)return;if(!state.furniture[i])return;const before={...state.furniture[i]};
 // Un nom laissé par défaut suit la variante ; un nom saisi par l'utilisateur est conservé.
 const defaultName=before.type==='custom'?state.assets[before.assetId]?.name:FURN_TYPES[before.type]?.n;
 const renamed=before.n!==defaultName;
 const keep=f=>{f.x=before.x;f.z=before.z;f.y=before.y;f.r=before.r;f.front=before.front;if(renamed)f.n=before.n;
  if(before.ref)f.ref=before.ref;if(before.bespoke)f.bespoke=before.bespoke;if(before.support)f.support=before.support;};
 if(key.startsWith('type:')){const type=key.slice(5),s=catalogSize(type);
  commit(()=>{const f=state.furniture[i];requireUnlocked([i]);delete f.assetId;delete f.lastType;Object.assign(f,{type,n:FURN_TYPES[type].n,w:s.w,h:s.h,d:s.d,lockAspect:true});keep(f);});return;}
 const id=key.startsWith('builtin:')?key.slice(8):null,assetKey=id?'asset_builtin_'+id:key.slice(6);
 busy=true;notify('Chargement de la variante…');
 try{let model=assetCache.get(assetKey);
  if(!model){const result=await parseAsset(id?builtinAsset(id):state.assets[assetKey]);result.model.userData.originalSize=result.size;assetCache.set(assetKey,result.model);model=result.model;}
  const size=model.userData.originalSize;busy=false;
  commit(()=>{const f=state.furniture[i];requireUnlocked([i]);if(id)state.assets[assetKey]=builtinAsset(id);
   if(f.type!=='custom')f.lastType=f.type;
   Object.assign(f,{type:'custom',assetId:assetKey,n:state.assets[assetKey]?.name||f.n,w:size.x,h:size.y,d:size.z,lockAspect:true});keep(f);});
  notify('Variante appliquée aux dimensions du modèle ; le point de pose est inchangé.');
 }catch(e){notify('Variante indisponible : '+e.message);}finally{busy=false;}}

function equipmentProperties(){if(selection?.kind!=='furniture')return;const o=selected(),i=selection.i,ids=furnitureIndices();
 const supports=supportCandidates(i),parent=o.support?furnitureById(o.support):null,source=o.type==='custom'?state.assets[o.assetId]:null;
 const supportOptions=supports.map(({s})=>`<option value="${esc(s.id)}" ${o.support===s.id?'selected':''}>${esc(s.n)} · plateau à ${surfaceTop(s).toFixed(2)} m</option>`).join('')
  +(parent&&!supports.some(({s})=>s.id===parent.id)?`<option value="${esc(parent.id)}" selected>${esc(parent.n)}</option>`:'');
 $('properties').insertAdjacentHTML('beforeend',
  '<h3>Objet &amp; provenance</h3>'
  +`<label class="check"><input id="bespokeObject" type="checkbox" ${o.bespoke?'checked':''}> Élément sur mesure (à fabriquer)</label>`
  +`<label class="field">${o.bespoke?'Descriptif / atelier':'Référence fabricant'}<input id="objectRef" type="text" maxlength="120" value="${esc(o.ref||'')}" placeholder="${o.bespoke?'ex. comptoir chêne, menuiserie à consulter':'à renseigner après consultation'}"></label>`
  +`<p class="note">${o.type==='custom'?esc(source?.credit||'Modèle importé.'):'Gabarit d’étude paramétrique'} · ${o.w.toFixed(2)} × ${o.d.toFixed(2)} × ${o.h.toFixed(2)} m. Les cotes du catalogue sont des gabarits d’étude, pas des cotes fabricant.</p>`
  +'<h3>Face avant &amp; point de pose</h3>'
  +`<label class="field">Face avant<select id="objectFront">${Object.entries(FRONT_AXES).map(([k,v])=>`<option value="${k}" ${frontOf(o)===k?'selected':''}>${v.n}</option>`).join('')}</select></label>`
  +'<button id="orientWall">Dos au mur le plus proche</button>'
  +`<label class="field">Posé sur<select id="objectSupport"><option value="">Sol · élévation libre</option>${supportOptions}</select></label>`
  +`<p class="note">${parent?'Suit '+esc(parent.n)+' : déplacement, rotation et hauteur du plateau. Sortir de l’emprise du support le détache.':'Élévation réglée à la main dans les dimensions ci-dessus.'}</p>`
  +'<h3>Variante</h3>'
  +`<select id="objectVariant">${furnitureVariants(o).map(v=>`<option value="${esc(v.key)}" ${v.current?'selected':''}>${esc(v.n)}</option>`).join('')}</select>`
  +'<p class="note">Changer de variante reprend les dimensions du modèle choisi sans déplacer le point de pose.</p>');
 $('bespokeObject').onchange=()=>commit(()=>{requireUnlocked(ids);ids.forEach(n=>state.furniture[n].bespoke=$('bespokeObject').checked);});
 $('objectRef').onchange=()=>commit(()=>{requireUnlocked(ids);const v=$('objectRef').value.trim();ids.forEach(n=>state.furniture[n].ref=v);});
 $('objectFront').onchange=()=>commit(()=>{requireUnlocked(ids);const v=$('objectFront').value;ids.forEach(n=>state.furniture[n].front=v);});
 $('orientWall').onclick=orientToWall;
 $('objectSupport').onchange=()=>setSupport(i,$('objectSupport').value);
 $('objectVariant').onchange=()=>applyVariant(i,$('objectVariant').value);
}
function equipmentRebuild(){
 const marks=[];
 if(selection?.kind==='furniture'&&!placementDraft)for(const i of furnitureIndices())marks.push(state.furniture[i]);
 if(placementDraft&&placementPoint)marks.push({...placementDraft,...placementPoint});
 for(const f of marks){const v=frontVector(f),reach=frontReach(f),y=f.y+.07,side=Math.min(.3,Math.max(f.w,f.d)/4);
  const nose={x:f.x+v.x*(reach+.24),z:f.z+v.z*(reach+.24)},base={x:f.x+v.x*reach,z:f.z+v.z*reach};
  line([[base.x-CX-v.z*side,y,base.z-CZ+v.x*side],[nose.x-CX,y,nose.z-CZ],[base.x-CX+v.z*side,y,base.z-CZ-v.x*side]],0x2f6f8f);}
 // Le lien est visible depuis les deux bouts : l'objet posé comme le meuble porteur.
 if(selection?.kind==='furniture')for(const i of furnitureIndices()){const f=state.furniture[i];
  const s=f.support?furnitureById(f.support):null;
  if(s)line([[f.x-CX,f.y+.02,f.z-CZ],[s.x-CX,surfaceTop(s)+.02,s.z-CZ]],0x8a6bbd);
  for(const c of state.furniture)if(c.support===f.id)line([[c.x-CX,c.y+.02,c.z-CZ],[f.x-CX,surfaceTop(f)+.02,f.z-CZ]],0x8a6bbd);}
}
function equipmentChecks(){const bespoke=state.furniture.filter(f=>f.bespoke),undocumented=bespoke.filter(f=>!f.ref),stacked=state.furniture.filter(f=>f.support);
 return `<div class="check-result">${state.furniture.length} objet(s) · ${bespoke.length} sur mesure · ${stacked.length} posé(s) sur un support</div>`
  +(undocumented.length?`<div class="check-result">· ${undocumented.length} élément(s) sur mesure à décrire — champ « Descriptif / atelier » de l’inspecteur</div>`:'');}
