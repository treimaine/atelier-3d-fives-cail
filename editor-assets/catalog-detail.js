'use strict';
// Mobilier détaillé : modèles construits pièce par pièce dans leurs cotes de catalogue, matières PBR,
// surfaces de pose déclarées et objets complémentaires du programme (régie, studios, coffee shop,
// labo, loges, sanitaires, ateliers). Chaque constructeur tient exactement dans w × h × d : au-delà,
// furnitureModel écraserait le modèle pour le faire entrer dans son encombrement.

// top : hauteur de la surface de pose, en mètres, pour les dimensions de catalogue. Un objet
// « support » (écran, console, machine…) s'y pose, même si le meuble a des parties plus hautes.
const FURNITURE_TOPS={table:.75,table2:.75,desk:.74,counter:1.1,bureauregie:.75,tablepodcast:.74,regie:.9,caisson:.6,socle:1,stage:.4,
 reunion:.75,tablebasse:.4,mangedebout:1.1,accueil:1.1,armoire:1.8,vitrine:1.3,lave:.85,djbooth:1.05,meubletv:.5,rack19:1,cuisine:.9,tableatelier:.9,piano:.8};
for(const [k,top] of Object.entries(FURNITURE_TOPS))if(FURN_TYPES[k])FURN_TYPES[k].top=top;
// Bureau de régie : pont de mesure central bas, les enceintes de monitoring se posent aux angles arrière.
Object.assign(FURN_TYPES.bureauregie,{h:.9});
// Le lave-mains se fixe au mur mais se décrit depuis le sol : sa vasque est à 0,80 m.
Object.assign(FURN_TYPES.lavabo,{y:0});
Object.assign(FURN_TYPES,{
 ordinateur:{n:'Écran d’ordinateur',w:.62,d:.2,h:.45,c:0x1d2124,cat:'bureau',mount:'support'},
 portable:{n:'Ordinateur portable',w:.34,d:.24,h:.22,c:0x9aa0a4,cat:'bureau',mount:'support'},
 lampebureau:{n:'Lampe de bureau',w:.2,d:.3,h:.45,c:0x2b2f31,cat:'bureau',mount:'support'},
 rayonnage:{n:'Rayonnage métallique',w:1.2,d:.5,h:2,c:0x8a9296,cat:'bureau'},
 clavier:{n:'Clavier maître MIDI',w:.82,d:.26,h:.09,c:0x1f2326,cat:'audio',mount:'support'},
 rack19:{n:'Rack d’effets 19"',w:.56,d:.6,h:1,c:0x1c1f21,cat:'audio'},
 guitare:{n:'Guitare sur stand',w:.4,d:.35,h:1.05,c:0xa0522d,cat:'audio'},
 basstrap:{n:'Piège à basses d’angle',w:.6,d:.6,h:2,c:0x4a5a52,cat:'audio'},
 diffuseur:{n:'Diffuseur acoustique',w:.6,d:.12,h:.6,c:0xb08a5a,cat:'audio',mount:'mur',y:1.3},
 tv:{n:'Téléviseur sur pied',w:1.25,d:.25,h:.8,c:0x15191b,cat:'commun',mount:'support'},
 meubletv:{n:'Meuble bas',w:1.8,d:.45,h:.5,c:0x6b4f3a,cat:'commun'},
 miroir:{n:'Miroir',w:.6,d:.03,h:.9,c:0xd9dde0,cat:'sanitaire',mount:'mur',y:1},
 miroirloge:{n:'Miroir de loge éclairé',w:1,d:.06,h:.8,c:0x2b2f31,cat:'commun',mount:'mur',y:1.1},
 portant:{n:'Portant à vêtements',w:1.2,d:.5,h:1.6,c:0x5a6e8c,cat:'commun'},
 urinoir:{n:'Urinoir',w:.38,d:.33,h:.62,c:0xf4f2ee,cat:'sanitaire',mount:'mur',y:.42},
 banquette:{n:'Banquette murale',w:2,d:.6,h:.9,c:0x3e5b52,cat:'cafe'},
 moulin:{n:'Moulin à café',w:.2,d:.3,h:.5,c:0x2a2d2f,cat:'cafe',mount:'support'},
 etagere:{n:'Étagère murale',w:.9,d:.25,h:.3,c:0x9c7b54,cat:'cafe',mount:'mur',y:1.5},
 cuisine:{n:'Plan de travail avec évier',w:2,d:.65,h:.9,c:0xe9e6df,cat:'cafe'},
 four:{n:'Four mixte sur piétement',w:.9,d:.8,h:1.6,c:0xa9b0b3,cat:'cafe'},
 tableatelier:{n:'Table d’atelier',w:1.8,d:.8,h:.9,c:0xb99a6b,cat:'evenement'},
 spot:{n:'Projecteur scénique sur pied',w:.5,d:.5,h:2.2,c:0x1f2427,cat:'evenement',light:true,lightAt:.95},
 toilette:{n:'WC suspendu',w:.4,d:.6,h:.82,c:0xf4f2ee,cat:'sanitaire',mount:'mur'},
 videoproj:{n:'Vidéoprojecteur plafond',w:.42,d:.36,h:.5,c:0xe9e9e6,cat:'evenement',mount:'plafond',y:2.8}
});
for(const [k,top] of Object.entries(FURNITURE_TOPS))if(FURN_TYPES[k])FURN_TYPES[k].top=top;

// Hauteur de la surface de pose d'un objet, à ses dimensions réelles.
function surfaceHeight(f){const t=FURN_TYPES[f.type];return t&&t.top!=null&&t.h?t.top*(f.h/t.h):f.h;}
function surfaceTop(f){return f.y+surfaceHeight(f);}
// Meubles qui reçoivent des objets : ceux dont la surface est déclarée, et les modèles importés de hauteur de plateau.
function canHost(s){const t=FURN_TYPES[s.type];return t?t.top!=null:s.type==='custom'&&s.h>=.3&&s.h<=1.4;}
function mountOf(f){return f.type==='custom'?'sol':FURN_TYPES[f.type]?.mount||'sol';}

// Matières partagées, créées au premier meuble construit (le pool de l'éditeur les conserve).
let detailMaterials=null;
function detailTexture(kind){const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext?.('2d');if(typeof ctx?.createLinearGradient!=='function')return null;
 let seed=kind.length*977;const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
 if(kind==='walnut'||kind==='lightwood'){ctx.fillStyle=kind==='walnut'?'#5a3e2b':'#c9ab82';ctx.fillRect(0,0,256,256);
  for(let i=0;i<220;i++){const y=rnd()*256,v=kind==='walnut'?40+rnd()*50:150+rnd()*60;ctx.strokeStyle=`rgba(${v},${v*.75},${v*.5},.35)`;ctx.lineWidth=.5+rnd()*1.6;ctx.beginPath();ctx.moveTo(0,y);for(let x=0;x<=256;x+=32)ctx.lineTo(x,y+Math.sin(x/40+i)*2.5);ctx.stroke();}}
 else if(kind==='marble'){ctx.fillStyle='#ecebe6';ctx.fillRect(0,0,256,256);for(let i=0;i<14;i++){ctx.strokeStyle=`rgba(120,120,125,${.08+rnd()*.18})`;ctx.lineWidth=.6+rnd()*1.8;ctx.beginPath();let x=rnd()*256,y=0;ctx.moveTo(x,y);while(y<256){x+=(rnd()-.5)*28;y+=8+rnd()*14;ctx.lineTo(x,y);}ctx.stroke();}}
 else if(kind==='fabric'){ctx.fillStyle='#808080';ctx.fillRect(0,0,256,256);for(let y=0;y<256;y+=2)for(let x=0;x<256;x+=2){const v=110+((x+y)%4?18:-12)+rnd()*26;ctx.fillStyle=`rgb(${v},${v},${v})`;ctx.fillRect(x,y,2,2);}}
 else if(kind==='foam'){ctx.fillStyle='#3a3f3d';ctx.fillRect(0,0,256,256);for(let y=0;y<256;y+=32)for(let x=0;x<256;x+=32){const g=ctx.createLinearGradient(x,y,x+32,y+32);g.addColorStop(0,'#5d635f');g.addColorStop(1,'#1f2321');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x+16,y+2);ctx.lineTo(x+30,y+16);ctx.lineTo(x+16,y+30);ctx.lineTo(x+2,y+16);ctx.fill();}}
 else if(kind==='daw'){ctx.fillStyle='#14181c';ctx.fillRect(0,0,256,256);ctx.fillStyle='#232a31';ctx.fillRect(0,0,256,18);const colors=['#e0a458','#5fb3a1','#8f7ad8','#d9695f','#6aa0d8'];
  for(let r=0;r<9;r++){ctx.fillStyle='#1b2127';ctx.fillRect(0,22+r*24,40,22);for(let i=0;i<5;i++){const x=44+rnd()*170,w=20+rnd()*60;ctx.fillStyle=colors[r%5];ctx.globalAlpha=.85;ctx.fillRect(x,24+r*24,Math.min(w,252-x),18);ctx.globalAlpha=1;}}
  ctx.fillStyle='#e9eef2';ctx.fillRect(120,18,1.5,238);}
 else if(kind==='office'){ctx.fillStyle='#f4f5f6';ctx.fillRect(0,0,256,256);ctx.fillStyle='#2f3b48';ctx.fillRect(0,0,256,20);ctx.fillStyle='#dfe4ea';ctx.fillRect(0,20,54,236);
  for(let i=0;i<12;i++){ctx.fillStyle=i%4?'#c9d1da':'#7d91a8';ctx.fillRect(66,34+i*18,60+rnd()*150,7);}ctx.fillStyle='#e2b18a';ctx.fillRect(170,180,70,50);}
 else if(kind==='tvimage'){const g=ctx.createLinearGradient(0,0,256,256);g.addColorStop(0,'#1d3b5a');g.addColorStop(.6,'#c96f4a');g.addColorStop(1,'#f0c27a');ctx.fillStyle=g;ctx.fillRect(0,0,256,256);ctx.fillStyle='rgba(255,255,255,.85)';ctx.font='700 30px Georgia';ctx.fillText('FIVES CAIL',40,140);}
 else if(kind==='books'){const colors=['#8c3b2f','#2f4f6b','#c9a24a','#3f6b4a','#e3ddd0','#6b3f5e','#1f2a33'];let x=0;while(x<256){const w=8+rnd()*14;ctx.fillStyle=colors[Math.floor(rnd()*colors.length)];ctx.fillRect(x,rnd()*40,w-1,256);x+=w;}}
 const t=new THREE.CanvasTexture(c);t.colorSpace=kind==='fabric'||kind==='foam'?THREE.NoColorSpace:THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;if(typeof texturePool!=='undefined')texturePool.add(t);return t;}
function dm(){if(detailMaterials)return detailMaterials;
 const tex=k=>detailTexture(k),std=o=>material(o),phys=o=>{const m=new THREE.MeshPhysicalMaterial(o);pool.add(m);return m;};
 const walnutMap=tex('walnut'),lightMap=tex('lightwood'),marbleMap=tex('marble'),foamMap=tex('foam'),daw=tex('daw'),office=tex('office'),tvimage=tex('tvimage'),books=tex('books');
 detailMaterials={
  walnut:std({color:0xffffff,map:walnutMap,roughness:.5}),lightwood:std({color:0xffffff,map:lightMap,roughness:.55}),
  lacquer:phys({color:0x0d0f10,roughness:.18,clearcoat:1,clearcoatRoughness:.08}),
  satinWhite:std({color:0xf1efe9,roughness:.35}),laminate:std({color:0xe4e1d8,roughness:.6}),
  steel:std({color:0xb9bec2,metalness:1,roughness:.32}),chrome:std({color:0xf2f4f5,metalness:1,roughness:.08}),
  darkSteel:std({color:0x2b2f32,metalness:.8,roughness:.4}),brass:std({color:0xc9a35a,metalness:1,roughness:.25}),
  blackMatte:std({color:0x17191a,roughness:.75}),rubber:std({color:0x101112,roughness:.95}),
  marble:phys({color:0xffffff,map:marbleMap,roughness:.18,clearcoat:.6,clearcoatRoughness:.15}),
  ceramic:phys({color:0xf6f5f1,roughness:.12,clearcoat:.8,clearcoatRoughness:.05}),
  leather:phys({color:0x5b3a28,roughness:.48,clearcoat:.25,clearcoatRoughness:.4}),
  foam:std({color:0xffffff,map:foamMap,roughness:1}),
  glass:phys({color:0xdfeef0,roughness:.05,metalness:0,transparent:true,opacity:.28,depthWrite:false}),
  mirror:std({color:0xf2f5f7,metalness:1,roughness:.02}),
  screenOff:std({color:0x07090a,roughness:.15,metalness:.4}),
  daw:std({color:0x000000,emissive:0xffffff,emissiveMap:daw,emissiveIntensity:.9,roughness:.25}),
  office:std({color:0x000000,emissive:0xffffff,emissiveMap:office,emissiveIntensity:.75,roughness:.25}),
  tv:std({color:0x000000,emissive:0xffffff,emissiveMap:tvimage,emissiveIntensity:.8,roughness:.25}),
  books:std({color:0xffffff,map:books,roughness:.8}),
  bulb:std({color:0xfff1d6,emissive:0xffd9a0,emissiveIntensity:2.2}),led:std({color:0xffffff,emissive:0xffc98a,emissiveIntensity:1.6}),
  ledBlue:std({color:0x9fd4ff,emissive:0x4aa3ff,emissiveIntensity:1.3}),ledRed:std({color:0xff9a8a,emissive:0xff3b2a,emissiveIntensity:1.2}),
  paper:std({color:0xf3f1ea,roughness:.9}),leaf:std({color:0x3f6b35,roughness:.7}),
  cone:std({color:0x222527,roughness:.55}),cream:std({color:0xe7e1d3,roughness:.8})};
 return detailMaterials;}
// Teintes unies partagées : une matière par couleur, créée une seule fois.
const tintCache=new Map();
function tint(color,roughness=.7,metalness=0){const key=color+'/'+roughness+'/'+metalness;let m=tintCache.get(key);if(!m){m=material({color,roughness,metalness});tintCache.set(key,m);}return m;}
// Tissu : un matériau velouté (sheen) par objet, teinté de la couleur de l'objet.
let fabricNormal=null;
function clothMaterial(color){const m=new THREE.MeshPhysicalMaterial({color,roughness:.88,sheen:.8,sheenRoughness:.6,sheenColor:new THREE.Color(color).lerp(new THREE.Color(0xffffff),.35)});
 if(fabricNormal===null)fabricNormal=detailTexture('fabric')||false;if(fabricNormal){m.roughnessMap=fabricNormal;fabricNormal.repeat?.set(3,3);}return m;}

// Primitives complémentaires. Les coordonnées sont celles du meuble : centre au sol, avant vers +Z.
function lathe(g,points,x,y,z,m,seg=32){const o=new THREE.Mesh(new THREE.LatheGeometry(points.map(([r,h])=>new THREE.Vector2(r,h)),seg),m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o;}
function torus(g,r,tube,x,y,z,m,rx=0,ry=0,arc=Math.PI*2){const o=new THREE.Mesh(new THREE.TorusGeometry(r,tube,10,32,arc),m);o.position.set(x,y,z);o.rotation.set(rx,ry,0);o.castShadow=true;g.add(o);return o;}
function rod(g,a,b,r,m,seg=10){const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),len=va.distanceTo(vb);const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,seg),m);o.position.copy(va).add(vb).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),vb.clone().sub(va).normalize());o.castShadow=true;g.add(o);return o;}
function taperedLegs(g,w,d,h,inset,m,r=.022){for(const x of [-w/2+inset,w/2-inset])for(const z of [-d/2+inset,d/2-inset])cylinder(g,r,r*.7,h,x,h/2,z,m,12);}
function speakerCone(g,r,x,y,z,D){cylinder(g,r,r,.012,x,y,z,D.darkSteel,24).rotation.x=Math.PI/2;cylinder(g,r*.82,r*.3,.02,x,y,z+.006,D.cone,24).rotation.x=Math.PI/2;sphere(g,r*.22,x,y,z+.012,D.blackMatte,1,1,.5);}

const DETAIL_BUILDERS={
 table(g,t,c,D){cylinder(g,.45,.45,.03,0,.735,0,D.lightwood,56);cylinder(g,.44,.44,.012,0,.714,0,D.walnut,56);cylinder(g,.03,.03,.64,0,.39,0,D.darkSteel,16);cylinder(g,.06,.06,.05,0,.69,0,D.darkSteel,20);
  for(const a of [0,Math.PI/2]){const b=box(g,.62,.03,.06,0,.02,0,D.darkSteel);b.rotation.y=a;}for(const [x,z] of [[.3,0],[-.3,0],[0,.3],[0,-.3]])cylinder(g,.022,.022,.012,x,.006,z,D.rubber,10);},
 table2(g,t,c,D){box(g,1.2,.032,.8,0,.734,0,D.lightwood);box(g,1.08,.07,.68,0,.68,0,D.walnut);taperedLegs(g,1.2,.8,.72,.06,D.walnut,.024);},
 chair(g,t,c,D){box(g,.44,.05,.42,0,.45,.01,c);box(g,.4,.02,.4,0,.42,.01,D.walnut);taperedLegs(g,.42,.4,.43,.03,D.walnut,.017);
  for(const x of [-.19,.19])rod(g,[x,.43,-.19],[x,.86,-.215],.015,D.walnut);box(g,.42,.2,.035,0,.74,-.21,c).rotation.x=-.08;rod(g,[-.19,.2,-.17],[.19,.2,-.17],.009,D.walnut);},
 sofa(g,t,c,D){box(g,1.9,.12,.85,0,.15,0,D.walnut);box(g,1.9,.5,.2,0,.55,-.325,c);for(const x of [-.86,.86])box(g,.18,.5,.85,x,.39,0,c);
  for(const x of [-.4,.4]){box(g,.8,.16,.62,x,.3,.08,c);box(g,.78,.36,.14,x,.56,-.17,c).rotation.x=-.18;}for(const x of [-.88,.88])for(const z of [-.36,.36])cylinder(g,.02,.014,.09,x,.045,z,D.brass,10);},
 counter(g,t,c,D){box(g,2.9,1.0,.6,0,.55,-.03,D.walnut);for(let x=-1.42;x<1.43;x+=.06)cylinder(g,.022,.022,.9,x,.54,.272,D.lightwood,10);box(g,2.9,.08,.55,0,.04,-.05,D.blackMatte);
  box(g,3,.04,.7,0,1.08,0,D.marble);box(g,2.9,.012,.012,0,1.052,.33,D.led);for(let x=-1.1;x<1.2;x+=.55){box(g,.5,.02,.5,x,.45,-.05,D.lightwood);box(g,.5,.02,.5,x,.75,-.05,D.lightwood);}},
 machine(g,t,c,D){box(g,.76,.3,.5,0,.2,-.02,D.steel);box(g,.78,.05,.52,0,.025,-.01,D.darkSteel);box(g,.7,.06,.44,0,.38,-.02,D.darkSteel);for(let x=-.3;x<.31;x+=.05)box(g,.012,.02,.4,x,.42,-.02,D.chrome);
  box(g,.6,.02,.16,0,.07,.16,D.chrome);for(const x of [-.18,.18]){cylinder(g,.05,.05,.07,x,.29,.22,D.chrome,20);cylinder(g,.045,.045,.03,x,.235,.25,D.darkSteel,20);box(g,.02,.02,.14,x,.235,.33,D.blackMatte);cylinder(g,.03,.028,.05,x,.11,.21,D.ceramic,16);}
  for(const x of [-.34,.34])rod(g,[x,.3,.2],[x*1.02,.1,.26],.006,D.chrome);for(const x of [-.08,.08])cylinder(g,.032,.032,.01,x,.26,.231,D.satinWhite,20).rotation.x=Math.PI/2;box(g,.4,.03,.012,0,.33,.232,D.brass);},
 vitrine(g,t,c,D){box(g,1.2,.62,.7,0,.31,0,D.walnut);box(g,1.2,.04,.7,0,.64,0,D.marble);box(g,1.16,.6,.02,0,.95,.33,D.glass).rotation.x=-.25;box(g,1.16,.62,.02,0,.97,-.33,D.glass);for(const x of [-.59,.59])box(g,.02,.62,.66,x,.96,0,D.glass);box(g,1.2,.03,.7,0,1.285,0,D.darkSteel);
  box(g,1.1,.01,.5,0,.95,0,D.glass);box(g,1.1,.01,.02,0,1.26,.3,D.led);const col=[0xd9a066,0xa0522d,0xf2e3c6,0xe8b0b8,0x7b4a2e];let i=0;for(const y of [.67,.96])for(let x=-.45;x<.46;x+=.15){cylinder(g,.05,.055,.04,x,y+.02,.02,tint(col[i++%5],.7),16);}},
 frigo(g,t,c,D){box(g,.75,1.94,.72,0,.97,-.03,D.steel);box(g,.7,1.72,.03,0,1.02,.35,D.glass);box(g,.75,.14,.06,0,1.92,.34,D.blackMatte);box(g,.5,.05,.005,0,1.92,.372,D.led);box(g,.03,.7,.03,.31,1.1,.38,D.chrome);
  const bot=[0xa33b2c,0x3c6e47,0xd9a441,0x2f4f6b,0xe6e1d5];for(let s=0;s<4;s++){const y=.25+s*.42;box(g,.66,.015,.6,0,y,-.03,D.chrome);for(let i=0;i<6;i++)cylinder(g,.032,.032,.22,-.26+i*.105,y+.12,.12,tint(bot[(i+s)%5],.3,.1),12);}
  box(g,.75,.06,.72,0,.03,-.03,D.blackMatte);},
 lave(g,t,c,D){box(g,.6,.8,.6,0,.4,0,D.steel);box(g,.56,.5,.02,0,.42,.3,D.darkSteel);box(g,.4,.03,.04,0,.72,.31,D.chrome);for(const x of [-.2,-.15])box(g,.02,.02,.01,x,.76,.305,D.ledBlue);box(g,.6,.05,.6,0,.825,0,D.steel);},
 desk(g,t,c,D){box(g,1.5,.028,.75,0,.726,0,D.lightwood);for(const x of [-.68,.68]){box(g,.05,.7,.05,x,.36,.3,D.darkSteel);box(g,.05,.7,.05,x,.36,-.3,D.darkSteel);box(g,.05,.04,.62,x,.69,0,D.darkSteel);box(g,.05,.04,.62,x,.02,0,D.darkSteel);}
  box(g,1.3,.35,.012,0,.5,-.33,D.laminate);box(g,1.2,.06,.12,0,.66,-.28,D.darkSteel);},
 armoire(g,t,c,D){box(g,1,1.72,.45,0,.9,0,D.walnut);for(const x of [-.25,.25])box(g,.49,1.66,.02,x,.9,.228,D.laminate);for(const x of [-.03,.03])box(g,.012,.22,.02,x,1,.245,D.brass);box(g,.98,.08,.42,0,.04,0,D.blackMatte);},
 caisson(g,t,c,D){box(g,.42,.54,.58,0,.31,0,D.laminate);for(let i=0;i<3;i++){box(g,.4,.16,.015,0,.14+i*.175,.292,D.satinWhite);box(g,.14,.012,.02,0,.2+i*.175,.305,D.chrome);}for(const x of [-.16,.16])for(const z of [-.24,.24])sphere(g,.025,x,.025,z,D.rubber);},
 booth(g,t,c,D){box(g,2,.06,1.5,0,.03,0,D.walnut);for(const x of [-.96,.96])box(g,.08,2.1,1.5,x,1.11,0,D.laminate);box(g,2,2.1,.08,0,1.11,-.71,D.laminate);box(g,2,.08,1.5,0,2.16,0,D.laminate);
  for(const x of [-.915,.915]){const f=box(g,.01,1.9,1.3,x,1.1,-.02,D.foam);f.material=D.foam;}box(g,1.7,1.9,.01,0,1.1,-.665,D.foam);
  box(g,.9,2,.06,-.45,1.06,.72,D.laminate);box(g,.8,1,.02,.46,1.4,.72,D.glass);box(g,.8,1,.03,.46,.5,.72,D.laminate);box(g,.02,.2,.04,-.1,1.05,.76,D.chrome);box(g,.18,.04,.08,-.45,2.05,.76,D.ledRed);
  cylinder(g,.08,.08,.04,.6,2.21,-.3,D.darkSteel,20);box(g,.3,.012,.3,0,2.11,0,D.led);},
 bureauregie(g,t,c,D){// plateau à 0,75 m, accoudoir avant gainé, baies 19" dans les jambages, pont de mesure central
  box(g,1.8,.035,.9,0,.732,0,D.walnut);box(g,1.8,.045,.1,0,.73,.41,D.leather);for(const x of [-.72,.72]){box(g,.36,.7,.8,x,.35,-.04,D.blackMatte);for(let u=0;u<5;u++){box(g,.3,.1,.01,x,.12+u*.12,.362,D.darkSteel);box(g,.02,.012,.005,x-.1,.13+u*.12,.37,u%2?D.ledBlue:D.led);}}
  box(g,.9,.15,.2,0,.825,-.33,D.walnut);box(g,.84,.08,.005,0,.83,-.229,D.daw);box(g,1.0,.012,.3,0,.42,.1,D.blackMatte);},
 moniteur(g,t,c,D){box(g,.25,.4,.3,0,.2,0,D.blackMatte);speakerCone(g,.085,0,.14,.151,D);cylinder(g,.022,.022,.012,0,.31,.151,D.chrome,16).rotation.x=Math.PI/2;box(g,.08,.018,.01,0,.035,.152,D.darkSteel);box(g,.01,.01,.005,.1,.37,.152,D.ledBlue);},
 panneau(g,t,c,D){box(g,1.16,1.96,.08,0,1,0,c);box(g,1.2,.04,.1,0,1.98,0,D.lightwood);box(g,1.2,.04,.1,0,.02,0,D.lightwood);for(const x of [-.58,.58])box(g,.04,2,.1,x,1,0,D.lightwood);},
 tablepodcast(g,t,c,D){box(g,1.6,.035,.9,0,.722,0,D.walnut);box(g,1.4,.3,.6,0,.5,0,D.blackMatte);box(g,1.3,.35,.012,0,.18,0,D.laminate);box(g,1.5,.012,.012,0,.7,.44,D.led);
  for(const x of [-.45,.45]){cylinder(g,.04,.05,.05,x,.765,-.3,D.darkSteel,16);rod(g,[x,.79,-.3],[x,1.02,-.08],.012,D.darkSteel);rod(g,[x,1.02,-.08],[x,.98,.16],.01,D.darkSteel);cylinder(g,.03,.028,.16,x,.97,.22,D.blackMatte,16).rotation.x=-1.2;
   torus(g,.08,.012,x+.18,.8,.1,D.blackMatte,0,0,Math.PI);for(const s of [-1,1])cylinder(g,.035,.035,.03,x+.18+s*.08,.78,.1,D.leather,16).rotation.z=Math.PI/2;}},
 fond(g,t,c,D){for(const x of [-1.15,1.15]){cylinder(g,.022,.03,2.15,x,1.08,0,D.darkSteel,12);for(let i=0;i<3;i++){const a=i*Math.PI*2/3;rod(g,[x,.6,0],[x+Math.sin(a)*.25,0,Math.cos(a)*.25],.012,D.darkSteel);}}
  cylinder(g,.05,.05,2.25,0,2.12,0,D.satinWhite,20).rotation.z=Math.PI/2;box(g,2.2,1.85,.01,0,1.2,.02,D.cream);const sweep=new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,2.2,20,1,true,0,Math.PI/2),D.cream);sweep.rotation.set(0,0,Math.PI/2);sweep.position.set(0,.28,.3);sweep.scale.set(1,1,1);sweep.receiveShadow=true;g.add(sweep);box(g,2.2,.005,.3,0,.003,.45,D.cream);},
 stage(g,t,c,D){box(g,3,.34,2,0,.17,0,D.blackMatte);box(g,3,.06,2,0,.37,0,D.walnut);box(g,3,.012,.012,0,.33,1.0,D.led);box(g,1,.18,.35,0,.09,1.175,D.walnut);for(let x=-1.3;x<1.31;x+=.65)box(g,.02,.3,.01,x,.17,1.001,D.darkSteel);},
 gradin(g,t,c,D){for(let i=0;i<3;i++){const d=.6,y=.4+i*.4,z=.9-d/2-i*d;box(g,4,y,d,0,y/2,z,D.blackMatte);box(g,4,.04,d,0,y+.02,z,D.walnut);for(let x=-1.6;x<1.61;x+=.8)box(g,.7,.06,.4,x,y+.07,z+.05,c);}},
 regie(g,t,c,D){box(g,1.6,.86,.8,0,.43,0,D.darkSteel);for(const x of [-.79,.79])box(g,.02,.86,.8,x,.43,0,D.chrome);box(g,1.5,.04,.7,0,.88,0,D.blackMatte);for(let i=0;i<12;i++){box(g,.025,.012,.12,-.6+i*.06,.905,.1,D.chrome);box(g,.02,.012,.012,-.6+i*.06,.905,-.05,i%3?D.led:D.ledRed);}box(g,.5,.012,.25,.45,.905,-.15,D.daw);},
 piano(g,t,c,D){box(g,1.4,.14,.36,0,.75,-.07,D.lacquer);for(const x of [-.66,.66])box(g,.06,.7,.44,x,.35,-.03,D.lacquer);box(g,1.28,.6,.02,0,.38,-.2,D.lacquer);
  box(g,1.24,.02,.14,0,.8,.12,D.satinWhite);for(let i=0;i<36;i++)if(i%7!==2&&i%7!==6)box(g,.012,.02,.08,-.6+i*.034+.017,.815,.09,D.lacquer);box(g,.5,.2,.012,0,.92,-.2,D.lacquer).rotation.x=-.2;for(const x of [-.06,0,.06])box(g,.03,.012,.08,x,.06,.1,D.brass);},
 rack(g,t,c,D){for(const x of [-.97,.97])box(g,.05,1.8,.4,x,.9,0,D.walnut);for(let y=.04;y<1.8;y+=.43)box(g,1.9,.03,.38,0,y,0,D.walnut);box(g,1.9,1.76,.01,0,.9,-.195,D.laminate);
  let n=0;for(let y=.06;y<1.4;y+=.43){const bk=box(g,.9,.26,.22,(n%2?-.45:.4),y+.14,0,D.books);bk.material=D.books;n++;cylinder(g,.07,.06,.18,(n%2?.55:-.6),y+.1,0,D.ceramic,16);}},
 socle(g,t,c,D){box(g,.4,.96,.4,0,.48,0,D.satinWhite);box(g,.36,.03,.36,0,.015,0,D.blackMatte);box(g,.4,.04,.4,0,.98,0,D.satinWhite);},
 wc(g,t,c,D){// cabine PMR : cloisons stratifiées, porte, cuvette suspendue, barre d'appui, lave-mains d'angle
  box(g,.03,2.1,1.4,-.785,1.07,0,D.laminate);box(g,1.6,2.1,.03,0,1.07,-.685,D.laminate);box(g,.03,2.1,.6,.785,1.07,-.4,D.laminate);box(g,.9,1.9,.03,.3,1.0,.685,D.laminate);box(g,.04,.12,.04,-.1,1.0,.71,D.chrome);
  box(g,.4,.45,.2,-.35,.62,-.58,D.satinWhite);box(g,.18,.1,.01,-.35,.95,-.475,D.chrome);lathe(g,[[.0,0],[.17,.02],[.19,.14],[.18,.2],[0,.2]],-.35,.34,-.38,D.ceramic).scale.set(1,1,1.35);box(g,.38,.02,.46,-.35,.55,-.37,D.ceramic);
  rod(g,[-.76,.8,-.55],[-.76,.8,.2],.018,D.chrome);rod(g,[-.1,.8,-.66],[.45,.8,-.66],.018,D.chrome);cylinder(g,.06,.06,.12,-.72,.75,.3,D.chrome,16).rotation.z=Math.PI/2;},
 lavabo(g,t,c,D){box(g,.6,.12,.46,0,.73,.02,D.ceramic);lathe(g,[[0,0],[.2,.01],[.22,.1],[.2,.11],[0,.02]],0,.69,.04,D.satinWhite).scale.set(1,.8,.75);box(g,.6,.5,.04,0,.45,-.21,D.laminate);
  cylinder(g,.018,.022,.14,0,.84,-.14,D.chrome,12);rod(g,[0,.9,-.14],[0,.88,-.02],.012,D.chrome);box(g,.08,.02,.02,0,.92,-.16,D.chrome);},
 luminaire(g,t,c,D){lathe(g,[[.02,.45],[.03,.4],[.12,.3],[.19,.14],[.2,.1],[.19,.1],[.11,.29],[.02,.39]],0,0,0,D.darkSteel,40);lathe(g,[[.0,.12],[.17,.12],[.19,.105],[0,.105]],0,0,0,D.brass,40);sphere(g,.055,0,.17,0,D.bulb);cylinder(g,.035,.035,.04,0,.43,0,D.brass,16);},
 plant(g,t,c,D){lathe(g,[[0,0],[.18,0],[.22,.38],[.21,.4],[0,.4]],0,0,0,D.ceramic,32);cylinder(g,.2,.2,.02,0,.37,0,tint(0x3e3021,1),24);
  for(let i=0;i<5;i++){const a=i*1.3;rod(g,[0,.38,0],[Math.sin(a)*.12,.75+i*.12,Math.cos(a)*.12],.012,D.walnut);}for(let i=0;i<22;i++){const a=i*2.39,h=.6+(i%11)*.08,o=sphere(g,.13,Math.sin(a)*.17,h,Math.cos(a)*.17,D.leaf,.45,1.6,.12);o.rotation.set(.6*Math.cos(a),a,.5*Math.sin(a));}},
 // --- objets complémentaires ---
 ordinateur(g,t,c,D){box(g,.62,.36,.025,0,.26,.02,D.darkSteel);box(g,.6,.34,.005,0,.26,.034,D.office);box(g,.06,.2,.03,0,.1,-.03,D.steel);box(g,.24,.012,.18,0,.006,-.01,D.steel);},
 portable(g,t,c,D){box(g,.34,.015,.24,0,.0075,0,D.steel);const lid=new THREE.Group();lid.position.set(0,.015,-.115);lid.rotation.x=-.3;box(lid,.34,.22,.008,0,.11,0,D.steel);box(lid,.32,.2,.002,0,.11,.005,D.office);g.add(lid);box(g,.3,.002,.12,0,.016,.03,D.blackMatte);},
 lampebureau(g,t,c,D){cylinder(g,.08,.09,.02,0,.01,.05,D.darkSteel,24);rod(g,[0,.02,.05],[0,.3,-.05],.008,D.darkSteel);rod(g,[0,.3,-.05],[0,.36,.08],.008,D.darkSteel);lathe(g,[[.0,.0],[.07,0],[.05,.07],[.015,.09]],0,.32,.1,D.darkSteel,24).rotation.x=Math.PI;sphere(g,.025,0,.3,.1,D.bulb);},
 rayonnage(g,t,c,D){for(const x of [-.58,.58])for(const z of [-.23,.23])box(g,.035,2,.035,x,1,z,D.darkSteel);for(let y=.1;y<2;y+=.46){box(g,1.2,.025,.5,0,y,0,D.steel);if(y<1.6){box(g,.4,.28,.36,-.35,y+.155,0,tint(0xb58a5a,.9));box(g,.36,.24,.34,.15,y+.135,0,tint(0xc39a67,.9));}}},
 clavier(g,t,c,D){box(g,.82,.06,.26,0,.03,0,D.blackMatte);box(g,.66,.02,.13,.06,.065,.05,D.satinWhite);for(let i=0;i<34;i++)if(i%7!==2&&i%7!==6)box(g,.009,.018,.075,-.26+i*.0194+.009,.083,.02,D.lacquer);for(let i=0;i<8;i++)cylinder(g,.012,.012,.02,-.36+i*.045,.07,-.08,D.chrome,10);for(let i=0;i<4;i++)box(g,.03,.012,.03,-.34+i*.04,.066,.06,i%2?D.led:D.ledBlue);},
 rack19(g,t,c,D){box(g,.56,1,.6,0,.5,0,D.blackMatte);for(let u=0;u<8;u++){box(g,.48,.09,.012,0,.1+u*.105,.301,u%3?D.darkSteel:D.steel);for(let k=0;k<5;k++)cylinder(g,.008,.008,.012,-.18+k*.08,.1+u*.105,.31,D.chrome,8).rotation.x=Math.PI/2;box(g,.012,.012,.005,.2,.1+u*.105,.31,u%2?D.ledBlue:D.led);}for(const x of [-.2,.2])for(const z of [-.2,.2])sphere(g,.02,x,.02,z,D.rubber);},
 guitare(g,t,c,D){for(let i=0;i<3;i++){const a=i*Math.PI*2/3;rod(g,[0,.3,0],[Math.sin(a)*.17,0,Math.cos(a)*.15],.008,D.darkSteel);}rod(g,[0,.3,-.02],[0,.9,-.06],.01,D.darkSteel);
  const body=new THREE.Group();body.position.set(0,.3,.04);body.rotation.x=-.12;g.add(body);sphere(body,.18,0,.14,0,c,1,.95,.25);sphere(body,.14,0,.36,0,c,.9,.9,.25);cylinder(body,.045,.045,.01,0,.28,.045,D.blackMatte,20).rotation.x=Math.PI/2;box(body,.05,.45,.025,0,.66,.01,D.walnut);box(body,.08,.13,.02,0,.94,.01,D.walnut);for(let k=0;k<6;k++)rod(body,[-.012+k*.005,.12,.05],[-.012+k*.005,.9,.03],.0012,D.chrome,4);},
 basstrap(g,t,c,D){const shape=new THREE.Shape([new THREE.Vector2(-.3,-.3),new THREE.Vector2(.3,-.3),new THREE.Vector2(-.3,.3)]);const o=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:2,bevelEnabled:false}),c);o.rotation.x=-Math.PI/2;o.castShadow=o.receiveShadow=true;g.add(o);box(g,.6,.03,.03,0,1.99,-.29,D.lightwood);},
 diffuseur(g,t,c,D){box(g,.6,.6,.02,0,.3,-.05,D.walnut);for(let i=0;i<7;i++)for(let j=0;j<7;j++){const h=[.02,.06,.1,.04,.08,.03,.09][(i*3+j*5)%7];box(g,.078,.078,h,-.255+i*.085,.045+j*.085,-.04+h/2,D.lightwood);}},
 tv(g,t,c,D){box(g,1.25,.72,.035,0,.44,.03,D.blackMatte);box(g,1.22,.69,.004,0,.44,.05,D.tv);box(g,.35,.02,.22,0,.01,0,D.darkSteel);box(g,.06,.1,.04,0,.06,.0,D.darkSteel);},
 meubletv(g,t,c,D){box(g,1.8,.4,.45,0,.28,0,D.walnut);for(const x of [-.45,.45])box(g,.88,.36,.012,x,.28,.226,D.lightwood);box(g,.012,.36,.012,0,.28,.23,D.brass);for(const x of [-.8,.8])for(const z of [-.18,.18])cylinder(g,.018,.012,.08,x,.04,z,D.brass,10);},
 miroir(g,t,c,D){box(g,.6,.9,.02,0,.45,0,D.brass);box(g,.56,.86,.004,0,.45,.012,D.mirror);},
 miroirloge(g,t,c,D){box(g,1,.8,.04,0,.4,0,D.blackMatte);box(g,.8,.6,.004,0,.4,.022,D.mirror);for(let i=0;i<5;i++){sphere(g,.028,-.4+i*.2,.76,.03,D.bulb);sphere(g,.028,-.4+i*.2,.04,.03,D.bulb);}for(let j=1;j<4;j++){sphere(g,.028,-.46,.04+j*.18,.03,D.bulb);sphere(g,.028,.46,.04+j*.18,.03,D.bulb);}},
 portant(g,t,c,D){for(const x of [-.58,.58]){rod(g,[x,0,-.22],[x,0,.22],.012,D.chrome);rod(g,[x,0,0],[x,1.58,0],.014,D.chrome);}rod(g,[-.58,1.56,0],[.58,1.56,0],.012,D.chrome);
  const tones=[0x2f3b4f,0x8c3b2f,0xd9cbb2,0x1f1f1f,0x4f6b5a,0xc9a24a];for(let i=0;i<8;i++){const x=-.45+i*.13;torus(g,.025,.003,x,1.55,0,D.chrome,0,Math.PI/2,Math.PI);rod(g,[x-.18,1.45,0],[x,1.53,0],.004,D.chrome,4);rod(g,[x+.18,1.45,0],[x,1.53,0],.004,D.chrome,4);box(g,.05,.8+((i*37)%30)/100,.4,x,1.45-(.8+((i*37)%30)/100)/2,0,tint(tones[i%6],.9));}},
 urinoir(g,t,c,D){lathe(g,[[0,0],[.15,.02],[.18,.3],[.17,.55],[.12,.62],[0,.62]],0,0,.02,D.ceramic,28).scale.set(1,1,.9);box(g,.36,.55,.02,0,.33,-.155,D.ceramic);cylinder(g,.015,.015,.1,0,.66,-.12,D.chrome,10);},
 banquette(g,t,c,D){box(g,2,.4,.55,0,.2,.02,D.walnut);box(g,1.96,.12,.52,0,.46,.03,c);for(let i=0;i<4;i++)box(g,.47,.44,.1,-.735+i*.49,.72,-.23,c).rotation.x=-.1;box(g,2,.02,.02,0,.02,.3,D.led);},
 moulin(g,t,c,D){box(g,.18,.26,.26,0,.13,-.02,D.darkSteel);cylinder(g,.07,.04,.2,0,.37,-.02,D.glass,20);cylinder(g,.072,.072,.02,0,.48,-.02,D.blackMatte,20);cylinder(g,.035,.035,.08,0,.1,.12,D.chrome,12).rotation.x=Math.PI/2;box(g,.18,.02,.1,0,.01,.1,D.darkSteel);},
 etagere(g,t,c,D){box(g,.9,.03,.25,0,.015,0,D.walnut);for(const x of [-.35,.35])box(g,.02,.12,.2,x,-.0,-.02,D.darkSteel);for(let i=0;i<5;i++)cylinder(g,.035,.03,.1+(i%2)*.06,-.3+i*.15,.08+(i%2)*.03,0,i%2?D.ceramic:D.glass,14);box(g,.2,.26,.12,.3,.16,-.03,D.books).material=D.books;},
 cuisine(g,t,c,D){box(g,2,.8,.6,0,.44,-.02,D.satinWhite);for(let i=0;i<4;i++){box(g,.49,.72,.018,-.75+i*.5,.46,.285,D.laminate);box(g,.012,.24,.02,-.75+i*.5+.2,.62,.3,D.chrome);}box(g,2,.08,.55,0,.04,-.04,D.blackMatte);
  box(g,2,.04,.65,0,.88,0,D.steel);box(g,.55,.02,.42,-.45,.875,0,D.darkSteel);cylinder(g,.02,.02,.3,-.45,1.05,-.25,D.chrome,12);rod(g,[-.45,1.2,-.25],[-.45,1.16,-.08],.014,D.chrome);box(g,.5,.012,.36,.45,.905,0,D.lightwood);},
 four(g,t,c,D){box(g,.86,.72,.76,0,1.2,0,D.steel);box(g,.6,.56,.02,-.08,1.2,.385,D.glass);box(g,.02,.56,.04,.26,1.2,.4,D.chrome);box(g,.14,.5,.02,.33,1.2,.385,D.blackMatte);for(let i=0;i<3;i++)cylinder(g,.025,.025,.02,.33,1.35-i*.1,.4,D.chrome,12).rotation.x=Math.PI/2;
  for(const x of [-.4,.4])for(const z of [-.34,.34])box(g,.04,.84,.04,x,.42,z,D.steel);for(const y of [.2,.55])box(g,.84,.02,.72,0,y,0,D.steel);},
 tableatelier(g,t,c,D){box(g,1.8,.05,.8,0,.875,0,D.lightwood);for(const x of [-.82,.82])for(const z of [-.33,.33])box(g,.06,.85,.06,x,.425,z,D.darkSteel);box(g,1.7,.03,.7,0,.2,0,D.lightwood);box(g,1.7,.05,.04,0,.8,.36,D.darkSteel);
  box(g,.4,.04,.3,-.5,.92,0,D.paper);cylinder(g,.04,.04,.1,.5,.95,-.1,D.ceramic,14);},
 spot(g,t,c,D){for(let i=0;i<3;i++){const a=i*Math.PI*2/3;rod(g,[0,.7,0],[Math.sin(a)*.24,0,Math.cos(a)*.24],.012,D.darkSteel);}cylinder(g,.018,.018,1.6,0,1.35,0,D.darkSteel,10);rod(g,[-.14,2.05,0],[.14,2.05,0],.012,D.darkSteel);
  const head=new THREE.Group();head.position.set(0,2.05,0);head.rotation.x=.45;g.add(head);cylinder(head,.1,.12,.3,0,0,0,D.blackMatte,20).rotation.x=Math.PI/2;cylinder(head,.1,.1,.01,0,0,.155,D.bulb,20).rotation.x=Math.PI/2;},
 toilette(g,t,c,D){box(g,.4,.82,.14,0,.41,-.23,D.satinWhite);box(g,.2,.14,.01,0,.66,-.155,D.chrome);lathe(g,[[0,0],[.15,.01],[.18,.1],[.17,.16],[0,.16]],0,.26,.04,D.ceramic,28).scale.set(1,1,1.5);box(g,.36,.03,.5,0,.435,.03,D.ceramic);box(g,.34,.02,.44,0,.46,.02,D.satinWhite);},
 videoproj(g,t,c,D){cylinder(g,.02,.02,.3,0,.35,0,D.darkSteel,10);box(g,.2,.02,.2,0,.49,0,D.darkSteel);box(g,.42,.13,.36,0,.12,0,D.satinWhite);cylinder(g,.05,.05,.03,.1,.12,.18,D.blackMatte,20).rotation.x=Math.PI/2;cylinder(g,.035,.035,.005,.1,.12,.196,D.glass,20).rotation.x=Math.PI/2;box(g,.3,.01,.2,0,.05,0,D.darkSteel);},
 // --- catalogue étendu : versions plus détaillées ---
 tabouret(g,t,c,D){cylinder(g,.18,.17,.06,0,.72,0,c,32);cylinder(g,.185,.185,.012,0,.69,0,D.walnut,32);for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4;rod(g,[Math.sin(a)*.12,.69,Math.cos(a)*.12],[Math.sin(a)*.19,0,Math.cos(a)*.19],.014,D.walnut);}torus(g,.15,.009,0,.28,0,D.brass,Math.PI/2);},
 fauteuil(g,t,c,D){box(g,.76,.2,.72,0,.24,.02,c);box(g,.76,.46,.16,0,.56,-.32,c).rotation.x=-.12;for(const x of [-.34,.34])box(g,.1,.3,.7,x,.42,0,c);box(g,.56,.12,.54,0,.4,.07,c);for(const x of [-.3,.3])for(const z of [-.28,.28])cylinder(g,.02,.013,.14,x,.07,z,D.walnut,10);},
 tablebasse(g,t,c,D){box(g,1.1,.035,.6,0,.38,0,D.walnut);box(g,1.0,.02,.5,0,.13,0,D.lightwood);for(const x of [-.5,.5])for(const z of [-.25,.25])cylinder(g,.018,.014,.36,x,.18,z,D.brass,10);box(g,.3,.05,.22,-.2,.42,0,D.books).material=D.books;},
 mangedebout(g,t,c,D){cylinder(g,.35,.35,.035,0,1.083,0,D.marble,48);cylinder(g,.03,.03,1.04,0,.54,0,D.darkSteel,12);lathe(g,[[0,0],[.26,0],[.24,.03],[.05,.06],[0,.06]],0,0,0,D.darkSteel,32);torus(g,.2,.01,0,.3,0,D.brass,Math.PI/2);},
 caisse(g,t,c,D){box(g,.2,.04,.2,0,.02,0,D.darkSteel);rod(g,[0,.04,0],[0,.16,-.03],.015,D.darkSteel);const s=box(g,.3,.2,.02,0,.2,-.02,D.blackMatte);s.rotation.x=-.35;const sc=box(g,.28,.18,.004,0,.2,-.008,D.office);sc.rotation.x=-.35;box(g,.08,.03,.14,.14,.015,.1,D.darkSteel);},
 console(g,t,c,D){box(g,1.1,.06,.6,0,.03,0,D.darkSteel);const deck=new THREE.Group();deck.position.set(0,.06,0);deck.rotation.x=.1;g.add(deck);box(deck,1.06,.05,.56,0,.025,0,D.blackMatte);
  for(let i=0;i<16;i++){const x=-.48+i*.064;box(deck,.012,.004,.18,x,.052,.12,D.darkSteel);box(deck,.022,.014,.012,x,.06,.12+((i*29)%12)/100-.05,D.satinWhite);for(let k=0;k<4;k++)cylinder(deck,.009,.009,.014,x,.058,-.05-k*.045,k===0?D.ledRed:D.darkSteel,10);box(deck,.01,.004,.03,x,.055,-.24,i%5?D.led:D.ledBlue);}
  box(g,1.06,.1,.08,0,.12,-.26,D.darkSteel);box(g,.3,.06,.005,.3,.13,-.219,D.daw);},
 ecranmural(g,t,c,D){box(g,1.45,.85,.04,0,.425,0,D.blackMatte);box(g,1.41,.81,.004,0,.425,.022,D.tv);},
 enceinte(g,t,c,D){box(g,.36,.58,.32,0,1.57,0,D.blackMatte);speakerCone(g,.12,0,1.5,.161,D);cylinder(g,.05,.03,.04,0,1.76,.15,D.darkSteel,16).rotation.x=Math.PI/2;cylinder(g,.02,.02,1.3,0,.65,0,D.darkSteel,10);cylinder(g,.028,.028,.3,0,1.2,0,D.darkSteel,10);for(let i=0;i<3;i++){const a=i*Math.PI*2/3;rod(g,[0,.45,0],[Math.sin(a)*.22,0,Math.cos(a)*.22],.012,D.darkSteel);}}
};

// Construit la version détaillée d'un type, ou renvoie false pour laisser l'éditeur utiliser son modèle d'origine.
function buildDetailedFurniture(f,g,t,cloth){const build=DETAIL_BUILDERS[f.type];if(!build)return false;build(g,t,cloth,dm());return true;}
