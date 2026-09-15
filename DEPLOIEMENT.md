# Déployer et utiliser l’atelier partagé

## Ce qui est déjà configuré

- Projet Supabase : `xwastzhnnrbzmzgkgbop`.
- Connexion par e-mail et mot de passe. Inscription libre, sans confirmation par e-mail ; chaque nouveau compte reste sans accès jusqu’à validation par un administrateur.
- Tables des membres, versions et référence avec permissions côté base de données.
- Stockage privé `atelier-versions`. Les fichiers partagés ne sont pas publics.
- Compte administrateur créé et rattaché à l’atelier.
- URL Supabase et clé **publique** dans `editor-assets/cloud-config.js`.

Il n’y a aucune clé secrète à ajouter à Vercel. Ne mettez jamais une clé `service_role` ou `sb_secret_…` dans le site.

## Déployer sur Vercel

1. Importer le dépôt GitHub `treimaine/atelier-3d-fives-cail`.
2. Choisir **Other** comme Framework Preset.
3. Laisser la racine du dépôt comme Root Directory.
4. Ne définir aucune commande de build, commande d’installation ou répertoire de sortie personnalisé.
5. Aucune variable d’environnement n’est nécessaire : le client utilise la configuration publique versionnée.
6. Déployer, puis ouvrir l’URL et se connecter avec le compte de l’atelier.

La connexion par mot de passe ne nécessite pas de redirection e-mail ni de domaine Vercel connu à l’avance. Un futur changement vers des invitations ou liens de connexion demanderait de configurer l’envoi d’e-mails et les URL dans Supabase.

## Ajouter un associé

Chaque associé crée lui-même son compte :

1. Lui communiquer l’URL du site.
2. Sur l’écran de connexion, il clique sur **Créer un compte**, saisit son nom, son adresse e-mail et un mot de passe d’au moins 8 caractères.
3. Son compte est créé mais **n’a accès à rien** : il voit le message « demande en attente ».
4. Vous vous connectez : l’onglet **Équipe** (colonne de droite) s’ouvre avec un compteur rouge et la section **Demandes d’accès en attente** en haut (bouton **↻ Actualiser** pour la rafraîchir). Cliquez sur **Accepter** ou **Refuser**.
5. L’associé clique sur **Vérifier à nouveau** et entre dans l’atelier.

**Vérifiez l’adresse avant d’accepter.** Sans service d’e-mails, Supabase ne peut pas prouver que la personne possède l’adresse saisie : n’importe qui disposant de l’URL peut créer un compte avec un nom et une adresse de son choix. Acceptez uniquement une demande que votre associé vous a confirmée de vive voix ou par message. Une demande refusée n’est pas renvoyée depuis le site.

Réglages Supabase nécessaires (Authentication → Sign In / Providers) : **Allow new users to sign up** activé, **Confirm email** désactivé, et migration `supabase/002_self_signup.sql` exécutée une fois.

### Ajout manuel (secours)

Dans [Supabase Authentication / Users](https://supabase.com/dashboard/project/xwastzhnnrbzmzgkgbop/auth/users) :

1. **Add user → Create new user**.
2. Saisir son adresse e-mail, définir un mot de passe et laisser **Auto confirm user** coché. Cette méthode n’envoie aucun e-mail. Le compte apparaît aussi dans les demandes d’accès de l’atelier : l’accepter suffit.
3. Ou, dans le [SQL Editor](https://supabase.com/dashboard/project/xwastzhnnrbzmzgkgbop/sql), exécuter le bloc ci-dessous après avoir remplacé l’adresse et le nom. Doubler toute apostrophe SQL dans le nom (`L''Atelier`).

```sql
insert into public.atelier_members (user_id, display_name, role)
select id, 'Prénom de votre associé', 'member'
from auth.users
where lower(email) = lower('adresse-de-votre-associe@example.com')
on conflict (user_id) do update
set display_name = excluded.display_name, active = true
returning display_name, role, active;
```

Le résultat doit afficher une ligne. Zéro ligne signifie que l’adresse n’a pas été trouvée parmi les comptes créés. Un compte Auth seul n’a aucun accès aux versions : il doit aussi figurer dans `atelier_members`.

Communiquer vous-même l’URL et les identifiants à l’associé. Il utilise le même écran de connexion que l’administrateur. Le rôle `member` permet de lire et créer des versions ; le rôle `admin` permet en plus de choisir la référence.

Pour retirer l’accès, passer `active` à `false` pour ce membre dans le Table Editor. Les copies qu’il avait déjà téléchargées sur son appareil restent sur cet appareil.

## Travailler ensemble

La colonne de droite a deux onglets : **Sélection** (propriétés de l’élément cliqué, ouvert automatiquement à chaque sélection) et **Équipe** (versions partagées et demandes d’accès). Le bouton **? Aide** (ou la touche `?`) ouvre le mode d’emploi et les raccourcis ; un écran de bienvenue s’affiche à la première connexion de chaque compte.

- **Brouillon local** : chaque compte a sa propre sauvegarde dans le navigateur. Les mouvements d’objets ne sont pas partagés automatiquement.
- **⇪ Partager une version** (en-tête) : ouvre l’onglet Équipe sur le formulaire. Donner un titre, éventuellement un commentaire, puis **Partager cette version**. Cela crée une nouvelle version datée, attribuée à votre compte.
- **↻ Actualiser** : récupérer les dernières propositions et demandes. Les versions s’affichent par pages de 20.
- **Ouvrir** : charger une copie d’une proposition pour la consulter ou la modifier. Le brouillon précédent est mis de côté dans une copie de secours locale avant remplacement.
- **Retrouver mon travail d’avant la dernière ouverture** : revenir à cette copie de secours. Un seul emplacement de secours est conservé par compte et appareil.
- **Définir comme référence** : action administrateur. Un nouvel appareil part de cette version. Les personnes ayant un brouillon le conservent et peuvent cliquer sur **Ouvrir la version de référence**.
- **Exporter le projet .json** : désormais dans la colonne de gauche, section **Fichiers & exports**.

Les versions enregistrées ne sont ni modifiées ni supprimées par l’application. Deux enregistrements simultanés créent deux versions. Un changement concurrent de référence est refusé et demande une actualisation.

Une version inclut le bâti, les objets, variantes, vues, plans images et modèles importés. Les modèles intégrés au catalogue utilisent les fichiers du site. Limite : **49 Mo par version**, pour respecter la limite de stockage configurée. Les exports JSON locaux gardent leur fonctionnement.

## Retrouver un ancien travail local

L’ouverture en `file://`, l’aperçu local et le site Vercel ont des stockages de navigateur différents. Exporter le travail depuis l’ancienne page en `.json`, puis l’importer dans le site connecté et enregistrer une version partagée. Les anciens brouillons ne sont pas supprimés.

## Exploitation et limites

- Le service d’e-mails Supabase n’est pas requis pour ce fonctionnement. En cas d’oubli du mot de passe, l’administrateur doit le réinitialiser via Supabase ; aucun bouton de récupération par e-mail n’est proposé sans SMTP configuré.
- Internet est nécessaire pour se connecter et pour lire ou enregistrer une version partagée. Une session ouverte peut continuer à modifier son brouillon lors d’une coupure.
- Un enregistrement interrompu peut laisser un fichier sans ligne de version dans le bucket. Un nouvel essai dans le même onglet reprend le même enregistrement sans écrasement. Les fichiers orphelins éventuels peuvent être inspectés par l’administrateur dans Supabase ; aucune suppression automatique n’est effectuée.
- Surveiller les quotas Supabase, notamment le stockage des modèles importés répété dans chaque version. L’historique applicatif ne remplace pas une sauvegarde indépendante : exporter périodiquement les projets importants.
- Les données ajoutées dans Supabase sont privées. Les fichiers statiques présents dans le dépôt et servis par Vercel, dont l’étude initiale `projet.json` et les données de départ du code, restent téléchargeables : l’écran de connexion ne transforme pas des fichiers statiques en fichiers privés. Ne pas publier de nouveaux plans confidentiels dans le dépôt ; les partager depuis l’application.

## Vérifications techniques

```text
node editor-assets/test-editor.cjs
node --test editor-assets/test-cloud.cjs
node editor-assets/preview.cjs
```

Le schéma est conservé dans `supabase/001_shared_projects.sql` puis `supabase/002_self_signup.sql` pour reproduire la configuration dans un projet neuf : ne pas les rejouer dans le projet déjà configuré. `supabase/test_permissions.sql` et `supabase/test_signup.sql` testent les droits dans une transaction annulée, sans conserver les utilisateurs ou fichiers de test.

Le SDK Supabase 2.116.0 est embarqué dans `editor-assets/vendor`, sous licence MIT. Aucun outil de build ni installation npm n’est nécessaire pour déployer.
