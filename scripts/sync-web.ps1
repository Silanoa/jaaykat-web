$Root = Split-Path -Parent $PSScriptRoot
$Dest = if ($args.Count -gt 0) { $args[0] } else { Join-Path (Split-Path -Parent $Root) "jaaykat-api\public" }
Push-Location $Root
try {
  pnpm build
  New-Item -ItemType Directory -Force -Path $Dest | Out-Null
  Get-ChildItem -Force $Dest | Remove-Item -Recurse -Force
  Copy-Item -Recurse -Force (Join-Path $Root "dist\*") $Dest
  Write-Host "dist copié vers $Dest"
} finally {
  Pop-Location
}
