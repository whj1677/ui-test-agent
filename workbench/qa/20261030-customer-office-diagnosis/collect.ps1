param([string]$ProgramRoot,[switch]$SkipDocument,[string]$Output)
$ErrorActionPreference='Stop'
Write-Host '[启动] 现场诊断 v2 已启动；不会调用模型。'
try {
 . (Join-Path $PSScriptRoot 'diagnostic-process.ps1')
 Write-Host '[1/5] 正在确认安装目录；如有选择窗口，请完成选择。'
 Add-Type -AssemblyName System.Windows.Forms
 if(-not$ProgramRoot){
  $location=[Microsoft.Win32.Registry]::GetValue('HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Uninstall\{ACB05159-C0F8-4B5B-8E57-6F734FA1A2AC}_is1','InstallLocation',$null)
  if($location){$ProgramRoot=Join-Path $location 'program'}
 }
 if(-not$ProgramRoot -or -not(Test-Path -LiteralPath (Join-Path $ProgramRoot 'workbench/server/requirements/office-word-reader.exe'))){
  $folder=New-Object Windows.Forms.FolderBrowserDialog;$folder.Description='选择测试工作台安装目录（包含program的目录，或program目录本身）'
  if($folder.ShowDialog()-ne[Windows.Forms.DialogResult]::OK){throw '未选择工作台安装目录'}
  $ProgramRoot=$folder.SelectedPath
  if(Test-Path -LiteralPath (Join-Path $ProgramRoot 'program/workbench/server/requirements/office-word-reader.exe')){$ProgramRoot=Join-Path $ProgramRoot 'program'}
 }
 $node=Join-Path $ProgramRoot 'runtime/node/node.exe'
 if(-not(Test-Path -LiteralPath $node)){throw '所选目录没有工作台自带的runtime/node/node.exe，请选择实际安装目录。'}
 if(-not$Output){$Output=Join-Path $PSScriptRoot ('现场诊断-'+[DateTime]::Now.ToString('yyyyMMdd-HHmmssfff')+'.json')}
 if(Test-Path -LiteralPath $Output){throw '目标报告已存在，请使用新的输出文件名，避免混淆旧结果。'}
 Write-Host '[2/5] 正在采集命令路径与 Windows 错误事件，最多等待20秒。'
 $ps=Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
 $systemArguments='-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+(Join-Path $PSScriptRoot 'collect-system.ps1')+'" -ProgramRoot "'+$ProgramRoot.TrimEnd('\','/')+'" -Output "'+$Output+'.system.json"'
 $systemResult=Invoke-DiagnosticProcess -Executable $ps -Arguments $systemArguments -Stage 'SYSTEM_METADATA' -TimeoutSeconds 20
 if($systemResult.timed_out -or -not(Test-Path -LiteralPath ($Output+'.system.json'))){
  $partial=@{schema='workbench/field-system-diagnostic-v1';scope='OUTSIDE_DSH_SANDBOX';model_calls=0}
  try{$partial=Get-Content -LiteralPath ($Output+'.system.json') -Raw -Encoding UTF8 | ConvertFrom-Json | ForEach-Object { $h=@{};foreach($p in $_.PSObject.Properties){$h[$p.Name]=$p.Value};$h }}catch{}
  $partial['event_status']=if($systemResult.timed_out){'TIMED_OUT'}else{'NOT_VERIFIED'}
  $partial['collector_process']=$systemResult
  [IO.File]::WriteAllText(($Output+'.system.json'),($partial | ConvertTo-Json -Depth 10),[Text.UTF8Encoding]::new($false))
 }
 $arguments=@((Join-Path $PSScriptRoot 'collect.mjs'),'--program-root',$ProgramRoot,'--output',$Output)
 if(-not$SkipDocument){
  Write-Host '[3/5] 请选择刚才报错的DOCX（选择窗口可能在后台）；取消则仅检查环境。'
  $dialog=New-Object Windows.Forms.OpenFileDialog;$dialog.Title='选择刚才报错的DOCX（本机只读诊断）';$dialog.Filter='Word文档 (*.docx)|*.docx';$dialog.Multiselect=$false
  if($dialog.ShowDialog()-eq[Windows.Forms.DialogResult]::OK){$arguments+=@('--document',$dialog.FileName)}
 }
 Write-Host '[4/5] 正在检查安装文件、宿主锁和 Office；过程会显示阶段，最多等待300秒。'
 $quotedArguments=($arguments | ForEach-Object {'"'+$_.TrimEnd('\','/')+'"'}) -join ' '
 $nodeResult=Invoke-DiagnosticProcess -Executable $node -Arguments $quotedArguments -Stage 'NODE_COLLECTOR' -TimeoutSeconds 300 -ProgressReport $Output
 $nodeExit=$nodeResult.exit_code
 if(-not(Test-Path -LiteralPath $Output)){
  $fallback=[ordered]@{schema='workbench/office-field-diagnostic-v1';at=[DateTime]::UtcNow.ToString('o');collector_fatal=@{stage='BUNDLED_NODE_START';exit_code=$nodeExit};outside_sandbox_system=(Get-Content -LiteralPath ($Output+'.system.json') -Raw -Encoding UTF8 | ConvertFrom-Json)}
  [IO.File]::WriteAllText($Output,($fallback | ConvertTo-Json -Depth 12),[Text.UTF8Encoding]::new($false))
 }
 if($nodeResult.timed_out){
  $partial=Get-Content -LiteralPath $Output -Raw -Encoding UTF8 | ConvertFrom-Json
  $partial | Add-Member -Force NoteProperty status 'PARTIAL'
  $partial | Add-Member -Force NoteProperty collector_timeout $nodeResult
  $partial | Add-Member -Force NoteProperty collector_abort_cleanup 'NOT_CONFIRMED'
  [IO.File]::WriteAllText($Output,($partial | ConvertTo-Json -Depth 20),[Text.UTF8Encoding]::new($false))
 }
 Write-Host '[5/5] 采集已结束，正在确认报告。'
 $finalReport=Get-Content -LiteralPath $Output -Raw -Encoding UTF8 | ConvertFrom-Json
 if($finalReport.status -eq 'PARTIAL' -or $nodeExit -ne 0){Write-Host '[部分完成] 有步骤失败或超时，已保留采集结果和失败阶段。'}
 if(Test-Path -LiteralPath $Output){Write-Host '';Write-Host ('报告已生成：'+$Output);Write-Host '请把这个JSON发回；即使其中检查失败，也请保留原报告。';exit 0}
 throw '报告未生成，请保留当前窗口的错误信息。'
}catch{Write-Host ('诊断未完成：'+$_.Exception.Message);exit 1}
