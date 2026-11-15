# Phase 3 — Séance en direct : compte rendu

15/11/2026.

## Choix appliqués

- **Répartition du temps réel** (celle de l'architecture) :
  - l'état de la séance est en base (Supabase) et diffusé par **Supabase Realtime** : plan et minuteur, salles, parole, main levée, annonces, rappel ;
  - la **visio** passe par **LiveKit**.
- **Jetons et parole côté serveur**, par deux Edge Functions :
  - `livekit-token` : donne un jeton **pour la salle que la base a attribuée** ; le navigateur ne choisit pas sa salle ;
  - `livekit-moderation` : pendant le talqîn, retire le droit de publier aux élèves qui n'ont pas la parole, puis le rend. Un élève ne peut donc pas parler par-dessus, même avec un navigateur modifié.
- **La visio vit dans un panneau** monté au-dessus de toutes les pages. L'élève navigue librement dans le lecteur pendant la séance, et changer de salle ne fait perdre ni la page ni la position de lecture.
- Le panneau **ne recouvre jamais le texte** :
  - sur grand écran, il se place à gauche et la page lui réserve sa largeur ;
  - sur téléphone, il démarre replié.

## Ce qui est fait

### Base ([migration](../supabase/migrations/20261115100000_seances_en_direct.sql))

- Tables :
  - `live_sessions` : plan JSON, étape en cours et début du minuteur, passage du jour, règle de la semaine, élève qui a la parole, verset surligné, mode des salles ;
  - `live_rooms` ;
  - `live_participants` : salle, activité, main levée, verset en cours, signe de vie ;
  - `live_announcements`.
- Une seule séance en cours par classe.
- **Fonctions qui vérifient les droits** : démarrer et terminer, rejoindre, étape suivante, ouvrir les salles (assignées ou en libre choix, avec capacité), déplacer, choisir sa salle, fermer une salle, rappel général, donner la parole, état complet de la séance.
- Les élèves ne modifient que leurs propres indicateurs (main levée, verset, signe de vie), par droits par colonne. Ils ne changent jamais de salle directement.
- **27 tests pgTAP** de plus ([supabase/tests/live.test.sql](../supabase/tests/live.test.sql)), soit 71 au total.

### Écrans

- **Page de classe → Séances en direct** : préparer une séance, voir les précédentes.
- **Plan de séance** (`/prof/seance/:id`) :
  - titre, passage du jour, règle de tajwid de la semaine, notes ;
  - étapes avec durées : ajouter, réordonner, retirer. Le déroulé de la section 4 de la spécification est proposé par défaut : 5 + 10 + 30 + 10 + 5 min ;
  - « Démarrer la séance ».
- **Accueil des élèves** : bandeau rouge « Séance en cours : … — Rejoindre ».
- **Entrée** (`/seance/:id`) : micro, caméra, **audio seul** (aucune vidéo reçue ni envoyée). On arrive ensuite directement sur le passage du jour.
- **Panneau de séance** :
  - salle actuelle et minuteur de l'étape ;
  - vignettes avec indicateur « parle », micro coupé, main levée, qualité de connexion ;
  - mise en avant de l'élève qui a la parole ;
  - boutons micro, caméra, main levée, quitter ;
  - en mode « libre choix » : la liste des salles avec leur occupation ;
  - un bouton « Verset du prof — y aller ».
- **Tableau de bord du prof** (bouton du panneau ou **Alt+D**, accessible depuis n'importe quelle salle) :
  - **mains levées**, avec « y aller » et « baisser » ;
  - **plan et minuteur** : étape précédente ou suivante. Revenir à une étape en salle principale **rappelle tout le monde** ; l'étape « Travail en salles » **propose d'ouvrir les salles** ;
  - **talqîn** : donner la parole à un élève (ou au hasard), la rendre, **surligner chez tous** le verset où est le prof ;
  - **salles** :
    - ouverture en binômes (un élève restant forme un trio) ou en salles individuelles ;
    - répartition **au hasard** modifiable par **glisser-déposer** (avec un menu pour les tablettes), ou **libre choix** ;
    - une carte par salle : présents, verset en cours, état (main levée, récite, écoute, calme), « visitée il y a X min » ;
    - actions : rejoindre, déplacer un élève, fermer la salle ;
  - **annonce à toutes les salles** (bandeau en haut de l'écran des élèves) et **rappel général** ;
  - terminer la séance.
- Dans le lecteur : le verset choisi par le prof est **surligné en jaune chez tous**, et chaque élève signale au tableau de bord le verset où il se trouve.

### Qualité

- **Scénario Playwright 1 prof + 2 élèves** ([e2e/seance.spec.ts](../e2e/seance.spec.ts)), avec micro et caméra simulés. Il couvre :
  - préparation et démarrage, bandeau et entrée des élèves ;
  - talqîn (micro de l'autre élève coupé par le serveur, puis rendu) ;
  - main levée, ouverture d'une salle en binôme, passage du prof ;
  - annonce, rappel général, fin de séance.
- **Bascule de salle mesurée entre 0,6 et 1,2 s**, pour une cible de moins de 2 s.
- 88 tests Vitest (dont plan, minuteur et répartition aléatoire), 71 tests pgTAP.

## Lancer en local

```bash
npm run db:start          # Supabase local, avec Realtime et les fonctions
npm run livekit:dev       # serveur LiveKit de développement (Docker, clés devkey/secret)
cp supabase/functions/.env.example supabase/functions/.env
npm run functions:serve   # fonctions livekit-token / livekit-moderation
npm run dev
npm run test:e2e          # scénario 1 prof + 2 élèves
```

## En ligne

- Le serveur de ce PC fait maintenant aussi tourner **Realtime** et les **fonctions** : 6 services, voir [serveur.md](serveur.md).
- **La visio tourne aussi sur ce PC** : LiveKit natif Windows, signalisation par un second tunnel, vidéo en UDP par traversée de NAT. Il n'y a ni compte ni port ouvert sur la box ; détails et limites dans [serveur.md](serveur.md#visio-livekit-sur-ce-pc).
- Vérifié le 15/11/2026 :
  - depuis une machine GitHub (réseau extérieur), vidéo et son reçus en environ 2 s, en UDP ;
  - le scénario 1 prof + 2 élèves passe sur ce LiveKit de production, avec une bascule de salle en 1,1 s.

## Limites connues

- Pas encore d'**indicateur de qualité réseau détaillé** ni de choix du périphérique (micro, caméra) en cours de séance : ce sont ceux du navigateur.
- « Couper automatiquement le micro de l'élève pendant la lecture du récitateur » (option de la section 5.2) n'est pas fait.
- Le partage d'écran et la page synchronisée (« vue partagée ») arrivent en **phase 4**, avec le crayon et les corrections.
- Safari (iPhone) n'est toujours pas testé.
