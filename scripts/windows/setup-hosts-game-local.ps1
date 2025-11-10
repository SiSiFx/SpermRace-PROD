$ErrorActionPreference = 'Stop'

Write-Host "Adding hosts entry for game.local -> 127.0.0.1 (admin required)"

$hosts = "$env:SystemRoot\System32\drivers\etc\hosts"
$entry = "127.0.0.1`tgame.local"
$content = Get-Content -Raw -Path $hosts
if ($content -notmatch "game\.local") {
	Add-Content -Path $hosts -Value $entry
	Write-Host "Added: $entry"
} else {
	Write-Host "Entry already exists"
}






