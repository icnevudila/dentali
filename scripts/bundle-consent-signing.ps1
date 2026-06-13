function ConvertTo-IdempotentSql {
  param([string]$sql)
  $sql = [regex]::Replace($sql, '(?i)\badd column (?!if not exists)', 'add column if not exists')
  $sql = [regex]::Replace($sql, '(?im)^create table (?!if not exists)(public\.\S+)', 'create table if not exists $1')
  return $sql
}

$root = Split-Path -Parent $PSScriptRoot
$stepsDir = Join-Path $root "supabase\migrations\steps"
$outFile = Join-Path $root "supabase\migrations\_APPLY_CONSENT_SIGNING.sql"

$files = @(
  "01_prerequisites.sql",
  "04_consent_signing_rpcs.sql"
)

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("-- CONSENT SIGNING BUNDLE (public /sign/[token] RPCs)")
[void]$sb.AppendLine("-- Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm')")
[void]$sb.AppendLine("-- Run in Supabase SQL Editor, then Settings -> API -> Reload schema")
[void]$sb.AppendLine("")

foreach ($name in $files) {
  $path = Join-Path $stepsDir $name
  if (-not (Test-Path $path)) {
    Write-Error "Missing $path"
    exit 1
  }
  [void]$sb.AppendLine("-- === step: $name ===")
  $raw = Get-Content $path -Raw -Encoding UTF8
  [void]$sb.AppendLine((ConvertTo-IdempotentSql $raw))
  [void]$sb.AppendLine("")
}

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($outFile, $sb.ToString(), $utf8NoBom)
Write-Host "Wrote $outFile ($((Get-Item $outFile).Length) bytes)"
