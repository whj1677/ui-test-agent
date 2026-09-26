[CmdletBinding()]
param(
    [ValidateSet('fresh-b', 'e2e', 'auth')][string]$Data = 'fresh-b',
    [string]$ConfigPath,
    [string]$BrowserPath,
    [switch]$EnableModel,
    [switch]$CheckOnly,
    [switch]$NoOpen
)
$ErrorActionPreference = 'Stop'
$launcher = Join-Path $PSScriptRoot 'workbench/scripts/start-workbench.ps1'
$options = @{}
if ($PSBoundParameters.ContainsKey('Data')) { $options.Data = $Data }
if ($ConfigPath) { $options.ConfigPath = $ConfigPath }
if ($BrowserPath) { $options.BrowserPath = $BrowserPath }
if ($EnableModel) { $options.EnableModel = $true }
if ($CheckOnly) { $options.CheckOnly = $true }
& $launcher @options
exit $LASTEXITCODE
