# Round 2 独立浏览器 UI 执行简报

- 正式入口：`http://127.0.0.1:4322/workspace/`；执行标签 `1`，报告只读标签 `2`。
- 项目：`project-80875248-3e14-4055-b077-b890dead1a9e`（12 条用例）。所有运行和生成均由正式 UI 点击提交；没有新建工作台或切换端口。执行者观察不等于最终产品验收。
- 本轮批次：混合 `batch-ef21886d-a9b2-4bf4-97b1-cbde23f3b1f9`；新 S2 正常复跑 `batch-c5bfa41e-131e-444e-b4ff-c13aa4f62411`；取消 `batch-036f6471-e080-41be-a066-be03a8a7c5a2`。
- 本轮生成：`generation-88fc1fac-55cf-45e8-b479-1fab3c07ba07` / `build-20260925142505-0fc7ce0d`，唯一一次从头生成。旧 KC08 S1 保留，新 S2 未批准。

| 场景 | UI 操作与明确期望 | 实际观察 / 状态 | 证据 |
|---|---|---|---|
| 01 项目与用例浏览 | 首页进入主项目，列表应显示 12 条、每页 10 条及单行状态。 | 执行通过：12 条、2 页；KC02 业务差异、KC01/07/10 不采纳、KC08 可试跑的标记可见。 | `01-case-list.txt/png` |
| 02 跨页选择 | 第 1 页勾 KC08，翻到第 2 页勾 KC12；应保留已选项。 | 执行通过：筛选 KC08 后显示已选 2 条、1 条不在当前筛选中，KC08 仍勾选。 | `02-cross-page-page2-settled.txt`、`03-filter-hidden-selection-settled.txt` |
| 03 筛选与清空 | 搜索 KC08 后清空选择；应恢复已选 0 条且运行选中不可用。 | 执行通过：已选 0 条，运行选中按钮 disabled。 | `04-clear-selection-settled.txt` |
| 04 KC05 多脚本 | 打开 KC05，明确选 S3；应显示 S1/S2/S3 并保留待人工核对边界。 | 执行通过：S3 来自 `build-20260925135700-4097fd1b`、候选 v2；技术验证通过但未批准。仅作版本选择和只读核对，本轮未运行 KC05。 | `07-kc05-s3-selected.txt/png`、`08-kc05-script-tab-settled.txt` |
| 05 混合批次准备 | 列表勾 KC02/KC08，运行确认应冻结 2 条、绑定 S1、可运行 2、零模型。 | 执行通过：软件版本 `independent-ui-round2-mixed-20260925`；确认框显示两个 S1，阻塞 0。 | `10-mixed-selected-settled.txt`、`11-mixed-confirm-ready.txt`、`11-mixed-confirm-filled.png` |
| 06 混合批次结果 | UI 提交已有脚本后，成功与已知失败应分别记录，不合并成全项目通过。 | 执行通过：批次请求 2、执行 2；KC02 失败 `trial-6d7ab6a079f6252583c53ff1c0968a927f2e860d`，KC08 通过 `trial-9e0be1ee280daf1516938327f1f23dfdca29040a`；仍为未批准技术试跑。 | `12-mixed-running.txt/png`、`14-mixed-complete.txt/png` |
| 07 原始预期与逐步骤证据 | 打开本批 KC02；应保留原预期 8、实际 5 和整例失败，不让后两步通过抵消。 | 执行通过：第 1 步失败，预期 EQ-101 至 EQ-108 共 8，实际共 5；第 2/3 步单独通过，整例仍失败。 | `15-kc02-result.txt/png` |
| 08 媒体与步骤定位 | 点击 KC02 第 2 步、播放回放；应定位并推进时间。 | 执行通过：定位“步骤 2 · 动作”3.2/9.2 秒；播放后到 9.2/9.2 秒。页面说明回放为截图与实际结果合成，不是原始连续录像。 | `16-kc02-step2.txt/png`、`17-kc02-playing-later.txt` |
| 09 固定范围报告 | 从本批入口生成报告、预览并点击离线 HTML 下载；应仅含本批 2 条。 | 执行通过：`report-52201e00c26f334a826ef5129d7f7e2214657f2c`；预览请求 2、通过 1、未通过 1、未执行 0；KC02 原预期/实际保留；下载事件发生。未选择的视频/Trace 被明确标为未携带。 | `22-batch-report.txt/png`、`23-batch-report-preview.txt/png` |
| 10 KC08 从头生成资源门 | 在 KC08 点击重新生成；应保留 S1、不用旧候选起稿，且上限为 1 任务、1 Harness、120 工具、3 自测、20 分钟。 | 执行通过：确认框恰为该档；只提交一次，环境为 `kimi-complex-20260925` 对应本机自动准备页。 | `20-kc08-generation-confirm.txt/png`、`21-kc08-generation-page.txt` |
| 11 生成与独立技术验证 | 查看生成任务、刷新任务页面；应追踪同一任务并保留原要求及待审批。 | 执行通过：刷新后仍为同一 build；最终 `WAITING_HUMAN_REVIEW`、Harness 1、工具 52、自测 1/3；final normal 技术验证三步通过。候选 SHA256 `E3ADEFB1A4F673F4F2A1F2D4844F1ABF20C57CE377DF5C1C227D5222DE913735`；页面明确 `semantic_approval=false`。语义完整性由主管独立审查。 | `27-build-after-reload-settled.txt`、`30-build-postverify.txt/png`、`31-build-final-detail.txt` |
| 12 新 S2 独立正常复跑 | 选择新 KC08 S2，确认框内再次明确绑定 S2，运行已有脚本；应产生独立批次、零模型调用。 | 执行通过：`batch-c5bfa41e-131e-444e-b4ff-c13aa4f62411` / `trial-32533f98868dd9c09674ff3a53baa0051d60f625`；请求 1、执行 1、S2 通过、未批准。S1 与 S2 同时可见。 | `33-kc08-new-version.txt`、`35-kc08-s2-confirm-ready.txt/png`、`37-kc08-s2-batch.txt/png` |
| 13 运行中取消 | KC02/KC03 组成新批次后立即点击“取消本批，保留已执行结果”；应停止当前任务并将队列项标为未执行。 | 执行通过：`batch-036f6471-e080-41be-a066-be03a8a7c5a2` 已取消；KC02 run `trial-12d38ecb9df671211ac9d27a94319247a22c8d08` 已取消、未形成完整结果，KC03 取消后未执行。首次显示问题及修复复测见下方。 | `41-cancel-batch-running-settled.txt`、`42-cancel-action.txt`、`43-cancel-complete.txt/png`、`44-canceled-kc02-detail.txt/png` |

本轮发现并由主管修复的 UI 汇总问题：取消批次原概览写“已执行 1；未执行 1”，但明细 KC02 为“已取消 · 未执行”、KC03 为“未执行 · 未执行”；KC02 详情 3 步均未采集，原文案显示 `REPORT_MISSING` 和 `MISSING`。首次缺陷证据保存在 `43-cancel-complete.txt/png`、`44-canceled-kc02-detail.txt/png`。主管对原工作台做展示层最小修复；没有改批次、run 或原用例 JSON。

修复后在同一正式工作台刷新原 `batch-036f6471-e080-41be-a066-be03a8a7c5a2`：概览为“请求 2；执行结束 0；执行中 0；已取消 1；阻塞 0；未执行 1”，KC02 行为“已取消 · 未形成完整结果”，KC03 为“取消后未执行”，见 `46-cancel-batch-after-fix.txt/png`。原混合完成批次 `batch-ef21886d-a9b2-4bf4-97b1-cbde23f3b1f9` 显示“执行结束 2；已取消 0”，KC02 仍失败、KC08 仍通过，见 `47-mixed-after-fix.txt/png`。同一取消 run `trial-12d38ecb9df671211ac9d27a94319247a22c8d08` 的 3 步均显示“未采集执行证据”；最终再次完整刷新后，原 `REPORT_MISSING` 标题显示“未生成完整执行报告”，见 `45-cancel-run-after-fix.txt/png`、`49-cancel-run-final-reload.txt/png`。本问题的页面复测通过；终态重复取消无 UI 入口，未执行该操作。

本轮未修改原用例、预期、历史批次、候选文件和批准状态；没有第二次模型生成。截图和 DOM 文本位于本目录，DOM 快照已清理内嵌 data URL。
