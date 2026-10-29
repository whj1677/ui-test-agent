# The packaged runtime is always selected before PATH. This file never downloads
# software, changes a global Harness installation, or reads credentials.
function Get-WorkbenchListeners {
  param([int]$Port = 4322)
  # Read the OS TCP table without loading the slow NetTCPIP/CIM module.
  return @([Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() | Where-Object { $_.Port -eq $Port })
}

function Get-WorkbenchRuntime {
  param([Parameter(Mandatory=$true)][string]$Root)
  # Node emits UTF-8 paths. Windows PowerShell 5.1 otherwise decodes native
  # stdout with the active code page and corrupts Chinese installation paths.
  [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
  $resolvedRoot = [System.IO.Path]::GetFullPath($Root)
  $portableManifest = Join-Path $resolvedRoot 'portable-manifest.json'
  $nodePath = Join-Path $resolvedRoot 'runtime/node/node.exe'
  $bundled = Test-Path -LiteralPath $portableManifest -PathType Leaf
  if ($bundled) {
    if (-not (Test-Path -LiteralPath $nodePath -PathType Leaf)) { throw '便携包 Node 运行时缺失，请重新取得完整程序包。' }
    $env:PATH = (Split-Path -Parent $nodePath) + [System.IO.Path]::PathSeparator + $env:PATH
    $env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $resolvedRoot 'runtime/browsers'
  } else {
    $command = Get-Command node -ErrorAction SilentlyContinue
    if (-not $command) { throw '源码安装需要 Node.js 22+；便携包已自带 Node，不应缺少 portable-manifest.json。' }
    $nodePath = $command.Source
  }
  if ([int](& $nodePath -p 'parseInt(process.versions.node)') -lt 22) { throw '需要 Node.js 22 或更高版本。' }
  return @{ Root=$resolvedRoot; Node=$nodePath; Portable=$bundled; Browsers=(Join-Path $resolvedRoot 'runtime/browsers') }
}

function Get-WorkbenchNativeDsh {
  param([Parameter(Mandatory=$true)][string]$Root, [Parameter(Mandatory=$true)][string]$Node)
  $identity = & $Node (Join-Path $Root 'workbench/scripts/native-dsh-package.mjs') $Root
  if ($LASTEXITCODE -ne 0) { throw '原生 DSH 锁定依赖未就绪，请运行安装入口；不会查找用户私有 CLI。' }
  return ($identity | ConvertFrom-Json)
}
