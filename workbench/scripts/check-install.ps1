[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node -or [int](& $node.Source -p 'parseInt(process.versions.node)') -lt 22) { throw 'Node.js 22+ 未就绪。' }
foreach ($relative in @('.', 'workbench', 'harness-probe')) {
    $directory = [System.IO.Path]::GetFullPath((Join-Path $repoRoot $relative))
    & npm.cmd --prefix $directory ls --omit=dev --depth=0 --parseable 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "$relative 锁定依赖未就绪，请运行 安装.cmd。" }
    Write-Output "依赖就绪：$relative"
}
$dsh = Join-Path $repoRoot 'harness-probe/node_modules/@deepseek-ai/dsh/lib/bin.js'
if (-not (Test-Path -LiteralPath $dsh -PathType Leaf)) { throw 'Harness DSH 程序未就绪。' }
$workbenchRoot = Join-Path $repoRoot 'workbench'
Push-Location -LiteralPath $workbenchRoot
try { $browser = & $node.Source -p "require('./node_modules/playwright').chromium.executablePath()" }
finally { Pop-Location }
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $browser -PathType Leaf)) { throw 'Playwright Chromium 未就绪，请运行 安装.cmd。' }
Write-Output "Chromium 就绪：$browser"
Write-Output '静态诊断完成；未启动工作台、被测站点或模型。'
