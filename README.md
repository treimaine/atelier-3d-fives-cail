# Atelier 3D — Hub Créatif Fives Cail

Éditeur d'aménagement 3D du local, dans le navigateur. Une unité du monde vaut un mètre : X et Z au sol, Y en hauteur.

Éditeur statique servi par Vercel, avec authentification et versions partagées privées dans Supabase. Aucun serveur applicatif ni build à déployer. Voir [DEPLOIEMENT.md](DEPLOIEMENT.md) pour le déploiement et l’ajout des associés.

## Travailler dessus

```bash
node editor-assets/preview.cjs
```

Puis <http://127.0.0.1:8766>. Le serveur est limité à la boucle locale.

```bash
node editor-assets/test-editor.cjs
```

110 vérifications automatisées : géométrie, contraintes de murs, collisions, circulation, manipulation, sauvegarde, variantes. **Les lancer avant de pousser** — plusieurs verrouillent des acquis de l'étude, par exemple que la proposition livrée reste parcourable à 0,90 m et que tous les poteaux tiennent dans l'emprise.

Aucune dépendance à installer : three.js et le client Supabase sont embarqués dans `editor-assets/vendor`.

Tests du partage : `node --test editor-assets/test-cloud.cjs`.

## Où se trouve quoi

| Fichier | Rôle |
|---|---|
| `index.html` | La page : mise en page de l'atelier et ordre de chargement des modules |
| `editor-assets/defaults.js` | L'étude de départ : zonage, murs, poteaux, catalogue d'objets |
| `editor-assets/architecture-core.js` | Géométrie pure : polygones, collisions, contraintes. Aucune dépendance au DOM |
| `editor-assets/editor.js` | Validation du projet, rendu three.js, interactions pointeur, imports/exports |
| `editor-assets/architecture-ui.js` | Pièces polygonales, fond de plan calibré, contrôles de dégagement |
| `editor-assets/rooms.js` | Manipulation directe des espaces : déplacement avec le contenu, poignées, quart de tour |
| `editor-assets/manipulation.js` | Pose au curseur, rotation, sélection multiple, groupes |
| `editor-assets/equipment.js` | Face avant, point de pose, supports, variantes de mobilier |
| `editor-assets/building.js` | Emprise, hauteur, poteaux, scission de murs |
| `editor-assets/circulation.js` | Contrôle de circulation sur grille et goulets |
| `editor-assets/project.js` | Sauvegarde IndexedDB, variantes d'implantation, vues, projet partagé |
| `editor-assets/navigation.js` | Caméras et raccourcis clavier |
| `projet.json` | **Le projet partagé** de l'équipe (voir plus bas) |

Les modules partagent une portée globale et se chargent dans l'ordre déclaré par `index.html` : pas de bundler, pas d'étape de build. Modifier un fichier, recharger la page.

## Le projet partagé

Chaque membre se connecte avec son compte. Son brouillon est sauvegardé sur son appareil ; le bouton **Enregistrer une version partagée** crée une proposition datée et consultable par l’équipe, sans écraser les autres versions. L’administrateur choisit la version de référence.

Le module `editor-assets/cloud.js` gère la connexion, l’inscription, les demandes d’accès, les versions et la référence. `editor-assets/workspace.js` gère l’interface autour de la maquette : onglets Sélection / Équipe, bouton de partage, aide et écran de bienvenue. `editor-assets/cloud-config.js` contient uniquement l’URL du projet Supabase et sa clé publique. Les permissions sont appliquées dans Supabase ; les comptes non membres ne peuvent pas lire ni écrire les données.

Les plans et modèles importés sont inclus dans les versions privées (49 Mo maximum par version). Le fichier `projet.json` reste l’étude initiale livrée avec le dépôt, utilisée uniquement lorsqu’aucune référence distante ni copie locale n’existe.

## Déploiement

Vercel, préréglage **Other**, aucune commande de build, aucun répertoire de sortie personnalisé, aucune variable d’environnement. Le projet Supabase est déjà configuré. Voir **[DEPLOIEMENT.md](DEPLOIEMENT.md)** pour les instructions et la gestion des comptes.

## Licences

- Supabase JS 2.116.0 : MIT, `editor-assets/vendor/LICENSE-supabase.txt`.
- three.js r128, chargeur et exportateur glTF : MIT, `editor-assets/vendor/LICENSE-three.txt`.
- Modèles détaillés : Khronos glTF-Sample-Assets, CC0 et CC-BY 4.0 selon le modèle. Auteurs et conditions dans `editor-assets/models/ATTRIBUTIONS.md` et les fichiers `*-LICENSE.md`. Les sources `.glb` ne sont pas versionnées : elles se retéléchargent depuis le dépôt Khronos indiqué dans les attributions.

## Limites assumées

Les cotes du bâtiment sont **estimées** tant qu'un relevé n'a pas été réalisé : emprise en L de 360 m², hauteur de 3,40 m, onze poteaux. Les contrôles de collision portent sur des encombrements orientés, pas sur les maillages. Le contrôle de circulation est indicatif et ne vaut pas vérification d'accessibilité réglementaire. Le guide complet est dans `GUIDE.md`.
