param([string]$ProgramRoot,[switch]$SkipDocument,[string]$Output)
$ErrorActionPreference='Stop'
try {
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
 & (Join-Path $PSScriptRoot 'collect-system.ps1') -ProgramRoot $ProgramRoot -Output ($Output+'.system.json')
 $arguments=@((Join-Path $PSScriptRoot 'collect.mjs'),'--program-root',$ProgramRoot,'--output',$Output)
 if(-not$SkipDocument){
  Write-Host '请选择刚才报错的DOCX；只在本机只读检查，报告不保存文档正文，也不调用模型。取消则仅检查环境。'
  $dialog=New-Object Windows.Forms.OpenFileDialog;$dialog.Title='选择刚才报错的DOCX（本机只读诊断）';$dialog.Filter='Word文档 (*.docx)|*.docx';$dialog.Multiselect=$false
  if($dialog.ShowDialog()-eq[Windows.Forms.DialogResult]::OK){$arguments+=@('--document',$dialog.FileName)}
 }
 & $node @arguments
 $nodeExit=$LASTEXITCODE
 if(-not(Test-Path -LiteralPath $Output)){
  $fallback=[ordered]@{schema='workbench/office-field-diagnostic-v1';at=[DateTime]::UtcNow.ToString('o');collector_fatal=@{stage='BUNDLED_NODE_START';exit_code=$nodeExit};outside_sandbox_system=(Get-Content -LiteralPath ($Output+'.system.json') -Raw | ConvertFrom-Json)}
  [IO.File]::WriteAllText($Output,($fallback | ConvertTo-Json -Depth 12),[Text.UTF8Encoding]::new($false))
 }
 if(Test-Path -LiteralPath $Output){Write-Host '';Write-Host ('报告已生成：'+$Output);Write-Host '请把这个JSON发回；即使其中检查失败，也请保留原报告。';exit 0}
 throw '报告未生成，请保留当前窗口的错误信息。'
}catch{Write-Host ('诊断未完成：'+$_.Exception.Message);exit 1}
