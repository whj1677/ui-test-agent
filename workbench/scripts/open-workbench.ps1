[CmdletBinding()]
param([switch]$NoBrowser)

$ErrorActionPreference = 'Stop'
$workbenchRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'runtime-paths.ps1')
$entryUrl = 'http://127.0.0.1:4322/workspace/'
$healthUrl = 'http://127.0.0.1:4322/api/health'
$dataPath = [IO.Path]::GetFullPath((Join-Path $workbenchRoot '.local/fresh25-b'))
$hasher = [Security.Cryptography.SHA256]::Create()
try {
  $expectedDataHash = [BitConverter]::ToString($hasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($dataPath))).Replace('-', '').ToLowerInvariant()
} finally {
  $hasher.Dispose()
}
$clock = [Diagnostics.Stopwatch]::StartNew()
$progress = $null

function Update-WorkbenchStartupProgress {
  if ($progress -and -not $progress.IsDisposed) {
    $progressLabel.Text = ('正在检查环境并加载已有项目… 已等待 ' + [int]$clock.Elapsed.TotalSeconds + ' 秒')
    [Windows.Forms.Application]::DoEvents()
  }
}

function Get-WorkbenchHealth {
  try { $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 1 }
  catch { return $null }
  if ($health.service -ne 'approved-test-workbench' -or $health.service_identity.data_root_sha256 -ne $expectedDataHash) {
    throw '4322 被其他服务占用，无法打开当前工作台。请先核对占用情况。'
  }
  return $health
}

try {
  $health = if (@(Get-WorkbenchListeners).Count) { Get-WorkbenchHealth } else { $null }
  if (-not $health) {
    if (-not $NoBrowser) {
      Add-Type -AssemblyName System.Windows.Forms
      $progress = New-Object Windows.Forms.Form
      $progress.Text = '测试工作台正在启动'; $progress.Width = 480; $progress.Height = 130
      $progress.StartPosition = 'CenterScreen'; $progress.FormBorderStyle = 'FixedDialog'; $progress.MaximizeBox = $false
      $progressLabel = New-Object Windows.Forms.Label
      $progressLabel.AutoSize = $true; $progressLabel.Left = 20; $progressLabel.Top = 22
      $progress.Controls.Add($progressLabel); Update-WorkbenchStartupProgress; $progress.Show()
    }
    # The canonical launcher owns the single startup mutex. A UI-level mutex
    # can outlive a failed launch while an old error dialog remains open.
    if (-not $health) { $health = if (@(Get-WorkbenchListeners).Count) { Get-WorkbenchHealth } else { $null } }
    if (-not $health) {
    if (@(Get-WorkbenchListeners).Count) {
      throw '4322 已被占用，但工作台没有响应。请检查现有服务；启动器不会结束其他进程。'
    }
    $configPath = Join-Path $env:LOCALAPPDATA 'ui-test-agent/runtime/config/start-workbench.json'
    if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
      throw '未找到本机原有的模型配置，请先完成模型工作台配置。'
    }
    $logDir = Join-Path $workbenchRoot '.local/launcher'
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    $logName = 'start-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff')
    $outputLog = Join-Path $logDir ($logName + '.log')
    $errorLog = Join-Path $logDir ($logName + '.error.log')
    $powershellPath = Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
    $launcherPath = Join-Path $PSScriptRoot 'start-workbench.ps1'
    $launcherArgs = '-NoProfile -ExecutionPolicy Bypass -File "' + $launcherPath + '" -EnableModel -ConfigPath "' + $configPath + '"'
    $launcher = Start-Process -FilePath $powershellPath -ArgumentList $launcherArgs -WorkingDirectory $workbenchRoot -WindowStyle Hidden -RedirectStandardOutput $outputLog -RedirectStandardError $errorLog -PassThru
    $deadline = (Get-Date).AddSeconds(75)
    do {
      Update-WorkbenchStartupProgress
      Start-Sleep -Milliseconds 200
      $health = Get-WorkbenchHealth
      if ($health) { break }
      if ($launcher.HasExited) { throw ('工作台启动失败，请查看启动日志：' + $errorLog) }
    } while ((Get-Date) -lt $deadline)
    if (-not $health) { throw ('工作台暂未就绪，请查看启动日志：' + $outputLog) }
    @{schema='workbench/desktop-start-timing-v1';elapsed_ms=$clock.ElapsedMilliseconds;service_instance_id=$health.service_identity.service_instance_id;measured_at=(Get-Date).ToUniversalTime().ToString('o')} | ConvertTo-Json -Compress | Set-Content -LiteralPath (Join-Path $logDir ($logName + '.timing.json')) -Encoding UTF8
    }
  }
  if (-not $NoBrowser) { Start-Process -FilePath $entryUrl }
  Write-Output ('工作台已就绪；入口等待 ' + $clock.ElapsedMilliseconds + ' ms。')
} catch {
  if ($progress) { $progress.Close(); $progress.Dispose(); $progress = $null }
  Add-Type -AssemblyName System.Windows.Forms
  [Windows.Forms.MessageBox]::Show($_.Exception.Message, '测试工作台启动提示', 'OK', 'Error') | Out-Null
  exit 1
} finally {
  if ($progress) { $progress.Close(); $progress.Dispose() }
}
