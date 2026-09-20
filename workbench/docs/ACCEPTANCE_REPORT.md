# 测试工作台第一阶段集成验收报告

日期：2026-09-20

需求：REQ-0020

分支：`codex/test-workbench-m1`

基线：`744a3f7a7b775e0a89a7150babf6e5d46649de1c`

## 结论与边界

新工作台第一阶段集成验证完成：真实 Web 可启动登记过的批准脚本，normal/fault 使用独立 Playwright 进程和运行目录；后端保存进程、报告、测试、步骤、错误及媒体事实；重启后仍能从 Web 读取两次历史和附件。

本结论只覆盖本地单用户、固定批准排序资产和两个冻结入口的工作台集成。不重新宣称原业务脚本首次验收，不证明陌生页面泛化、自动建例、多人使用、产品发布或通用 AI 测试平台完成。故障入口的 Playwright 事实仍是测试失败；“指定故障检出符合预期”仅是本报告的独立验收判断，不把它改写为绿色通过或已确认产品缺陷。

## 冻结资产

| 项目 | 值 |
|---|---|
| 资产 ID / 版本 | `sorting-s02-approved-280a7875` / `revision-s02-approved-1` |
| 用例版本 | `heldout-lab/cases.json@744a3f7a7b775e0a89a7150babf6e5d46649de1c` |
| 脚本来源 | `pilot/revision-s02/tests/sorting.spec.ts` @ `744a3f7a7b775e0a89a7150babf6e5d46649de1c` |
| 脚本 SHA-256 | `280A787546AABDD87570838932663A5DC254AEE5E0C329BE3A13294E9A18079A` |
| 批准依据 | `pilot/revision-s02/HUMAN_REVIEW.md`、`FORMAL_REGRESSION.md`；仅迁入已有批准记录 |
| 原配置 SHA-256 | `E488D9115800AB3FE9CFD1F9982B93B4BDB5117274DC6BD7ECD41C0468C31831` |
| 原依赖锁 SHA-256 | `3F40DBF1C3BC205C33ED4030055A6C84A2C5C3EBFD605B9AA46B7207E3286DD6` |
| 运行依赖 | `@playwright/test 1.62.1`，Chromium，zh-CN，1440×1000，workers=1，retries=0 |
| 冻结站点摘要 | `index.html`=`00DF6A16...F6CB96A`；`serve.mjs`=`138BB8F1...FFD6E035` |

Windows 首次检出受全局 `core.autocrlf=true` 影响，工作区字节曾为另一哈希；实现前已用提交原始 blob 恢复批准字节。恢复后 Git 内容未变化，登记前、两次运行前后及最终核对均为批准哈希，没有更新批准值。

## 工程验证

| 命令 | 退出码 | 结果边界 |
|---|---:|---|
| `npm ci --ignore-scripts` | 0 | 依赖锁可安装，4 个包审计无漏洞 |
| `npm test` | 0 | 最终 18 项 Node 工程测试通过；覆盖报告边界、批准/哈希、越界/入口、互斥/停止/中断、持久化和媒体访问 |
| `npm run test:browser` | 0 | 真实 Chromium 操作工作台的登记资产、选择入口、启动/停止、历史/详情和安全转义；该测试使用独立模拟进程记录，不计业务运行 |
| `npm run test:real -- --normal-run-id=run-20260920152922-af45f654` | 0 | 从 Web 复核既有 normal 运行并真实启动 fault 运行，核对 Web、run.json、Playwright report.json |
| 重启工作台后 `npm run test:restart` | 0 | 两个运行 ID、状态及 6 个媒体附件仍可从 Web/API 读取 |
| `python scripts/collect_delivery_evidence.py ...` | 0 | 最终正式证据收集完成，内含同一次 18 项工程测试与上下文检查 |
| `python scripts/check_ai_context.py` | 0 | 最终需求、模块文档和交付上下文门禁通过 |

还覆盖了缺失/损坏报告、零目标、跳过、退出码 0 但步骤不完整、未批准资产、错哈希、路径越界、非法环境、重复启动、取消和服务重启中断状态。故障注入均使用临时夹具或模拟进程，没有修改批准脚本或冻结站点。

正式证据收集首次退出码为 1，原因是 5 个 VT 使用了门禁不接受的自定义执行状态文字，且尚缺具体模块文档；当次内嵌 18 项工程测试实际为通过。补充 `docs/modules/test-workbench.md`、改用受支持的“集成测试通过”状态后，同一收集命令复验退出码 0。该修正没有改变业务脚本、工作台运行代码或真实业务运行，也没有重复 normal/fault 组合。

## 真实集成运行

| 事实 | normal | fault |
|---|---|---|
| run_id | `run-20260920152922-af45f654` | `run-20260920153002-86396470` |
| 入口 | `http://localhost:4198/probe/s1` | `http://localhost:4198/probe/s2` |
| 资产版本 / 哈希 | `revision-s02-approved-1` / `280A...79A` | 相同 |
| 进程 | `PROCESS_ENDED`，退出码 0 | `PROCESS_ENDED`，退出码 1 |
| 报告 / 测试 / 证据 | `COMPLETE / PASSED / COMPLETE` | `COMPLETE / FAILED / COMPLETE` |
| 步骤 | S01–S04 全部 `PASSED` | S01、S02 `PASSED`；S03 `FAILED`；S04 `NOT_EXECUTED` |
| 错误事实 | 无 | `ASSERTION_MISMATCH`；期望 `H111`，实际 `H106`；归因 `PENDING_ANALYSIS` |
| 媒体 | screenshot、Trace、video 各 1 | screenshot、Trace、video 各 1 |
| 模型 / 重试 / healer | `0 / 0 / false` | `0 / 0 / false` |
| 工作台进程墙钟 | 2,544 ms | 7,827 ms |
| Playwright 报告时长 | 1,955.112 ms | 7,236.071 ms |

normal 的 Web 启动请求实际成功并完成，但第一版验收脚本在页面仍显示“正在启动”时过早读取 run_id 而退出。该运行没有删除、覆盖或重放；修正的是独立验收脚本等待条件，随后从 Web 历史、run.json 和原 report.json 对同一运行独立复核。fault 在修正后由 Web 正常发起。全部尝试均保留在本机忽略目录。

三方一致性：Web 展示的运行 ID、入口、退出码、四步状态、错误期望/实际值和三个媒体索引，与 `run.json` 一致；原 `report.json` 各恰有一个目标测试和一次 result，normal status=`passed`，fault status=`failed`。重启后同一 ID 和附件仍可读，没有自动重放。

## 脱敏 Web 证据

- [normal 结果](evidence/normal-result.png)，SHA-256 `867C12041BB5370B26E7CC5B7340B9842B1F24BBC4801DD3F489A612F11D7A1A`
- [fault 结果](evidence/fault-result.png)，SHA-256 `ECCA57C54270C21D9DFE54097354F8A3D27EBDC4650588D1F0F53E34403F4F17`
- [重启后历史](evidence/restart-history.png)，SHA-256 `FC422788BA8ECDEBD2FC5D703710E32A17B5A3A5C1EEACEAC0A0801D0EE427AB`

截图只包含公开合成站点事实和工作台元数据。原始 report、Trace、视频、截图、console 与运行 JSON 保留在被忽略的 `workbench/.local/`，未上传仓库。

## 分项投入

| 分类 | 可核对投入 |
|---|---|
| 开发 / 排查 | T0–T3 四批提交；T4 出现 1 次验收脚本等待条件问题，未触发工作台代码集中修复或业务重跑。开发墙钟未单独计时，不编造数值。 |
| 工程验证 | 最终 Node 测试 18 项；Chromium 工作台操作流 1 次；依赖安装、基础启动、API 和安全边界逐批验证。 |
| 业务运行 | normal 2.544 秒、fault 7.827 秒，工作台进程墙钟合计 10.371 秒；Playwright 报告时长合计 9.191183 秒。 |
| 报告核对 | T4 汇总脚本从 `15:30:01.911Z` 到 `15:30:10.740Z` 共 8.829 秒，含 normal 三方复核与 fault 运行核对；之后另做一次服务重启和附件读取验证。 |

## 污染与停止点

- `git diff 744a3f7 -- src public pilot heldout-lab` 为空；原产品、批准资产、冻结站点、旧报告和历史没有仓库内容变化。
- 4198 和 4210 在验收前均为空闲；本任务分别启动冻结站点和工作台，结束后只停止这两个自有进程。
- Git 跟踪内容不含 `.local`、原始媒体、密钥、Cookie、storageState、完整环境变量或个人业务数据。
- 本轮到第一阶段即停止；没有接入 Harness、完整套件编辑、脚本生成、多人服务、发布、Release 或 main 合并。
