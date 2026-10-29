@echo off
setlocal
chcp 65001 >nul
set "AGENT_NODE=node"
if exist "%~dp0portable-manifest.json" (
  if not exist "%~dp0runtime\node\node.exe" exit /b 1
  set "AGENT_NODE=%~dp0runtime\node\node.exe"
)
"%AGENT_NODE%" "%~dp0workbench\scripts\native-entry.mjs" enable-model %*
set "MODEL_EXIT=%ERRORLEVEL%"
pause
exit /b %MODEL_EXIT%
