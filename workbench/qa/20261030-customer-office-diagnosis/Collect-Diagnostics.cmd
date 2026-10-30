@echo off
chcp 65001 >nul
echo [START] Preparing diagnostics. Please keep this window open.
if not exist "%~dp0collect.ps1" (
 echo [ERROR] Extract ALL files from the ZIP first, then run this CMD from the extracted folder.
 pause
 exit /b 1
)
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0collect.ps1" %*
pause
