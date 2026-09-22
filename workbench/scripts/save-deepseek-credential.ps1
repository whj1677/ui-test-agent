$ErrorActionPreference = 'Stop'

$credentialDirectory = Join-Path $env:LOCALAPPDATA 'ui-test-agent\credentials'
$credentialFile = Join-Path $credentialDirectory 'deepseek-api-key.dpapi'
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
Write-Output '后续工作台前台脚本会自动读取；密钥未写入仓库、命令行或普通配置。'
