$ErrorActionPreference = 'Stop'
$trialTargetScript = Join-Path $PSScriptRoot 'start-target.mjs'
& node $trialTargetScript
if ($LASTEXITCODE -ne 0) { throw '合成练习站点未启动；请先识别 4401 的占用，不要终止未知进程。' }
