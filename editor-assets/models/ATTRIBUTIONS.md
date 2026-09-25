# Attributions des modèles intégrés

## SheenChair

- Auteur : Eric Chadwick, Wayfair LLC, 2020.
- Modèle : CC0-1.0. Métadonnées : CC-BY-4.0.
- Source : https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SheenChair
- Licence fournie : `SheenChair-LICENSE.md`.
- Adaptation locale : suppression de 15 propriétés `KHR_texture_transform.texCoord` redondantes avec le canal déjà porté par l’objet texture. Ni la géométrie ni les images ne sont modifiées. La version adaptée est `SheenChair-compatible.glb`, embarquée dans `chair.js`. Le fichier `SheenChair.glb` est l’original téléchargé.
- Le modèle ne représente pas une référence commerciale réelle. Les matériaux avancés de sheen sont interprétés par three.js depuis la r186 de l’atelier.

## SheenWoodLeatherSofa

- Original : Fran Calvente, Poly Haven, 2021, CC0-1.0 (`sofa_03`).
- Améliorations : Eric Chadwick, Darmstadt Graphics Group GmbH, 2024, CC-BY-4.0.
- Source : https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SheenWoodLeatherSofa
- Licence fournie : `SheenWoodLeatherSofa-LICENSE.md`.
- Binaire source non modifié ; embarqué en base64 dans `sofa.js` pour le chargement local sans serveur.
- Les matériaux avancés de sheen/specular sont interprétés par three.js depuis la r186 de l’atelier.

Les attributions sont reprises dans les données des assets et dans l’inspecteur. Les licences n’accordent pas de droits sur les logos ou marques associés.


## Catalogue ajouté le 12 septembre 2026

### ChairDamaskPurplegold

Source : https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/ChairDamaskPurplegold

- Eric Chadwick — Models and Textures — CC-BY-4.0 (https://creativecommons.org/licenses/by/4.0/legalcode)

### GlamVelvetSofa

Source : https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/GlamVelvetSofa

- Eric Chadwick — Everything — CC-BY-4.0 (https://creativecommons.org/licenses/by/4.0/legalcode)

### SpecularSilkPouf

Source : https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SpecularSilkPouf

- Eric Chadwick — Everything — CC-BY-4.0 (https://creativecommons.org/licenses/by/4.0/legalcode)

### CommercialRefrigerator

Source : https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CommercialRefrigerator

- Eric Chadwick — Model and textures and all images in the README.md — CC-BY-4.0 (https://creativecommons.org/licenses/by/4.0/legalcode)
- Sean Thomas — This work is based on 'Commercial Fridge' (https://sketchfab.com/3d-models/commercial-fridge-2174e1e4f1f24f1a95aa110ee060f473) by Sean Thomas (https://sketchfab.com/foon.) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/) — CC-BY-4.0 (https://creativecommons.org/licenses/by/4.0/legalcode)

### DiffuseTransmissionPlant

Source : https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/DiffuseTransmissionPlant

- Eric Chadwick — Materials and animation — CC-BY-4.0 (https://creativecommons.org/licenses/by/4.0/legalcode)
- Rico Cilliers — Original asset — CC0-1.0 (https://creativecommons.org/publicdomain/zero/1.0/legalcode)

Les binaires originaux sont conservés. Les scripts locaux contiennent les mêmes modèles, avec suppression des indications UV redondantes pour GlamVelvetSofa. Le moteur affiche les matériaux PBR de base ; sheen, specular et diffuse transmission ne sont pas tous pris en charge dans cette version. Les animations et variantes de matériaux ne sont pas activées.
