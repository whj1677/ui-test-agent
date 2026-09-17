<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0011 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0011-01 | DR-0011-01 | 已确认 | 集成测试通过 | 字幕布局、报告尺寸、固定计划录像和证据边界 | 修复前失败与修复后真实命令/TAP、报告SHA、浏览器DOM/实际播放和可读画面；程序检查与视觉复验分开。 | 命令：node --test tests/recording-layout.test.mjs tests/recording-evidence.test.mjs；退出码：0；测试数量：10；失败数量：0；跳过数量：0；证据：validation/REQ-0011-delivery-formatted.log | node --test tests/recording-layout.test.mjs tests/recording-evidence.test.mjs | 0 | 10 | 0 | 0 | validation/REQ-0011-delivery-formatted.log |

## 本轮命令与环境

- 工作目录：D:/01_AI工程/01_工程项目/ui-test-agent
- 命令：node --test tests/recording-layout.test.mjs tests/recording-evidence.test.mjs
- 命令：node --test tests/release-report.integration.mjs
- 命令：node tests/recording.integration.mjs
- 命令：node tests/recording-isolation.integration.mjs
- 命令：node tests/runtime-regression.mjs
- 环境：Windows11/Node22/产品独立Chromium与Codex浏览器报告检查；本机合成数据/零模型调用

## 结论

- 本机限定字幕与报告缺陷修复已复验；正式10项组合由collector执行，另有570项工程、6项报告集成及8场景录像/隔离证据。
- 实际可见浏览器播放/中文字形有独立观察；本地file://直接打开被策略拒绝，保持未验，不绕过。
- 仅限定修复，不是最终产品发布；真实模型、独立人员及其他父门槛仍未满足。
