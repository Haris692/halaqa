# Démarre le serveur Halaqa sur ce PC : Supabase auto-hébergé (Docker) + tunnel Cloudflare.
#
# Si l'adresse du tunnel temporaire a changé (elle change à chaque redémarrage
# du tunnel), le script met à jour l'authentification, la variable du dépôt
# GitHub et relance le déploiement du site (~2 min).
#
# Usage : powershell -ExecutionPolicy Bypass -File scripts\serveur\demarrer.ps1
# Lancé automatiquement à l'ouverture de session (tâche planifiée « Halaqa serveur »).

param(
  [string]$ServerDir = "$env:USERPROFILE\halaqa-serveur\src\docker",
  [string]$Repo = "haris692/halaqa"
)

# 'Continue' : docker et gh écrivent leurs messages sur stderr, ce n'est pas une erreur
$ErrorActionPreference = 'Continue'
$logDir = "$env:USERPROFILE\halaqa-serveur\logs"
New-Item -ItemType Directory -Force $logDir | Out-Null
$tunnelLog = Join-Path $logDir 'tunnel.log'
function Log($msg) { "$(Get-Date -Format s)  $msg" | Tee-Object -FilePath (Join-Path $logDir 'demarrer.log') -Append }

# 1. Docker Desktop
$dockerReady = { try { docker info --format '{{.ServerVersion}}' 2>$null | Out-Null; $LASTEXITCODE -eq 0 } catch { $false } }
if (-not (& $dockerReady)) {
  Log 'Démarrage de Docker Desktop…'
  Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  for ($i = 0; $i -lt 60 -and -not (& $dockerReady); $i++) { Start-Sleep -Seconds 5 }
  if (-not (& $dockerReady)) { Log 'Docker ne répond pas : abandon.'; exit 1 }
}

# 2. Supabase (base, auth, API REST, passerelle) — rien d'autre, pour ménager le PC
Push-Location $ServerDir
try {
  docker compose -p halaqa -f docker-compose.yml -f docker-compose.halaqa.yml up -d db auth rest api-gw | Out-Null
} finally { Pop-Location }
Log 'Supabase démarré.'

# 3. Tunnel Cloudflare temporaire (sans compte) vers la passerelle locale
$cloudflared = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
$running = Get-Process cloudflared -ErrorAction SilentlyContinue
if (-not $running) {
  Remove-Item $tunnelLog -ErrorAction SilentlyContinue
  Start-Process -FilePath $cloudflared -ArgumentList @('tunnel', '--no-autoupdate', '--url', 'http://127.0.0.1:8000', '--logfile', $tunnelLog) -WindowStyle Hidden
  Log 'Tunnel lancé.'
}
$url = $null
for ($i = 0; $i -lt 60 -and -not $url; $i++) {
  Start-Sleep -Seconds 1
  if (Test-Path $tunnelLog) {
    $m = Select-String -Path $tunnelLog -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -Last 1
    if ($m) { $url = $m.Matches[0].Value }
  }
}
if (-not $url) { Log 'Adresse du tunnel introuvable (voir tunnel.log).'; exit 1 }
Log "Tunnel : $url"

# 4. Adresse publique dans la config Supabase (liens envoyés par l'authentification)
$envFile = Join-Path $ServerDir '.env'
$envText = Get-Content $envFile -Raw
if ($envText -notmatch [regex]::Escape("SUPABASE_PUBLIC_URL=$url")) {
  $envText = $envText -replace '(?m)^SUPABASE_PUBLIC_URL=.*$', "SUPABASE_PUBLIC_URL=$url"
  $envText = $envText -replace '(?m)^API_EXTERNAL_URL=.*$', "API_EXTERNAL_URL=$url/auth/v1"
  [IO.File]::WriteAllText($envFile, $envText)
  Push-Location $ServerDir
  try { docker compose -p halaqa -f docker-compose.yml -f docker-compose.halaqa.yml up -d auth api-gw | Out-Null } finally { Pop-Location }
  Log 'Config Supabase mise à jour.'
}

# 5. Site : variable du dépôt + redéploiement si l'adresse a changé
$current = (cmd /c "gh variable get VITE_SUPABASE_URL --repo $Repo 2>nul")
if ($current -ne $url) {
  $anon = ([regex]::Match($envText, '(?m)^ANON_KEY=(.*)$')).Groups[1].Value.Trim()
  gh variable set VITE_SUPABASE_URL --repo $Repo --body $url | Out-Null
  gh variable set VITE_SUPABASE_PUBLISHABLE_KEY --repo $Repo --body $anon | Out-Null
  gh workflow run deploy.yml --repo $Repo --ref main | Out-Null
  Log 'Variables GitHub mises à jour, déploiement relancé (~2 min).'
} else {
  Log 'Site déjà branché sur cette adresse.'
}
