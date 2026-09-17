<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0006 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0006-01 | DR-0006-01 | 已确认 | 集成测试通过 | 原文绑定与分类 | 仅非生产、精确点名的正向点击/打开语句，有限分页/说明/帮助/重试类别，候选包含Case/步骤/原文证据。 | 命令：node tests/runtime-regression.mjs；退出码：0；测试数量：425；失败数量：0；跳过数量：0；证据：validation/REQ-0006-runtime.log | node tests/runtime-regression.mjs | 0 | 425 | 0 | 0 | validation/REQ-0006-runtime.log |
| VT-0006-02 | DR-0006-02 | 已确认 | 集成测试通过 | 当前DOM资格 | 仅可见唯一普通原生button且不属于表单；重试需要最近独立区域的可见读取失败证据，不能重试业务写入。 | 命令：node tests/runtime-regression.mjs；退出码：0；测试数量：425；失败数量：0；跳过数量：0；证据：validation/REQ-0006-runtime.log | node tests/runtime-regression.mjs | 0 | 425 | 0 | 0 | validation/REQ-0006-runtime.log |
| VT-0006-03 | DR-0006-03 | 已确认 | 集成测试通过 | 派发重验与预算 | 新增候选绑定当前Case原文、路径及观察；事件派发前重验，相关上下文变更拒绝，使用原有有限步数/循环预算。 | 命令：node tests/runtime-regression.mjs；退出码：0；测试数量：425；失败数量：0；跳过数量：0；证据：validation/REQ-0006-runtime.log | node tests/runtime-regression.mjs | 0 | 425 | 0 | 0 | validation/REQ-0006-runtime.log |
| VT-0006-04 | DR-0006-04 | 已确认 | 集成测试通过 | 验证与归档 | 通过冻结复杂UI实际产品探索和对抗变体验证，模块文档与正式证据同步，独立提交推送。 | 命令：node tests/runtime-regression.mjs；退出码：0；测试数量：425；失败数量：0；跳过数量：0；证据：validation/REQ-0006-runtime.log | node tests/runtime-regression.mjs | 0 | 425 | 0 | 0 | validation/REQ-0006-runtime.log |

## 本轮命令与环境

- 工作目录：D:/01_AI工程/01_工程项目/ui-test-agent
- 命令：node --test tests/reading-actions.test.mjs
- 命令：node tests/runtime-regression.mjs
- 命令：node --test tests/discovery-browser.integration.mjs tests/discovery-redirects.integration.mjs tests/optional-dialog-flow.integration.mjs
- 环境：Windows Node22/Chromium；本机独立合成服务器

## 结论

- 限定阅读入口已实现并通过11项新增检查（包含在425项非暂停工程内），全量0失败/跳过；集成3文件6TAP退出0，见validation/REQ-0006-integration.log。
- 正式门禁和独立Git同步按随后实际结果记录；不代表真实模型自主运行、原24例全部执行或发布就绪。
- submit型查询与多步表单保持未覆盖，不为让本包通过而放开；本机真实模型工具策略仍未恢复。
