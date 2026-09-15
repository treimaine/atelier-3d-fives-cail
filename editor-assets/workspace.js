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
 function setup(){
  document.querySelectorAll('#inspectorTabs button').forEach(button=>button.onclick=()=>show(button.dataset.panel));
  if(typeof AtelierCloud==='undefined'){el('inspectorTabs').hidden=true;el('shareVersion').textContent='Exporter .json';}
  el('helpButton').onclick=()=>el('helpDialog').showModal();
  el('shareVersion').onclick=share;
  addEventListener('keydown',event=>{const sheet=document.querySelector('dialog.sheet[open]');if(event.key==='Escape'&&sheet){event.preventDefault();sheet.close();return;}if(event.key==='?'&&!editingText(document.activeElement)&&!document.querySelector('dialog[open]')){event.preventDefault();el('helpDialog').showModal();}});
  // The title is an invitation: it steps aside once the user starts working in the model.
  el('c').addEventListener('pointerdown',()=>el('sceneCaption').classList.add('compact'),{once:true});
 }
 return {setup,show,followSelection,setBadge,share,welcome};
})();
