@echo off
setlocal
chcp 65001 >nul
set "AGENT_NODE=node"
if exist "%~dp0portable-manifest.json" (
  if not exist "%~dp0runtime\node\node.exe" (
    echo Bundled Node.js is missing. Please extract the complete program package.
    pause
    exit /b 1
  )
  set "AGENT_NODE=%~dp0runtime\node\node.exe"
)
"%AGENT_NODE%" "%~dp0workbench\scripts\diagnose-model.mjs"
set "DIAGNOSTIC_EXIT=%ERRORLEVEL%"
pause
exit /b %DIAGNOSTIC_EXIT%
