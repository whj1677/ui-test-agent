# AUTH-01 合成站登录体验指南

本页演示的是**被测系统登录准备**，不是工作台自身多用户登录。它只使用本机合成站，不连接真实公司系统。

先在本分支的 `workbench` 目录打开两个 PowerShell 窗口：

1. 窗口一运行 `npm run start:auth-fixture`（合成被测站点默认 `http://127.0.0.1:4330`）。
2. 窗口二依次运行以下命令。不要让两个工作台进程共写原 4322 数据目录。

   ```powershell
   $env:WORKBENCH_PORT = '4331'
   $env:WORKBENCH_DATA_DIR = (Join-Path (Get-Location) '.local/auth01-user-trial')
   $env:DSH_PROBE_BROWSER_EXECUTABLE = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
   npm start
   ```
3. 打开 `http://127.0.0.1:4331/workspace/`，创建或选择一个**独立测试项目**，进入“登录准备”。选择 `AUTH-01 独立合成登录样例` 和角色 `inspector`，点“打开登录窗口”。
4. 在弹出的专用浏览器中输入合成账号 `inspector`、密码 `demo-inspector` 并登录。返回工作台点“检查登录”，应看到账号、角色和“有效”。角色 `supervisor` 的合成密码为 `demo-supervisor`，不要跨角色直接复用。
5. 点“清除会话”后状态应为“未登录”；再次使用必须重新在专用浏览器登录。关闭或重启工作台服务也会丢失内存会话。

合成站服务端会话有效期为 15 分钟，真实被测系统将由它自己的服务端策略决定。验证码、扫码和多因素认证应由操作者在专用窗口自行完成。登录输入阶段不启动模型，也不采集业务截图、录像或 Trace；登录后的业务 Trace 仍应视为私有敏感证据。

开发自测已用真实 Harness 在此合成站核对登录复用，但**现有六用例任务仍是无登录环境**；此页显示“有效”不表示那些任务会自动使用本会话。实际工作台任务绑定与执行中失效处理仍未完成，详情见 [开发自测记录](AUTH_01_SELF_TEST.md)。
