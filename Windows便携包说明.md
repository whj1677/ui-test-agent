# Windows 便携试用包（无设备许可证）

2026-10-26：按用户要求，本次试用关闭设备许可证及激活门禁，部署策略为 required=false、trust=null。原有许可证文件不删除，不参与启动判定。模型密钥、测试登录和逐任务权限保持。

这是待验收的 Windows 10/11 x64 程序包，密钥加密组件仍需 .NET Framework 4.8；环境检查会核验这个 Windows 系统组件。固定入口为 `http://127.0.0.1:4322/workspace/`。包内自带 Node、四组锁定依赖、Harness 及浏览器插件、独立原生DSH 0.2.0-rc.2、Chromium、无界面 Chromium、录像所用 FFmpeg 和浏览器依赖诊断工具。使用者无需另外安装 Node、npm、Python、Harness 或浏览器。已有全局 Harness 不会被替换，程序始终使用自己的固定版本。

## 首次使用

1. 将完整 ZIP 解压到当前用户可以写入的本地目录，保持目录结构。不要放入需要管理员写入的 Program Files。
2. 双击 `安装.cmd`。便携模式只核对包内文件并离线准备本机私有 Harness 配置，不联网安装软件、不读取其他程序的登录状态。安装、检查、启动及密钥入口直接使用包内 Node 与 Windows DPAPI 小组件，不需要开启 PowerShell 脚本执行权限。
3. 双击 `启动.cmd`，在浏览器打开上述入口，直接进入工作台，无需提交设备资料或导入许可证。
4. 默认模型关闭。双击 `配置模型密钥.cmd`，在本机隐藏输入自己的 DeepSeek Key，程序用 Windows DPAPI 为当前用户保存。随后双击 `启用模型工作台.cmd`。这只启用模型入口，仍需在项目中配置获准测试环境和逐任务确认；当前无设备许可要求，但模型供应商密钥仍需自行配置。不要将供应商密钥发给软件发行方。模型接口调用需要网络，离线环境安装不代表模型可离线运行。

原有许可运行组件暂时保留用于兼容，但本次策略不会读取设备许可证或采集主板资料；不再有设备激活前置条件。

模型密钥使用另一个独立的本地 `WindowsCredential.exe` 保存和读取，继续兼容原有 DPAPI 十六进制文件；读取只走私有进程管道，不进入命令参数或日志。更换 Windows 用户无法读回原用户密钥，需该用户重新配置。这个组件不负责设备授权，不读取主板信息。源码维护者继续使用 `workbench/scripts/start-workbench.ps1` 管理正式工作台；客户入口参数采用 `--check-only`、`--runtime-home <绝对路径>`，不支持切换端口。

启动窗口保持运行，按 `Ctrl+C` 正常停止；任务进行中不要关闭窗口。重复启动复用当前目录的同一 4322 实例。其他进程占用 4322 时程序提示处理，不自动切换端口或结束未知进程。

## 文件与移动目录

- 程序、依赖和浏览器随包携带。`runtime/node` 和 `runtime/browsers` 不依赖开发机路径或全局 PATH。
- 私有 Harness 运行时位于 `%LOCALAPPDATA%/ui-test-agent/runtime/dsh`，生成的路径配置位于相邻 `runtime/config`。启动按当前解压目录重建受管路径，不改用户凭据及已登记测试环境。
- 现阶段项目、资料、用例、报告及媒体仍保存在程序目录内的 `workbench/.local/fresh25-b`，兼容当前正式工作台；升级前先正常停止并完整备份 `workbench/.local`。不要将新包解压覆盖正在运行的程序。不要把含业务数据的整个旧目录发给别人。
- 当前没有自动升级器或后台迁移器。移动程序须连同原 `workbench/.local` 一起移动，然后重新启动；旧许可证保持原处；本次无许可版换机不要求激活，仍需重新配置本用户模型密钥。
- 路径适配覆盖内置运行环境与受管配置。历史用例引用的外部资料路径、测试系统地址和实际运行结果需另行核对；本机环境重定位检查不是全部历史业务数据迁移验收。

## 维护者打包

源码候选 ZIP 由 `workbench/scripts/package-candidate.py` 生成，需要自行安装环境，不能作为“开箱即用”的完整包。完整便携包使用 `workbench/scripts/package-portable.py`，本次必须显式提供 `--no-device-license`。如以后确需有许可的构建，可改用 `--trust-file`（也接受 `--TrustFile`）；两者互斥且不得都省略，有许可模式仍验证公开信任配置并拒绝私钥。打包器拒绝已有 staging 或已有归档；不自动签发许可证、不复制开发机 `.local`、浏览器用户目录、模型凭据或签发工具。

```powershell
python workbench/scripts/package-portable.py --stage <全新暂存目录> --output <全新ZIP路径> --node <node.exe路径> --node-license <对应Node版本的LICENSE> --browsers <Playwright浏览器缓存根目录> --no-device-license
```

打包器核对四份锁文件版本，只复制所需生产依赖；唯一允许的本地组件 `@offline/device-license` 只复制运行时白名单，不跟随其源目录链接打入签发器。本次包内生成 required=false、trust=null 策略，清单中 license_required=false；只有显式有许可构建才生成 required=true。`portable-manifest.json` 记录版本、每个源文件、依赖、运行时和浏览器的字节数及 SHA-256；`workbench/release.json` 定义候选版本和范围。可使用包内 `runtime/node/node.exe` 执行 `workbench/scripts/verify-portable.mjs <解压根目录>` 离线复核字节。

该 ZIP 和自校验清单不等于发布者数字签名，JavaScript 源码也不具备不可修改能力。硬件绑定用于正常程序路径上的授权校验，不承诺阻止本机管理员修改程序、模拟硬件或复制虚拟机。干净 Windows、独立使用者和完整客户业务验收需分别记录；本机开发环境测试不能替代这些证据。
