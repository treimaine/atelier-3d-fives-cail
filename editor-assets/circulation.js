'use strict';
// Lot D — contrôle de circulation indicatif. Le sol est rastérisé, on mesure la distance de
// chaque cellule libre au premier obstacle, puis on ne garde que les cellules où un gabarit de
// la largeur demandée passe. Ce qui reste connecté à une porte extérieure est desservi.
// Ce n'est ni un calcul d'itinéraire accessible, ni une validation réglementaire.
const CIRC_CELL=.1,CIRC_MAX_CELLS=500000,CIRC_HEAD=1.9;
let circulation=null,circulationStale=true,circulationWidth=.9,circulationOverlay=false,circulationPlane=null;

const circulationBlocks=f=>f.y<CIRC_HEAD&&f.y+f.h>.15;
// Seules les portes qui donnent sur l'extérieur amorcent le parcours : une porte intérieure
// desservirait sa propre pièce et masquerait tout enclavement.
function circulationEntrances(){const points=[],outline=buildingOutline();
 for(const w of state.walls){const L=wallLength(w);if(L<.001)continue;const u=(w.x2-w.x1)/L,v=(w.z2-w.z1)/L;
  for(const o of w.op||[]){if(!['porte','double','baie'].includes(o.type)||o.sill>.1)continue;
   const cx=w.x1+u*o.d,cz=w.z1+v*o.d,off=w.t/2+.35;
   const sides=[1,-1].map(side=>({x:cx-v*off*side,z:cz+u*off*side})),inside=sides.filter(p=>Arch.contains(outline,p));
   if(inside.length===1)points.push(inside[0]);}}
 return points;}

function buildCirculation(){
 const outline=buildingOutline(),b=Arch.bounds(outline),cell=CIRC_CELL;
 const cols=Math.ceil(b.w/cell)+2,rows=Math.ceil(b.d/cell)+2;
 if(cols*rows>CIRC_MAX_CELLS)throw Error('Emprise trop grande pour l’analyse de circulation.');
 const x0=b.x-cell,z0=b.z-cell,grid=new Uint8Array(cols*rows);
 const px=i=>x0+(i+.5)*cell,pz=j=>z0+(j+.5)*cell;
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++)if(!Arch.contains(outline,{x:px(i),z:pz(j)}))grid[j*cols+i]=2;
 const stamp=poly=>{const bb=Arch.bounds(poly);
  const i0=Math.max(0,Math.floor((bb.x-x0)/cell-1)),i1=Math.min(cols-1,Math.ceil((bb.x+bb.w-x0)/cell));
  const j0=Math.max(0,Math.floor((bb.z-z0)/cell-1)),j1=Math.min(rows-1,Math.ceil((bb.z+bb.d-z0)/cell));
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const k=j*cols+i;if(grid[k])continue;if(Arch.contains(poly,{x:px(i),z:pz(j)}))grid[k]=1;}};
 for(const w of state.walls)for(const part of Arch.solidWallParts(w,{y:0,h:CIRC_HEAD}))stamp(part);
 for(const c of buildingColumns())stamp(Arch.footprint({x:c.x,z:c.z,w:c.w,d:c.d,r:0}));
 for(const f of state.furniture)if(circulationBlocks(f))stamp(Arch.footprint(f));
 // Distance de chamfer (3,4)/3 : erreur de l'ordre de 2 %, suffisante pour une largeur de passage.
 const INF=1e9,dist=new Float32Array(cols*rows),a=cell,bdiag=cell*Math.SQRT2;
 for(let k=0;k<grid.length;k++)dist[k]=grid[k]?0:INF;
 const relax=(k,from,w)=>{const v=dist[from]+w;if(v<dist[k])dist[k]=v;};
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const k=j*cols+i;if(!dist[k])continue;
  if(i>0)relax(k,k-1,a);if(j>0)relax(k,k-cols,a);
  if(i>0&&j>0)relax(k,k-cols-1,bdiag);if(i<cols-1&&j>0)relax(k,k-cols+1,bdiag);}
 for(let j=rows-1;j>=0;j--)for(let i=cols-1;i>=0;i--){const k=j*cols+i;if(!dist[k])continue;
  if(i<cols-1)relax(k,k+1,a);if(j<rows-1)relax(k,k+cols,a);
  if(i<cols-1&&j<rows-1)relax(k,k+cols+1,bdiag);if(i>0&&j<rows-1)relax(k,k+cols-1,bdiag);}
 return {cols,rows,cell,x0,z0,grid,dist,entrances:circulationEntrances()};}

// Cellules où un gabarit de `width` passe, atteintes depuis une porte extérieure.
function circulationReach(g,width){
 const r=width/2,reach=new Uint8Array(g.cols*g.rows),queue=[];
 const push=(i,j)=>{if(i<0||j<0||i>=g.cols||j>=g.rows)return false;const k=j*g.cols+i;
  if(reach[k]||g.grid[k]||g.dist[k]<r)return false;reach[k]=1;queue.push(k);return true;};
 let seeded=0;
 for(const p of g.entrances){const ci=Math.round((p.x-g.x0)/g.cell-.5),cj=Math.round((p.z-g.z0)/g.cell-.5);
  for(let radius=0;radius<=12&&!push(ci,cj);radius++){let done=false;
   for(let dj=-radius;dj<=radius&&!done;dj++)for(let di=-radius;di<=radius&&!done;di++)if(Math.max(Math.abs(di),Math.abs(dj))===radius&&push(ci+di,cj+dj))done=true;
   if(done)break;}
  if(queue.length)seeded++;}
 if(!seeded){ // pas de porte exploitable : on part de la plus grande poche libre
  let best=-1;for(let k=0;k<g.grid.length;k++)if(!g.grid[k]&&g.dist[k]>=r&&(best<0||g.dist[k]>g.dist[best]))best=k;
  if(best<0)return {reach,cells:0};reach[best]=1;queue.push(best);}
 let cells=0;
 while(queue.length){const k=queue.pop();cells++;const i=k%g.cols,j=(k-i)/g.cols;
  push(i-1,j);push(i+1,j);push(i,j-1);push(i,j+1);}
 return {reach,cells};}

function circulationZones(g,reach){
 return state.zones.map(z=>{const poly=Arch.polygon(z),bb=Arch.bounds(poly);
  const i0=Math.max(0,Math.floor((bb.x-g.x0)/g.cell)),i1=Math.min(g.cols-1,Math.ceil((bb.x+bb.w-g.x0)/g.cell));
  const j0=Math.max(0,Math.floor((bb.z-g.z0)/g.cell)),j1=Math.min(g.rows-1,Math.ceil((bb.z+bb.d-g.z0)/g.cell));
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const k=j*g.cols+i;
   if(reach[k]&&Arch.contains(poly,{x:g.x0+(i+.5)*g.cell,z:g.z0+(j+.5)*g.cell}))return {n:z.n,served:true};}
  return {n:z.n,served:false};});}

// Largeur maximale qui dessert encore tous les espaces atteignables à 60 cm.
function circulationWidest(g,baseline){
 let low=.6,high=2.4,best=null;
 for(let step=0;step<7;step++){const mid=(low+high)/2,{reach}=circulationReach(g,mid);
  const zones=circulationZones(g,reach);
  if(baseline.every((z,i)=>!z.served||zones[i].served)){best=mid;low=mid;}else high=mid;}
 return best;}

// Goulets : chemin le plus large entre une porte extérieure et chaque espace. On ajoute les
// cellules par dégagement décroissant ; la cellule qui raccorde enfin un espace à une entrée
// donne à la fois sa largeur de passage maximale et l'endroit qui la limite.
function circulationBottlenecks(g){
 const n=g.cols*g.rows,parent=new Int32Array(n).fill(-1),flags=new Int32Array(n),entrance=new Uint8Array(n);
 const zones=state.zones.slice(0,30),polys=zones.map(Arch.polygon);
 const find=k=>{let r=k;while(parent[r]!==r)r=parent[r];while(parent[k]!==r){const next=parent[k];parent[k]=r;k=next;}return r;};
 for(const p of g.entrances){let ci=Math.round((p.x-g.x0)/g.cell-.5),cj=Math.round((p.z-g.z0)/g.cell-.5);
  let bestK=-1,bestD=-1;
  for(let dj=-8;dj<=8;dj++)for(let di=-8;di<=8;di++){const i=ci+di,j=cj+dj;
   if(i<0||j<0||i>=g.cols||j>=g.rows)continue;const k=j*g.cols+i;
   if(g.grid[k]||g.dist[k]<=bestD)continue;bestD=g.dist[k];bestK=k;}
  if(bestK>=0)entrance[bestK]=1;}
 const order=[];
 for(let k=0;k<n;k++)if(!g.grid[k])order.push(k);
 order.sort((a,b)=>g.dist[b]-g.dist[a]);
 const zoneOf=new Int32Array(n);
 for(let z=0;z<polys.length;z++){const bb=Arch.bounds(polys[z]);
  const i0=Math.max(0,Math.floor((bb.x-g.x0)/g.cell)),i1=Math.min(g.cols-1,Math.ceil((bb.x+bb.w-g.x0)/g.cell));
  const j0=Math.max(0,Math.floor((bb.z-g.z0)/g.cell)),j1=Math.min(g.rows-1,Math.ceil((bb.z+bb.d-g.z0)/g.cell));
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const k=j*g.cols+i;
   if(!g.grid[k]&&Arch.contains(polys[z],{x:g.x0+(i+.5)*g.cell,z:g.z0+(j+.5)*g.cell}))zoneOf[k]|=1<<z;}}
 const result=zones.map(z=>({n:z.n,width:0,at:null})),done=new Uint8Array(zones.length);
 let remaining=zones.length;
 const settle=(root,width,k)=>{const mask=flags[root];if(!(mask&1))return;
  for(let z=0;z<zones.length;z++)if(!done[z]&&(mask&(1<<(z+1)))){done[z]=1;remaining--;
   result[z].width=+width.toFixed(3);result[z].at={x:+(g.x0+(k%g.cols+.5)*g.cell).toFixed(2),z:+(g.z0+((k-k%g.cols)/g.cols+.5)*g.cell).toFixed(2)};}};
 for(const k of order){
  parent[k]=k;flags[k]=(entrance[k]?1:0)|(zoneOf[k]<<1);
  const i=k%g.cols,j=(k-i)/g.cols;
  for(const nb of [i>0?k-1:-1,i<g.cols-1?k+1:-1,j>0?k-g.cols:-1,j<g.rows-1?k+g.cols:-1]){
   if(nb<0||parent[nb]===-1)continue;
   const a=find(k),b=find(nb);if(a===b)continue;
   parent[b]=a;flags[a]|=flags[b];}
  settle(find(k),g.dist[k]*2,k);
  if(!remaining)break;}
 return result;}

function analyseCirculation(){
 const started=Date.now();
 const g=buildCirculation(),{reach,cells}=circulationReach(g,circulationWidth);
 const zones=circulationZones(g,reach),base=circulationZones(g,circulationReach(g,.6).reach);
 circulation={g,reach,cells,zones,base,width:circulationWidth,bottlenecks:circulationBottlenecks(g),
  area:cells*g.cell*g.cell,widest:circulationWidest(g,base),ms:Date.now()-started,doors:g.entrances.length};
 circulationStale=false;circulationRender();return circulation;}

function circulationTexture(){const c=circulation,g=c.g,canvas=document.createElement('canvas');
 canvas.width=g.cols;canvas.height=g.rows;const ctx=canvas.getContext('2d'),img=ctx.createImageData(g.cols,g.rows);
 for(let j=0;j<g.rows;j++)for(let i=0;i<g.cols;i++){const k=j*g.cols+i,p=((g.rows-1-j)*g.cols+i)*4;
  let rgba=[0,0,0,0];
  if(g.grid[k]===1)rgba=[60,66,62,150];
  else if(!g.grid[k])rgba=c.reach[k]?[104,158,118,110]:[198,84,62,120];
  img.data[p]=rgba[0];img.data[p+1]=rgba[1];img.data[p+2]=rgba[2];img.data[p+3]=rgba[3];}
 ctx.putImageData(img,0,0);const t=new THREE.CanvasTexture(canvas);t.magFilter=THREE.NearestFilter;t.encoding=THREE.sRGBEncoding;return t;}

function circulationRender(){
 if(circulationPlane){circulationPlane.geometry.dispose();circulationPlane.material.map?.dispose();circulationPlane.material.dispose();circulationPlane=null;}
 if(!circulationOverlay||!circulation||circulationStale||view==='interior')return;
 const g=circulation.g,w=g.cols*g.cell,d=g.rows*g.cell;
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshBasicMaterial({map:circulationTexture(),transparent:true,depthWrite:false}));
 mesh.rotation.x=-Math.PI/2;mesh.position.set(g.x0+w/2-CX,.055,g.z0+d/2-CZ);mesh.renderOrder=2;
 helpers.add(mesh);circulationPlane=mesh;dirty=true;}

function circulationChecks(){const el=$('circulationChecks');if(!el)return;
 if(!circulation){el.innerHTML='<p class="note">Analyse non lancée.</p>';return;}
 if(circulationStale){el.innerHTML='<div class="check-result warn">△ Le projet a changé depuis la dernière analyse.</div>';return;}
 const c=circulation,missing=c.zones.filter((z,i)=>c.base[i].served&&!z.served),never=c.base.filter(z=>!z.served);
 const tight=(c.bottlenecks||[]).filter(b=>b.at&&b.width<c.width-.001).sort((a,b)=>a.width-b.width);
 el.innerHTML=`<div class="check-result">${c.area.toFixed(1)} m² desservis à ${c.width.toFixed(2)} m de passage · ${c.doors} accès extérieur(s)</div>`
  +(missing.length?`<div class="check-result warn">△ Non desservis à cette largeur : ${missing.map(z=>esc(z.n)).join(', ')}</div>`:'<div class="check-result">✓ Tous les espaces atteignables le restent à cette largeur.</div>')
  +(never.length?`<div class="check-result warn">△ Sans accès même à 0,60 m : ${never.map(z=>esc(z.n)).join(', ')}</div>`:'')
  +(tight.length?'<h3>Goulets</h3>'+tight.map(b=>`<button class="issue" data-bottleneck="${b.at.x} ${b.at.z}">${esc(b.n)} · ${b.width.toFixed(2)} m au droit de X ${b.at.x} / Z ${b.at.z}</button>`).join(''):'')
  +`<p class="note">Largeur maximale desservant les mêmes espaces : ${c.widest?c.widest.toFixed(2)+' m':'moins de 0,60 m'}. Analyse sur une grille de ${c.g.cell*100} cm, obstacles pris entre 0,15 et ${CIRC_HEAD} m de hauteur (${c.ms} ms). Indicatif : ce n’est pas une vérification d’accessibilité réglementaire.</p>`;
 el.querySelectorAll('[data-bottleneck]').forEach(b=>b.onclick=()=>{const [x,z]=b.dataset.bottleneck.split(' ').map(Number);
  setView('plan');target.set(x-CX,0,z-CZ);dist=10;updateCamera();notify('Goulet situé en X '+x+' / Z '+z+'.');});}

function circulationSetup(){
 $('checks').insertAdjacentHTML('beforebegin','<details><summary>Circulation</summary>'
  +'<label class="field">Largeur de passage · m<select id="circulationWidth"><option value="0.6">0,60 · passage d’appoint</option><option value="0.9" selected>0,90 · circulation courante</option><option value="1.2">1,20 · dégagement large</option><option value="1.4">1,40 · giration fauteuil</option></select></label>'
  +'<button id="runCirculation">Analyser la circulation</button>'
  +'<label class="check"><input type="checkbox" id="circulationOverlay"> Afficher la carte au sol</label>'
  +'<div id="circulationChecks"></div></details>');
 $('circulationWidth').onchange=()=>{circulationWidth=+$('circulationWidth').value;circulationStale=true;circulationChecks();};
 $('runCirculation').onclick=()=>{try{notify('Analyse de la circulation…');analyseCirculation();notify('Circulation analysée.');}catch(e){notify(e.message);}circulationChecks();};
 $('circulationOverlay').onchange=()=>{circulationOverlay=$('circulationOverlay').checked;if(circulationOverlay&&!circulation){try{analyseCirculation();}catch(e){notify(e.message);}}circulationChecks();rebuild();};
 circulationChecks();}
