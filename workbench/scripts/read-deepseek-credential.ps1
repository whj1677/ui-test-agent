[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$CredentialFile)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$env:PSModulePath = Join-Path $PSHOME 'Modules'
$keyPointer = [IntPtr]::Zero
try {
  if (-not [IO.Path]::IsPathRooted($CredentialFile)) { throw 'INVALID_PATH' }
  $encrypted = [IO.File]::ReadAllText($CredentialFile)
  if ($encrypted.Length -gt 65536) { throw 'INVALID_SIZE' }
  $secureKey = ConvertTo-SecureString -String $encrypted
  $keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
  $plainKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
  if ($plainKey.Length -lt 1 -or $plainKey.Length -gt 4096 -or $plainKey -match '[\x00-\x1f\x7f]') { throw 'INVALID_KEY' }
  [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
  [Console]::Out.Write((@{ apiKey=$plainKey } | ConvertTo-Json -Compress))
} catch {
  # Never return the PowerShell exception, encrypted input or secret to logs.
  [Console]::Error.Write('MODEL_CREDENTIAL_DPAPI_UNAVAILABLE')
  exit 20
} finally {
  if ($keyPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer) }
  $plainKey = $null
  if ($secureKey) { $secureKey.Dispose() }
}
