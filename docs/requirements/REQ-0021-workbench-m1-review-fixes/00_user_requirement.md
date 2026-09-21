<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0021 用户需求

## 原始输入

> 基于codex/test-workbench-m1已审查HEAD集中修复三项：Web入口选择不得被轮询重置；完整性异常等非正常终态不得整体complete_pass；errorFacts不得把未取得实际值的expect类错误误判为值不符。先复现后修改，补工程测试和新复审记录，再从真实Web各执行一次正常/故障组合并推送同一开发分支。

## 结构化理解

| UN | 状态 | 目标 | 约束 | 成功标准 |
|---|---|---|---|---|
| UN-0021-01 | 已确认 | 集中修复工作台M1代码复审发现的入口选择、整体有效通过和错误事实分类三个问题，并以新的工程与真实Web证据收口。 | 不接Harness、不调用建例模型、不修改批准业务脚本；不改写原集成报告；不修改src/public/pilot/heldout-lab；不扩大业务范围。 | 修前问题可复现；修后fault选择跨至少两次轮询保持且启动记录一致；非正常终态整体不通过但原始Playwright事实保留；错误分类反例正确；新Web正常/故障组合、工程测试、资产哈希和GitHub同步均有证据。 |

## 已确认事实

- 已审查版本、本地HEAD与远端codex/test-workbench-m1均为edc0888999e0c1fc7d678398beb0e7f5de427a5e。
- 批准脚本pilot/revision-s02/tests/sorting.spec.ts当前SHA-256为280A787546AABDD87570838932663A5DC254AEE5E0C329BE3A13294E9A18079A。
- 原REQ-0020及workbench/docs/ACCEPTANCE_REPORT.md作为M1原集成事实保留，本轮另建复审修复记录。

## 推断与待确认

- 无阻塞未知项；三项预期、真实Web组合和停止点已由用户明确。
