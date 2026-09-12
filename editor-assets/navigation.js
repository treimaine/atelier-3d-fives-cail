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
function navigationStep(dt){
 if(busy||!navigationKeys.size||pointer||editingText(document.activeElement))return;
 const has=(...keys)=>keys.some(k=>navigationKeys.has(k));
 let forward=+has('arrowup','z','w')-+has('arrowdown','s'),right=+has('arrowright','d')-+has('arrowleft','q','a');
 const length=Math.hypot(forward,right);if(length>1){forward/=length;right/=length;}
 const speed=(view==='interior'?2.5:Math.max(1,dist*.32))*navigationSpeed*(navigationShift?3:1)*Math.min(dt,.05);
 if(view==='interior'){eye.x+=(Math.sin(yaw)*forward+Math.cos(yaw)*right)*speed;eye.z+=(-Math.cos(yaw)*forward+Math.sin(yaw)*right)*speed;}
 else if(view==='plan'){target.x+=right*speed;target.z-=forward*speed;}
 else{target.x+=(Math.cos(theta)*right-Math.sin(theta)*forward)*speed;target.z+=(-Math.sin(theta)*right-Math.cos(theta)*forward)*speed;}
 const turn=(+has('l')-+has('j'))*dt*1.3,tilt=(+has('i')-+has('k'))*dt;
 if(view==='interior'){yaw+=turn;pitch=THREE.MathUtils.clamp(pitch+tilt,-1.3,1.3);}else if(view==='3d'){theta-=turn;phi=THREE.MathUtils.clamp(phi-tilt,.08,1.5);}
 const vertical=(+has('pageup')-+has('pagedown'))*speed;
 if(view==='interior')eye.y=THREE.MathUtils.clamp(eye.y+vertical,.3,10);else if(view==='3d')target.y=THREE.MathUtils.clamp(target.y+vertical,-5,30);
 const zoom=+has('+','=')-+has('-');
 if(view==='interior'){eye.x+=Math.sin(yaw)*zoom*speed;eye.z-=Math.cos(yaw)*zoom*speed;}else dist=THREE.MathUtils.clamp(dist*Math.exp(-zoom*dt*1.5),2,160);
 updateCamera();
}
function navigationKeyDown(e){
 if(e.ctrlKey||e.metaKey||e.altKey){stopNavigation();return;}navigationShift=e.shiftKey;const k=e.key.toLowerCase();
 if(k==='home'||k==='f'){e.preventDefault();if(!e.repeat){if(k==='f'&&selection&&$('focusSelection'))$('focusSelection').click();else frame();}return;}
 if(['1','2','3'].includes(k)){e.preventDefault();if(!e.repeat)setView({'1':'3d','2':'plan','3':'interior'}[k]);return;}
 if(!movementKeys.has(k))return;e.preventDefault();navigationShift=e.shiftKey;
 if(!navigationKeys.has(k)){navigationKeys.add(k);navigationStep(.04);}
}
function panCamera(dx,dy){const scale=(view==='plan'?dist:2*dist*Math.tan(persp.fov*Math.PI/360))/Math.max(1,canvas.clientHeight);
 if(view==='plan'){target.x-=dx*scale;target.z-=dy*scale;}else{target.x-=(dx*Math.cos(theta)+dy*Math.sin(theta))*scale;target.z+=(dx*Math.sin(theta)-dy*Math.cos(theta))*scale;}}
function navigationWheel(e){e.preventDefault();if(busy||pointer)return;stopNavigation();const delta=THREE.MathUtils.clamp(e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1),-200,200);
 if(view==='interior'){const step=-delta*.008*navigationSpeed;eye.x+=Math.sin(yaw)*step;eye.z-=Math.cos(yaw)*step;updateCamera();return;}
 const before=view==='plan'?floorPoint(e):null;dist=THREE.MathUtils.clamp(dist*Math.exp(delta*.0015),2,160);updateCamera();
 if(before){const after=floorPoint(e);if(after){target.x+=before.x-after.x;target.z+=before.z-after.z;updateCamera();}}
}
function setupNavigation(){
 $('viewTools').insertAdjacentHTML('beforeend','<button id="navigateTool" title="Déplacer la vue sans modifier les objets">✋ Main</button>');
 $('navigateTool').onclick=()=>{setTool(tool==='navigate'?'select':'navigate');canvas.focus();};
 $('viewport').insertAdjacentHTML('beforeend','<div id="navigationHint"></div>');
 $('navigationHelp').innerHTML='<p class="note">Flèches ou ZQSD/WASD : déplacements continus dans les trois vues.<br>Maj : accélérer. J/L : tourner ; I/K : regarder haut/bas (3D).<br>+/− : zoomer, ou avancer/reculer en intérieur.<br>Page ↑/↓ : hauteur en 3D.<br>1 / 2 / 3 : perspective / plan / intérieur.<br>F : cadrer la sélection ; Home : vue initiale.<br>Outil Main, clic droit, clic milieu ou Maj + glisser : naviguer sans déplacer les objets.<br>Perspective : glisser le fond pour tourner ; Alt + glisser pour tourner sur un objet.<br>Plan : glisser pour déplacer ; molette pour zoomer au pointeur.<br>Intérieur : glisser pour regarder. Visite libre, sans collision.<br>Échap : annuler l’outil. Suppr : supprimer. Ctrl+D : dupliquer.<br>Les raccourcis sont désactivés pendant la saisie dans un champ.</p><label class="field">Vitesse de déplacement<select id="navigationSpeed"><option value=".4">Précise</option><option value="1" selected>Normale</option><option value="2">Rapide</option></select></label>';
 $('navigationSpeed').onchange=()=>{navigationSpeed=+$('navigationSpeed').value;stopNavigation();};
 addEventListener('keyup',e=>{navigationKeys.delete(e.key.toLowerCase());navigationShift=e.shiftKey;if(e.ctrlKey||e.metaKey)stopNavigation();});
 addEventListener('blur',()=>{stopNavigation();endPointer(true);});
 addEventListener('focusin',e=>{if(editingText(e.target))stopNavigation();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){stopNavigation();endPointer(true);}});
 navigationHint();
}
