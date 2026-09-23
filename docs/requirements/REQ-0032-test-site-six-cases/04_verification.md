<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0032 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0032-01 | DR-0032-01 | 已确认 | 人工待确认 | 站点 DOM/交互和三种缺陷精确符合冻结规格。 | 真实浏览器命令、退出码、断言和媒体路径 | 命令：npm run test:trial-site（脚本随后更名为 self-check:trial-site，配置未变）；退出码：1；测试数量：6；失败数量：3；跳过数量：0；证据：workbench/.local/ui-six-cases/reference/raw-report.json；六条均有截图、录像、trace，三个失败均为冻结规格指定业务差异 | npm run test:trial-site（脚本随后更名为 self-check:trial-site，配置未变） | 1 | 6 | 3 | 0 | workbench/.local/ui-six-cases/reference/raw-report.json；六条均有截图、录像、trace，三个失败均为冻结规格指定业务差异 |
| VT-0032-02 | DR-0032-02 | 已确认 | 人工待确认 | Excel 后端预览/确认及正式 JSON 导出/重新预览均为六条。 | 独立数据目录、后端响应、浏览器可见反馈和产物路径 | 命令：真实 /workspace/ 浏览器流程；npm --prefix workbench test；退出码：0；测试数量：83；失败数量：0；跳过数量：0；证据：docs/requirements/REQ-0032-test-site-six-cases/logs/workbench-tests-rerun.log；独立数据根 workbench/.local/ui-six-cases/workbench-trial；因同一交付含预期非零的3个业务失败，正式状态统一保留人工待确认 | 真实 /workspace/ 浏览器流程；npm --prefix workbench test | 0 | 83 | 0 | 0 | docs/requirements/REQ-0032-test-site-six-cases/logs/workbench-tests-rerun.log；独立数据根 workbench/.local/ui-six-cases/workbench-trial；因同一交付含预期非零的3个业务失败，正式状态统一保留人工待确认 |
| VT-0032-03 | DR-0032-03 | 已确认 | 人工待确认 | 完整参考执行得到 TC-001/002/003 通过，TC-004/005/006 在指定步骤业务断言失败。 | Playwright 原始 JSON/HTML 报告、3/3 汇总、截图录像 trace | 命令：npm run test:trial-site（脚本随后更名为 self-check:trial-site，配置未变）；退出码：1；测试数量：6；失败数量：3；跳过数量：0；证据：workbench/trial-site/REFERENCE_SELF_CHECK.md；workbench/.local/ui-six-cases/reference/ | npm run test:trial-site（脚本随后更名为 self-check:trial-site，配置未变） | 1 | 6 | 3 | 0 | workbench/trial-site/REFERENCE_SELF_CHECK.md；workbench/.local/ui-six-cases/reference/ |

## 本轮命令与环境

- 工作目录：仓库根与 workbench。
- 命令：npm run self-check:trial-site（当前复跑命令）
- 命令：npm --prefix workbench test
- 命令：真实浏览器访问 127.0.0.1:4321/workspace/
- 环境：Windows PowerShell
- 环境：Node.js >=22
- 环境：Chromium from locked @playwright/test 1.62.1
- 环境：Codex 子型号/推理档位：未知

## 结论

- 六条参考执行为 3 PASSED/3 指定业务 FAILED，六条均有三类媒体。
- 工作台回归 83/83 无失败；隔离浏览器流程完成 Excel 新增6、正式导出6、JSON复导新增6。
- 未启动 Harness、未调用模型、未登记人工首审或批准资产。
