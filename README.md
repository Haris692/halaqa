# Halaqa

Plateforme d'apprentissage du Coran en ligne : séances en direct, salles de travail, outils du professeur, travail entre les séances.
Spécification : [prompt-claude-code-halaqa.md](prompt-claude-code-halaqa.md) · Architecture : [docs/architecture.md](docs/architecture.md).

**État : phase 2 (comptes et classes), en attente de validation.** Comptes rendus : [phase 0](docs/phase-0.md) · [phase 1](docs/phase-1.md) · [phase 2](docs/phase-2.md).
Site de test : https://haris692.github.io/halaqa/

## Installation

Prérequis : Node 24+, npm. Pour les comptes en local : Docker et le CLI Supabase.

```bash
npm install
npm run import:media    # polices (604 pages du Mushaf) et audio hébergé — ~180 Mo
npm run dev             # http://localhost:5173
```

Les données coraniques (`public/quran/`) sont versionnées : pas besoin de relancer l'import pour développer.

Comptes, classes et progression (Supabase local, comptes de démonstration de `supabase/seed.sql`, mot de passe `halaqa-demo`) :

```bash
npm run db:start        # Supabase local dans Docker (premier lancement : quelques minutes)
cp .env.example .env.local   # puis y mettre l'URL et la clé « publishable » affichées par db:start
```

Sans `.env.local`, l'application démarre en lecteur seul, sans comptes.
Pour tester sur iPhone/iPad (Safari) depuis le même réseau Wi-Fi : `npm run dev:lan`, puis ouvrir l'adresse « Network » sur l'appareil.

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` | vérification des types + build de production |
| `npm test` | tests Vitest (logique pure de `src/core`, et intégrité des données importées) |
| `npm run typecheck` | vérification TypeScript stricte |
| `npm run test:db` | tests pgTAP des politiques RLS (Supabase local) |
| `npm run db:start` / `db:reset` | démarre / réinitialise la base locale (migrations + données de démo) |
| `npm run db:types` | régénère `src/services/database.types.ts` depuis la base locale |
| `npm run import` | import complet des données → `public/quran/` (environ 1 min ; réponses brutes en cache dans `scripts/import-quran-data/raw/`) |
| `npm run import:media` | polices et audio hébergé → `public/fonts/`, `public/audio/` |

L'import échoue si un contrôle d'intégrité ne passe pas : 114 sourates, 6 236 versets, 604 pages, positions de mots contiguës, minutage de chaque mot, traduction et tafsir de chaque verset. Le rapport détaillé est écrit dans `scripts/import-quran-data/raw/rapport-import.txt`.

## Organisation du code

- `src/core/` — logique pure et testée, sans React : synchro audio, lettres, masquage, recherche, navigation, annotations, statuts de versets, codes d'invitation.
- `src/features/` — interface par domaine : lecteur, lecture audio, traduction/tafsir/notes du prof, navigation, réglages, comptes, classes, progression, administration.
- `src/services/` — chargement des données, lecteur audio, client Supabase et accès aux données des comptes.
- `supabase/` — migrations (schéma + RLS), tests pgTAP, données de démonstration locales.
- `scripts/serveur/` — démarrage du serveur auto-hébergé et du tunnel, sauvegarde nocturne.
- `src/app/pages/` — pages ; `src/labs/` — prototypes de la phase 0 (chargés à la demande).
- `src/i18n/fr/` — tous les textes d'interface.

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `VITE_SUPABASE_URL` | URL du projet Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | clé publique « publishable » (faite pour le navigateur ; la sécurité repose sur les politiques RLS) |
| `BASE_PATH` | chemin de base du build (ex. `/halaqa/` pour GitHub Pages) |

Voir `.env.example`. En déploiement, les deux variables Supabase sont des **variables du dépôt GitHub** (pas des secrets : elles sont publiques par nature). Aucune clé secrète n'est utilisée par le front.

## Données et médias

`public/quran/` (JSON générés, ~30 Mo) est versionné. `public/audio/` et `public/fonts/` ne le sont pas : ils sont retéléchargés par `npm run import:media`, en attendant de confirmer leurs licences (voir [CREDITS.md](CREDITS.md)).

## Déploiement

**Pour l'instant : GitHub Pages.** Chaque push sur `main` lance [.github/workflows/deploy.yml](.github/workflows/deploy.yml) :
1. tests et vérification des types ;
2. médias (avec cache entre deux déploiements) ;
3. build avec `BASE_PATH=/halaqa/` et les variables Supabase du dépôt ;
4. copie de `index.html` en `404.html` (repli pour les liens directs) ;
5. publication.

Base de données : **Supabase auto-hébergé sur le PC de développement**, exposé par un tunnel Cloudflare. Voir [docs/serveur.md](docs/serveur.md) pour le démarrage, les sauvegardes et l'application des migrations.

Pour la suite : Cloudflare Pages recommandé (voir `docs/architecture.md`).
