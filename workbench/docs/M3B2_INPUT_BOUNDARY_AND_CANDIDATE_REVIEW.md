# M3-B2 建例输入边界修订与既有候选首审依据

日期：2026-09-21

分支：`codex/test-workbench-m3b2-project-case-run`

基线：`050b3622a71b1104d37747f9060675ed40de0730`

## 修订结论

新创建的项目用例任务已把“模型需要读取的建例输入”和“仅供工作台验证器使用的反例契约”按字段职责分开：

- `input/case-snapshot.json` 使用 `workbench/project-case-build-input-v2`，只保存冻结用例、来源版本、正常环境引用、正常业务预期、步骤标记和候选交付要求；
- `task.md` 逐步保留动作、预期和 `CASE_STEP_<order>` 标记；实际渲染的 Agent 指令只说明允许入口、输入文件和输出位置；
- `verification_contract` 仅保存在工作台控制器的 `input_bundle`，不写入上述三项模型输入或 attempt 中的其他初始文件；
- 两个仅验证侧使用的合成哨兵值产生相同的模型快照和 `task.md` 哈希，而控制器仍分别取得对应契约；业务正文中合法出现的 `PROBE-41` 保持原样，未使用字符串清洗。

这只是应用层资料职责分离，不是操作系统级文件或网络隔离。本批 Harness 启动 0 次、模型调用 0 次、业务用例重跑 0 次，也没有新增授权或消耗历史额度。

## 历史任务边界

历史真实任务 `build-20260921120911-48d7c545`、attempt `attempt-01-initial`、候选、报告、媒体和授权记录均保持原字节。只读核查确认其旧版模型可读快照 SHA-256 为：

`47404170FF54020D2FF960253A1220A36BAE32E9FAD5898AB7B5FFD14573E56E`

该旧快照确实包含 `verification_contract.counterexample_actual=PROBE-41`。因此，历史运行仍能证明正常页面 1 条测试通过、反例页面 1 条测试发生 `PROBE-42`/`PROBE-41` 断言不符，但**不能**证明反例设计曾对建例器保密。新 v2 边界只对以后创建的新快照生效，不追溯改写旧任务，也不伪造业务内容版本变化。

## 既有候选只读首审

本机候选存在，实测 SHA-256 与指定值一致：

`4B183AD25305913547C309A86F273DAAB861004313385A5DEF3094385F3B0730`

| 冻结要求 | 候选代码位置 | 已有运行证据 | 首审判断 / 未确定项 |
|---|---|---|---|
| 进入受控入口 | 第 4 行 `page.goto(process.env.PROBE_URL)` | 正常和反例各实际执行 1 条测试 | 使用环境变量，未发现 URL、路由后缀或反例地址特判 |
| 第 1 步确认“执行探针交互”按钮可见 | 第 6–11 行；`CASE_STEP_1` 内按按钮 role/name 定位并 `toBeVisible()` | 正常报告观察到 `CASE_STEP_1` | 动作和断言处于正确步骤，标记不是空壳 |
| 第 2 步点击按钮 | 第 13–18 行；`CASE_STEP_2` 内点击同一 role/name 按钮 | 正常报告观察到 `CASE_STEP_2` | 点击对象与冻结动作一致 |
| 第 2 步输出显示 `PROBE-42` | 第 16–17 行；对 role `status` 执行 `toHaveText('PROBE-42')` | 正常 1 `PASSED`；反例 1 `FAILED`，Expected `PROBE-42` / Received `PROBE-41` | 检查正确输出对象及正常预期；未发现 `PROBE-41` 特判 |
| 不删断言、不吞异常、不跳过 | 第 1–19 行完整只读扫描 | Playwright 原始断言错误保留 | 未发现 `try/catch`、条件放行、`skip` 或无断言步骤 |

这是 AI 的静态技术首审与既有执行证据整理，不是真人批准。由于历史生成输入已经暴露反例值，本候选不能用于验证“未知反例下的生成能力”；候选状态继续保持“技术验证通过，等待人工核对”，尚未批准。

## 零模型工程验证

| 验证 | 实际结果 |
|---|---|
| 定向生产组装、attempt 文件、INPUT_ONLY、请求身份、版本快照与授权回归 | `node --test tests/project-case-build-input.test.mjs tests/project-case-build-run.test.mjs tests/build-api.test.mjs tests/build-store.test.mjs`，16/16 通过，退出码 0 |
| 完整 workbench 工程回归 | `npm --prefix workbench test`，61/61 通过，失败 0、跳过 0、退出码 0 |
| 历史候选和任务只读核查 | 候选哈希匹配；旧快照仍包含历史反例字段；任务仍为 `WAITING_HUMAN_REVIEW`，未被新代码迁移或覆盖 |

测试中的捕获适配器只用于零模型工程验证，不代表 Harness 接收或执行了新格式。新 v2 输入是否被真实 Harness 使用，仍需未来另行明确授权后验证；本批不做该调用。
