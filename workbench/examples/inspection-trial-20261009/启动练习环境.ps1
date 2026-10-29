$ErrorActionPreference = 'Stop'
$trialBase = 'http://127.0.0.1:4460'
$trialHealth = $null
try { $trialHealth = Invoke-RestMethod "$trialBase/health" -TimeoutSec 2 } catch {}
if ($trialHealth) {
    if ($trialHealth.service -ne 'inspection-trial-20261009') { throw '4460 被其他服务占用，请先确认。不会结束其他进程。' }
    Write-Host '练习环境已经运行：http://127.0.0.1:4460/inspection/'
    exit 0
}
if (Get-NetTCPConnection -State Listen -LocalPort 4460 -ErrorAction SilentlyContinue) { throw '4460 已占用但健康检查失败，请先确认。' }
$trialNode = (Get-Command node -ErrorAction Stop).Source
$trialScript = Join-Path $PSScriptRoot 'target.mjs'
$trialLogDir = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../.local/inspection-trial-20261009'))
New-Item -ItemType Directory -Path $trialLogDir -Force | Out-Null
$trialProcess = Start-Process -FilePath $trialNode -ArgumentList ('"' + $trialScript + '"') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $trialLogDir 'target.stdout.log') -RedirectStandardError (Join-Path $trialLogDir 'target.stderr.log') -PassThru
for ($trialAttempt = 0; $trialAttempt -lt 20; $trialAttempt++) {
    Start-Sleep -Milliseconds 250
    try { $trialHealth = Invoke-RestMethod "$trialBase/health" -TimeoutSec 1 } catch { continue }
    if ($trialHealth.service -eq 'inspection-trial-20261009') {
        $trialProcess.Id | Set-Content -LiteralPath (Join-Path $trialLogDir 'target.pid')
        Write-Host '练习环境已启动：http://127.0.0.1:4460/inspection/'
        exit 0
    }
}
throw '练习环境启动失败，请检查 workbench/.local/inspection-trial-20261009 下的日志。'
