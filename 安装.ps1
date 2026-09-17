param([switch]$SkipExcel)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$agentNode = Get-Command node -ErrorAction SilentlyContinue
if (-not $agentNode -or [int](& $agentNode.Source -p 'parseInt(process.versions.node)') -lt 22) {
    throw '请先从 https://nodejs.org/ 安装 Node.js 22 或更高版本，然后重新运行安装。'
}
$agentData = if ($env:UI_AGENT_DATA_DIR) { $env:UI_AGENT_DATA_DIR } else { Join-Path $PSScriptRoot 'data/v02' }
if (Test-Path -LiteralPath (Join-Path $agentData '.writer.lock')) { throw '请先正常停止本数据目录的服务，再安装依赖。' }
Write-Output '即将从 npm 与 Playwright 下载固定版本的运行依赖及 Chromium。不会配置或发送 DeepSeek Key。'
& npm.cmd ci --omit=dev --ignore-scripts
if ($LASTEXITCODE -ne 0) { throw '依赖安装失败，请检查网络后重新运行；历史数据不会被删除。' }
& $agentNode.Source (Join-Path $PSScriptRoot 'node_modules/playwright/cli.js') install chromium
if ($LASTEXITCODE -ne 0) { throw 'Chromium 下载失败，请检查网络后重新运行安装。' }
if (-not $SkipExcel) {
    $agentPython = Get-Command python -ErrorAction SilentlyContinue
    if ($agentPython) {
        & $agentPython.Source -c 'import sys; assert sys.version_info >= (3,10)'
        if ($LASTEXITCODE -ne 0) { throw 'Excel 导入需要 Python 3.10 或更高版本。' }
        $agentVenv = Join-Path $PSScriptRoot '.python-venv'
        if (-not (Test-Path -LiteralPath (Join-Path $agentVenv 'Scripts/python.exe'))) {
            & $agentPython.Source -m venv $agentVenv
            if ($LASTEXITCODE -ne 0) { throw '无法创建 Excel 导入专用 Python 环境，请检查权限和 Python 安装。' }
        }
        & (Join-Path $agentVenv 'Scripts/python.exe') -m pip install -r (Join-Path $PSScriptRoot 'requirements-import.txt')
        if ($LASTEXITCODE -ne 0) { throw 'Excel 依赖安装失败，请检查网络后重试。' }
    } else {
        Write-Output '未发现 Python。JSON/CSV 仍可使用；需要 Excel 时，从 https://www.python.org/ 安装 Python 3.10+ 并加入 PATH，然后重跑安装。'
    }
}
& $agentNode.Source (Join-Path $PSScriptRoot 'src/installation.mjs') doctor
if ($LASTEXITCODE -ne 0) { throw '环境尚未就绪，请按上面的中文提示处理。' }
Write-Output '运行依赖就绪。请双击 启动.cmd，按 试用说明.md 操作；此结果不代表产品或发布验收通过。'
