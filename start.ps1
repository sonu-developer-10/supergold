Set-Location $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'Node.js is not installed. Please install Node.js 18+ first.'
  exit 1
}
if (-not (Test-Path 'node_modules')) {
  npm install
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
npm run dev
