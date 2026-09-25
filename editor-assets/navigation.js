'use strict';
// Camera controls are separate from model edits and never enter project history.
const navigationKeys=new Set(), cameraViews=new Map();
let navigationSpeed=1, navigationShift=false;
const movementKeys=new Set(['arrowup','arrowdown','arrowleft','arrowright','z','q','s','d','w','a','j','l','i','k','+','=','-','pageup','pagedown']);
function editingText(el){return !!el?.matches?.('input,textarea,select,[contenteditable=""],[contenteditable="true"]')||!!el?.isContentEditable;}
function stopNavigation(){navigationKeys.clear();navigationShift=false;}
function rememberCamera(){cameraViews.set(view,{target:target.clone(),eye:eye.clone(),theta,phi,dist,yaw,pitch,cut,roofOn});}
function restoreCamera(v){const c=cameraViews.get(v);if(!c)return false;target.copy(c.target);eye.copy(c.eye);({theta,phi,dist,yaw,pitch,cut,roofOn}=c);return true;}
function navigationHint(){const el=$('navigationHint');if(!el)return;el.textContent=view==='interior'?'Flèches / ZQSD : marcher · glisser : regarder · Maj : accélérer':view==='plan'?'Flèches / ZQSD : déplacer · molette : zoom au pointeur':'Flèches / ZQSD : déplacer · J/L/I/K : tourner · +/− : zoom';}
// Visite intérieure : les murs et les poteaux arrêtent le visiteur, les portes le laissent passer.
// Le déplacement glisse le long d'une paroi plutôt que de s'y bloquer. Touche G : passe-muraille.
const WALK_RADIUS=.22;let walkThrough=false;
function walkBlocked(x,z){if(walkThrough)return false;const p={x:x+CX,z:z+CZ};
 for(const w of state.walls){const dx=w.x2-w.x1,dz=w.z2-w.z1,L=Math.hypot(dx,dz);if(L<.01)continue;
  const along=((p.x-w.x1)*dx+(p.z-w.z1)*dz)/L,t=Math.max(0,Math.min(L,along)),qx=w.x1+dx*t/L,qz=w.z1+dz*t/L;
  if(Math.hypot(p.x-qx,p.z-qz)>=w.t/2+WALK_RADIUS)continue;
  if((w.op||[]).some(o=>o.sill<.15&&o.h>=1.8&&Math.abs(along-o.d)<o.w/2-.12))continue;return true;}
 for(const c of buildingColumns())if(Math.abs(p.x-c.x)<c.w/2+WALK_RADIUS&&Math.abs(p.z-c.z)<c.d/2+WALK_RADIUS)return true;
 return false;}
function walkTo(nx,nz){const stuck=walkBlocked(eye.x,eye.z);
 if(stuck||!walkBlocked(nx,nz)){eye.x=nx;eye.z=nz;return;}
 if(!walkBlocked(nx,eye.z))eye.x=nx;else if(!walkBlocked(eye.x,nz))eye.z=nz;}
function navigationStep(dt){
 if(busy||!navigationKeys.size||pointer||editingText(document.activeElement))return;
 const has=(...keys)=>keys.some(k=>navigationKeys.has(k));
 let forward=+has('arrowup','z','w')-+has('arrowdown','s'),right=+has('arrowright','d')-+has('arrowleft','q','a');
 const length=Math.hypot(forward,right);if(length>1){forward/=length;right/=length;}
 const speed=(view==='interior'?2.5:Math.max(1,dist*.32))*navigationSpeed*(navigationShift?3:1)*Math.min(dt,.05);
 if(view==='interior')walkTo(eye.x+(Math.sin(yaw)*forward+Math.cos(yaw)*right)*speed,eye.z+(-Math.cos(yaw)*forward+Math.sin(yaw)*right)*speed);
 else if(view==='plan'){target.x+=right*speed;target.z-=forward*speed;}
 else{target.x+=(Math.cos(theta)*right-Math.sin(theta)*forward)*speed;target.z+=(-Math.sin(theta)*right-Math.cos(theta)*forward)*speed;}
 const turn=(+has('l')-+has('j'))*dt*1.3,tilt=(+has('i')-+has('k'))*dt;
 if(view==='interior'){yaw+=turn;pitch=THREE.MathUtils.clamp(pitch+tilt,-1.3,1.3);}else if(view==='3d'){theta-=turn;phi=THREE.MathUtils.clamp(phi-tilt,.08,1.5);}
 const vertical=(+has('pageup')-+has('pagedown'))*speed;
 if(view==='interior')eye.y=THREE.MathUtils.clamp(eye.y+vertical,.3,10);else if(view==='3d')target.y=THREE.MathUtils.clamp(target.y+vertical,-5,30);
 const zoom=+has('+','=')-+has('-');
 if(view==='interior'){if(zoom)walkTo(eye.x+Math.sin(yaw)*zoom*speed,eye.z-Math.cos(yaw)*zoom*speed);}else dist=THREE.MathUtils.clamp(dist*Math.exp(-zoom*dt*1.5),2,160);
 updateCamera();
}
function navigationKeyDown(e){
 if(e.ctrlKey||e.metaKey||e.altKey){stopNavigation();return;}navigationShift=e.shiftKey;const k=e.key.toLowerCase();
 if(k==='home'||k==='f'){e.preventDefault();if(!e.repeat){if(k==='f'&&selection&&$('focusSelection'))$('focusSelection').click();else frame();}return;}
 if(k==='g'&&view==='interior'){e.preventDefault();if(!e.repeat){walkThrough=!walkThrough;notify(walkThrough?'Passe-muraille : les murs ne vous arrêtent plus (G pour revenir).':'Visite réaliste : murs et poteaux vous arrêtent, les portes vous laissent passer.');}return;}
 if(['1','2','3'].includes(k)){e.preventDefault();if(!e.repeat)setView({'1':'3d','2':'plan','3':'interior'}[k]);return;}
 if(!movementKeys.has(k))return;e.preventDefault();navigationShift=e.shiftKey;
 if(!navigationKeys.has(k)){navigationKeys.add(k);navigationStep(.04);}
}
function panCamera(dx,dy){const scale=(view==='plan'?dist:2*dist*Math.tan(persp.fov*Math.PI/360))/Math.max(1,canvas.clientHeight);
 if(view==='plan'){target.x-=dx*scale;target.z-=dy*scale;}else{target.x-=(dx*Math.cos(theta)+dy*Math.sin(theta))*scale;target.z+=(dx*Math.sin(theta)-dy*Math.cos(theta))*scale;}}
function navigationWheel(e){e.preventDefault();if(busy||pointer)return;stopNavigation();const delta=THREE.MathUtils.clamp(e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1),-200,200);
 if(view==='interior'){const step=-delta*.008*navigationSpeed;walkTo(eye.x+Math.sin(yaw)*step,eye.z-Math.cos(yaw)*step);updateCamera();return;}
 const before=view==='plan'?floorPoint(e):null;dist=THREE.MathUtils.clamp(dist*Math.exp(delta*.0015),2,160);updateCamera();
 if(before){const after=floorPoint(e);if(after){target.x+=before.x-after.x;target.z+=before.z-after.z;updateCamera();}}
}
function cameraZoom(direction){
 if(busy||pointer)return;
 stopNavigation();
 if(view==='interior'){
  const step=.8*navigationSpeed*direction;
  walkTo(eye.x+Math.sin(yaw)*step,eye.z-Math.cos(yaw)*step);
 }else dist=THREE.MathUtils.clamp(dist*Math.exp(-direction*.18),2,160);
 updateCamera();
}
function compassDirection(direction){
 if(busy||pointer||view!=='3d')return;
 const angles={north:Math.PI,east:Math.PI/2,south:0,west:-Math.PI/2};
 if(!Object.hasOwn(angles,direction))return;
 stopNavigation();theta=angles[direction];phi=.83;updateCamera();
}
function setupNavigation(){
 $('viewTools').insertAdjacentHTML('beforeend','<button id="navigateTool" title="Déplacer la vue sans modifier les objets">✋ Main</button>');
 $('navigateTool').onclick=()=>{setTool(tool==='navigate'?'select':'navigate');canvas.focus();};
 document.querySelectorAll('[data-compass]').forEach(button=>button.onclick=()=>compassDirection(button.dataset.compass));
 $('zoomIn').onclick=()=>cameraZoom(1);
 $('zoomOut').onclick=()=>cameraZoom(-1);
 $('viewport').insertAdjacentHTML('beforeend','<div id="navigationHint"></div>');
 $('navigationHelp').innerHTML='<p class="note">Flèches ou ZQSD/WASD : déplacements continus dans les trois vues.<br>Maj : accélérer. J/L : tourner ; I/K : regarder haut/bas (3D).<br>+/− ou boutons sur la maquette : zoomer, ou avancer/reculer en intérieur.<br>Rose des vents : orienter la perspective au nord, à l’est, au sud ou à l’ouest.<br>Page ↑/↓ : hauteur en 3D.<br>1 / 2 / 3 : perspective / plan / intérieur.<br>F : cadrer la sélection ; Home : vue initiale.<br>Outil Main, clic droit, clic milieu ou Maj + glisser : naviguer sans déplacer les objets.<br>Perspective : glisser le fond pour tourner ; Alt + glisser pour tourner sur un objet.<br>Plan : glisser pour déplacer ; molette pour zoomer au pointeur.<br>Intérieur : glisser pour regarder. Visite libre, sans collision.<br>Échap : annuler l’outil. Suppr : supprimer. Ctrl+D : dupliquer.<br>Les raccourcis sont désactivés pendant la saisie dans un champ.</p><label class="field">Vitesse de déplacement<select id="navigationSpeed"><option value=".4">Précise</option><option value="1" selected>Normale</option><option value="2">Rapide</option></select></label>';
 $('navigationSpeed').onchange=()=>{navigationSpeed=+$('navigationSpeed').value;stopNavigation();};
 addEventListener('keyup',e=>{navigationKeys.delete(e.key.toLowerCase());navigationShift=e.shiftKey;if(e.ctrlKey||e.metaKey)stopNavigation();});
 addEventListener('blur',()=>{stopNavigation();endPointer(true);});
 addEventListener('focusin',e=>{if(editingText(e.target))stopNavigation();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){stopNavigation();endPointer(true);}});
 navigationHint();
}
