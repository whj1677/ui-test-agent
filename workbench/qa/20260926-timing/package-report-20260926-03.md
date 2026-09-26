# Windows 发布候选 03 打包核验

状态：**PENDING_ACCEPTANCE**。本报告验证冻结源码包的文件闭包、字节完整性和有限反例；不把工程测试或打包检查写成正式工作台功能验收。

## 候选摘要

- 归档：`package-candidate-20260926-03.zip`，356589 字节，101 个源文件加 1 个 `candidate-manifest.json`。
- ZIP SHA-256：`a694b42cdb25300ecb323ac5bcd1f020e2baac15561d1ae1bb7e22ed280b151d`（同时由打包器和 `Get-FileHash` 得到）。
- manifest 内容清单 SHA-256：`ebbf559015c4267e854eab77581f5770598432332dddb0019f4c32da2a41ce38`。
- 相比 02 新增 `timing-obligations.mjs`、`timing-observer.mjs`、`timing-evidence.mjs` 三个运行文件，均位于 `workbench/server/build`；没有移除文件。`harness-probe/src/verify-candidate.mjs` 中跨目录导入 `timing-evidence.mjs` 的路径和包内文件均已核对。
- 包内未出现 `.local`、`node_modules`、`.git` 目录项；manifest 是完整性记录，不是发布者数字签名。

## 本轮命令和结果

| 步骤 | 命令 | 结果 | 原始证据 |
| --- | --- | --- | --- |
| 构建 | `python workbench/scripts/package-candidate.py --output workbench/qa/20260926-timing/package-candidate-20260926-03.zip` | 退出 0；101 源文件 | `package-build-20260926-03.log` |
| 独立清单与反例 | `python workbench/qa/20260926-timing/package-validation-20260926-03.py` | 退出 0；文件集与当前 collect 一致，包内记录与源码逐字节一致，安全路径解压 102 项 | `package-validation-20260926-03.log` |
| 包内自检 | `python <03包解压根>/workbench/scripts/package-candidate.py --verify <03 ZIP>` | 退出 0；清单和 ZIP 哈希一致 | `package-self-verify-20260926-03.log` |
| 新模块语法 | 对解压出的三个 timing 模块和 `harness-probe/src/verify-candidate.mjs` 分别执行 `node --check` | 4 个退出 0 | `package-node-check-20260926-03.log` |

有限反例共四个：篡改 `timing-evidence.mjs` 被 `PACKAGE_FILE_DIGEST_MISMATCH` 拒绝；删去该模块和添加额外文件均被 `PACKAGE_FILE_SET_MISMATCH` 拒绝；`../` 路径穿越项被 `PACKAGE_UNSAFE_OR_DUPLICATE_ENTRY` 拒绝。`package-negative-*20260926-03.zip` 仅是反例证据，不能作为交付包。

三份锁文件（根、workbench、harness-probe）的 SHA-256 与 02 manifest 完全相同。**03 未重新执行 npm 安装、完整安装器或包内依赖诊断，也未做干净 Windows 安装**。01 包在独立目录中的三组离线 `npm ci` 日志只能佐证锁定依赖此前可从本机缓存安装，不能证明 03 的新运行逻辑或新电脑下载成功。

本轮未启动、重启或结束正式 4322 服务，没有启动第二工作台、被测站点或模型。时间保真功能的 102 项工程测试结果由主管另行记录和核验；本报告没有重复运行该清单。真实客户环境、另一名测试人员独立操作和操作系统级隔离仍需各自证据。
