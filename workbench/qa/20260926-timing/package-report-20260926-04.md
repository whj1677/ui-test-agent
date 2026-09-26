# Windows 发布候选 04 打包核验

状态：**PENDING_ACCEPTANCE**。本报告验证 04 归档与当前源码的字节一致性，并限定 03 已有真实运行证据能够覆盖的执行逻辑范围；页面呈现结果仍以单独的 UI 复跑证据为准。

## 归档摘要

- 归档：`package-candidate-20260926-04.zip`，357322 字节；101 个源文件加 1 个 `candidate-manifest.json`。
- ZIP SHA-256：`28ad0485003fba314e25bc7f8b63835675d732a430d9cf5509015b13a87962e2`（打包器、包内自检和 `Get-FileHash` 一致）。
- manifest 内容清单 SHA-256：`475d95e85c72ca0f8006956da282e9901b8ca9dfd11f600e838f6dfc801fa1ff`。
- 文件集与 03 完全相同；包内文件与构建后的当前源码逐字节一致，无源码漂移。未出现 `.local`、`node_modules`、`.git` 目录项。

## 03 → 04 精确差异

只有三个包内文件的 SHA-256 发生变化：

1. `workbench/web-v2/app.js`
2. `workbench/web-v2/execution-media.js`
3. `workbench/docs/release-candidate.md`

对 03 和 04 两份归档中 `harness-probe/src/` 与 `workbench/server/` 下全部 **70 个**源文件逐一读取原始字节比较，变化数为 **0**。三份锁文件和 `workbench/scripts/package-candidate.py` 的归档字节也分别完全相同。因而 03 上已取得的真实运行证据对应的执行器、服务端及包内 Harness 源码在 04 中保持同字节；这项比较本身不证明 04 的页面呈现已通过人工验收。

## 命令和证据

| 步骤 | 命令 | 结果 | 原始输出 |
| --- | --- | --- | --- |
| 构建 | `python workbench/scripts/package-candidate.py --output workbench/qa/20260926-timing/package-candidate-20260926-04.zip` | 退出 0，未覆盖 03 | `package-build-20260926-04.log` |
| 独立比较 | `python workbench/qa/20260926-timing/package-validation-20260926-04.py` | 退出 0；完整文件集/字节、70 个执行源码文件、三锁和打包器逐项比较 | `package-validation-20260926-04.log` |
| 包内自检 | `python <04包提取目录>/workbench/scripts/package-candidate.py --verify <04 ZIP>` | 退出 0；包内清单和字节哈希一致 | `package-self-verify-20260926-04.log` |
| 前端语法 | 对归档提取出的两个变更 JS 分别运行 `node --check` | 两个退出 0 | `package-node-check-20260926-04.log` |

04 使用与 03 **完全同字节**的打包器。03 的篡改、删文件、额外文件和 `../` 路径穿越拒绝证据见 `package-validation-20260926-03.log` 及同目录 `package-negative-*20260926-03.zip`；本轮没有重复生成相同反例。三份锁文件未变，故 04 未重新安装依赖、未运行完整安装器或干净 Windows 安装；01 的离线安装证据只支持锁定依赖此前能从本机缓存安装。

本轮未启动或操作正式 4322 工作台、候选包服务、被测站点或模型。manifest 只支持完整性复核，不是发布者数字签名。
