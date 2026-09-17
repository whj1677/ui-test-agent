param([switch]$NoOpen)
$ErrorActionPreference = 'Stop'
$agentRoot = $PSScriptRoot
$agentPort = if ($env:UI_AGENT_PORT) { [int]$env:UI_AGENT_PORT } else { 4179 }
$agentUrl = "http://127.0.0.1:$agentPort"
$agentData = if ($env:UI_AGENT_DATA_DIR) { $env:UI_AGENT_DATA_DIR } else { Join-Path $agentRoot 'data/v02' }
$agentNode = (Get-Command node -ErrorAction Stop).Source
$agentPython = Join-Path $agentRoot '.python-venv/Scripts/python.exe'
if (-not $env:PYTHON -and (Test-Path -LiteralPath $agentPython)) { $env:PYTHON = $agentPython }
$env:PYTHONUTF8 = '1'
if ([int](& $agentNode -p 'parseInt(process.versions.node)') -lt 22) {
    throw '需要 Node.js 22 或更高版本，请按使用说明安装后重试。'
}
$buildText = & $agentNode (Join-Path $agentRoot 'src/build-info.mjs')
if ($LASTEXITCODE -ne 0) { throw '无法读取本地版本，请检查安装包是否完整。' }
$expected = $buildText | ConvertFrom-Json
$agentInfo = $null
try { $agentInfo = Invoke-RestMethod -Uri "$agentUrl/api/config" -TimeoutSec 2 } catch { }
if ($agentInfo) {
    if ($agentInfo.application -ne 'ui-test-agent') { throw '此端口被其他程序使用，请按说明设置其他端口。' }
    if ($agentInfo.build_id -ne $expected.build_id) {
        throw '当前运行的是另一构建版本。请先完成或停止测试并正常关闭原服务，再启动新版。此操作不会强制终止原会话。'
    }
    if ($agentInfo.instance.data_directory_id -ne $expected.data_directory_id) {
        throw '当前实例使用另一个数据目录，请停止原实例或选择其他端口，避免打开错误的历史记录。'
    }
} else {
    if (-not (Test-Path -LiteralPath (Join-Path $agentRoot 'node_modules/playwright/package.json'))) {
        throw '依赖尚未安装，请按使用说明运行 npm ci 和 npx playwright install chromium。'
    }
    New-Item -ItemType Directory -Path $agentData -Force | Out-Null
    $agentEntry = Join-Path $agentRoot 'src/server.mjs'
    $agentProcess = Start-Process -FilePath $agentNode -ArgumentList ('"' + $agentEntry + '"') -WorkingDirectory $agentRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $agentData "server-$agentPort.stdout.log") -RedirectStandardError (Join-Path $agentData "server-$agentPort.stderr.log")
    for ($agentAttempt = 0; $agentAttempt -lt 40; $agentAttempt++) {
        Start-Sleep -Milliseconds 250
        if ($agentProcess.HasExited) { throw "启动失败，请查看 $agentData/server-$agentPort.stderr.log 中的错误代码。" }
        try { $agentInfo = Invoke-RestMethod -Uri "$agentUrl/api/config" -TimeoutSec 1 } catch { continue }
        if ($agentInfo.build_id -eq $expected.build_id -and $agentInfo.instance.data_directory_id -eq $expected.data_directory_id) { break }
        throw '启动端口出现其他实例，请核实端口配置。'
    }
    if (-not $agentInfo) { throw "服务尚未就绪，请查看 $agentData/server-$agentPort.stderr.log。" }
    Set-Content -LiteralPath (Join-Path $agentData "server-$agentPort.pid") -Value $agentProcess.Id -Encoding utf8
}
Write-Output "UI 测试 Agent $($agentInfo.version)：$agentUrl"
Write-Output "构建：$($agentInfo.build_id.Substring(0, 12))"
if (-not $NoOpen) { Start-Process $agentUrl }
