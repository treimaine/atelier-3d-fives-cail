'use strict';
// Interface shell: right-hand tabs, help and first-visit guide. Never touches project data.
const Workspace=(()=>{
 const el=id=>document.getElementById(id);
 let lastSelection='';
 function show(panel){
  if(!el('panel-team'))return;
  document.querySelectorAll('#inspectorTabs button').forEach(button=>{const on=button.dataset.panel===panel;button.classList.toggle('active',on);button.setAttribute('aria-pressed',String(on));});
  el('panel-selection').hidden=panel!=='selection';el('panel-team').hidden=panel!=='team';
  el('inspector').scrollTop=0;
 }
 // Only a newly selected element brings the properties forward, not every refresh.
 function followSelection(current){
  const key=current?JSON.stringify(current):'';
  if(key&&key!==lastSelection)show('selection');
  lastSelection=key;
 }
 function setBadge(count){const badge=el('teamBadge');if(!badge)return;badge.hidden=!count;badge.textContent=count?String(count):'';badge.title=count?count+' demande(s) d’accès en attente':'';}
 function share(){
  const title=el('cloudTitle');
  if(!title){el('exportJson').click();return;}
  show('team');title.scrollIntoView({block:'center'});title.focus();
 }
 function welcome(key){
  try{if(localStorage.getItem(key))return;localStorage.setItem(key,'1');}catch{return;}
  el('welcomeDialog').showModal();
 }
 // Réglages d'affichage regroupés dans un menu posé sur la maquette, fermé par défaut.
 function toggleDisplayMenu(force){const menu=el('displayMenu'),button=el('displayMenuButton');if(!menu)return;
  const open=force===undefined?menu.hidden:force;menu.hidden=!open;button.setAttribute('aria-expanded',String(open));button.classList.toggle('active',open);}
 function closeFloating(){let closed=false;
  if(el('contextMenu')&&!el('contextMenu').hidden){el('contextMenu').hidden=true;closed=true;}
  if(el('displayMenu')&&!el('displayMenu').hidden){toggleDisplayMenu(false);closed=true;}
  return closed;}
 function setup(){
  if(el('displayMenuButton'))el('displayMenuButton').onclick=()=>toggleDisplayMenu();
  document.addEventListener('pointerdown',event=>{
   const menu=el('contextMenu'),display=el('displayMenu');
   if(menu&&!menu.hidden&&!menu.contains(event.target))menu.hidden=true;
   if(display&&!display.hidden&&!display.contains(event.target)&&!el('displayMenuButton').contains(event.target))toggleDisplayMenu(false);
  },true);
  el('c').addEventListener('wheel',()=>{if(el('contextMenu'))el('contextMenu').hidden=true;},{passive:true});
  document.querySelectorAll('#inspectorTabs button').forEach(button=>button.onclick=()=>show(button.dataset.panel));
  if(typeof AtelierCloud==='undefined'){el('inspectorTabs').hidden=true;el('shareVersion').textContent='Exporter .json';}
  el('helpButton').onclick=()=>el('helpDialog').showModal();
  el('shareVersion').onclick=share;
  addEventListener('keydown',event=>{const sheet=document.querySelector('dialog.sheet[open]');if(event.key==='Escape'&&sheet){event.preventDefault();sheet.close();return;}
   if(event.key==='Escape'&&closeFloating()){event.preventDefault();event.stopImmediatePropagation();return;}
   // Menu contextuel ouvert : les flèches parcourent ses entrées au lieu de déplacer la caméra.
   const menu=el('contextMenu');
   if(menu&&!menu.hidden&&['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();
    const items=[...menu.querySelectorAll('button')],i=items.indexOf(document.activeElement);
    items[(i+(event.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();return;}
   if(event.key==='?'&&!editingText(document.activeElement)&&!document.querySelector('dialog[open]')){event.preventDefault();el('helpDialog').showModal();}},true);
  // The title is an invitation: it steps aside once the user starts working in the model.
  el('c').addEventListener('pointerdown',()=>el('sceneCaption').classList.add('compact'),{once:true});
 }
 return {setup,show,followSelection,setBadge,share,welcome};
})();
