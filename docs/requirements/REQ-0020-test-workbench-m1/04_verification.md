<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0020 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0020-01 | DR-0020-01 | 已确认 | 集成测试通过 | 独立工程基础启动、健康接口、批准源哈希和Git隔离核查。 | 命令、退出码、健康响应、哈希和提交/远端SHA；健康接口200、批准哈希280A...，T0提交87699fd1c25ae627ea013899012c1c7053a7601b与远端一致。 | 命令：cd workbench; npm test（T0基线）；退出码：0；测试数量：2；失败数量：0；跳过数量：0；证据：workbench/docs/ACCEPTANCE_REPORT.md#工程验证 | cd workbench; npm test（T0基线） | 0 | 2 | 0 | 0 | workbench/docs/ACCEPTANCE_REPORT.md#工程验证 |
| VT-0020-02 | DR-0020-01 | 已确认 | 集成测试通过 | 登记真实性、原用例版本、非法/哈希不符拒绝、持久化和启动恢复测试。 | Node测试、临时数据目录和实际catalog/run记录；真实登记REGISTERED后幂等ALREADY_REGISTERED。 | 命令：cd workbench; npm test（T1批次）；退出码：0；测试数量：7；失败数量：0；跳过数量：0；证据：workbench/docs/ACCEPTANCE_REPORT.md#工程验证 | cd workbench; npm test（T1批次） | 0 | 7 | 0 | 0 | workbench/docs/ACCEPTANCE_REPORT.md#工程验证 |
| VT-0020-03 | DR-0020-02 | 已确认 | 集成测试通过 | 固定Playwright参数、独立进程、环境脱敏、互斥、取消、异常中断和前后哈希测试。 | Node测试、子进程事实和受控模拟夹具；真实组合由VT-0020-05验证。 | 命令：cd workbench; npm test（T2批次）；退出码：0；测试数量：12；失败数量：0；跳过数量：0；证据：workbench/docs/ACCEPTANCE_REPORT.md#工程验证 | cd workbench; npm test（T2批次） | 0 | 12 | 0 | 0 | workbench/docs/ACCEPTANCE_REPORT.md#工程验证 |
| VT-0020-04 | DR-0020-03 | 已确认 | 集成测试通过 | 正常/断言失败/缺失损坏/未运行/跳过报告、路径越界/非法入口及真实浏览器Web流程。 | 18项Node测试、1个真实Chromium工作台流、浏览器截图和三方记录核对；不可信HTML保持文本。 | 命令：cd workbench; npm test；npm run test:browser；退出码：0；测试数量：19；失败数量：0；跳过数量：0；证据：workbench/docs/ACCEPTANCE_REPORT.md#工程验证 | cd workbench; npm test；npm run test:browser | 0 | 19 | 0 | 0 | workbench/docs/ACCEPTANCE_REPORT.md#工程验证 |
| VT-0020-05 | DR-0020-04 | 已确认 | 集成测试通过 | 真实正常/故障各一次、重启历史/附件、原资产与旧历史不变、零模型/零重试和GitHub远端一致性。 | 运行ID、哈希表、Playwright报告、Web截图、验收报告、提交及远端SHA；验收场景通过不覆盖fault的Playwright失败事实。 | 命令：cd workbench; npm run test:real -- --normal-run-id=run-20260920152922-af45f654；重启后 npm run test:restart；退出码：0；测试数量：3；失败数量：0；跳过数量：0；证据：workbench/docs/ACCEPTANCE_REPORT.md | cd workbench; npm run test:real -- --normal-run-id=run-20260920152922-af45f654；重启后 npm run test:restart | 0 | 3 | 0 | 0 | workbench/docs/ACCEPTANCE_REPORT.md |

## 本轮命令与环境

- 工作目录：D:\01_AI工程\01_工程项目\ui-test-agent-workbench-m1
- 命令：cd workbench; npm ci
- 命令：npm test
- 命令：npm start
- 命令：npm run register:approved
- 命令：npm run test:browser
- 环境：Windows PowerShell
- 环境：Node.js v22.19.0 / npm 10.9.3
- 环境：127.0.0.1:4210；冻结heldout站点127.0.0.1:4198
- 环境：@playwright/test 1.62.1；Chromium；workers=1；retries=0

## 结论

- 第一阶段集成验证完成：18项Node工程测试和工作台Chromium联调通过；真实Web normal/fault组合与重启历史/附件核对完成。业务事实和工作台验收结论分开记录；未进入Harness或发布。
