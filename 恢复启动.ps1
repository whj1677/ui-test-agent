$ErrorActionPreference = 'Stop'
Write-Output '仅处理异常退出留下的进程锁。不会删除任务、清理标记或历史事实，也不会杀掉仍在运行的进程。'
$agentNode = Get-Command node -ErrorAction Stop
& $agentNode.Source (Join-Path $PSScriptRoot 'src/installation.mjs') recover
if ($LASTEXITCODE -ne 0) { throw '恢复未完成，请按上面的提示处理。' }
& (Join-Path $PSScriptRoot '启动.ps1')
