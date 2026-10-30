@echo off
chcp 65001 >nul
cd /d "%~dp0"
if exist "%~dp0runtime\node\node.exe" (
  "%~dp0runtime\node\node.exe" "%~dp0workbench\scripts\export-diagnostics.mjs"
) else (
  node "%~dp0workbench\scripts\export-diagnostics.mjs"
)
pause
