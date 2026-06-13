# Tek dosyada uygulanabilir MASTER bundle (hasta + multi-branch)
# Consent signing zaten patient bundle icinde (step 04) — ayri eklenmez.
# Kullanim: npm run db:bundle:master

$root = Split-Path -Parent $PSScriptRoot
$migrationsDir = Join-Path $root "supabase\migrations"
$outFile = Join-Path $migrationsDir "_APPLY_MASTER.sql"

& (Join-Path $PSScriptRoot "bundle-patient-complete.ps1")
if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& (Join-Path $PSScriptRoot "bundle-multi-branch.ps1")
if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$parts = @(
  (Join-Path $migrationsDir "_APPLY_PATIENT_COMPLETE.sql"),
  (Join-Path $migrationsDir "_APPLY_MULTI_BRANCH.sql")
)

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("-- DENTALI MASTER APPLY BUNDLE")
[void]$sb.AppendLine("-- Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm')")
[void]$sb.AppendLine("-- Icerik: hasta modulu + kagit consent + multi-branch tenant")
[void]$sb.AppendLine("-- Supabase SQL Editor'da TEK seferde calistir, sonra Settings -> API -> Reload schema")
[void]$sb.AppendLine("-- Not: /sign/[token] RPC'leri patient bundle icinde (step 04) zaten var.")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("SET client_min_messages TO WARNING;")
[void]$sb.AppendLine("")

foreach ($path in $parts) {
  if (-not (Test-Path $path)) {
    Write-Error "Missing bundle: $path. Run: npm run db:bundle:patient; npm run db:bundle:multi-branch"
    exit 1
  }
  [void]$sb.AppendLine("-- ######################################################################")
  [void]$sb.AppendLine("-- BEGIN $(Split-Path $path -Leaf)")
  [void]$sb.AppendLine("-- ######################################################################")
  [void]$sb.AppendLine("")
  [void]$sb.AppendLine((Get-Content $path -Raw -Encoding UTF8))
  [void]$sb.AppendLine("")
}

$stepsDir = Join-Path $root "supabase\migrations\steps"
$diagPath = Join-Path $stepsDir "00_diagnose.sql"
if (Test-Path $diagPath) {
  [void]$sb.AppendLine("-- ######################################################################")
  [void]$sb.AppendLine("-- END: full diagnose (all modules)")
  [void]$sb.AppendLine("-- ######################################################################")
  [void]$sb.AppendLine("")
  [void]$sb.AppendLine((Get-Content $diagPath -Raw -Encoding UTF8))
  [void]$sb.AppendLine("")
}

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($outFile, $sb.ToString(), $utf8NoBom)
Write-Host "Wrote $outFile ($((Get-Item $outFile).Length) bytes)"
