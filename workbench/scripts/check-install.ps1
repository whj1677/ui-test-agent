[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
. (Join-Path $PSScriptRoot 'runtime-paths.ps1')
$runtime = Get-WorkbenchRuntime -Root $repoRoot
$node = @{ Source=$runtime.Node }
if ($runtime.Portable) {
    $net48 = Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full' -Name Release -ErrorAction SilentlyContinue
    if (-not $net48 -or [int]$net48.Release -lt 528040) { throw '设备授权组件需要 Windows .NET Framework 4.8。当前系统组件未就绪；此诊断不会联网修改系统。' }
    Write-Output '.NET Framework 4.8 系统组件就绪。'
}
if ($runtime.Portable) {
    & $runtime.Node (Join-Path $PSScriptRoot 'verify-portable.mjs') $repoRoot
    if ($LASTEXITCODE -ne 0) { throw '便携包字节核验未完成。' }
}
foreach ($relative in @('.', 'workbench', 'harness-probe', 'workbench/native')) {
    $directory = [System.IO.Path]::GetFullPath((Join-Path $repoRoot $relative))
    & $runtime.Node (Join-Path $PSScriptRoot 'verify-runtime-dependencies.mjs') $directory
    if ($LASTEXITCODE -ne 0) { throw "$relative 锁定依赖未就绪，请运行 安装.cmd。" }
    Write-Output "依赖就绪：$relative"
}
$dsh = Join-Path $repoRoot 'harness-probe/node_modules/@deepseek-ai/dsh/lib/bin.js'
if (-not (Test-Path -LiteralPath $dsh -PathType Leaf)) { throw 'Harness DSH 程序未就绪。' }
$nativeDsh = Get-WorkbenchNativeDsh -Root $repoRoot -Node $runtime.Node
Write-Output "原生 DSH 就绪：$($nativeDsh.version)；$($nativeDsh.binary)"
$workbenchRoot = Join-Path $repoRoot 'workbench'
Push-Location -LiteralPath $workbenchRoot
try { $browser = & $node.Source -p "require('./node_modules/playwright').chromium.executablePath()" }
finally { Pop-Location }
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $browser -PathType Leaf)) { throw 'Playwright Chromium 未就绪，请运行 安装.cmd。' }
Write-Output "Chromium 就绪：$browser"
Write-Output '静态诊断完成；未启动工作台、被测站点或模型。'
