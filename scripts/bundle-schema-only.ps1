# Schema-only bundle — tablolar, kolonlar, index, policy, trigger (RPC YOK)
# Functions-only sonrasi eksik tablo/kolon icin: npm run db:bundle:schema
# Supabase SQL Editor'da _APPLY_SCHEMA_ONLY.sql calistir

function ConvertTo-IdempotentSql([string]$sql) {
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

  $sql = [regex]::Replace(
    $sql,
    '(?im)^create unique index (?!if not exists)(\S+)',
    'create unique index if not exists $1'
  )

  $sql = [regex]::Replace(
    $sql,
    '(?im)^create index (?!if not exists)(\S+)',
    'create index if not exists $1'
  )

  $sql = [regex]::Replace($sql, '(?i)\badd column (?!if not exists)', 'add column if not exists')

  $sql = [regex]::Replace(
    $sql,
    '(?im)^create table (?!if not exists)(public\.\S+)',
    'create table if not exists $1'
  )

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

function Remove-FunctionBlocks([string]$sql) {
  # Strip CREATE OR REPLACE FUNCTION ... $$;
  $sql = [regex]::Replace($sql, '(?is)create\s+or\s+replace\s+function\s+public\.\w+.*?\$\$;\s*', '')
  # Strip GRANT EXECUTE on functions (already in _APPLY_FUNCTIONS_ONLY.sql)
  $sql = [regex]::Replace($sql, '(?im)^grant\s+execute\s+on\s+function\s+public\.\w+.*?;\s*', '')
  return $sql
}

$root = Split-Path -Parent $PSScriptRoot
$migrationsDir = Join-Path $root "supabase\migrations"
$outFile = Join-Path $migrationsDir "_APPLY_SCHEMA_ONLY.sql"

$exclude = @(
  "001_dental_tables.sql",
  "002_dental_rls_policies.sql",
  "003_dental_functions_triggers.sql"
)

$files = Get-ChildItem -Path $migrationsDir -Filter "*.sql" |
  Where-Object { $_.Name -notlike "_*" -and ($exclude -notcontains $_.Name) } |
  Sort-Object Name

$header = @"
-- AUTO-GENERATED SCHEMA BUNDLE: $($files.Count) migration dosyasi (RPC haric)
-- Functions-only sonrasi eksik tablo/kolon icin Supabase SQL Editor'da calistir.
-- Ornek fix: patient_intakes, waitlist_entries.slot_alert_sent_at
-- Sonra: scripts/check-missing-schema.sql ile dogrula
-- Kalici cozum: npx supabase login && npm run db:link && npm run db:push

SET client_min_messages TO WARNING;

"@

$header | Set-Content -Path $outFile -Encoding UTF8

foreach ($f in $files) {
  $raw = Get-Content -Path $f.FullName -Raw
  $schema = Remove-FunctionBlocks $raw
  $schema = ConvertTo-IdempotentSql $schema
  # Skip empty migration files after function strip
  if ($schema -match '(?im)(create\s+table|alter\s+table|create\s+(unique\s+)?index|create\s+policy|insert\s+into|alter\s+publication|create\s+type|enable\s+row\s+level)') {
    "`n-- ===== $($f.Name) =====`n" | Add-Content -Path $outFile -Encoding UTF8
    $schema | Add-Content -Path $outFile -Encoding UTF8
  }
}

Write-Host "Wrote $outFile (schema DDL from $($files.Count) files)"
