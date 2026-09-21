<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0021 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0021-01 | DR-0021-01 / DR-0021-02 / DR-0021-03 | 已确认 | 人工待确认 | 修前回归应分别暴露fault选择被刷新为normal、INTEGRITY_FAILED仍complete_pass、expect类未取值误判；该项只保留问题复现，不作为修后通过证据。 | 新复审报告记录原命令、退出码和断言，不以代码阅读替代复现。 | 修前实际输出与三项断言见workbench/docs/REVIEW_FIX_REPORT.md#修前复现。 | - | - | - | - | - | - |
| VT-0021-02 | DR-0021-01 / DR-0021-02 / DR-0021-03 | 已确认 | 集成测试通过 | 修后定向与完整工程测试覆盖三项修复及正常/指定错序/缺报告/未执行步骤原语义。 | 命令、退出码、测试统计及浏览器操作证据。 | 命令：npm --prefix workbench test；npm --prefix workbench run test:browser；退出码：0；测试数量：22；失败数量：0；跳过数量：0；证据：workbench/docs/REVIEW_FIX_REPORT.md#修后工程验证 | npm --prefix workbench test；npm --prefix workbench run test:browser | 0 | 22 | 0 | 0 | workbench/docs/REVIEW_FIX_REPORT.md#修后工程验证 |
| VT-0021-03 | DR-0021-01 / DR-0021-02 / DR-0021-03 | 已确认 | 集成测试通过 | 从真实Web各运行一次新normal/fault；fault选择跨两次轮询，核对入口、步骤、原始错误、整体状态和未执行项。 | 新run_id、run.json、report.json、Web截图和哈希对应；旧运行不替代。 | 命令：npm --prefix workbench run test:real；退出码：0；测试数量：2；失败数量：0；跳过数量：0；证据：workbench/docs/REVIEW_FIX_REPORT.md#新的真实-web-组合 | npm --prefix workbench run test:real | 0 | 2 | 0 | 0 | workbench/docs/REVIEW_FIX_REPORT.md#新的真实-web-组合 |
| VT-0021-04 | DR-0021-01 / DR-0021-02 / DR-0021-03 | 已确认 | 集成测试通过 | 批准脚本及禁止目录不变，私有运行材料未提交，本地HEAD与远端同分支SHA一致。 | 哈希、git diff/status、敏感扫描、提交与ls-remote。 | 命令：Get-FileHash；git diff/status；git ls-remote；退出码：0；测试数量：3；失败数量：0；跳过数量：0；证据：workbench/docs/REVIEW_FIX_REPORT.md#资产与停止点 | Get-FileHash；git diff/status；git ls-remote | 0 | 3 | 0 | 0 | workbench/docs/REVIEW_FIX_REPORT.md#资产与停止点 |

## 本轮命令与环境

- 工作目录：隔离工作树D:/01_AI工程/01_工程项目/ui-test-agent-workbench-m1，分支codex/test-workbench-m1。
- 命令：npm --prefix workbench test
- 命令：npm --prefix workbench run test:browser
- 命令：新的真实Web正常/故障组合脚本
- 命令：python scripts/sync_requirement_status.py、collect_delivery_evidence.py、check_ai_context.py
- 环境：Windows PowerShell，Node.js 22，锁定@playwright/test 1.62.1，127.0.0.1本地端口。

## 结论

- 三项问题修前均复现；修后21项Node测试和1项真实Chromium工作台流通过；新normal/fault组合一次完成，原资产未变。
