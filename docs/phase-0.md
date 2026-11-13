# Phase 0 — Prototypes : compte rendu

13/11/2026. Labos sans compte ni serveur, accessibles sur `npm run dev` puis http://localhost:5173.

## Ce qui est fait

- Squelette : Vite 8, React 18, TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), Tailwind 4 aux couleurs du projet, i18n (fichiers `src/i18n/fr/*.json`), dépôt git local initialisé (aucun commit).
- **Import minimal** (`npm run import:phase0`) :
  - les 114 sourates en métadonnées ;
  - le texte QPC Hafs mot à mot de 1, 112, 113 et 114 ;
  - les pages 1 et 604 du Mushaf ;
  - Husary Mu'allim depuis **deux sources de minutage** ;
  - les polices.
- Contrôle d'intégrité OK : chaque mot du texte a un minutage dans les deux sources.
- **Logique pure** (`src/core`), **48 tests Vitest** qui passent :
  - recherche binaire dans les segments, mot actif avec tolérance aux micro-silences ;
  - découpage en lettres (lettre + harakat) et interpolation pondérée (madd ×2, madd obligatoire ×4, lettres muettes ×0,2, shadda) ;
  - jointures pour l'approche ZWJ ;
  - répétitions, pauses et boucles ;
  - ancrage des annotations, envoi par lots, laser, gomme, protocole de synchro.
- **Lecteur audio** (`src/services/audio/recitation-player.ts`) :
  - boucle `requestAnimationFrame` sur `currentTime` ;
  - double tampon pour précharger le verset suivant ;
  - enchaînement sans « seek » entre versets d'une même sourate ;
  - vitesse de 0,5× à 1,25×, répéter N fois, pause de 2 s, de 4 s ou jusqu'au clic, boucle sur une plage ;
  - toucher un mot = l'écouter seul.
- **Labo 8.1** `/labs/surlignage` : verset, mot et lettre, les deux approches pour la lettre, les deux sources, et un banc d'essai des liaisons.
- **Labo 8.2** `/labs/crayon` : onglets professeur et élève synchronisés par `BroadcastChannel`, avec :
  - crayon (4 couleurs, 3 épaisseurs), laser qui s'efface après environ 2 s, gomme, tout effacer ;
  - marquage de mots, un mot ou une plage ;
  - crayon de l'élève autorisable par le prof ; marquages de l'élève visuellement distincts ;
  - mode Mushaf (glyphes V2 ou Unicode) et mode lecture ;
  - trois ancrages au choix ;
  - mesures : taille des messages et latence.

## Comment tester

1. `npm run dev`, puis ouvrir http://localhost:5173.
2. **Surlignage** : lancer al-Fatiha puis al-Ikhlas. Pour chaque source, écouter si le mot surligné colle à la voix, puis comparer les approches A et B au niveau lettre. Ouvrir le banc d'essai.
3. **Crayon** : ouvrir le labo, cliquer sur « Ouvrir l'onglet Élève », mettre les deux fenêtres côte à côte avec des zooms différents, puis dessiner, utiliser le laser et marquer des mots. En mode lecture, comparer « bloc du verset » et « mot le plus proche » en changeant le zoom d'un seul onglet.
4. **Safari iPhone/iPad** : `npm run dev:lan`, puis ouvrir l'adresse réseau sur l'appareil. C'est le test le plus important pour 8.1 et je ne peux pas le faire moi-même.

## Constats (vérifiés dans Chrome sur Windows)

### 8.1 Surlignage

- Les deux approches **gardent les liaisons intactes** dans Chrome.
- **Ligature de ٱللَّه** :
  - l'approche B ne peut pas colorer une lettre à l'intérieur : tout le mot prend la couleur de la première lettre ;
  - l'approche A découpe la ligature en parts égales : c'est une approximation, mais visuellement elle progresse.
- L'approche B multiplie les éléments du DOM (environ ×4) et dépend du comportement des ZWJ, qui varie selon le moteur (Safari est historiquement le plus fragile).
- **Recommandation provisoire : approche A**, à confirmer sur Safari et Firefox.
- La position de la lettre est **estimée** : les données s'arrêtent au mot. Il faut l'écouter pour juger si c'est assez bon pour la pédagogie. Sinon : alignement au niveau lettre avec un outil externe pour le Juz 'Amma (option prévue dans la spec).
- Sources de minutage :
  - quran.com/QUL : sourate entière, transitions parfaitement fluides ;
  - cpfair : un fichier par verset, transition via le préchargement ;
  - les deux couvrent tous les mots pour 1 et 112 ; la précision reste à comparer à l'oreille.

### 8.2 Crayon

- **Ancrage page (0–1)** en mode Mushaf : le trait reste exactement en place à 80 % et 120 %. Limites :
  - il n'est visible qu'en mode Mushaf, sur cette page ;
  - il suppose que **tout le monde utilise la même police de Mushaf** : un trait fait en glyphes V2 tombe ailleurs en Unicode.
- **Ancrage « bloc du verset »** (celui de la spec) : dès que le zoom change le nombre de lignes, le trait ne désigne plus les mêmes mots. **À éviter.**
- **Ancrage au mot** (ma proposition : décalage en « em » depuis le centre du mot le plus proche) :
  - le trait suit le mot au zoom comme au reflow ;
  - il reste **à peu près** en place entre mode lecture et mode Mushaf.
  - C'est le seul ancrage qui marche si le prof et l'élève ne sont pas dans le même mode (un élève sur téléphone en mode lecture, par exemple).
- Le marquage de mots est parfait dans tous les modes, puisqu'il est ancré par identifiant.
- Plus gros message en direct : **172 octets** pour une limite visée de 1 300. Les lots de 24 points ou de 40 ms laissent beaucoup de marge.
- Mushaf :
  - les glyphes V2 donnent un rendu fidèle à la page imprimée, mais une police par page (environ 40 Ko chacune) et **aucun surlignage lettre possible** ;
  - en Unicode sur la même mise en page, les lignes sont justifiées par de grands blancs, moins beau, mais la lettre reste possible.

## Décisions à prendre ensemble

1. **Lettre** : approche A (recommandée) ou B, après ton test sur iPhone ou iPad.
2. **Source de minutage** : quran.com/QUL (fluide, licence non précisée) ou cpfair (CC BY 4.0, un fichier par verset).
3. **Ancrage des traits** : je recommande **l'ancrage au mot partout**. On peut garder l'ancrage page en option si tout le monde est en mode Mushaf avec la même police.
4. **Mode Mushaf** : glyphes V2 (fidèle, surlignage au mot seulement) ou Unicode (lettre possible, moins beau). Je recommande V2 pour le Mushaf, avec le surlignage lettre réservé au mode lecture.

## Ce qui reste hors de la phase 0

- Tests sur Safari (iPhone, iPad) et Firefox : il me faut ton appareil.
- Le passage de BroadcastChannel à LiveKit (phase 4) : seul `src/labs/pen/channel.ts` changera.
- shadcn/ui n'est pas encore installé : les labos utilisent de simples contrôles Tailwind. Il arrivera avec le vrai lecteur en phase 1.
- L'import complet et reproductible des 114 sourates, avec les contrôles des 6 236 versets (phase 1).
