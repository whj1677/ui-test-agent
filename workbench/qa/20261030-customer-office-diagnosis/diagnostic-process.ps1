function Invoke-DiagnosticProcess {
 param([string]$Executable,[string]$Arguments,[string]$Stage,[int]$TimeoutSeconds,[string]$ProgressReport)
 $info=New-Object Diagnostics.ProcessStartInfo
 $info.FileName=$Executable;$info.Arguments=$Arguments
 $info.UseShellExecute=$false;$info.CreateNoWindow=$true
 $child=New-Object Diagnostics.Process;$child.StartInfo=$info
 $watch=[Diagnostics.Stopwatch]::StartNew();$lastNotice=0;$lastStage=''
 try {
  if(-not $child.Start()){throw 'DIAGNOSTIC_PROCESS_NOT_STARTED'}
  while(-not $child.WaitForExit(500)){
   $current=$Stage
   if($ProgressReport -and (Test-Path -LiteralPath $ProgressReport)){
    try{$row=Get-Content -LiteralPath $ProgressReport -Raw -Encoding UTF8 | ConvertFrom-Json;if($row.current_stage -match '^[A-Z_]{3,80}$'){$current=$row.current_stage}}catch{}
   }
   if($current -ne $lastStage -or ($watch.Elapsed.TotalSeconds-$lastNotice) -ge 5){
    Write-Host ('[等待] '+$current+'，已等待 '+[int]$watch.Elapsed.TotalSeconds+' 秒（本步骤最多 '+$TimeoutSeconds+' 秒）')
    $lastStage=$current;$lastNotice=$watch.Elapsed.TotalSeconds
   }
   if($watch.Elapsed.TotalSeconds -ge $TimeoutSeconds){
    # Only this exact process was started by this invocation. Never kill by name or enumerate/kill other processes.
    if(-not $child.HasExited){$child.Kill();[void]$child.WaitForExit(3000)}
    Write-Host ('[超时] '+$current+'；保留已有结果。')
    return @{timed_out=$true;exit_code=$null;stage=$current;elapsed_seconds=[int]$watch.Elapsed.TotalSeconds}
   }
  }
  return @{timed_out=$false;exit_code=$child.ExitCode;stage=$Stage;elapsed_seconds=[int]$watch.Elapsed.TotalSeconds}
 } finally {$watch.Stop();$child.Dispose()}
}
