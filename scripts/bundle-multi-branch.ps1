function ConvertTo-IdempotentSql {
  param([string]$sql)
  $sql = [regex]::Replace($sql, '(?i)\badd column (?!if not exists)', 'add column if not exists')
  return $sql
}

$root = Split-Path -Parent $PSScriptRoot
$migrationsDir = Join-Path $root "supabase\migrations"
$stepsDir = Join-Path $migrationsDir "steps"
$outFile = Join-Path $migrationsDir "_APPLY_MULTI_BRANCH.sql"

$migrationFile = Join-Path $migrationsDir "20260610140000_multi_branch_tenant.sql"
$stepFile = Join-Path $stepsDir "07_multi_branch_tenant.sql"

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("-- MULTI-BRANCH TENANT BUNDLE")
[void]$sb.AppendLine("-- Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm')")
[void]$sb.AppendLine("-- Each clinic = one organization. Branches = locations under that org.")
[void]$sb.AppendLine("-- Run in Supabase SQL Editor, then Settings -> API -> Reload schema")
[void]$sb.AppendLine("")

if (Test-Path $migrationFile) {
  [void]$sb.AppendLine("-- === migration: 20260610140000_multi_branch_tenant.sql ===")
  $raw = Get-Content $migrationFile -Raw -Encoding UTF8
  [void]$sb.AppendLine((ConvertTo-IdempotentSql $raw))
} elseif (Test-Path $stepFile) {
  [void]$sb.AppendLine((Get-Content $stepFile -Raw -Encoding UTF8))
}

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($outFile, $sb.ToString(), $utf8NoBom)
Write-Host "Wrote $outFile ($((Get-Item $outFile).Length) bytes)"
