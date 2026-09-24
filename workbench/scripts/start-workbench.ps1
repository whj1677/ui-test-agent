[CmdletBinding()]
param(
  [ValidateSet('e2e', 'auth')]
  [string]$Data = 'e2e',
  # 本机启动配置文件（Git 忽略）。默认 scripts/start-workbench.local.json；模板见同目录 .example。
  [string]$ConfigPath,
  # 只加载并核对配置、输出安全摘要，不启动服务。
  # 退出码：0=满足启动条件；2=配置有效但 4322 被占用；1=配置或数据问题。
  [switch]$CheckOnly
)
$ErrorActionPreference = 'Stop'
$workbenchRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $workbenchRoot
$port = 4322
$dataDirName = if ($Data -eq 'auth') { 'auth01-user-trial' } else { 'six-case-e2e' }
$dataDir = Join-Path $workbenchRoot (Join-Path '.local' $dataDirName)

# ---- 配置来源与优先级 ------------------------------------------------------
# 四个服务入口依赖的变量只接受两个来源：
#   1. Git 忽略的本机配置文件（优先，避免旧终端残留变量静默覆盖）；
#   2. 继承的进程环境变量（仅当配置文件未提供该键时回退，并显式标注来源）。
# 配置文件中显式置为 null 的键表示“未绑定”，会清除同名残留变量，绝不静默套用旧值。
$managedKeys = @(
  'WORKBENCH_BUILD_AUTHORIZATION_ID',
  'WORKBENCH_DSH_HOME',
  'WORKBENCH_HARNESS_PATCH',
  'WORKBENCH_USE_STORED_DSH_CREDENTIALS'
)
if (-not $ConfigPath) { $ConfigPath = Join-Path $PSScriptRoot 'start-workbench.local.json' }
$fileValues = @{}
$configFileState = "缺失：$ConfigPath"
if (Test-Path -LiteralPath $ConfigPath) {
  $raw = (Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json)
  $profileNode = $raw.profiles.$Data
  if (-not $profileNode) { throw "配置文件 $ConfigPath 缺少 profiles.$Data 节点，请对照 start-workbench.local.json.example 补齐。" }
  foreach ($key in $managedKeys) {
    if ($profileNode.PSObject.Properties.Name -contains $key) { $fileValues[$key] = $profileNode.$key }
  }
  $configFileState = $ConfigPath
}

$effective = @{}
$sources = @{}
$warnings = New-Object System.Collections.Generic.List[string]
foreach ($key in $managedKeys) {
  $inherited = [Environment]::GetEnvironmentVariable($key, 'Process')
  if ($fileValues.ContainsKey($key)) {
    $value = $fileValues[$key]
    if ($null -eq $value -or "$value".Trim() -eq '') {
      if ($inherited) { $warnings.Add("终端残留变量 $key 与配置文件（显式未绑定）冲突，已按配置文件清除。") | Out-Null }
      Remove-Item -LiteralPath "Env:$key" -ErrorAction SilentlyContinue
      $effective[$key] = $null
      $sources[$key] = '配置文件（显式未绑定）'
    } else {
      if ($inherited -and $inherited -ne "$value") { $warnings.Add("终端残留变量 $key 与配置文件不一致，已按配置文件覆盖。") | Out-Null }
      $effective[$key] = "$value"
      $sources[$key] = '配置文件'
      Set-Item -LiteralPath "Env:$key" -Value "$value"
    }
  } elseif ($inherited) {
    $effective[$key] = $inherited
    $sources[$key] = '继承环境变量（配置文件未提供，存在残留风险）'
  } else {
    $effective[$key] = $null
    $sources[$key] = '未设置'
  }
}
# 服务端在 WORKBENCH_BUILD_AUTHORIZATION_ID 缺省时会回退读取 M2C_BUILD_AUTHORIZATION_ID；
# 当前配置未绑定授权时必须一并清除该残留，避免静默套用旧试点授权。
if (-not $effective['WORKBENCH_BUILD_AUTHORIZATION_ID'] -and $env:M2C_BUILD_AUTHORIZATION_ID) {
  $warnings.Add('当前数据配置未绑定建例授权，已清除残留的 M2C_BUILD_AUTHORIZATION_ID，避免套用旧试点授权。') | Out-Null
  Remove-Item -LiteralPath 'Env:M2C_BUILD_AUTHORIZATION_ID' -ErrorAction SilentlyContinue
}

# ---- 启动条件核对 ----------------------------------------------------------
$problems = New-Object System.Collections.Generic.List[string]
$dataReadable = $false
if (-not (Test-Path -LiteralPath $dataDir)) {
  $problems.Add("数据目录不存在：$dataDir。两套数据不合并、不共写，请确认归位数据完整。") | Out-Null
} else {
  $dataReadable = Test-Path -LiteralPath (Join-Path $dataDir (Join-Path 'data' 'catalog.json'))
  if (-not $dataReadable) { $problems.Add("数据目录存在但缺少 data/catalog.json：$dataDir。") | Out-Null }
}

$dshState = '未设置'
if ($effective['WORKBENCH_DSH_HOME']) {
  $dshHome = $effective['WORKBENCH_DSH_HOME']
  if (-not [System.IO.Path]::IsPathRooted($dshHome)) {
    $problems.Add("WORKBENCH_DSH_HOME 必须是绝对路径，当前值随启动目录漂移：$dshHome。") | Out-Null
  } elseif (-not (Test-Path -LiteralPath $dshHome)) {
    $problems.Add("WORKBENCH_DSH_HOME 指向的私有运行时不存在：$dshHome。该目录引用保留的原 DSH 运行时，不自动迁移；缺失时请明确报告，不换用其他目录。") | Out-Null
  } else {
    $dshState = "存在（$dshHome）"
  }
} else {
  $problems.Add('WORKBENCH_DSH_HOME 未配置，Harness 建例条件未就绪。') | Out-Null
}

$patchState = '未设置'
if ($effective['WORKBENCH_HARNESS_PATCH']) {
  $patchPath = $effective['WORKBENCH_HARNESS_PATCH']
  if (-not [System.IO.Path]::IsPathRooted($patchPath)) { $patchPath = Join-Path $repoRoot $patchPath }
  $patchPath = [System.IO.Path]::GetFullPath($patchPath)
  if (-not (Test-Path -LiteralPath $patchPath -PathType Leaf)) {
    $problems.Add("WORKBENCH_HARNESS_PATCH 指向的 patch 文件不存在：$patchPath。") | Out-Null
  } else {
    # 统一回写绝对路径，避免随启动目录漂移。
    Set-Item -LiteralPath 'Env:WORKBENCH_HARNESS_PATCH' -Value $patchPath
    $effective['WORKBENCH_HARNESS_PATCH'] = $patchPath
    $patchState = "存在（$patchPath）"
  }
} else {
  $problems.Add('WORKBENCH_HARNESS_PATCH 未配置，Harness 建例条件未就绪。') | Out-Null
}

$node = $null
try {
  $node = (Get-Command node -ErrorAction Stop).Source
  if ([int](& $node -p 'parseInt(process.versions.node)') -lt 22) { $problems.Add('需要 Node.js 22 或更高版本。') | Out-Null }
} catch {
  $problems.Add('未找到 node 命令。') | Out-Null
}

$occupied = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
$portState = "空闲（$port）"
$portBlocked = $false
if ($occupied) {
  $portBlocked = $true
  $ownerPid = $occupied[0].OwningProcess
  $owner = (Get-Process -Id $ownerPid -ErrorAction SilentlyContinue)
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/health" -TimeoutSec 2
    $portState = "已被 PID $ownerPid ($($owner.ProcessName)) 占用，服务标识：$($health.service)"
  } catch {
    $portState = "被其他程序 PID $ownerPid ($($owner.ProcessName)) 占用"
  }
}

# ---- 授权账本核对（只读既有账本，不创建或重置额度） -------------------------
$authorizationState = ''
$quotaState = ''
$buildTasksDir = Join-Path $dataDir 'build-tasks'
if ($effective['WORKBENCH_BUILD_AUTHORIZATION_ID']) {
  $authorizationId = $effective['WORKBENCH_BUILD_AUTHORIZATION_ID']
  $ledger = $null
  if (Test-Path -LiteralPath $buildTasksDir) {
    foreach ($file in (Get-ChildItem -LiteralPath $buildTasksDir -Filter '*authorization*.json' -ErrorAction SilentlyContinue)) {
      try {
        $record = Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json
        if ($record.authorization_id -eq $authorizationId) { $ledger = $record; break }
      } catch { }
    }
  }
  if ($ledger) {
    $remaining = $ledger.max_starts - $ledger.used_starts
    $authorizationState = "已绑定 $authorizationId（账本 $($ledger.used_starts)/$($ledger.max_starts)）"
    $quotaState = if ($remaining -gt 0) { "剩余 $remaining/$($ledger.max_starts)" } else { "已耗尽（$($ledger.used_starts)/$($ledger.max_starts)）" }
  } else {
    $authorizationState = "已绑定 $authorizationId，但数据目录内未找到对应账本文件"
    $quotaState = '未知（账本缺失，不能视为有额度）'
    $problems.Add("授权标识 $authorizationId 在 $buildTasksDir 中没有对应账本；只引用已有配置和账本，不创建新额度。") | Out-Null
  }
} else {
  $authorizationState = '未绑定建例授权'
  $quotaState = '无（建例条件未就绪；历史数据查看不受影响）'
}

# ---- 安全有效配置摘要（不输出凭据、通道令牌或会话状态） ---------------------
Write-Output "数据配置：$Data（$dataDir）"
Write-Output "配置文件：$configFileState"
foreach ($key in $managedKeys) {
  $shown = if ($effective[$key]) { $effective[$key] } else { '（未绑定）' }
  Write-Output ("  {0} = {1}    [来源：{2}]" -f $key, $shown, $sources[$key])
}
foreach ($warning in $warnings) { Write-Output "提示：$warning" }
Write-Output "配置已加载：$(if ($problems.Count -eq 0) { '是' } else { '部分（见下方问题）' })"
Write-Output "历史数据可读取：$(if ($dataReadable) { '是' } else { '否' })"
Write-Output "DSH 私有运行时：$dshState"
Write-Output "Harness patch：$patchState"
Write-Output "端口 ${port}：$portState"
Write-Output "建例授权：$authorizationState"
Write-Output "合法调用额度：$quotaState"
if ($Data -eq 'auth') {
  Write-Output '能力边界：auth 仅表示数据配置；AUTH 任务绑定尚未接通，不套用 e2e 授权，不支持登录建例。'
}

if ($problems.Count -gt 0) {
  foreach ($problem in $problems) { Write-Output "不满足启动条件：$problem" }
  exit 1
}
if ($portBlocked) {
  Write-Output "满足启动条件：否（端口 $port $portState；本脚本不自动结束进程、不改用其他端口）"
  if ($CheckOnly) { exit 2 }
  exit 1
}
Write-Output '满足启动条件：是'
if ($CheckOnly) { exit 0 }

$env:WORKBENCH_PORT = [string]$port
$env:WORKBENCH_DATA_DIR = $dataDir
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not $env:DSH_PROBE_BROWSER_EXECUTABLE -and (Test-Path -LiteralPath $edge)) {
  $env:DSH_PROBE_BROWSER_EXECUTABLE = $edge
}
Write-Output "工作台代码目录：$workbenchRoot"
Write-Output "入口：http://127.0.0.1:$port/workspace/ （前台运行，关闭本窗口即停止）"
Set-Location -LiteralPath $workbenchRoot
& $node (Join-Path $workbenchRoot 'server/index.mjs')
