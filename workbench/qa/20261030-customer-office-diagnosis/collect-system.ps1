param([Parameter(Mandatory=$true)][string]$ProgramRoot,[Parameter(Mandatory=$true)][string]$Output)
$ErrorActionPreference='Stop'
$report=[ordered]@{schema='workbench/field-system-diagnostic-v1';at=[DateTime]::UtcNow.ToString('o');scope='OUTSIDE_DSH_SANDBOX';model_calls=0}
try {
 $system32=Join-Path $env:SystemRoot 'System32'
 $nodeDirectory=Join-Path $ProgramRoot 'runtime/node'
 $directories=@($env:PATH -split ';' | ForEach-Object { $_.Trim('"').TrimEnd('\','/') })
 $report.environment=[ordered]@{
  system_root_present=[bool]$env:SystemRoot
  system32_exists=(Test-Path -LiteralPath $system32 -PathType Container)
  path_present=[bool]$env:PATH
  path_contains_system32=($directories -contains $system32.TrimEnd('\','/'))
  path_contains_bundled_node=($directories -contains $nodeDirectory.TrimEnd('\','/'))
  pathext_present=[bool]$env:PATHEXT
  comspec_exists=([bool]$env:COMSPEC -and (Test-Path -LiteralPath $env:COMSPEC -PathType Leaf))
 }
 $report.command_lookup=@(foreach($name in @('cmd.exe','curl.exe','node.exe')) {
  $found=Get-Command -Name $name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  $kind='NOT_FOUND'
  if($found){
   $folder=[IO.Path]::GetDirectoryName($found.Source)
   $kind=if($folder -ieq $system32){'SYSTEM32'}elseif($folder -ieq $nodeDirectory){'BUNDLED_NODE'}else{'OTHER_LOCATION'}
  }
  [ordered]@{name=$name;status=$kind}
 })
} catch { $report.environment_error=@{type=$_.Exception.GetType().FullName;id=$_.FullyQualifiedErrorId} }
$report.event_status='COLLECTING'
[IO.File]::WriteAllText($Output,($report | ConvertTo-Json -Depth 8),[Text.UTF8Encoding]::new($false))
try {
 $events=@(Get-WinEvent -FilterHashtable @{LogName='Application';Id=@(1000,1001,26);StartTime=(Get-Date).AddHours(-2)} -MaxEvents 200 -ErrorAction Stop)
 $rows=@(foreach($event in $events) {
  $xml=[xml]$event.ToXml()
  $pairs=@{};foreach($item in $xml.Event.EventData.Data){if($item.Name){$pairs[[string]$item.Name]=[string]$item.'#text'}}
  # Inspect message only locally; never export its paths, arguments or body.
  $message=[string]$event.Message
  if($message -notmatch '(?i)node\.exe|0xc0000142|3221225794|-1073741502'){continue}
  $row=[ordered]@{at=$event.TimeCreated.ToUniversalTime().ToString('o');id=$event.Id;provider=$event.ProviderName}
  foreach($name in @('AppName','ModuleName','ExceptionCode','ProcessId')) {
   if(-not $pairs.ContainsKey($name)){continue}
   $value=$pairs[$name]
   if($name -eq 'AppName' -or $name -eq 'ModuleName'){$row[$name]=[IO.Path]::GetFileName($value)}
   elseif($value -match '^(?:0x)?[a-fA-F0-9]{1,16}$'){$row[$name]=$value}
  }
  if($message -match '(?i)0xc0000142|3221225794|-1073741502'){$row['dll_init_failed']= $true}
  if($message -match '(?i)node\.exe'){$row['mentions_node']= $true}
  $row
 })
 $report.application_events=@($rows | Select-Object -First 20)
 $report.event_status='OK'
} catch {
 $report.event_status=if($_.FullyQualifiedErrorId -like 'NoMatchingEventsFound*'){'NO_MATCHING_EVENTS'}else{'NOT_VERIFIED'}
 $report.event_error=@{type=$_.Exception.GetType().FullName;id=$_.FullyQualifiedErrorId}
}
[IO.File]::WriteAllText($Output,($report | ConvertTo-Json -Depth 8),[Text.UTF8Encoding]::new($false))
