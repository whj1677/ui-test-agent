[CmdletBinding()]
param([string]$RuntimeHome)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
. (Join-Path $PSScriptRoot 'runtime-paths.ps1')
$runtime = Get-WorkbenchRuntime -Root $repoRoot
if (-not $RuntimeHome) { $RuntimeHome = Join-Path $env:LOCALAPPDATA 'ui-test-agent/runtime' }
if (-not [System.IO.Path]::IsPathRooted($RuntimeHome)) { throw 'RuntimeHome 必须是绝对路径。' }
& $runtime.Node (Join-Path $PSScriptRoot 'native-entry.mjs') prepare --runtime-home ([System.IO.Path]::GetFullPath($RuntimeHome))
if ($LASTEXITCODE -ne 0) { throw '受管运行时初始化未完成，原配置和凭据保持；请检查锁定依赖。' }
Write-Output 'Harness 与原生 DSH 本地配置已准备；无下载、无模型调用，现有试跑开关与凭据保持。'
