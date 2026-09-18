$ErrorActionPreference = 'Stop'
$labScript = Join-Path $PSScriptRoot 'serve.mjs'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js 22 or newer is required. Install the project dependencies first.'
}
& node $labScript
if ($LASTEXITCODE -ne 0) { throw 'Manual lab failed to start. See the message above.' }
