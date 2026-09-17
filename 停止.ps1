$ErrorActionPreference = 'Stop'
$agentPort = if ($env:UI_AGENT_PORT) { [int]$env:UI_AGENT_PORT } else { 4179 }
$agentUrl = "http://127.0.0.1:$agentPort"
$agentData = if ($env:UI_AGENT_DATA_DIR) { $env:UI_AGENT_DATA_DIR } else { Join-Path $PSScriptRoot 'data/v02' }
$expected = (& (Get-Command node).Source (Join-Path $PSScriptRoot 'src/build-info.mjs')) | ConvertFrom-Json
$agentInfo = Invoke-RestMethod -Uri "$agentUrl/api/config" -TimeoutSec 3
if ($agentInfo.application -ne 'ui-test-agent' -or -not $agentInfo.instance.id) {
    throw '此服务不支持安全停止入口，请在原服务启动终端使用 Ctrl+C；不会按端口强制结束进程。'
}
if ($agentInfo.instance.data_directory_id -ne $expected.data_directory_id) { throw '当前服务使用另一个数据目录，请先核对配置。' }
$agentPage = Invoke-WebRequest -Uri $agentUrl -UseBasicParsing -TimeoutSec 3
$tokenMatch = [regex]::Match($agentPage.Content, 'name="csrf-token" content="([^"]+)"')
if (-not $tokenMatch.Success) { throw '无法读取本机停止凭据，请刷新控制台后重试。' }
$body = @{ instance_id = $agentInfo.instance.id } | ConvertTo-Json
Invoke-RestMethod -Uri "$agentUrl/api/shutdown" -Method Post -ContentType 'application/json' -Headers @{ 'X-CSRF-Token' = $tokenMatch.Groups[1].Value } -Body $body -TimeoutSec 5 | Out-Null
Write-Output '已请求正常停止。运行器会结束当前有界操作并保留清理和证据；不会强制杀进程。'
for ($attempt = 0; $attempt -lt 120; $attempt++) {
    Start-Sleep -Seconds 1
    $lockFile = Join-Path $agentData '.writer.lock'
    if (-not (Test-Path -LiteralPath $lockFile)) { Write-Output '服务已完成收尾并释放数据目录。'; exit 0 }
    $lockOwner = Get-Content -LiteralPath $lockFile -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($lockOwner.id -ne $agentInfo.instance.writer_lock_id) { throw '数据目录已由新实例接管，请核对当前控制台。' }
}
throw '服务仍在收尾。请等待清理完成后检查日志，不要重复启动或强制终止。'
