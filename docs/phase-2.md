# Phase 2 — Comptes et classes : compte rendu

13/11/2026. Le lecteur reste utilisable sans compte. Les comptes ajoutent les classes, la progression par verset et les notes du professeur.

## Choix appliqués

- **Connexion par e-mail + mot de passe**, pas par lien magique. Le service d'e-mails fourni par Supabase n'écrit qu'aux membres de l'équipe du projet, et 2 e-mails par heure au maximum : un lien magique n'arriverait pas chez les élèves. Le lien magique redeviendra possible avec un service d'envoi (Brevo, Resend…) branché sur Supabase.
- **Inscription uniquement sur invitation**, contrôlée **dans la base** : un déclencheur refuse toute création de compte sans code valide. Même un appel direct à l'API sans passer par le site est bloqué.
  - **Code de classe** (`/rejoindre/CODE`) → compte élève, ajouté à la classe.
  - **Invitation nominative de l'admin**, à usage unique, valable 14 jours → compte professeur ou admin.
- **Pas de confirmation par e-mail** à l'inscription, pour la même raison d'envoi d'e-mails. Contrepartie : l'adresse n'est pas vérifiée, mais il faut un code d'invitation pour s'inscrire.
- **Région Europe** prévue pour le projet hébergé (RGPD).

## Ce qui est fait

### Base de données ([supabase/migrations](../supabase/migrations/20261113120000_comptes_et_classes.sql))

Tables :
- `profiles` : nom affiché, rôle élève / prof / admin ;
- `classes` : code d'invitation ouvrable et fermable ;
- `class_members` ;
- `staff_invitations` ;
- `teacher_notes` : une note par verset et par prof ;
- `verse_progress` : nouveau / en cours / acquis / à revoir, avec date de dernière révision et auteur de la mise à jour.

**RLS sur toutes les tables**, et aucun accès sans compte :
- un élève voit son profil, ses classes, ses camarades (le nom seulement), son professeur, sa progression et les notes de ses professeurs ;
- un prof voit ses classes, ses élèves et leur progression, et rien des autres classes ;
- seul un prof marque un verset « acquis ». L'élève peut indiquer « en cours » ou « à revoir » ;
- personne ne peut changer son propre rôle (droits par colonne) : seul l'admin le peut ;
- l'admin voit la liste des comptes avec leur e-mail (les profs ne voient jamais les e-mails).

**Fonctions** :
- `check_invite` : vérifier un code sans compte ;
- `join_class` ;
- `regenerate_invite_code` ;
- `admin_list_users` ;
- `admin_set_role` ;
- `delete_my_account` : RGPD, suppression en cascade.

**44 tests pgTAP** ([supabase/tests/rls.test.sql](../supabase/tests/rls.test.sql)) vérifient :
- les inscriptions : code valide, expiré, réutilisé, absent ;
- chaque cloisonnement entre élèves, profs et admin ;
- les tentatives de contournement : changer son rôle, s'ajouter à une classe sans code, se marquer « acquis », écrire au nom d'un autre prof.

### Écrans

| Adresse | Pour qui | Contenu |
|---|---|---|
| `/rejoindre/CODE` | invité | classe et prof qui invitent, création du compte (nom, e-mail, mot de passe, « je suis majeur(e) ») ; si déjà connecté : rejoindre la classe |
| `/connexion` | tous | connexion, mot de passe oublié |
| `/compte` | connecté | nom, mes classes (quitter, rejoindre avec un code), mot de passe, déconnexion, suppression du compte |
| `/progression` | élève | carte de progression (Juz 'Amma de 114 à 78, ou tout le Coran) ; toucher une sourate → ses versets, statut par verset ou par plage |
| `/prof` | prof | ses classes, créer une classe |
| `/prof/classe/:id` | prof | lien d'invitation (partager, copier, nouveau code, ouvrir ou fermer), élèves, renommer, supprimer |
| `/prof/eleve/:id` | prof | progression de l'élève, validation des versets |
| `/admin` | admin | invitations de professeurs, comptes et rôles |
| `/confidentialite` | tous | données stockées, accès, droits |

**Dans le lecteur** (panneau traduction / tafsir) :
- un onglet **« Notes du prof »** : le prof écrit sa note pour le verset, l'élève lit celles de ses professeurs ;
- pour l'élève, son **statut sur le verset** affiché.

### Qualité

- 80 tests Vitest (logique des statuts, codes d'invitation) et 44 tests pgTAP.
- Testé dans Chrome sur la base locale, sur ordinateur et au format téléphone : inscription par lien, connexion, statut depuis le lecteur, validation par le prof, note du prof vue par l'élève, invitation de prof par l'admin.
- Deux bugs trouvés pendant ces tests et corrigés :
  - l'enregistrement d'un statut était refusé par la base (droit manquant pour l'upsert) : un test le couvre maintenant ;
  - les boutons des menus déroulants ne transmettaient pas leur position (avertissement React 18) : les popovers sont maintenant bien ancrés.

## Développement local

```bash
npm run db:start      # Supabase local (Docker), avec les comptes de démonstration de supabase/seed.sql
npm run dev
npm run test:db       # tests RLS
```

Comptes de démonstration (mot de passe `halaqa-demo`) :
- `admin@halaqa.test`
- `prof@halaqa.test`
- `eleve1@halaqa.test` à `eleve5@halaqa.test`

Lien d'invitation de la classe de démo : `/rejoindre/DEMYCXRS23`.

## Mise en ligne de la base

**Bloquée** : le compte Supabase a atteint la limite de **2 projets gratuits actifs** (eurofret-dev et eurofret-prod). Une organisation vide « Halaqa » a été créée ; la création du projet a été refusée sans frais.

Une fois le projet créé, la mise en ligne prend quelques commandes :
1. `supabase link` ;
2. `supabase db push` : schéma et RLS ;
3. `supabase config push` : adresses de redirection, mot de passe de 8 caractères minimum, pas de confirmation par e-mail ;
4. variables du dépôt GitHub `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` ;
5. une invitation admin à usage unique pour créer ton compte.

## Limites connues

- **Mot de passe oublié** : l'e-mail de réinitialisation n'arrivera qu'aux membres de l'équipe Supabase tant qu'aucun service d'envoi n'est branché. En attendant, l'admin peut changer le rôle d'un compte, mais pas son mot de passe.
- Les statuts se changent à la main, par le prof (validation) ou par l'élève. Les mises à jour automatiques par les corrections arriveront avec la phase 4.
- Pas de temps réel : une note ou un statut modifié apparaît chez l'autre au prochain chargement de la page.
