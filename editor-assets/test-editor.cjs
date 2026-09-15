const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),THREE=require('./vendor/three.min.js');
const elements=new Map();
function element(id=''){if(elements.has(id))return elements.get(id);const e={value:id==='snap'?'.25':'',checked:['showGrid','showDimensions'].includes(id),hidden:false,style:{},dataset:{},classList:{toggle(){}},textContent:'',innerHTML:'',clientWidth:900,clientHeight:650,events:{},getBoundingClientRect(){return {left:0,top:0,width:900,height:650};},getContext(){return {fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText(){}};},addEventListener(k,fn){this.events[k]=fn;},insertAdjacentHTML(){},querySelectorAll(){return [];},focus(){},setPointerCapture(){},click(){}};if(id)elements.set(id,e);return e;}
class Renderer{constructor(){this.shadowMap={};this.info={memory:{}};}setPixelRatio(){}setSize(){}render(){}}
const store=new Map();const ctx=vm.createContext({THREE:{...THREE,WebGLRenderer:Renderer},document:{getElementById:element,createElement:()=>element(),querySelectorAll:()=>[]},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},devicePixelRatio:1,ResizeObserver:class{observe(){}},requestAnimationFrame(){},addEventListener(){},setTimeout(){return 0;},clearTimeout(){},console,TextDecoder,DataView,Uint8Array,ArrayBuffer,Math,Blob,URL,atob,btoa});
vm.runInContext(fs.readFileSync(__dirname+'/defaults.js','utf8'),ctx);vm.runInContext(fs.readFileSync(__dirname+'/architecture-core.js','utf8'),ctx);vm.runInContext(fs.readFileSync(__dirname+'/architecture-ui.js','utf8'),ctx);vm.runInContext(fs.readFileSync(__dirname+'/navigation.js','utf8'),ctx);vm.runInContext(fs.readFileSync(__dirname+'/manipulation.js','utf8'),ctx);vm.runInContext(fs.readFileSync(__dirname+'/equipment.js','utf8'),ctx);vm.runInContext(fs.readFileSync(__dirname+'/building.js','utf8'),ctx);vm.runInContext(fs.readFileSync(__dirname+'/circulation.js','utf8'),ctx);vm.runInContext(fs.readFileSync(__dirname+'/project.js','utf8'),ctx);vm.runInContext(fs.readFileSync(__dirname+'/rooms.js','utf8'),ctx);vm.runInContext(fs.readFileSync(__dirname+'/editor.js','utf8').replace(/if\(typeof AtelierCloud[^\n]+\n?$/, ''),ctx);
// Tests share one editor context: they are queued and run strictly in order, awaiting async ones.
const run=s=>vm.runInContext(s,ctx);let tests=0;const queue=[];function test(name,fn){queue.push([name,fn]);}
test('Legacy defaults import with unchanged walls and openings',()=>{assert.equal(run('state.walls.length'),13);assert.equal(run('state.zones.length'),8);assert.equal(run('state.walls[1].op[0].w'),1.4);});
test('L-shaped union excludes duplicate surfaces',()=>assert.ok(Math.abs(run('unionInside(state.zones)')-326)<1e-6));
test('Outside L-shape is not inside the envelope',()=>assert.equal(run('inside(8,20)'),false));
test('Invalid number and negative dimensions are rejected',()=>assert.throws(()=>run('validate({...clone(state),zones:[{...state.zones[0],w:-2}]})')));
test('Null coordinates are rejected',()=>assert.throws(()=>run('validate({...clone(state),walls:[{...state.walls[0],x1:null}]})')));
test('Zero-length walls are rejected',()=>assert.throws(()=>run('validate({...clone(state),walls:[{...state.walls[0],x2:0}]})')));
test('Overlapping openings are rejected',()=>assert.throws(()=>run('validate({...clone(state),walls:[{...state.walls[1],op:[state.walls[1].op[0],state.walls[1].op[0]]}]})')));
test('Opening exceeding lintel height is rejected',()=>assert.throws(()=>run('validate({...clone(state),walls:[{...state.walls[1],op:[{...state.walls[1].op[0],sill:2}]}]})')));
test('Unknown asset references are rejected',()=>assert.throws(()=>run('validate({...clone(state),furniture:[{type:"custom",assetId:"missing",x:0,z:0}]})')));
test('Failed edits restore both state and selection',()=>{run('selection={kind:"walls",i:0};commit(()=>{state.walls[0].h=-1;selection={kind:"walls",i:999};})');assert.equal(run('selection.i'),0);assert.equal(run('state.walls[0].h'),3.4);});
test('Selecting a zone creates no history',()=>{const before=run('undoStack.length');run('select({kind:"zones",i:0})');assert.equal(run('undoStack.length'),before);});
test('Furnished proposal adds 46 editable objects',()=>{run('demo()');assert.equal(run('state.furniture.length'),46);});
test('Proposal cannot be inserted twice',()=>{run('demo()');assert.equal(run('state.furniture.length'),46);});
test('Updated proposal clears the original counter and door obstructions',()=>{assert.equal(run('Arch.collisions(state).hard.length'),0);assert.equal(run('Arch.collisions(state).doors.length'),0);});
test('All furniture dimensions equal displayed bounding boxes',()=>{const results=run('Object.keys(FURN_TYPES).map(type=>{const f=validate({...clone(DEFAULT_STATE),furniture:[{type,x:0,z:0}]}).furniture[0];const g=furnitureModel(f),b=new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());return {type,error:Math.max(Math.abs(b.x-f.w),Math.abs(b.y-f.h),Math.abs(b.z-f.d))};})');for(const r of results)assert.ok(r.error<1e-5,r.type+': '+r.error);});
test('Undo and redo restore the complete proposal',()=>{run('historyStep()');assert.equal(run('state.furniture.length'),0);run('historyStep(true)');assert.equal(run('state.furniture.length'),46);});
test('Duplicate and delete can both be undone',()=>{run('select({kind:"furniture",i:0});duplicate()');assert.equal(run('state.furniture.length'),47);run('removeSelection()');assert.equal(run('state.furniture.length'),46);run('historyStep()');assert.equal(run('state.furniture.length'),47);run('historyStep()');assert.equal(run('state.furniture.length'),46);});
test('Plan uses a vertical orthographic camera',()=>{run('setView("plan")');assert.equal(run('camera.isOrthographicCamera'),true);assert.ok(run('Math.abs(camera.getWorldDirection(new THREE.Vector3()).y+1)<1e-6'));});
test('Interior eye height is 1.65 m',()=>{run('setView("interior")');assert.equal(run('camera.position.y'),1.65);assert.equal(run('cut'),false);});
test('Ceiling follows the editable outline and carries its beams',()=>{
 const slabs=run('world.children.filter(o=>o.isMesh&&o.name==="Plafond")');assert.equal(run('world.children.filter(o=>o.isMesh&&o.name==="Plafond").length'),1);
 assert.ok(Math.abs(run('world.children.find(o=>o.name==="Plafond").position.y')-run('buildingHeight()'))<1e-9);
 assert.ok(run('world.children.filter(o=>o.isMesh&&Math.abs(o.position.y-(buildingHeight()-.03))<.001).length')>10);
});
test('A taller ceiling moves the slab without touching the walls',()=>{
 const wallHeights=run('JSON.stringify(state.walls.map(w=>w.h))');
 run('commit(()=>state.building=validateBuilding({...state.building,height:4.2}));roofOn=true;rebuild()');
 assert.equal(run('buildingHeight()'),4.2);assert.equal(run('JSON.stringify(state.walls.map(w=>w.h))'),wallHeights);
 assert.ok(Math.abs(run('world.children.find(o=>o.name==="Plafond").position.y')-4.2)<1e-9);
 run('historyStep()');assert.equal(run('buildingHeight()'),run('H'));
});
test('The building outline rejects an impossible height',()=>assert.throws(()=>run('validateBuilding({height:0.1})')));
test('Repeated scene rebuilds dispose prior mesh geometry',()=>{run('globalThis.disposedCount=0;world.traverse(o=>{if(o.geometry)o.geometry.addEventListener("dispose",()=>disposedCount++);});rebuild()');assert.ok(run('disposedCount')>100);});
test('Standalone GLB header accepted and external references rejected',()=>{function glb(obj){const text=JSON.stringify(obj),len=Math.ceil(Buffer.byteLength(text)/4)*4,b=Buffer.alloc(20+len,32);b.writeUInt32LE(0x46546c67,0);b.writeUInt32LE(2,4);b.writeUInt32LE(b.length,8);b.writeUInt32LE(len,12);b.writeUInt32LE(0x4e4f534a,16);b.write(text,20);return b.buffer.slice(b.byteOffset,b.byteOffset+b.length);}ctx.fixture=glb({asset:{version:'2.0'}});run('inspectGlb(fixture)');ctx.fixture=glb({asset:{version:'2.0'},images:[{uri:'https://example.com/private.png'}]});assert.throws(()=>run('inspectGlb(fixture)'));});
test('JSON round trip preserves editable state',()=>assert.equal(run('JSON.stringify(validate(JSON.parse(snapshot())))===snapshot()'),true));
test('Concave L-shaped room area excludes its notch',()=>assert.equal(run('Arch.area([{x:0,z:0},{x:4,z:0},{x:4,z:2},{x:2,z:2},{x:2,z:4},{x:0,z:4}])'),12));
test('Crossed polygon edges are rejected',()=>assert.throws(()=>run('Arch.validatePolygon([{x:0,z:0},{x:4,z:4},{x:0,z:4},{x:4,z:0}])')));
test('Concave polygon union clips to the real envelope',()=>assert.ok(Math.abs(run('Arch.unionArea([[{x:0,z:0},{x:4,z:0},{x:4,z:2},{x:2,z:2},{x:2,z:4},{x:0,z:4}]])')-12)<1e-6));
test('Overlapping triangular rooms are not double counted',()=>assert.ok(Math.abs(run('Arch.unionArea([[{x:0,z:0},{x:4,z:0},{x:0,z:4}],[{x:0,z:0},{x:4,z:0},{x:4,z:4}]])')-12)<1e-6));
test('A rectangle in a concave room notch has zero overlap',()=>assert.ok(run('Arch.overlapArea([{x:0,z:0},{x:4,z:0},{x:4,z:2},{x:2,z:2},{x:2,z:4},{x:0,z:4}],[{x:2.2,z:2.2},{x:3.8,z:2.2},{x:3.8,z:3.8},{x:2.2,z:3.8}])')<1e-6));
test('Calibration accounts for image rotation',()=>{assert.ok(run('(()=>{const r={x:2,z:3,scale:.02,rotation:90,widthPx:1000,heightPx:500};const a=Arch.imagePoint(r,{x:2,z:3}),b=Arch.imagePoint(r,{x:2,z:13});return Math.abs(Arch.calibrate(r,a,b,20).scale-.04)<1e-8;})()'));});
test('Calibration rejects identical points',()=>assert.throws(()=>run('Arch.calibrate({widthPx:100,heightPx:100},{x:10,z:10},{x:10,z:10},2)')));
test('Moving a corner propagates through orthogonal connected walls',()=>assert.ok(run('(()=>{const a=validate({zones:[],furniture:[],walls:[{...DW(0,0,4,0),n1:"a",n2:"b",axis:"x"},{...DW(4,0,4,3),n1:"b",n2:"c",axis:"z"},{...DW(4,3,0,3),n1:"c",n2:"d",axis:"x"},{...DW(0,3,0,0),n1:"d",n2:"a",axis:"z"}]});const b=clone(a);b.walls[0].x2=5;Arch.propagate(a,b);validate(b);return b.walls[1].x1===5&&b.walls[1].x2===5&&b.walls[2].x1===5;})()')));
test('Fixed wall length rejects a conflicting corner move',()=>assert.throws(()=>run('(()=>{const a=validate({zones:[],furniture:[],walls:[{...DW(0,0,4,0),fixedLength:4}]});const b=clone(a);b.walls[0].x2=5;Arch.propagate(a,b);validate(b);})()')));
test('Shared node positions cannot diverge in imported JSON',()=>assert.throws(()=>run('validate({zones:[],furniture:[],walls:[{...DW(0,0,4,0),n2:"same"},{...DW(5,0,5,3),n1:"same"}]})')));
test('A room linked to walls follows endpoint edits',()=>assert.ok(run('(()=>{const a=validate({zones:[{n:"Room",vertices:[{x:0,z:0},{x:4,z:0},{x:4,z:3},{x:0,z:3}],nodes:["a","b","c","d"]}],furniture:[],walls:[{...DW(0,0,4,0),n1:"a",n2:"b",axis:"x"},{...DW(4,0,4,3),n1:"b",n2:"c",axis:"z"},{...DW(4,3,0,3),n1:"c",n2:"d",axis:"x"},{...DW(0,3,0,0),n1:"d",n2:"a",axis:"z"}]});const b=clone(a);b.walls[0].x2=5;Arch.propagate(a,b);const s=validate(b);return Arch.area(s.zones[0].vertices)===15;})()')));
test('Polygon JSON round trip preserves nodes and contours',()=>assert.ok(run('(()=>{const s=validate({zones:[{n:"triangle",vertices:[{x:0,z:0},{x:4,z:0},{x:0,z:3}]}],walls:[],furniture:[]});return JSON.stringify(validate(JSON.parse(JSON.stringify(s))))===JSON.stringify(s);})()')));
test('Rotated footprints use oriented, not axis-aligned collisions',()=>assert.equal(run('Arch.convexOverlap(Arch.footprint({x:0,z:0,w:4,d:.2,r:Math.PI/4}),Arch.footprint({x:1.3,z:1.3,w:.2,d:.2,r:0}))'),false));
test('Vertical separation avoids false furniture collisions',()=>assert.equal(run('Arch.collisions({walls:[],furniture:[{n:"a",x:2,z:2,w:1,d:1,h:1,y:0,r:0},{n:"b",x:2,z:2,w:1,d:1,h:1,y:2,r:0}]}).hard.length'),0));
test('Openings admit objects below their lintels',()=>assert.equal(run('Arch.collisions({walls:[{...DW(0,0,4,0),op:[{type:"baie",d:2,w:2,h:2.4,sill:0}]}],furniture:[{n:"a",x:2,z:0,w:.5,d:.5,h:1,y:0,r:0}]}).hard.length'),0));
test('Objects too tall for openings collide with lintels',()=>assert.equal(run('Arch.collisions({walls:[{...DW(0,0,4,0),op:[{type:"baie",d:2,w:2,h:2.4,sill:0}]}],furniture:[{n:"a",x:2,z:0,w:.5,d:.5,h:3,y:0,r:0}]}).hard.length'),1));
test('Door swing sectors detect furniture in the opening path',()=>assert.ok(run('Arch.collisions({walls:[{...DW(0,0,4,0),op:[{type:"porte",d:2,w:1,h:2.1,sill:0,swing:1}]}],furniture:[{n:"a",x:2,z:.5,w:.3,d:.3,h:1,y:0,r:0}]}).doors.length')>0));
test('Changing swing side clears the opposite-side obstruction',()=>assert.equal(run('Arch.collisions({walls:[{...DW(0,0,4,0),op:[{type:"porte",d:2,w:1,h:2.1,sill:0,swing:-1}]}],furniture:[{n:"a",x:2,z:.5,w:.3,d:.3,h:1,y:0,r:0}]}).doors.length'),0));
test('Clearance warnings are separate from physical collisions',()=>{assert.equal(run('Arch.collisions({walls:[],furniture:[{n:"a",x:1,z:1,w:1,d:1,h:1,y:0,r:0},{n:"b",x:2.3,z:1,w:1,d:1,h:1,y:0,r:0}]},.6).hard.length'),0);assert.equal(run('Arch.collisions({walls:[],furniture:[{n:"a",x:1,z:1,w:1,d:1,h:1,y:0,r:0},{n:"b",x:2.3,z:1,w:1,d:1,h:1,y:0,r:0}]},.6).clear.length'),1);});
test('Builtin models store one compact reference, not repeated binaries',()=>assert.ok(run('(()=>{const s=validate({...clone(DEFAULT_STATE),assets:{asset_builtin_chair:{builtin:"chair"}},furniture:[{type:"custom",assetId:"asset_builtin_chair",x:18,z:18,w:1,d:1,h:1}]});return s.assets.asset_builtin_chair.builtin==="chair"&&!s.assets.asset_builtin_chair.data;})()')));
test('Deleting an earlier room does not move unrelated linked rooms',()=>assert.ok(run('(()=>{const room={n:"Room",vertices:[{x:0,z:0},{x:4,z:0},{x:0,z:3}],nodes:["a","b","c"]};const a=validate({zones:[{n:"Unrelated",x:10,z:10,w:4,d:3},room],furniture:[],walls:[{...DW(0,0,4,0),n1:"a",n2:"b"},{...DW(4,0,0,3),n1:"b",n2:"c"},{...DW(0,3,0,0),n1:"c",n2:"a"}]});const b=clone(a);b.zones.shift();Arch.propagate(a,b);return JSON.stringify(b.walls)===JSON.stringify(a.walls);})()')));
test('Legacy furniture automatically references detailed models without moving objects',()=>{
 const result=JSON.parse(run('JSON.stringify(validate({...clone(DEFAULT_STATE),furniture:[{type:"chair",x:3,z:4,w:.6,d:.7,h:.9,r:1},{type:"plant",x:5,z:6},{type:"sofa",x:7,z:8}]}))'));
 assert.equal(result.assets.asset_builtin_chair.builtin,'chair');assert.equal(result.assets.asset_builtin_plant.builtin,'plant');assert.equal(result.assets.asset_builtin_sofa.builtin,'sofa');assert.equal(result.furniture[0].x,3);assert.equal(result.furniture[0].w,.6);assert.equal(result.furniture[0].r,1);
});
test('Detailed replacements share geometry and preserve displayed bounds',()=>{
 run('var modelTest=new THREE.Group();var meshTest=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial());meshTest.position.y=.5;modelTest.add(meshTest);assetCache.set("asset_builtin_chair",modelTest);var detailTest=furnitureModel({type:"chair",w:.6,h:.9,d:.7,c:"#ffffff"});detailTest.updateMatrixWorld(true);var detailBounds=new THREE.Box3().setFromObject(detailTest).getSize(new THREE.Vector3());');
 assert.ok(Math.abs(run('detailBounds.x')-.6)<1e-6);assert.ok(Math.abs(run('detailBounds.y')-.9)<1e-6);assert.equal(run('detailTest.children[0].children[0].geometry===meshTest.geometry'),true);assert.equal(run('detailTest.children[0].children[0].userData.assetShared'),true);run('assetCache.delete("asset_builtin_chair")');
});
test('Perspective arrows translate the camera without editing the project',()=>{
 run('setView("3d");frame();theta=0;var navBefore=snapshot(),historyBefore=undoStack.length;navigationKeys.add("arrowright");navigationStep(.05);stopNavigation();');assert.ok(run('target.x')>0);assert.equal(run('target.z'),0);assert.equal(run('snapshot()===navBefore'),true);assert.equal(run('undoStack.length===historyBefore'),true);
});
test('Plan up moves north and downward drag follows the pointer',()=>{
 run('setView("plan");frame();navigationKeys.add("arrowup");navigationStep(.05);stopNavigation();');assert.ok(run('target.z')<0);run('target.set(0,0,0);panCamera(0,20)');assert.ok(run('target.z')<0);
});
test('Diagonal movement is normalized',()=>{
 run('frame();navigationKeys.add("arrowup");navigationStep(.05);stopNavigation();var straightNav=target.length();frame();navigationKeys.add("arrowup");navigationKeys.add("arrowright");navigationStep(.05);stopNavigation();');assert.ok(Math.abs(run('target.length()-straightNav'))<1e-8);
});
test('Shift accelerates and releasing keys stops movement',()=>{
 run('frame();navigationKeys.add("arrowup");navigationShift=true;navigationStep(.05);stopNavigation();var stoppedNav=target.clone();navigationStep(.05)');assert.ok(Math.abs(run('stoppedNav.length()-straightNav*3'))<1e-8);assert.equal(run('target.equals(stoppedNav)'),true);
});
test('Interior movement uses viewing direction and preserves eye height',()=>{
 run('setView("interior");frame();yaw=0;var oldEye=eye.clone();navigationKeys.add("w");navigationStep(.05);stopNavigation()');assert.ok(run('eye.z<oldEye.z'));assert.equal(run('eye.y'),1.65);
});
test('Each view restores its previous camera and display settings',()=>{
 run('setView("3d");target.set(3,0,5);dist=27;theta=.4;cut=false;setView("plan");target.set(-2,0,7);dist=16;setView("3d")');assert.equal(run('target.x'),3);assert.equal(run('dist'),27);assert.equal(run('theta'),.4);assert.equal(run('cut'),false);run('setView("plan")');assert.equal(run('target.x'),-2);assert.equal(run('dist'),16);
});
test('Wheel zoom keeps the plan point under the cursor',()=>{
 run('setView("plan");frame();var wheelTest={clientX:300,clientY:200,deltaY:-100,deltaMode:0,preventDefault(){}};var anchorBefore=floorPoint(wheelTest);navigationWheel(wheelTest);var anchorAfter=floorPoint(wheelTest)');assert.ok(run('Math.hypot(anchorBefore.x-anchorAfter.x,anchorBefore.z-anchorAfter.z)')<1e-7);
});
test('Modifier shortcuts do not start movement',()=>{
 run('stopNavigation();navigationKeyDown({key:"d",ctrlKey:true,preventDefault(){}})');assert.equal(run('navigationKeys.size'),0);
});
test('A wall split keeps each opening on its own segment and shares the junction',()=>{
 run('state=validate(clone(DEFAULT_STATE));selection=null;var splitIndex=state.walls.findIndex(w=>w.op.length>1);var splitLength=wallLength(state.walls[splitIndex]);commit(()=>splitWallAt(splitIndex,7.5/splitLength))');
 assert.equal(run('state.walls.length'),14);
 assert.equal(run('state.walls[splitIndex].op.length'),1);assert.equal(run('state.walls.at(-1).op.length'),1);
 assert.equal(run('state.walls.at(-1).op[0].d'),1.5);assert.equal(run('state.walls[splitIndex].op[0].d'),5.5);
 assert.equal(run('state.walls[splitIndex].n2'),run('state.walls.at(-1).n1'));
 run('historyStep()');assert.equal(run('state.walls.length'),13);
});
test('A junction falling on an opening is refused',()=>{
 const before=run('state.walls.length');
 run('var openIndex=state.walls.findIndex(w=>w.op.length>1);commit(()=>splitWallAt(openIndex,state.walls[openIndex].op[0].d/wallLength(state.walls[openIndex])))');
 assert.equal(run('state.walls.length'),before);
});
test('Clicking a member of a multi-selection keeps the whole set',()=>{
 run('state=validate({...clone(DEFAULT_STATE),furniture:[{type:"table",x:17,z:3},{type:"table",x:19,z:3},{type:"table",x:17,z:6}]});selection={kind:"furniture",i:0,indices:[0,1]};chooseFurniture(1)');
 assert.equal(run('JSON.stringify(furnitureIndices())'),'[0,1]');
 run('chooseFurniture(2)');assert.equal(run('JSON.stringify(furnitureIndices())'),'[2]');
});
test('Grouping, rotation and duplication preserve every dimension',()=>{
 run('selection={kind:"furniture",i:0,indices:[0,1,2]};groupFurniture();rotateFurniture(Math.PI/6);duplicateFurniture()');
 assert.equal(run('state.furniture.length'),6);
 assert.ok(run('state.furniture.every(f=>Math.abs(f.w-.9)<1e-9&&Math.abs(f.d-.9)<1e-9&&Math.abs(f.h-.75)<1e-9)'));
 assert.equal(run('new Set(state.furniture.slice(3).map(f=>f.groupId)).size'),1);
 assert.equal(run('state.furniture[0].groupId===state.furniture[3].groupId'),false);
 assert.ok(run('state.furniture.every(f=>/^group_/.test(f.groupId))'));
 assert.ok(run('Math.abs(state.furniture[0].r-Math.PI/6)<1e-9'));
});
test('Locked objects refuse every transformation',()=>{
 run('state.furniture.forEach(f=>f.locked=true);selection={kind:"furniture",i:0,indices:[0,1,2]};globalThis.lockedBefore=JSON.stringify(state.furniture);rotateFurniture(1)');
 assert.equal(run('JSON.stringify(state.furniture)'),run('lockedBefore'));
});
test('Placement refuses a footprint outside the building outline',()=>{
 run('state=validate(clone(DEFAULT_STATE));selection=null;placementPoint=null');
 assert.equal(run('placementValidity({type:"table",n:"t",x:60,z:60,w:.9,d:.9,h:.75,y:0,r:0})'),'Hors de l’emprise');
 assert.equal(run('placementValidity({type:"table",n:"t",x:18,z:3,w:.9,d:.9,h:.75,y:0,r:0})'),'Libre');
});
test('The catalogue announces the dimensions that are actually placed',()=>{
 assert.equal(run('catalogSize("table").w'),.9);assert.equal(run('catalogSize("table").native'),false);
 run('var sizedModel=new THREE.Group();sizedModel.userData.originalSize=new THREE.Vector3(.83,.69,.57);assetCache.set("asset_builtin_chair",sizedModel)');
 assert.equal(run('catalogSize("chair").w'),.83);assert.equal(run('catalogSize("chair").native'),true);
 run('assetCache.delete("asset_builtin_chair")');
});
test('Every catalogue object carries a trade category',()=>assert.ok(run('Object.values(FURN_TYPES).every(t=>FURN_CATEGORIES[t.cat])')));
test('The initial study has no overlapping zones',()=>{
 const worst=run('(()=>{const z=DEFAULT_STATE.zones.map(Arch.polygon);let worst=0;for(let i=0;i<z.length;i++)for(let j=i+1;j<z.length;j++)worst=Math.max(worst,Arch.overlapArea(z[i],z[j]));return worst;})()');
 assert.ok(worst<.01,'overlap '+worst);
});
test('Every object carries a stable identifier preserved by the round trip',()=>{
 run('state=validate({...clone(DEFAULT_STATE),furniture:[{type:"table2",x:17,z:3},{type:"machine",x:17,z:3}]});selection=null');
 assert.equal(run('new Set(state.furniture.map(f=>f.id)).size'),2);
 assert.equal(run('JSON.stringify(validate(JSON.parse(snapshot())).furniture.map(f=>f.id))'),run('JSON.stringify(state.furniture.map(f=>f.id))'));
});
test('An object on a plateau takes the height of that plateau',()=>{
 run('state.furniture[1].support=state.furniture[0].id;state=validate(state)');
 assert.equal(run('state.furniture[1].y'),run('state.furniture[0].h'));
 assert.equal(run('state.furniture[1].support'),run('state.furniture[0].id'));
});
test('Moving and rotating a support carries what rests on it',()=>{
 run('selection={kind:"furniture",i:0};transformFurniture([0],clone(state),1.5,.5);state=validate(state)');
 assert.ok(Math.abs(run('state.furniture[1].x')-18.5)<1e-9);assert.ok(Math.abs(run('state.furniture[1].z')-3.5)<1e-9);
 run('var beforeAngle=state.furniture[1].r;transformFurniture([0],clone(state),0,0,Math.PI/2);state=validate(state)');
 assert.ok(Math.abs(run('state.furniture[1].r-beforeAngle-Math.PI/2'))<1e-9);
 assert.equal(run('state.furniture[1].support'),run('state.furniture[0].id'));
});
test('Raising the plateau raises what rests on it',()=>{
 run('state.furniture[0].h=1.1;state=validate(state)');assert.ok(Math.abs(run('state.furniture[1].y')-1.1)<1e-9);
});
test('An object dragged off its support is detached, not left floating',()=>{
 run('state.furniture[1].x+=4;state=validate(state)');
 assert.equal(run('state.furniture[1].support'),undefined);assert.equal(run('state.furniture[1].y'),1.1);
});
test('Deleting a support detaches what it carried',()=>{
 run('state=validate({...clone(DEFAULT_STATE),furniture:[{type:"table2",x:17,z:3},{type:"machine",x:17,z:3}]});state.furniture[1].support=state.furniture[0].id;state=validate(state);selection={kind:"furniture",i:0};removeSelection()');
 assert.equal(run('state.furniture.length'),1);assert.equal(run('state.furniture[0].support'),undefined);
});
test('Support cycles are broken instead of stacking forever',()=>{
 run('state=validate({...clone(DEFAULT_STATE),furniture:[{type:"table2",x:17,z:3},{type:"caisson",x:17,z:3}]});state.furniture[0].support=state.furniture[1].id;state.furniture[1].support=state.furniture[0].id;state=validate(state)');
 assert.ok(run('!state.furniture[0].support||!state.furniture[1].support'));
 run('state=validate({...clone(DEFAULT_STATE),furniture:[{type:"table2",x:17,z:3,id:"self"}]});state.furniture[0].support="self";state=validate(state)');
 assert.equal(run('state.furniture[0].support'),undefined);
 run('state=validate({...clone(DEFAULT_STATE),furniture:[{type:"table2",x:17,z:3,support:"ghost"}]})');
 assert.equal(run('state.furniture[0].support'),undefined);
});
test('Duplicating a support copies its load with new identifiers',()=>{
 run('state=validate({...clone(DEFAULT_STATE),furniture:[{type:"table2",x:17,z:3},{type:"machine",x:17,z:3}]});state.furniture[1].support=state.furniture[0].id;state=validate(state);selection={kind:"furniture",i:0};duplicateFurniture()');
 assert.equal(run('state.furniture.length'),4);
 assert.equal(run('new Set(state.furniture.map(f=>f.id)).size'),4);
 assert.equal(run('state.furniture[3].support'),run('state.furniture[2].id'));
 assert.notEqual(run('state.furniture[3].support'),run('state.furniture[0].id'));
});
test('The front face points away from the nearest wall',()=>{
 run('state=validate({...clone(DEFAULT_STATE),furniture:[{type:"desk",x:1.2,z:3,r:0}]});selection={kind:"furniture",i:0};orientToWall()');
 const v=JSON.parse(run('JSON.stringify(frontVector(state.furniture[0]))'));
 assert.ok(v.x>.99,'front x '+v.x);assert.ok(Math.abs(v.z)<.01);
 run('commit(()=>state.furniture[0].front="-z");orientToWall()');
 const back=JSON.parse(run('JSON.stringify(frontVector(state.furniture[0]))'));
 assert.ok(back.x>.99,'front x '+back.x);
});
test('Changing variant keeps the anchor point and the bespoke record',()=>{
 run('state=validate({...clone(DEFAULT_STATE),furniture:[{type:"table2",x:17.25,z:3.5,r:.4,y:0,ref:"a consulter",bespoke:true,front:"-x"}]});selection={kind:"furniture",i:0};applyVariant(0,"type:socle")');
 const f=JSON.parse(run('JSON.stringify(state.furniture[0])'));
 assert.equal(f.type,'socle');assert.equal(f.x,17.25);assert.equal(f.z,3.5);assert.equal(f.y,0);
 assert.ok(Math.abs(f.r-.4)<1e-9);assert.equal(f.front,'-x');assert.equal(f.ref,'a consulter');assert.equal(f.bespoke,true);
 assert.equal(f.w,.4);assert.equal(f.h,1);
});
test('Columns can be added, moved, resized and removed',()=>{
 run('state=validate(clone(DEFAULT_STATE));selection=null');
 const before=run('state.building.columns.length');
 run('commit(()=>{state.building.columns.push({x:12,z:8,w:.5,d:.5,h:H});selection={kind:"columns",i:state.building.columns.length-1};})');
 assert.equal(run('state.building.columns.length'),before+1);
 assert.equal(run('selected().x'),12);
 run('commit(()=>{const c=selected();c.x=12.5;c.w=.6;})');
 assert.equal(run('state.building.columns.at(-1).x'),12.5);assert.equal(run('state.building.columns.at(-1).w'),.6);
 run('duplicate()');assert.equal(run('state.building.columns.length'),before+2);assert.equal(run('state.building.columns.at(-1).x'),13);
 run('removeSelection();selection={kind:"columns",i:state.building.columns.length-1};removeSelection()');
 assert.equal(run('state.building.columns.length'),before);
});
test('An impossible column is refused and the edit rolled back',()=>{
 const before=run('JSON.stringify(state.building.columns)');
 run('selection={kind:"columns",i:0};commit(()=>{selected().w=-1;})');
 assert.equal(run('JSON.stringify(state.building.columns)'),before);
});
test('Collisions follow the edited columns, not the inherited list',()=>{
 run('state=validate({...clone(DEFAULT_STATE),furniture:[{type:"chair",x:3,z:3}]});selection=null');
 assert.equal(run('Arch.collisions(state).hard.length'),0);
 run('commit(()=>state.building.columns.push({x:3,z:3,w:.45,d:.45,h:H}))');
 assert.equal(run('Arch.collisions(state).hard.length'),1);
 run('historyStep()');assert.equal(run('Arch.collisions(state).hard.length'),0);
});
test('Wall-mounted catalogue items are drafted at their mounting height',()=>{
 assert.equal(run('catalogDraft("panneau").y'),.6);assert.equal(run('catalogDraft("lavabo").y'),.8);
 assert.equal(run('catalogDraft("table2").y'),0);assert.equal(run('catalogDraft("counter").bespoke'),true);
});
test('The trade catalogue covers every use of the programme',()=>{
 const counts=JSON.parse(run('JSON.stringify(Object.keys(FURN_CATEGORIES).map(c=>Object.values(FURN_TYPES).filter(t=>t.cat===c).length))'));
 assert.ok(counts.every(n=>n>0),'empty category: '+counts.join(','));
 assert.ok(run('Object.keys(FURN_TYPES).length')>=26);
});
test('A selection left dangling by an undo never reaches the renderer',()=>{
 run('state=validate({...clone(DEFAULT_STATE),furniture:[{type:"table2",x:17,z:5}]});selection={kind:"furniture",i:0};commit(()=>{state.furniture.splice(0,1);});selection={kind:"furniture",i:0};rebuild()');
 assert.equal(run('selection'),null);
 run('selection={kind:"columns",i:99};rebuild()');assert.equal(run('selection'),null);
});
test('A default name follows the variant, a chosen name survives it',()=>{
 run('state=validate({...clone(DEFAULT_STATE),furniture:[{type:"table2",x:17,z:3}]});selection={kind:"furniture",i:0};applyVariant(0,"type:socle")');
 assert.equal(run('state.furniture[0].n'),run('FURN_TYPES.socle.n'));
 run('commit(()=>state.furniture[0].n="Socle vitrine A");applyVariant(0,"type:table2")');
 assert.equal(run('state.furniture[0].n'),'Socle vitrine A');
});
test('The proposal flags its bespoke items without changing their dimensions',()=>{
 run('state=validate(clone(DEFAULT_STATE));selection=null;demo()');
 assert.equal(run('state.furniture.filter(f=>f.bespoke).length'),run('state.furniture.filter(f=>FURN_TYPES[f.type].bespoke).length'));
 assert.ok(run('state.furniture.filter(f=>f.bespoke).length')>0);
 assert.equal(run('state.furniture.find(f=>f.type==="chair").w'),.45);
 assert.equal(run('Arch.collisions(state).hard.length'),0);
});
test('A column embedded in a wall wins the click over the wall face in front of it',()=>{
 const pickOf=(hits,current='null')=>run(`JSON.stringify(choosePick(${JSON.stringify(hits)},${current}))`);
 const wall={data:{kind:'walls',i:2},dist:10},column={data:{kind:'columns',i:4},dist:10.2},floor={data:{kind:'zones',i:0},dist:12};
 assert.equal(pickOf([wall,column,floor]),JSON.stringify(column.data));
 assert.equal(pickOf([{data:{kind:'open',wi:2,oi:0},dist:10},column]),JSON.stringify(column.data));
 // Even with the wall selected, the column behind its face stays reachable.
 assert.equal(pickOf([wall,column],'{kind:"walls",i:2}'),JSON.stringify(column.data));
 // A column far behind the wall (another room) does not steal the click.
 assert.equal(pickOf([wall,{data:column.data,dist:14}]),JSON.stringify(wall.data));
 // A handle still has the last word, and an empty ray picks nothing.
 assert.equal(pickOf([wall,column,{data:{kind:'end',i:2,end:1},dist:11}]),JSON.stringify({kind:'end',i:2,end:1}));
 assert.equal(pickOf([]),'null');
});
test('Column nudging keeps the chosen step between clicks',()=>{
 run('state=validate(clone(DEFAULT_STATE));selection={kind:"columns",i:0};columnStep=.5;var startX=state.building.columns[0].x');
 run('commit(()=>{const c=state.building.columns[0];c.x=+(c.x-columnStep).toFixed(4);})');
 assert.ok(Math.abs(run('startX-state.building.columns[0].x')-.5)<1e-9);
 assert.equal(run('columnStep'),.5);
});
test('Circulation analysis reaches every zone of the empty study',()=>{
 run('state=validate(clone(DEFAULT_STATE));selection=null;circulationWidth=.9;var report=analyseCirculation()');
 assert.ok(run('report.doors')>0,'no entrance found');
 assert.ok(run('report.area')>150,'served area '+run('report.area'));
 assert.equal(run('report.zones.filter(z=>!z.served).length'),0);
 assert.ok(run('report.widest')>=.9,'widest '+run('report.widest'));
});
test('A blocked doorway shows the zone losing its access',()=>{
 run('state=validate(clone(DEFAULT_STATE));circulationWidth=.9;var wall=state.walls[7];var openings=wall.op.map(o=>({d:o.d,w:o.w}));state.furniture=openings.map(o=>({type:"rack",n:"barrage",x:6.5,z:o.d,w:2,d:.4,h:1.8,y:0,r:0}));state=validate(state);var blocked=analyseCirculation()');
 assert.ok(run('blocked.zones.filter(z=>!z.served).length')>0,'nothing lost its access');
});
test('Circulation ignores obstacles that are not at walking height',()=>{
 run('state=validate({...clone(DEFAULT_STATE),furniture:[{type:"rack",n:"haut",x:6.5,z:5.5,w:2,d:.4,h:1.8,y:2.1,r:0}]});circulationWidth=.9;var high=analyseCirculation()');
 assert.equal(run('high.zones.filter(z=>!z.served).length'),0);
});
test('A change marks the circulation analysis as stale',()=>{
 run('state=validate(clone(DEFAULT_STATE));analyseCirculation()');assert.equal(run('circulationStale'),false);
 run('commit(()=>state.furniture.push({type:"table2",x:17,z:3}))');assert.equal(run('circulationStale'),true);
});
test('Layout variants are stored, compared and applied without touching the shell',async()=>{
 run('var backupStore=new Map();dbPut=async(k,v)=>{backupStore.set(k,v);return true;};dbGet=async k=>backupStore.get(k)??null;loadAssets=async()=>new Map()');
 run('state=validate(clone(DEFAULT_STATE));selection=null;demo();saveLayoutVariant("Meublee")');
 assert.equal(run('state.variants.length'),1);
 assert.equal(run('state.variants[0].furniture.length'),46);
 run('commit(()=>{state.furniture=[];});saveLayoutVariant("Vide")');
 assert.equal(run('state.variants.length'),2);
 const shell=run('JSON.stringify(state.walls)');
 await run('applyLayoutVariant(state.variants[0].id)');
 assert.equal(run('state.furniture.length'),46);
 assert.equal(run('JSON.stringify(state.walls)'),shell);
 run('historyStep()');assert.equal(run('state.furniture.length'),0);
});
test('Replacing the model keeps a swappable backup that survives the page',async()=>{
 run('var stateBeforeBackupTest=snapshot()');
 run('state=validate(clone(DEFAULT_STATE));selection=null;demo();state.meta.name="Mon travail"');
 await run('backupBeforeReplace("le retour à l’étude initiale")');
 run('state=validate(clone(DEFAULT_STATE));state.meta.name="Étude";undoStack.length=0');
 // The undo history is gone (as after a reload), yet the backup brings the work back...
 await run('restoreProjectBackup()');
 assert.equal(run('state.meta.name'),'Mon travail');assert.equal(run('state.furniture.length'),46);
 // ...and the replaced state becomes the new backup, so a mistaken restore is reversible.
 const entry=JSON.parse(run('backupStore.get(projectLocalKey("avant-remplacement"))'));
 assert.equal(JSON.parse(entry.project).meta.name,'Étude');assert.match(entry.reason,/récupération/);
 // A failed write blocks the replacement instead of losing the work silently.
 run('dbPut=async()=>null');
 await assert.rejects(()=>run('backupBeforeReplace("test")'),/copie de secours/);
 run('commit(()=>{state.variants=[{id:"v_empty",n:"Vide",date:"",furniture:[],zones:clone(state.zones)}];})');
 await run('applyLayoutVariant("v_empty")');
 assert.equal(run('state.furniture.length'),46);
 run('dbPut=async(k,v)=>{backupStore.set(k,v);return true;}');
 // Backups written by the previous release under the opening key are still found.
 run('backupStore.clear();backupStore.set(projectLocalKey("avant-ouverture"),JSON.stringify({...clone(DEFAULT_STATE),meta:{name:"Ancienne copie"}}))');
 assert.match(await run('readProjectBackup().then(e=>e.project)'),/Ancienne copie/);
 run('state=JSON.parse(stateBeforeBackupTest);selection=null');
});
test('Variant comparison reports the metrics of each layout',()=>{
 const html=run('compareVariants()');
 assert.ok(html.includes('Implantation courante'));
 assert.ok(html.includes('Meublee')&&html.includes('Vide'));
 assert.equal(run('variantMetrics(state.variants[0]).objects'),46);
 assert.equal(run('variantMetrics(state.variants[1]).objects'),0);
 assert.equal(run('variantMetrics(state.variants[0]).hard'),0);
});
test('Variants survive the JSON round trip and stay capped',()=>{
 assert.equal(run('JSON.stringify(validate(JSON.parse(snapshot())).variants)'),run('JSON.stringify(state.variants)'));
 run('var many={...clone(state),variants:Array.from({length:9},(_,i)=>({id:"v"+i,n:"x",furniture:[],zones:[]}))}');
 assert.throws(()=>run('validate(many)'));
});
test('A saved view records the mode and restores the framing',()=>{
 run('state=validate(clone(DEFAULT_STATE));setView("plan");target.set(4,0,6);dist=18;saveNamedView("Plan cafe")');
 assert.equal(run('state.views.length'),1);
 assert.equal(run('state.views[0].mode'),'plan');
 run('setView("3d");target.set(0,0,0);dist=44;restoreView(state.views[0].id)');
 assert.equal(run('view'),'plan');assert.equal(run('target.x'),4);assert.equal(run('dist'),18);
 assert.equal(run('JSON.stringify(validate(JSON.parse(snapshot())).views)'),run('JSON.stringify(state.views)'));
});
test('An impossible saved view is rejected with the project',()=>{
 assert.throws(()=>run('validate({...clone(state),views:[{id:"v",n:"x",mode:"plan",target:[0,0,0],eye:[0,0,0],theta:0,phi:0,dist:0,yaw:0,pitch:0}]})'));
});
test('Each JSON export stamps a new revision and filename',()=>{
 run('state=validate(clone(DEFAULT_STATE));state.meta.revision=0;state.meta.name="Etude";');
 assert.equal(run('fileName("json")'),'HubFivesCail_Etude_r000.json');
 run('commit(()=>{state.meta.revision=(state.meta.revision||0)+1;state.meta.exported="2026-09-12";})');
 assert.equal(run('fileName("json")'),'HubFivesCail_Etude_r001.json');
 assert.equal(run('validate(JSON.parse(snapshot())).meta.revision'),1);
});
test('Floor textures are repeated at their real-world size',()=>{
 assert.equal(run('SURFACE_SIZE.tile'),.6);
 assert.ok(run('Object.values(SURFACE_SIZE).every(v=>v>0&&v<6)'));
 const repeats=run('(()=>{rebuild();const floors=[];world.traverse(o=>{if(o.isMesh&&o.material&&o.material.map&&o.material.map.repeat&&o.geometry.type==="ExtrudeGeometry")floors.push(+o.material.map.repeat.x.toFixed(4));});return JSON.stringify(floors);})()');
 assert.ok(JSON.parse(repeats).every(r=>r>.16&&r<1.7),'repeats '+repeats);
});
test('Luminaires light the scene and stay capped',()=>{
 run('state=validate({...clone(DEFAULT_STATE),furniture:Array.from({length:10},(_,i)=>({type:"luminaire",x:16+i*.4,z:3,y:2.15}))});rebuild()');
 assert.equal(run('world.children.filter(o=>o.isPointLight).length'),run('LAMP_LIMIT'));
 run('state=validate(clone(DEFAULT_STATE));rebuild()');
 assert.equal(run('world.children.filter(o=>o.isPointLight).length'),0);
});
test('The shipped proposal is walkable at 0.90 m with every space served',()=>{
 run('state=validate(clone(DEFAULT_STATE));selection=null;demo();circulationWidth=.9;var walk=analyseCirculation()');
 assert.equal(run('Arch.collisions(state).hard.length'),0);
 assert.equal(run('Arch.collisions(state).doors.length'),0);
 assert.equal(run('walk.zones.filter(z=>!z.served).length'),0);
 assert.ok(run('Math.min(...walk.bottlenecks.map(b=>b.width))')>=.9,'goulet '+run('Math.min(...walk.bottlenecks.map(b=>b.width))'));
});
test('Every inherited column sits inside the building outline',()=>{
 run('state=validate(clone(DEFAULT_STATE))');
 assert.ok(run('buildingColumns().every(c=>rectInside({x:c.x-c.w/2,z:c.z-c.d/2,w:c.w,d:c.d}))'));
 assert.equal(run('state.zones.length&&document.getElementById("checks")?0:0'),0);
});
test('A bottleneck is reported with the width and the place that causes it',()=>{
 run('state=validate(clone(DEFAULT_STATE));selection=null;demo();var wcIndex=state.furniture.findIndex(f=>/WC/.test(f.n));commit(()=>{state.furniture[wcIndex].z=6.2;});circulationWidth=.9;var tight=analyseCirculation()');
 const studio=JSON.parse(run('JSON.stringify(tight.bottlenecks.find(b=>/Studio audio/.test(b.n)))'));
 assert.ok(studio.width<.9,'width '+studio.width);
 assert.ok(studio.at&&Math.abs(studio.at.x-6.85)<.6&&Math.abs(studio.at.z-5.5)<.8,'at '+JSON.stringify(studio.at));
 run('commit(()=>{state.furniture[wcIndex].z=6.6;});var clear=analyseCirculation()');
 assert.ok(run('clear.bottlenecks.find(b=>/Studio audio/.test(b.n)).width')>=.9);
});
test('A space moves with the furniture it contains',()=>{
 run('state=validate(clone(DEFAULT_STATE));selection=null;demo();roomCarry=true;selection={kind:"zones",i:4}');
 const inside=run('roomContents(state.zones[4]).length');
 assert.ok(inside>0,'rien dans le studio audio');
 run('var srcRoom=clone(state);var idsRoom=roomContents(state.zones[4]);var firstRoom=idsRoom[0];var beforeRoom=state.furniture[firstRoom].x;commit(()=>roomTranslate(state.zones[4],1,0,idsRoom,srcRoom))');
 assert.ok(Math.abs(run('state.zones[4].x')-1)<1e-9);
 assert.ok(Math.abs(run('state.furniture[firstRoom].x-beforeRoom')-1)<1e-9,'le mobilier n a pas suivi');
 run('historyStep()');assert.equal(run('state.zones[4].x'),0);
});
test('A space can move without its furniture when the option is off',()=>{
 run('state=validate(clone(DEFAULT_STATE));demo();roomCarry=false;selection={kind:"zones",i:4};var srcRoom=clone(state);var firstRoom=roomContents(state.zones[4])[0];var beforeRoom=state.furniture[firstRoom].x;commit(()=>roomTranslate(state.zones[4],1,0,null,srcRoom))');
 assert.ok(Math.abs(run('state.zones[4].x')-1)<1e-9);
 assert.equal(run('state.furniture[firstRoom].x'),run('beforeRoom'));
 run('roomCarry=true');
});
test('Resize handles keep the opposite side in place and a minimum size',()=>{
 run('state=validate(clone(DEFAULT_STATE));selection={kind:"zones",i:4};commit(()=>roomResize(state.zones[4],[1,0],{x:4,z:0}))');
 assert.equal(run('state.zones[4].x'),0);assert.equal(run('state.zones[4].w'),4);
 run('commit(()=>roomResize(state.zones[4],[-1,0],{x:3.9,z:0}))');
 assert.equal(run('state.zones[4].w'),.5);assert.equal(run('state.zones[4].x'),3.5);
 run('commit(()=>roomResize(state.zones[4],[0,1],{x:0,z:9}))');
 assert.equal(run('state.zones[4].d'),9);
});
test('A quarter turn rotates the space and what it carries',()=>{
 run('state=validate({...clone(DEFAULT_STATE),zones:[{n:"Salle",c:"#b8c499",x:2,z:2,w:4,d:2,t:""}],furniture:[{type:"desk",x:3,z:2.5,r:0}]});selection={kind:"zones",i:0};roomCarry=true;roomRotate(1)');
 assert.equal(run('state.zones[0].w'),2);assert.equal(run('state.zones[0].d'),4);
 assert.equal(run('state.zones[0].x'),3);assert.equal(run('state.zones[0].z'),1);
 assert.ok(Math.abs(run('state.furniture[0].r')+Math.PI/2)<1e-9);
 assert.ok(run('Arch.contains(Arch.polygon(state.zones[0]),{x:state.furniture[0].x,z:state.furniture[0].z})'),'le meuble est sorti de la piece');
 run('historyStep()');assert.equal(run('state.zones[0].w'),4);
});
test('Editing a wall or a room never drags its linked neighbours along',()=>{
 const square='state=validate({zones:[{n:"Room",vertices:[{x:0,z:0},{x:4,z:0},{x:4,z:3},{x:0,z:3}],nodes:["a","b","c","d"]}],furniture:[],walls:[{...DW(0,0,4,0),n1:"a",n2:"b",axis:"x"},{...DW(4,0,4,3),n1:"b",n2:"c",axis:"z"},{...DW(4,3,0,3),n1:"c",n2:"d",axis:"x"},{...DW(0,3,0,0),n1:"d",n2:"a",axis:"z"}]});selection=null;var linked=JSON.stringify(state)';
 const others=()=>run('JSON.stringify([state.walls[1],state.walls[2],state.walls[3]].map(w=>[w.x1,w.z1,w.x2,w.z2]))');
 run(square);const start=others();
 // Whole wall moved (as a mouse drag does): only that wall changes, the room keeps its outline.
 run('commit(()=>{const w=state.walls[0];w.z1+=1;w.z2+=1;})');
 assert.equal(others(),start);assert.equal(run('state.walls[0].z1'),1);assert.equal(run('Arch.area(state.zones[0].vertices)'),12);
 // One end moved off its axis: the wall becomes free instead of refusing, neighbours stay.
 run(square);run('commit(()=>{state.walls[0].z2=.5;})');
 assert.equal(others(),start);assert.equal(run('state.walls[0].axis'),'free');
 // The room moved: its walls stay put and the room is unlinked.
 run(square);run('commit(()=>roomTranslate(state.zones[0],2,0,null,clone(state)))');
 assert.equal(others(),start);assert.equal(run('state.walls[0].x1'),0);assert.equal(run('state.zones[0].nodes'),undefined);
 // An edit that does not move anything keeps the links.
 run(square);run('commit(()=>{state.walls[0].h=3})');assert.equal(run('state.walls[0].n1+state.zones[0].nodes.join("")'),'aabcd');
});
test('A wall cut at 1.20 m is found by its trace, openings included, with a small margin',()=>{
 run('var savedCutState=snapshot();state=validate({zones:[],furniture:[],walls:[{...DW(0,0,10,0,"cloison",.15),op:[{type:"porte",w:1,h:2.1,sill:0,d:5}]},{...DW(0,4,10,4,"cloison",.15),h:1}]})');
 const at=(x,z,tol=.05)=>run(`JSON.stringify(cutWallAt({x:${x},z:${z}},${tol}))`);
 assert.equal(at(2,.05),JSON.stringify({kind:'walls',i:0}));
 assert.equal(at(5.3,0),JSON.stringify({kind:'open',wi:0,oi:0}));
 assert.equal(at(2,.3),'null');
 assert.equal(at(2,.3,.3),JSON.stringify({kind:'walls',i:0}));
 // A low wall is not clipped by the cut: it keeps its ordinary faces and is not duplicated here.
 assert.equal(at(2,4),'null');
 assert.equal(at(12,0),'null');
 run('state=JSON.parse(savedCutState)');
});
test('Hover cursor tells what can be grabbed',()=>{
 run('tool="select";view="3d";state=validate(clone(DEFAULT_STATE))');
 assert.equal(run('cursorFor({kind:"walls",i:0})'),'grab');
 assert.equal(run('cursorFor({kind:"columns",i:0})'),'grab');
 assert.equal(run('cursorFor({kind:"room",i:0,mode:"resize",axis:[1,1]})'),'nwse-resize');
 assert.equal(run('cursorFor(null)'),'default');
 run('tool="measure"');assert.equal(run('cursorFor({kind:"walls",i:0})'),'crosshair');
 run('tool="navigate"');assert.equal(run('cursorFor(null)'),'grab');
 run('tool="select";setHover({kind:"walls",i:0})');assert.equal(run('hoverGroup.children.length'),1);
 run('setHover(null)');assert.equal(run('hoverGroup.children.length'),0);
});
test('A read-only consultation refuses edits, history steps and local saves',()=>{
 run('state=validate(clone(DEFAULT_STATE));selection=null;undoStack.length=0;commit(()=>{state.walls[0].h=3})');
 const h=run('state.walls[0].h'),undo=run('undoStack.length');
 run('var persisted=0;var realPersist=persistProject;dbPut=async()=>{persisted++;return true;};readOnly={title:"Paul"}');
 run('commit(()=>{state.walls[0].h=1})');assert.equal(run('state.walls[0].h'),h);assert.equal(run('undoStack.length'),undo);
 run('historyStep()');assert.equal(run('state.walls[0].h'),h);
 run('persistPending=null;persistProject()');assert.equal(run('persistPending'),null);
 run('beginPlacement({type:"table",w:1,d:1,h:1})');assert.equal(run('placementDraft'),null);
 run('readOnly=null');
});
test('The context menu offers the actions of the element, and only safe ones in consultation',()=>{
 run('state=validate(clone(DEFAULT_STATE));demo();selection={kind:"furniture",i:0}');
 const labels=()=>JSON.parse(run('JSON.stringify(contextActions().map(a=>a.label))'));
 assert.deepEqual(labels(),['Propriétés','Cadrer','Tourner de 90°','Verrouiller','Dupliquer','Supprimer']);
 run('selection={kind:"open",wi:state.walls.findIndex(w=>w.op.length),oi:0}');
 assert.deepEqual(labels(),['Propriétés','Cadrer','Sélectionner le mur','Supprimer']);
 run('readOnly={title:"Paul"}');assert.deepEqual(labels(),['Propriétés','Cadrer','Sélectionner le mur']);run('readOnly=null');
 assert.equal(run('JSON.stringify(contextTarget({kind:"end",i:3,end:1}))'),JSON.stringify({kind:'walls',i:3}));
 assert.equal(run('contextTarget({kind:"slab"})'),null);
 run('selection=null');
});
test('Walls and columns are no longer behind a drag protection',()=>{
 assert.equal(run('typeof lockBuilding'),'undefined');
 assert.equal(run('typeof dragBlocked'),'undefined');
});
test('Every space exposes handles and numeric fields',()=>{
 run('state=validate(clone(DEFAULT_STATE))');
 for(let i=0;i<8;i++){
  run('selection={kind:"zones",i:'+i+'};rebuild()');
  const handles=run('(()=>{let n=0;helpers.traverse(o=>{if(o.userData.pick&&o.userData.pick.kind==="room")n++;});return n;})()');
  assert.equal(handles,9,'espace '+i+' : '+handles+' poignées');
 }
});
test('Handles take precedence over the body they belong to',()=>{
 assert.ok(run('HANDLE_KINDS.has("room")&&HANDLE_KINDS.has("vertex")&&HANDLE_KINDS.has("end")&&HANDLE_KINDS.has("rotate")'));
 assert.equal(run('HANDLE_KINDS.has("zones")||HANDLE_KINDS.has("furniture")'),false);
});
test('Unassigned floor becomes a space that fills the gap up to walls and neighbours',()=>{
 run('state=validate(clone(DEFAULT_STATE));selection=null');
 const before=run('state.zones.length');
 const gap=run('JSON.stringify(freeRectAt({x:12,z:2}))');
 const r=JSON.parse(gap);
 assert.ok(r,'aucun rectangle libre trouve');
 assert.ok(r.x>6.4&&r.x<7.1,'bord ouest '+gap);
 assert.ok(r.x+r.w>14.4&&r.x+r.w<15.1,'bord est '+gap);
 assert.ok(r.w*r.d>25,'surface trop faible '+gap);
 run('createRoomAt({x:12,z:2})');
 assert.equal(run('state.zones.length'),before+1);
 assert.equal(run('selection.kind'),'zones');
 assert.ok(run('Arch.area(Arch.polygon(state.zones.at(-1)))')>25);
 const overlap=run('(()=>{const z=state.zones.at(-1),p=Arch.polygon(z);let worst=0;for(let i=0;i<state.zones.length-1;i++)worst=Math.max(worst,Arch.overlapArea(p,Arch.polygon(state.zones[i])));return worst;})()');
 assert.ok(overlap<.01,'le nouvel espace chevauche : '+overlap);
 run('historyStep()');assert.equal(run('state.zones.length'),before);
});
test('A point on a wall or outside the footprint creates nothing',()=>{
 run('state=validate(clone(DEFAULT_STATE));selection=null');
 assert.equal(run('freeRectAt({x:6.5,z:5})'),null);
 assert.equal(run('freeRectAt({x:40,z:40})'),null);
 const before=run('state.zones.length');
 run('createRoomAt({x:40,z:40})');
 assert.equal(run('state.zones.length'),before);
});
test('The whole floor of the study can be assigned to spaces',()=>{
 run('state=validate(clone(DEFAULT_STATE));selection=null;var loops=0;var pt;while(loops++<12){pt=null;for(let x=.5;x<21&&!pt;x+=.5)for(let z=.5;z<25&&!pt;z+=.5){const r=freeRectAt({x,z});if(r&&r.w*r.d>2)pt={x,z};}if(!pt)break;createRoomAt(pt);}');
 const left=run('Arch.area(buildingOutline())-unionInside(state.zones)');
 assert.ok(left<12,'reste '+left.toFixed(1)+' m2 hors zonage');
});
(async()=>{
 for(const [name,fn] of queue){try{await fn();}catch(e){console.error('FAIL '+name);console.error(e);process.exit(1);}tests++;console.log('PASS '+name);}
 console.log('\n'+tests+' checks passed. Renderer is mocked; browser smoke tests are separate.');
})();
if(process.argv.includes('--write-proposal'))fs.writeFileSync(__dirname+'/../Proposition_Hub_Fives_Cail.json',run('JSON.stringify(state,null,2)'));
if(process.argv.includes('--write-proposal-v4')){
 const candidate=JSON.parse(run('snapshot()')),catalog=JSON.parse(run('JSON.stringify(BUNDLED_MODELS)'));
 candidate.meta.name='Proposition V4 — implantation corrigée';
 for(const [id,file,x,z,w,d,h] of [['chair','SheenChair-compatible',19.5,20.5,.827,.57,.686],['sofa','SheenWoodLeatherSofa',19,16,2.726,.923,1.117]]){
  const key='asset_builtin_'+id;candidate.assets[key]={builtin:id,name:catalog[id].name,credit:catalog[id].credit,source:catalog[id].source};
  candidate.furniture.push({type:'custom',assetId:key,n:catalog[id].name,x,z,w,d,h,y:0,r:0});
 }
 ctx.variantInput=candidate;const valid=run('validate(variantInput)');ctx.variantInput=valid;
 assert.equal(run('Arch.collisions(variantInput).hard.length'),0);assert.equal(run('Arch.collisions(variantInput).doors.length'),0);
 for(const [id,file] of [['chair','SheenChair-compatible'],['sofa','SheenWoodLeatherSofa']])valid.assets['asset_builtin_'+id].data='data:application/octet-stream;base64,'+fs.readFileSync(__dirname+'/models/'+file+'.glb').toString('base64');
 fs.writeFileSync(__dirname+'/../Proposition_Hub_Fives_Cail_V4.json',JSON.stringify(valid,null,2));
 console.log('V4 variant saved: 48 objects, no hard collision or blocked door detected.');
}
