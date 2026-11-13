# Halaqa

Plateforme d'apprentissage du Coran en ligne : séances en direct, salles de travail, outils du professeur, travail entre les séances.
Spécification : [prompt-claude-code-halaqa.md](prompt-claude-code-halaqa.md) · Architecture : [docs/architecture.md](docs/architecture.md).

**État : phase 0 (prototypes).** Voir [docs/phase-0.md](docs/phase-0.md).

## Installation

Prérequis : Node 24+, npm.

```bash
npm install
npm run import:phase0   # télécharge texte, minutages, audio et polices pour les labos
npm run dev             # http://localhost:5173
```

Pour tester sur iPhone/iPad (Safari) depuis le même réseau Wi-Fi :

```bash
npm run dev:lan         # puis ouvrir l'adresse « Network » affichée sur l'appareil
```

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` | vérification des types + build de production |
| `npm test` | tests Vitest (logique pure de `src/core`) |
| `npm run typecheck` | vérification TypeScript stricte |
| `npm run import:phase0` | import minimal des données des labos |

## Variables d'environnement

Aucune pour l'instant (pas de backend en phase 0). Supabase et LiveKit arriveront en phases 2 et 3.

## Données et médias

`public/quran/` (JSON générés) est versionné. `public/audio/` et `public/fonts/` ne le sont pas : ils sont retéléchargés par le script d'import, en attendant de confirmer leurs licences (voir [CREDITS.md](CREDITS.md)).

## Déploiement

**Pour l'instant : GitHub Pages**, pour tester les labos sur téléphone. Chaque push sur `main` lance [.github/workflows/deploy.yml](.github/workflows/deploy.yml) :
1. tests ;
2. import des données (audio et polices compris) ;
3. build avec `BASE_PATH=/halaqa/` ;
4. copie de `index.html` en `404.html` (repli pour les liens directs) ;
5. publication.

Site : https://haris692.github.io/halaqa/

Pour la suite : Cloudflare Pages recommandé (voir `docs/architecture.md`).
