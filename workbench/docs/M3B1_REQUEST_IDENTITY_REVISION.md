# M3-B1 request_id 请求身份校验修订记录

日期：2026-09-21

分支：`codex/test-workbench-m3b-case-build-input`

已审查基线：`1385d8c016a2d0d20e263e72c5850ac12ac1eaed`

Codex 具体子型号/推理档位：当前运行环境不可取得，记为未知。

## 修前复现

在实际 `BuildTaskManager`、临时持久化目录和项目 Excel 导入链路上增加回归后，修前定向执行共 6 项、通过 3 项、失败 3 项：

- 已落盘任务只按 `creation_request_id` 返回，改变项目、用例、版本、内容哈希或环境仍会错误返回旧任务；
- 处理中 `caseSubmissions` 只按 `request_id` 复用 Promise，同键异身份不能拒绝；
- API 将该冲突按普通 `CASE_*` 错误返回 400，而不是明确冲突状态。

原实现因此不能通过新增的“同 request_id、不同内容必须拒绝”断言。

## 最小修订

- 定义五项确定请求身份：`project_id`、`case_id`、`case_version`、`content_sha256`、`environment_id`，对有序身份生成 SHA-256 请求指纹。
- 内存处理中保存“指纹 + completion”；同键同身份复用原 completion，同键异身份立即返回 `CASE_BUILD_REQUEST_KEY_CONFLICT`。
- 新任务在 `source` 中保存 `creation_request_fingerprint`；重启后复用先同时核对 request_id 和身份指纹。
- 不批量改写旧任务。旧任务没有指纹时，从既有 `source` 与 `environment_ref` 推导；字段不全、存量指纹不合法或与派生值不一致时 fail closed。
- HTTP 将 `CASE_BUILD_REQUEST_KEY_CONFLICT` 映射为 409；不会返回 201 和旧任务对象。

## 实际验证

- 定向修后：`node --test tests/project-case-build-input.test.mjs tests/build-api.test.mjs`，7/7 通过，退出码 0。
- workbench 全量：`npm test`，57/57 通过，退出码 0。
- 真实 Chromium 回归：`npm run test:m3b1-browser`，1/1 通过，退出码 0；任务仍为 `INPUT_ONLY`，候选数 0，Harness 启动数 0。
- 批准排序脚本 SHA-256：`280A787546AABDD87570838932663A5DC254AEE5E0C329BE3A13294E9A18079A`，与批准值一致。

回归覆盖相同身份的顺序、并发和重启幂等；五项身份逐项变化；处理中冲突；旧任务身份推导及不可确定时拒绝；冲突后任务数量、预算和输入文件哈希/字节数不变。新增接口断言确认冲突返回 HTTP 409。

## 边界

本批 Harness 启动、建例模型调用、候选生成和批准业务脚本执行均为 0。没有解除 `INPUT_ONLY`，没有修改用例正文、旧任务、预算、原 M3-B1 报告或批准资产；浏览器回归仅验证原零模型创建/查看限制。
