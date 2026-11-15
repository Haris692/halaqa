# Sauvegarde de la base Halaqa (comptes, classes, progression, notes) dans
# %USERPROFILE%\halaqa-serveur\sauvegardes, en gardant les 30 dernières.
# Lancé chaque nuit par la tâche planifiée « Halaqa sauvegarde ».
#
# Restauration (serveur neuf, après `supabase db push` des migrations du dépôt) :
#   Get-Content <fichier.sql> | docker exec -i supabase-db psql -U supabase_admin -d postgres
# (supabase_admin car le fichier désactive les déclencheurs le temps de la restauration :
#  sinon le contrôle d'invitation refuserait de recréer les comptes)

param([int]$Keep = 30)
$ErrorActionPreference = 'Continue'
$dir = "$env:USERPROFILE\halaqa-serveur\sauvegardes"
New-Item -ItemType Directory -Force $dir | Out-Null
$file = Join-Path $dir ("halaqa-{0}.sql" -f (Get-Date -Format 'yyyy-MM-dd_HHmm'))

# Données des schémas utiles : auth (comptes) et public (application).
# --data-only : le schéma vient des migrations du dépôt (supabase/migrations).
# Écrit dans le conteneur puis copie : copie à l'octet près (pas de réencodage par la console).
docker exec supabase-db pg_dump -U supabase_admin -d postgres --data-only --disable-triggers --schema=auth --schema=public `
  --exclude-table=auth.schema_migrations --exclude-table=auth.audit_log_entries -f /tmp/halaqa-sauvegarde.sql
docker cp supabase-db:/tmp/halaqa-sauvegarde.sql $file
docker exec supabase-db rm -f /tmp/halaqa-sauvegarde.sql

if (-not (Test-Path $file) -or (Get-Item $file).Length -lt 1000) {
  "$(Get-Date -Format s)  Échec de la sauvegarde (fichier vide)" | Out-File "$dir\erreurs.log" -Append
  Remove-Item $file -ErrorAction SilentlyContinue
  exit 1
}
Get-ChildItem $dir -Filter 'halaqa-*.sql' | Sort-Object Name -Descending | Select-Object -Skip $Keep | Remove-Item
