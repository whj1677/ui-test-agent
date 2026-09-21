# M2-C 已有候选复验与媒体接入报告

日期：2026-09-21

分支：`codex/test-workbench-m2c-build-ui`

基线：`8df0d66e968dde7115f8fff3e843cb3562aa58a1`

## 结论

本批只把本机已有复验记录关联到原任务并提供只读 Web 展示，没有启动 Harness、调用模型、生成或修改候选，也没有重新运行正常/反例业务测试。

- 源任务 `build-20260921060716-ae44c3f2` 继续保持 `CANDIDATE_VALIDATION_FAILED`。
- 原候选 v1 的正常与反例历史均继续显示 `NOT_RUN`，并保留原 `Requiring @playwright/test second time` 加载错误摘要。
- 独立复验 `candidate-runtime-fix-20260921` 按 `source_task_id`、`source_attempt_id`、候选版本和候选 SHA-256 精确关联；候选 SHA-256 为 `119AC2FE622ECE98599B2D6D98B97CB9864744A5B299358DAFD9C990E6F3585A`。
- Web 当前显示：正常 1 条 `PASSED`；反例 1 条 `FAILED`，期望 `PROBE-42`、实际 `PROBE-41`，并单独标注“指定错误已检出”。候选摘要为“已有技术复验通过，尚未批准”。
- 该摘要不覆盖原任务终态，不登记批准资产，也没有批准按钮。

## 关联与访问边界

受控登记命令读取原 `revalidation.json` 与源任务记录，逐项核对任务、attempt、候选版本、候选哈希、原报告哈希以及登记文件的路径、大小和 SHA-256。派生索引位于 Git 忽略的本地数据目录；重复登记同一记录不会增加验证次数。

媒体接口只接受已登记的任务 ID、复验 ID 和媒体 ID。每次读取再次确认真实路径仍在该复验目录内，并复核大小及 SHA-256。未登记、跨任务、越界、缺失或已变化文件分别拒绝，不把整个 `.local` 暴露为静态目录。工具日志、模型会话、Cookie 和其他私有文件没有因此开放。

## Web 实际可见内容

- “候选版本与差异”：原始验证失败、两侧 `NOT_RUN`、原加载错误摘要，以及可展开的候选代码和完整哈希。
- “候选验证记录”：复验 ID、完成时间、候选版本、正常/反例切换、原始错误事实和完整关联信息。
- 截图：正常、反例各一张缩略图，点击后通过同一受控地址查看原图。
- 录像：正常、反例各一段，使用浏览器原生控件播放、暂停和拖动进度。
- Trace：正常、反例各一个受控下载入口。下载后在 `workbench` 目录运行 `node node_modules/@playwright/test/cli.js show-trace <trace.zip>` 本地查看；没有上传外部网站，也未在工作台内嵌 Trace Viewer。

本机查看时在 `workbench` 目录先运行 `npm run register:m2c-runtime-revalidation`，再设置 `WORKBENCH_DATA_DIR` 为 `.local/m2c-acceptance`、设置 `M2C_BUILD_AUTHORIZATION_ID` 为 `m2c-wait-fix-validation-20260921` 并执行 `npm start`。这些设置只选择现有数据目录和账本，不包含模型凭据，也不会自动启动 Harness。

脱敏页面证据：[m2c-existing-revalidation-media.png](evidence/m2c-existing-revalidation-media.png)。截图展示反例页的结果、截图、Trace 入口和原生视频控件；原始录像和 Trace 未提交 Git。

## 验证事实

| 命令 | 退出码 | 结果 |
|---|---:|---|
| `npm run register:m2c-runtime-revalidation`（连续两次） | 0 / 0 | 同一 ID 幂等登记，索引仍为一条 |
| `npm test`（workbench） | 0 | 47/47，通过；含精确关联、幂等、哈希不符、跨任务、Range、缺失和变化文件 |
| `npm test`（harness-probe） | 0 | 24/24，通过；独立子工程回归未受影响 |
| `npm run test:build-browser` | 0 | 原 M2-C 页面流通过 |
| `npm run test:m2c-runtime-fix-readback` | 0 | 不注入复验存储时，旧读回口径仍保持原历史不可见 |
| `npm run test:m2c-runtime-media-readback` | 0 | 使用本机已有复验完成真实 Chromium 展示、媒体和重启读回 |

真实 Chromium 核对结果：两张截图均实际解码；两段 WebM 均取得有效时长并实际播放、暂停及定位进度（正常 1.12 秒、反例 7.04 秒）；页面经历至少两次轮询后视频 DOM、暂停状态和进度保持；两个 Trace 下载内容的 SHA-256 与登记值一致；正常/反例切换没有串用媒体；服务重启后同一关联仍可读取。

源 `task.json` 和原 `revalidation.json` 接入前后 SHA-256 分别保持 `D7861CB5B309E719012A211A8EC210829F954FC53092A79FA37FFF2E7BCC14B3`、`4758A5E006D70C3CA10807E3A769F6ABA1D2E8A1485CB326C0BB309F17ECA623`。本批 Harness 启动 0 次、模型调用 0 次、候选业务执行 0 次。

## 未完成与边界

- Trace 仍需下载后本地打开，工作台没有内嵌 Trace Viewer。
- 当前只登记这一条既有合成探针复验，不是通用导入、数据库迁移、用例库或审批系统。
- 此结果不把原建例首轮改写为端到端通过，不表示候选已批准，也不验证复杂业务、自动修订或自愈。
