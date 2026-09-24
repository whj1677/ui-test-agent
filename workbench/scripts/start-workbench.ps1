param(
  [ValidateSet('e2e', 'auth')]
  [string]$Data = 'e2e'
)
$ErrorActionPreference = 'Stop'
$workbenchRoot = Split-Path -Parent $PSScriptRoot
$port = 4322
$dataDirName = if ($Data -eq 'auth') { 'auth01-user-trial' } else { 'six-case-e2e' }
$dataDir = Join-Path $workbenchRoot (Join-Path '.local' $dataDirName)
if (-not (Test-Path -LiteralPath $dataDir)) {
  throw "数据目录不存在：$dataDir。请先从原工作树复制对应数据，两套数据不合并、不共写。"
}
$node = (Get-Command node -ErrorAction Stop).Source
if ([int](& $node -p 'parseInt(process.versions.node)') -lt 22) { throw '需要 Node.js 22 或更高版本。' }
$occupied = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($occupied) {
  $ownerPid = $occupied[0].OwningProcess
  $owner = (Get-Process -Id $ownerPid -ErrorAction SilentlyContinue)
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/health" -TimeoutSec 2
    Write-Output "端口 $port 已被进程 PID $ownerPid ($($owner.ProcessName)) 占用，服务标识：$($health.service)。"
    Write-Output "若这是本工作台正确实例，直接打开 http://127.0.0.1:$port/workspace/ 即可。"
  } catch {
    Write-Output "端口 $port 被其他程序 PID $ownerPid ($($owner.ProcessName)) 占用，本脚本不自动结束进程、不改用其他端口。"
  }
  exit 1
}
$env:WORKBENCH_PORT = [string]$port
$env:WORKBENCH_DATA_DIR = $dataDir
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not $env:DSH_PROBE_BROWSER_EXECUTABLE -and (Test-Path -LiteralPath $edge)) {
  $env:DSH_PROBE_BROWSER_EXECUTABLE = $edge
}
Write-Output "工作台代码目录：$workbenchRoot"
Write-Output "数据配置：$Data（$dataDir）"
Write-Output "入口：http://127.0.0.1:$port/workspace/ （前台运行，关闭本窗口即停止）"
Set-Location -LiteralPath $workbenchRoot
& $node (Join-Path $workbenchRoot 'server/index.mjs')
