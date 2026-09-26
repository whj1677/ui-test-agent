# Windows 发布候选 ZIP 打包核验

状态：**候选字节和离线依赖分步核验通过；正式发布验收未完成**。本报告只针对 `package-candidate-20260926-01.zip`，不代表另一台电脑可直接投入业务测试。

## 候选和修复

- 对 `workbench/server/app.mjs` 的 Excel 模板下载路由做文件闭包检查时，发现初版清单缺少 `workbench/examples/M3A_CASE_IMPORT_TEMPLATE_V1.xlsx`。已将该真实运行文件加入 `workbench/scripts/package-candidate.py` 后构建新 ZIP；未覆盖先前产物。
- ZIP：`package-candidate-20260926-01.zip`，97 个源文件加 1 个 `candidate-manifest.json`；ZIP SHA-256：`785bcf10b2c20efe1110edd1b38e08489fe5d56cd9aece12587a5a68469ce3ad`；manifest 文件记录的内容清单 SHA-256：`4ba8fb0a0fce8d40f9d255a4a83acd76ac5aee17048979e57d2ca862853df447`。
- 文件集没有 `.local`、`node_modules`、`.git` 路径；打包器对源码字节执行密钥形态筛查。包中不含原机的历史项目、授权账本、已登录会话和模型凭据。manifest 是完整性记录，**不是发布者数字签名**。

## 执行与证据

所有命令均从仓库根目录执行，`%TEMP%` 解压目标为此前不存在的 `C:\Users\20240082\AppData\Local\Temp\ui-test-agent-package-20260926-01`。解压前逐级检查其祖先不存在 `node_modules`，并验证每个归档名不越过目标目录。

| 步骤 | 命令或检查 | 结果 | 原始输出 |
| --- | --- | --- | --- |
| 构建 | `python workbench/scripts/package-candidate.py --output workbench/qa/20260925-release/package-candidate-20260926-01.zip` | 退出 0；97 文件 | `package-build-20260926-01.log` |
| 完整性和反例 | `python workbench/qa/20260925-release/package-validation-20260926-01.py` | 退出 0；篡改字节、额外文件、`../` 路径穿越各被拒绝 | `package-validation-20260926-01.log` |
| 安全独立解压 | `python workbench/qa/20260925-release/package-isolated-extract-20260926-01.py` | 退出 0；新目录，98 个归档项，无祖先 `node_modules` | `package-isolated-extract-20260926-01.log` |
| 根依赖 | `npm.cmd --prefix <解压根> ci --omit=dev --ignore-scripts --offline` | 退出 0；安装 4 个包 | `package-npm-root-20260926-01.log` |
| 工作台依赖 | `npm.cmd --prefix <解压根>\workbench ci --omit=dev --ignore-scripts --offline` | 退出 0；安装 100 个包 | `package-npm-workbench-20260926-01.log` |
| Harness 依赖 | `npm.cmd --prefix <解压根>\harness-probe ci --omit=dev --ignore-scripts --offline` | 退出 0；安装 497 个包 | `package-npm-harness-20260926-01.log` |
| 包内静态诊断 | `powershell.exe -NoProfile -ExecutionPolicy Bypass -File <解压根>\workbench\scripts\check-install.ps1` | 退出 0；三组依赖及本机 Playwright Chromium 文件就绪 | `package-check-install-20260926-01.log` |
| 包内自检 | `python <解压根>\workbench\scripts\package-candidate.py --verify <ZIP>` | 退出 0；ZIP/manifest 哈希与文件集一致 | `package-self-verify-20260926-01.log` |

反例拒绝码分别是 `PACKAGE_FILE_DIGEST_MISMATCH`、`PACKAGE_FILE_SET_MISMATCH`、`PACKAGE_UNSAFE_OR_DUPLICATE_ENTRY`。三份反例 ZIP 保留为本目录中的 `package-negative-*20260926-01.zip`，不能当作候选交付。生成后再比对包内 manifest 与当前打包源码，97 个文件均未漂移。

## 边界

此轮**没有调用完整 `安装.ps1`/`安装.cmd`**：正式 4322 服务保持运行，安装器在该状态下设计为拒绝替换依赖。因此只验证了安装器的三组锁定依赖步骤和包内静态诊断，未证明完整安装器路径。Chromium 静态诊断使用本机既有 Playwright 缓存，未验证新电脑下载。未启动候选包服务、被测站点或模型，未修改/结束正式工作台，也未执行干净 Windows、另一名测试人员独立操作、真实客户登录、真实业务系统或操作系统级隔离验收。
