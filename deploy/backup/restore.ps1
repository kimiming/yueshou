[CmdletBinding()]
param(
  [Parameter(Mandatory)] [ValidatePattern('^/backups/20\d{2}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z$')] [string] $BackupDirectory,
  [Parameter(Mandatory)] [ValidatePattern('^postgres(ql)?://')] [string] $TargetDatabaseUrl,
  [Parameter(Mandatory)] [ValidateSet('RESTORE')] [string] $ConfirmRestore,
  [switch] $ReplaceMinioObjects
)

$ErrorActionPreference = 'Stop'
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker CLI is required.' }
if ($TargetDatabaseUrl -match 'replace|example|placeholder') { throw 'TargetDatabaseUrl must be a real, explicitly supplied PostgreSQL URL.' }

$replace = if ($ReplaceMinioObjects) { 'true' } else { 'false' }
& docker compose --env-file .env.docker run --rm --no-deps --entrypoint /backup/restore.sh `
  -e "DATABASE_URL=$TargetDatabaseUrl" `
  -e 'RESTORE_CONFIRM=RESTORE' `
  -e "RESTORE_MINIO_REMOVE=$replace" `
  backup $BackupDirectory
if ($LASTEXITCODE -ne 0) { throw "Restore failed with Docker exit code $LASTEXITCODE." }
