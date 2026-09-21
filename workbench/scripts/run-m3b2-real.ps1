$ErrorActionPreference = 'Stop'

$secureKey = Read-Host '请输入本次 DeepSeek API Key（输入会被遮蔽）' -AsSecureString
$keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
    $apiKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
    if ([string]::IsNullOrWhiteSpace($apiKey)) { throw 'DEEPSEEK_API_KEY_REQUIRED' }

    $baseUrl = Read-Host '请输入已批准的 DeepSeek Base URL'
    $parsedBaseUrl = $null
    if (-not [Uri]::TryCreate($baseUrl, [UriKind]::Absolute, [ref]$parsedBaseUrl) -or $parsedBaseUrl.Scheme -ne 'https') {
        throw 'DEEPSEEK_BASE_URL_INVALID'
    }

    $edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
    if (-not (Test-Path -LiteralPath $edge -PathType Leaf)) { throw 'DSH_PROBE_BROWSER_EXECUTABLE_MISSING' }

    $env:DEEPSEEK_API_KEY = $apiKey
    $env:DEEPSEEK_BASE_URL = $baseUrl
    $env:DSH_PROBE_BROWSER_EXECUTABLE = $edge
    npm run test:m3b2-real
    exit $LASTEXITCODE
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
    $apiKey = $null
    Remove-Item Env:DEEPSEEK_API_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:DEEPSEEK_BASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:DSH_PROBE_BROWSER_EXECUTABLE -ErrorAction SilentlyContinue
}
