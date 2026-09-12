'use strict';
const H=3.4,CX=10.5,CZ=12.5;
const DW=(x1,z1,x2,z2,mat,t,op)=>({x1,z1,x2,z2,mat:mat||'plein',t:t??.22,h:H,op:op||[]});
const DEFAULT_STATE={
 meta:{name:'Zonage étude v1'},
 zones:[
  {n:'Salon de thé + comptoir',c:'#e8a33d',x:15,z:0,w:6,d:15,t:'Pôle 3 — ~40 places, façade vitrée. Sol fini, plomberie comptoir, élec renforcée, CVC, extraction.'},
  {n:"Galerie d'art",c:'#d96b6b',x:15,z:15,w:6,d:6.7,t:'Pôle 3 — cimaises, éclairage rails. Doublage murs, élec.'},
  {n:'Office / cuisine',c:'#b0855b',x:15,z:21.7,w:6,d:3.3,t:'Pôle 3 — contre accès livraisons. Plomberie complète, extraction, normes ERP.'},
  {n:'Espace événementiel',c:'#9b7bd8',x:9.5,z:4,w:5.5,d:7.6,t:'Pôles 2&3 — cloison amovible vers le café. Acoustique, élec scénique.'},
  {n:'Studio audio',c:'#4f9d69',x:0,z:0,w:6.5,d:7,t:'Pôle 2 — boîte-dans-la-boîte, double cloison désolidarisée, sas, VMC silencieuse.'},
  {n:'Studio podcast & vidéo',c:'#57b8b0',x:0,z:7,w:6.5,d:4.6,t:'Pôle 2 — fond neutre, éclairage réglable, traitement acoustique.'},
  {n:'Publishing + salle artistes',c:'#5b8dd9',x:0,z:11.6,w:15,d:2.4,t:'Pôle 1 — bureaux, accueil artistes. Cloisons sèches, réseau, faux plafond.'},
  {n:'Sanitaires + circulations',c:'#8a8f99',x:6.5,z:4,w:3,d:7.6,t:'Commun — plomberie mutualisée, WC PMR (ERP).'}
 ],
 walls:[
  // Enveloppe (modifiable aussi)
  DW(0,0,15,0),                       // nord plateau
  DW(0,0,0,14,'plein',.22,[{d:11,type:'porte',w:1.4,h:2.2,sill:0}]),   // ouest (issue secours)
  DW(0,14,15,14),                     // sud plateau
  DW(15,14,15,25),                    // ouest aile
  DW(15,0,21,0),                      // nord aile
  DW(21,0,21,25,'vitre',.12,[{d:4,type:'double',w:1.8,h:2.4,sill:0}]), // façade Est vitrée + accès principal
  DW(15,25,21,25,'plein',.22,[{d:3,type:'double',w:1.8,h:2.4,sill:0}]),// sud aile + livraisons
  // Cloisons intérieures proposées
  DW(6.5,0,6.5,11.6,'cloison',.15,[{d:5.5,type:'porte',w:.93,h:2.1,sill:0},{d:9,type:'porte',w:.93,h:2.1,sill:0}]),
  DW(0,7,6.5,7,'cloison',.15),
  DW(0,11.6,15,11.6,'cloison',.15,[{d:3,type:'porte',w:.93,h:2.1,sill:0},{d:12,type:'porte',w:.93,h:2.1,sill:0}]),
  DW(9.5,4,9.5,14,'cloison',.15,[{d:5,type:'double',w:1.8,h:2.1,sill:0}]),
  DW(6.5,4,9.5,4,'cloison',.15),
  DW(15,0,15,14,'cloison',.15,[{d:7,type:'double',w:1.8,h:2.1,sill:0}])
 ],
 furniture:[]
};
// Colonnes porteuses — NON modifiables
// Le poteau de l'angle rentrant est ramené de 22,5 cm vers le nord : centré sur (15 ; 14) sa
// section de 45 cm mordait la découpe du L. Position à confirmer au relevé.
const COLUMNS=[[5,4],[10,4],[5,9],[10,9],[15,5],[15,10],[18,8],[18,13],[18,18],[18,22],[15,13.77]];
const OPEN_TYPES={
 porte:{n:'Porte',w:.93,h:2.1,sill:0},
 double:{n:'Double porte',w:1.8,h:2.4,sill:0},
 fenetre:{n:'Fenêtre',w:1.2,h:1.2,sill:1},
 baie:{n:'Baie vitrée',w:2.5,h:2.4,sill:0}
};
const FURN_CATEGORIES={cafe:'Salon de thé & comptoir',galerie:'Galerie & exposition',evenement:'Événementiel & scène',audio:'Studio audio & podcast',bureau:'Bureaux & publishing',sanitaire:'Sanitaires & services',commun:'Commun'};
// Gabarits d'étude : encombrements courants du métier, à confirmer sur consultation fournisseur.
// mount : sol par défaut ; mur = à fixer, y par défaut ; support = destiné à un plateau.
const FURN_TYPES={
 table:{n:'Table ronde',w:.9,d:.9,h:.75,c:0xc9a36a,shape:'cyl',cat:'cafe'},
 table2:{n:'Table 4p',w:1.2,d:.8,h:.75,c:0xc9a36a,cat:'cafe'},
 chair:{n:'Chaise',w:.45,d:.45,h:.85,c:0x7a8699,cat:'commun'},
 sofa:{n:'Canapé',w:1.9,d:.85,h:.8,c:0x8a6f9e,cat:'cafe'},
 counter:{n:'Comptoir',w:3,d:.7,h:1.1,c:0x9c7b54,cat:'cafe',bespoke:true},
 machine:{n:'Machine à espresso',w:.78,d:.55,h:.55,c:0x9aa3a8,cat:'cafe',mount:'support'},
 vitrine:{n:'Vitrine réfrigérée',w:1.2,d:.7,h:1.3,c:0xa8b2b6,cat:'cafe'},
 frigo:{n:'Armoire réfrigérée',w:.75,d:.78,h:2,c:0x93999c,cat:'cafe'},
 lave:{n:'Lave-verres',w:.6,d:.6,h:.85,c:0x9aa3a8,cat:'cafe'},
 desk:{n:'Bureau',w:1.5,d:.75,h:.74,c:0x6e7f95,cat:'bureau'},
 armoire:{n:'Armoire de rangement',w:1,d:.45,h:1.8,c:0x7d8a76,cat:'bureau'},
 caisson:{n:'Caisson mobile',w:.42,d:.6,h:.6,c:0x6e7f95,cat:'bureau'},
 booth:{n:'Cabine studio',w:2,d:1.5,h:2.2,c:0x4f9d69,cat:'audio',bespoke:true},
 bureauregie:{n:'Bureau de régie',w:1.8,d:.9,h:.75,c:0x55806a,cat:'audio'},
 moniteur:{n:'Moniteur de studio',w:.25,d:.3,h:.4,c:0x2f3a3d,cat:'audio',mount:'support'},
 panneau:{n:'Panneau acoustique',w:1.2,d:.1,h:2,c:0x5f7f71,cat:'audio',mount:'mur',y:.6},
 tablepodcast:{n:'Table podcast',w:1.6,d:.9,h:.74,c:0x57b8b0,cat:'audio'},
 fond:{n:'Fond neutre sur pieds',w:2.4,d:.6,h:2.2,c:0xb9bcb4,cat:'audio'},
 stage:{n:'Scène',w:3,d:2,h:.4,c:0x9b7bd8,cat:'evenement'},
 gradin:{n:'Gradin 3 rangs',w:4,d:1.8,h:1.2,c:0x8d7bb8,cat:'evenement'},
 regie:{n:'Régie événementielle',w:1.6,d:.8,h:.9,c:0x6f5f95,cat:'evenement'},
 piano:{n:'Piano/clavier',w:1.4,d:.5,h:1,c:0x3a3f4a,cat:'evenement'},
 rack:{n:'Étagère/cimaise',w:2,d:.4,h:1.8,c:0xb05f5f,cat:'galerie'},
 socle:{n:'Socle d’exposition',w:.4,d:.4,h:1,c:0xdad6cb,cat:'galerie',bespoke:true},
 wc:{n:'Bloc WC',w:1.6,d:1.4,h:2.2,c:0x8a8f99,cat:'sanitaire'},
 lavabo:{n:'Lave-mains PMR',w:.6,d:.5,h:.85,c:0xdedad2,cat:'sanitaire',mount:'mur',y:.8},
 plant:{n:'Plante',w:.5,d:.5,h:1.5,c:0x4e8f4e,shape:'cyl',cat:'commun'},
 luminaire:{n:'Suspension',w:.4,d:.4,h:.45,c:0xf0d9a8,cat:'commun',mount:'plafond',y:2.15,light:true}
};
