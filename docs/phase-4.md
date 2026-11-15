# Phase 4 — Outils du prof : compte rendu

15/11/2026.

## Choix appliqués

- **Répartition du temps réel**, comme prévu dans l'architecture :
  - **canaux data LiveKit**, au sein de la salle et à très basse latence : traits en cours, laser, et vue de chacun (verset, page, lecture audio) ;
  - **Supabase**, sous RLS : ce qui doit faire autorité ou être conservé.
    - Diffusé par Realtime : qui « a la main », le crayon autorisé aux élèves, le test « continue le verset » en cours.
    - Enregistré en base : traits terminés, marquages, corrections, validations de versets.
- **Rien n'est cru sur parole**.
  - Chaque message reçu dans la salle est filtré : un élève ne peut ni dessiner sans autorisation, ni effacer les traits des autres, ni se faire passer pour le prof. Règles dans `acceptMessage`, avec tests.
  - La base applique les mêmes règles à ce qu'elle enregistre : le rôle de l'auteur, le statut d'une correction et les élèves concernés sont remplis par la base, jamais par le navigateur.
- **Ancrage au mot partout** (décision de la phase 0). Un trait reste sur les mêmes mots :
  - quels que soient l'écran, le zoom et le reflow ;
  - même si le prof est en mode lecture et l'élève en mode Mushaf (vérifié par le scénario automatique).
- **Chacun garde son mode et son zoom.** La vue partagée synchronise l'endroit du texte (sourate, verset ou page) et la lecture audio, pas l'affichage.

## Ce qui est fait

### Base ([migration](../supabase/migrations/20261116100000_outils_prof.sql))

- **Tables** :
  - `annotations` (traits et marquages) ;
  - `corrections` (sur le mot, avec type d'erreur, règle de tajwid et commentaire) ;
  - `verse_results` (verset validé ou à revoir).
- **Nouvelles colonnes** :
  - salles : `student_pen`, `leader_id` (prise de main), `quiz` ;
  - séance : `show_summary`.
- **Droits** :
  - un élève revoit les annotations faites devant lui et les corrections qui le concernent ;
  - le binôme ne voit que les marquages qu'il a faits ;
  - le prof voit toute sa séance.
  - Une validation met à jour le **statut du verset** (suivi de la phase 2) : « acquis » ou « à revoir ».
- **Fonctions** :
  - `room_board` : tableau de la salle ;
  - `clear_board`, `set_room_pen`, `set_room_leader` ;
  - `start_quiz`, `reveal_quiz`, `end_quiz` : verset tiré parmi ceux que l'élève a travaillés, sinon dans le passage du jour ;
  - `session_error_summary` : erreurs fréquentes, **anonymes** ;
  - `session_recap`, `my_sessions`.
- Quand le prof change de salle, il « rend la main » automatiquement.
- **38 tests pgTAP** de plus ([supabase/tests/tools.test.sql](../supabase/tests/tools.test.sql)), soit **109** au total.

### Dans le lecteur (pendant une séance)

Une barre d'outils s'affiche au-dessus du texte.

- **Prof** :
  - **Vue suivie** : en entrant dans une salle de binôme, le prof suit la vue du premier élève et peut en choisir un autre, ou « Ma vue (libre) ».
  - **Prendre la main / Rendre la main** : les élèves de la salle suivent la sourate, la page et le verset du prof, ainsi que la lecture audio. Chaque élève l'entend sur son appareil.
  - **Crayon** (4 couleurs, 3 épaisseurs), **laser** (s'efface après environ 2 s), **gomme** et **tout effacer**. « Tout effacer » retire les traits et marquages ; les corrections restent.
  - **Marquer des mots** : surligner ou souligner, un mot ou une plage.
  - **Corriger** : toucher le mot fautif ouvre un menu rapide.
    - Type d'erreur : prononciation / makhraj, règle de tajwid (madd, ghunna, qalqala, idgham, ikhfâ', iqlâb, autre), haraka, mot oublié, mot ajouté, blocage de mémoire.
    - Commentaire facultatif.
    - **Verset validé / À revoir**.
    - Le mot passe **en rouge** chez l'élève, y compris en mode Mushaf.
    - En salle principale, l'élève corrigé est par défaut celui qui a la parole (talqîn).
  - **Crayon aux élèves** (désactivé par défaut).
  - **Continue le verset** : l'élève voit les premiers mots (1 à 3) puis « … ». Le prof affiche le verset, en tire un autre ou termine le test.
- **Élève** :
  - bandeau « Ustadh … a la main : vous suivez sa page » ;
  - ses erreurs en rouge ; toucher un mot fautif montre le type d'erreur et le commentaire.
  - **En binôme** : « Marquer les erreurs : [partenaire] ». Ces marquages, soulignés en pointillé orange, attendent la **confirmation du prof**, qui peut aussi les annuler.
  - Crayon et marquage si le prof les autorise. Ses traits sont en pointillé, distincts de ceux du prof.

### Tableau de bord et fin de séance

- **Erreurs fréquentes de la séance** (pour le retour commun) :
  - nombre d'erreurs par type et par règle, mots les plus repris ;
  - **sans nom d'élève** ;
  - bouton **« Afficher à tous »** : la liste apparaît dans le panneau de séance des élèves.
- **Récapitulatif** (`/seance/:id/bilan`), proposé à chacun à la fin de la séance :
  - passages travaillés, versets validés ou à revoir ;
  - corrections reçues, avec le mot en arabe, le type et le commentaire ;
  - bouton **« Revoir sur le texte »** : le lecteur affiche les corrections et les traits du prof, en mode lecture comme en Mushaf ;
  - le prof voit le récapitulatif de chaque élève.
- **« Mes séances »** sur la page Progression de l'élève ; côté prof, les séances terminées mènent au récapitulatif.

### Qualité

- **Scénario Playwright** ([e2e/outils.spec.ts](../e2e/outils.spec.ts)), avec 1 prof et 2 élèves en binôme. Il couvre :
  - vue suivie, prise de main jusqu'à la sourate suivante, crayon (reçu chez l'élève et enregistré), marquage ;
  - correction du prof (rouge chez Amina, pas chez Bilal), marquage du binôme puis confirmation, verset validé ;
  - crayon autorisé à l'élève, test « continue le verset » ;
  - erreurs fréquentes affichées chez tous, récapitulatif, révision sur le texte en mode lecture puis Mushaf.
- Les deux scénarios (phases 3 et 4) passent ensemble.
- **102 tests Vitest**, dont 14 pour les règles des outils.

## Comment tester

En ligne, avec un compte prof et deux comptes élèves (ou en local, cf. [phase-3.md](phase-3.md)) :

1. **Prof** : depuis la page de classe, préparez une séance avec un passage du jour, démarrez-la, puis ouvrez les salles en binôme (Alt+D) et rejoignez la salle.
2. Les élèves rejoignent la séance depuis le bandeau de l'accueil.
3. **Vue suivie** : un élève change de sourate et le prof le suit. Ensuite, **Prendre la main** : les élèves suivent le prof.
4. **Crayon, laser, marquage** : le trait apparaît chez les élèves. Changez le zoom ou passez en mode Mushaf d'un côté seulement : le trait reste sur les mêmes mots.
5. **Corriger** : touchez un mot, puis « Mot oublié ». Le mot passe en rouge chez l'élève. Ensuite, côté élève : « Marquer les erreurs : … » ; le prof touche le mot et le confirme.
6. **Continue le verset** ; puis, au tableau de bord, **Rappeler tout le monde** et **Afficher à tous** dans « Erreurs fréquentes ».
7. **Terminer la séance** : chacun reçoit « Voir mon récapitulatif », puis « Revoir sur le texte ».

## Limites connues

- **Pas encore de devoir** dans le récapitulatif : le plan de la semaine (*sabaq*, *sabqî*, *manzil*) arrive en **phase 5**, avec les devoirs audio et la correction différée horodatée. La table `corrections` est prête à les accueillir.
- **Partage d'écran** : pas fait, la page synchronisée le remplace pour le Coran. À ajouter si le prof en a besoin pour d'autres supports.
- **Marquage par l'élève** : un élève avec le crayon peut marquer des mots, mais le prof seul « efface tout ».
- **« Tout effacer » est définitif** pour les traits et les marquages (ils ne restent pas dans la révision). Les corrections, elles, sont toujours conservées.
- **Récitation détectée automatiquement** : non. Le prof choisit l'élève corrigé (par défaut, celui dont il suit la vue, ou celui qui a la parole).
- **Tests sur appareils réels** : le scénario utilise des navigateurs simulés sur ce PC. Le stylet (Apple Pencil), Safari sur iPad et l'usage à plusieurs sur de vrais réseaux restent à essayer.
