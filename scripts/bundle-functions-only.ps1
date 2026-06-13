# Sadece public RPC (CREATE OR REPLACE FUNCTION) — mevcut tablo/policy'lere dokunmaz.
# Kullanim: npm run db:bundle:functions
# Supabase SQL Editor'da _APPLY_FUNCTIONS_ONLY.sql calistir, sonra check-missing-rpcs.sql ile dogrula.

$root = Split-Path -Parent $PSScriptRoot
$migrationsDir = Join-Path $root "supabase\migrations"
$outFile = Join-Path $migrationsDir "_APPLY_FUNCTIONS_ONLY.sql"

$exclude = @(
  "001_dental_tables.sql",
  "002_dental_rls_policies.sql",
  "003_dental_functions_triggers.sql"
)

$files = Get-ChildItem -Path $migrationsDir -Filter "*.sql" |
  Where-Object { $_.Name -notlike "_*" -and ($exclude -notcontains $_.Name) } |
  Sort-Object Name

$fnPattern = '(?is)create\s+or\s+replace\s+function\s+public\.\w+.*?\$\$;'
$grantPattern = '(?im)^grant\s+execute\s+on\s+function\s+public\.\w+.*?;'

$header = @"
-- AUTO-GENERATED: Sadece RPC fonksiyonlari ($($files.Count) migration dosyasindan)
-- Tablo / policy / trigger YOK — kismi uygulanmis DB icin guvenli.
-- Sonra: scripts/check-missing-rpcs.sql ile MISSING kalmadigini kontrol et.
-- Kalici cozum: npx supabase login && npm run db:link && npm run db:push

SET client_min_messages TO WARNING;

"@

$blocks = New-Object System.Collections.Generic.List[string]
$grantLines = New-Object System.Collections.Generic.List[string]

foreach ($f in $files) {
  $raw = Get-Content -Path $f.FullName -Raw
  foreach ($m in [regex]::Matches($raw, $fnPattern)) {
    $blocks.Add($m.Value.Trim())
  }
  foreach ($m in [regex]::Matches($raw, $grantPattern)) {
    $grantLines.Add($m.Value.Trim())
  }
}

$header | Set-Content -Path $outFile -Encoding UTF8

foreach ($b in $blocks) {
  "`n-- -----`n$b`n" | Add-Content -Path $outFile -Encoding UTF8
}

if ($grantLines.Count -gt 0) {
  "`n-- ===== GRANTS =====`n" | Add-Content -Path $outFile -Encoding UTF8
  $grantLines | Select-Object -Unique | ForEach-Object {
    $_ | Add-Content -Path $outFile -Encoding UTF8
  }
}

Write-Host "Wrote $outFile ($($blocks.Count) functions, $($grantLines.Count) grant lines)"
