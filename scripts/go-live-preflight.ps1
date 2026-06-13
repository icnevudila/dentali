# Go-live preflight — local checks before applying SQL or deploying edge functions
# Usage: powershell -ExecutionPolicy Bypass -File scripts/go-live-preflight.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "== Dentali go-live preflight ==" -ForegroundColor Cyan

Write-Host "`n[1/5] TypeScript check..."
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n[2/5] Migration bundle..."
npm run db:bundle:idempotent
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$bundle = Join-Path $root "supabase\migrations\_APPLY_ALL_IDEMPOTENT.sql"
if (-not (Test-Path $bundle)) {
  Write-Error "Bundle not found: $bundle"
}

$migrationCount = (Get-ChildItem (Join-Path $root "supabase\migrations\*.sql") |
  Where-Object { $_.Name -notlike "_*" }).Count

Write-Host "`n[3/5] Bundle stats"
Write-Host "  Individual migrations: $migrationCount"
Write-Host "  Bundle path: $bundle"

Write-Host "`n[4/5] Attention rule engine..."
npm run verify:attention
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n[5/5] Manual steps reminder"
Write-Host "  - Apply _APPLY_ALL_IDEMPOTENT.sql in Supabase SQL Editor"
Write-Host "  - Deploy edge functions + set secrets (see docs/DEPLOY_CHECKLIST.md)"
Write-Host "  - Configure cron jobs (see docs/SUPABASE_CRON_SETUP.md and scripts/cron-schedule-template.sql)"
Write-Host "  - Run smoke: docs/GO_LIVE_SMOKE.md"

Write-Host "`nPreflight OK." -ForegroundColor Green
