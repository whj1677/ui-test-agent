$ErrorActionPreference = 'Stop'

$credentialDirectory = Join-Path $env:LOCALAPPDATA 'ui-test-agent\credentials'
$credentialFile = Join-Path $credentialDirectory 'deepseek-api-key.dpapi'
$baseUrlFile = Join-Path $credentialDirectory 'deepseek-base-url.txt'
$loadedKey = $false
$loadedBaseUrl = $false
$pointer = [IntPtr]::Zero
try {
  if (-not $env:DEEPSEEK_API_KEY) {
    if (-not (Test-Path -LiteralPath $credentialFile)) {
      throw '未找到已保存凭据。请先运行：pwsh -NoProfile -File .\scripts\save-deepseek-credential.ps1'
    }
    $secureKey = Get-Content -LiteralPath $credentialFile -Raw | ConvertTo-SecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
    $env:DEEPSEEK_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    $loadedKey = $true
  }
  if (-not $env:DEEPSEEK_BASE_URL) {
    $env:DEEPSEEK_BASE_URL = if (Test-Path -LiteralPath $baseUrlFile) {
      (Get-Content -LiteralPath $baseUrlFile -Raw).Trim()
    } else { 'https://api.deepseek.com' }
    $loadedBaseUrl = $true
  }
  if (-not $env:DSH_PROBE_BROWSER_EXECUTABLE) {
    $env:DSH_PROBE_BROWSER_EXECUTABLE = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
  }
  node tests/m4a-query-case-real.integration.mjs
  exit $LASTEXITCODE
}
finally {
  if ($loadedKey) { $env:DEEPSEEK_API_KEY = $null }
  if ($loadedBaseUrl) { $env:DEEPSEEK_BASE_URL = $null }
  if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}
