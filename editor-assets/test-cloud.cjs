// Behavioral tests for the browser workflow; database policies are tested separately in SQL.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const source=fs.readFileSync(__dirname+'/cloud.js','utf8');
const flush=async()=>{for(let i=0;i<12;i++)await new Promise(setImmediate);};
async function fixture(options={}){
 const nodes=new Map(),files=new Map(),drafts=new Map(),versions=[];
 const user={id:'10000000-0000-4000-8000-000000000001'};
 const member={user_id:user.id,display_name:'Alice',role:options.role||'admin',active:true};
 const reference={id:1,version_id:null,revision:0};
 const requests=options.requests||[],reviews=[],signups=[],rpcCalls=[],bodyClasses=new Set();
 let uploads=0,failInsert=!!options.failInsert,initializations=0,backupAllowed=true,session=options.signedOut?null:{user};
 function element(id){
  if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',innerHTML:'',disabled:false,hidden:false,inert:false,
   setAttribute(){},removeAttribute(){},addEventListener(){},insertAdjacentHTML(){},querySelectorAll(){return [];},
   showModal(){if(id==='cloudConfirm'){this.returnValue=options.cancel?'cancel':'confirm';queueMicrotask(()=>this.onclose());}},close(){}});
  return nodes.get(id);
 }
 const client={
  auth:{getSession:async()=>({data:{session}}),onAuthStateChange(){},signOut:async()=>({}),signInWithPassword:async()=>({data:{session:{user}}}),
   signUp:async args=>{signups.push(args);if(options.existing)return {data:{user:{...user,identities:[]},session:null}};session={user};requests.push({user_id:user.id,email:args.email,display_name:args.options.data.display_name,status:'pending'});return {data:{user:{...user,identities:[{}]},session}};}},
  from(table){
   const filters=[];let payload=null,one=false,lo=0,hi=100,columns='*';
   // A database without migration 003 rejects the new columns, as Supabase would.
   const q={select(c='*'){columns=c;return q;},eq(k,v){filters.push([k,v]);return q;},is(k,v){filters.push([k,v]);return q;},limit(){return q;},order(){return q;},range(a,b){lo=a;hi=b;return q;},maybeSingle(){one=true;return q;},single(){one=true;return q;},insert(v){payload=v;return q;},
    then(resolve,reject){return Promise.resolve().then(()=>{
     if(options.legacy&&(/archived_at|thumb_path/.test(columns)||filters.some(([k])=>k==='archived_at')||payload&&'thumb_path' in payload))return {error:{message:'column atelier_versions.archived_at does not exist'}};
     if(payload){if(failInsert){failInsert=false;return {error:{message:'Réseau interrompu'}};}versions.push({archived_at:null,...payload,author_name:'Alice',created_at:'2026-09-15T10:00:00Z'});return {data:null};}
     let data=table==='atelier_members'?(options.noMember?[]:[member]):table==='atelier_reference'?[reference]:table==='atelier_access_requests'?requests:versions;
     data=data.filter(row=>filters.every(([key,value])=>(row[key]??null)===value)).slice(lo,hi+1);
     return {data:one?(data[0]||null):data.map(x=>({...x}))};
    }).then(resolve,reject);}};return q;
  },
  storage:{from(){return {upload:async(path,blob,opts)=>{assert.equal(opts.upsert,false);uploads++;if(files.has(path))return {error:{message:'Duplicate'}};files.set(path,blob);return {};},download:async path=>files.has(path)?{data:files.get(path)}:{error:{message:'Fichier absent'}},
   createSignedUrls:async paths=>({data:paths.map(path=>({path,signedUrl:'https://signed.example/'+path}))})};}},
  rpc:async(name,args)=>{
   if(name==='atelier_review_request'){reviews.push(args);const i=requests.findIndex(row=>row.user_id===args.target_id);requests.splice(i,1);return {};}
   if(name==='atelier_archive_version'){const v=versions.find(row=>row.id===args.target_id);if(reference.version_id===args.target_id&&args.archive)return {error:{message:'La version de référence ne peut pas être archivée.'}};v.archived_at=args.archive?'2026-09-15T12:00:00Z':null;return {};}
   if(name==='atelier_list_members')return {data:[{user_id:user.id,display_name:'Alice',role:'admin',active:true,email:'alice@example.com'},{user_id:'paul',display_name:'Paul',role:'member',active:true,email:'paul@example.com'}]};
   if(name==='atelier_update_member'){rpcCalls.push(args);return {};}
   assert.equal(name,'atelier_set_reference');if(member.role!=='admin')return {error:{message:'Accès administrateur requis.'}};if(args.expected_revision!==reference.revision)return {error:{message:'La référence a changé.'}};reference.version_id=args.target_id;reference.revision++;return {};}
 };
 const context=vm.createContext({console,Blob,crypto,queueMicrotask,document:{getElementById:element,body:{classList:{add:c=>bodyClasses.add(c),remove:c=>bodyClasses.delete(c)}}},
  readOnly:null,undoStack:['undo-1'],redoStack:[],clone:v=>v==null?v:JSON.parse(JSON.stringify(v)),
  captureThumbnail:async()=>options.noThumb?null:new Blob(['jpeg'],{type:'image/jpeg'}),
  ATELIER_CLOUD:{url:'https://example.supabase.co',publishableKey:'public'},supabase:{createClient:()=>client},
  state:{meta:{name:'Projet'},walls:[],zones:[],furniture:[],assets:{custom:{data:'base64-preserved'}},reference:{data:'image-preserved'}},
  busy:false,selection:null,assetCache:new Map(),
  snapshot(){return JSON.stringify(context.state);},validate:p=>p,loadAssets:async()=>new Map(),
  dbPut:async(key,value)=>{drafts.set(key,value);return true;},dbGet:async key=>drafts.get(key),
  // Stand-ins for project.js: the real backup slot is tested in test-editor.cjs.
  backupBeforeReplace:async reason=>{if(!backupAllowed)throw Error('Impossible de conserver une copie de secours de votre travail.');drafts.set('backup',JSON.stringify({reason,project:context.snapshot()}));},
  restoreProjectBackup:async()=>{const entry=drafts.get('backup');if(!entry)throw Error('Aucune copie de secours sur cet appareil.');context.state=JSON.parse(JSON.parse(entry).project);},
  record(){},persistProject(){},refresh(){},init:async()=>{initializations++;},
  importJson:async blob=>{context.state=JSON.parse(await blob.text());},location:{reload(){}},
  esc:s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))});
 vm.runInContext(source,context);
 await vm.runInContext('AtelierCloud.boot()',context);await flush();
 return {context,element,files,versions,reference,drafts,member,requests,reviews,signups,rpcCalls,bodyClasses,uploads:()=>uploads,initializations:()=>initializations,
  refuseBackup(){backupAllowed=false;},async click(id){await element(id).onclick();await flush();},
  async save(title='Proposition'){element('cloudTitle').value=title;await this.click('cloudSave');}};
}
test('An authenticated account without membership never initializes the editor',async()=>{
 const f=await fixture({noMember:true});assert.equal(f.initializations(),0);assert.equal(f.element('cloudWaiting').hidden,false);assert.match(f.element('cloudWaitingText').textContent,/pas encore/);assert.equal(f.element('cloudWaitingRequest').hidden,false);
});
test('A new account waits for approval without opening the editor',async()=>{
 const f=await fixture({noMember:true,signedOut:true});
 await f.element('cloudModeSwitch').onclick();
 f.element('cloudName').value='Paul Martin';f.element('cloudEmail').value='paul@example.com';f.element('cloudPassword').value='motdepasse1';
 await f.element('cloudLoginForm').onsubmit({preventDefault(){}});await flush();
 assert.equal(f.signups[0].options.data.display_name,'Paul Martin');assert.equal(f.initializations(),0);
 assert.match(f.element('cloudWaitingText').textContent,/en attente/);assert.equal(f.element('cloudPassword').value,'');
});
test('Sign-up refuses a short password or a missing name before calling Supabase',async()=>{
 const f=await fixture({noMember:true,signedOut:true});await f.element('cloudModeSwitch').onclick();
 f.element('cloudName').value='Paul';f.element('cloudEmail').value='paul@example.com';f.element('cloudPassword').value='court';
 await f.element('cloudLoginForm').onsubmit({preventDefault(){}});assert.equal(f.signups.length,0);assert.match(f.element('cloudLoginStatus').textContent,/8 caractères/);
 f.element('cloudName').value=' ';f.element('cloudPassword').value='motdepasse1';
 await f.element('cloudLoginForm').onsubmit({preventDefault(){}});assert.equal(f.signups.length,0);assert.match(f.element('cloudLoginStatus').textContent,/prénom/);
});
test('Signing up with an existing address asks to sign in instead',async()=>{
 const f=await fixture({noMember:true,signedOut:true,existing:true});await f.element('cloudModeSwitch').onclick();
 f.element('cloudName').value='Paul';f.element('cloudEmail').value='paul@example.com';f.element('cloudPassword').value='motdepasse1';
 await f.element('cloudLoginForm').onsubmit({preventDefault(){}});assert.match(f.element('cloudLoginStatus').textContent,/existe déjà/);assert.equal(f.initializations(),0);
});
test('A rejected request is shown as such and cannot be resent from the page',async()=>{
 const user_id='10000000-0000-4000-8000-000000000001';
 const f=await fixture({noMember:true,requests:[{user_id,email:'x@example.com',display_name:'X',status:'rejected'}]});
 assert.match(f.element('cloudWaitingText').textContent,/pas été acceptée/);assert.equal(f.element('cloudWaitingRequest').hidden,true);
});
test('Administrators see pending requests, escaped, with approve and reject controls',async()=>{
 const request={user_id:'10000000-0000-4000-8000-000000000009',email:'sophie@example.com',display_name:'<b>Sophie</b>',status:'pending',created_at:'2026-09-15T10:00:00Z'};
 const f=await fixture({requests:[request]});
 const html=f.element('cloudRequests').innerHTML;assert.match(html,/data-cloud-approve/);assert.match(html,/data-cloud-reject/);assert.match(html,/&lt;b&gt;Sophie/);assert.ok(!html.includes('<b>'));assert.match(html,/sophie@example.com/);
});
test('Members never see access requests',async()=>{
 const request={user_id:'10000000-0000-4000-8000-000000000009',email:'sophie@example.com',display_name:'Sophie',status:'pending',created_at:'2026-09-15T10:00:00Z'};
 const f=await fixture({role:'member',requests:[request]});assert.equal(f.element('cloudRequests').innerHTML,'');
});
test('Draft keys are scoped to the signed-in account',async()=>{
 const f=await fixture();assert.equal(vm.runInContext('AtelierCloud.storageKey()',f.context),'courant:10000000-0000-4000-8000-000000000001');assert.match(vm.runInContext('AtelierCloud.localKey("draft")',f.context),/^draft:1000/);
});
test('A shared snapshot preserves imported assets and image data',async()=>{
 const f=await fixture();await f.save();assert.equal(f.versions.length,1);const data=JSON.parse(await [...f.files.values()][0].text());assert.equal(data.assets.custom.data,'base64-preserved');assert.equal(data.reference.data,'image-preserved');assert.match(f.element('cloudMessage').textContent,/enregistrée/);
});
test('Retry after metadata failure reuses the upload and original snapshot',async()=>{
 const f=await fixture({failInsert:true});await f.save('Première');assert.equal(f.versions.length,0);assert.equal(f.uploads(),2);
 f.context.state.meta.name='Modification ultérieure';await f.save('Autre titre');assert.equal(f.uploads(),2);assert.equal(f.versions.length,1);assert.equal(f.versions[0].title,'Première');assert.equal(JSON.parse(await [...f.files.values()][0].text()).meta.name,'Projet');
});
test('Two saves create separate versions rather than overwriting a snapshot',async()=>{
 const f=await fixture();await f.save('A');f.context.state.meta.name='B';await f.save('B');assert.equal([...f.files.keys()].filter(k=>k.endsWith('.json')).length,2);assert.notEqual(f.versions[0].id,f.versions[1].id);
});
test('Version titles and comments are escaped before rendering',async()=>{
 const f=await fixture();f.element('cloudComment').value='<script>bad()</script>';await f.save('<img onerror=bad()>');assert.ok(!f.element('cloudVersions').innerHTML.includes('<img onerror'));assert.match(f.element('cloudVersions').innerHTML,/&lt;script&gt;/);
});
test('Only administrators see reference promotion controls',async()=>{
 const f=await fixture({role:'member'});await f.save();assert.ok(!f.element('cloudVersions').innerHTML.includes('data-cloud-reference'));
});
test('Opening a reference creates a backup before replacing the local draft',async()=>{
 const f=await fixture();await f.save();f.reference.version_id=f.versions[0].id;f.context.state.meta.name='Brouillon à garder';await f.click('cloudReference');assert.equal(f.context.state.meta.name,'Projet');const entry=JSON.parse(f.drafts.get('backup'));assert.equal(JSON.parse(entry.project).meta.name,'Brouillon à garder');assert.match(entry.reason,/ouverture/);await f.click('cloudBackup');assert.equal(f.context.state.meta.name,'Brouillon à garder');
});
test('A failed local backup prevents replacing the current project',async()=>{
 const f=await fixture();await f.save();f.reference.version_id=f.versions[0].id;f.context.state.meta.name='Ne pas perdre';f.refuseBackup();await f.click('cloudReference');assert.equal(f.context.state.meta.name,'Ne pas perdre');assert.match(f.element('cloudMessage').textContent,/copie de secours/);assert.equal(f.context.busy,false);
});
test('Cancelling an opening preserves the current draft',async()=>{
 const f=await fixture({cancel:true});await f.save();f.reference.version_id=f.versions[0].id;f.context.state.meta.name='Courant';await f.click('cloudReference');assert.equal(f.context.state.meta.name,'Courant');assert.equal(f.drafts.has('backup'),false);
});
test('A shared version carries a thumbnail shown through a signed link',async()=>{
 const f=await fixture();await f.save('Avec vignette');
 const row=f.versions[0];assert.equal(row.thumb_path,row.author_id+'/'+row.id+'.jpg');assert.ok(f.files.has(row.thumb_path));
 assert.match(f.element('cloudVersions').innerHTML,/data-thumb="[^"]+\.jpg"/);
});
test('Without migration 003 the atelier keeps working: no thumbnail, no archive filter',async()=>{
 const f=await fixture({legacy:true});await f.save('Ancienne base');
 assert.equal(f.versions.length,1);assert.equal('thumb_path' in f.versions[0],false);
 assert.equal(f.element('cloudUpgradeNote').hidden,false);assert.equal(f.element('cloudMembers').hidden,true);
 assert.ok(!f.element('cloudVersions').innerHTML.includes('data-cloud-archive'));
});
test('Archived versions leave the list until an administrator shows them again',async()=>{
 const f=await fixture();await f.save('A garder');await f.save('A archiver');
 const target=f.versions.find(v=>v.title==='A archiver');
 assert.match(f.element('cloudVersions').innerHTML,/data-cloud-archive/);
 await vm.runInContext(`AtelierCloud.test.archive("${target.id}",true)`,f.context);await flush();
 assert.ok(!f.element('cloudVersions').innerHTML.includes('A archiver'));
 f.element('cloudShowArchived').checked=true;await f.element('cloudShowArchived').onchange();await flush();
 assert.match(f.element('cloudVersions').innerHTML,/A archiver[\s\S]*Archivée/);
});
test('Consulting a version is read-only and leaves the draft, history and storage untouched',async()=>{
 const f=await fixture();f.context.state.meta.name='Partagée';await f.save('Version de Paul');
 f.context.state.meta.name='Mon brouillon';const id=f.versions[0].id;
 await vm.runInContext(`AtelierCloud.test.consult("${id}")`,f.context);await flush();
 assert.equal(f.context.state.meta.name,'Partagée');assert.ok(f.context.readOnly);assert.ok(f.bodyClasses.has('read-only'));
 assert.equal(f.element('readOnlyBanner').hidden,false);assert.equal(f.context.undoStack.length,0);
 // Sharing while consulting is refused rather than publishing somebody else's version as yours.
 await f.save('Tentative');assert.equal(f.versions.length,1);assert.match(f.element('cloudMessage').textContent,/brouillon/);
 await f.click('readOnlyExit');
 assert.equal(f.context.state.meta.name,'Mon brouillon');assert.equal(f.context.readOnly,null);assert.deepEqual([...f.context.undoStack],['undo-1']);
 assert.equal(f.drafts.has('backup'),false);
});
test('Editing a consulted version backs up the real draft, not the consulted one',async()=>{
 const f=await fixture();f.context.state.meta.name='Partagée';await f.save('Version de Paul');
 f.context.state.meta.name='Mon brouillon';const id=f.versions[0].id;
 await vm.runInContext(`AtelierCloud.test.consult("${id}")`,f.context);await flush();
 await f.click('readOnlyEdit');
 assert.equal(f.context.state.meta.name,'Partagée');assert.equal(f.context.readOnly,null);
 assert.equal(JSON.parse(JSON.parse(f.drafts.get('backup')).project).meta.name,'Mon brouillon');
});
test('Administrators manage members with a confirmation; their own row has no buttons',async()=>{
 const f=await fixture();
 await vm.runInContext('AtelierCloud.test.loadMembers()',f.context);
 const html=f.element('cloudMemberList').innerHTML;
 assert.match(html,/paul@example.com/);assert.equal((html.match(/data-member="paul"/g)||[]).length,2);assert.ok(!html.includes('data-member="'+f.member.user_id+'"'));
 await vm.runInContext('AtelierCloud.test.updateMember("paul","member",false)',f.context);await flush();
 assert.equal(JSON.stringify(f.rpcCalls[0]),JSON.stringify({target_id:'paul',new_role:'member',new_active:false}));
});
test('An empty title never uploads a file',async()=>{
 const f=await fixture();await f.save('  ');assert.equal(f.uploads(),0);assert.match(f.element('cloudMessage').textContent,/nom/);
});
