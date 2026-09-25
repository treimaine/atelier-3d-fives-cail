'use strict';
// Catalogue étendu : mobilier d'exploitation par pôle et silhouettes d'échelle.
// Gabarits d'étude, à confirmer sur consultation fournisseur comme le reste du catalogue.
// Les formes sont construites à leurs cotes de catalogue ; furnitureModel les recale ensuite
// sur les dimensions de l'objet.
Object.assign(FURN_TYPES,{
 tabouret:{n:'Tabouret haut',w:.4,d:.4,h:.75,c:0x3a3f3c,shape:'cyl',cat:'cafe'},
 mangedebout:{n:'Mange-debout',w:.7,d:.7,h:1.1,c:0xc9a36a,shape:'cyl',cat:'cafe'},
 fauteuil:{n:'Fauteuil lounge',w:.8,d:.8,h:.8,c:0xb4704f,cat:'cafe'},
 tablebasse:{n:'Table basse',w:1.1,d:.6,h:.4,c:0xc9a36a,cat:'cafe'},
 caisse:{n:'Caisse enregistreuse',w:.4,d:.35,h:.3,c:0x2f3a3d,cat:'cafe',mount:'support'},
 ardoise:{n:'Menu ardoise',w:1.2,d:.05,h:.8,c:0x2a302d,cat:'cafe',mount:'mur',y:1.4},
 tableau:{n:'Œuvre encadrée',w:1.2,d:.05,h:.9,c:0xc2553f,cat:'galerie',mount:'mur',y:1.1},
 grandtableau:{n:'Grand format',w:2,d:.05,h:1.4,c:0x3f6fa0,cat:'galerie',mount:'mur',y:.8},
 banc:{n:'Banc de galerie',w:1.6,d:.45,h:.45,c:0x6b5a48,cat:'galerie'},
 sculpture:{n:'Sculpture sur socle',w:.5,d:.5,h:1.6,c:0xc9b27a,cat:'galerie',bespoke:true},
 enceinte:{n:'Enceinte sur pied',w:.45,d:.45,h:1.9,c:0x1f2427,cat:'evenement'},
 djbooth:{n:'Cabine DJ',w:1.8,d:.8,h:1.05,c:0x2b2530,cat:'evenement',bespoke:true},
 micro:{n:'Pied de micro',w:.5,d:.5,h:1.6,c:0x1f2427,cat:'evenement'},
 ecran:{n:'Écran de projection',w:3,d:.25,h:2.6,c:0xf2f0ea,cat:'evenement'},
 console:{n:'Console de mixage',w:1.1,d:.6,h:.2,c:0x25292b,cat:'audio',mount:'support'},
 batterie:{n:'Batterie',w:1.8,d:1.5,h:1.2,c:0x8e2f35,cat:'audio'},
 ampli:{n:'Ampli guitare',w:.6,d:.3,h:.55,c:0x2a2a28,cat:'audio'},
 chaisebureau:{n:'Fauteuil de bureau',w:.6,d:.6,h:1.05,c:0x3d4652,cat:'bureau'},
 reunion:{n:'Table de réunion',w:2.4,d:1.1,h:.75,c:0xc9a36a,cat:'bureau'},
 accueil:{n:'Banque d’accueil',w:2,d:.7,h:1.1,c:0x9c7b54,cat:'bureau',bespoke:true},
 ecranmural:{n:'Écran mural',w:1.45,d:.08,h:.85,c:0x15191b,cat:'bureau',mount:'mur',y:1.1},
 tapis:{n:'Tapis',w:2.4,d:1.7,h:.02,c:0x8c6a58,cat:'commun'},
 lampadaire:{n:'Lampadaire',w:.45,d:.45,h:1.7,c:0xf0d9a8,cat:'commun',light:true,lightAt:.88},
 personne:{n:'Silhouette (échelle)',w:.5,d:.3,h:1.75,c:0x6f7f8f,cat:'commun'}
});

// Toile abstraite déterministe : la même œuvre revient à chaque reconstruction de la scène.
function artworkTexture(seedText,base){let seed=7;for(const ch of String(seedText||'oeuvre'))seed=(seed*31+ch.charCodeAt(0))%2147483647;
 const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
 const c=document.createElement('canvas');c.width=256;c.height=192;const ctx=c.getContext?.('2d');if(typeof ctx?.arc!=='function')return null;
 const palette=['#'+base.toString(16).padStart(6,'0'),'#e9dfc9','#2d3a3a','#d9a441','#7a9e9f','#b8563f','#f3efe6'];
 ctx.fillStyle=palette[1];ctx.fillRect(0,0,256,192);
 for(let i=0;i<9;i++){ctx.fillStyle=palette[Math.floor(rnd()*palette.length)];ctx.globalAlpha=.55+rnd()*.45;
  if(rnd()>.5){ctx.beginPath();ctx.arc(rnd()*256,rnd()*192,15+rnd()*60,0,Math.PI*2);ctx.fill();}
  else ctx.fillRect(rnd()*220,rnd()*160,30+rnd()*120,10+rnd()*80);}
 ctx.globalAlpha=1;const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}

// Constructeurs des types ajoutés. g : groupe de l'objet ; cloth : matière teintée de l'objet.
function buildExtraFurniture(f,g,t,cloth,legs){
 switch(f.type){
 case 'tabouret':cylinder(g,.19,.19,.06,0,.72,0,cloth,32);cylinder(g,.025,.03,.66,0,.36,0,mats.metal,12);cylinder(g,.17,.17,.015,0,.28,0,mats.metal,24);cylinder(g,.2,.22,.02,0,.01,0,mats.metal,32);break;
 case 'mangedebout':cylinder(g,.35,.35,.04,0,1.08,0,mats.wood,48);cylinder(g,.04,.05,1.04,0,.54,0,mats.metal,12);cylinder(g,.25,.28,.03,0,.015,0,mats.metal,32);break;
 case 'fauteuil':box(g,.7,.16,.66,0,.3,.05,cloth);box(g,.8,.5,.14,0,.55,-.33,cloth);for(const x of [-.36,.36])box(g,.1,.32,.72,x,.46,0,cloth);box(g,.6,.12,.56,0,.43,.07,cloth);for(const x of [-.32,.32])for(const z of [-.3,.3])cylinder(g,.018,.012,.22,x,.11,z,mats.wood,8);break;
 case 'tablebasse':box(g,1.1,.04,.6,0,.38,0,mats.wood);box(g,1,.02,.5,0,.12,0,mats.wood);legs(1.1,.6,.36,.36);break;
 case 'caisse':box(g,.4,.06,.35,0,.03,0,mats.black);box(g,.3,.2,.02,0,.2,-.04,mats.black).rotation.x=-.35;box(g,.26,.16,.005,0,.2,-.028,mats.glass).rotation.x=-.35;box(g,.14,.04,.12,.08,.08,.1,mats.metal);break;
 case 'ardoise':{box(g,1.2,.8,.03,0,.4,0,mats.wood);const m=new THREE.MeshStandardMaterial({color:0x252b28,roughness:.95});box(g,1.1,.7,.01,0,.4,.02,m);for(let i=0;i<5;i++)box(g,.35+((i*37)%30)/100,.025,.005,-.2,.64-i*.11,.026,mats.white);break;}
 case 'tableau':case 'grandtableau':{const map=artworkTexture(f.id||f.n,t.c),art=new THREE.MeshStandardMaterial(map?{map,roughness:.8}:{color:t.c,roughness:.8});
  box(g,t.w,t.h,.04,0,t.h/2,0,mats.black);const canvasArt=box(g,t.w-.08,t.h-.08,.005,0,t.h/2,.023,art);canvasArt.castShadow=false;break;}
 case 'banc':box(g,1.6,.06,.45,0,.42,0,mats.wood);for(const x of [-.7,.7])box(g,.06,.39,.4,x,.2,0,mats.metal);break;
 case 'sculpture':{box(g,.5,1,.5,0,.5,0,mats.white);const m=new THREE.MeshStandardMaterial({color:t.c,metalness:.85,roughness:.28});
  const k=new THREE.Mesh(new THREE.TorusKnotGeometry(.14,.045,96,12),m);k.position.set(0,1.3,0);k.castShadow=true;g.add(k);break;}
 case 'enceinte':box(g,.34,.55,.3,0,1.6,0,cloth);cylinder(g,.1,.1,.02,0,1.52,.155,mats.metal,24).rotation.x=Math.PI/2;cylinder(g,.04,.04,.02,0,1.76,.155,mats.metal,16).rotation.x=Math.PI/2;cylinder(g,.02,.02,1.35,0,.68,0,mats.metal,10);
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3,leg=box(g,.02,.02,.45,Math.sin(a)*.1,.12,Math.cos(a)*.1,mats.metal);leg.rotation.set(-.5*Math.cos(a),a,0);}break;
 case 'djbooth':box(g,1.8,1,.7,0,.5,0,cloth);box(g,1.8,.05,.8,0,1.025,0,mats.black);for(const x of [-.5,.5])cylinder(g,.15,.15,.04,x,1.07,0,mats.metal,32);box(g,.4,.05,.3,0,1.075,0,mats.metal);box(g,1.6,.06,.02,0,.7,.36,mats.light);break;
 case 'micro':cylinder(g,.012,.012,1.45,0,.75,0,mats.metal,8);cylinder(g,.2,.22,.02,0,.01,0,mats.black,24);box(g,.012,.012,.45,0,1.45,.16,mats.metal).rotation.x=-.3;cylinder(g,.025,.02,.14,0,1.52,.36,mats.black,12).rotation.x=-1.2;break;
 case 'ecran':box(g,3,.08,.08,0,2.55,0,mats.black);box(g,2.9,1.7,.01,0,1.65,.02,mats.white);for(const x of [-1.45,1.45]){cylinder(g,.02,.02,2.55,x,1.28,0,mats.metal,8);box(g,.5,.03,.25,x,.015,0,mats.metal);}break;
 case 'console':{box(g,1.1,.08,.6,0,.04,0,mats.black);const deck=box(g,1.06,.1,.5,0,.12,-.02,mats.metal);deck.rotation.x=.12;for(let i=0;i<16;i++)box(g,.02,.02,.08,-.48+i*.064,.18,.08,i%4?mats.black:mats.light);break;}
 case 'batterie':{cylinder(g,.28,.28,.4,0,.3,-.3,cloth,32).rotation.x=Math.PI/2;for(const [x,z,r,h] of [[-.45,.1,.18,.3],[.45,.1,.2,.38],[-.2,-.35,.14,.2],[.2,-.35,.15,.22]]){cylinder(g,r,r,.2,x,h+.35,z,cloth,24);cylinder(g,.012,.012,h+.25,x,(h+.25)/2,z,mats.metal,6);}
  for(const [x,z,y] of [[-.75,-.25,1.1],[.75,-.3,1.15],[-.7,.35,.9]]){cylinder(g,.012,.012,y,x,y/2,z,mats.metal,6);cylinder(g,.22,.2,.01,x,y,z,mats.light,24);}cylinder(g,.2,.2,.06,0,.5,.45,mats.black,20);break;}
 case 'ampli':box(g,.6,.55,.3,0,.275,0,cloth);box(g,.52,.36,.01,0,.22,.151,mats.metal);box(g,.56,.08,.01,0,.47,.151,mats.cream);break;
 case 'chaisebureau':box(g,.5,.08,.48,0,.47,.02,cloth);box(g,.46,.55,.06,0,.8,-.24,cloth).rotation.x=-.08;cylinder(g,.025,.025,.36,0,.26,0,mats.metal,10);
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5,arm=box(g,.03,.03,.3,Math.sin(a)*.14,.05,Math.cos(a)*.14,mats.black);arm.rotation.y=a;cylinder(g,.025,.025,.04,Math.sin(a)*.28,.02,Math.cos(a)*.28,mats.black,8);}
  for(const x of [-.26,.26])box(g,.04,.2,.3,x,.6,0,mats.black);break;
 case 'reunion':box(g,2.4,.05,1.1,0,.725,0,mats.wood);for(const x of [-.8,.8])box(g,.08,.7,.8,x,.35,0,mats.metal);box(g,.3,.02,.12,0,.76,0,mats.black);break;
 case 'accueil':box(g,2,1.05,.1,0,.525,.3,mats.wood);box(g,2,.05,.7,0,.75,0,mats.white);box(g,2.1,.04,.3,0,1.08,.25,mats.wood);for(const x of [-.95,.95])box(g,.1,1.05,.7,x,.525,0,mats.wood);box(g,1.9,.04,.04,0,.05,.36,mats.light);break;
 case 'ecranmural':{box(g,1.45,.85,.05,0,.425,0,mats.black);const m=new THREE.MeshStandardMaterial({color:0x2d4a63,emissive:0x1d3a55,emissiveIntensity:.8,roughness:.3});box(g,1.39,.79,.005,0,.425,.027,m);break;}
 case 'tapis':{const m=new THREE.MeshStandardMaterial({color:t.c,roughness:1});box(g,2.4,.015,1.7,0,.0075,0,m).castShadow=false;const b=new THREE.MeshStandardMaterial({color:0xe6dccb,roughness:1});box(g,2.2,.016,.05,0,.008,-.7,b).castShadow=false;box(g,2.2,.016,.05,0,.008,.7,b).castShadow=false;break;}
 case 'lampadaire':cylinder(g,.16,.18,.03,0,.015,0,mats.metal,24);cylinder(g,.015,.015,1.5,0,.77,0,mats.metal,8);cylinder(g,.13,.22,.28,0,1.56,0,mats.cream,24);cylinder(g,.06,.06,.05,0,1.46,0,mats.light,12);break;
 case 'personne':{const skin=new THREE.MeshStandardMaterial({color:0xd8cfc4,roughness:.9});
  cylinder(g,.07,.06,.82,-.09,.41,0,mats.black,10);cylinder(g,.07,.06,.82,.09,.41,0,mats.black,10);
  cylinder(g,.2,.16,.62,0,1.13,0,cloth,16).scale.z=.62;sphere(g,.2,0,1.44,0,cloth,1,.45,.62);
  for(const x of [-.25,.25]){const arm=cylinder(g,.045,.04,.6,x,1.12,0,cloth,8);arm.rotation.z=x>0?.08:-.08;}
  sphere(g,.105,0,1.64,0,skin,1,1.15,1);break;}
 }
}
