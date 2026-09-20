<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0020 用户需求

## 原始输入

> 测试工作台第一阶段——批准脚本执行闭环，并推送GitHub。以744a3f7a7b775e0a89a7150babf6e5d46649de1c为基线，在codex/test-workbench-m1分支建立独立workbench子工程；从真实Web运行批准排序脚本，保存并展示可信结果，重启后可追溯，原资产和历史不受污染；完成T0-T4后停止。

## 结构化理解

| UN | 状态 | 目标 | 约束 | 成功标准 |
|---|---|---|---|---|
| UN-0020-01 | 已确认 | 建立本地单用户测试工作台，完成批准资产登记、受控环境选择、独立Playwright执行、真实状态/步骤/错误/媒体记录、Web历史查看及重启恢复，并把验证后的阶段成果推送指定GitHub新分支。 | 不修改批准业务脚本、冻结站点、原产品src/public、旧报告和历史；运行时零LLM/Claude Code/DeepSeek Harness/healer；不开放任意脚本、命令、路径或URL；默认127.0.0.1:4210；本轮完成后不进入Harness或完整套件开发。 | 真实Web分别发起正常和故障入口；正常完成S01-S04，故障在S03保留期望H111/实际H106且S04未执行；三方记录一致，重启后可读，附件受限，批准脚本前后哈希一致，工程测试通过，分批提交并确认远端SHA。 |

## 已确认事实

- 目标仓库origin为https://github.com/whj1677/ui-test-agent.git；2026-09-20读取的远端main为c1e9455d6cb32fd919b604585ba440c4997448ee。
- 隔离工作区从提交744a3f7a7b775e0a89a7150babf6e5d46649de1c创建，分支为codex/test-workbench-m1；创建时同名远端分支不存在。
- 批准脚本pilot/revision-s02/tests/sorting.spec.ts的提交原始字节SHA-256为280A787546AABDD87570838932663A5DC254AEE5E0C329BE3A13294E9A18079A；Windows全局core.autocrlf=true曾使首次检出为A37C...，已按提交原始blob恢复批准字节且不改变Git内容。
- 人工批准依据为pilot/revision-s02/HUMAN_REVIEW.md，原正式回归依据为FORMAL_REGRESSION.md；允许入口仅/probe/s1与/probe/s2，两者使用同一批准脚本。
- 原配置固定Chromium、zh-CN、1440x1000、timeout 120000ms、expect 5000ms、workers=1、retries=0、trace/screenshot/video=on；原pilot锁定Playwright 1.62.1。

## 推断与待确认

- 无阻塞业务问题。指定故障检出是独立集成验收结论，不得覆盖Playwright实际失败事实或自动归因为产品缺陷。
