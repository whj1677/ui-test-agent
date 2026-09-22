$ErrorActionPreference = 'Stop'

$secureKey = Read-Host '请输入本次 DeepSeek API Key（输入不可见）' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
  $env:DEEPSEEK_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  $env:DEEPSEEK_BASE_URL = 'https://api.deepseek.com'
  if (-not $env:DSH_PROBE_BROWSER_EXECUTABLE) {
    $env:DSH_PROBE_BROWSER_EXECUTABLE = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
  }
  node tests/m4a-query-case-real.integration.mjs
  exit $LASTEXITCODE
}
finally {
  $env:DEEPSEEK_API_KEY = $null
  $env:DEEPSEEK_BASE_URL = $null
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
}
