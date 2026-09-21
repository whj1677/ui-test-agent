$ErrorActionPreference = 'Stop'
$secureKey = Read-Host '请输入本次 DeepSeek API Key（不回显、不写盘）' -AsSecureString
$keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)

try {
    $env:DEEPSEEK_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
    $env:DEEPSEEK_BASE_URL = 'https://api.deepseek.com/anthropic'
    $env:DSH_PROBE_BROWSER_EXECUTABLE = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
    $env:M2C_BUILD_AUTHORIZATION_ID = 'm2c-wait-fix-validation-20260921'
    Push-Location (Split-Path -Parent $PSScriptRoot)
    try {
        npm run test:build-revalidation
    }
    finally {
        Pop-Location
    }
}
finally {
    $env:DEEPSEEK_API_KEY = $null
    $env:M2C_BUILD_AUTHORIZATION_ID = $null
    if ($keyPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
    }
}
