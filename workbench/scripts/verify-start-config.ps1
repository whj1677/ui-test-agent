# 启动配置隔离验证：在清除本项目相关继承变量的子进程中，通过唯一启动入口核对配置载入。
# 不启动 Harness、不调用模型、不执行业务候选；只运行 start-workbench.ps1 的 -CheckOnly 核对。
# 用法：pwsh -NoProfile -File .\scripts\verify-start-config.ps1
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$workbenchRoot = Split-Path -Parent $PSScriptRoot
$startScript = Join-Path $PSScriptRoot 'start-workbench.ps1'
$pwsh = (Get-Command pwsh -ErrorAction Stop).Source

$scrubExact = @(
  'WORKBENCH_BUILD_AUTHORIZATION_ID',
  'WORKBENCH_DSH_HOME',
  'WORKBENCH_HARNESS_PATCH',
  'WORKBENCH_USE_STORED_DSH_CREDENTIALS',
  'WORKBENCH_PORT',
  'WORKBENCH_DATA_DIR',
  'WORKBENCH_TEST_SITE_BASE_URL',
  'WORKBENCH_AUTH_FIXTURE_BASE_URL',
  'M2C_BUILD_AUTHORIZATION_ID',
  'AUTH01_ALLOW_REAL_HARNESS',
  'DSH_PROBE_BROWSER_EXECUTABLE'
)

function Invoke-IsolatedCheck {
  param(
    [string]$Data,
    [hashtable]$SeedEnv = @{},
    [string]$ConfigPath
  )
  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $pwsh
  $startInfo.UseShellExecute = $false
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $startInfo.WorkingDirectory = $workbenchRoot
  foreach ($key in @($startInfo.Environment.Keys)) {
    if ($scrubExact -contains $key -or $key -like 'WORKBENCH_*') { [void]$startInfo.Environment.Remove($key) }
  }
  foreach ($key in $SeedEnv.Keys) { $startInfo.Environment[$key] = $SeedEnv[$key] }
  $argList = @('-NoProfile', '-File', $startScript, '-Data', $Data, '-CheckOnly')
  if ($ConfigPath) { $argList += @('-ConfigPath', $ConfigPath) }
  foreach ($arg in $argList) { $startInfo.ArgumentList.Add($arg) }
  $process = [System.Diagnostics.Process]::Start($startInfo)
  $stdout = $process.StandardOutput.ReadToEnd()
  $stderr = $process.StandardError.ReadToEnd()
  $process.WaitForExit()
  return @{ ExitCode = $process.ExitCode; Output = ($stdout + $stderr) }
}

$results = New-Object System.Collections.Generic.List[object]
function Add-Result {
  param([string]$Name, [bool]$Passed, [string]$Detail)
  $results.Add([pscustomobject]@{ Name = $Name; Passed = $Passed; Detail = $Detail }) | Out-Null
  Write-Output ("[{0}] {1} — {2}" -f $(if ($Passed) { 'PASS' } else { 'FAIL' }), $Name, $Detail)
}

function Assert-Scenario {
  param(
    [string]$Name,
    [hashtable]$Run,
    [int[]]$ExpectedExit,
    [string[]]$MustContain = @(),
    [string[]]$MustNotContain = @()
  )
  $failures = @()
  if ($ExpectedExit -notcontains $Run.ExitCode) { $failures += "退出码 $($Run.ExitCode)，期望 $($ExpectedExit -join '/')" }
  foreach ($needle in $MustContain) { if ($Run.Output -notlike "*$needle*") { $failures += "缺少输出：$needle" } }
  foreach ($needle in $MustNotContain) { if ($Run.Output -like "*$needle*") { $failures += "不应出现：$needle" } }
  Add-Result -Name $Name -Passed ($failures.Count -eq 0) -Detail $(if ($failures.Count) { $failures -join '；' } else { '符合预期' })
}

Write-Output '== 场景 1：默认 e2e 数据配置（干净环境） =='
$run = Invoke-IsolatedCheck -Data 'e2e'
Assert-Scenario -Name 'e2e 默认配置载入' -Run $run -ExpectedExit @(0, 2) `
  -MustContain @('配置已加载：是', '历史数据可读取：是', 'e2e01-six-case-project-20260923', '[来源：配置文件]', '已耗尽（7/7）') `
  -MustNotContain @('继承环境变量（配置文件未提供')

Write-Output '== 场景 2：auth 数据配置（干净环境，授权未绑定） =='
$run = Invoke-IsolatedCheck -Data 'auth'
Assert-Scenario -Name 'auth 配置载入且授权未绑定' -Run $run -ExpectedExit @(0, 2) `
  -MustContain @('配置已加载：是', '历史数据可读取：是', '未绑定建例授权', 'AUTH 任务绑定尚未接通', '配置文件（显式未绑定）') `
  -MustNotContain @('e2e01-six-case-project-20260923', 'M2C_')

Write-Output '== 场景 3：污染继承环境（旧终端残留变量不得静默生效） =='
$run = Invoke-IsolatedCheck -Data 'e2e' -SeedEnv @{
  WORKBENCH_DSH_HOME = 'D:\不存在的旧终端残留目录'
  WORKBENCH_BUILD_AUTHORIZATION_ID = 'stale-terminal-authorization'
  M2C_BUILD_AUTHORIZATION_ID = 'm2c-wait-fix-validation-20260921'
}
Assert-Scenario -Name '残留变量被配置文件覆盖' -Run $run -ExpectedExit @(0, 2) `
  -MustContain @('已按配置文件覆盖', '已耗尽（7/7）', '满足启动条件') `
  -MustNotContain @('不存在的旧终端残留目录）', 'stale-terminal-authorization（账本')
$run = Invoke-IsolatedCheck -Data 'auth' -SeedEnv @{ M2C_BUILD_AUTHORIZATION_ID = 'm2c-wait-fix-validation-20260921' }
Assert-Scenario -Name 'auth 下残留 M2C 授权被清除' -Run $run -ExpectedExit @(0, 2) `
  -MustContain @('已清除残留的 M2C_BUILD_AUTHORIZATION_ID', '未绑定建例授权')

Write-Output '== 场景 4：缺失 DSH 路径与 patch（临时配置） =='
$tempConfig = Join-Path $env:TEMP ("start-workbench-bad-" + [guid]::NewGuid().ToString('N') + '.json')
@'
{"profiles":{"e2e":{"WORKBENCH_BUILD_AUTHORIZATION_ID":"e2e01-six-case-project-20260923","WORKBENCH_DSH_HOME":"D:\\确实不存在的dsh","WORKBENCH_HARNESS_PATCH":"D:\\确实不存在的patch.yml","WORKBENCH_USE_STORED_DSH_CREDENTIALS":"1"},"auth":{"WORKBENCH_BUILD_AUTHORIZATION_ID":null,"WORKBENCH_DSH_HOME":"D:\\确实不存在的dsh","WORKBENCH_HARNESS_PATCH":"D:\\确实不存在的patch.yml","WORKBENCH_USE_STORED_DSH_CREDENTIALS":"1"}}}
'@ | Set-Content -LiteralPath $tempConfig -Encoding utf8
try {
  $run = Invoke-IsolatedCheck -Data 'e2e' -ConfigPath $tempConfig
  Assert-Scenario -Name '缺失 DSH/patch 给出明确启动错误' -Run $run -ExpectedExit @(1) `
    -MustContain @('私有运行时不存在', 'patch 文件不存在', '不满足启动条件')
} finally {
  Remove-Item -LiteralPath $tempConfig -Force -ErrorAction SilentlyContinue
}

Write-Output '== 场景 5：4322 已被占用 =='
$occupiedNow = Get-NetTCPConnection -LocalPort 4322 -State Listen -ErrorAction SilentlyContinue
$listener = $null
if (-not $occupiedNow) {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 4322)
  $listener.Start()
}
try {
  $run = Invoke-IsolatedCheck -Data 'e2e'
  $expectIdentity = if ($occupiedNow) { @('服务标识：approved-test-workbench') } else { @('占用') }
  Assert-Scenario -Name '4322 占用时拒绝启动并报告占用者' -Run $run -ExpectedExit @(2) `
    -MustContain (@('满足启动条件：否（端口 4322') + $expectIdentity)
} finally {
  if ($listener) { $listener.Stop() }
}

Write-Output '== 场景 6：配置有效但额度耗尽或尚未授权（状态区分，不算启动失败） =='
# 场景 1 已证明 e2e 额度已耗尽（7/7）；场景 2 已证明 auth 未授权。这里复核两者退出码均为 0/2 而非 1。
$runE = Invoke-IsolatedCheck -Data 'e2e'
$runA = Invoke-IsolatedCheck -Data 'auth'
$ok = ($runE.ExitCode -in @(0, 2)) -and ($runA.ExitCode -in @(0, 2)) `
  -and ($runE.Output -like '*合法调用额度：已耗尽（7/7）*') `
  -and ($runA.Output -like '*合法调用额度：无（建例条件未就绪*')
Add-Result -Name '耗尽/未授权状态明确区分' -Passed $ok -Detail $(if ($ok) { 'e2e=已耗尽、auth=未授权，均未误判为配置错误' } else { '状态输出不符合预期' })

$failed = @($results | Where-Object { -not $_.Passed })
Write-Output ("验证汇总：{0} 项通过，{1} 项失败。" -f @($results | Where-Object { $_.Passed }).Count, $failed.Count)
if ($failed.Count -gt 0) { exit 1 }
exit 0
