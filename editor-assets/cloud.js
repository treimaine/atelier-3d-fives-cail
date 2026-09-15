'use strict';
// Shared snapshots are immutable. The browser keeps a separate draft per account.
const AtelierCloud = (() => {
 const MAX_BYTES=49*1024*1024, PAGE_SIZE=20;
 let client, user, member, reference, rows=[], requests=[], page=0, pending=null, started=false, working=false, signup=false;
 let parentId=null;
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
 async function list(){
  await getMember();
  reference=fail(await client.from('atelier_reference').select('*').eq('id',1).single());
  rows=fail(await client.from('atelier_versions').select('*').order('created_at',{ascending:false}).order('id').range(page*PAGE_SIZE,(page+1)*PAGE_SIZE));
  await listRequests();
  render();
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
  el('cloudVersions').innerHTML=rows.slice(0,PAGE_SIZE).map(row=>{
   const isReference=reference?.version_id===row.id,mine=row.author_id===user.id;
   return `<article class="cloud-version${isReference?' is-reference':''}"><div class="cloud-version-head"><strong>${esc(row.title)}</strong>${isReference?'<span class="cloud-badge">Référence</span>':''}</div><small>${esc(row.author_name)}${mine?' (vous)':''} · ${esc(new Date(row.created_at).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'}))}</small>${row.comment?`<p>${esc(row.comment)}</p>`:''}<div class="cloud-version-actions"><button data-cloud-open="${row.id}" title="Charger une copie de cette version dans votre maquette">Ouvrir</button>${member.role==='admin'&&!isReference?`<button data-cloud-reference="${row.id}" title="Faire de cette version la base commune de l’équipe">Définir comme référence</button>`:''}</div></article>`;
  }).join('')||'<p class="note cloud-empty">Aucune version partagée pour l’instant. Partagez la première proposition avec le formulaire ci-dessus.</p>';
  el('cloudVersions').querySelectorAll('[data-cloud-open]').forEach(button=>button.onclick=()=>action(()=>openVersion(button.dataset.cloudOpen)));
  el('cloudVersions').querySelectorAll('[data-cloud-reference]').forEach(button=>button.onclick=()=>action(()=>setReference(button.dataset.cloudReference)));
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
  const title=el('cloudTitle').value.trim(),comment=el('cloudComment').value.trim();
  if(!title)throw Error('Donnez un nom à votre version.');
  if(title.length>100||comment.length>2000)throw Error('Titre ou commentaire trop long.');
  if(!pending){
   const blob=new Blob([snapshot()],{type:'application/json'});
   if(blob.size>MAX_BYTES)throw Error('Cette version dépasse 49 Mo. Retirez des modèles importés ou exportez le projet en JSON.');
   const id=crypto.randomUUID();
   pending={blob,uploaded:false,row:{id,title,comment,author_id:user.id,object_path:user.id+'/'+id+'.json',byte_size:blob.size,parent_id:parentId}};
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
   fail(await client.from('atelier_versions').insert(pending.row));
  }
  parentId=pending.row.id;pending=null;page=0;
  el('cloudTitle').value='';el('cloudComment').value='';
  message('Version enregistrée. Tous les membres peuvent maintenant la consulter.');
  try{await list();}catch{message('Version enregistrée. Actualisez la liste lorsque la connexion sera rétablie.');}
 }
 async function openVersion(id){
  if(!await ask('Ouvrir cette version ? Votre travail actuel sera conservé dans une copie de secours sur cet appareil.')){message('Ouverture annulée.');return;}
  busy=true;
  try{
   const row=fail(await client.from('atelier_versions').select('*').eq('id',id).single());
   const blob=fail(await client.storage.from('atelier-versions').download(row.object_path));
   if(blob.size>MAX_BYTES)throw Error('Version trop volumineuse.');
   const candidate=validate(JSON.parse(await blob.text())),loaded=await loadAssets(candidate),before=snapshot();
   const backup=await dbPut('avant-ouverture:'+user.id,before);
   if(!backup)throw Error('Impossible de conserver votre copie de secours. Exportez votre projet et libérez du stockage avant de réessayer.');
   for(const [key,model] of loaded)assetCache.set(key,model);
   state=candidate;selection=null;parentId=id;record(before);persistProject();refresh();
   message('Copie de « '+row.title+' » ouverte. Vos prochaines modifications restent locales jusqu’au partage.');
  }finally{busy=false;}
 }
 async function restoreBackup(){
  const raw=await dbGet('avant-ouverture:'+user.id);
  if(!raw)throw Error('Aucune copie de secours sur cet appareil.');
  busy=true;
  try{
   const candidate=validate(JSON.parse(raw)),loaded=await loadAssets(candidate),before=snapshot();
   for(const [key,model] of loaded)assetCache.set(key,model);
   state=candidate;selection=null;parentId=null;record(before);persistProject();refresh();
   message('Copie de secours chargée.');
  }finally{busy=false;}
 }
 async function setReference(id){
  if(!await ask('Faire de cette version la référence de l’équipe ? Les brouillons de chacun seront conservés.')){message('Changement de référence annulé.');return;}
  fail(await client.rpc('atelier_set_reference',{target_id:id,expected_revision:reference.revision}));
  await list();message('Version de référence mise à jour.');
 }
 function setup(){
  (el('panel-team')||el('inspector')).insertAdjacentHTML('afterbegin',`<div id="cloudPanel"><div class="cloud-identity"><span class="cloud-avatar" id="cloudAvatar" aria-hidden="true"></span><span id="cloudIdentity"></span><button id="cloudLogout" class="cloud-link">Se déconnecter</button></div><p id="cloudMessage" role="status" aria-live="polite"></p><div id="cloudContent"><div id="cloudRequests"></div><section class="cloud-card"><h3>Partager mon travail</h3><p class="note">Crée une nouvelle version visible par toute l’équipe, sans écraser celles des autres.</p><label class="cloud-label">Nom de la version<input id="cloudTitle" maxlength="100" placeholder="Ex. Déplacement du bar"></label><label class="cloud-label">Commentaire (facultatif)<textarea id="cloudComment" maxlength="2000" rows="2" placeholder="Ce qui change, ce qu’il faut regarder…"></textarea></label><button id="cloudSave" class="primary">⇪ Partager cette version</button></section><div class="cloud-section-title"><span>VERSIONS DE L’ÉQUIPE</span><button id="cloudReload" title="Récupérer les dernières versions et demandes">↻ Actualiser</button></div><button id="cloudReference" class="cloud-wide">◎ Ouvrir la version de référence</button><div id="cloudVersions"></div><div class="cloud-pagination" id="cloudPagination"><button id="cloudPrevious">‹ Plus récentes</button><span id="cloudPage"></span><button id="cloudNext">Plus anciennes ›</button></div><button id="cloudBackup" class="cloud-link" title="Revenir au travail mis de côté lors de la dernière ouverture d’une version">↺ Retrouver mon travail d’avant la dernière ouverture</button></div></div>`);
  el('cloudSave').onclick=()=>action(saveVersion);
  el('cloudReload').onclick=()=>action(async()=>{await list();message('Liste à jour.');});
  el('cloudReference').onclick=()=>action(async()=>{reference=fail(await client.from('atelier_reference').select('*').eq('id',1).single());if(reference.version_id)await openVersion(reference.version_id);});
  el('cloudPrevious').onclick=()=>action(async()=>{page=Math.max(0,page-1);await list();message('');});
  el('cloudNext').onclick=()=>action(async()=>{page++;await list();message('');});
  el('cloudBackup').onclick=()=>action(restoreBackup);
  el('cloudLogout').onclick=()=>action(async()=>{
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
 return {boot,storageKey,localKey,initialProject,configured:()=>!!user};
})();
