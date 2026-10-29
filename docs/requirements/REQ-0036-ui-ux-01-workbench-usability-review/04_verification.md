<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0036 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0036-01 | DR-0036-01 | 已确认 | 仅静态检查 | 走查证据：12 张真实页面截图（地址+版本注明）、A-F 分类结论、三页线框与第一批范围 | 真实地址、运行实例版本核对记录、截图文件路径 | workbench/docs/UI_UX_REVIEW.md 及 workbench/docs/evidence/UI_UX_01_*.png；4322 app.js 与 6066bbc 哈希一致（135f9879…），4331 为 HEAD 8127e33 | - | - | - | - | - | - |
| VT-0036-02 | DR-0036-02 | 已确认 | 人工待确认 | 第一批真实浏览器：24历史详情、Excel/JSON导入、单条/跨页/全项目、版本隔离、取消重启与媒体；11次已有候选执行请求、模型0；软断言观察修复后回放实际验证，原不完整运行保留 | 真实命令、退出码、测试统计和产物路径 | workbench/qa/20260925-workflow-phase1/REPORT.md、integrity.json、各批次与浏览器证据；工程纯单元8项退出0。正式门禁结论另记，候选未批准。 | - | - | - | - | - | - |
| VT-0036-03 | DR-0036-03 | 已确认 | 人工待确认 | 正常工程师12条逐项复测、真实生成、脚本语义核查、固定范围批次与报告；统一复跑阻塞如实登记 | 真实操作、文件哈希、逐项结果及截图 | 命令：node --test workbench/tests/batches.test.mjs；退出码：0；测试数量：8；失败数量：0；跳过数量：0；证据：workbench/qa/20260925-v21/engineer-batch-tests.log | node --test workbench/tests/batches.test.mjs | 0 | 8 | 0 | 0 | workbench/qa/20260925-v21/engineer-batch-tests.log |
| VT-0036-04 | DR-0036-03 | 已确认 | 人工待确认 | v8工程证据保留；v9正式4322一条真实生成自测及独立验证均有READY字幕、COMPLETE媒体，各10文件核验，旧缺素材不补造。 | 真实命令、零模型计数、冻结包哈希、编码帧、同批次媒体及原REPORT边界 | 命令：node --test workbench/tests/development-session.test.mjs workbench/tests/development-fidelity.test.mjs workbench/tests/run-evidence.test.mjs workbench/tests/development-normal-only.test.mjs；退出码：0；测试数量：17；失败数量：0；跳过数量：0；证据：workbench/qa/20260925-v21/caption-chain-regression.log | node --test workbench/tests/development-session.test.mjs workbench/tests/development-fidelity.test.mjs workbench/tests/run-evidence.test.mjs workbench/tests/development-normal-only.test.mjs | 0 | 17 | 0 | 0 | workbench/qa/20260925-v21/caption-chain-regression.log |
| VT-0036-05 | DR-0036-03 | 已确认 | 人工待确认 | v9：核心生成/复跑/字幕已加载正式4322；正常UI真实重生成KC-05 S2（Harness1/工具28/自测1）及2批3零模型复跑，50媒体和20报告内嵌附件核验。41旧授权和12条正文版本不变。最后后端原因优先级修正待重载，自动审批拒绝；人工验收/离线打开未确认。 | 原REPORT、真实UI及只读正式服务核验、源码测试，未加载的最后调整单列。 | 命令：node workbench/qa/20260925-v21/verify-user-workflow.mjs；退出码：0；测试数量：0；失败数量：0；跳过数量：0；证据：workbench/qa/20260925-v21/user-workflow-live.log | node workbench/qa/20260925-v21/verify-user-workflow.mjs | 0 | 0 | 0 | 0 | workbench/qa/20260925-v21/user-workflow-live.log |
| VT-0036-06 | DR-0036-04 | 已确认 | 集成测试通过 | 桌面项目索引/配置/业务页/键盘弹窗限定验证，60项相关工程回归；模型与业务执行未运行 | 正式4322桌面截图、browser-checks.json与独立review；相关工程日志及已加载源码/配置/数据根一致性 | 命令：node --test --test-skip-pattern="native FormData" workbench/tests/project-index.test.mjs workbench/tests/project-setup.test.mjs workbench/tests/project-loading.test.mjs workbench/tests/project-workflow-view.test.mjs workbench/tests/workspace-merged-view.test.mjs；退出码：0；测试数量：60；失败数量：0；跳过数量：0；证据：workbench/qa/20261027-modern-console/engineering-final.log | node --test --test-skip-pattern="native FormData" workbench/tests/project-index.test.mjs workbench/tests/project-setup.test.mjs workbench/tests/project-loading.test.mjs workbench/tests/project-workflow-view.test.mjs workbench/tests/workspace-merged-view.test.mjs | 0 | 60 | 0 | 0 | workbench/qa/20261027-modern-console/engineering-final.log |
| VT-0036-07 | DR-0036-05 | 已确认 | 单元测试通过 | 固定144文件清单复跑1275/1275；首次1274通过1失败保留，单独复验1通过。空项目提示修复后受影响40项通过；不将重叠数量累加或宣称修复后全量重跑 | workbench/qa/20261027-functional-validation中的原始日志、模型/任务/批次、媒体及冻结摘要 | 命令：node --test workbench/tests/project-workflow-view.test.mjs workbench/tests/project-loading.test.mjs workbench/tests/project-index.test.mjs；退出码：0；测试数量：40；失败数量：0；跳过数量：0；证据：workbench/qa/20261027-functional-validation/empty-project-fix.log | node --test workbench/tests/project-workflow-view.test.mjs workbench/tests/project-loading.test.mjs workbench/tests/project-index.test.mjs | 0 | 40 | 0 | 0 | workbench/qa/20261027-functional-validation/empty-project-fix.log |
| VT-0036-08 | DR-0036-05 | 已确认 | 集成测试通过 | 正式4322合成UI/API各一条真实模型生成并执行通过；UI同SHA/Bundle零模型复跑通过，2次均4步25实际断言，HTTP3步清理通过，52附件哈希吻合，62旧项目及16旧空间无变化。人工首审和独立反例未登记，报告漏计单列VT09 | workbench/qa/20261027-functional-validation中的原始日志、模型/任务/批次、媒体及冻结摘要 | 命令：node workbench/qa/20261027-functional-validation/finalize-facts.mjs；退出码：0；测试数量：0；失败数量：0；跳过数量：0；证据：workbench/qa/20261027-functional-validation/final-facts.log | node workbench/qa/20261027-functional-validation/finalize-facts.mjs | 0 | 0 | 0 | 0 | workbench/qa/20261027-functional-validation/final-facts.log |
| VT-0036-09 | DR-0036-05 | 已确认 | 测试失败 | P1：全项目最新结果报告应包含UI/HTTP两条已通过用例，实际仅HTTP通过，原生UI误列未执行；报告预览及离线固定快照均复现，尚未修复 | 同项目两次正式原生UI记录与固定快照对照；实际预期计数回归应为2通过0未执行 | 命令：node --test workbench/qa/20261027-functional-validation/report-regression.test.mjs；退出码：1；测试数量：1；失败数量：1；跳过数量：0；证据：workbench/qa/20261027-functional-validation/report-regression.log | node --test workbench/qa/20261027-functional-validation/report-regression.test.mjs | 1 | 1 | 1 | 0 | workbench/qa/20261027-functional-validation/report-regression.log |
| VT-0036-10 | DR-0036-06 | 已确认 | 单元测试通过 | 报告适配与失败/版本/附件反例及固定清单全量工程 | workbench/qa/20261027-report-remediation 原始日志/任务/运行/媒体和快照 | 命令：node workbench/scripts/run-unit-checks.mjs；退出码：0；测试数量：1284；失败数量：0；跳过数量：0；证据：workbench/qa/20261027-report-remediation/engineering-accepted-final.log | node workbench/scripts/run-unit-checks.mjs | 0 | 1284 | 0 | 0 | workbench/qa/20261027-report-remediation/engineering-accepted-final.log |
| VT-0036-11 | DR-0036-06 | 已确认 | 集成测试通过 | 正式4322全部12条合成用例真实模型生成、执行、冻结原稿零模型复跑 | workbench/qa/20261027-report-remediation 原始日志/任务/运行/媒体和快照 | 命令：node workbench/qa/20261027-report-remediation/audit-ui.mjs ui-final-full；退出码：0；测试数量：6；失败数量：0；跳过数量：0；证据：workbench/qa/20261027-report-remediation/ui-final-audit.log | node workbench/qa/20261027-report-remediation/audit-ui.mjs ui-final-full | 0 | 6 | 0 | 0 | workbench/qa/20261027-report-remediation/ui-final-audit.log |
| VT-0036-12 | DR-0036-06 | 已确认 | 集成测试通过 | 正式报告预览/快照/离线证据、原项目保全与原交付检查 | workbench/qa/20261027-report-remediation 原始日志/任务/运行/媒体和快照 | 命令：node workbench/qa/20261027-report-remediation/verify-final.mjs；退出码：0；测试数量：12；失败数量：0；跳过数量：0；证据：workbench/qa/20261027-report-remediation/final-verification.log | node workbench/qa/20261027-report-remediation/verify-final.mjs | 0 | 12 | 0 | 0 | workbench/qa/20261027-report-remediation/final-verification.log |

## 本轮命令与环境

- 工作目录：D:/01_AI工程/01_工程项目/ui-test-agent
- 命令：pwsh -NoProfile -File workbench/scripts/start-workbench.ps1 -Data fresh-b
- 命令：node --test workbench/tests/product-v21.test.mjs workbench/tests/batches.test.mjs workbench/tests/development-normal-only.test.mjs workbench/tests/ui-d2a.test.mjs
- 命令：node workbench/qa/20260925-v21/verify-live.mjs
- 命令：node workbench/qa/20260925-v21/verify-reports.mjs
- 命令：node workbench/qa/20260925-v21/verify-repair.mjs
- 命令：node workbench/qa/20260925-v21/verify-model-round.mjs
- 命令：node workbench/qa/20260925-v21/verify-engineer-round.mjs
- 命令：node workbench/qa/20260925-v21/verify-engineer-report.mjs
- 环境：唯一正式4322，既有workbench/.local/fresh25-b数据；测试目标站每run受控临时启动，不是第二个工作台；本机Edge/锁定Playwright

## 结论

- V2.1原18项/11次历史保留；返修20工程检查、4次既有包执行（3通过1原业务失败）、3新批次，模型/Harness0；真实4322按钮恢复/预检/单条/跨页/媒体/返回已验证，非全部UX产品验收。
- v6本轮真实模型deepseek-official/deepseek-flash；6任务4技术成功1失败1取消。零模型3批5运行，46媒体核对。生成运行授权产品接线与生成媒体步骤采集缺口保留；报告预览/下载实测，file离线打开未验证。
- v7正常工程师复测：10真实生成/Harness10、538工具、18自测，原要求逐条核查。自动审批拒绝空闲4322重载，新统一批次12请求/2执行通过/10授权阻塞；未完成12条统一复跑。4辅助/主批次共5零模型执行、50媒体哈希一致。多版本选择接线修复，工程8项通过。
- v9：核心生成/复跑/字幕已加载正式4322；正常UI真实重生成KC-05 S2（Harness1/工具28/自测1）及2批3零模型复跑，50媒体和20报告内嵌附件核验。41旧授权和12条正文版本不变。最后后端原因优先级修正待重载，自动审批拒绝；人工验收/离线打开未确认。
