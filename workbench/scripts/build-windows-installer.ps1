[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$ProgramRoot,[Parameter(Mandatory=$true)][string]$OutputDirectory,[Parameter(Mandatory=$true)][string]$Iscc)
$ErrorActionPreference='Stop'
$ProgramRoot=[IO.Path]::GetFullPath($ProgramRoot)
$OutputDirectory=[IO.Path]::GetFullPath($OutputDirectory)
if(Test-Path -LiteralPath $OutputDirectory){throw '输出目录已存在，请使用新目录。'}
$signature=Get-AuthenticodeSignature -LiteralPath $Iscc
if($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notlike '*Pyrsys*'){throw 'Inno Setup 编译器签名未通过。'}
$taskNode=Join-Path $ProgramRoot 'runtime/node/node.exe'
& $taskNode (Join-Path $ProgramRoot 'workbench/scripts/verify-portable.mjs') $ProgramRoot
if($LASTEXITCODE -ne 0){throw '程序文件校验失败，未构建安装器。'}
$repoRoot=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$source=Join-Path $repoRoot 'packaging/windows-installer.iss'
New-Item -ItemType Directory -Path $OutputDirectory -ErrorAction Stop | Out-Null
& $Iscc '/Qp' "/DSourceDir=$ProgramRoot" "/DReleaseDir=$OutputDirectory" $source
if($LASTEXITCODE -ne 0){throw 'Inno Setup 编译失败。'}
Get-FileHash -LiteralPath (Join-Path $OutputDirectory 'UITestAgent-Setup.exe') -Algorithm SHA256
