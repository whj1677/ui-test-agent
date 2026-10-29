[CmdletBinding()]
param([string]$RuntimeHome, [switch]$PrepareOnly)
$ErrorActionPreference = 'Stop'
$env:PSModulePath = Join-Path $PSHOME 'Modules'
. (Join-Path $PSScriptRoot 'credential-paths.ps1')
if (-not $RuntimeHome) { $RuntimeHome = Join-Path $env:LOCALAPPDATA 'ui-test-agent/runtime' }
if (-not [IO.Path]::IsPathRooted($RuntimeHome)) { throw 'RuntimeHome 必须是绝对路径。' }
$RuntimeHome = [IO.Path]::GetFullPath($RuntimeHome)
$credentialFile = Find-WorkbenchCredentialFile
if (-not $credentialFile) {
  throw '还未保存当前 Windows 用户的模型密钥，请先运行“配置模型密钥.cmd”。'
}
# User invocation enables model availability only; it does not bind a target,
# grant per-case execution permission, or trigger a model request.
& (Join-Path $PSScriptRoot 'setup-runtime.ps1') -RuntimeHome $RuntimeHome
$configPath = Join-Path $RuntimeHome 'config/start-workbench.json'
$trialPath = Join-Path $RuntimeHome 'config/trial.json'
$trial = Get-Content -LiteralPath $trialPath -Raw -Encoding UTF8 | ConvertFrom-Json
$trial | Add-Member -MemberType NoteProperty -Name model_calls_allowed -Value $true -Force
$trial | Add-Member -MemberType NoteProperty -Name user_initiated_operations -Value $true -Force
$temporary = Join-Path (Split-Path -Parent $trialPath) ("trial.{0}.tmp" -f [guid]::NewGuid())
try {
  [IO.File]::WriteAllText($temporary, ($trial | ConvertTo-Json -Depth 30) + "`n", [Text.UTF8Encoding]::new($false))
  Move-Item -LiteralPath $temporary -Destination $trialPath -Force
} finally { Remove-Item -LiteralPath $temporary -Force -ErrorAction SilentlyContinue }
Write-Output '本机模型入口已启用；业务环境仍需在项目中配置，操作仍需逐任务授权。未发送模型请求。'
if ($PrepareOnly) { exit 0 }
& (Join-Path $PSScriptRoot 'start-workbench.ps1') -Data fresh-b -EnableModel -ConfigPath $configPath
exit $LASTEXITCODE
