# Configuration preparation runs in the launcher's own filesystem view. It never
# initializes a runtime, reads credentials, or grants case/budget authorization.
function Get-WorkbenchConfigSha256 {
  param([byte[]]$Bytes)
  $algorithm = [Security.Cryptography.SHA256]::Create()
  try { return ([BitConverter]::ToString($algorithm.ComputeHash($Bytes))).Replace('-', '') }
  finally { $algorithm.Dispose() }
}

function Get-WorkbenchConfigStorage {
  param([string]$Path)
  $item = Get-Item -LiteralPath $Path -Force -ErrorAction Stop
  $effective = $null
  # Windows PowerShell's provider may expose an MSIX redirected target even
  # when Attributes does not contain ReparsePoint. Resolve-Path alone cannot.
  $targets = @($item.Target | Where-Object { $_ -and [IO.Path]::IsPathRooted([string]$_) })
  if ($targets.Count -eq 1) { $effective = [IO.Path]::GetFullPath([string]$targets[0]) }
  $cachePattern = '[\\/]Packages[\\/]OpenAI\.Codex_[^\\/]+[\\/]LocalCache[\\/]'
  $cacheView = $null
  if ($Path -match $cachePattern) { $cacheView = $true }
  elseif ($effective) { $cacheView = [bool]($effective -match $cachePattern) }
  return [ordered]@{
    requested_path = [IO.Path]::GetFullPath($Path)
    effective_path = $effective
    identity_status = $(if ($effective) { 'PROVIDER_TARGET' } else { 'UNKNOWN' })
    codex_cache_view = $cacheView
    bytes = $item.Length
    modified_at_utc = $item.LastWriteTimeUtc.ToString('o')
    scope_notice = $(if ($cacheView) { 'CODEX_CACHE_VIEW_ONLY_NOT_EXTERNAL_TERMINAL' } else { 'CURRENT_PROCESS_VIEW_ONLY_EFFECTIVE_PATH_MAY_BE_UNKNOWN' })
  }
}

function Read-WorkbenchModelConfig {
  param([Parameter(Mandatory=$true)][string]$TrialPath)
  if (-not [IO.Path]::IsPathRooted($TrialPath)) { throw 'MODEL_CONFIG_ABSOLUTE_PATH_REQUIRED' }
  $TrialPath = [IO.Path]::GetFullPath($TrialPath)
  $item = Get-Item -LiteralPath $TrialPath -Force -ErrorAction Stop
  if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'MODEL_CONFIG_REGULAR_FILE_REQUIRED' }
  $bytes = [IO.File]::ReadAllBytes($TrialPath)
  $encoding = New-Object Text.UTF8Encoding($false, $true)
  try {
    $text = $encoding.GetString($bytes)
    $jsonText = $text.TrimStart([char]0xFEFF)
    $value = $jsonText | ConvertFrom-Json -ErrorAction Stop
  } catch { throw 'MODEL_CONFIG_JSON_INVALID' }
  if (-not ($value -is [PSCustomObject])) { throw 'MODEL_CONFIG_OBJECT_REQUIRED' }

  # Locate only the root JSON property's Boolean token. Replacing its exact
  # span preserves every other byte, including large numbers and nested data.
  $tokens = @()
  $depth = 0
  for ($i = 0; $i -lt $text.Length; $i++) {
    $character = $text[$i]
    if ($character -eq '{' -or $character -eq '[') { $depth++; continue }
    if ($character -eq '}' -or $character -eq ']') { $depth--; continue }
    if ($character -ne '"') { continue }
    $start = $i
    $i++
    while ($i -lt $text.Length) {
      if ($text[$i] -eq '\') { $i += 2; continue }
      if ($text[$i] -eq '"') { break }
      $i++
    }
    if ($depth -ne 1) { continue }
    $next = $i + 1
    while ($next -lt $text.Length -and [char]::IsWhiteSpace($text[$next])) { $next++ }
    if ($next -ge $text.Length -or $text[$next] -ne ':') { continue }
    $key = $text.Substring($start, $i - $start + 1) | ConvertFrom-Json -ErrorAction Stop
    if ($key -cne 'model_calls_allowed') { continue }
    $next++
    while ($next -lt $text.Length -and [char]::IsWhiteSpace($text[$next])) { $next++ }
    $literal = [regex]::Match($text.Substring($next), '^(true|false)(?=\s*[,}])')
    if (-not $literal.Success) { throw 'MODEL_CONFIG_BOOLEAN_REQUIRED' }
    $tokens += @{ start = $next; length = $literal.Length; enabled = $literal.Value -ceq 'true' }
  }
  if ($tokens.Count -ne 1) { throw 'MODEL_CONFIG_SINGLE_FLAG_REQUIRED' }
  $safe = [ordered]@{
    trial_path = $TrialPath
    trial_sha256 = Get-WorkbenchConfigSha256 -Bytes $bytes
    model_calls_allowed = [bool]$tokens[0].enabled
    value_type = 'System.Boolean'
    storage = Get-WorkbenchConfigStorage -Path $TrialPath
  }
  return @{ bytes = $bytes; text = $text; token = $tokens[0]; safe = $safe }
}

function Get-WorkbenchModelConfigState {
  param([Parameter(Mandatory=$true)][string]$TrialPath)
  return (Read-WorkbenchModelConfig -TrialPath $TrialPath).safe
}

function Prepare-WorkbenchModelConfig {
  param([Parameter(Mandatory=$true)][string]$TrialPath, [switch]$CheckOnly)
  $before = Read-WorkbenchModelConfig -TrialPath $TrialPath
  if ($CheckOnly -or $before.safe.model_calls_allowed) {
    return [ordered]@{ changed = $false; status = $(if ($CheckOnly) { 'CHECK_ONLY' } else { 'ALREADY_ENABLED' }); before = $before.safe; after = $before.safe }
  }
  $trial = $before.safe.trial_path
  $text = $before.text.Remove($before.token.start, $before.token.length).Insert($before.token.start, 'true')
  $bytes = (New-Object Text.UTF8Encoding($false, $true)).GetBytes($text)
  $expectedSha = Get-WorkbenchConfigSha256 -Bytes $bytes
  $temporary = Join-Path ([IO.Path]::GetDirectoryName($trial)) ('.model-config-' + [guid]::NewGuid().ToString('N') + '.tmp')
  $ownsTemporary = $false
  try {
    $stream = [IO.File]::Open($temporary, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    $ownsTemporary = $true
    try { $stream.Write($bytes, 0, $bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
    if ((Get-WorkbenchConfigSha256 -Bytes ([IO.File]::ReadAllBytes($trial))) -cne $before.safe.trial_sha256) { throw 'MODEL_CONFIG_CHANGED_DURING_PREPARE' }
    [IO.File]::Replace($temporary, $trial, [NullString]::Value)
    $ownsTemporary = $false
    $after = Read-WorkbenchModelConfig -TrialPath $trial
    if (-not $after.safe.model_calls_allowed -or $after.safe.trial_sha256 -cne $expectedSha) { throw 'MODEL_CONFIG_READBACK_MISMATCH' }
    return [ordered]@{ changed = $true; status = 'PREPARED_AND_VERIFIED'; before = $before.safe; after = $after.safe }
  } finally {
    if ($ownsTemporary -and [IO.File]::Exists($temporary)) { [IO.File]::Delete($temporary) }
  }
}
