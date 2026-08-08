[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker CLI is required.' }

# The passphrase and all storage/database credentials remain in .env.docker.
& docker compose --env-file .env.docker run --rm --no-deps backup /backup/backup.sh
if ($LASTEXITCODE -ne 0) { throw "Backup failed with Docker exit code $LASTEXITCODE." }
