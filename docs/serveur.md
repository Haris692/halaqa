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

## Visio (LiveKit sur ce PC)

Mis en place le 15/11/2026, sans compte ni redirection de port sur la box.

| Élément | Où | Rôle |
|---|---|---|
| `livekit-server.exe` 1.13.11 (Windows natif, ~40 Mo de mémoire) | `%USERPROFILE%\halaqa-serveur\livekit` (hors dépôt : `livekit.yaml` contient le secret) | serveur vidéo. Signalisation sur `127.0.0.1:7890`, vidéo en UDP sur le port 7882 |
| Second tunnel Cloudflare temporaire | vers `127.0.0.1:7890` | adresse `wss://…trycloudflare.com` donnée aux navigateurs, écrite dans `livekit\url.txt` |

**Comment la vidéo passe sans ouvrir de port.**
- LiveKit découvre l'IPv4 publique de la box par STUN.
- Il s'annonce aussi par ses adresses IPv6.
- La connexion s'ouvre par **traversée de NAT** (comme un appel vidéo entre deux PC), en UDP direct.
- La Freebox le permet ; la vérification que LiveKit fait sur sa propre adresse est désactivée (`skip_external_ip_validation`), car le pare-feu bloque cette auto-vérification.

**`demarrer.ps1` gère tout.**
- Il lance LiveKit et son tunnel.
- Il écrit dans le `.env` du serveur :
  - `LIVEKIT_URL=http://host.docker.internal:7890`, l'API vue des fonctions ;
  - `LIVEKIT_WS_URL`, l'adresse du tunnel ;
  - la clé et le secret, lus dans `livekit.yaml`.
- Il recrée ensuite le conteneur des fonctions.
- Le site n'a pas besoin d'être redéployé quand l'adresse du tunnel LiveKit change : elle est donnée avec chaque jeton.
- `demarrer.ps1` recopie aussi, à chaque lancement, les fonctions du dépôt (`supabase/functions`) vers le serveur.

**Tester depuis un réseau extérieur** (une machine GitHub rejoint une salle jetable avec caméra et micro simulés, et vérifie la réception) :
```powershell
powershell -ExecutionPolicy Bypass -File scripts\serveur\test-visio.ps1
```

**Limites.**
- Pas de serveur relais (TURN), ni de repli TCP. Un élève derrière un réseau très fermé peut ne pas recevoir la vidéo, alors que le reste de la séance fonctionne : réseau d'entreprise ou d'école qui bloque l'UDP, ou certains réseaux 4G à NAT « symétrique ».
- Solution durable : LiveKit Cloud (offre gratuite). Il suffit de mettre ses quatre valeurs dans le `.env` et de retirer `livekit.yaml` pour que `demarrer.ps1` ne les écrase plus.
- Si Windows affiche « Le pare-feu a bloqué certaines fonctionnalités de livekit-server », on peut accepter ou annuler : la vidéo marche dans les deux cas.

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
