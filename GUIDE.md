# Atelier 3D V4 — plans, pièces et implantation

## Ce qui est disponible

L’éditeur conserve l’emprise et les poteaux estimés de l’étude. La V4 ajoute un fond de plan calibrable, des pièces polygonales liées à leurs murs, des contraintes géométriques, deux modèles GLB détaillés et des contrôles d’implantation. Les anciens projets restent importables.

L’application vit dans le dépôt `atelier-3d-fives-cail/` — en ligne sur https://github.com/treimaine/atelier-3d-fives-cail. La version partagée demande une connexion avec un compte autorisé. Pour l’aperçu local : `node editor-assets/preview.cjs` depuis ce dossier, puis `http://127.0.0.1:8766` ; le serveur est limité à la boucle locale. La mise en ligne et la gestion des comptes sont décrites dans [DEPLOIEMENT.md](DEPLOIEMENT.md).

## Calibrer un plan

1. Dans **Fond de plan calibré**, importer un PNG, JPEG ou WebP (8 Mo maximum, 10 000 pixels maximum par côté). Pour un PDF, exporter préalablement la page en image.
2. Renseigner une distance connue en mètres.
3. Choisir **Calibrer sur 2 points**, puis cliquer les deux extrémités de cette cote sur l’image. Utiliser une distance assez longue et zoomer pour améliorer la précision des clics.
4. Régler l’origine X/Z, la rotation et l’opacité pour superposer le plan à la maquette. La calibration tient compte de la rotation de l’image.
5. Tracer ou ajuster les murs et les pièces en suivant ce fond.

Le calibrage change l’échelle de l’image, pas celle de la géométrie existante. Sans plan relevé, le bâtiment reste estimé à 21 × 25 m dans son rectangle englobant, avec une emprise en L de 360 m² et une hauteur de référence de 3,40 m. L’image n’est visible qu’en vue plan et n’est pas intégrée à l’export géométrique GLB. Elle est conservée dans le projet JSON.

## Dessiner une pièce polygonale

Dans **Espaces**, choisir **Pièce polygonale**, puis cliquer les sommets du contour. Terminer avec Entrée, **Fermer la pièce**, ou un clic près du premier sommet. Le contour peut être concave, mais ne peut pas se croiser lui-même. Il comporte de 3 à 60 sommets.

La case **Créer les murs du périmètre** génère les murs et leurs jonctions partagées dans la même opération d’historique. Un mur déjà présent entre les mêmes jonctions n’est pas dupliqué. Les murs horizontaux et verticaux ainsi créés reçoivent leur contrainte d’axe.

Sélectionner la pièce pour déplacer ses poignées ou saisir les coordonnées de ses sommets dans l’inspecteur. Ses murs liés suivent les changements. Une zone rectangulaire existante peut être convertie avec **Éditer les sommets**, puis associée à un périmètre avec **Créer / lier le périmètre**. **Délier la pièce des murs** permet d’éditer ensuite le contour indépendamment.

La surface utilise le contour réel, y compris ses décrochements. La couverture totale est calculée sans compter deux fois les chevauchements et en tenant compte de l’emprise en L. Les pièces avec trous intérieurs et l’ajout/suppression de sommets dans un périmètre déjà lié ne sont pas pris en charge ; redessiner le contour pour changer sa topologie.

## Murs et contraintes

- Les extrémités communes forment des jonctions partagées. Déplacer une jonction met à jour tous les murs associés.
- La contrainte **Horizontal (X)** partage la coordonnée Z des deux extrémités ; **Vertical (Z)** partage leur X. Les déplacements se propagent à travers les murs orthogonaux liés.
- **Verrouiller la longueur** conserve la longueur courante. Une modification incompatible est annulée entièrement, avec un message. Le système n’essaie pas de résoudre automatiquement un réseau de contraintes non linéaires.
- **Longueur souhaitée** règle la longueur depuis le point de départ du mur. Les contraintes de ses voisins restent applicables.
- **Lier les extrémités proches** fusionne les jonctions à moins de 15 cm ; **Délier les extrémités** rend un mur indépendant.
- La création et le déplacement utilisent la grille choisie et un accrochage aux extrémités proches.

La géométrie des murs reste constituée de volumes séparés : les jonctions ne réalisent pas d’union booléenne. Les intersections en T au milieu d’un mur, les onglets complexes et les contraintes d’angle arbitraires ne sont pas gérés automatiquement. Les ouvertures restent attachées à leur mur ; un déplacement qui les ferait dépasser est refusé.

## Mobilier détaillé

Les modèles locaux sont disponibles dans **Mobilier → Modèles détaillés**. Leur chargement se fait à la demande. Depuis la mise à jour du 12 septembre 2026, le modèle suit ensuite le curseur : il n’est posé qu’au clic, à ses dimensions natives, et le placement est refusé hors emprise ou en collision tant que **Placement libre** n’est pas coché.

- **Fauteuil bois & velours** : *SheenChair*, Eric Chadwick / Wayfair, sous CC0. C’est un modèle détaillé de référence, pas une référence commerciale de produit. Les auteurs précisent qu’il ne représente pas un produit réel. [Source](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SheenChair).
- **Canapé bois & cuir** : *SheenWoodLeatherSofa*, issu de *sofa_03* de Fran Calvente / Poly Haven, avec améliorations d’Eric Chadwick / Darmstadt Graphics Group. CC0 pour l’original, CC-BY 4.0 pour les améliorations. [Source et attributions](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SheenWoodLeatherSofa).

Les licences et les modèles sources sont fournis dans `editor-assets/models`. Pour le fauteuil, la version chargée supprime quinze redéfinitions de `texCoord` identiques au canal déjà déclaré ; géométrie et textures sont inchangées. Cette adaptation évite un avertissement du chargeur r128. Les effets avancés de sheen et de specular des modèles ne sont pas reproduits intégralement par ce moteur ancien ; le rendu repose sur leurs matériaux standard, textures et géométrie.

Les dimensions initiales proviennent de l’encombrement géométrique du GLB et peuvent être modifiées. Elles ne constituent pas des cotes fabricant certifiées. Le bouton **Cadrer la sélection** permet d’examiner un meuble de près.

L’import GLB libre de la V3 reste disponible. Les modèles intégrés sont stockés par référence dans la sauvegarde locale ; l’export JSON contient aussi leurs données binaires pour l’échange du projet. Les projets avec de gros GLB importés ou des images peuvent dépasser le quota du stockage local : le statut de sauvegarde le signale.

## Collisions, dégagements et portes

Le panneau **Collisions & dégagements** distingue trois résultats. Cliquer une alerte sélectionne l’objet ou le mur concerné.

| Contrôle | Méthode et affichage |
|---|---|
| Collision physique | Intersection des encombrements rectangulaires orientés, avec prise en compte de l’élévation ; comparaison entre meubles, contre les parties pleines des murs et contre les poteaux. Contours rouges dans la scène. |
| Dégagement | Encombrement augmenté de la marge d’étude choisie, par défaut 0,60 m. Une marge spécifique peut être renseignée pour chaque meuble. Le contour de dégagement de l’objet sélectionné apparaît en jaune. |
| Débattement de porte | Secteur d’ouverture à 90°, calculé selon le côté et la charnière choisis. Contrôle contre les meubles et les autres murs. Secteur rouge si gêné. |

Les ouvertures sont retirées des obstacles si l’objet tient dans leur largeur et leur hauteur. Un objet trop haut est donc signalé contre le linteau. Un simple contact des encombrements n’est pas traité comme une pénétration.

Ces contrôles portent sur les volumes d’encombrement et peuvent être conservateurs, notamment pour les meubles ajourés ou de forme irrégulière. Ils ne font pas de collision triangle par triangle, ne modélisent pas les passages sous un plateau de table, et ne calculent pas un itinéraire accessible. Les poteaux sont inclus dans les collisions du mobilier, mais le débattement des portes n’est pas comparé aux poteaux ni aux autres battants. La marge de 0,60 m est un paramètre d’étude, pas une exigence réglementaire.

## Variante fournie

`Proposition_Hub_Fives_Cail_V4.json` contient 48 objets : la proposition de 46 objets corrigée, plus le fauteuil et le canapé détaillés. Le comptoir auparavant placé sur un poteau est déplacé et le bureau qui gênait une porte est décalé. Selon les contrôles d’encombrement implémentés, cette variante n’a plus de collision physique ni de débattement de porte gêné ; des alertes de dégagement peuvent subsister.

Le chevauchement initial de 13,2 m² entre l’événementiel et le publishing est résolu depuis le 12 septembre 2026 : l’espace événementiel s’arrête à la cloison z = 11,60 m (profondeur 7,60 m au lieu de 10 m, soit 41,8 m² au lieu de 55 m²). Ce choix aligne le zonage sur les cloisons déjà dessinées ; il reste à confirmer côté programme. La variante ne remplace pas automatiquement votre projet ouvert. L’importer depuis **Versions & échanges** pour l’essayer ; l’historique permet de revenir au projet précédent.

## Vérifications réalisées

44 tests automatisés passent. Ils couvrent les contrôles antérieurs ainsi que les pièces concaves, les contours croisés, les surfaces sans double comptage, les contraintes d’axes, les jonctions partagées, les longueurs verrouillées, les pièces liées, les collisions orientées et en hauteur, les linteaux, les débattements, les dégagements, le calibrage avec rotation et la sérialisation des modèles intégrés.

Essais dans un projet de navigateur isolé de votre sauvegarde principale : dessin d’une pièce concave à six murs, modification d’un sommet avec propagation au mur voisin et à la surface, import d’un plan image, calibrage sur 10 m, chargement des deux modèles détaillés, sélection et cadrage du canapé, puis rechargement conservant la pièce, ses liens, la calibration et les modèles.

L’emprise et les poteaux du bâtiment restent fixes et estimés. Cette V4 étend l’éditeur d’aménagement ; elle ne constitue pas encore un système complet de CAO/BIM.


## Mise à jour mobilier Khronos — 12 septembre 2026

Les chaises, canapés et plantes paramétriques sont maintenant affichés avec SheenChair, SheenWoodLeatherSofa et DiffuseTransmissionPlant. Le remplacement est automatique à l’ouverture des anciens projets et pour les nouvelles insertions. Positions, rotations et dimensions d’encombrement restent conservées ; cela adapte les proportions des modèles aux objets existants. Pour les proportions originales, insérer directement un modèle détaillé depuis Mobilier. Les tables, comptoirs et autres équipements sans équivalent dans ce dépôt restent paramétriques.

Sept modèles détaillés sont disponibles : les deux premiers modèles, la plante, ChairDamaskPurplegold, GlamVelvetSofa, SpecularSilkPouf et CommercialRefrigerator. Les géométries et textures sont partagées entre les copies pour limiter la mémoire. Les licences et auteurs sont dans editor-assets/models/ATTRIBUTIONS.md. Les matériaux avancés non pris en charge par le moteur actuel sont rendus avec leurs propriétés PBR de base. La limite d’import JSON passe à 150 Mo pour les projets incluant plusieurs modèles intégrés.


## Navigation améliorée — 12 septembre 2026

- Flèches ou ZQSD / WASD : déplacement continu dans les trois vues. En perspective, le déplacement suit l’orientation de la caméra ; en plan, haut correspond au nord du dessin.
- Maj : vitesse multipliée par trois. Le menu Navigation & clavier propose les vitesses Précise, Normale et Rapide.
- J/L : orientation gauche/droite ; I/K : regarder vers le haut/bas en perspective et intérieur.
- +/− : zoom en perspective et plan ; avancer/reculer en intérieur. Page haut/bas règle la hauteur en 3D.
- 1, 2, 3 : perspective, plan, intérieur. Chaque vue conserve son cadrage pendant la session ; le bouton Cadrer ou Home réinitialise la vue courante. F cadre la sélection lorsqu’elle existe.
- L’outil Main, le clic milieu, le clic droit et Maj + glisser permettent de naviguer au-dessus des objets. En perspective, glisser le fond ou Alt + glisser fait tourner la vue.
- En plan, glisser suit la souris dans les deux axes ; le zoom à la molette reste centré sur le point sous le curseur.
- En intérieur, glisser permet de regarder, même au-dessus d’un meuble. Un clic simple permet toujours de sélectionner en mode Sélection. La visite reste libre, sans blocage contre les murs.

Les raccourcis s’arrêtent pendant la saisie dans un champ, à la perte de focus ou lorsque l’onglet devient inactif. La navigation ne modifie pas les objets et n’ajoute aucune opération à l’historique du projet. Les positions de caméra sont mémorisées entre les modes, mais pas après rechargement de la page.

Validation : 54 tests automatisés, dont déplacements, diagonales, accélération, mémorisation des vues et ancrage du zoom ; essais clavier et souris dans les trois modes du navigateur intégré.

## Manipulation, bâti éditable et correctifs — 12 septembre 2026

### Manipuler (lot A)

- **Aperçu de placement** : un objet du catalogue ou un modèle détaillé suit le curseur avant d’être posé. `R` le tourne du pas choisi, `Maj+R` dans l’autre sens, Échap annule. L’état affiché sous le catalogue indique `Libre`, `Collision`, `Débattement de porte` ou `Hors de l’emprise`, et le clic est refusé tant que **Placement libre malgré les collisions** n’est pas coché. **Poser plusieurs exemplaires** enchaîne les poses.
- **Poignée de rotation** : une poignée orange entoure la sélection. Le glissement tourne l’ensemble autour de son centre, cranté au pas choisi (libre, 15°, 45°, 90°), `Alt` pendant le glissement libère le pas. Les boutons ↶ / ↷ de l’inspecteur font la même chose sans souris.
- **Sélection multiple** : `Ctrl + clic` ajoute ou retire un objet. Un clic simple sur un membre de la sélection la conserve, pour déplacer l’ensemble ; cliquer le vide désélectionne. **Grouper** fige l’ensemble, **Dégrouper** le libère.
- **Alignement et répartition** des centres en X ou en Z, **Dupliquer** (Ctrl+D) qui conserve dimensions, rotation et groupe.
- **Proportions verrouillées par défaut** : modifier une dimension met les trois à l’échelle. Décocher **Conserver les proportions** pour un étirement libre. **Rétablir les dimensions du modèle** revient à l’encombrement natif du GLB.
- **Verrouillage** : un objet verrouillé refuse déplacement, rotation et redimensionnement. **Protéger murs et pièces du déplacement à la souris** (onglet Bâti) évite de déplacer le bâti par erreur ; la saisie dans l’inspecteur reste possible.

Une manipulation correspond à une annulation. La navigation (outil Main, clic droit, clic milieu, Maj + glisser) ne déplace jamais d’objet.

### Construire le local (lot B)

- **Onglet Bâti → Géométrie du local** : hauteur de plafond, contour du bâtiment (un sommet `X Z` par ligne) et poteaux (`X Z largeur profondeur hauteur`) sont éditables. La dalle, le plafond et ses poutres suivent le contour saisi ; l’emprise et la hauteur affichées en tête de panneau sont recalculées.
- Les hauteurs de murs restent indépendantes de la hauteur de plafond : changer le plafond n’allonge pas les murs existants, à ajuster mur par mur.
- **Créer une jonction sur ce mur** scinde un mur à une distance donnée sans déplacer ses ouvertures, et crée le nœud partagé. Une seconde cloison tracée depuis ce point donne un raccord en T ; les pièces liées reçoivent le nouveau sommet. La jonction est refusée si elle tombe sur une ouverture, trop près d’une extrémité, ou sur un mur à longueur verrouillée.
- Les murs restent des volumes juxtaposés : aucune union booléenne ni onglet n’est calculé.

### Catalogue

Le catalogue est classé par usage : salon de thé & comptoir, galerie & exposition, événementiel & scène, studio audio & podcast, bureaux & publishing, sanitaires & services, commun. Chaque entrée annonce les dimensions réellement posées et signale « modèle détaillé » quand un GLB remplace l’objet paramétrique. La recherche porte sur le nom et la catégorie.

### Correctifs du 12 septembre 2026

- Le serveur d’aperçu `preview.cjs` ne listait plus tous les modules : `manipulation.js` et `building.js` étaient renvoyés en 404 et la page restait bloquée sur « Préparation de l’atelier 3D… ». L’autorisation porte désormais sur les fichiers de `editor-assets` et de ses sous-dossiers, sans liste à tenir à jour.
- Un chemin d’insertion hérité posait encore un objet au clic sans aperçu ni contrôle de collision : il est supprimé, toutes les poses passent par l’aperçu.
- Un import GLB atterrissait à une position fixe ; il suit maintenant le curseur. Un import abandonné avant la pose libère sa mémoire au lieu de rester chargé.
- Un clic sur un objet déjà sélectionné réduisait la sélection à cet objet et empêchait de déplacer un ensemble non groupé.
- Les identifiants de groupe portaient le préfixe des nœuds de murs (`junction_`) ; ils utilisent `group_`.
- Zonage initial sans chevauchement (voir ci-dessus).

Validation : 65 tests automatisés — les 54 précédents, plus le plafond suivant le contour, la hauteur de bâtiment éditable, la scission de mur et son refus sur une ouverture, la conservation de la sélection multiple, groupe/rotation/duplication à dimensions constantes, le refus de transformer un objet verrouillé, la validité de placement, les dimensions annoncées par le catalogue, les catégories et l’absence de chevauchement du zonage initial.

Essais dans le navigateur intégré, sur un projet vidé de la sauvegarde locale : pose d’une table tournée à 30°, chaises posées en série avec refus des collisions, sélection multiple par Ctrl + clic, groupe, duplication et rotation de l’ensemble à la poignée sans changement de dimensions, Maj + glisser au-dessus des objets sans les déplacer, hauteur de plafond portée à 4,20 m puis annulée, scission du mur z = 11,60 m avec ses deux portes réparties, cloison en T raccordée au nouveau nœud, pose d’un fauteuil détaillé au curseur et annulation d’une pose par Échap.

## Lot C — objets fidèles, équipement métier et poteaux éditables — 12 septembre 2026

### Catalogue par métier

Le catalogue compte 27 gabarits classés par usage. Les nouveaux couvrent le programme du hub : machine à espresso, vitrine réfrigérée, armoire réfrigérée, lave-verres pour le salon de thé ; socle d'exposition pour la galerie ; gradin trois rangs et régie pour l'événementiel ; bureau de régie, moniteur de studio, panneau acoustique, table podcast et fond neutre pour les studios ; armoire et caisson pour les bureaux ; lave-mains PMR pour les sanitaires.

Ces dimensions sont des **gabarits d'étude** : des encombrements courants du métier, pas des cotes fabricant. L'inspecteur le rappelle sous chaque objet. Deux champs servent à documenter le choix réel :

- **Élément sur mesure (à fabriquer)** : coche qui distingue un ouvrage d'atelier d'un objet de catalogue. Le comptoir, la cabine studio et le socle sont sur mesure par défaut.
- **Référence fabricant** (ou **Descriptif / atelier** pour un élément sur mesure) : texte libre, vide tant que la consultation n'a pas eu lieu. Les contrôles signalent les éléments sur mesure encore sans descriptif.

Aucune référence commerciale n'est pré-remplie : les seules provenances documentées sont celles des modèles GLB détaillés, affichées avec leur crédit et leur licence.

### Face avant

Chaque objet porte une face avant, `+Z` du modèle par défaut, modifiable pour un modèle importé dont l'avant regarde ailleurs. Un repère bleu la matérialise dans la scène pour la sélection et pour l'objet en cours de pose. **Dos au mur le plus proche** oriente la sélection pour que sa face avant s'éloigne du mur voisin ; l'objet n'est pas déplacé.

### Point de pose et surfaces de support

- **Posé sur** rattache un objet au plateau d'un autre : son élévation devient celle du plateau, et il suit ensuite ses déplacements, ses rotations et ses changements de hauteur. Un trait violet relie les deux, visible depuis l'objet posé comme depuis le meuble porteur.
- Les équipements destinés à un plateau — machine à espresso, moniteur de studio — se rattachent **pendant la pose** : survoler un meuble suffit, le brouillon monte à la hauteur du plateau et l'état indique « sur … ». Cela lève aussi la fausse collision qui empêchait jusqu'ici de poser un objet sur un meuble.
- Sortir un objet de l'emprise de son support, ou régler son élévation à la main, le détache. Supprimer le support détache ce qu'il portait, à sa hauteur courante.
- Les objets muraux — panneau acoustique, lave-mains PMR — arrivent à leur hauteur de pose usuelle. Ils restent posés contre la face du mur : le contrôle de collision les refuse s'ils le pénètrent, **Placement libre** permet de passer outre.
- Les relations reposent sur des identifiants d'objet stables, écrits dans le projet et conservés par l'export/import. Les références inconnues, les cycles et les auto-supports sont rompus à la validation.

### Variante d'un meuble

Le sélecteur **Variante** remplace le modèle d'un objet — paramétrique ↔ modèle détaillé — en conservant son point de pose : centre, élévation, rotation, face avant, support, référence et caractère sur mesure. Seules les dimensions deviennent celles du nouveau modèle. Un nom laissé par défaut suit la variante ; un nom saisi reste. Revenir au gabarit paramétrique d'origine reste proposé après un passage en modèle détaillé.

### Poteaux éditables

Les onze poteaux hérités de l'étude ne sont plus figés :

- Onglet **Bâti → Poteaux** : la liste les sélectionne, **＋ Ajouter** en crée un au centre de l'emprise.
- L'inspecteur règle position X/Z, largeur, profondeur et hauteur ; **Monter jusqu'au plafond** aligne la hauteur sur celle du bâtiment. **Dupliquer** et **Supprimer** s'appliquent comme aux autres objets.
- Glisser un poteau dans la scène le déplace, après avoir décoché **Protéger murs et pièces du déplacement à la souris**. Un poteau sélectionné garde la priorité sous le curseur même s'il est noyé dans un mur.
- Les collisions du mobilier et les contrôles d'emprise suivent les poteaux édités, pas la liste d'origine. La saisie en bloc par zone de texte reste disponible dans **Géométrie du local**.

Le contrôle signale que **le poteau 11, hérité à l'angle rentrant (15 ; 14), déborde de l'emprise de 22,5 cm**. La donnée est conservée telle quelle : c'est un écart réel de l'étude, à trancher sur relevé — le poteau peut maintenant être déplacé ou redimensionné pour le résoudre.

### Correctifs

- Un objet posé en hauteur se déplaçait dans le plan du sol : le curseur et le meuble divergeaient d'autant plus que la vue était rasante. Le déplacement suit maintenant le plan de l'objet.
- Une sélection devenue vide après une annulation, une suppression ou un import atteignait le rendu et interrompait l'affichage. Elle est purgée avant chaque reconstruction.
- Le changement de variante lisait l'objet en cours de modification comme mémoire de son état : le nom choisi était perdu. L'état est copié avant la modification.
- La priorité de sélection sous le curseur est limitée à une différence de profondeur de 60 cm, pour qu'un sol sélectionné ne vole pas les clics sur les meubles posés dessus.

Validation : 82 tests automatisés. Les nouveaux couvrent les identifiants stables et leur conservation par l'aller-retour JSON, l'élévation héritée d'un plateau, le suivi en déplacement et en rotation, le détachement par sortie d'emprise ou suppression du support, les cycles de support, la duplication d'un ensemble porté, l'orientation dos au mur, la conservation du point de pose et du nom lors d'un changement de variante, l'ajout, le déplacement, le redimensionnement et la suppression de poteaux, le refus d'un poteau impossible, les collisions suivant les poteaux édités, la hauteur de pose des objets muraux, la couverture du catalogue par usage et la purge d'une sélection orpheline.

Essais dans le navigateur intégré : pose d'une machine à espresso sur une table par survol, avec l'état « Libre · sur Table 4p » puis suivi de la table en déplacement et en rotation ; orientation dos au mur d'un bureau placé à 1,20 m de la façade ouest ; passage d'un gabarit paramétrique à un modèle détaillé sans déplacement du point de pose ; sélection d'un poteau dans la liste, puis modification de sa largeur et de sa position par l'inspecteur, avec disparition de l'alerte d'emprise ; pose des quinze nouveaux équipements et lecture de leur rendu dans le salon de thé.

Note d'environnement : dans le navigateur intégré, l'onglet passe brièvement en arrière-plan pendant un glissement automatisé, ce qui déclenche l'annulation volontaire des déplacements en cours (`visibilitychange`). Les glissements ont donc été rejoués par événements de pointeur, à comportement identique ; ce cas ne se produit pas pour un utilisateur dont l'onglet reste visible.

## Lot D — présenter, vérifier, conserver — 12 septembre 2026

### Déplacer les poteaux : ce qui bloquait

La protection **Protéger murs et pièces du déplacement à la souris** est active par défaut. Elle annulait le glissement d'un poteau **sans rien dire** : la vue pivotait et le poteau semblait impossible à bouger. Trois changements :

- Un glissement refusé affiche maintenant le motif et la marche à suivre.
- L'inspecteur d'un poteau porte sa propre case **Déplacer le bâti à la souris** : la cocher suffit, sans aller chercher l'onglet Bâti.
- Des boutons **−X / +X / −Z / +Z** déplacent le poteau au pas choisi, sans souris. Le pas saisi est conservé entre deux clics.

Les coordonnées X/Z, la section et la hauteur restent modifiables au clavier dans l'inspecteur, et **Monter jusqu'au plafond** aligne la hauteur sur celle du bâtiment.

### Vérifier : contrôle de circulation

Panneau **Circulation** dans l'inspecteur. Le sol est rastérisé au pas de 10 cm ; les murs pleins, les poteaux et le mobilier situé entre 0,15 m et 1,90 m de hauteur sont marqués comme obstacles ; on mesure la distance de chaque cellule libre au premier obstacle, puis on ne conserve que les cellules où un gabarit de la largeur demandée passe. Ce qui reste connecté à une **porte extérieure** est desservi.

- Largeurs proposées : 0,60 m (appoint), 0,90 m (circulation courante), 1,20 m (dégagement large), 1,40 m (giration fauteuil).
- Le rapport donne la surface desservie, le nombre d'accès extérieurs, les espaces qui perdent leur accès à cette largeur, ceux qui n'en ont aucun même à 0,60 m, et la largeur maximale desservant les mêmes espaces.
- **Afficher la carte au sol** superpose la grille en vue plan et perspective : vert = desservi, rouge = sol libre mais inaccessible à cette largeur, gris = obstacle.
- L'analyse est lancée à la demande et signalée comme périmée dès que le projet change ; elle prend environ 70 ms sur l'emprise actuelle.

Le résultat est indicatif : il porte sur des encombrements, ignore les portes en mouvement et ne vaut pas vérification d'accessibilité réglementaire. La proposition meublée livrée passe à 0,90 m — voir la section suivante pour les corrections apportées.

### Conserver : stockage, variantes et vues

- **Sauvegarde locale en IndexedDB**, avec reprise automatique d'une sauvegarde localStorage existante. localStorage reste le filet de secours si IndexedDB est indisponible ; le statut en bas de fenêtre indique lequel est utilisé. L'écriture est différée de 0,4 s pour qu'un glissement ne déclenche pas une transaction par image.
- **Variantes d'implantation** : **＋ Figer** enregistre le mobilier et le zonage courants sous un nom. Cliquer une variante la réapplique — le bâti, les poteaux, les ressources et les vues ne sont pas touchés, et l'annulation revient à l'implantation précédente. Huit variantes au maximum.
- **Comparaison** : le tableau met en regard l'implantation courante et chaque variante — nombre d'objets, éléments sur mesure, collisions, débattements gênés et emprise au sol cumulée.
- **Vues mémorisées** : **＋ Cadrage** enregistre le mode (perspective, plan, intérieur), la cible, la distance, les angles, la coupe et le plafond. Les vues sont dans le projet et suivent l'export JSON. Douze vues au maximum.

### Présenter

- **Échelle réelle des textures** : les sols sont désormais répétés à leur taille physique — 0,60 m pour le carrelage, 1,20 m pour la moquette, 1,80 m pour le parquet, 3 m pour le béton. Une lame de parquet mesure la même chose dans toutes les pièces, quelle que soit leur surface.
- **Luminaires** : nouvel objet *Suspension* posé à 2,15 m par défaut. Jusqu'à huit luminaires éclairent réellement la scène ; au-delà, les autres restent des objets et le panneau Scène l'indique.
- **Ambiance Soirée · luminaires** : soleil et lumière du ciel très réduits, fond assombri, exposition relevée, suspensions à pleine intensité. Les trois ambiances existantes sont inchangées.

### Exports versionnés

Chaque export JSON incrémente le numéro de révision du projet et note sa date. Les trois exports — projet `.json`, maquette `.glb`, capture `.png` — portent ce numéro dans leur nom de fichier (`HubFivesCail_<projet>_r001.json`), ce qui distingue deux fichiers d'une même étude sans ouvrir leur contenu.

### Correctifs

- Une valeur nulle dans une vue enregistrée (distance ou inclinaison à zéro) était silencieusement remplacée par la valeur par défaut au lieu d'être refusée.
- L'analyse de circulation partait initialement de toutes les portes, y compris intérieures : chaque pièce s'amorçait elle-même et aucun enclavement n'apparaissait. Seules les portes donnant sur l'extérieur amorcent le parcours.

### Ce que le lot D ne couvre pas

Le moteur reste three.js r128 et les matériaux gardent leurs propriétés PBR de base : il n'y a ni carte d'environnement HDRI, ni rendu final intégré — l'export GLB reste la passerelle vers Blender pour cela. Les contrôles de collision restent fondés sur des encombrements orientés, sans finesse supplémentaire ni débattement de porte comparé aux autres portes. Les ressources GLB restent intégrées au fichier de projet plutôt que stockées séparément.

Validation : 97 tests automatisés. Les nouveaux couvrent la desserte de tous les espaces sur le local vide, la perte d'accès d'une pièce dont les portes sont barrées, l'indifférence aux obstacles hors hauteur de passage, la péremption de l'analyse après une modification, l'enregistrement, la comparaison et l'application d'une variante sans toucher au bâti, l'aller-retour JSON des variantes et leur plafond, l'enregistrement et la restauration d'une vue, le refus d'une vue impossible, l'incrément de révision et le nom de fichier, l'échelle métrique des textures de sol, le plafonnement des luminaires, le message de protection du bâti et la persistance du pas de déplacement.

Essais dans le navigateur intégré : sauvegarde effective en IndexedDB avec localStorage réduit à un marqueur de migration ; fermeture et réouverture du projet retrouvant ses ressources, la machine à espresso toujours posée sur le comptoir à 1,10 m, sa variante et sa vue ; restauration d'une vue plan rétablissant mode, cible et distance ; analyse de circulation en 73 ms avec carte au sol superposée au plan ; vue intérieure en ambiance Soirée avec cinq suspensions allumées ; exports JSON, GLB et PNG numérotés en révision 1.

## Goulets localisés et corrections de la proposition — 12 septembre 2026

### L'analyse dit maintenant où ça coince

Le contrôle de circulation signalait qu'un espace n'était pas desservi, sans dire par quoi. Il calcule désormais, pour chaque espace, le **chemin le plus large** depuis une porte extérieure : les cellules sont agrégées par dégagement décroissant, et celle qui raccorde enfin l'espace à une entrée donne à la fois sa largeur de passage maximale et l'endroit qui la limite.

Le panneau liste les goulets sous la largeur demandée — « Studio audio · 0,68 m au droit de X 6,85 / Z 5,25 » — et cliquer sur une ligne cadre le plan sur ce point.

### Ce que cela a révélé, et les trois corrections

| Constat | Cause | Correction |
|---|---|---|
| Studio audio non desservi à 0,90 m, passage réduit à 0,68 m | Le bloc WC, posé en Z 6,20 m, barrait la sortie de la porte du studio (porte de 0,93 m en Z 5,04–5,97 m) | Bloc WC reculé de 40 cm, en Z 6,60 m |
| Galerie vers office/cuisine limité à 0,97 m | Le canapé passait à 0,85 m du poteau (18 ; 18) et de la cimaise | Canapé décalé de 15 cm vers l'est, en X 18,15 m |
| Poteau 11 hors de l'emprise de 22,5 cm | Centré sur l'angle rentrant (15 ; 14), sa section de 45 cm mordait la découpe du L | Poteau ramené en (15 ; 13,77), entièrement à l'intérieur. Position à confirmer au relevé |

Après correction, la proposition meublée est desservie dans tous ses espaces à 0,90 m, sans collision ni débattement de porte gêné, et la surface desservie passe de 142,8 à 161,2 m².

### La limite suivante est la largeur des portes

Le goulet minimal de la proposition corrigée est de **1,00 m**, et il ne descend plus en dessous où qu'on déplace le mobilier : ce sont les vantaux eux-mêmes qui limitent, les portes simples de l'étude mesurant 0,93 m. À 1,20 m de passage demandé, les goulets listés sont tous des portes ; à 1,40 m — la giration d'un fauteuil roulant — six espaces sur huit deviennent inaccessibles.

Élargir les circulations au-delà de 1,00 m relève donc du programme, pas de l'implantation : il faut élargir les vantaux, ce que l'éditeur permet en sélectionnant une ouverture et en changeant sa largeur. Cette décision n'a pas été prise ici.

### Éléments sur mesure

Les éléments sur mesure sans descriptif ne sont plus présentés comme une anomalie mais comme une tâche du projet : « 3 élément(s) sur mesure à décrire ». Le contenu — comptoir, cabine studio, socle — relève d'une consultation d'atelier et reste à renseigner dans l'inspecteur ; rien n'est pré-rempli.

Validation : 100 tests automatisés. Les nouveaux vérifient que la proposition livrée est parcourable à 0,90 m dans tous ses espaces sans collision ni porte gênée, que chaque poteau hérité tient dans l'emprise, et qu'un goulet est bien restitué avec sa largeur et sa position — puis disparaît une fois l'obstacle déplacé.

## Espaces manipulables directement, et mise en ligne — 12 septembre 2026

### Pourquoi un espace ne se déplaçait pas

La case **Protéger murs et pièces du déplacement à la souris**, active par défaut, couvrait aussi les espaces : les saisir ne produisait rien. Un espace n'est pas de la structure — c'est une aire d'usage. La protection ne couvre donc plus que les **murs et les poteaux**, et son libellé le dit.

### Manipulation directe, dans l'esprit des Sims

Sélectionner un espace fait apparaître ses poignées dans la scène, en plan comme en perspective :

- **Poignée bleue au centre** : déplacer l'espace. Par défaut il emporte **le mobilier qu'il contient** — l'équivalent du déplacement d'une pièce avec ses objets dans Les Sims. La case **Emporter le mobilier contenu** le désactive.
- **Quatre poignées d'angle et quatre poignées de côté** : redimensionner. Le côté opposé reste en place, le contenu garde ses dimensions, et la pièce ne descend pas sous 0,50 m.
- **Quart de tour ↶ / ↷** : pivote l'espace et, s'il les emporte, ses objets — position et orientation comprises. Un quart de tour peut faire chevaucher l'espace avec ses voisins : les contrôles géométriques le signalent aussitôt.
- **Pas de déplacement −X / +X / −Z / +Z** pour un réglage au clavier, avec le pas conservé entre deux clics.
- Glisser le sol d'un espace le déplace aussi, avec son contenu, comme la poignée centrale.

La précision reste celle d'un plan : tout passe par la grille d'aimantation, les cotes de l'inspecteur et le même validateur. Les murs suivent l'espace lorsqu'il leur est lié par **Créer / lier le périmètre** ; sinon ils restent en place, et l'espace se déplace seul.

Les pièces polygonales gardent en plus leurs poignées de sommets et leurs coordonnées sommet par sommet.

### Correctif de sélection

Une poignée est dessinée pour être saisie : elle passe désormais avant le corps de l'objet sous le curseur. Sans cette règle, le sol d'un espace sélectionné volait les clics destinés à ses propres poignées de redimensionnement.

### Ouverture plus rapide

Les modèles détaillés — 25 Mo pour le fauteuil, le canapé et la plante — étaient attendus avant l'affichage : l'atelier restait plusieurs secondes sur « Préparation… ». Ils se chargent maintenant en tâche de fond et remplacent les volumes simples à mesure qu'ils arrivent. L'atelier est manipulable en moins de trois secondes.

### Mise en ligne

`node editor-assets/build-web.cjs` assemble `atelier-3d-web/` : la page en `index.html`, les modules, le moteur, les modèles et leurs licences, plus un `vercel.json` d'en-têtes — 32 fichiers, 51,7 Mo. `--serve` sert ce paquet sur le port 8767 pour le vérifier avant envoi. La marche à suivre complète, et l'avertissement sur ce qu'il ne faut surtout pas déployer, sont dans `DEPLOIEMENT_VERCEL.md`.

Validation : 107 tests automatisés. Les nouveaux couvrent le déplacement d'un espace avec et sans son contenu, le redimensionnement par poignée avec côté opposé fixe et taille minimale, le quart de tour emportant le mobilier, le maintien de la protection sur les murs et les poteaux seuls, la présence des neuf poignées sur chacun des huit espaces, et la priorité des poignées sur les corps.

Essais dans le navigateur intégré : studio audio déplacé de +1,00 / +0,50 m avec ses cinq objets en une seule annulation, redimensionné de 6,50 à 5,00 m par sa poignée de côté, studio podcast pivoté d'un quart de tour avec report du chevauchement créé ; paquet de déploiement servi et ouvert depuis sa racine, console vide, tous les modules présents.

## Emplacement des fichiers — 12 septembre 2026

L’éditeur n’est plus à la racine du dossier de travail : il constitue son propre dépôt, `atelier-3d-fives-cail/`, poussé sur GitHub et branché sur Vercel. La copie qui subsistait à la racine a été retirée pour qu’aucune modification ne se perde entre deux exemplaires.

Ce qui ne part pas sur GitHub est rangé dans `atelier-3d-sources/` : les modèles Khronos d’origine au format `.glb` (43 Mo, qui servent à régénérer les fichiers `.js` embarqués), les scripts de migration déjà appliqués, et trois états antérieurs de l’éditeur. Rien de tout cela n’est nécessaire pour faire tourner ou déployer l’application.



## Septembre 2026 — Comptes et versions partagées

La connexion et le partage utilisent maintenant Supabase. Un compte autorisé est nécessaire. Les versions sont privées, datées et attribuées à leur auteur. Le bouton **Enregistrer une version partagée** publie une nouvelle proposition ; **Ouvrir une copie** conserve d’abord le travail courant dans une copie de secours locale. L’administrateur choisit la référence de l’équipe. Les déplacements d’objets restent locaux jusqu’au prochain enregistrement partagé.

Le déploiement actuel se fait directement depuis ce dépôt, sans script de build. Les anciens paragraphes de ce journal concernant `build-web.cjs`, `atelier-3d-web` et `DEPLOIEMENT_VERCEL.md` décrivent des étapes historiques. Les instructions actuelles sont dans [DEPLOIEMENT.md](DEPLOIEMENT.md).

## 15 septembre 2026 — Inscription libre, interface et poteaux à la souris

- **Inscription** : chaque associé crée son compte depuis l’écran de connexion ; l’administrateur accepte ou refuse la demande dans l’onglet **Équipe**. Voir [DEPLOIEMENT.md](DEPLOIEMENT.md).
- **Interface** : la colonne de droite a deux onglets, **Sélection** (ouvert automatiquement à chaque sélection) et **Équipe**. L’en-tête porte **⇪ Partager une version** et **? Aide** ; un écran de bienvenue s’affiche à la première connexion. L’export JSON passe dans **Fichiers & exports**. Les raccourcis clavier sont inactifs quand une fenêtre est ouverte.
- **Murs et poteaux à la souris** : la case **Protéger murs et poteaux du déplacement à la souris** est supprimée. Murs, ouvertures, extrémités et poteaux se glissent directement, comme le mobilier ; Ctrl+Z annule un déplacement. Les paragraphes plus haut qui mentionnent cette protection décrivent l’état antérieur.
- **Éléments indépendants** : déplacer ou modifier un mur (glissement, extrémité, coordonnées, longueur) ne déplace plus les murs qui partagent ses angles ; l’extrémité modifiée quitte sa jonction. Déplacer ou remodeler un espace ne déplace plus ses murs ; il s’en détache. Une extrémité sortie de son axe rend le mur « Libre » au lieu de refuser le déplacement. Les jonctions restent posées à la création (tracé, périmètre, scission) mais ne propagent plus rien lors d’une modification.
- **Revenir à l’étude initiale** demande désormais une confirmation.
- **Copie de secours avant remplacement** : avant le retour à l’étude initiale, un import `.json`, l’application d’une variante, le rechargement du projet du dépôt ou l’ouverture d’une version partagée, la maquette courante est copiée sur l’appareil (un emplacement par compte). **Fichiers & exports → ↺ Récupérer la copie de secours** la ramène, même après rechargement de la page ; l’état remplacé devient à son tour la copie, ce qui rend l’opération réversible. Si la copie ne peut pas être écrite, le remplacement est refusé. Les copies faites par l’ancienne ouverture de version restent lues.
- **Survol** : curseur main sur ce qui se saisit (meubles, murs, poteaux, espaces, ouvertures), curseur de redimensionnement sur les poignées, contour bleu de l’élément survolé. Le contour vit hors de la scène reconstruite, pour rester fluide.
- **Murs en Plan 2D** : avec la coupe à 1,20 m, un mur ou une ouverture se sélectionne en cliquant sa trace, avec une marge d’environ 7 pixels pour les cloisons fines.
- **Consultation en lecture seule** (👁 Consulter) : la version s’affiche avec un bandeau bleu ; brouillon, historique et sauvegarde locale sont mis en attente et restitués à l’identique. Toute modification, annulation, import, placement ou partage est refusé pendant la consultation. « Modifier une copie » met le vrai brouillon — pas la version consultée — dans la copie de secours.
- **Vignettes et archivage** : chaque version partagée emporte une capture 480 × 300 de la vue, lue par lien signé temporaire. L’administrateur archive ou restaure une version (jamais la référence). Nécessite `supabase/003_team_thumbnails.sql`.
- **Membres de l’équipe** : l’administrateur gère rôles et accès depuis l’onglet Équipe (même migration).
- **Menu Affichage** : grille, cotes, noms, zonage, ambiance, aimantation et contrôles d’implantation quittent la colonne de gauche pour un menu posé sur la maquette (bouton ◐ Affichage). « Contrôles géométriques » est replié par défaut.
- **Clic droit** sur un élément, sans glisser : Propriétés, Cadrer, Tourner de 90°, Verrouiller, Dupliquer, Supprimer selon le type ; seules les actions sans modification restent en consultation. Un clic droit glissé déplace toujours la vue.
- **Variantes et vues** : leur nom se saisit dans le panneau (Entrée pour valider, Échap pour annuler) au lieu d’une fenêtre du navigateur.
- **Poteau noyé dans un mur** : quand le clic touche la face d’un mur et, juste derrière (moins de 60 cm), un poteau, c’est le poteau qui est saisi, même si le mur était sélectionné. Pour déplacer le mur lui-même, cliquez-le à côté du poteau. Les poignées d’extrémité gardent la priorité.
