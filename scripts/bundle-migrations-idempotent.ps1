# Idempotent migration bundle — Supabase SQL Editor'da TEK seferde, tekrar calistirilabilir
# Kullanim: npm run db:bundle:idempotent

function ConvertTo-IdempotentSql([string]$sql) {
  # CREATE POLICY -> DROP IF EXISTS + CREATE (public + storage)
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

  # CREATE UNIQUE INDEX -> IF NOT EXISTS
  $sql = [regex]::Replace(
    $sql,
    '(?im)^create unique index (?!if not exists)(\S+)',
    'create unique index if not exists $1'
  )

  # CREATE INDEX -> IF NOT EXISTS
  $sql = [regex]::Replace(
    $sql,
    '(?im)^create index (?!if not exists)(\S+)',
    'create index if not exists $1'
  )

  # ADD COLUMN -> IF NOT EXISTS
  $sql = [regex]::Replace($sql, '(?i)\badd column (?!if not exists)', 'add column if not exists')

  # CREATE TABLE -> IF NOT EXISTS (public schema)
  $sql = [regex]::Replace(
    $sql,
    '(?im)^create table (?!if not exists)(public\.\S+)',
    'create table if not exists $1'
  )

  # CREATE TRIGGER -> DROP IF EXISTS first
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
$migrationsDir = Join-Path $root "supabase\migrations"
$outFile = Join-Path $migrationsDir "_APPLY_ALL_IDEMPOTENT.sql"

# Eski dental pack + duplicate foundation haric (zaten prod'da varsa cakismayi azaltir)
$exclude = @(
  "001_dental_tables.sql",
  "002_dental_rls_policies.sql",
  "003_dental_functions_triggers.sql"
)

$files = Get-ChildItem -Path $migrationsDir -Filter "*.sql" |
  Where-Object { $_.Name -notlike "_*" -and ($exclude -notcontains $_.Name) } |
  Sort-Object Name

$preflightFile = Join-Path $PSScriptRoot "bundle-preflight-drops.sql"
$preflight = if (Test-Path $preflightFile) { Get-Content -Path $preflightFile -Raw } else { "" }

$header = @"
-- AUTO-GENERATED IDEMPOTENT BUNDLE: $($files.Count) migration dosyasi
-- Supabase Dashboard > SQL Editor > Run (TEK SEFERDE — ayri repair script gerekmez)
-- Tekrar calistirmak guvenli: preflight drops + policy/index/column cakismalari onlenir.
-- Tercih: npm run db:push

SET client_min_messages TO WARNING;

"@

$header | Set-Content -Path $outFile -Encoding UTF8

if ($preflight.Trim().Length -gt 0) {
  "`n-- ===== PREFLIGHT DROPS (bundle-preflight-drops.sql) =====`n" | Add-Content -Path $outFile -Encoding UTF8
  $preflight.TrimEnd() | Add-Content -Path $outFile -Encoding UTF8
}

foreach ($f in $files) {
  "`n-- ===== $($f.Name) =====`n" | Add-Content -Path $outFile -Encoding UTF8
  $raw = Get-Content -Path $f.FullName -Raw
  ConvertTo-IdempotentSql $raw | Add-Content -Path $outFile -Encoding UTF8
}

Write-Host "Wrote $outFile ($($files.Count) files, idempotent)"
