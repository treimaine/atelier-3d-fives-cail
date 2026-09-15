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
 const requests=options.requests||[],reviews=[],signups=[];
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
   const filters=[];let payload=null,one=false,lo=0,hi=100;
   const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},order(){return q;},range(a,b){lo=a;hi=b;return q;},maybeSingle(){one=true;return q;},single(){one=true;return q;},insert(v){payload=v;return q;},
    then(resolve,reject){return Promise.resolve().then(()=>{
     if(payload){if(failInsert){failInsert=false;return {error:{message:'Réseau interrompu'}};}versions.push({...payload,author_name:'Alice',created_at:'2026-09-15T10:00:00Z'});return {data:null};}
     let data=table==='atelier_members'?(options.noMember?[]:[member]):table==='atelier_reference'?[reference]:table==='atelier_access_requests'?requests:versions;
     data=data.filter(row=>filters.every(([key,value])=>row[key]===value)).slice(lo,hi+1);
     return {data:one?(data[0]||null):data.map(x=>({...x}))};
    }).then(resolve,reject);}};return q;
  },
  storage:{from(){return {upload:async(path,blob,opts)=>{assert.equal(opts.upsert,false);uploads++;if(files.has(path))return {error:{message:'Duplicate'}};files.set(path,blob);return {};},download:async path=>files.has(path)?{data:files.get(path)}:{error:{message:'Fichier absent'}}};}},
  rpc:async(name,args)=>{
   if(name==='atelier_review_request'){reviews.push(args);const i=requests.findIndex(row=>row.user_id===args.target_id);requests.splice(i,1);return {};}
   assert.equal(name,'atelier_set_reference');if(member.role!=='admin')return {error:{message:'Accès administrateur requis.'}};if(args.expected_revision!==reference.revision)return {error:{message:'La référence a changé.'}};reference.version_id=args.target_id;reference.revision++;return {};}
 };
 const context=vm.createContext({console,Blob,crypto,queueMicrotask,document:{getElementById:element},
  ATELIER_CLOUD:{url:'https://example.supabase.co',publishableKey:'public'},supabase:{createClient:()=>client},
  state:{meta:{name:'Projet'},walls:[],zones:[],furniture:[],assets:{custom:{data:'base64-preserved'}},reference:{data:'image-preserved'}},
  busy:false,selection:null,assetCache:new Map(),
  snapshot(){return JSON.stringify(context.state);},validate:p=>p,loadAssets:async()=>new Map(),
  dbPut:async(key,value)=>{if(!backupAllowed)return null;drafts.set(key,value);return true;},dbGet:async key=>drafts.get(key),
  record(){},persistProject(){},refresh(){},init:async()=>{initializations++;},
  importJson:async blob=>{context.state=JSON.parse(await blob.text());},location:{reload(){}},
  esc:s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))});
 vm.runInContext(source,context);
 await vm.runInContext('AtelierCloud.boot()',context);await flush();
 return {context,element,files,versions,reference,drafts,member,requests,reviews,signups,uploads:()=>uploads,initializations:()=>initializations,
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
 const f=await fixture({failInsert:true});await f.save('Première');assert.equal(f.versions.length,0);assert.equal(f.uploads(),1);
 f.context.state.meta.name='Modification ultérieure';await f.save('Autre titre');assert.equal(f.uploads(),1);assert.equal(f.versions.length,1);assert.equal(f.versions[0].title,'Première');assert.equal(JSON.parse(await [...f.files.values()][0].text()).meta.name,'Projet');
});
test('Two saves create separate versions rather than overwriting a snapshot',async()=>{
 const f=await fixture();await f.save('A');f.context.state.meta.name='B';await f.save('B');assert.equal(f.files.size,2);assert.notEqual(f.versions[0].id,f.versions[1].id);
});
test('Version titles and comments are escaped before rendering',async()=>{
 const f=await fixture();f.element('cloudComment').value='<script>bad()</script>';await f.save('<img onerror=bad()>');assert.ok(!f.element('cloudVersions').innerHTML.includes('<img'));assert.match(f.element('cloudVersions').innerHTML,/&lt;script&gt;/);
});
test('Only administrators see reference promotion controls',async()=>{
 const f=await fixture({role:'member'});await f.save();assert.ok(!f.element('cloudVersions').innerHTML.includes('data-cloud-reference'));
});
test('Opening a reference creates a backup before replacing the local draft',async()=>{
 const f=await fixture();await f.save();f.reference.version_id=f.versions[0].id;f.context.state.meta.name='Brouillon à garder';await f.click('cloudReference');assert.equal(f.context.state.meta.name,'Projet');assert.equal(JSON.parse([...f.drafts.values()][0]).meta.name,'Brouillon à garder');await f.click('cloudBackup');assert.equal(f.context.state.meta.name,'Brouillon à garder');
});
test('A failed local backup prevents replacing the current project',async()=>{
 const f=await fixture();await f.save();f.reference.version_id=f.versions[0].id;f.context.state.meta.name='Ne pas perdre';f.refuseBackup();await f.click('cloudReference');assert.equal(f.context.state.meta.name,'Ne pas perdre');assert.match(f.element('cloudMessage').textContent,/copie de secours/);assert.equal(f.context.busy,false);
});
test('Cancelling an opening preserves the current draft',async()=>{
 const f=await fixture({cancel:true});await f.save();f.reference.version_id=f.versions[0].id;f.context.state.meta.name='Courant';await f.click('cloudReference');assert.equal(f.context.state.meta.name,'Courant');assert.equal(f.drafts.size,0);
});
test('An empty title never uploads a file',async()=>{
 const f=await fixture();await f.save('  ');assert.equal(f.uploads(),0);assert.match(f.element('cloudMessage').textContent,/nom/);
});
