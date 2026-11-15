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

# 2. Fonctions (jetons LiveKit, talqîn) : copie depuis le dépôt, sans les fichiers .env locaux
$repoFunctions = Join-Path $PSScriptRoot '..\..\supabase\functions'
$serverFunctions = Join-Path $ServerDir 'volumes\functions'
foreach ($name in @('_shared', 'livekit-token', 'livekit-moderation')) {
  robocopy (Join-Path $repoFunctions $name) (Join-Path $serverFunctions $name) /MIR /XF .env /NFL /NDL /NJH /NJS /NP | Out-Null
}

# 3. Supabase : base, auth, API REST, temps réel, fonctions, passerelle — rien d'autre, pour ménager le PC
$services = @('db', 'auth', 'rest', 'realtime', 'functions', 'api-gw')
Push-Location $ServerDir
try {
  docker compose -p halaqa -f docker-compose.yml -f docker-compose.halaqa.yml up -d @services | Out-Null
} finally { Pop-Location }
Log 'Supabase démarré.'

# 4. LiveKit (visio) : serveur natif Windows, la vidéo passe en UDP directement par la box
#    (port 7882, ouvert par la traversée de NAT comme un appel vidéo ordinaire, sans redirection de port)
$livekitDir = "$env:USERPROFILE\halaqa-serveur\livekit"
if ((Test-Path "$livekitDir\livekit-server.exe") -and -not (Get-Process livekit-server -ErrorAction SilentlyContinue)) {
  Start-Process -FilePath "$livekitDir\livekit-server.exe" -ArgumentList "--config `"$livekitDir\livekit.yaml`"" -WorkingDirectory $livekitDir -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir 'livekit.log') -RedirectStandardError (Join-Path $logDir 'livekit.err.log')
  Log 'LiveKit lancé.'
}

# 5. Tunnels Cloudflare temporaires (sans compte) : API Supabase (8000) et signalisation LiveKit (7890)
$cloudflared = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
function Start-Tunnel([int]$port, [string]$logFile) {
  $running = Get-CimInstance Win32_Process -Filter "name='cloudflared.exe'" | Where-Object { $_.CommandLine -match "127\.0\.0\.1:$port\b" }
  if (-not $running) {
    Remove-Item $logFile -ErrorAction SilentlyContinue
    Start-Process -FilePath $cloudflared -ArgumentList @('tunnel', '--no-autoupdate', '--url', "http://127.0.0.1:$port", '--logfile', $logFile) -WindowStyle Hidden
    Log "Tunnel $port lancé." | Out-Null
  }
  for ($i = 0; $i -lt 60; $i++) {
    if (Test-Path $logFile) {
      $m = Select-String -Path $logFile -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -Last 1
      if ($m) { return $m.Matches[0].Value }
    }
    Start-Sleep -Seconds 1
  }
  return $null
}
$url = Start-Tunnel 8000 $tunnelLog
if (-not $url) { Log 'Adresse du tunnel introuvable (voir tunnel.log).'; exit 1 }
Log "Tunnel : $url"
$livekitUrl = $null
if (Test-Path "$livekitDir\livekit.yaml") {
  $lkTunnel = Start-Tunnel 7890 (Join-Path $logDir 'tunnel-livekit.log')
  if ($lkTunnel) { $livekitUrl = $lkTunnel -replace '^https://', 'wss://'; [IO.File]::WriteAllText("$livekitDir\url.txt", $livekitUrl); Log "Visio : $livekitUrl" }
  else { Log 'Adresse du tunnel LiveKit introuvable (voir tunnel-livekit.log).' }
}
# 6. Adresse publique dans la config Supabase (liens envoyés par l'authentification)
$envFile = Join-Path $ServerDir '.env'
$envText = Get-Content $envFile -Raw
$before = $envText
$envText = $envText -replace '(?m)^SUPABASE_PUBLIC_URL=.*$', "SUPABASE_PUBLIC_URL=$url"
$envText = $envText -replace '(?m)^API_EXTERNAL_URL=.*$', "API_EXTERNAL_URL=$url/auth/v1"
# visio : clés lues dans livekit.yaml, API LiveKit en local, adresse publique = tunnel LiveKit
if ($livekitUrl -and ((Get-Content "$livekitDir\livekit.yaml" -Raw) -match '(?m)^keys:\s*\r?\n\s+(\S+):\s*(\S+)')) {
  $envText = $envText -replace '(?m)^LIVEKIT_URL=.*$', 'LIVEKIT_URL=http://host.docker.internal:7890'
  $envText = $envText -replace '(?m)^LIVEKIT_WS_URL=.*$', "LIVEKIT_WS_URL=$livekitUrl"
  $envText = $envText -replace '(?m)^LIVEKIT_API_KEY=.*$', "LIVEKIT_API_KEY=$($Matches[1])"
  $envText = $envText -replace '(?m)^LIVEKIT_API_SECRET=.*$', "LIVEKIT_API_SECRET=$($Matches[2])"
}
if ($envText -ne $before) {
  [IO.File]::WriteAllText($envFile, $envText)
  Push-Location $ServerDir
  try { docker compose -p halaqa -f docker-compose.yml -f docker-compose.halaqa.yml up -d auth functions api-gw | Out-Null } finally { Pop-Location }
  Log 'Config Supabase mise à jour.'
}

# 7. Site : variable du dépôt + redéploiement si l'adresse a changé
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
