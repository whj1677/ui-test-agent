# Keep this small PowerShell adapter aligned with model-credential-storage.mjs.
# Selection and metadata checks never read or decrypt credential bytes.
function Get-WorkbenchCredentialPaths {
  param([string]$UserProfile = $env:USERPROFILE, [string]$LocalAppData = $env:LOCALAPPDATA)
  if ($UserProfile -and [IO.Path]::IsPathRooted($UserProfile) -and $UserProfile -notmatch '^[A-Za-z]:($|[^\\/])') {
    Join-Path $UserProfile '.ui-test-agent/credentials/deepseek-api-key.dpapi'
  }
  if ($LocalAppData -and [IO.Path]::IsPathRooted($LocalAppData) -and $LocalAppData -notmatch '^[A-Za-z]:($|[^\\/])') {
    Join-Path $LocalAppData 'ui-test-agent/credentials/deepseek-api-key.dpapi'
  }
}

function Get-WorkbenchCredentialWritePath {
  param([string]$UserProfile = $env:USERPROFILE, [string]$LocalAppData = $env:LOCALAPPDATA)
  $paths = @(Get-WorkbenchCredentialPaths -UserProfile $UserProfile -LocalAppData $LocalAppData)
  if (-not $paths.Count) { throw 'MODEL_CREDENTIAL_STORAGE_PATH_REQUIRED' }
  return $paths[0]
}

function Find-WorkbenchCredentialFile {
  param([string]$UserProfile = $env:USERPROFILE, [string]$LocalAppData = $env:LOCALAPPDATA)
  foreach ($file in @(Get-WorkbenchCredentialPaths -UserProfile $UserProfile -LocalAppData $LocalAppData)) {
    try { $item = Get-Item -LiteralPath $file -Force -ErrorAction Stop }
    catch {
      if ($_.Exception -is [System.Management.Automation.ItemNotFoundException]) { continue }
      throw 'MODEL_CREDENTIAL_DPAPI_UNAVAILABLE'
    }
    if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $item.Length -lt 1 -or $item.Length -gt 65536) {
      throw 'MODEL_CREDENTIAL_DPAPI_INVALID'
    }
    return $file
  }
  return $null
}
