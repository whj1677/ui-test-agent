# UI-D2A 墨白真实项目与用例库验收报告

## 结论

UI-D2A 已在独立分支把墨白界面接入现有真实项目与用例后端。真实 Chromium 完成了项目创建、A/B 两份真实 Excel 上传与服务端预览确认、选中/全部 JSON 下载、跨项目再导入、重复跳过、冲突决策、v2 编辑、项目隔离和服务重启读回。

本结论只覆盖项目和用例数据闭环。Harness 启动、建例模型调用和被测业务脚本执行均为 0；建例、执行、审批和批量套件仍未接入新页面。

## 实现边界

- 新入口：`/workspace/#/projects`；旧 `/` 与 `workbench/ui-prototype` 保留。
- 数据：现有 `CaseLibraryManager`、`CaseLibraryStore`、Excel/原生包解析与项目 revision 机制。
- 静态资源：仅开放 `/workspace/`、`app.js`、`api.js`、`styles.css` 白名单。
- 持久化：验收根 `workbench/.local/ui-d2a-acceptance-tAgCyB`（Git 忽略）；重启后使用同一根读取，不依赖 `sessionStorage`。
- 样例：`workbench/examples/ui-d2a/` 下两份真实 `.xlsx` 与一份正式 schema JSON 包。

## 实际浏览器结果

| 验收项 | 实际结果 |
| --- | --- |
| D2A-01 | 新 `/workspace/` 与旧 `/` 并存；新资源和 API 同源；未知静态路径失败关闭。 |
| D2A-02 | 从页面创建项目 A/B；项目 ID、revision、名称与说明修改均由后端保存。 |
| D2A-03 | 浏览器上传真实 A.xlsx，经历工作表/映射/预览；确认前项目用例数为 0。 |
| D2A-04 | 确认后 A 有 3 条：2 条已确认、1 条待确认；多步骤、中文、多行文本、`220.5 kW`、`3.65 V`、`127.0.0.1` 保真。 |
| D2A-05 | 受影响解析测试覆盖物理空行/空列和动作/预期错位；页面原样显示后端问题位置，不压缩重配。 |
| D2A-06 | 实际下载并解析“选中 2 条”和“全部 3 条”两个包；空选择按钮禁用。 |
| D2A-07 | B 先导入 1 条自有 Excel，再导入 A 包后为 4 条；重复导入不增加；后续冲突副本使最终验收态为 5 条。 |
| D2A-08 | 同源变化默认跳过；明确选择 `IMPORT_COPY` 后生成独立记录，未覆盖原记录。 |
| D2A-09 | B 的导入用例形成 v2；B v1 和 A 源用例 v1 正文保持不变。 |
| D2A-10 | 两标签页制造 revision 变化，过期写返回 409 并显示冲突，没有静默覆盖。 |
| D2A-11 | 重复确认/导入幂等；选择按项目隔离，项目切换未串用导出集合。 |
| D2A-12 | 停止并重新创建服务及空白浏览器上下文后，2 个项目、B v2 和导入记录仍可读。 |
| D2A-13 | 停止服务后页面显示真实连接失败，没有回落 DEMO 数据或无界写重试。 |
| D2A-14 | 1280×800、1440×900、1920×1080 实际检查无页面级横向溢出；主要操作未被遮挡。 |
| D2A-15 | 捕获 77 次同源请求，执行相关禁用请求为 0；未触发 build/start/revise/runs。 |

浏览器汇总：`projects=2`、`project_a_cases=3`、`project_b_cases=5`、`selected_export_cases=2`、`all_export_cases=3`、`requests=77`、`forbidden_execution_requests=0`，进程退出码 0。

## 工程与回归验证

| 命令 | 结果 |
| --- | --- |
| `npm run test:ui-d2a-browser` | 1/1 通过；真实 Chromium、真实文件上传/下载、真实服务重启，退出码 0。 |
| `node --test tests/ui-d2a.test.mjs` | 3/3 通过；入口白名单、样例解析、正式 JSON 包回读。 |
| `node --test tests/case-library.test.mjs tests/case-library-api.test.mjs tests/excel-fidelity.test.mjs` | 5/5 通过。 |
| `npm run test:m3a-browser` | 1/1 通过；旧项目用例库浏览器流程回归，退出码 0。 |
| `npm test` | 79/81 通过；仅 2 个既有 Harness Playwright 运行根测试因本 worktree 未安装 `harness-probe/node_modules/@playwright/test` 未就绪。它们不属于 D2A 路径；本批按边界未安装或启动 Harness。 |

样例 A 曾使用通用表格工具生成做兼容核验，但锁定的 ExcelJS 4.4.0 无法解析其输出；最终公开样例改由工作台锁定的 ExcelJS 生成，并再次用表格工具导入、渲染、目视核对。这是样例兼容性修正，不改变后端解析规则。

## 截图证据

- `docs/evidence/ui-d2a/01-real-import-preview-1440x900.png`：真实 Excel 预览、分类、步骤与待澄清问题。
- `docs/evidence/ui-d2a/02-cross-project-library-1440x900.png`：项目 B 的两种来源与最终项目用例库。
- `docs/evidence/ui-d2a/03-version-detail-1920x1080.png`：v2 正文、v1/v2 历史与来源追溯。
- `docs/evidence/ui-d2a/04-projects-1280x800.png`：1280 桌面项目列表与 revision 冲突提示。
- `docs/evidence/ui-d2a/05-restart-readback-1920x1080.png`：服务重启和空白上下文后的 v2 读回。

## 限制与停止点

- 首版 Excel 仍是一行一用例、单元格内按行对齐步骤/预期；不支持任意排版、合并单元格或跨行归属推断。
- 待澄清用例可以保存但不会被伪装成可建例；本阶段也没有连接建例入口。
- 页面只面向本机单用户，不包含登录、权限、多用户或生产部署。
- 本任务到真实项目与用例数据闭环为止，不扩展 Harness、执行、审批或批量套件。

## 2026-09-22 收尾追加记录

本节保留上文原始 `79/81` 事实，不追溯改写。后续收尾先用真实 Chromium 复现并修复了跨用例沿用 `state.caseVersion`、不存在版本静默回退的问题：无 `version` 参数现在只读取当前用例自己的 `current_version`；显式参数必须是正整数并精确命中，非法或不存在时显示版本错误页。历史版本保持只读，只有当前最新版本显示编辑入口。

随后按 `harness-probe/package-lock.json` 执行 `npm ci --ignore-scripts`，没有运行 `setup:harness`、模型、插件初始化或业务任务。原两项失败均实际通过（2/2），工作台全量工程测试更新为 `81/81`、失败 0、跳过 0。安装审计仍报告 5 个中等级间接依赖问题；本批没有升级锁定组合或执行 `audit fix --force`。

真实项目试点资料没有伪造：明确检查的 `workbench/.local/ui-d2a-trial` 为空；用户下载目录中唯一现成的 `case-import.json` 原文标明是本机合成“巡维演练台”，不能作为真实业务项目。故本批没有创建真实试点项目、没有上传或导出真实业务文件。完整结论和下一轮最小接入清单见 [UI-D2A 收尾与真实试点准备报告](UI_D2A_CLOSEOUT_AND_REAL_PILOT_PREP.md)。
