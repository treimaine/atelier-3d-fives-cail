'use strict';
// Shared snapshots are immutable. The browser keeps a separate draft per account.
const AtelierCloud = (() => {
 const MAX_BYTES=49*1024*1024, PAGE_SIZE=20;
 let client, user, member, reference, rows=[], requests=[], page=0, pending=null, started=false, working=false, signup=false;
 let parentId=null, features=null, showArchived=false, consultation=null, members=[];
 const thumbUrls=new Map();
 const el=id=>document.getElementById(id);
 const fail=result=>{if(result.error)throw result.error;return result.data;};
 const message=text=>{el('cloudMessage').textContent=text;};
 function ask(text){
  const dialog=el('cloudConfirm');el('cloudConfirmText').textContent=text;
  dialog.returnValue='cancel';
  return new Promise(resolve=>{dialog.onclose=()=>resolve(dialog.returnValue==='confirm');dialog.showModal();});
 }
 function errorText(error){
  if(error?.message==='Invalid login credentials')return 'Adresse ou mot de passe incorrect.';
  if(error?.message==='Email not confirmed')return 'Ce compte doit être confirmé par l’administrateur.';
  if(error?.code==='user_already_exists'||error?.message==='User already registered')return 'Un compte existe déjà avec cette adresse. Connectez-vous.';
  if(error?.code==='weak_password')return 'Mot de passe trop faible : utilisez au moins 8 caractères, en mélangeant lettres et chiffres.';
  if(error?.code==='signup_disabled')return 'La création de compte est fermée. Contactez l’administrateur.';
  if(/rate limit/i.test(error?.message||''))return 'Trop de tentatives. Patientez quelques minutes avant de réessayer.';
  return error?.message||'Connexion impossible. Vérifiez votre accès Internet et réessayez.';
 }
 function storageKey(){return user?'courant:'+user.id:'courant';}
 function localKey(base){return user?base+':'+user.id:base;}
 async function findMember(){
  member=fail(await client.from('atelier_members').select('*').eq('user_id',user.id).eq('active',true).maybeSingle());
  return member;
 }
 async function getMember(){
  if(!await findMember())throw Error('Votre compte ne dispose pas encore d’un accès à cet atelier. Contactez l’administrateur.');
 }
 function setSignup(on){
  signup=on;
  el('cloudNameField').hidden=!on;el('cloudName').required=on;
  el('cloudPassword').autocomplete=on?'new-password':'current-password';
  el('cloudLoginButton').textContent=on?'Créer mon compte':'Se connecter';
  el('cloudModeSwitch').textContent=on?'Déjà un compte ? Se connecter':'Pas encore de compte ? Créer un compte';
  el('cloudLoginIntro').textContent=on?'Créez votre compte. L’administrateur de l’atelier validera ensuite votre accès.':'Connectez-vous pour retrouver les propositions de votre équipe.';
  el('cloudLoginStatus').textContent='';
 }
 // Signed in but not (or no longer) a member: show the state of the access request.
 async function showWaiting(){
  const request=fail(await client.from('atelier_access_requests').select('status,display_name').eq('user_id',user.id).maybeSingle());
  el('cloudLoginForm').hidden=true;el('cloudWaiting').hidden=false;el('cloudLoginStatus').textContent='';
  el('cloudWaitingRequest').hidden=!!request;
  el('cloudLoginIntro').textContent=user.email||'';
  el('cloudWaitingText').textContent=!request?'Votre compte n’a pas encore d’accès à cet atelier. Envoyez une demande à l’administrateur.'
   :request.status==='rejected'?'Votre demande d’accès n’a pas été acceptée. Contactez l’administrateur de l’atelier si c’est une erreur.'
   :'Votre compte est créé. Votre demande d’accès est en attente de validation par l’administrateur de l’atelier : vous pourrez entrer dès qu’il l’aura acceptée.';
 }
 async function listRequests(){
  requests=member.role==='admin'?fail(await client.from('atelier_access_requests').select('*').eq('status','pending').order('created_at',{ascending:true})):[];
 }
 async function reviewRequest(id,approve){
  const request=requests.find(row=>row.user_id===id);
  if(!request)throw Error('Cette demande a déjà été traitée. Actualisez la liste.');
  const text=approve?'Donner accès à '+request.display_name+' ('+request.email+') ? Vérifiez que cette adresse appartient bien à votre associé.':'Refuser l’accès à '+request.display_name+' ('+request.email+') ?';
  if(!await ask(text)){message('Action annulée.');return;}
  fail(await client.rpc('atelier_review_request',{target_id:id,approve}));
  await list();message(approve?request.display_name+' a maintenant accès à l’atelier.':'Demande refusée.');
 }
 async function initialProject(){
  try{
   reference=fail(await client.from('atelier_reference').select('*').eq('id',1).single());
   if(!reference.version_id)return null;
   const version=fail(await client.from('atelier_versions').select('*').eq('id',reference.version_id).single());
   const blob=fail(await client.storage.from('atelier-versions').download(version.object_path));
   if(blob.size>MAX_BYTES)throw Error('Version trop volumineuse.');
   const raw=await blob.text(); validate(JSON.parse(raw)); parentId=version.id;
   return {raw,source:'cloud'};
  }catch(error){throw Error('Référence partagée indisponible : '+errorText(error));}
 }
 // Vignettes, archivage et gestion des membres arrivent avec supabase/003 : tant que la base
 // n'est pas à jour, l'atelier garde son fonctionnement précédent au lieu d'échouer.
 async function detectFeatures(){
  if(features)return features;
  const probe=await client.from('atelier_versions').select('archived_at,thumb_path').limit(1);
  features={team:!probe.error};return features;
 }
 async function list(){
  await getMember();await detectFeatures();
  reference=fail(await client.from('atelier_reference').select('*').eq('id',1).single());
  let query=client.from('atelier_versions').select('*');
  if(features.team&&!(showArchived&&member.role==='admin'))query=query.is('archived_at',null);
  rows=fail(await query.order('created_at',{ascending:false}).order('id').range(page*PAGE_SIZE,(page+1)*PAGE_SIZE));
  await listRequests();
  render();
  try{await loadThumbnails();}catch{}
 }
 async function loadThumbnails(){
  const now=Date.now(),missing=rows.filter(row=>row.thumb_path&&!(thumbUrls.get(row.thumb_path)?.expires>now)).map(row=>row.thumb_path);
  if(missing.length){
   const result=await client.storage.from('atelier-versions').createSignedUrls(missing,3600);
   for(const item of result.data||[])if(item.signedUrl&&!item.error)thumbUrls.set(item.path,{url:item.signedUrl,expires:now+50*60*1000});
  }
  for(const img of el('cloudVersions').querySelectorAll('img[data-thumb]')){const hit=thumbUrls.get(img.dataset.thumb);if(hit)img.src=hit.url;}
 }
 function render(){
  el('cloudRequests').innerHTML=requests.length?'<p class="cloud-subtitle">⚑ Demandes d’accès en attente ('+requests.length+')</p><p class="note">Vérifiez que l’adresse appartient bien à un associé avant d’accepter.</p>'+requests.map(row=>`<article class="cloud-request"><strong>${esc(row.display_name)}</strong><small>${esc(row.email)} · ${esc(new Date(row.created_at).toLocaleString('fr-FR'))}</small><button data-cloud-approve="${esc(row.user_id)}" class="primary">Accepter</button><button data-cloud-reject="${esc(row.user_id)}">Refuser</button></article>`).join(''):'';
  el('cloudRequests').querySelectorAll('[data-cloud-approve]').forEach(button=>button.onclick=()=>action(()=>reviewRequest(button.dataset.cloudApprove,true)));
  el('cloudRequests').querySelectorAll('[data-cloud-reject]').forEach(button=>button.onclick=()=>action(()=>reviewRequest(button.dataset.cloudReject,false)));
  el('cloudIdentity').innerHTML=`<strong>${esc(member.display_name)}</strong><small>${member.role==='admin'?'Administrateur':'Associé'}</small>`;
  el('cloudAvatar').textContent=String(member.display_name||'?').trim().charAt(0).toUpperCase();
  el('cloudPage').textContent='Page '+(page+1);
  el('cloudPrevious').disabled=page===0;
  el('cloudNext').disabled=rows.length<=PAGE_SIZE;
  el('cloudPagination').hidden=page===0&&rows.length<=PAGE_SIZE;
  el('cloudReference').disabled=!reference?.version_id;
  el('cloudReference').title=reference?.version_id?'Version choisie par l’administrateur comme base commune':'Aucune version de référence choisie pour l’instant';
  if(typeof Workspace!=='undefined')Workspace.setBadge(requests.length);
  const admin=member.role==='admin';
  el('cloudAdminTools').hidden=!admin;
  el('cloudArchivedToggle').hidden=!features?.team;el('cloudShowArchived').checked=showArchived;
  el('cloudMembers').hidden=!features?.team;
  el('cloudUpgradeNote').hidden=!!features?.team;
  el('cloudVersions').innerHTML=rows.slice(0,PAGE_SIZE).map(row=>{
   const isReference=reference?.version_id===row.id,mine=row.author_id===user.id,archived=!!row.archived_at,viewing=consultation?.row.id===row.id;
   const thumb=row.thumb_path?`<img class="cloud-thumb" data-thumb="${esc(row.thumb_path)}" alt="Vignette de ${esc(row.title)}" src="${esc(thumbUrls.get(row.thumb_path)?.url||'data:,')}">`:'';
   return `<article class="cloud-version${isReference?' is-reference':''}${archived?' is-archived':''}${viewing?' is-viewing':''}">${thumb}<div class="cloud-version-head"><strong>${esc(row.title)}</strong>${isReference?'<span class="cloud-badge">Référence</span>':''}${archived?'<span class="cloud-badge archived">Archivée</span>':''}</div><small>${esc(row.author_name)}${mine?' (vous)':''} · ${esc(new Date(row.created_at).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'}))}</small>${row.comment?`<p>${esc(row.comment)}</p>`:''}<div class="cloud-version-actions"><button data-cloud-consult="${row.id}" class="primary" title="Regarder cette version sans toucher à votre brouillon">👁 Consulter</button><button data-cloud-open="${row.id}" title="Remplacer votre maquette par une copie modifiable de cette version">Ouvrir une copie</button>${admin&&!isReference&&!archived?`<button data-cloud-reference="${row.id}" title="Faire de cette version la base commune de l’équipe">Définir comme référence</button>`:''}${admin&&features?.team&&!isReference?`<button data-cloud-archive="${row.id}" data-archived="${archived}" title="${archived?'Remettre cette version dans la liste':'Masquer cette version de la liste, sans la supprimer'}">${archived?'Restaurer':'Archiver'}</button>`:''}</div></article>`;
  }).join('')||`<p class="note cloud-empty">${showArchived?'Aucune version sur cette page.':'Aucune version partagée pour l’instant. Partagez la première proposition avec le formulaire ci-dessus.'}</p>`;
  el('cloudVersions').querySelectorAll('[data-cloud-consult]').forEach(button=>button.onclick=()=>action(()=>consultVersion(button.dataset.cloudConsult)));
  el('cloudVersions').querySelectorAll('[data-cloud-open]').forEach(button=>button.onclick=()=>action(()=>openVersion(button.dataset.cloudOpen)));
  el('cloudVersions').querySelectorAll('[data-cloud-reference]').forEach(button=>button.onclick=()=>action(()=>setReference(button.dataset.cloudReference)));
  el('cloudVersions').querySelectorAll('[data-cloud-archive]').forEach(button=>button.onclick=()=>action(()=>archiveVersion(button.dataset.cloudArchive,button.dataset.archived!=='true')));
 }
 async function archiveVersion(id,archive){
  const row=rows.find(r=>r.id===id);
  if(!await ask((archive?'Archiver « ':'Restaurer « ')+(row?.title||'cette version')+(archive?' » ? Elle disparaît de la liste de l’équipe mais reste conservée ; vous pourrez la restaurer.':' » dans la liste de l’équipe ?'))){message('Action annulée.');return;}
  fail(await client.rpc('atelier_archive_version',{target_id:id,archive}));
  await list();message(archive?'Version archivée.':'Version restaurée.');
 }
 async function loadMembers(){
  members=fail(await client.rpc('atelier_list_members'))||[];
  el('cloudMemberList').innerHTML=members.map(m=>{const self=m.user_id===user.id;
   return `<article class="cloud-member${m.active?'':' inactive'}"><strong>${esc(m.display_name)}${self?' (vous)':''}</strong><small>${esc(m.email)} · ${m.role==='admin'?'Administrateur':'Associé'}${m.active?'':' · accès retiré'}</small>${self?'':`<div class="cloud-version-actions"><button data-member="${esc(m.user_id)}" data-role="${m.role==='admin'?'member':'admin'}" data-active="${m.active}">${m.role==='admin'?'Repasser associé':'Nommer administrateur'}</button><button data-member="${esc(m.user_id)}" data-role="${m.role}" data-active="${!m.active}" class="${m.active?'danger':''}">${m.active?'Retirer l’accès':'Rétablir l’accès'}</button></div>`}</article>`;}).join('')||'<p class="note">Aucun membre.</p>';
  el('cloudMemberList').querySelectorAll('[data-member]').forEach(button=>button.onclick=()=>action(()=>updateMember(button.dataset.member,button.dataset.role,button.dataset.active==='true')));
 }
 async function updateMember(id,role,active){
  const m=members.find(x=>x.user_id===id);if(!m)throw Error('Membre introuvable. Actualisez la liste.');
  const text=!active?'Retirer l’accès de '+m.display_name+' ('+m.email+') ? Ses versions restent visibles ; il pourra redemander l’accès.'
   :m.active&&role==='admin'?'Nommer '+m.display_name+' administrateur ? Il pourra valider les comptes, archiver les versions et gérer les membres.'
   :m.active?'Repasser '+m.display_name+' au rôle d’associé ?':'Rétablir l’accès de '+m.display_name+' ('+m.email+') ?';
  if(!await ask(text)){message('Action annulée.');return;}
  fail(await client.rpc('atelier_update_member',{target_id:id,new_role:role,new_active:active}));
  await loadMembers();message('Membre mis à jour.');
 }

 // Consultation : la version s'affiche en lecture seule, le brouillon attend en mémoire, intact.
 async function fetchVersion(id){
  const row=fail(await client.from('atelier_versions').select('*').eq('id',id).single());
  const blob=fail(await client.storage.from('atelier-versions').download(row.object_path));
  if(blob.size>MAX_BYTES)throw Error('Version trop volumineuse.');
  const raw=await blob.text(),candidate=validate(JSON.parse(raw));
  return {row,raw,candidate,loaded:await loadAssets(candidate)};
 }
 async function consultVersion(id){
  if(consultation?.row.id===id)return;
  busy=true;
  try{
   const version=await fetchVersion(id);
   if(!consultation)consultation={draft:snapshot(),selection:clone(selection),undo:[...undoStack],redo:[...redoStack]};
   Object.assign(consultation,{row:version.row,raw:version.raw});
   for(const [key,model] of version.loaded)assetCache.set(key,model);
   state=version.candidate;selection=null;readOnly={title:version.row.title,author:version.row.author_name};
   undoStack.length=0;redoStack.length=0;
   el('readOnlyText').textContent='Consultation de « '+version.row.title+' » · '+version.row.author_name+' · lecture seule';
   el('readOnlyBanner').hidden=false;document.body.classList.add('read-only');
   refresh();render();
   message('Vous consultez « '+version.row.title+' ». Votre brouillon est intact.');
  }finally{busy=false;}
 }
 function exitConsultation(){
  if(!consultation)return false;
  const c=consultation;consultation=null;readOnly=null;
  state=JSON.parse(c.draft);selection=c.selection;
  undoStack.splice(0,undoStack.length,...c.undo);redoStack.splice(0,redoStack.length,...c.redo);
  el('readOnlyBanner').hidden=true;document.body.classList.remove('read-only');
  refresh();if(member)render();
  return c;
 }
 async function editConsulted(){
  const c=exitConsultation();if(!c)return;
  const candidate=validate(JSON.parse(c.raw));
  await backupBeforeReplace('l’ouverture de « '+c.row.title+' »');
  const before=snapshot();
  state=candidate;selection=null;parentId=c.row.id;record(before);persistProject();refresh();render();
  message('Copie de « '+c.row.title+' » ouverte : vous pouvez la modifier. Votre brouillon précédent est dans la copie de secours.');
 }
 async function action(fn){
  if(working||busy)return;
  working=true;el('cloudContent').setAttribute('aria-busy','true');
  el('cloudContent').inert=true;
  message('Connexion à l’espace partagé…');
  try{await fn();}catch(error){message(errorText(error)+(pending?' Cliquez à nouveau sur Enregistrer pour réessayer la même version.':''));}
  finally{working=false;el('cloudContent').inert=false;el('cloudContent').removeAttribute('aria-busy');}
 }
 async function saveVersion(){
  if(consultation)throw Error('Vous consultez la version d’un autre membre : revenez à votre brouillon ou ouvrez-en une copie avant de partager.');
  const title=el('cloudTitle').value.trim(),comment=el('cloudComment').value.trim();
  if(!title)throw Error('Donnez un nom à votre version.');
  if(title.length>100||comment.length>2000)throw Error('Titre ou commentaire trop long.');
  if(!pending){
   const blob=new Blob([snapshot()],{type:'application/json'});
   if(blob.size>MAX_BYTES)throw Error('Cette version dépasse 49 Mo. Retirez des modèles importés ou exportez le projet en JSON.');
   const id=crypto.randomUUID();
   // La vignette est un plus : son absence ou son échec n'empêche jamais le partage.
   const thumb=features?.team&&typeof captureThumbnail==='function'?await captureThumbnail():null;
   pending={blob,thumb,uploaded:false,thumbDone:!thumb,row:{id,title,comment,author_id:user.id,object_path:user.id+'/'+id+'.json',byte_size:blob.size,parent_id:parentId,...(features?.team?{thumb_path:thumb?user.id+'/'+id+'.jpg':null}:{})}};
  }
  // A retry uses the same id and snapshot, including after an uncertain network response.
  const existing=fail(await client.from('atelier_versions').select('id').eq('id',pending.row.id).maybeSingle());
  if(!existing){
   if(!pending.uploaded){
    const upload=await client.storage.from('atelier-versions').upload(pending.row.object_path,pending.blob,{contentType:'application/json',upsert:false});
    if(upload.error){
     // Never overwrite a previous object. Verify its exact content after a lost response.
     const check=fail(await client.storage.from('atelier-versions').download(pending.row.object_path));
     if(await check.text()!==await pending.blob.text())throw upload.error;
    }
    pending.uploaded=true;
   }
   if(!pending.thumbDone){
    const upload=await client.storage.from('atelier-versions').upload(pending.row.thumb_path,pending.thumb,{contentType:'image/jpeg',upsert:false});
    if(upload.error&&!/exist|duplicate/i.test(upload.error.message||''))pending.row.thumb_path=null;
    pending.thumbDone=true;
   }
   fail(await client.from('atelier_versions').insert(pending.row));
  }
  parentId=pending.row.id;pending=null;page=0;
  el('cloudTitle').value='';el('cloudComment').value='';
  message('Version enregistrée. Tous les membres peuvent maintenant la consulter.');
  try{await list();}catch{message('Version enregistrée. Actualisez la liste lorsque la connexion sera rétablie.');}
 }
 async function openVersion(id){
  if(!await ask('Remplacer votre maquette par une copie modifiable de cette version ? Votre travail actuel sera conservé dans la copie de secours de cet appareil.')){message('Ouverture annulée.');return;}
  if(consultation?.row.id===id){await editConsulted();return;}
  exitConsultation();
  busy=true;
  try{
   const {row,candidate,loaded}=await fetchVersion(id),before=snapshot();
   await backupBeforeReplace('l’ouverture de « '+row.title+' »');
   for(const [key,model] of loaded)assetCache.set(key,model);
   state=candidate;selection=null;parentId=id;record(before);persistProject();refresh();
   message('Copie de « '+row.title+' » ouverte. Vos prochaines modifications restent locales jusqu’au partage.');
  }finally{busy=false;}
 }
 async function restoreBackup(){
  exitConsultation();
  await restoreProjectBackup();parentId=null;
  message('Copie de secours récupérée. Le travail affiché avant est à son tour dans la copie de secours.');
 }
 async function setReference(id){
  if(!await ask('Faire de cette version la référence de l’équipe ? Les brouillons de chacun seront conservés.')){message('Changement de référence annulé.');return;}
  fail(await client.rpc('atelier_set_reference',{target_id:id,expected_revision:reference.revision}));
  await list();message('Version de référence mise à jour.');
 }
 function setup(){
  (el('panel-team')||el('inspector')).insertAdjacentHTML('afterbegin',`<div id="cloudPanel"><div class="cloud-identity"><span class="cloud-avatar" id="cloudAvatar" aria-hidden="true"></span><span id="cloudIdentity"></span><button id="cloudLogout" class="cloud-link">Se déconnecter</button></div><p id="cloudMessage" role="status" aria-live="polite"></p><div id="cloudContent"><div id="cloudRequests"></div><section class="cloud-card"><h3>Partager mon travail</h3><p class="note">Crée une nouvelle version visible par toute l’équipe, sans écraser celles des autres.</p><label class="cloud-label">Nom de la version<input id="cloudTitle" maxlength="100" placeholder="Ex. Déplacement du bar"></label><label class="cloud-label">Commentaire (facultatif)<textarea id="cloudComment" maxlength="2000" rows="2" placeholder="Ce qui change, ce qu’il faut regarder…"></textarea></label><button id="cloudSave" class="primary">⇪ Partager cette version</button></section><div class="cloud-section-title"><span>VERSIONS DE L’ÉQUIPE</span><button id="cloudReload" title="Récupérer les dernières versions et demandes">↻ Actualiser</button></div><div id="cloudAdminTools" hidden><label class="check" id="cloudArchivedToggle"><input type="checkbox" id="cloudShowArchived"> Afficher les versions archivées</label><p class="note" id="cloudUpgradeNote" hidden>Vignettes, archivage et gestion des membres s’activeront après l’exécution de <code>supabase/003_team_thumbnails.sql</code>.</p></div><button id="cloudReference" class="cloud-wide">◎ Ouvrir la version de référence</button><div id="cloudVersions"></div><div class="cloud-pagination" id="cloudPagination"><button id="cloudPrevious">‹ Plus récentes</button><span id="cloudPage"></span><button id="cloudNext">Plus anciennes ›</button></div><details id="cloudMembers" hidden><summary>Membres de l’équipe</summary><div id="cloudMemberList"><p class="note">Chargement…</p></div></details><button id="cloudBackup" class="cloud-link" title="Revenir au travail mis de côté avant la dernière ouverture, import ou remise à zéro">↺ Récupérer la copie de secours</button></div></div>`);
  el('cloudShowArchived').onchange=()=>action(async()=>{showArchived=el('cloudShowArchived').checked;page=0;await list();message(showArchived?'Les versions archivées sont affichées.':'');});
  el('cloudMembers').addEventListener('toggle',()=>{if(el('cloudMembers').open)action(loadMembers);});
  el('readOnlyExit').onclick=()=>{if(exitConsultation())message('Retour à votre brouillon.');};
  el('readOnlyEdit').onclick=()=>action(()=>openVersion(consultation?.row.id));
  el('cloudSave').onclick=()=>action(saveVersion);
  el('cloudReload').onclick=()=>action(async()=>{await list();message('Liste à jour.');});
  el('cloudReference').onclick=()=>action(async()=>{reference=fail(await client.from('atelier_reference').select('*').eq('id',1).single());if(reference.version_id)await openVersion(reference.version_id);});
  el('cloudPrevious').onclick=()=>action(async()=>{page=Math.max(0,page-1);await list();message('');});
  el('cloudNext').onclick=()=>action(async()=>{page++;await list();message('');});
  el('cloudBackup').onclick=()=>action(restoreBackup);
  el('cloudLogout').onclick=()=>action(async()=>{
   exitConsultation();
   const ok=await dbPut(storageKey(),snapshot());
   if(!ok&&!await ask('La sauvegarde locale a échoué. Se déconnecter malgré tout ?'))return;
   fail(await client.auth.signOut({scope:'local'}));location.reload();
  });
  action(async()=>{
   await list();
   message(requests.length?requests.length+' demande(s) d’accès attendent votre validation ci-dessous.':'Vos modifications restent sur cet appareil tant que vous ne partagez pas de version.');
   if(requests.length&&typeof Workspace!=='undefined')Workspace.show('team');
  });
  if(typeof Workspace!=='undefined')Workspace.welcome('atelier-bienvenue:'+user.id);
 }
 async function enter(session){
  user=session.user;
  if(!await findMember()){await showWaiting();return;}
  if(started)return;
  el('cloudWaiting').hidden=true;el('cloudLoginForm').hidden=false;
  // The first opening may need the shared reference: check before hiding the login screen.
  started=true;
  el('cloudLogin').close();
  try{await init();setup();}catch(error){started=false;el('cloudLogin').showModal();throw error;}
 }
 async function boot(){
  const dialog=el('cloudLogin'),status=el('cloudLoginStatus'),form=el('cloudLoginForm');
  dialog.addEventListener('cancel',event=>event.preventDefault());dialog.showModal();
  try{
   const config=globalThis.ATELIER_CLOUD;
   if(!globalThis.supabase||!config?.publishableKey)throw Error('Le service de connexion est indisponible. Rechargez cette page.');
   client=supabase.createClient(config.url,config.publishableKey,{auth:{storageKey:'atelier-fives-cail-auth',detectSessionInUrl:false}});
   form.onsubmit=async event=>{
    event.preventDefault();el('cloudLoginButton').disabled=true;status.textContent=signup?'Création du compte…':'Connexion…';
    try{
     const email=el('cloudEmail').value.trim(),password=el('cloudPassword').value,name=el('cloudName').value.trim();
     let data;
     if(signup){
      if(!name)throw Error('Indiquez votre prénom et votre nom.');
      if(password.length<8)throw Error('Choisissez un mot de passe d’au moins 8 caractères.');
      data=fail(await client.auth.signUp({email,password,options:{data:{display_name:name.slice(0,100)}}}));
      // Supabase hides existing addresses behind an empty identity list.
      if(data.user&&!data.user.identities?.length)throw Error('Un compte existe déjà avec cette adresse. Connectez-vous.');
      if(!data.session)throw Error('Compte créé, mais la confirmation par e-mail est activée dans Supabase. Contactez l’administrateur.');
     }else data=fail(await client.auth.signInWithPassword({email,password}));
     el('cloudPassword').value='';await enter(data.session);
    }
    catch(error){status.textContent=errorText(error);}finally{el('cloudLoginButton').disabled=false;}
   };
   el('cloudModeSwitch').onclick=()=>setSignup(!signup);
   el('cloudWaitingCheck').onclick=async()=>{
    status.textContent='Vérification…';
    try{const session=fail(await client.auth.getSession()).session;if(!session)location.reload();else await enter(session);}
    catch(error){status.textContent=errorText(error);}
   };
   el('cloudWaitingRequest').onclick=async()=>{
    try{fail(await client.rpc('atelier_request_access'));await showWaiting();}
    catch(error){status.textContent=errorText(error);}
   };
   el('cloudWaitingLogout').onclick=async()=>{
    try{fail(await client.auth.signOut({scope:'local'}));}catch{}
    location.reload();
   };
   client.auth.onAuthStateChange((event,session)=>{
    if(started&&(event==='SIGNED_OUT'||session&&session.user.id!==user.id))location.reload();
   });
   const session=fail(await client.auth.getSession()).session;
   if(session)await enter(session);
  }catch(error){status.textContent=errorText(error);}
 }
 return {boot,storageKey,localKey,initialProject,configured:()=>!!user,consulting:()=>!!consultation,
  // Entry points for the behavioural tests (the buttons are rendered as HTML strings there).
  test:{archive:(id,on)=>action(()=>archiveVersion(id,on)),consult:id=>action(()=>consultVersion(id)),loadMembers,updateMember}};
})();
