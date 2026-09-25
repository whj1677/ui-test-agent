<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0036 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0036-01 | DR-0036-01 | 已确认 | 仅静态检查 | 走查证据：12 张真实页面截图（地址+版本注明）、A-F 分类结论、三页线框与第一批范围 | 真实地址、运行实例版本核对记录、截图文件路径 | workbench/docs/UI_UX_REVIEW.md 及 workbench/docs/evidence/UI_UX_01_*.png；4322 app.js 与 6066bbc 哈希一致（135f9879…），4331 为 HEAD 8127e33 | - | - | - | - | - | - |
| VT-0036-02 | DR-0036-02 | 已确认 | 人工待确认 | 第一批真实浏览器：24历史详情、Excel/JSON导入、单条/跨页/全项目、版本隔离、取消重启与媒体；11次已有候选执行请求、模型0；软断言观察修复后回放实际验证，原不完整运行保留 | 真实命令、退出码、测试统计和产物路径 | workbench/qa/20260925-workflow-phase1/REPORT.md、integrity.json、各批次与浏览器证据；工程纯单元8项退出0。正式门禁结论另记，候选未批准。 | - | - | - | - | - | - |

## 本轮命令与环境

- 工作目录：D:/01_AI工程/01_工程项目/ui-test-agent
- 命令：powershell -NoProfile -ExecutionPolicy Bypass -File workbench/scripts/start-workbench.ps1 -Data fresh-b
- 命令：node --test workbench/tests/batches.test.mjs workbench/tests/development-normal-only.test.mjs
- 命令：node workbench/scripts/phase1-browser-run.mjs <模式>
- 命令：node workbench/scripts/phase1-browser-media.mjs
- 命令：node workbench/scripts/phase1-browser-version.mjs
- 命令：node workbench/scripts/phase1-verify-integrity.mjs
- 环境：唯一正式4322，既有workbench/.local/fresh25-b数据；测试目标站每run受控临时启动，不是第二个工作台；本机Edge/锁定Playwright

## 结论

- 第一批限定流程可操作；原24任务与候选不改；11次候选执行请求含2次取消；8单元+5真实执行器工程场景分开统计；后两批未实施。
