'use strict';
// Mode présentation : visite guidée plein écran, un arrêt par espace, pour une réunion
// d'investisseurs ou de partenaires. Ne modifie jamais le projet : seuls la caméra et les
// options d'affichage changent, et ces options sont rétablies en quittant.
const PRESENTATION_HOLD=9, PRESENTATION_MOVE=2.2;
const SEAT_WEIGHTS={chair:1,tabouret:1,chaisebureau:1,fauteuil:1,sofa:3,banc:2,gradin:12};
const PRESENTATION_DISPLAY=['showLabels','showGrid','showDimensions','showZoning','showCollisions','showClearances','showDoorSwings'];
let presentation=null;

function seatCount(list){return list.reduce((n,f)=>n+(SEAT_WEIGHTS[f.type]||0),0);}
function presentationStops(){
 const outline=buildingOutline(),total=Arch.area(outline),stops=[];
 const zones=state.zones.map(z=>{const poly=Arch.polygon(z);return {z,poly,area:Arch.area(poly),b:Arch.bounds(poly)};}).filter(e=>e.area>=6);
 stops.push({eyebrow:'LILLE · '+(state.meta.name||'PROPOSITION').toUpperCase(),title:'Hub créatif Fives Cail',
  meta:`${total.toFixed(0)} m² · ${zones.length} espaces · hauteur ${buildingHeight().toFixed(2)} m`,
  text:'Un ancien site industriel transformé en lieu de création, de diffusion et de rencontre. Visite de la proposition d’aménagement, espace par espace.',
  target:{x:0,y:0,z:0},theta:-.72,phi:.83,dist:Math.max(34,38/Math.max(.6,persp.aspect))});
 zones.forEach((e,i)=>{const inside=state.furniture.filter(f=>Arch.contains(e.poly,{x:f.x,z:f.z})),seats=seatCount(inside),span=Math.max(e.b.w,e.b.d);
  stops.push({eyebrow:`ESPACE ${i+1} / ${zones.length}`,title:e.z.n,
   meta:[`${e.area.toFixed(1)} m²`,SURFACES[e.z.surface]||null,seats?`${seats} place${seats>1?'s':''} assise${seats>1?'s':''}`:null,inside.length?`${inside.length} élément${inside.length>1?'s':''} d’aménagement`:null].filter(Boolean).join(' · '),
   text:e.z.t||'',target:{x:e.b.x+e.b.w/2-CX,y:0,z:e.b.z+e.b.d/2-CZ},theta:-.72+((i%5)-2)*.38,phi:.62,dist:THREE.MathUtils.clamp(span*1.35+5,8,24)});});
 const seats=seatCount(state.furniture),bespoke=state.furniture.filter(f=>f.bespoke).length;
 stops.push({eyebrow:'EN SYNTHÈSE',title:'Un lieu, plusieurs possibles',
  meta:`${total.toFixed(0)} m² · ${zones.length} espaces · ${seats} places assises · ${state.furniture.length} éléments dont ${bespoke} sur mesure`,
  text:'Étude conceptuelle : cotes estimées à confirmer par relevé, mobilier en gabarits d’étude à valider sur consultation.',
  target:{x:0,y:0,z:0},theta:.55,phi:.62,dist:Math.max(36,40/Math.max(.6,persp.aspect))});
 return stops;}

function presentationSetup(){
 $('helpButton').insertAdjacentHTML('beforebegin','<button id="presentButton" title="Visite guidée plein écran pour une présentation (touche P)">▶ Présenter</button>');
 document.body.insertAdjacentHTML('beforeend','<div id="presentation" hidden><div class="pres-shield"></div>'
  +'<div class="pres-top"><span class="brandmark">FC</span><div><strong>FIVES CAIL <span>/ HUB CRÉATIF</span></strong><small>Proposition d’aménagement</small></div></div>'
  +'<div class="pres-card" aria-live="polite"><div class="eyebrow" id="presEyebrow"></div><h2 id="presTitle"></h2><p class="pres-meta" id="presMeta"></p><p class="pres-text" id="presText"></p></div>'
  +'<div class="pres-controls"><button id="presPrev" aria-label="Espace précédent">‹</button><button id="presPlay" aria-label="Pause">❚❚</button><button id="presNext" aria-label="Espace suivant">›</button><button id="presMood">☾ Soirée</button><button id="presExit">✕ Quitter</button></div>'
  +'<div class="pres-progress"><span id="presBar"></span></div><div class="pres-dots" id="presDots"></div></div>');
 $('presentButton').onclick=startPresentation;
 $('navigationHelp')?.insertAdjacentHTML('beforeend','<p class="note">P : présentation plein écran, un arrêt par espace. ←/→ : espace précédent ou suivant · Espace : pause · Échap : quitter.</p>');
 $('presPrev').onclick=()=>presentationGo(presentation.index-1);$('presNext').onclick=()=>presentationGo(presentation.index+1);
 $('presPlay').onclick=()=>{presentation.playing=!presentation.playing;presentationControls();};
 $('presMood').onclick=()=>{$('lighting').value=$('lighting').value==='evening'?presentation.restore.lighting==='evening'?'day':presentation.restore.lighting:'evening';lighting();presentationControls();};
 $('presExit').onclick=stopPresentation;
 // Capture : pendant la visite, les touches pilotent la présentation, pas la maquette.
 addEventListener('keydown',e=>{
  if(!presentation){if((e.key==='p'||e.key==='P')&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!editingText(e.target)&&!document.querySelector('dialog[open]')&&!busy){e.preventDefault();startPresentation();}return;}
  e.stopImmediatePropagation();e.preventDefault();
  if(e.key==='Escape')stopPresentation();else if(['ArrowRight','PageDown','Enter'].includes(e.key))presentationGo(presentation.index+1);
  else if(['ArrowLeft','PageUp','Backspace'].includes(e.key))presentationGo(presentation.index-1);else if(e.key===' '){presentation.playing=!presentation.playing;presentationControls();}
 },true);
 document.addEventListener('fullscreenchange',()=>{if(presentation&&!document.fullscreenElement&&presentation.fullscreen)stopPresentation();});
 addEventListener('resize',()=>{if(presentation)requestAnimationFrame(presentationFraming);});
}
function startPresentation(){if(presentation||busy)return;
 endPointer?.(true);stopNavigation();if(view!=='3d')setView('3d');rememberCamera();
 const restore={lighting:$('lighting').value,cut,roofOn,selection,display:Object.fromEntries(PRESENTATION_DISPLAY.filter(id=>$(id)).map(id=>[id,$(id).checked]))};
 for(const id of PRESENTATION_DISPLAY)if($(id))$(id).checked=false;
 // Coupe remontée à 2,40 m : les murs gardent leurs œuvres et écrans, la vue plonge encore dans les pièces.
 selection=null;cut=true;roofOn=false;restore.clip=clipPlane.constant;clipPlane.constant=2.4;
 presentation={restore,stops:presentationStops(),index:-1,playing:true,elapsed:0,tween:null,last:0,fullscreen:false};
 document.body.classList.add('presenting');$('presentation').hidden=false;
 $('presDots').innerHTML=presentation.stops.map((s,i)=>`<button data-stop="${i}" aria-label="${esc(s.title)}"></button>`).join('');
 $('presDots').querySelectorAll('button').forEach(b=>b.onclick=()=>presentationGo(+b.dataset.stop));
 document.documentElement.requestFullscreen?.().then(()=>{if(presentation)presentation.fullscreen=true;}).catch(()=>{});
 rebuild();resize();presentationFraming();presentationGo(0);requestAnimationFrame(presentationTick);}
function stopPresentation(){if(!presentation)return;const r=presentation.restore;presentation=null;
 document.body.classList.remove('presenting');$('presentation').hidden=true;
 if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});
 for(const [id,v] of Object.entries(r.display))$(id).checked=v;
 cut=r.cut;roofOn=r.roofOn;clipPlane.constant=r.clip;selection=r.selection;if($('lighting').value!==r.lighting){$('lighting').value=r.lighting;lighting();}
 persp.clearViewOffset();restoreCamera('3d');resize();updateCamera();refresh();}
// Le sujet se cadre à droite de la fiche : décalage optique, sans déplacer la caméra.
function presentationFraming(){const r=canvas.getBoundingClientRect(),narrow=r.width<700;persp.setViewOffset(r.width,r.height,narrow?0:-r.width*.14,r.height*(narrow?.12:.05),r.width,r.height);updateCamera();}
function presentationGo(i){if(!presentation)return;const n=presentation.stops.length;i=(i+n)%n;presentation.index=i;presentation.elapsed=0;
 const s=presentation.stops[i],from={target:target.clone(),theta,phi,dist};
 let dTheta=((s.theta-theta)%(2*Math.PI)+3*Math.PI)%(2*Math.PI)-Math.PI;
 presentation.tween={from,to:{target:new THREE.Vector3(s.target.x,s.target.y,s.target.z),theta:theta+dTheta,phi:s.phi,dist:s.dist},t:0};
 $('presEyebrow').textContent=s.eyebrow;$('presTitle').textContent=s.title;$('presMeta').textContent=s.meta;$('presText').textContent=s.text;$('presText').hidden=!s.text;
 const card=document.querySelector('.pres-card');card.classList.remove('enter');void card.offsetWidth;card.classList.add('enter');
 presentationControls();}
function presentationControls(){if(!presentation)return;
 $('presPlay').textContent=presentation.playing?'❚❚':'▶';$('presPlay').setAttribute('aria-label',presentation.playing?'Pause':'Lecture');
 $('presMood').textContent=$('lighting').value==='evening'?'☀ Journée':'☾ Soirée';
 $('presDots').querySelectorAll('button').forEach((b,i)=>b.classList.toggle('active',i===presentation.index));}
function presentationTick(now){if(!presentation)return;requestAnimationFrame(presentationTick);
 const dt=presentation.last?Math.min((now-presentation.last)/1000,.05):0;presentation.last=now;const tw=presentation.tween;
 if(tw&&tw.t<1){tw.t=Math.min(1,tw.t+dt/PRESENTATION_MOVE);const k=tw.t<.5?4*tw.t**3:1-(-2*tw.t+2)**3/2;
  target.lerpVectors(tw.from.target,tw.to.target,k);theta=tw.from.theta+(tw.to.theta-tw.from.theta)*k;phi=tw.from.phi+(tw.to.phi-tw.from.phi)*k;dist=tw.from.dist+(tw.to.dist-tw.from.dist)*k;}
 else{theta+=dt*.045;if(presentation.playing){presentation.elapsed+=dt;if(presentation.elapsed>=PRESENTATION_HOLD)presentationGo(presentation.index+1);}}
 $('presBar').style.width=(100*Math.min(1,presentation.elapsed/PRESENTATION_HOLD))+'%';
 updateCamera();}
