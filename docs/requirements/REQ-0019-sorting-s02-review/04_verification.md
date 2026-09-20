<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0019 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0019-01 | DR-0019-01 | 已确认 | 仅静态检查 | 检查建例尝试记录、候选来源、旧新差异、S02行集合完整性及其他原义务保持情况。 | 原样候选、工具配置、脱敏尝试记录、差异与静态检查；候选SHA 280a7875，旧脚本和报告哈希不变。 | 命令：node --test pilot/revision-s02/acceptance.test.mjs；退出码：0；测试数量：2；失败数量：0；跳过数量：0；证据：docs/requirements/REQ-0019-sorting-s02-review/verification.log | node --test pilot/revision-s02/acceptance.test.mjs | 0 | 2 | 0 | 0 | docs/requirements/REQ-0019-sorting-s02-review/verification.log |
| VT-0019-02 | DR-0019-02 | 已确认 | 集成测试通过 | 运行同一候选：正常页面应完成；新增第四行反例应在S02因表体变化失败且S03未执行。 | 真实命令、退出码、Playwright报告及失败步骤/错误文本；原正常页1/1通过，独立新增第四行反例在S02第62行期望3实际4失败且S03未开始。 | 命令：node --test pilot/revision-s02/acceptance.test.mjs；退出码：0；测试数量：2；失败数量：0；跳过数量：0；证据：docs/requirements/REQ-0019-sorting-s02-review/verification.log | node --test pilot/revision-s02/acceptance.test.mjs | 0 | 2 | 0 | 0 | docs/requirements/REQ-0019-sorting-s02-review/verification.log |
| VT-0019-03 | DR-0019-03 | 待人工首审 | 人工待确认 | 检查真人首审材料逐义务可追溯、状态仅A或B，且提交不含敏感或被禁止内容。 | 首审文档、git差异、敏感文件检查与本地提交 | RESULT.md与HUMAN_REVIEW.md已生成；最终敏感检查及本地提交待收口步骤。 | - | - | - | - | - | - |

## 本轮命令与环境

- 工作目录：D:\01_AI工程\01_工程项目\ui-test-agent-script-pilot
- 命令：python scripts/requirement_source.py render --package REQ-0019-sorting-s02-review
- 命令：node --test pilot/revision-s02/verify-candidate.test.mjs
- 命令：node pilot/node_modules/playwright/cli.js test --config pilot/revision-s02/playwright.config.ts
- 命令：node pilot/revision-s02/run-engineering-check.mjs --verify-existing
- 环境：Windows PowerShell
- 环境：Claude Code 2.1.218工具环境；DeepSeek Anthropic兼容端点；deepseek-v4-pro
- 环境：@playwright/test 1.62.1；Chromium；retries=0；workers=1

## 结论

- A. 候选已通过本轮技术核查，等待人工首审；没有人工批准，未执行正式3+3。
