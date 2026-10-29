[CmdletBinding()]
param(
  [ValidateSet('e2e', 'auth', 'fresh-b')]
  [string]$Data = 'fresh-b',
  # 本机启动配置文件（Git 忽略）。默认 scripts/start-workbench.local.json；模板见同目录 .example。
  [string]$ConfigPath,
  # 浏览器可执行文件；也可使用 DSH_PROBE_BROWSER_EXECUTABLE，缺省时自动查找。
  [string]$BrowserPath,
  # 显式加载 fresh-b 的真实模型配置；仍需逐用例既有授权，不创建或重置额度。
  [switch]$EnableModel,
  # 显式准备当前启动进程所见的 trial 开关；仅配合 EnableModel，CheckOnly 永不写入。
  [switch]$PrepareModelConfig,
  # 只加载并核对配置、输出安全摘要，不启动服务。
  # 退出码：0=满足启动条件；2=配置有效但 4322 被占用；1=配置或数据问题。
  [switch]$CheckOnly,
  # 仅对由本启动器托管且空闲的现有实例发起一次受控重启。
  [switch]$Restart
)
$ErrorActionPreference = 'Stop'
if ($PrepareModelConfig -and (-not $EnableModel -or $Restart)) { throw '-PrepareModelConfig 必须配合 -EnableModel，且不能用于 -Restart。' }
if ($EnableModel -and $Data -ne 'fresh-b') { throw '-EnableModel 仅适用于 fresh-b；不会改变其他配置的授权语义。' }
$workbenchRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $workbenchRoot
. (Join-Path $PSScriptRoot 'runtime-paths.ps1')
. (Join-Path $PSScriptRoot 'model-config.ps1')
$workbenchRuntime = Get-WorkbenchRuntime -Root $repoRoot
$workbenchNode = $workbenchRuntime.Node
$startClock = [Diagnostics.Stopwatch]::StartNew()
$startGate = $null
$ownsStartGate = $false
if (-not $CheckOnly -and -not $Restart) {
  $gateHasher = [Security.Cryptography.SHA256]::Create()
  try { $gateHash = [BitConverter]::ToString($gateHasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($repoRoot.ToLowerInvariant()))).Replace('-', '') }
  finally { $gateHasher.Dispose() }
  $startGate = New-Object -TypeName System.Threading.Mutex -ArgumentList @($false, ('Local\ui-test-workbench-start-' + $gateHash))
  try { $ownsStartGate = $startGate.WaitOne(0) } catch [Threading.AbandonedMutexException] { $ownsStartGate = $true }
  if (-not $ownsStartGate) {
    $waitDeadline = (Get-Date).AddSeconds(75)
    $pendingHealth = $null
    do {
      try {
        $pendingHealth = Invoke-RestMethod -Uri 'http://127.0.0.1:4322/api/health' -TimeoutSec 1
        if ($pendingHealth.service -eq 'approved-test-workbench') { break }
      } catch { }
      Start-Sleep -Milliseconds 250
      try { $ownsStartGate = $startGate.WaitOne(0) } catch [Threading.AbandonedMutexException] { $ownsStartGate = $true }
    } while (-not $ownsStartGate -and (Get-Date) -lt $waitDeadline)
    if (-not $ownsStartGate -and -not $pendingHealth) { $startGate.Dispose(); throw '工作台仍在启动，请查看原启动日志；不会重复创建服务。' }
  }
}
try {
$licenseCli = Join-Path $workbenchRoot 'server/licensing/cli.mjs'
if (Test-Path -LiteralPath $licenseCli -PathType Leaf) {
  & $workbenchNode $licenseCli check --root $repoRoot
  $licenseCheck = $LASTEXITCODE
  if ($licenseCheck -notin @(0, 2)) { throw '授权环境检查未就绪；请按诊断修复，未启动业务工作台。' }
} elseif ($workbenchRuntime.Portable) { throw '完整程序包缺少授权检查组件。' }
$port = 4322
if ($Restart) {
  if ($CheckOnly -or $PSBoundParameters.ContainsKey('Data') -or $ConfigPath -or $BrowserPath -or $EnableModel -or $PrepareModelConfig) {
    throw '-Restart 不接受新数据或配置参数；由现有托管进程保留原配置。'
  }
  $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if (-not $listener) { throw '4322没有运行中的工作台，无法受控重启。' }
  $ownerId = $listener[0].OwningProcess
  $ownerProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $ownerId"
  $expectedEntry = (Join-Path $workbenchRoot 'server/index.mjs').Replace('/','\')
  $actualCommand = ([string]$ownerProcess.CommandLine).Replace('/','\')
  if (-not $actualCommand.Contains($expectedEntry)) { throw '4322不是本项目服务，未发送重启请求。' }
  $health = Invoke-RestMethod -Uri 'http://127.0.0.1:4322/api/health' -TimeoutSec 3
  if ($health.service -ne 'approved-test-workbench' -or -not $health.restart.managed -or -not $health.service_identity.service_instance_id) {
    throw '现有4322实例未由本启动器托管，无法在线重启；不接管或结束旧进程。'
  }
  $body = @{ service_instance_id = $health.service_identity.service_instance_id } | ConvertTo-Json -Compress
  $result = Invoke-RestMethod -Uri 'http://127.0.0.1:4322/api/service/restart' -Method Post -ContentType 'application/json' -Headers @{ Origin = 'http://127.0.0.1:4322' } -Body $body -TimeoutSec 5
  if ($result.status -ne 'restart_scheduled') { throw '工作台未接受重启请求。' }
  Write-Output "已安排同一4322工作台受控重启；旧实例 $($result.service_instance_id)。请等待新实例健康检查。"
  exit 0
}
function Resolve-WorkbenchBrowser {
  param([string]$ExplicitPath, [string]$WorkbenchRoot)
  $configured = if ($ExplicitPath) { $ExplicitPath } elseif (-not $workbenchRuntime.Portable) { $env:DSH_PROBE_BROWSER_EXECUTABLE } else { $null }
  if ($configured) {
    if (-not [System.IO.Path]::IsPathRooted($configured) -or -not (Test-Path -LiteralPath $configured -PathType Leaf)) {
      throw "浏览器可执行文件不可用：$configured。请传入 -BrowserPath 或设置 DSH_PROBE_BROWSER_EXECUTABLE 为绝对路径。"
    }
    return [System.IO.Path]::GetFullPath($configured)
  }
  if ($workbenchRuntime.Portable) {
    Push-Location -LiteralPath $WorkbenchRoot
    try { $bundled = & $workbenchNode -p "require('./node_modules/playwright').chromium.executablePath()" }
    finally { Pop-Location }
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $bundled -PathType Leaf)) { throw '便携包浏览器缺失；不会切换到其他版本或下载。' }
    return [string]$bundled
  }
  $programFilesX86 = [Environment]::GetEnvironmentVariable('ProgramFiles(x86)')
  $candidates = @(
    $(if ($programFilesX86) { [System.IO.Path]::Combine($programFilesX86, 'Microsoft/Edge/Application/msedge.exe') }),
    $(if ($env:ProgramFiles) { [System.IO.Path]::Combine($env:ProgramFiles, 'Microsoft/Edge/Application/msedge.exe') }),
    $(if ($env:ProgramFiles) { [System.IO.Path]::Combine($env:ProgramFiles, 'Google/Chrome/Application/chrome.exe') }),
    $(if ($env:LOCALAPPDATA) { [System.IO.Path]::Combine($env:LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe') })
  ) | Where-Object { $_ }
  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
  }
  $playwrightPackage = Join-Path $WorkbenchRoot 'node_modules/playwright/package.json'
  if (Test-Path -LiteralPath $playwrightPackage) {
    $bundled = & $workbenchNode -p "require('./node_modules/playwright').chromium.executablePath()" 2>$null
    if ($LASTEXITCODE -eq 0 -and $bundled -and (Test-Path -LiteralPath $bundled -PathType Leaf)) { return [string]$bundled }
  }
  throw '未找到可用浏览器。请运行 安装.cmd 安装 Chromium，或用 -BrowserPath 指定 Edge/Chrome 的绝对路径。'
}
# A normal launch reuses the one already owned instance. It never changes its
# data/configuration, kills a process, or starts another workbench.
$existingListener = @(Get-WorkbenchListeners -Port $port)
if ($existingListener -and -not $CheckOnly) {
  $ownerId = (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction Stop)[0].OwningProcess
  $ownerProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $ownerId"
  $expectedEntry = (Join-Path $workbenchRoot 'server/index.mjs').Replace('/','\')
  $actualCommand = ([string]$ownerProcess.CommandLine).Replace('/','\')
  $ownedHealth = Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/health" -TimeoutSec 3
  if (-not $actualCommand.Contains($expectedEntry) -or $ownedHealth.service -ne 'approved-test-workbench') {
    throw '4322被非当前项目实例占用；不会结束进程或更换端口。'
  }
  if ($PSBoundParameters.ContainsKey('Data') -or $ConfigPath -or $BrowserPath -or $EnableModel) {
    Write-Output '4322已有本项目实例；显式配置尚未重新加载。请空闲后按原配置正常重启，当前实例与数据保持不变。'
    exit 2
  }
  Write-Output "已复用本项目4322实例（PID $ownerId），原数据和配置不变：http://127.0.0.1:4322/workspace/"
  exit 0
}
$dataDirName = if ($Data -eq 'auth') { 'auth01-user-trial' } else { 'six-case-e2e' }
$dataDir = Join-Path $workbenchRoot (Join-Path '.local' $dataDirName)
if ($workbenchRuntime.Portable -and -not $CheckOnly) {
  & (Join-Path $PSScriptRoot 'setup-runtime.ps1')
  if ($LASTEXITCODE -ne 0) { throw '私有 Harness 初始化未完成。' }
}
if ($workbenchRuntime.Portable -and -not $ConfigPath) {
  $ConfigPath = Join-Path $env:LOCALAPPDATA 'ui-test-agent/runtime/config/start-workbench.json'
}

# Existing autonomous sample data: zero-model default, explicit opt-in, same daily port.
if ($Data -eq 'fresh-b') {
  $dataDir = Join-Path $workbenchRoot '.local/fresh25-b'
  $profileMarker = Join-Path $dataDir 'workspace-profile.json'
  $emptyWorkspace = $false
  $projectsDir = Join-Path $dataDir 'case-library/projects'
  if (Test-Path -LiteralPath $profileMarker -PathType Leaf) {
    $profile = Get-Content -LiteralPath $profileMarker -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($profile.schema -ne 'workbench/data-profile-v1' -or $profile.profile -ne 'empty') { throw '空工作区标记无效；不会覆盖已有数据。' }
    $emptyWorkspace = $true
  } elseif (-not (Test-Path -LiteralPath $projectsDir)) {
    if ((Test-Path -LiteralPath $dataDir) -and @(Get-ChildItem -LiteralPath $dataDir -Force).Count -gt 0) {
      throw 'fresh-b 数据目录已有内容但缺少项目库；请核对原数据，不会覆盖或生成替代项目。'
    }
    $emptyWorkspace = $true
    Write-Output "首次空工作区：$dataDir（仅在正式启动时由服务初始化，不导入样例或授权）。"
  }
  $trialConfig = if ($emptyWorkspace) { Join-Path $workbenchRoot 'config/empty-trial.json' } else { Join-Path $workbenchRoot 'config/fresh-b-trial.json' }
  if (-not (Test-Path -LiteralPath $trialConfig -PathType Leaf)) { throw "试跑配置不存在：$trialConfig" }
  $modelProfile = $null
  if ($EnableModel) {
    if (-not $ConfigPath) { $ConfigPath = Join-Path $PSScriptRoot 'start-workbench.local.json' }
    $modelProfile = (Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json).profiles.'fresh-b'
    if (-not $modelProfile) { throw '显式模型模式需要 profiles.fresh-b 配置；不会套用其他数据的授权。' }
    foreach ($key in @('WORKBENCH_DSH_HOME','WORKBENCH_HARNESS_PATCH','WORKBENCH_DEVELOPMENT_ENVIRONMENTS','WORKBENCH_CANDIDATE_TRIAL_CONFIG')) {
      $value = $modelProfile.$key
      if (-not $value -or -not [System.IO.Path]::IsPathRooted($value) -or -not (Test-Path -LiteralPath $value)) { throw "真实模型配置缺失或路径不可用：$key" }
    }
    if ($modelProfile.WORKBENCH_USE_STORED_DSH_CREDENTIALS -ne '1') { throw '该入口仅复用已保存DSH凭据，不接受密钥正文。' }
    if ($modelProfile.WORKBENCH_AUTH_ENVIRONMENTS) {
      $authEnvironments = [string]$modelProfile.WORKBENCH_AUTH_ENVIRONMENTS
      if (-not [System.IO.Path]::IsPathRooted($authEnvironments) -or -not (Test-Path -LiteralPath $authEnvironments -PathType Leaf)) {
        throw 'WORKBENCH_AUTH_ENVIRONMENTS 必须是可用的绝对 JSON 文件路径。'
      }
    }
    if ($PrepareModelConfig) {
      $beforePreparation = Get-WorkbenchModelConfigState -TrialPath $modelProfile.WORKBENCH_CANDIDATE_TRIAL_CONFIG
      Write-Output ('模型配置准备前核验：' + ($beforePreparation | ConvertTo-Json -Depth 6 -Compress))
      $prepared = Prepare-WorkbenchModelConfig -TrialPath $modelProfile.WORKBENCH_CANDIDATE_TRIAL_CONFIG -CheckOnly:$CheckOnly
      Write-Output ('模型配置准备：' + ($prepared | ConvertTo-Json -Depth 6 -Compress))
    }
    $trialState = Get-WorkbenchModelConfigState -TrialPath $modelProfile.WORKBENCH_CANDIDATE_TRIAL_CONFIG
    $modelFlag = $trialState.model_calls_allowed
    $modelFlagType = $trialState.value_type
    $modelCheck = [ordered]@{
      config_path = [IO.Path]::GetFullPath($ConfigPath)
      config_sha256 = Get-WorkbenchConfigSha256 -Bytes ([IO.File]::ReadAllBytes($ConfigPath))
      trial_path = [IO.Path]::GetFullPath($modelProfile.WORKBENCH_CANDIDATE_TRIAL_CONFIG)
      trial_sha256 = $trialState.trial_sha256
      model_calls_allowed = $modelFlag
      value_type = $modelFlagType
      powershell_version = $PSVersionTable.PSVersion.ToString()
      portable = [bool]$workbenchRuntime.Portable
      storage = $trialState.storage
    }
    Write-Output ('模型配置核验：' + ($modelCheck | ConvertTo-Json -Depth 6 -Compress))
    if ($trialState.storage.codex_cache_view) { Write-Output '提示：当前配置位于 Codex 应用缓存视图；本次检查仅代表当前启动进程，不能据此认定外部终端读取到相同文件。' }
    elseif ($trialState.storage.identity_status -eq 'UNKNOWN') { Write-Output '提示：实际存储目标未知；配置指纹与检查结果仅代表当前启动进程所见文件。' }
    if ($modelFlag -ne $true) {
      throw "真实模型配置必须明确 model_calls_allowed=true。实际文件：$($modelCheck.trial_path)；实际值：$modelFlag（$modelFlagType）。配置和文件指纹已写入启动日志。"
    }
    $nativeDsh = Get-WorkbenchNativeDsh -Root $repoRoot -Node $workbenchNode
    $modelProfile | Add-Member -NotePropertyName WORKBENCH_NATIVE_DSH_BIN -NotePropertyValue $nativeDsh.binary -Force
    Write-Output "原生 DSH：$($nativeDsh.version)；受管路径：$($nativeDsh.binary)"
    Write-Output '已核对 fresh-b 显式模型配置；逐用例授权和现有预算仍由服务端校验。'
  }
  $listener = @(Get-WorkbenchListeners -Port $port)
  if ($listener) { Write-Output '4322已占用；不结束未知进程、不换端口。'; exit 2 }
  $node = @{ Source=$workbenchNode }
  Push-Location -LiteralPath $workbenchRoot
  try { $browserExecutable = Resolve-WorkbenchBrowser -ExplicitPath $BrowserPath -WorkbenchRoot $workbenchRoot }
  finally { Pop-Location }
  Write-Output "浏览器：$browserExecutable"
  Write-Output "数据配置：$dataDir；试跑配置：$trialConfig；4322空闲；模型模式：$([bool]$EnableModel)。"
  if ($CheckOnly) { exit 0 }
  if ($emptyWorkspace -and -not (Test-Path -LiteralPath $profileMarker)) {
    New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
    Set-Content -LiteralPath $profileMarker -Value '{"schema":"workbench/data-profile-v1","profile":"empty"}' -Encoding UTF8
  }
  foreach ($key in @('WORKBENCH_BUILD_AUTHORIZATION_ID','M2C_BUILD_AUTHORIZATION_ID','WORKBENCH_DSH_HOME','WORKBENCH_HARNESS_PATCH','WORKBENCH_USE_STORED_DSH_CREDENTIALS','WORKBENCH_DEVELOPMENT_ENVIRONMENTS','WORKBENCH_AUTH_ENVIRONMENTS','WORKBENCH_NATIVE_DSH_BIN','WORKBENCH_NATIVE_DSH_URL')) { Remove-Item -LiteralPath "Env:$key" -ErrorAction SilentlyContinue }
  $env:WORKBENCH_PORT = [string]$port
  $env:WORKBENCH_DATA_DIR = $dataDir
  $env:WORKBENCH_CANDIDATE_TRIAL_CONFIG = $trialConfig
  if ($modelProfile) {
    foreach ($key in @('WORKBENCH_DSH_HOME','WORKBENCH_HARNESS_PATCH','WORKBENCH_USE_STORED_DSH_CREDENTIALS','WORKBENCH_DEVELOPMENT_ENVIRONMENTS','WORKBENCH_CANDIDATE_TRIAL_CONFIG','WORKBENCH_NATIVE_DSH_BIN')) {
      Set-Item -LiteralPath "Env:$key" -Value ([string]$modelProfile.$key)
    }
    if ($modelProfile.WORKBENCH_AUTH_ENVIRONMENTS) { $env:WORKBENCH_AUTH_ENVIRONMENTS = [string]$modelProfile.WORKBENCH_AUTH_ENVIRONMENTS }
  }
  $env:DSH_PROBE_BROWSER_EXECUTABLE = $browserExecutable
  Write-Output '入口：http://127.0.0.1:4322/workspace/；前台运行，Ctrl+C停止工作台；已有脚本复跑不调用模型。'
  Write-Output ('启动计时：前置检查 ' + $startClock.ElapsedMilliseconds + ' ms。')
  & $workbenchNode (Join-Path $workbenchRoot 'server/owned-supervisor.mjs')
  exit $LASTEXITCODE
}
Remove-Item -LiteralPath 'Env:WORKBENCH_CANDIDATE_TRIAL_CONFIG' -ErrorAction SilentlyContinue

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
  $raw = (Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json)
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
  $node = $workbenchNode
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
        $record = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($record.authorization_id -eq $authorizationId) { $ledger = $record; break }
      } catch { }
    }
  }
  if ($ledger) {
    $remaining = $ledger.max_starts - $ledger.used_starts
    $authorizationState = "已绑定 $authorizationId（账本 $($ledger.used_starts)/$($ledger.max_starts)）"
    $quotaState = if ($remaining -gt 0) { "剩余 $remaining/$($ledger.max_starts)" } else { "已耗尽（$($ledger.used_starts)/$($ledger.max_starts)）" }
  } else {
    if ($authorizationId -eq 'auth01-project-case-20260924') {
      # AUTH-01 限定授权在首次建例任务创建时由服务端登记账本；登记前缺失是正常状态。
      $authorizationState = "已绑定 $authorizationId（账本待首次任务登记）"
      $quotaState = '登记前未知；首次建例任务创建时按 0/2 登记'
    } else {
      $authorizationState = "已绑定 $authorizationId，但数据目录内未找到对应账本文件"
      $quotaState = '未知（账本缺失，不能视为有额度）'
      $problems.Add("授权标识 $authorizationId 在 $buildTasksDir 中没有对应账本；只引用已有配置和账本，不创建新额度。") | Out-Null
    }
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
  Write-Output '能力边界：AUTH-01 本机合成站任务绑定代码已接入；完整闭环仍待独立验收。仅在明确配置既有 AUTH 授权时允许建例，不套用 e2e 授权。'
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
Push-Location -LiteralPath $workbenchRoot
try { $env:DSH_PROBE_BROWSER_EXECUTABLE = Resolve-WorkbenchBrowser -ExplicitPath $BrowserPath -WorkbenchRoot $workbenchRoot }
finally { Pop-Location }
Write-Output "工作台代码目录：$workbenchRoot"
Write-Output "入口：http://127.0.0.1:$port/workspace/ （前台运行，关闭本窗口即停止）"
Set-Location -LiteralPath $workbenchRoot
& $node (Join-Path $workbenchRoot 'server/owned-supervisor.mjs')
} finally {
  if ($ownsStartGate) { $startGate.ReleaseMutex() }
  if ($startGate) { $startGate.Dispose() }
}
