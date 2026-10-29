$ErrorActionPreference = 'Stop'
$env:PSModulePath = Join-Path $PSHOME 'Modules'
. (Join-Path $PSScriptRoot 'credential-paths.ps1')

$credentialFile = Get-WorkbenchCredentialWritePath
$credentialDirectory = Split-Path -Parent $credentialFile
$baseUrlFile = Join-Path $credentialDirectory 'deepseek-base-url.txt'

if (Test-Path -LiteralPath $credentialFile) {
  $replace = Read-Host '已存在当前用户凭据，输入 REPLACE 才会覆盖'
  if ($replace -ne 'REPLACE') {
    Write-Output '未修改已保存的凭据。'
    exit 0
  }
}

$secureKey = Read-Host '请输入 DeepSeek API Key（输入不可见）' -AsSecureString
if ($secureKey.Length -lt 1) { throw 'DEEPSEEK_API_KEY_EMPTY' }

New-Item -ItemType Directory -Path $credentialDirectory -Force | Out-Null
$encrypted = ConvertFrom-SecureString -SecureString $secureKey
$temporary = Join-Path $credentialDirectory ("deepseek-api-key.{0}.tmp" -f [guid]::NewGuid())
try {
  [IO.File]::WriteAllText($temporary, $encrypted, [Text.UTF8Encoding]::new($false))
  Move-Item -LiteralPath $temporary -Destination $credentialFile -Force
  [IO.File]::WriteAllText($baseUrlFile, "https://api.deepseek.com`n", [Text.UTF8Encoding]::new($false))
} finally {
  Remove-Item -LiteralPath $temporary -Force -ErrorAction SilentlyContinue
}

Write-Output "已为当前 Windows 用户保存 DPAPI 加密凭据：$credentialFile"
Write-Output '随后运行“启用模型工作台.cmd”；程序将从当前用户的 DPAPI 凭据读取到内存。'
Write-Output '已有工作台请先正常停止再启动。显式配置旧 DSH_HOME 的开发环境继续使用其原凭据；本步骤不迁移或覆盖旧 DSH 配置。'
Write-Output '密钥未写入仓库、命令行或普通配置；重新安装程序不需要再次发送密钥。'
