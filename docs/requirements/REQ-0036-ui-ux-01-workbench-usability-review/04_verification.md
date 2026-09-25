<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0036 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0036-01 | DR-0036-01 | 已确认 | 仅静态检查 | 走查证据：12 张真实页面截图（地址+版本注明）、A-F 分类结论、三页线框与第一批范围 | 真实地址、运行实例版本核对记录、截图文件路径 | workbench/docs/UI_UX_REVIEW.md 及 workbench/docs/evidence/UI_UX_01_*.png；4322 app.js 与 6066bbc 哈希一致（135f9879…），4331 为 HEAD 8127e33 | - | - | - | - | - | - |
| VT-0036-02 | DR-0036-02 | 已确认 | 人工待确认 | 第一批真实浏览器：24历史详情、Excel/JSON导入、单条/跨页/全项目、版本隔离、取消重启与媒体；11次已有候选执行请求、模型0；软断言观察修复后回放实际验证，原不完整运行保留 | 真实命令、退出码、测试统计和产物路径 | workbench/qa/20260925-workflow-phase1/REPORT.md、integrity.json、各批次与浏览器证据；工程纯单元8项退出0。正式门禁结论另记，候选未批准。 | - | - | - | - | - | - |
| VT-0036-03 | DR-0036-03 | 已确认 | 人工待确认 | V2.1真实模型有界功能轮：真实导入、批量生成、修订/从头生成/活动取消、版本隔离、复跑与报告；已发现缺口及未验证项单列 | 真实操作、文件哈希、逐项结果及截图 | 命令：node --test workbench/tests/product-v21.test.mjs workbench/tests/batches.test.mjs workbench/tests/development-normal-only.test.mjs workbench/tests/ui-d2a.test.mjs；退出码：0；测试数量：20；失败数量：0；跳过数量：0；证据：workbench/qa/20260925-v21/model-engineering-tests.log | node --test workbench/tests/product-v21.test.mjs workbench/tests/batches.test.mjs workbench/tests/development-normal-only.test.mjs workbench/tests/ui-d2a.test.mjs | 0 | 20 | 0 | 0 | workbench/qa/20260925-v21/model-engineering-tests.log |

## 本轮命令与环境

- 工作目录：D:/01_AI工程/01_工程项目/ui-test-agent
- 命令：pwsh -NoProfile -File workbench/scripts/start-workbench.ps1 -Data fresh-b
- 命令：node --test workbench/tests/product-v21.test.mjs workbench/tests/batches.test.mjs workbench/tests/development-normal-only.test.mjs workbench/tests/ui-d2a.test.mjs
- 命令：node workbench/qa/20260925-v21/verify-live.mjs
- 命令：node workbench/qa/20260925-v21/verify-reports.mjs
- 命令：node workbench/qa/20260925-v21/verify-repair.mjs
- 命令：node workbench/qa/20260925-v21/verify-model-round.mjs
- 环境：唯一正式4322，既有workbench/.local/fresh25-b数据；测试目标站每run受控临时启动，不是第二个工作台；本机Edge/锁定Playwright

## 结论

- V2.1原18项/11次历史保留；返修20工程检查、4次既有包执行（3通过1原业务失败）、3新批次，模型/Harness0；真实4322按钮恢复/预检/单条/跨页/媒体/返回已验证，非全部UX产品验收。
- v6本轮真实模型deepseek-official/deepseek-flash；6任务4技术成功1失败1取消。零模型3批5运行，46媒体核对。生成运行授权产品接线与生成媒体步骤采集缺口保留；报告预览/下载实测，file离线打开未验证。
