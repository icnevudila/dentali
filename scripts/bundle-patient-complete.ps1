# Patient modulu — tek SQL bundle (Supabase SQL Editor)
# Kullanim: npm run db:bundle:patient

function ConvertTo-IdempotentSql {
  param([string]$sql)
  $sql = [regex]::Replace(
    $sql,
    '(?im)^create policy\s+("?[A-Za-z_][A-Za-z0-9_]*"?)\s+on\s+((?:public|storage)\.[A-Za-z_][A-Za-z0-9_]*)',
    {
      param($m)
      $name = $m.Groups[1].Value
      $table = $m.Groups[2].Value
      "drop policy if exists $name on $table;`r`n$($m.Value)"
    }
  )
  $sql = [regex]::Replace($sql, '(?im)^create unique index (?!if not exists)(\S+)', 'create unique index if not exists $1')
  $sql = [regex]::Replace($sql, '(?im)^create index (?!if not exists)(\S+)', 'create index if not exists $1')
  $sql = [regex]::Replace($sql, '(?i)\badd column (?!if not exists)', 'add column if not exists')
  $sql = [regex]::Replace($sql, '(?im)^create table (?!if not exists)(public\.\S+)', 'create table if not exists $1')
  $sql = [regex]::Replace(
    $sql,
    '(?im)^create trigger\s+("?[A-Za-z_][A-Za-z0-9_]*"?)\s+(?:before|after|instead of)\s+\S+\s+on\s+(public\.\S+)',
    {
      param($m)
      $name = $m.Groups[1].Value
      $table = $m.Groups[2].Value
      "drop trigger if exists $name on $table;`r`n$($m.Value)"
    }
  )
  return $sql
}

$root = Split-Path -Parent $PSScriptRoot
$stepsDir = Join-Path $root "supabase\migrations\steps"
$migrationsDir = Join-Path $root "supabase\migrations"
$outFile = Join-Path $migrationsDir "_APPLY_PATIENT_COMPLETE.sql"

$prerequisiteStep = "01_prerequisites.sql"

$stepFiles = @(
  "02_search_patients.sql",
  "03_consent_templates.sql",
  "04_consent_signing_rpcs.sql",
  "05_dedupe_consent_templates.sql",
  "06_full_paper_consent_forms.sql"
)

$extraMigrations = @(
  "20260610000000_consent_fields_and_signing_tokens.sql",
  "20260610100000_search_patients_filters.sql",
  "20260610100001_fix_patients_rls_recursion.sql",
  "20260610120000_clinic_paper_consent_templates.sql"
)

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("-- PATIENT MODULE COMPLETE BUNDLE")
[void]$sb.AppendLine("-- Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm')")
[void]$sb.AppendLine("-- Run in Supabase SQL Editor, then Settings -> API -> Reload schema")
[void]$sb.AppendLine("")

$prereqPath = Join-Path $stepsDir $prerequisiteStep
if (Test-Path $prereqPath) {
  [void]$sb.AppendLine("-- === step: $prerequisiteStep (once, before consent upserts) ===")
  [void]$sb.AppendLine((Get-Content $prereqPath -Raw -Encoding UTF8))
  [void]$sb.AppendLine("")
}

foreach ($name in $extraMigrations) {
  $path = Join-Path $migrationsDir $name
  if (-not (Test-Path $path)) { continue }
  [void]$sb.AppendLine("-- === migration: $name ===")
  $raw = Get-Content $path -Raw -Encoding UTF8
  [void]$sb.AppendLine((ConvertTo-IdempotentSql $raw))
  [void]$sb.AppendLine("")
}

foreach ($name in $stepFiles) {
  $path = Join-Path $stepsDir $name
  if (-not (Test-Path $path)) {
    Write-Warning "Missing step: $name"
    continue
  }
  [void]$sb.AppendLine("-- === step: $name ===")
  $raw = Get-Content $path -Raw -Encoding UTF8
  [void]$sb.AppendLine($raw)
  [void]$sb.AppendLine("")
}

[void]$sb.AppendLine("-- === diagnose (read-only) - check results ===")
$diagPath = Join-Path $stepsDir "00_diagnose_patient.sql"
if (Test-Path $diagPath) {
  [void]$sb.AppendLine((Get-Content $diagPath -Raw -Encoding UTF8))
}

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($outFile, $sb.ToString(), $utf8NoBom)
Write-Host "Wrote $outFile ($((Get-Item $outFile).Length) bytes)"
