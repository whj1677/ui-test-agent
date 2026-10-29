@echo off
chcp 65001 >nul
if exist "%~dp0portable-manifest.json" (
  if not exist "%~dp0runtime\node\node.exe" exit /b 1
  "%~dp0runtime\node\node.exe" "%~dp0workbench\scripts\native-entry.mjs" install %*
) else (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0安装.ps1" %*
)
set "INSTALL_EXIT=%ERRORLEVEL%"
pause
exit /b %INSTALL_EXIT%
