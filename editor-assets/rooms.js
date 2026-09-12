'use strict';
// Manipulation directe des espaces, dans l'esprit des Sims : un espace se saisit, se déplace
// avec son contenu, se redimensionne par ses poignées et pivote par quart de tour. La précision
// de Sweet Home 3D est conservée : tout passe par la grille, les cotes et le même validateur.
let roomCarry=true,roomDragState=null,roomStep=.25;
const ROOM_MIN=.5;
const ROOM_HANDLES=[[-1,-1],[1,-1],[1,1],[-1,1],[0,-1],[1,0],[0,1],[-1,0]];

// Sol non affecté : dans Les Sims on peint une pièce sur une dalle vide. Ici, un double-clic sur
// un sol libre crée l'espace et le laisse grandir jusqu'aux murs, aux espaces voisins et à
// l'emprise — le vide devient un objet du projet, donc modifiable.
let lastFloorPoint=null;
function freeRectAt(point){const step=.25,outline=buildingOutline();
 const asPoly=r=>[[r.x,r.z],[r.x+r.w,r.z],[r.x+r.w,r.z+r.d],[r.x,r.z+r.d]].map(([x,z])=>({x,z}));
 const ok=r=>{const poly=asPoly(r);
  if(Arch.area(poly)-Arch.overlapArea(poly,outline)>.001)return false;
  for(const z of state.zones)if(Arch.overlapArea(poly,Arch.polygon(z))>.01)return false;
  for(const w of state.walls)if(Arch.convexOverlap(poly,Arch.wallRect(w)))return false;
  return true;};
 const seed={x:snap(point.x)-.25,z:snap(point.z)-.25,w:.5,d:.5};
 if(!ok(seed))return null;
 // La croissance gloutonne dépend de l'ordre des côtés : on essaie largeur d'abord puis
 // profondeur d'abord, et on garde la plus grande surface.
 const grow=order=>{let r={...seed};
  for(const side of order)for(let guard=0;guard<400;guard++){const t={...r};
   if(side==='-x'){t.x-=step;t.w+=step;}else if(side==='+x')t.w+=step;
   else if(side==='-z'){t.z-=step;t.d+=step;}else t.d+=step;
   if(t.w>80||t.d>80||!ok(t))break;
   r=t;}
  return r;};
 const wide=grow(['-x','+x','-z','+z']),deep=grow(['-z','+z','-x','+x']);
 return wide.w*wide.d>=deep.w*deep.d?wide:deep;}
function createRoomAt(point){if(!point){notify('Cliquez d’abord un sol libre dans la maquette.');return;}
 const r=freeRectAt(point);
 if(!r){notify('Pas de place ici : ce point touche un mur, un espace existant ou l’extérieur de l’emprise.');return;}
 commit(()=>{state.zones.push({n:'Nouvel espace',c:'#b7c59c',t:'',surface:'concrete',
  x:+r.x.toFixed(2),z:+r.z.toFixed(2),w:+r.w.toFixed(2),d:+r.d.toFixed(2)});
  selection={kind:'zones',i:state.zones.length-1};});
 notify('Espace créé sur '+ (r.w*r.d).toFixed(1) +' m² de sol libre : ajustez-le par ses poignées ou ses cotes.');}
function roomFloorClick(point){lastFloorPoint=point||null;
 if(point)notify('Sol non affecté à un espace. Double-cliquez pour y créer un espace, ou utilisez le bouton de l’inspecteur.');
 if($('createRoomHere'))$('createRoomHere').disabled=!point;}
function roomPolygon(z){return Arch.polygon(z);}
function roomContents(z,source=state){const poly=roomPolygon(z);
 return source.furniture.map((f,i)=>({f,i})).filter(({f})=>Arch.contains(poly,{x:f.x,z:f.z})).map(({i})=>i);}
function roomHandlePoint(z,[hx,hz]){return {x:z.x+z.w/2+hx*z.w/2,z:z.z+z.d/2+hz*z.d/2};}

// Déplacement : l'espace, son contour et, au choix, tout ce qu'il contient.
function roomTranslate(z,dx,dz,ids,source){
 z.x=+(z.x+dx).toFixed(4);z.z=+(z.z+dz).toFixed(4);
 if(z.vertices)z.vertices=z.vertices.map(v=>({x:+(v.x+dx).toFixed(4),z:+(v.z+dz).toFixed(4)}));
 if(!ids)return;
 for(const i of ids){const before=source.furniture[i],f=state.furniture[i];if(!f||!before)continue;
  f.x=+(before.x+dx).toFixed(4);f.z=+(before.z+dz).toFixed(4);}}

// Redimensionnement par poignée : les côtés opposés restent en place, le contenu garde sa taille.
function roomResize(z,[hx,hz],point){
 const right=z.x+z.w,bottom=z.z+z.d,before={x:z.x,z:z.z,w:z.w,d:z.d};
 if(hx<0){const x=Math.min(point.x,right-ROOM_MIN);z.x=+x.toFixed(4);z.w=+(right-x).toFixed(4);}
 if(hx>0)z.w=+Math.max(ROOM_MIN,point.x-z.x).toFixed(4);
 if(hz<0){const zz=Math.min(point.z,bottom-ROOM_MIN);z.z=+zz.toFixed(4);z.d=+(bottom-zz).toFixed(4);}
 if(hz>0)z.d=+Math.max(ROOM_MIN,point.z-z.z).toFixed(4);
 if(z.vertices){const sx=z.w/before.w,sz=z.d/before.d;
  z.vertices=z.vertices.map(v=>({x:+(z.x+(v.x-before.x)*sx).toFixed(4),z:+(z.z+(v.z-before.z)*sz).toFixed(4)}));}}

// Quart de tour autour du centre, contenu compris : l'équivalent de la rotation d'une pièce.
function roomRotate(step=1){const z=selected();if(selection?.kind!=='zones'||!z)return;
 commit(()=>{const room=state.zones[selection.i],source=clone(state),ids=roomCarry?roomContents(source.zones[selection.i],source):[];
  const cx=room.x+room.w/2,cz=room.z+room.d/2,s=step>0?1:-1;
  const turn=p=>({x:cx+s*(p.z-cz),z:cz-s*(p.x-cx)});
  if(room.vertices){room.vertices=room.vertices.map(v=>{const q=turn(v);return {x:+q.x.toFixed(4),z:+q.z.toFixed(4)};});Object.assign(room,Arch.bounds(room.vertices));}
  else{const w=room.w,d=room.d;room.w=d;room.d=w;room.x=+(cx-d/2).toFixed(4);room.z=+(cz-w/2).toFixed(4);}
  for(const i of ids){const before=source.furniture[i],f=state.furniture[i];const q=turn(before);
   f.x=+q.x.toFixed(4);f.z=+q.z.toFixed(4);f.r=before.r-s*Math.PI/2;}
  delete room.nodes;});}

function roomPointerDown(hit,point){if(hit?.kind!=='room')return false;
 const z=state.zones[hit.i];if(!z)return false;
 roomDragState={before:snapshot(),i:hit.i,mode:hit.mode,axis:hit.axis,
  grab:{x:point.x-z.x,z:point.z-z.z},ids:roomCarry&&hit.mode==='move'?roomContents(z):null};
 return true;}
function roomDragMove(point){if(!roomDragState)return false;
 const d=roomDragState,source=JSON.parse(d.before);state=JSON.parse(d.before);
 const z=state.zones[d.i];if(!z){roomDragState=null;return false;}
 if(d.mode==='move')roomTranslate(z,snap(point.x-d.grab.x)-z.x,snap(point.z-d.grab.z)-z.z,d.ids,source);
 else roomResize(z,d.axis,{x:snap(point.x),z:snap(point.z)});
 try{Arch.propagate(JSON.parse(d.before),state);state=validate(state);d.error=null;}
 catch(e){d.error=e.message;state=JSON.parse(d.before);}
 requestBuild();return true;}
function roomDragEnd(cancel=false){if(!roomDragState)return;const d=roomDragState;roomDragState=null;
 try{if(cancel||d.error)throw Error(d.error||'');state=validate(state);record(d.before);}
 catch(e){state=JSON.parse(d.before);if(e.message)notify(e.message+' Modification annulée.');}
 refresh();}

function roomRebuild(){
 if(selection?.kind!=='zones'||view==='interior'||roomDragState&&roomDragState.mode==='move')return;
 const z=selected();if(!z)return;
 ROOM_HANDLES.forEach(axis=>{const p=roomHandlePoint(z,axis),corner=axis[0]&&axis[1];
  const h=box(helpers,corner?.34:.26,.08,corner?.34:.26,p.x-CX,.26,p.z-CZ,new THREE.MeshBasicMaterial({color:corner?0xe0a34e:0xc9d5b9}));
  h.userData.pick={kind:'room',i:selection.i,mode:'resize',axis};});
 const centre=sphere(helpers,.24,z.x+z.w/2-CX,.3,z.z+z.d/2-CZ,new THREE.MeshBasicMaterial({color:0x6f9ec0}));
 centre.userData.pick={kind:'room',i:selection.i,mode:'move'};
 const p=roomPolygon(z);line([...p,p[0]].map(v=>[v.x-CX,.2,v.z-CZ]),0x6f9ec0);}

function roomProperties(){if(selection?.kind!=='zones')return;const z=selected(),contents=roomContents(z).length;
 $('properties').insertAdjacentHTML('beforeend','<h3>Manipuler l’espace</h3>'
  +`<p class="note">Poignée bleue au centre : déplacer. Poignées orange et claires : redimensionner. ${contents} objet(s) dans le contour.</p>`
  +`<label class="check"><input id="roomCarry" type="checkbox" ${roomCarry?'checked':''}> Emporter le mobilier contenu</label>`
  +'<button id="roomRotateLeft">↶ Quart de tour</button><button id="roomRotateRight">↷ Quart de tour</button>'
  +'<div class="nudge">'+[['−X',-1,0],['+X',1,0],['−Z',0,-1],['+Z',0,1]].map(([n,dx,dz])=>`<button data-room-nudge="${dx} ${dz}">${n}</button>`).join('')
  +`<label class="field">Pas · m<input id="roomStep" type="number" min=".05" max="5" step=".05" value="${roomStep}"></label></div>`
  +'<p class="note">Un quart de tour pivote aussi le mobilier emporté et délie le contour de ses murs. Les murs suivent l’espace lorsqu’il leur est lié (« Créer / lier le périmètre »).</p>');
 $('roomCarry').onchange=()=>{roomCarry=$('roomCarry').checked;};
 $('roomStep').onchange=()=>{roomStep=Math.min(5,Math.max(.05,+$('roomStep').value||.25));$('roomStep').value=roomStep;};
 $('roomRotateLeft').onclick=()=>roomRotate(-1);$('roomRotateRight').onclick=()=>roomRotate(1);
 $('properties').querySelectorAll('[data-room-nudge]').forEach(b=>b.onclick=()=>{const [dx,dz]=b.dataset.roomNudge.split(' ').map(Number);
  roomStep=Math.min(5,Math.max(.05,+$('roomStep').value||.25));
  commit(()=>{const source=clone(state),room=state.zones[selection.i];
   roomTranslate(room,dx*roomStep,dz*roomStep,roomCarry?roomContents(source.zones[selection.i],source):null,source);});});}
