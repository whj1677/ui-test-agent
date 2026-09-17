$ErrorActionPreference = 'Stop'
$agentNode = Get-Command node -ErrorAction SilentlyContinue
if (-not $agentNode) { throw '未找到 Node.js。请按 试用说明.md 安装 Node.js 22+。' }
& $agentNode.Source (Join-Path $PSScriptRoot 'src/installation.mjs') doctor
exit $LASTEXITCODE
