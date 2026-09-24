# 使用临时合成数据验证配置隔离；不读取私有配置，不启动服务或 Harness。
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
& node --test (Join-Path $PSScriptRoot '../tests/start-config.test.mjs')
exit $LASTEXITCODE
