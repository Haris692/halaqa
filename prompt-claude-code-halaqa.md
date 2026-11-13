# Prompt Claude Code — « Halaqa » : plateforme d'apprentissage du Coran en ligne

> Nom de code provisoire : **Halaqa** (le cercle d'étude). À remplacer si besoin.

## Ton rôle

Tu es lead développeur full-stack sur ce projet. Tu vas construire une plateforme web de cours de Coran en direct : un professeur fait cours à ses élèves dans une salle commune, puis les répartit dans des salles secondaires où chaque élève lit, écoute et récite. Le professeur passe de salle en salle pour faire réciter, corriger et annoter le texte en temps réel. Entre deux séances, les élèves travaillent seuls sur la plateforme et rendent des devoirs audio que le prof corrige.

Règles de travail :
- Travaille **phase par phase** (section 12). À la fin de chaque phase : résumé de ce qui est fait, comment le tester, ce qui reste, puis **attends ma validation** avant la phase suivante.
- Commence par lire toute cette spec, puis propose-moi l'arborescence du projet et la liste des choix techniques que tu n'as pas pu trancher, avant d'écrire du code.
- TypeScript strict, composants petits, pas de logique métier dans les composants d'UI.
- Interface 100 % en français, texte coranique en arabe. Prévois l'i18n (fichiers de traduction) pour ajouter l'anglais plus tard.
- Avant d'utiliser une API ou un jeu de données externe, vérifie sa documentation actuelle et sa licence ; ne te fie pas à ta mémoire.
- Tiens à jour un `README.md` (installation, variables d'environnement, déploiement) et un `CREDITS.md` (sources coraniques, récitateurs, polices, licences).

## 1. Vision et contexte de lancement

Tout se passe à l'intérieur de la plateforme : visio, Coran, audio, tafsir, outils du prof, travail entre les séances. L'élève n'a besoin que d'un navigateur (ordinateur, tablette ou téléphone).

Contexte de lancement — dimensionne le MVP pour ça, sans sur-ingénierie :
- un professeur, **un groupe de 5 adultes**, **une séance en direct par semaine** ;
- public **adulte uniquement** pour l'instant (pas de mineurs, pas d'espace parents) ;
- conséquence clé : avec une seule séance par semaine, **l'essentiel des progrès se fait entre les séances**. Le travail autonome (plan de révision, devoirs audio corrigés en différé) est aussi important que le live.

## 2. Rôles

- **Professeur** : crée sa classe, invite des élèves, prépare et anime les séances, gère les salles, fait réciter, corrige, annote, fixe et corrige les devoirs.
- **Élève** : rejoint les séances, travaille seul ou en binôme, voit en direct les annotations et corrections du prof, suit son plan de la semaine, rend ses devoirs audio.
- **Admin** (moi) : gestion des comptes professeurs. Interface minimale.

## 3. Pédagogie

La plateforme doit servir une méthode, pas seulement afficher un Coran. Principes à respecter dans les choix de conception :
- **Talaqqî** : la récitation s'apprend de la bouche d'un professeur. Le récitateur enregistré sert de modèle, mais c'est la correction du prof qui fait progresser.
- **Sabaq / sabqî / manzil** (méthode classique du hifz) : une portion nouvelle (*sabaq*), la révision des portions récentes (*sabqî*) et la révision des portions anciennes (*manzil*). Ce triptyque structure le plan de travail de chaque élève.
- **Écouter → lire → réciter de mémoire** : écoute répétée avec le texte, lecture à voix haute, puis récitation avec un texte masqué progressivement.
- **Une règle de tajwid par semaine** : mise en avant dans le texte, observée chez le récitateur, puis exigée en récitation.
- **Comprendre ce qu'on mémorise** : chaque séance commence par le sens d'un passage de la sourate travaillée.
- **Contraintes de la visio** :
  - la latence rend la récitation en chœur impossible : une seule voix à la fois, les autres répètent micro coupé ;
  - le temps du prof est la ressource rare (5 élèves sur 30 min de salles ≈ 6 min chacun) : les binômes et les devoirs corrigés en différé démultiplient sa présence.

## 4. Déroulé d'une séance

Durées indicatives pour 1 h, réglables. La plateforme propose ce déroulé comme **plan de séance** (étapes + minuteur) que le prof peut préparer à l'avance et modifier.

1. **Ouverture (≈ 5 min) — salle principale** : tout le monde arrive dans la salle commune (visio). Le prof donne l'objectif du jour et explique le sens d'un passage ; il peut afficher chez tous les élèves une page du Coran synchronisée sur la sienne, ou partager son écran.
2. **Talqîn (≈ 10 min) — salle principale** : le prof récite un verset, puis « donne la parole » à un élève (choisi ou tiré au sort) qui le répète. Les autres micros sont coupés automatiquement, l'élève désigné est mis en avant, le verset en cours est surligné chez tout le monde.
3. **Travail en salles (≈ 30 min)** : le prof ouvre les salles — par défaut des **binômes** (un élève récite, l'autre suit le texte et marque les erreurs, puis on inverse), ou des salles individuelles. Modes : *libre choix* (liste des salles avec leur occupation) ou *assignation* (glisser-déposer + « répartir au hasard »). Chaque élève arrive directement sur le lecteur Coran. Le prof passe de salle en salle pour faire réciter, corriger, annoter. Un élève peut « lever la main » ; le prof peut envoyer une annonce à toutes les salles.
4. **Retour commun (≈ 10 min) — salle principale** : le prof rappelle tout le monde (bascule automatique). Il affiche les **erreurs les plus fréquentes relevées pendant les salles** (agrégées automatiquement à partir des corrections) et fait une mini-leçon dessus ; 1 ou 2 élèves récitent devant le groupe.
5. **Devoir (≈ 5 min)** : le prof fixe le plan de la semaine de chaque élève (5.8). Clôture de la séance ; chaque élève reçoit son récapitulatif (passages travaillés, corrections reçues, devoir).

## 5. Fonctionnalités

### 5.1 Lecteur Coran
- Sélecteur de sourate : les 114, recherche par numéro, nom arabe, nom français, translittération ; navigation aussi par juz / hizb / page.
- Écriture uthmanique (Hafs), police QPC/KFGQPC adaptée, **grande taille par défaut**, réglage de taille (curseur + pinch sur mobile), contraste élevé, mode nuit.
- Deux modes d'affichage :
  - **Mode Mushaf** : pages fixes type Mushaf de Médine (604 pages, 15 lignes) si les données de mise en page sont disponibles.
  - **Mode lecture** : verset par verset, texte qui se reflow — idéal sur téléphone et en très grande taille.
- Numéros de versets en chiffres arabes dans les ornements habituels.
- Coloration tajwid activable (si un jeu de données fiable existe), avec possibilité de ne colorer que **la règle de la semaine**.
- Le texte coranique n'est **jamais** modifié, reconstruit ou généré : il vient tel quel d'une source reconnue.

### 5.2 Écoute avec surlignage synchronisé
- Bouton Play : un récitateur (liste au choix ; par défaut, un récitateur pédagogique type Al-Husary *mu'allim* s'il existe avec données de minutage) récite. Le **verset en cours est surligné en jaune**, le **mot en cours** en jaune plus soutenu.
- Niveau de surlignage réglable : verset / mot / **lettre** (voir 8.1).
- Contrôles : vitesse (0,5× à 1,25×), répéter un verset N fois, boucle sur une plage de versets, pause automatique après chaque verset pour que l'élève répète (durée réglable ou « attendre mon clic »), toucher un mot = l'écouter seul.
- L'audio du récitateur est joué localement sur l'appareil de l'élève (pas diffusé dans la visio). Option : couper automatiquement le micro de l'élève pendant la lecture du récitateur.

### 5.3 Mémorisation
- **Masquage progressif** du texte, par niveaux : texte complet → mots estompés → **première lettre de chaque mot seulement** → texte entièrement masqué. Toucher un mot masqué le révèle un instant.
- **Test « continue le verset »** : le prof (en live) ou l'élève (seul) tire un verset au hasard dans les sourates déjà apprises ; l'élève poursuit de mémoire, puis le texte s'affiche pour vérifier.
- **Mode entraînement** solo qui enchaîne les trois étapes sur une portion : écoute ×N → lecture → récitation masquée.

### 5.4 Tafsir et traduction
- Panneau latéral repliable (en bas sur mobile), synchronisé avec le verset sélectionné ou en cours de lecture.
- Onglets : traduction française du sens ; tafsir (selon les sources disponibles et leur licence : en français si possible, sinon un tafsir arabe simple type al-Muyassar) ; **notes du professeur** (ses propres explications par verset, visibles par ses élèves — ça compense le manque de tafsirs français réutilisables).
- Sources multiples sélectionnables ; la source est affichée sous chaque texte.

### 5.5 Visio / audio
- Salle principale et salles secondaires en WebRTC via LiveKit.
- Caméra et micro au choix de l'élève ; mode audio seul pour les connexions faibles.
- **Donner la parole** (talqîn) : le prof désigne qui parle (ou tire au sort), coupe et rétablit les micros.
- Indicateur « parle » sur les vignettes, indicateur de qualité de connexion.
- Les séances en direct ne sont pas enregistrées.

### 5.6 Outils du professeur dans une salle
- **Vue partagée** : en entrant, le prof voit la vue de l'élève. Bouton « prendre la main » : le prof pilote (sourate, page, lecture) et l'élève suit ; « rendre la main » pour revenir. En binôme, le prof choisit quelle vue suivre, ou synchronise toute la salle sur la sienne.
- **Crayon** : le prof dessine / souligne / entoure sur le Coran, l'élève voit le trait apparaître en direct. Couleurs (rouge, vert, bleu, jaune), épaisseur, gomme, « tout effacer ». Mode **pointeur laser** (trait éphémère qui s'efface après ~2 s).
- **Marquage de mots** : le prof touche un mot ou sélectionne une plage de mots pour le surligner / souligner. Ancré au mot, donc parfaitement aligné quels que soient l'écran et le zoom (8.2).
- Le prof peut autoriser le crayon à l'élève (désactivé par défaut).
- **Correction de récitation** : pendant que l'élève récite, le prof touche le mot fautif → menu rapide du type d'erreur (prononciation / makhraj ; règle de tajwid — madd, ghunna, qalqala, idgham… ; haraka ; mot oublié ; mot ajouté ; blocage de mémoire) + commentaire facultatif. Le mot passe en rouge chez l'élève. Boutons « verset validé » / « à revoir ».
- **En binôme**, l'élève qui écoute peut aussi marquer les erreurs de son partenaire (marquages visuellement distincts de ceux du prof, et que le prof peut confirmer ou annuler).
- Annotations et corrections sont persistées par séance et par élève ; l'élève peut les revoir après la séance.

### 5.7 Tableau de bord des salles (prof)
- Grille de cartes, une par salle : élèves présents, sourate / verset en cours, état (écoute, récite, inactif, main levée), temps écoulé depuis la dernière visite du prof.
- Actions : rejoindre, déplacer un élève, fermer une salle, annonce à toutes les salles, rappeler tout le monde.
- Accessible en permanence (raccourci clavier + bouton flottant), même quand le prof est dans une salle.

### 5.8 Entre les séances
- **Plan de la semaine** par élève, fixé par le prof en fin de séance : *sabaq* (portion nouvelle), *sabqî* (révisions récentes), *manzil* (révisions anciennes). La plateforme propose automatiquement les révisions *manzil* par une répétition espacée simple (les versets « à revoir » ou non révisés depuis longtemps remontent en priorité) ; le prof ajuste.
- Le plan est découpé en petites sessions quotidiennes avec case « fait » ; l'élève voit ce qu'il lui reste et lance chaque session en un clic (mode entraînement 5.3).
- **Devoirs audio** : l'élève s'enregistre en récitant la portion demandée, directement dans le lecteur (texte affiché ou masqué selon la consigne du prof), et l'envoie.
- **Correction en différé avec le même outil qu'en live** : le prof écoute l'enregistrement et touche le mot fautif → l'erreur est enregistrée avec son horodatage dans l'audio. L'élève réécoute son enregistrement avec les erreurs surlignées au bon moment. Le prof peut ajouter un court message vocal en réponse.

### 5.9 Suivi et progression
- Statut par verset : nouveau / en cours / acquis / à revoir (mis à jour par les validations et les corrections).
- **Carte de progression** visuelle (ex. le Juz 'Amma ou le programme choisi, qui se colore sourate par sourate). Pas de classement entre élèves.
- Historique par élève : séances, corrections par type, devoirs rendus.
- Vue prof : progression du groupe et erreurs les plus fréquentes sur la période — ça l'aide à choisir la règle de tajwid de la semaine suivante.

## 6. Stack

Reste cohérent avec mes autres projets :
- **Front** : React 18 + Vite + TypeScript + Tailwind + shadcn/ui, PWA installable. Responsive tablette / téléphone prioritaire côté élève.
- **Back** : Supabase (Auth, Postgres avec **RLS partout**, Realtime, Storage, Edge Functions).
- **Visio** : LiveKit (`livekit-client`, `@livekit/components-react`). LiveKit Cloud pour démarrer ; self-host possible plus tard sur mon mini-PC. Les tokens LiveKit sont générés par une Edge Function Supabase qui vérifie le rôle et l'appartenance à la classe — aucune clé secrète côté client.
- **Temps réel applicatif** (traits de crayon, vue partagée, état de lecture, main levée, parole donnée) : canaux data LiveKit pour la très basse latence au sein d'une salle ; Supabase pour la persistance et l'état global de la séance (salles, présence, annonces, plan de séance). Si tu vois une meilleure répartition, propose-la avant de coder.
- **Déploiement** : front statique (GitHub Pages ou Cloudflare Pages), Supabase et LiveKit en managé.
- **Tests** : Vitest pour la logique (synchro audio, ancrage des annotations, répétition espacée), Playwright pour un scénario 1 prof + 2 élèves.

## 7. Données coraniques

- Source principale : **QUL – Quranic Universal Library** (qul.tarteel.ai) : texte mot à mot (QPC Hafs), mises en page de Mushaf, polices, traductions, tafsirs, récitations avec **segments** (horodatage début/fin de chaque mot). Télécharge les jeux nécessaires, convertis-les en JSON compacts par sourate, servis en statique et mis en cache : le lecteur doit fonctionner même si une API tierce tombe.
- Les récitations utilisées doivent avoir des segments (tag « With segments » sur QUL). Gère les deux formats : audio verset par verset et sourate complète (gapless).
- Complément possible : l'API Content de Quran Foundation (ex-api.quran.com). Elle exige désormais OAuth2 *client credentials* et un backend : si on l'utilise, ce sera via une Edge Function, jamais depuis le navigateur.
- **Vérifie la licence de chaque ressource** (texte, traduction, tafsir, audio, police) et documente-la dans `CREDITS.md` avec l'attribution requise. Si une ressource n'est pas réutilisable, dis-le-moi et propose une alternative.
- Script d'import reproductible `scripts/import-quran-data` avec contrôles d'intégrité : 114 sourates, 6236 versets, nombre de mots par verset cohérent entre le texte et les segments.

## 8. Points techniques délicats — à prototyper en premier

### 8.1 Surlignage lettre par lettre en arabe
L'arabe est une écriture liée : entourer chaque lettre d'un `<span>` coloré peut casser les liaisons selon les navigateurs. Prototype et compare au moins deux approches sur Chrome, Safari (iPad / iPhone) et Firefox :
- surlignage dessiné **derrière** le texte à partir des positions mesurées des caractères (`Range.getClientRects`), sans toucher au DOM du mot ;
- découpage en clusters de graphèmes (lettre + harakat) avec caractères ZWJ aux frontières.

Timing : les données standard s'arrêtent au mot. Par défaut, interpole à l'intérieur de la durée du mot (pondération simple, ex. lettres de madd plus longues). Option : pré-générer de vrais minutages au niveau caractère pour quelques sourates du Juz 'Amma avec un outil d'alignement (ex. Quranic Universal Aligner sur Hugging Face) — qualité et conditions d'utilisation à vérifier.

### 8.2 Ancrage des annotations
Les élèves n'ont ni le même écran ni le même zoom que le prof : on ne stocke **jamais** de coordonnées en pixels écran.
- Marquage de mots : ancré par identifiant de mot (`sourate:verset:position`).
- Dessin libre : en mode Mushaf, coordonnées normalisées (0–1) relatives à la page ; en mode lecture, coordonnées normalisées relatives au bloc du verset concerné. Le trait se redessine correctement après un changement de zoom ou d'orientation.
- Envoi des traits en direct par petits lots de points (les messages data ont une taille limitée), lissage à la réception, puis persistance du trait terminé.

### 8.3 Synchronisation audio ↔ texte
Boucle `requestAnimationFrame` sur `currentTime` (l'événement `timeupdate` est trop peu fréquent), recherche binaire dans les segments, prise en compte de la vitesse et des répétitions. Préchargement du verset suivant pour éviter les blancs.

### 8.4 Bascule entre salles
Passer d'une salle LiveKit à une autre doit prendre moins de 2 secondes sans perdre l'état du lecteur. Reconnexion automatique (perte réseau, mise en veille sur mobile).

### 8.5 Enregistrement des devoirs audio
`MediaRecorder` ne produit pas toujours les mêmes formats selon les navigateurs (notamment Safari sur iPhone) : détecte le format supporté, stocke l'original dans Supabase Storage (bucket privé, URL signées) et garantis la lecture sur tous les navigateurs. Limite de durée (ex. 10 min), indicateur de niveau du micro, réécoute et réenregistrement possibles avant envoi. Les corrections différées sont horodatées en millisecondes par rapport au début de l'enregistrement.

## 9. Modèle de données (indicatif, à affiner)

`profiles` (rôle, nom affiché) · `classes` (prof, nom, code d'invitation) · `class_members` · `sessions` (classe, statut, début / fin) · `session_plans` (étapes, durées, règle de tajwid de la semaine, passage du jour) · `rooms` (séance, nom, capacité, nom de salle LiveKit, type principale / secondaire) · `room_participants` · `reader_states` (participant, sourate, page, plage de versets, mode, récitateur, niveau de masquage) · `annotations` (séance, élève visé, auteur, rôle de l'auteur prof / binôme, type mot / trait / laser, ancre JSON, style JSON) · `corrections` (séance **ou** devoir rendu, élève, mot, type d'erreur, commentaire, horodatage audio, auteur) · `teacher_notes` (prof, verset, contenu) · `weekly_plans` (élève, semaine, plages *sabaq* / *sabqî* / *manzil*, sessions quotidiennes et leur statut) · `assignments` (élève, portion, consigne texte affiché / masqué, échéance) · `submissions` (devoir, fichier audio, durée, statut à corriger / corrigé, réponse vocale du prof) · `verse_progress` (élève, verset, statut, dernière révision).

RLS : un élève ne voit que ses propres annotations, corrections, devoirs et enregistrements, ainsi que les notes de son prof ; un prof ne voit que ses classes.

## 10. Sécurité et RGPD

- Public adulte uniquement pour l'instant ; inscription sur invitation du prof.
- Les enregistrements de voix sont des données personnelles : bucket privé, accès limité à l'élève et à son prof, durée de conservation définie et réglable (suppression automatique au-delà), suppression à la demande.
- Données minimales, page « confidentialité », suppression de compte.
- Seul le prof (et l'admin) peut entrer dans une salle où il n'est pas affecté.

## 11. Design

Sobre, apaisant, respectueux du texte : fond papier crème, vert profond, accents dorés ; surlignage de lecture en jaune. Le Coran occupe l'essentiel de l'écran ; visio, outils et tafsir restent discrets et repliables. Boutons tactiles généreux côté élève (tablettes, téléphones). Aucun élément décoratif superposé au texte coranique.

## 12. Phases de livraison

- **Phase 0 — Prototypes** : 8.1 (surlignage mot + lettre synchronisé à l'audio sur Al-Fatiha et une sourate du Juz 'Amma) et 8.2 (crayon synchronisé entre deux onglets avec des zooms différents). Tu me montres, on choisit les approches.
- **Phase 1 — Lecteur solo** : import des données, lecteur complet (5.1 à 5.4 sans les notes prof), y compris masquage progressif, test « continue le verset » et mode entraînement. Utilisable sans compte.
- **Phase 2 — Comptes et classes** : auth Supabase, rôles, classes, invitations, RLS, notes du professeur, statuts de versets.
- **Phase 3 — Séance live** : salle principale, plan de séance avec minuteur, talqîn (donner la parole), salles et binômes, bascule, tableau de bord des salles, main levée, annonces, rappel général.
- **Phase 4 — Outils prof** : vue partagée, prise de main, crayon, laser, marquage de mots, corrections (prof et binôme), test « continue le verset » en live, agrégat des erreurs pour le retour commun, récapitulatif de fin de séance.
- **Phase 5 — Entre les séances** : plan de la semaine *sabaq* / *sabqî* / *manzil* avec répétition espacée, devoirs audio, correction différée horodatée, réponse vocale, carte de progression, historique.
- **Phase 6 — Finition et lancement** : PWA, test avec 1 prof + 10 élèves (le double du groupe de lancement), accessibilité, déploiement, puis une séance pilote avec le vrai groupe.

Les phases 1 à 4 suffisent pour une première séance avec le groupe ; la phase 5 peut arriver dans les semaines qui suivent.

## Plus tard / hors périmètre

- Mineurs et espace parents (consentement parental, règles de visio à revoir).
- Moniteurs (élèves avancés avec une partie des droits du prof) quand le groupe grandira.
- Module débutant type Qâ'ida Nourâniyya (lettres, harakat, sukûn, madd) si des élèves ne savent pas encore lire l'arabe.
- Rappels par email ou notification (veille du cours, devoir à rendre).
- Paiement / abonnements, application mobile native, reconnaissance vocale automatique de la récitation, enregistrement des séances live, chat de groupe.
