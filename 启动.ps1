param([switch]$NoOpen)
$ErrorActionPreference = 'Stop'
$agentRoot = $PSScriptRoot
$agentPort = if ($env:UI_AGENT_PORT) { [int]$env:UI_AGENT_PORT } else { 4179 }
$agentUrl = "http://127.0.0.1:$agentPort"
$agentRunning = $false
try {
    $agentInfo = Invoke-RestMethod -Uri "$agentUrl/api/config" -TimeoutSec 2
    $agentRunning = $agentInfo.application -eq 'ui-test-agent' -and @('0.2.0', '0.2.1', '0.3.0') -contains $agentInfo.version
} catch { }
if ($agentInfo -and -not $agentRunning) { throw '此端口不是兼容的 UI 测试 Agent 服务，请核对当前服务。' }
if (-not $agentRunning) {
    if (-not (Test-Path -LiteralPath (Join-Path $agentRoot 'node_modules/playwright/package.json'))) {
        throw '请先在工程目录运行 npm ci 和 npx playwright install chromium。'
    }
    $agentNode = (Get-Command node -ErrorAction Stop).Source
    $agentData = if ($env:UI_AGENT_DATA_DIR) { $env:UI_AGENT_DATA_DIR } else { Join-Path $agentRoot 'data/v02' }
    New-Item -ItemType Directory -Path $agentData -Force | Out-Null
    $agentEntry = Join-Path $agentRoot 'src/server.mjs'
    $agentProcess = Start-Process -FilePath $agentNode -ArgumentList ('"' + $agentEntry + '"') -WorkingDirectory $agentRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $agentData "server-$agentPort.stdout.log") -RedirectStandardError (Join-Path $agentData "server-$agentPort.stderr.log")
    for ($agentAttempt = 0; $agentAttempt -lt 40; $agentAttempt++) {
        Start-Sleep -Milliseconds 250
        if ($agentProcess.HasExited) { throw "本地服务启动失败，请检查 $agentData/server-$agentPort.stderr.log；可能是端口被占用。" }
        try {
            $agentInfo = Invoke-RestMethod -Uri "$agentUrl/api/config" -TimeoutSec 1
            if ($agentInfo.application -eq 'ui-test-agent' -and @('0.2.0', '0.2.1', '0.3.0') -contains $agentInfo.version) { $agentRunning = $true; break }
        } catch { }
    }
    if (-not $agentRunning) { throw "启动尚未就绪，请检查 $agentData/server-$agentPort.stderr.log。" }
    Set-Content -LiteralPath (Join-Path $agentData "server-$agentPort.pid") -Value $agentProcess.Id -Encoding utf8
}
if (-not $agentInfo.plan_revision -or -not $agentInfo.plan_revalidation) { Write-Warning '当前服务尚未加载本次真实联调修复；保留已有会话。正常停止该服务并重新启动，才能启用计划格式兼容、修订反馈及留档回复重新校验。已有服务不会被自动终止。' }
Write-Output "UI 测试 Agent：$agentUrl"
if (-not $NoOpen) { Start-Process $agentUrl }
