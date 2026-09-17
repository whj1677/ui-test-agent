param([string]$Destination)
$ErrorActionPreference = 'Stop'
if (-not $Destination) { $Destination = Read-Host '请输入新的备份文件夹完整路径（父文件夹须存在）' }
Write-Output '备份包含业务资料及截图录像，请仅保存到获准位置。必须先正常停止服务。'
& (Get-Command node -ErrorAction Stop).Source (Join-Path $PSScriptRoot 'src/installation.mjs') backup $Destination
if ($LASTEXITCODE -ne 0) { throw '备份未完成。请保留原数据，勿将不完整备份用于回退。' }
