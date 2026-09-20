<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0018 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0018-01 | DR-0018-01 | 已确认 | 单元测试通过 | 工具边界四项工程单元；官方seed预检与未批准正式入口拒绝另有实际检查，不作回归能力证明 | 源工具/入口/seed/输出约束单元，禁止工具实调拒绝；不代表OS隔离 | 命令：node --test pilot/gate.test.mjs；退出码：0；测试数量：4；失败数量：0；跳过数量：0；证据：validation/pilot/gate-final.log | node --test pilot/gate.test.mjs | 0 | 4 | 0 | 0 | validation/pilot/gate-final.log |
| VT-0018-02 | DR-0018-01 | 已确认 | 仅静态检查 | 原义务完整性静态判定不通过；首次人工批准未发生 | 逐原文/检查时机独立复核，不接受生成器自报无缺口 | pilot/REPORT.md及末版65–66行：S02缺少选择后行总数，初稿/两修正已耗尽；正常干跑绿不算完整；人工未批准。 | - | - | - | - | - | - |
| VT-0018-03 | DR-0018-01 | 已确认 | 未运行 | 排序同脚本正常3/故障3；成立后详情组 | 批准hash后固定零模型/零重试，指定差异实际到达；技术失败不算检出 | 0次，未批准冻结且已知漏验，未访问故障侧执行 | - | - | - | - | - | - |

## 本轮命令与环境

- 工作目录：D:/01_AI工程/01_工程项目/ui-test-agent-script-pilot
- 命令：node --test pilot/gate.test.mjs
- 命令：node pilot/probe-gate.mjs <isolated-authoring> --seed
- 命令：node pilot/run-regression.mjs --draft-check
- 命令：node pilot/run-regression.mjs --draft-check correction-2
- 环境：Windows;Node22.19.0;ClaudeCode2.1.218;Playwright1.62.1

## 结论

- 环境和两份正常草稿可运行；完整性失败，人工与正式回归均未完成，不宣称试点成立。
