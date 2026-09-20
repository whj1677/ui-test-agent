<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0019 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0019-01 | DR-0019-01 | 已确认 | 仅静态检查 | 检查建例尝试记录、候选来源、旧新差异、S02行集合完整性及其他原义务保持情况。 | 原样候选、工具配置、脱敏尝试记录、差异与静态检查；候选SHA 280a7875，旧脚本和报告哈希不变。 | 命令：node --test pilot/revision-s02/acceptance.test.mjs；退出码：0；测试数量：2；失败数量：0；跳过数量：0；证据：docs/requirements/REQ-0019-sorting-s02-review/verification.log | node --test pilot/revision-s02/acceptance.test.mjs | 0 | 2 | 0 | 0 | docs/requirements/REQ-0019-sorting-s02-review/verification.log |
| VT-0019-02 | DR-0019-02 | 已确认 | 集成测试通过 | 运行同一候选：正常页面应完成；新增第四行反例应在S02因表体变化失败且S03未执行。 | 真实命令、退出码、Playwright报告及失败步骤/错误文本；原正常页1/1通过，独立新增第四行反例在S02第62行期望3实际4失败且S03未开始。 | 命令：node --test pilot/revision-s02/acceptance.test.mjs；退出码：0；测试数量：2；失败数量：0；跳过数量：0；证据：docs/requirements/REQ-0019-sorting-s02-review/verification.log | node --test pilot/revision-s02/acceptance.test.mjs | 0 | 2 | 0 | 0 | docs/requirements/REQ-0019-sorting-s02-review/verification.log |
| VT-0019-03 | DR-0019-03 | 人工已确认 | 仅静态检查 | 检查真人首审材料逐义务可追溯、状态仅A或B，且提交不含敏感或被禁止内容。 | 首审文档、git差异、敏感文件检查与本地提交 | 2026-09-20用户明确回复人工首审已通过；批准对象为SHA-256 280A7875...的新候选。 | - | - | - | - | - | - |
| VT-0019-04 | DR-0019-04 | 已确认 | 集成测试通过 | 同一批准脚本按固定顺序完成正常3次和故障3次；核验故障均为S03第二行H111/H106错序，且S04未执行。 | 六份独立JSON报告、退出码、步骤错误、脚本前后哈希、媒体清单、模型调用数、重试数和墙钟成本；实际正常3/3完整、故障3/3指定检出、技术失败0。 | 命令：node --test pilot/revision-s02/verify-formal-regression.test.mjs；退出码：0；测试数量：6；失败数量：0；跳过数量：0；证据：docs/requirements/REQ-0019-sorting-s02-review/formal-regression-verification.log | node --test pilot/revision-s02/verify-formal-regression.test.mjs | 0 | 6 | 0 | 0 | docs/requirements/REQ-0019-sorting-s02-review/formal-regression-verification.log |

## 本轮命令与环境

- 工作目录：D:\01_AI工程\01_工程项目\ui-test-agent-script-pilot
- 命令：node pilot/revision-s02/run-formal-regression.mjs
- 命令：node --test pilot/revision-s02/verify-formal-regression.test.mjs
- 命令：python scripts/check_ai_context.py
- 环境：Windows PowerShell
- 环境：批准脚本SHA-256 280A7875...；零建例模型调用、无healer
- 环境：@playwright/test 1.62.1；Chromium；retries=0；workers=1；每次独立测试进程与浏览器上下文

## 结论

- 人工首审已通过；排序组正式回归正常3/3完整、故障3/3指定错序检出、技术失败0；未启动详情组或产品集成。
