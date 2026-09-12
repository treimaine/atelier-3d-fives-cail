# Atelier 3D — Hub Créatif Fives Cail

Éditeur d'aménagement 3D du local, dans le navigateur. Une unité du monde vaut un mètre : X et Z au sol, Y en hauteur.

Site statique, sans serveur ni base de données. Ouvrir `index.html` suffit ; Vercel sert le dépôt tel quel.

## Travailler dessus

```bash
node editor-assets/preview.cjs
```

Puis <http://127.0.0.1:8766>. Le serveur est limité à la boucle locale.

```bash
node editor-assets/test-editor.cjs
```

110 vérifications automatisées : géométrie, contraintes de murs, collisions, circulation, manipulation, sauvegarde, variantes. **Les lancer avant de pousser** — plusieurs verrouillent des acquis de l'étude, par exemple que la proposition livrée reste parcourable à 0,90 m et que tous les poteaux tiennent dans l'emprise.

Aucune dépendance à installer : three.js est embarqué dans `editor-assets/vendor`.

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

## Le projet partagé, et ce qui est vraiment persistant

À l'ouverture, l'application charge `projet.json` **si le visiteur n'a pas déjà un projet sur son poste**. Ensuite, chaque personne travaille sur sa copie, enregistrée dans le stockage de son navigateur (IndexedDB). Rien ne remonte automatiquement : deux personnes qui aménagent en même temps ne voient pas le travail l'une de l'autre.

Pour qu'une modification devienne celle de l'équipe :

1. Dans l'inspecteur, ouvrir **Projet partagé** et cliquer **Préparer projet.json pour le dépôt**.
2. Remplacer `projet.json` à la racine du dépôt par le fichier téléchargé, puis pousser. Vercel redéploie.
3. Les autres cliquent **Recharger le projet du dépôt** — ou repartent de zéro sur un poste neuf.

L'historique du fichier dans Git tient lieu de suivi des versions ; chaque export incrémente le numéro de révision du projet. Pour un aménagement à plusieurs en simultané, il faudrait un service de stockage partagé et une authentification : ce dépôt n'en a pas, volontairement, et l'URL publique ne doit pas pouvoir être écrasée par n'importe qui.

## Déploiement

Vercel, préréglage **Other**, aucune commande de build, aucun répertoire de sortie, aucune variable d'environnement. `vercel.json` règle les en-têtes de cache et de sécurité. Tout `push` sur la branche par défaut redéploie.

## Licences

- three.js r128, chargeur et exportateur glTF : MIT, `editor-assets/vendor/LICENSE-three.txt`.
- Modèles détaillés : Khronos glTF-Sample-Assets, CC0 et CC-BY 4.0 selon le modèle. Auteurs et conditions dans `editor-assets/models/ATTRIBUTIONS.md` et les fichiers `*-LICENSE.md`. Les sources `.glb` ne sont pas versionnées : elles se retéléchargent depuis le dépôt Khronos indiqué dans les attributions.

## Limites assumées

Les cotes du bâtiment sont **estimées** tant qu'un relevé n'a pas été réalisé : emprise en L de 360 m², hauteur de 3,40 m, onze poteaux. Les contrôles de collision portent sur des encombrements orientés, pas sur les maillages. Le contrôle de circulation est indicatif et ne vaut pas vérification d'accessibilité réglementaire. Le guide complet est dans `GUIDE.md`.
