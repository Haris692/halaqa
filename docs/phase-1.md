# Phase 1 — Lecteur solo : compte rendu

13/11/2026. Utilisable sans compte : les réglages, la dernière position et les sourates apprises sont enregistrés sur l'appareil.

## Choix appliqués (recommandations de la phase 0)

- Surlignage lettre : **approche A** (rectangles mesurés par `Range`), mode lecture uniquement.
- Minutage : **quran.com / QUL**, audio sourate entière.
- Mode Mushaf : **glyphes QPC V2**, surlignage au mot.
- (L'ancrage des traits au mot servira en phase 4.)

## Ce qui est fait

### Données (`npm run import`, `npm run import:media`)

- Import complet et reproductible, avec cache des réponses brutes et contrôles d'intégrité bloquants : **114 sourates, 6 236 versets, 77 430 mots, 604 pages**, index des 30 juz, 60 hizb et 240 quarts.
- **4 récitateurs avec minutage mot à mot** :
  - Husary Mu'allim (par défaut) ;
  - Husary Murattal ;
  - Minshawi Murattal ;
  - Afasy.
- Abdul Basit est écarté : 1 834 mots sans minutage dans la source.
- Traductions **Hamidullah, Rachid Maach, Noor International** et tafsirs **Mukhtasar (français), Muyassar (arabe)**. Al-Muyassar commente parfois plusieurs versets d'un seul bloc : c'est indiqué (« commentaire commun aux versets x à y »).
- **Tajwid** : 18 règles. Le texte tajwid de quran.com est encodé différemment du texte QPC (tanwin, ى/ي, signes de pause), donc les règles sont reportées **lettre par lettre** sur le texte QPC. Couverture : 77 089 mots sur 77 430, et les 341 autres restent sans couleur.
- Audio de Husary Mu'allim hébergé chez nous pour **al-Fatiha et le Juz 'Amma** (85 Mo), le reste lu depuis la source.

### Lecteur (5.1 à 5.4, sans les notes du prof)

- **Accueil** :
  - reprendre la lecture ;
  - recherche par numéro, nom arabe, français ou translittéré ;
  - liste des 114 sourates ;
  - « Aller à » une sourate, un juz, un hizb ou une page.
- **Mode lecture** (`/lire/2?v=255`) : verset par verset, grande taille (40 px par défaut, de 24 à 96), zoom par **pincement**, en-tête de sourate et basmala.
- **Mode Mushaf** (`/page/604`) : 604 pages fidèles au Mushaf de Médine. On tourne les pages par balayage, avec les flèches du clavier ou des boutons, et la lecture tourne les pages toute seule.
- **Thèmes** : clair (crème), nuit, contraste élevé.
- **Écoute** :
  - surlignage verset, mot ou lettre ;
  - vitesse de 0,5× à 1,25× ;
  - répéter chaque verset N fois ;
  - boucle sur une plage ;
  - pause après chaque verset (2, 4 ou 8 s, ou attendre un clic) ;
  - toucher un mot = l'écouter seul ;
  - suivi automatique du verset en cours.
- **Tajwid** : coloration activable, toutes les règles ou **seulement la famille de la semaine** (madd, ghunna, qalqala, ikhfâ', idghâm, iqlâb, lettres muettes), avec légende.
- **Traduction / tafsir** : panneau latéral sur ordinateur, feuille en bas d'écran sur téléphone. Il suit le verset sélectionné (toucher le numéro) ou celui en cours de lecture. Source sélectionnable, affichée sous chaque texte.

### Mémorisation (5.3)

- **Masquage progressif**, dans le lecteur comme dans l'entraînement : texte complet → estompé → première lettre → masqué. Toucher un mot masqué le révèle un instant.
- **Continue le verset** (`/entrainement/continuer`) : tirage au hasard parmi les sourates cochées comme apprises, avec raccourcis « Juz 'Amma » et « Al-Fatiha ». Le début du verset s'affiche et peut s'écouter, puis on révèle le verset et on note « je savais » ou « à revoir ».
- **Entraînement guidé** (`/entrainement/sourate/112?de=1&a=4&n=3`) :
  1. écoute ×N ;
  2. lecture à voix haute ;
  3. récitation avec la première lettre seulement ;
  4. récitation avec le texte masqué ;
  5. puis enchaîner sur la portion suivante.

### Qualité

- **72 tests Vitest**. L'un d'eux vérifie, sur les 77 430 mots du Coran, que le découpage pour le tajwid et le masquage **ne modifie aucun caractère** du texte.
- TypeScript strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`). Interface entièrement traduite via `src/i18n/fr/`.
- Testé dans Chrome sur ordinateur et au format téléphone (375 px) : lecture, tajwid, panneau, Mushaf, entraînement, test, sans erreur dans la console.

## Limites connues

- **Safari (iPhone/iPad) et Firefox ne sont pas testés.** Pour Safari, le point sensible est le découpage des mots en plusieurs couleurs (tajwid, première lettre). Des ZWJ invisibles sont ajoutés aux frontières pour préserver les liaisons, mais seul un vrai appareil le confirmera.
- En **mode Mushaf** : pas de tajwid ni de surlignage lettre, et « première lettre » s'affiche comme « estompé ». La police V2 dessine chaque mot d'un seul bloc.
- La lecture en mode Mushaf joue la sourate en cours. À la fin d'une sourate, elle ne passe pas automatiquement à la suivante.
- Les couleurs du tajwid suivent les conventions usuelles de quran.com : **à faire valider par le professeur**.
- Pas encore de PWA ni de mode hors ligne (prévus en phase 6).

## Décisions à prendre avant la phase 2

1. **Licences** : faut-il écrire au Complexe du Roi Fahd (polices) et à QuranEnc (statut de Hamidullah et du Mukhtasar) ? Voir [CREDITS.md](../CREDITS.md).
2. **Supabase** : as-tu un compte ? Je recommande un projet en région Europe. Il faudra aussi choisir le mode de connexion : lien magique par e-mail (le plus simple pour des adultes invités) ou mot de passe.
