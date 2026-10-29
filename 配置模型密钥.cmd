@echo off
setlocal
chcp 65001 >nul
set "AGENT_NODE=node"
if exist "%~dp0portable-manifest.json" (
  if not exist "%~dp0runtime\node\node.exe" exit /b 1
  set "AGENT_NODE=%~dp0runtime\node\node.exe"
)
"%AGENT_NODE%" "%~dp0workbench\scripts\native-entry.mjs" key
set "KEY_EXIT=%ERRORLEVEL%"
if errorlevel 1 (
  echo 配置失败。请保留错误信息；不要把 API Key 发给其他人。
) else (
  echo 密钥已保存。下一步请运行“启用模型工作台.cmd”；已运行的工作台请先等待任务结束并正常停止。
)
pause
exit /b %KEY_EXIT%
