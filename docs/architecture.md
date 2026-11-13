# Halaqa — Proposition d'architecture (avant la phase 0)

> Statut : **proposition, en attente de validation**. Aucun code n'est encore écrit.
> Dernière mise à jour : 13/11/2026.

## 1. Environnement constaté sur le PC

Node 24.20 · npm 11.19 (pas de pnpm → **npm**) · git 2.55 · GitHub CLI 2.102 · Supabase CLI 2.121 · Docker 29.8 (Supabase en local possible) · Deno 2.9 (Edge Functions) · Python 3.12 (utile pour l'outil d'alignement éventuel).

Le dossier n'est pas encore un dépôt git : je ferai `git init` au début de la phase 0.

## 2. Arborescence proposée

Une seule application (pas de monorepo : inutile à cette taille), avec une séparation stricte entre la **logique pure** (`src/core`, testée avec Vitest, sans React) et l'**UI** (`src/features`).

```
Halaqa/
├─ README.md                    installation, variables d'env, déploiement
├─ CREDITS.md                   sources, récitateurs, polices, licences
├─ docs/
│  ├─ architecture.md           ce document
│  └─ decisions/                une note courte par décision importante (ADR)
├─ public/
│  ├─ fonts/                    polices coraniques + police d'interface
│  └─ quran/                    JSON compacts générés par le script d'import
│     ├─ meta.json              114 sourates (noms ar/fr/translit.), juz, hizb, pages
│     ├─ text/001.json…114.json mots QPC Hafs, id `sourate:verset:position`
│     ├─ layout/…               mise en page Mushaf (604 pages × 15 lignes)
│     ├─ tajweed/…              règles de tajwid par mot (si source fiable)
│     ├─ translations/<id>/…    traductions françaises, par sourate
│     ├─ tafsir/<id>/…          tafsirs, par sourate
│     └─ recitations/<id>/…     segments (minutage mot à mot) par sourate
├─ scripts/
│  └─ import-quran-data/        script Node/TS reproductible
│     ├─ sources.ts             liste des ressources + licence + attribution
│     ├─ download.ts            téléchargement dans raw/ (ignoré par git)
│     ├─ convert/               une conversion par type de ressource
│     └─ verify.ts              114 sourates, 6236 versets, nb de mots texte = segments
├─ src/
│  ├─ app/                      routes, layout, providers
│  ├─ core/                     LOGIQUE MÉTIER PURE (aucun import React)
│  │  ├─ quran/                 types, identifiants de mots, recherche de sourate
│  │  ├─ audio-sync/            recherche binaire dans les segments, interpolation
│  │  │                         au niveau lettre, vitesse, répétitions, boucles
│  │  ├─ annotations/           ancres (mot / page / verset), coordonnées 0–1,
│  │  │                         découpage en lots, lissage des traits
│  │  ├─ memorization/          niveaux de masquage, tirage « continue le verset »
│  │  ├─ srs/                   répétition espacée (manzil)
│  │  ├─ session/               machine à états de la séance, plan, minuteur
│  │  └─ recording/             détection du format MediaRecorder
│  ├─ features/                 UI par domaine (composants + hooks)
│  │  ├─ reader/  player/  tafsir/  memorization/
│  │  ├─ auth/  classes/  admin/
│  │  ├─ live/  rooms/  teacher-tools/
│  │  └─ homework/  progress/
│  ├─ services/                 adaptateurs : Supabase, LiveKit, chargement
│  │                            et cache des données coraniques, stockage
│  ├─ components/ui/            composants shadcn/ui
│  ├─ labs/                     prototypes de la phase 0 (routes /labs/…),
│  │                            supprimés une fois les approches choisies
│  ├─ i18n/fr/*.json            textes d'interface (en/ prévu plus tard)
│  └─ styles/                   thème (crème, vert profond, doré), mode nuit
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/               schéma + politiques RLS
│  ├─ seed.sql                  données de test (1 prof, 5 élèves)
│  ├─ functions/
│  │  ├─ livekit-token/         vérifie rôle + appartenance à la classe
│  │  ├─ livekit-moderation/    couper/rétablir les micros (API serveur LiveKit)
│  │  └─ purge-recordings/      suppression auto des enregistrements expirés
│  └─ tests/                    tests pgTAP des politiques RLS
└─ tests/
   └─ e2e/                      Playwright : 1 prof + 2 élèves
```

## 3. Choix que je prends (sauf objection de ta part)

| Sujet | Choix | Pourquoi |
|---|---|---|
| Gestionnaire de paquets | npm | Déjà installé, pas de besoin de pnpm à cette taille |
| Routage | React Router | Standard, simple |
| État | Zustand (état local du lecteur, de la salle) + TanStack Query (données serveur) | Léger, facile à tester hors React |
| i18n | i18next + react-i18next, fichiers JSON par domaine | Ajout de l'anglais sans toucher aux composants |
| Dessin | Calque `<canvas>` maison + `perfect-freehand` (MIT) pour le lissage | Les librairies de tableau blanc (ex. tldraw) ont des licences payantes en production et ne savent pas s'ancrer au texte |
| PWA | `vite-plugin-pwa` (Workbox), cache des JSON coraniques et des polices | Lecteur utilisable même si une API tierce tombe |
| Tests | Vitest (`src/core`), pgTAP (RLS), Playwright (e2e) | Comme demandé, plus des tests RLS |
| Régions | Supabase et LiveKit en **Europe** | RGPD (voix = données personnelles) |
| Prototypes de la phase 0 | Aucun backend : synchro entre deux onglets via `BroadcastChannel` | On valide l'ancrage et le rendu avant de brancher LiveKit |

### Répartition du temps réel (précision de la section 6)

Je garde ta répartition, avec trois ajustements :

- **Canaux data LiveKit** (au sein d'une salle, très basse latence) : traits de crayon en cours, laser, état de lecture, vue partagée, prise de main.
- **Supabase** (état de la séance et persistance) : salles et affectations, présence, annonces, rappel général, plan de séance et minuteur, traits terminés, corrections.
- **Ajustement 1 — main levée → Supabase Realtime**, pas LiveKit : le prof doit la voir où qu'il soit (tableau de bord, autre salle), alors qu'un message LiveKit ne sort pas de sa salle.
- **Ajustement 2 — couper le micro des autres** se fait côté serveur : un client LiveKit ne peut pas couper le micro d'un autre participant. Une Edge Function `livekit-moderation` utilisera l'API serveur de LiveKit, après avoir vérifié que l'appelant est bien le prof.
- **Ajustement 3 — la bascule de salle** est déclenchée par un événement Supabase (« va en salle 3 », « tout le monde en salle principale »), puis chaque client se reconnecte à la bonne salle LiveKit.

## 4. Ce que j'ai vérifié sur les données coraniques

Sources consultées le 13/11/2026 : [QUL](https://qul.tarteel.ai/), [FAQ QUL](https://qul.tarteel.ai/faq), [doc des segments](https://qul.tarteel.ai/docs/with-segments), [QuranEnc](https://quranenc.com/en/home).

**Ce qui est disponible sur QUL :**

- Texte « KFGQPC Hafs script – Word by word » (ressource 312), en JSON ou SQLite.
- Texte QPC Hafs avec tajwid (ressources 58 et 87), format exact encore à inspecter.
- **Husary Mu'allim avec segments mot à mot** (ressource 334, audio sourate complète). Il existe aussi une version verset par verset (112).
- Les segments sont au **mot** uniquement, au format `[position, début_ms, fin_ms]`. Le surlignage lettre par lettre reposera donc sur l'interpolation (8.1), comme prévu.
- Traductions françaises : Hamidullah (227), Rashid Maash (295), Montada Islamic Foundation (174), et un mot à mot (95).
- Tafsirs : **Mukhtasar en français** (259) et al-Muyassar en arabe (38).

**Le problème de licence :**

QUL indique « We don't have copyright information for this resource » pour **toutes** les ressources que j'ai ouvertes : le texte 312, Husary 334, Maash 295 et le Mukhtasar 259. Sa FAQ dit que la licence dépend de chaque ressource et renvoie vers l'auteur d'origine. QUL ne suffit donc pas comme justification de licence. Voici ce que je propose, source par source :

| Ressource | Source d'origine | Conditions trouvées | Proposition |
|---|---|---|---|
| Texte QPC Hafs | Complexe du Roi Fahd (KFGQPC) | Texte reproduit sans modification | Prendre le texte de QUL, ne jamais le modifier, créditer le KFGQPC |
| Traductions FR + Mukhtasar FR | [QuranEnc](https://quranenc.com/en/browse/french_mokhtasar) (Hamidullah, Maash, Mukhtasar, Noor International) | Republication autorisée **sans modification**, en citant QuranEnc et la version, avec mise à jour vers la dernière version, sans publicité inappropriée | **Importer depuis QuranEnc plutôt que depuis QUL** : les conditions sont écrites noir sur blanc. Le Mukhtasar FR résout le manque de tafsir en français |
| Minutage Husary | QUL 334 (pas d'info) ; alternative : [cpfair/quran-align](https://github.com/cpfair/quran-align), sous **CC BY 4.0** | CC BY 4.0 : réutilisable avec attribution | Commencer avec QUL et garder cpfair en solution de repli propre, puis comparer les deux en phase 0 |
| Audio des récitateurs | CDN d'origine (quran.com / everyayah) | Pas de licence explicite trouvée | Lecture depuis la source avec cache local ; copie chez nous à décider (question 3) |
| Police KFGQPC | Complexe du Roi Fahd | « Gratuite mais propriétaire » : pas de reproduction ni de modification sans accord écrit (selon des tiers, je n'ai pas trouvé le texte officiel) | Voir la question 2 |

Le détail complet ira dans `CREDITS.md` lors de la phase 1.

## 5. Choix que je n'ai pas pu trancher

### À trancher par toi

1. **La plateforme sera-t-elle commerciale ?** Le paiement et les abonnements sont « hors périmètre plus tard ». La réponse change ce qu'on a le droit d'utiliser : polices, audio, certaines traductions. Pour l'instant je suppose : gratuit, groupe privé.
2. **Police coranique.**
   - Option A, KFGQPC Hafs : c'est la référence, mais sa licence limite la redistribution. On peut demander une autorisation écrite au Complexe.
   - Option B, une police sous licence libre en solution de secours (Amiri Quran, SIL OFL), avec la police KFGQPC comme choix par défaut seulement si tu acceptes cette zone grise.
   - Ma recommandation : utiliser KFGQPC tant que le groupe est privé et non commercial, écrire au Complexe en parallèle, et garder Amiri Quran en secours.
3. **Où héberger l'audio.**
   - Option A : lire l'audio depuis le CDN d'origine, avec un cache par le service worker.
   - Option B : copier chez nous l'audio de **Husary Mu'allim pour al-Fatiha et le Juz 'Amma** (quelques centaines de Mo), par exemple sur Cloudflare R2 (gratuit jusqu'à 10 Go), et lire le reste depuis l'origine.
   - Ma recommandation : l'option B, qui protège le programme de lancement si le CDN d'origine tombe ou change d'adresse.
4. **Traductions françaises proposées.** Par défaut je propose **Hamidullah** en traduction et le **Mukhtasar FR** en tafsir, avec Rashid Maash et Noor International en option. Tu valides ?
5. **Comptes et hébergement** (nécessaires à partir de la phase 2, pas avant) :
   - as-tu déjà des comptes Supabase, LiveKit Cloud, Cloudflare et GitHub à utiliser ?
   - je recommande **Cloudflare Pages** plutôt que GitHub Pages : redirection des routes de l'application, en-têtes de cache, et R2 sur la même plateforme ;
   - veux-tu un dépôt GitHub privé ?

### À trancher par les prototypes de la phase 0

6. **Surlignage lettre par lettre** : surlignage dessiné derrière le texte (`Range.getClientRects`) ou découpage en clusters de lettres avec ZWJ. Ce sera comparé sur Chrome, Firefox et Safari iPad/iPhone. Pour Safari, il me faudra ton iPhone ou ton iPad, ou un accès au serveur de dev depuis ton réseau.
7. **Rendu du mode Mushaf.**
   - Les polices « glyphes » QPC V1/V2 (une police par page) donnent le rendu exact du Mushaf de Médine. Mais un mot y est un seul glyphe, donc **aucun surlignage lettre n'est possible** dans ce mode, seulement par mot.
   - L'alternative est un texte Unicode posé sur la mise en page 15 lignes : la lettre est possible, mais la justification des lignes est moins parfaite.
   - Je propose de prototyper les deux sur deux pages. On pourra aussi garder le surlignage lettre réservé au mode lecture.
8. **Quelle source de minutage** : QUL ou cpfair (voir section 4). Je comparerai la précision à l'oreille sur al-Fatiha et une sourate courte.

### À vérifier plus tard (dans la phase concernée)

- **Données de tajwid** (phase 1) : inspecter le format de QUL 58/87 et faire vérifier la fiabilité par le prof sur quelques pages.
- **Format des devoirs audio** (phase 5) : préférer `audio/mp4` (AAC) quand le navigateur sait l'enregistrer, sinon WebM/Opus, puis tester la lecture sur chaque navigateur.
- **Quotas** :
  - LiveKit Cloud gratuit (offre « Build ») : environ 5 000 minutes-participant par mois, chiffre de source tierce à confirmer sur la page officielle. Une séance d'1 h à 6 personnes par semaine représente environ 1 600 min/mois, donc ça tient.
  - Supabase gratuit : 1 Go de stockage, largement assez pour les devoirs audio de 5 élèves. Mais un projet inactif 7 jours est mis en pause, ce qui ne devrait pas arriver avec un usage quotidien.

## 6. Phase 0 — ce que je ferai dès ta validation

1. `git init`, puis le squelette Vite + React + TS strict + Tailwind + shadcn/ui, sans backend.
2. Une mini-importation pour al-Fatiha et une sourate du Juz 'Amma (texte, segments Husary Mu'allim, audio), sans encore le script complet.
3. **Labo 8.1** (`/labs/surlignage`) : lecture audio avec surlignage verset → mot → lettre, les deux approches côte à côte, la boucle `requestAnimationFrame` et la recherche binaire (testées avec Vitest).
4. **Labo 8.2** (`/labs/crayon`) : deux onglets avec des zooms différents, synchronisés par `BroadcastChannel`. On y teste le marquage ancré au mot, le dessin libre en coordonnées 0–1 (page et bloc de verset), le laser et l'envoi des traits par lots.
5. Le résumé, comment tester, et ce qui reste ; ensuite on choisit les approches ensemble.
