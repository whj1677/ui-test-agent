<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0026 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0026-01 | DR-0026-01 / DR-0026-04 | 已确认 | 单元测试通过 | 确切版本/哈希/项目归属、已确认与步骤预期完整性、环境白名单、五项身份幂等、同键异身份冲突和INPUT_ONLY拒绝。 | 真实Excel进入CaseLibraryStore后的BuildTaskManager工程测试；覆盖顺序、并发、重启、旧任务身份推导和HTTP 409 | 命令：npm --prefix workbench test；退出码：0；测试数量：57；失败数量：0；跳过数量：0；证据：validation/REQ-0026-workbench.log | npm --prefix workbench test | 0 | 57 | 0 | 0 | validation/REQ-0026-workbench.log |
| VT-0026-02 | DR-0026-02 / DR-0026-03 / DR-0026-04 | 已确认 | 单元测试通过 | 完整快照、task.md、Agent指令、三份文件哈希、两用例差异、v1/v2冻结及冲突后原任务文件不变。 | 实际任务目录文件与生产组装逻辑逐字段核对 | 命令：npm --prefix workbench test；退出码：0；测试数量：57；失败数量：0；跳过数量：0；证据：validation/REQ-0026-workbench.log | npm --prefix workbench test | 0 | 57 | 0 | 0 | validation/REQ-0026-workbench.log |
| VT-0026-03 | DR-0026-03 / DR-0026-04 / DR-0026-05 | 已确认 | 集成测试通过 | 真实Chromium创建、查看输入、返回用例、关联历史、刷新和重启。 | 真实浏览器交互、后端task.json和脱敏截图 | 命令：npm --prefix workbench run test:m3b1-browser；退出码：0；测试数量：1；失败数量：0；跳过数量：0；证据：validation/REQ-0026-browser.log | npm --prefix workbench run test:m3b1-browser | 0 | 1 | 0 | 0 | validation/REQ-0026-browser.log |
| VT-0026-04 | DR-0026-05 | 已确认 | 集成测试通过 | 受影响workbench回归、正式需求门禁、资产与预算不变。 | 真实命令、退出码、测试统计、差异与哈希 | 命令：npm --prefix workbench test；退出码：0；测试数量：57；失败数量：0；跳过数量：0；证据：validation/REQ-0026-workbench.log | npm --prefix workbench test | 0 | 57 | 0 | 0 | validation/REQ-0026-workbench.log |

## 本轮命令与环境

- 工作目录：workbench与仓库根需求工具
- 命令：npm --prefix workbench test
- 命令：npm --prefix workbench run test:m3b1-browser
- 环境：Windows；Node 22；127.0.0.1单用户；临时case/build数据根；Harness/模型凭据不需要。

## 结论

- 项目单条用例输入接通已完成零模型工程与Web验证；不代表真实模型建例或自动化完成。
