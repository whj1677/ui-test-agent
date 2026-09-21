# M3-C 限定首审资产登记与项目直接回归报告

日期：2026-09-21

分支：`codex/test-workbench-m3c-reviewed-asset-run`

需求：`REQ-0028`

基线：`0eba0c59d8711fbcd6af1e5f4a56150bc1cbbaff`

## 结论

任务 `build-20260921120911-48d7c545` 中经用户限定人工首审的候选，已按原字节登记为资产 `reviewed-project-case-4b183ad25305` / `reviewed-v1-4b183ad25305`。项目用例页可直接发起正常 Playwright 回归；受控验收入口另行执行错误输出反例。正常运行完整通过，反例保留真实失败和确切值差异；两次报告及 screenshot、video、trace 均独立保存并在服务重启后读回。

该资产只适用于本次两步无登录合成用例。旧生成输入曾包含反例值的历史事实继续保留；本轮不证明未知反例生成、复杂业务或发布能力。没有启动 Harness、调用模型、生成/修订候选、改写旧任务或自动批准。

## 身份与首审依据

| 项目 | 已核对事实 |
|---|---|
| 资产 ID | `reviewed-project-case-4b183ad25305` |
| 资产版本 | `reviewed-v1-4b183ad25305` |
| 项目 / 用例 | `project-038b87b4-88d0-443b-ba66-c20883d7b3e9` / `case-27a1c174-4485-4eaf-b9b0-d0c9cdedf3f6` |
| 用例版本 / 内容哈希 | v1 / `9A70FFC1F15863D7AD04ECEB69F9976895A7E810D5AF6C8DDDAE4C97B5AC44B9` |
| 来源任务 / attempt / 候选版本 | `build-20260921120911-48d7c545` / `attempt-01-initial` / v1 |
| 候选 SHA-256 | `4B183AD25305913547C309A86F273DAAB861004313385A5DEF3094385F3B0730` |
| 人工首审记录 SHA-256 | `84302DA1B5DA966E35C13D2CD0567959CD6402CA229DE1F3567B988F579CA447` |
| 首审范围 | 仅确认该候选符合本次两步无登录合成用例 |

登记器从既有私有数据根同时读取 `task.json`、首审记录、候选原件和项目用例版本；任务、attempt、候选版本/哈希、项目、内部用例、版本和内容哈希必须全部一致。候选与首审记录按原字节复制到 Git 忽略的 `data/assets/<asset>/<version>/`，不再把易清理的 attempt 作为唯一副本。首次登记 `created=true`，再次登记 `created=false`，catalog 只保留一个资产版本；登记前后候选哈希一致。

## 运行配置与结果

该资产使用 workbench 锁定的 Playwright Test `1.62.1`，候选、CLI 与生成配置从同一 workbench 依赖根解析。固定配置为 Chromium、`zh-CN`、1280×720、测试 30 秒、断言 5 秒、workers=1、retries=0、screenshot/video/trace=`on`。执行子进程只取得 `PROBE_URL`、浏览器可执行文件和必要系统路径，不取得模型密钥、Cookie 或完整宿主环境。

| 模式 | run_id | 进程/报告/证据 | 测试事实 | 整体 |
|---|---|---|---|---|
| 项目 Web 正常回归 | `run-20260921141132-eddfca90` | exit 0 / COMPLETE / COMPLETE | 1 条 PASSED；`CASE_STEP_1/2` 均 PASSED | `complete_pass=true` |
| 受控错误输出反例 | `run-20260921141137-7292d4db` | exit 1 / COMPLETE / COMPLETE | 1 条 FAILED；步骤 1 PASSED，步骤 2 FAILED；Expected `PROBE-42` / Received `PROBE-41` | `complete_pass=false` |

反例错误类型为 `ASSERTION_MISMATCH`，归因保持 `PENDING_ANALYSIS`。它是“指定错误已检出”的验收对照，不是普通业务通过。正常入口是项目页唯一可启动环境；反例保存在 `acceptance_environments`，普通 `/api/runs` 请求无法选择。

两次运行前后管理副本 SHA-256 均为 `4B183AD2…F3B0730`。每次各生成并登记 1 张截图、1 段 WebM 录像和 1 份 Trace；真实 Chromium 已完成图片解码、视频播放/暂停/定位，并通过受控媒体 ID 下载 Trace 后复核 SHA-256。关闭并重建服务后两条 run 仍可从原项目用例读回，数量未变化、没有自动重放。

- [正常回归 Web 证据](evidence/M3C_REVIEWED_ASSET_NORMAL_WEB.png)
- [受控反例 Web 证据](evidence/M3C_REVIEWED_ASSET_COUNTEREXAMPLE_WEB.png)

Trace 仍采用本地下载查看，不上传外部服务：

```powershell
node node_modules/@playwright/test/cli.js show-trace <下载的-trace.zip>
```

## 工程验证与成本

| 命令/阶段 | 实际结果 |
|---|---|
| `npm ci`（workbench） | 退出码 0；按 lock 安装，无依赖升级，审计 0 漏洞 |
| `npm ci`（harness-probe） | 退出码 0；仅恢复基线测试依赖；报告 5 个既有 moderate 项，未越权升级 |
| `npm test`（workbench） | 65/65 通过，退出码 0；包含真实 Chromium 的 v2 不继承校验 |
| `npm run register:reviewed` | 首次登记成功；第二次幂等复用，均退出码 0 |
| `npm run test:m3c-real` | 退出码 0，约 18.6 秒；1 次 Web 正常运行 + 1 次受控反例 + 媒体操作 + 重启读回 |

工程测试覆盖无首审、候选哈希变化、项目关联错误拒绝，重复登记幂等，真实 Chromium 中 v2 不继承 v1 资产，普通入口不可越权运行反例，以及缺报告/缺证据/零测试/异常终态无法成为完整通过。运行临时目录按数据根命名空间隔离，避免多个数据根使用相同 run ID 时相互覆盖；运行结束删除临时副本，正式报告与媒体仍留在各自 run 目录。

可量化命令墙钟如上；开发与排查人工投入未由独立计时器采集，记录为未知。Harness 启动 0 次、模型调用 0 次，模型 usage 与货币成本不适用。本轮没有修改 M1 批准排序脚本、M2/M3-B2 历史任务、首审原件或模型授权账本。

## 当前能力与边界

- 项目用例页显示资产版本、绑定用例 v1、限定范围、来源任务和首审记录摘要，并生成新的 run ID；旧生成期状态不追溯改写。
- 用例以后形成 v2 时，v1 资产仍只绑定 v1，按钮明确显示“不自动继承”；本轮没有自动适配或修订。
- Web 可查看运行状态、两步结果、原始错误、截图与原生录像；Trace 提供受控下载和本地查看入口。
- 本轮没有建设批准按钮、通用审批、批量套件、复杂业务、自动自愈、多人访问或生产发布。
- 当前状态是“这份限定人工首审脚本可从对应项目用例直接运行”，不是候选生成能力或通用测试平台验收。
