# Birleşik SQL — Supabase Dashboard > SQL Editor'da TEK seferde çalıştır (db push alternatifi)
# Kullanım: .\scripts\bundle-migrations.ps1

$root = Split-Path -Parent $PSScriptRoot
$migrationsDir = Join-Path $root "supabase\migrations"
$outFile = Join-Path $migrationsDir "_APPLY_ALL_PENDING.sql"

$files = Get-ChildItem -Path $migrationsDir -Filter "*.sql" |
  Where-Object { $_.Name -notlike "_*" } |
  Sort-Object Name

$header = @"
-- AUTO-GENERATED: $($files.Count) migration dosyasi (sirali)
-- Supabase Dashboard > SQL Editor > Run
-- Not: Bazi satirlar "already exists" verebilir; guvenli olanlar idempotent.
-- Tercih edilen yol: npm run db:push

"@

$header | Set-Content -Path $outFile -Encoding UTF8

foreach ($f in $files) {
  "`n-- ===== $($f.Name) =====`n" | Add-Content -Path $outFile -Encoding UTF8
  Get-Content -Path $f.FullName -Raw | Add-Content -Path $outFile -Encoding UTF8
}

Write-Host "Wrote $outFile ($($files.Count) files)"
