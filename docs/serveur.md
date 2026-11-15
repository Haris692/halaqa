# Serveur Halaqa sur ce PC (Supabase auto-hébergé)

Mis en place le 15/11/2026, à la place d'un projet Supabase hébergé : la limite de 2 projets gratuits du compte était atteinte.

## Ce qui tourne

| Élément | Où | Rôle |
|---|---|---|
| Supabase officiel auto-hébergé (Docker) | `%USERPROFILE%\halaqa-serveur\src\docker` (hors dépôt : contient les clés secrètes) | 6 services : Postgres, auth, API REST, temps réel (séances), fonctions (jetons LiveKit, limitées à 512 Mo), passerelle. Studio, Storage et pooler restent désactivés |
| Tunnel Cloudflare temporaire | `cloudflared`, sans compte | rend l'API accessible en HTTPS sur une adresse `*.trycloudflare.com` ; aucun port n'est ouvert sur la box |
| Tâche planifiée « Halaqa serveur » | à l'ouverture de session (+1 min) | lance [scripts/serveur/demarrer.ps1](../scripts/serveur/demarrer.ps1) |
| Tâche planifiée « Halaqa sauvegarde » | chaque nuit à 3 h (ou au réveil du PC) | lance [scripts/serveur/sauvegarder.ps1](../scripts/serveur/sauvegarder.ps1) → `%USERPROFILE%\halaqa-serveur\sauvegardes`, 30 dernières conservées |

## Sécurité

- Clés et mots de passe **générés pour ce serveur** (`utils/generate-keys.sh` officiel) ; aucune clé de démonstration.
- La passerelle (port 8000) et Postgres (port 54329) n'écoutent **que sur ce PC** (127.0.0.1) ; seul le tunnel les expose, et seulement l'API.
- Le site ne connaît que la clé publique `anon` ; tout repose sur les politiques RLS. Les 44 tests pgTAP passent sur ce serveur :
  ```bash
  supabase test db --db-url "postgresql://postgres:<POSTGRES_PASSWORD>@127.0.0.1:54329/postgres?sslmode=disable"
  ```
- Limites de débit de l'auth calculées par visiteur (en-tête `CF-Connecting-IP`), pas pour tout le tunnel.

## Le tunnel temporaire

Son adresse **change à chaque redémarrage** du tunnel (redémarrage du PC, par exemple). `demarrer.ps1` le détecte, puis :
1. met à jour l'adresse publique de l'auth ;
2. met à jour la variable du dépôt `VITE_SUPABASE_URL` ;
3. relance le déploiement du site.

Le site est donc indisponible pour les comptes **environ 2 minutes** après chaque redémarrage (le lecteur, lui, marche toujours). Une session restée ouverte chez un élève se reconnecte au rechargement de la page.

**Pour une adresse fixe** (recommandé avant d'ouvrir aux élèves), il faut un compte Cloudflare gratuit et un nom de domaine :
- on crée un tunnel nommé, par exemple `api.mondomaine.fr` ;
- l'adresse ne change plus, et le redéploiement à chaque redémarrage n'est plus nécessaire.

## Visio (LiveKit)

Les fonctions lisent `LIVEKIT_URL`, `LIVEKIT_WS_URL`, `LIVEKIT_API_KEY` et `LIVEKIT_API_SECRET` dans le `.env` du serveur. Pour LiveKit Cloud : `LIVEKIT_URL` et `LIVEKIT_WS_URL` = `wss://<projet>.livekit.cloud`. Après modification, relancer `demarrer.ps1` (ou `docker compose … up -d functions`). `demarrer.ps1` recopie aussi à chaque lancement les fonctions du dépôt (`supabase/functions`) vers le serveur.

## Opérations courantes

```powershell
# démarrer / vérifier (sans risque, peut être relancé)
powershell -ExecutionPolicy Bypass -File scripts\serveur\demarrer.ps1
# journal : %USERPROFILE%\halaqa-serveur\logs\demarrer.log et tunnel.log

# appliquer une nouvelle migration du dépôt
supabase db push --db-url "postgresql://postgres:<POSTGRES_PASSWORD>@127.0.0.1:54329/postgres?sslmode=disable"

# créer une invitation admin ou prof (hors interface)
docker exec supabase-db psql -U postgres -tAc "insert into public.staff_invitations (role) values ('teacher') returning code;"

# sauvegarde manuelle
powershell -ExecutionPolicy Bypass -File scripts\serveur\sauvegarder.ps1
```

`POSTGRES_PASSWORD` se trouve dans `%USERPROFILE%\halaqa-serveur\src\docker\.env`. **Garde une copie de ce fichier en lieu sûr** : sans lui, les sauvegardes restent lisibles, mais les sessions et les clés seraient à régénérer.

## Développement

La base de développement reste celle du CLI (`npm run db:start`, ports 54321/54322, comptes de démonstration). Elle est indépendante de ce serveur : on peut l'arrêter (`npx supabase stop`) pour libérer de la mémoire.

## Limites

- Le PC doit rester allumé et connecté pour que les comptes fonctionnent.
- Pas d'e-mails sortants : « mot de passe oublié » ne fonctionne pas encore. Un service SMTP gratuit (Brevo, Resend) se branche dans le `.env` du serveur.
- Si Docker Desktop n'est pas réglé pour démarrer à l'ouverture de session, c'est `demarrer.ps1` qui le lance (plus lent d'environ une minute).
