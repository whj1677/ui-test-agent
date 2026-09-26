param([switch]$SkipExcel)
$ErrorActionPreference = 'Stop'
# 兼容旧 -SkipExcel 参数；正式工作台 Excel 由 exceljs 处理，无需 Python。
$agentRoot = $PSScriptRoot
$agentNode = Get-Command node -ErrorAction SilentlyContinue
if (-not $agentNode -or [int](& $agentNode.Source -p 'parseInt(process.versions.node)') -lt 22) {
    throw '请先安装 Node.js 22 或更高版本，然后重新运行安装。'
}
if (Get-NetTCPConnection -LocalPort 4322 -State Listen -ErrorAction SilentlyContinue) {
    throw '正式工作台 4322 正在运行。请等任务结束并正常停止后再更新依赖；不会结束进程或切换端口。'
}
Write-Output '安装根程序、正式工作台和 Harness 的锁定依赖，并下载 Chromium；不会登录模型服务或保存凭据。'
foreach ($relative in @('.', 'workbench', 'harness-probe')) {
    $directory = [System.IO.Path]::GetFullPath((Join-Path $agentRoot $relative))
    if (-not (Test-Path -LiteralPath (Join-Path $directory 'package-lock.json'))) { throw "缺少依赖锁文件：$relative/package-lock.json" }
    Write-Output "安装依赖：$relative"
    & npm.cmd --prefix $directory ci --omit=dev --ignore-scripts
    if ($LASTEXITCODE -ne 0) { throw "依赖安装失败：$relative。请检查网络后重试；不会清除历史工作台数据。" }
}
& $agentNode.Source (Join-Path $agentRoot 'workbench/node_modules/playwright/cli.js') install chromium
if ($LASTEXITCODE -ne 0) { throw 'Chromium 下载失败，请检查网络后重试。' }
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $agentRoot 'workbench/scripts/check-install.ps1')
if ($LASTEXITCODE -ne 0) { throw '正式工作台运行依赖尚未就绪，请查看上面的诊断。' }
Write-Output '依赖检查已完成。请双击 启动.cmd，打开 http://127.0.0.1:4322/workspace/。'
