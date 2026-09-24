# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-24T09:41:30+08:00`
- Record: `REQ-0034-e2e01-caption-step-sync`
- Change fingerprint: `8a684675886cbcd2dc43b680f60d6fcf8b1ff9d8f06b0128c43f69b50a29f61e`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `npm test --prefix workbench`
- Exit code: `0`
- Test count: `96`
- Failure count: `0`
- Skipped count: `0`
- Log path: `workbench/.local/e2e01-step-replay-delivery.log`
- Log SHA-256: `3f7b2585f2084010b9d10a11ebb0b8235506391f037bb08fb41eea99879ff2aa`

### Git Status

```text
 M docs/modules/test-workbench.md
 M docs/requirements/README.md
 M docs/requirements/REQ-0034-e2e01-caption-step-sync/00_user_requirement.md
 M docs/requirements/REQ-0034-e2e01-caption-step-sync/01_development_requirement.md
 M docs/requirements/REQ-0034-e2e01-caption-step-sync/02_design.md
 M docs/requirements/REQ-0034-e2e01-caption-step-sync/03_tasks.md
 M docs/requirements/REQ-0034-e2e01-caption-step-sync/04_verification.md
 M docs/requirements/REQ-0034-e2e01-caption-step-sync/05_trace.md
 M docs/requirements/REQ-0034-e2e01-caption-step-sync/change_log.md
 M docs/requirements/REQ-0034-e2e01-caption-step-sync/current_state.md
 M docs/requirements/REQ-0034-e2e01-caption-step-sync/delivery_evidence.md
 M docs/requirements/REQ-0034-e2e01-caption-step-sync/requirement.source.json
 M harness-probe/src/verify-candidate.mjs
 M workbench/docs/E2E_01_CAPTION_SELF_TEST.md
 M workbench/docs/E2E_01_USER_GUIDE.md
 M workbench/tests/step-observer.integration.mjs
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/modules/test-workbench.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0034-e2e01-caption-step-sync/00_user_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0034-e2e01-caption-step-sync/01_development_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0034-e2e01-caption-step-sync/02_design.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0034-e2e01-caption-step-sync/03_tasks.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0034-e2e01-caption-step-sync/04_verification.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0034-e2e01-caption-step-sync/05_trace.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0034-e2e01-caption-step-sync/change_log.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0034-e2e01-caption-step-sync/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0034-e2e01-caption-step-sync/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0034-e2e01-caption-step-sync/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'harness-probe/src/verify-candidate.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/docs/E2E_01_CAPTION_SELF_TEST.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/docs/E2E_01_USER_GUIDE.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/tests/step-observer.integration.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/test-workbench.md                     |   2 +-
 docs/requirements/README.md                        |   2 +-
 .../00_user_requirement.md                         |   3 +-
 .../01_development_requirement.md                  |   4 +-
 .../REQ-0034-e2e01-caption-step-sync/02_design.md  |   2 +-
 .../REQ-0034-e2e01-caption-step-sync/03_tasks.md   |   4 +-
 .../04_verification.md                             |   4 +-
 .../REQ-0034-e2e01-caption-step-sync/05_trace.md   |   5 +-
 .../REQ-0034-e2e01-caption-step-sync/change_log.md |   1 +
 .../current_state.md                               |  18 +-
 .../delivery_evidence.md                           | 656 ++++++++++++++++++---
 .../requirement.source.json                        |  47 +-
 harness-probe/src/verify-candidate.mjs             |   5 +-
 workbench/docs/E2E_01_CAPTION_SELF_TEST.md         |  42 ++
 workbench/docs/E2E_01_USER_GUIDE.md                |  63 +-
 workbench/tests/step-observer.integration.mjs      |  19 +-
 16 files changed, 729 insertions(+), 148 deletions(-)
```

### Untracked Files

```text
(none)
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-24T09:41:11+08:00
Command: npm test --prefix workbench
Exit code: 0
Parsed test count: 96
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---

> ui-test-approved-workbench@0.1.0 test
> node --test tests/*.test.mjs

TAP version 13
# Subtest: state changes require exact local origin and JSON schema
ok 1 - state changes require exact local origin and JSON schema
  ---
  duration_ms: 62.8164
  type: 'test'
  ...
# Subtest: stop route accepts only an empty JSON object from local origin
ok 2 - stop route accepts only an empty JSON object from local origin
  ---
  duration_ms: 7.0074
  type: 'test'
  ...
# Subtest: build mutations require local origin and exact fixed schemas
ok 3 - build mutations require local origin and exact fixed schemas
  ---
  duration_ms: 116.2954
  type: 'test'
  ...
# Subtest: only registered web-visible unchanged task files are served
ok 4 - only registered web-visible unchanged task files are served
  ---
  duration_ms: 23.6981
  type: 'test'
  ...
# Subtest: only registered verification media are served with integrity and range checks
ok 5 - only registered verification media are served with integrity and range checks
  ---
  duration_ms: 42.5469
  type: 'test'
  ...
# Subtest: registers an idempotent derived assessment without rewriting the original task
ok 6 - registers an idempotent derived assessment without rewriting the original task
  ---
  duration_ms: 132.7378
  type: 'test'
  ...
# Subtest: rejects changed candidate or report identity and keeps a business gap out of human review
ok 7 - rejects changed candidate or report identity and keeps a business gap out of human review
  ---
  duration_ms: 148.3167
  type: 'test'
  ...
# Subtest: serves supplemental assessment beside the unchanged original failure
ok 8 - serves supplemental assessment beside the unchanged original failure
  ---
  duration_ms: 170.0761
  type: 'test'
  ...
# Subtest: Harness stderr diagnostic keeps error context and redacts credentials
ok 9 - Harness stderr diagnostic keeps error context and redacts credentials
  ---
  duration_ms: 2.4255
  type: 'test'
  ...
# Subtest: stored DSH credential is redacted even without a sk prefix
ok 10 - stored DSH credential is redacted even without a sk prefix
  ---
  duration_ms: 12.5462
  type: 'test'
  ...
# Subtest: failed candidate enables exactly one explicit revision and preserves both versions
ok 11 - failed candidate enables exactly one explicit revision and preserves both versions
  ---
  duration_ms: 321.7084
  type: 'test'
  ...
# Subtest: relative Harness patch resolves before task workspace changes
ok 12 - relative Harness patch resolves before task workspace changes
  ---
  duration_ms: 101.9563
  type: 'test'
  ...
# {"type":"build_storage_failure","code":"EIO","operation":"append_lifecycle","at":"2026-09-24T01:41:14.536Z"}
# Subtest: 生命周期存储持续失败会降级服务并拒绝继续接纳建例
ok 13 - 生命周期存储持续失败会降级服务并拒绝继续接纳建例
  ---
  duration_ms: 58.0479
  type: 'test'
  ...
# {"type":"build_storage_failure","code":"EIO","operation":"background_completion","at":"2026-09-24T01:41:14.625Z"}
# Subtest: 后台completion最终状态持续写失败会被观察并关闭新建例入口
ok 14 - 后台completion最终状态持续写失败会被观察并关闭新建例入口
  ---
  duration_ms: 85.8349
  type: 'test'
  ...
# Subtest: duplicate start is rejected and cancel closes the owned attempt without restart
ok 15 - duplicate start is rejected and cancel closes the owned attempt without restart
  ---
  duration_ms: 73.1358
  type: 'test'
  ...
# Subtest: 单次复验授权只在Harness进程启动事件时消耗且不改旧预算
ok 16 - 单次复验授权只在Harness进程启动事件时消耗且不改旧预算
  ---
  duration_ms: 152.3444
  type: 'test'
  ...
# Subtest: 终态等待修复验证使用独立固定授权文件且不改旧授权
ok 17 - 终态等待修复验证使用独立固定授权文件且不改旧授权
  ---
  duration_ms: 48.6305
  type: 'test'
  ...
# Subtest: candidate report parser keeps normal pass and concrete assertion mismatch separate
ok 18 - candidate report parser keeps normal pass and concrete assertion mismatch separate
  ---
  duration_ms: 26.564
  type: 'test'
  ...
# Subtest: missing report and locator errors cannot become technical pass or specified mismatch
ok 19 - missing report and locator errors cannot become technical pass or specified mismatch
  ---
  duration_ms: 14.7767
  type: 'test'
  ...
# Subtest: Playwright array text diff preserves the expected and actual row order at the failed step
ok 20 - Playwright array text diff preserves the expected and actual row order at the failed step
  ---
  duration_ms: 16.4174
  type: 'test'
  ...
# Subtest: versioned step title rule accepts only bare or explicitly separated leading markers
ok 21 - versioned step title rule accepts only bare or explicitly separated leading markers
  ---
  duration_ms: 0.9578
  type: 'test'
  ...
# Subtest: step mapping distinguishes 1 from 10 and rejects duplicate missing malformed and out-of-order markers
ok 22 - step mapping distinguishes 1 from 10 and rejects duplicate missing malformed and out-of-order markers
  ---
  duration_ms: 2.9281
  type: 'test'
  ...
# Subtest: nested assertion error is attributed to its business step and another step cannot satisfy the counterexample
ok 23 - nested assertion error is attributed to its business step and another step cannot satisfy the counterexample
  ---
  duration_ms: 0.8203
  type: 'test'
  ...
# Subtest: steps after the attributed failure remain not executed without hiding the specified mismatch
ok 24 - steps after the attributed failure remain not executed without hiding the specified mismatch
  ---
  duration_ms: 0.4863
  type: 'test'
  ...
# Subtest: parser preserves raw title hierarchy raw error and expected actual facts
ok 25 - parser preserves raw title hierarchy raw error and expected actual facts
  ---
  duration_ms: 19.3073
  type: 'test'
  ...
# Subtest: associates exact task candidate and registers the same record idempotently
ok 26 - associates exact task candidate and registers the same record idempotently
  ---
  duration_ms: 148.6923
  type: 'test'
  ...
# Subtest: rejects candidate hash mismatch and does not associate media across tasks
ok 27 - rejects candidate hash mismatch and does not associate media across tasks
  ---
  duration_ms: 228.486
  type: 'test'
  ...
# Subtest: serves only registered unchanged media with byte ranges
ok 28 - serves only registered unchanged media with byte ranges
  ---
  duration_ms: 316.206
  type: 'test'
  ...
# Subtest: M2-C stage budget persists across task ids and store restarts
ok 29 - M2-C stage budget persists across task ids and store restarts
  ---
  duration_ms: 32.4246
  type: 'test'
  ...
# Subtest: restart marks active build interrupted without replaying it
ok 30 - restart marks active build interrupted without replaying it
  ---
  duration_ms: 43.7683
  type: 'test'
  ...
# Subtest: task状态原子替换的短暂占用有限重试后成功
ok 31 - task状态原子替换的短暂占用有限重试后成功
  ---
  duration_ms: 137.2928
  type: 'test'
  ...
# Subtest: task状态持续写失败会显式返回错误而非静默成功
ok 32 - task状态持续写失败会显式返回错误而非静默成功
  ---
  duration_ms: 697.3011
  type: 'test'
  ...
# Subtest: 协调进程被终止后重启保留逐事件记录、标中断且不重放预算
ok 33 - 协调进程被终止后重启保留逐事件记录、标中断且不重放预算
  ---
  duration_ms: 1108.7315
  type: 'test'
  ...
# Subtest: case library API requires local origin and serves only registered operations
ok 34 - case library API requires local origin and serves only registered operations
  ---
  duration_ms: 200.9589
  type: 'test'
  ...
# Subtest: real xlsx and native package round trip preserve fields, lineage and project isolation
ok 35 - real xlsx and native package round trip preserve fields, lineage and project isolation
  ---
  duration_ms: 640.8977
  type: 'test'
  ...
# Subtest: formula cells and stale or cross-project confirmations fail closed
ok 36 - formula cells and stale or cross-project confirmations fail closed
  ---
  duration_ms: 185.5766
  type: 'test'
  ...
# Subtest: E2E-01 recovery adds one start while retaining all six original claims
ok 37 - E2E-01 recovery adds one start while retaining all six original claims
  ---
  duration_ms: 171.0772
  type: 'test'
  ...
# Subtest: static or visually repeated frames cannot be used as a unique video clock anchor
ok 38 - static or visually repeated frames cannot be used as a unique video clock anchor
  ---
  duration_ms: 1.6853
  type: 'test'
  ...
# Subtest: trace-derived timeline preserves source timing and unexecuted step
ok 39 - trace-derived timeline preserves source timing and unexecuted step
  ---
  duration_ms: 29.0107
  type: 'test'
  ...
# Subtest: missing or uncalibrated trace never invents a seek timeline
ok 40 - missing or uncalibrated trace never invents a seek timeline
  ---
  duration_ms: 14.1409
  type: 'test'
  ...
# Subtest: derived WebM duration is explicit and invalid media fails closed
ok 41 - derived WebM duration is explicit and invalid media fails closed
  ---
  duration_ms: 3.3198
  type: 'test'
  ...
# Subtest: versioned derived caption video is indexed as caption media without replacing v1
ok 42 - versioned derived caption video is indexed as caption media without replacing v1
  ---
  duration_ms: 97.6478
  type: 'test'
  ...
# Subtest: step replay, source screenshots and observer record are independently indexed
ok 43 - step replay, source screenshots and observer record are independently indexed
  ---
  duration_ms: 118.2891
  type: 'test'
  ...
# Subtest: E2E-01 reaches human review only after a passing normal run and the specified raw failure
ok 44 - E2E-01 reaches human review only after a passing normal run and the specified raw failure
  ---
  duration_ms: 1.9032
  type: 'test'
  ...
# Subtest: new trial readiness requires execution-time replay and four registered media for both lanes
ok 45 - new trial readiness requires execution-time replay and four registered media for both lanes
  ---
  duration_ms: 0.6637
  type: 'test'
  ...
# Subtest: real xlsx preserves numeric-looking text, physical rows and blank columns
ok 46 - real xlsx preserves numeric-looking text, physical rows and blank columns
  ---
  duration_ms: 109.3248
  type: 'test'
  ...
# Subtest: real xlsx keeps step and expected cell-line positions instead of compacting blanks
ok 47 - real xlsx keeps step and expected cell-line positions instead of compacting blanks
  ---
  duration_ms: 19.5305
  type: 'test'
  ...
# Subtest: approved run uses fixed argument arrays and a reduced environment
ok 48 - approved run uses fixed argument arrays and a reduced environment
  ---
  duration_ms: 246.7707
  type: 'test'
  ...
# Subtest: duplicate starts are rejected and stop targets only the owned process
ok 49 - duplicate starts are rejected and stop targets only the owned process
  ---
  duration_ms: 186.2901
  type: 'test'
  ...
# Subtest: unapproved, wrong-hash, traversal and illegal environment records are refused
ok 50 - unapproved, wrong-hash, traversal and illegal environment records are refused
  ---
  duration_ms: 419.5212
  type: 'test'
  ...
# Subtest: runtime-copy integrity failure preserves the raw passing report but blocks overall pass
ok 51 - runtime-copy integrity failure preserves the raw passing report but blocks overall pass
  ---
  duration_ms: 149.5889
  type: 'test'
  ...
# Subtest: 限定首审资产使用PROBE_URL且正常入口不能越权运行受控反例
ok 52 - 限定首审资产使用PROBE_URL且正常入口不能越权运行受控反例
  ---
  duration_ms: 298.8332
  type: 'test'
  ...
# Subtest: HOLD-Q1 原生包可逆保留完整原用例并通过真实导入预览确认
ok 53 - HOLD-Q1 原生包可逆保留完整原用例并通过真实导入预览确认
  ---
  duration_ms: 88.6564
  type: 'test'
  ...
# Subtest: M4-A flash复验使用独立单次授权和显式已登录DSH运行配置
ok 54 - M4-A flash复验使用独立单次授权和显式已登录DSH运行配置
  ---
  duration_ms: 263.1187
  type: 'test'
  ...
# Subtest: M4-A生产组装仅向Harness传递正常输入并由控制器执行冻结q1/q2
ok 55 - M4-A生产组装仅向Harness传递正常输入并由控制器执行冻结q1/q2
  ---
  duration_ms: 364.3681
  type: 'test'
  ...
# Subtest: HOLD-Q1环境拒绝内容哈希不匹配且不创建任务或消耗授权
ok 56 - HOLD-Q1环境拒绝内容哈希不匹配且不创建任务或消耗授权
  ---
  duration_ms: 222.6451
  type: 'test'
  ...
# Subtest: M4-A仅在正常页失败时允许一次定向修订并在两次启动后耗尽
ok 57 - M4-A仅在正常页失败时允许一次定向修订并在两次启动后耗尽
  ---
  duration_ms: 360.5115
  type: 'test'
  ...
# Subtest: only indexed media for the selected run can be read
ok 58 - only indexed media for the selected run can be read
  ---
  duration_ms: 191.0544
  type: 'test'
  ...
# Subtest: changed media bytes are not served as the registered attachment
ok 59 - changed media bytes are not served as the registered attachment
  ---
  duration_ms: 7.7069
  type: 'test'
  ...
# Subtest: 真实 Excel 用例完整冻结为既有 build task，且不启动 Harness 或消耗预算
ok 60 - 真实 Excel 用例完整冻结为既有 build task，且不启动 Harness 或消耗预算
  ---
  duration_ms: 304.1239
  type: 'test'
  ...
# Subtest: v1/v2 快照独立，精确关联校验和并发幂等均 fail closed
ok 61 - v1/v2 快照独立，精确关联校验和并发幂等均 fail closed
  ---
  duration_ms: 525.1148
  type: 'test'
  ...
# Subtest: request_id 同时绑定五项请求身份，顺序、重启幂等且身份变化明确冲突
ok 62 - request_id 同时绑定五项请求身份，顺序、重启幂等且身份变化明确冲突
  ---
  duration_ms: 163.0504
  type: 'test'
  ...
# Subtest: request_id 正在处理时只复用相同身份，不同身份立即冲突
ok 63 - request_id 正在处理时只复用相同身份，不同身份立即冲突
  ---
  duration_ms: 131.189
  type: 'test'
  ...
# Subtest: 旧任务从 source 和 environment_ref 推导身份，身份不完整时拒绝复用
ok 64 - 旧任务从 source 和 environment_ref 推导身份，身份不完整时拒绝复用
  ---
  duration_ms: 141.4508
  type: 'test'
  ...
# Subtest: M3-B2生产接线把冻结输入和渲染指令送入attempt并按作用域只消费一次授权
ok 65 - M3-B2生产接线把冻结输入和渲染指令送入attempt并按作用域只消费一次授权
  ---
  duration_ms: 1026.4985
  type: 'test'
  ...
# Subtest: 两个验证侧哨兵仅进入控制器契约且合法业务原文不被字符串清洗
ok 66 - 两个验证侧哨兵仅进入控制器契约且合法业务原文不被字符串清洗
  ---
  duration_ms: 1.7045
  type: 'test'
  ...
# Subtest: M3-B2作用域冲突不创建第二任务且历史INPUT_ONLY仍不可启动
ok 67 - M3-B2作用域冲突不创建第二任务且历史INPUT_ONLY仍不可启动
  ---
  duration_ms: 180.4136
  type: 'test'
  ...
# Subtest: approved sorting asset is derived from the real frozen records
ok 68 - approved sorting asset is derived from the real frozen records
  ---
  duration_ms: 24.2244
  type: 'test'
  ...
# Subtest: hash mismatch is rejected instead of becoming a new approval
ok 69 - hash mismatch is rejected instead of becoming a new approval
  ---
  duration_ms: 10.3219
  type: 'test'
  ...
# Subtest: complete passing report requires all registered steps and all media kinds
ok 70 - complete passing report requires all registered steps and all media kinds
  ---
  duration_ms: 47.6331
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when all media are missing
ok 71 - raw passing result is not an overall pass when all media are missing
  ---
  duration_ms: 22.8188
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when screenshot is missing
ok 72 - raw passing result is not an overall pass when screenshot is missing
  ---
  duration_ms: 33.7881
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when video is missing
ok 73 - raw passing result is not an overall pass when video is missing
  ---
  duration_ms: 20.6118
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when trace is missing
ok 74 - raw passing result is not an overall pass when trace is missing
  ---
  duration_ms: 19.2794
  type: 'test'
  ...
# Subtest: assertion mismatch remains a failed test and later steps are not executed
ok 75 - assertion mismatch remains a failed test and later steps are not executed
  ---
  duration_ms: 27.1772
  type: 'test'
  ...
# Subtest: missing, corrupt, skipped and zero-target reports fail closed
ok 76 - missing, corrupt, skipped and zero-target reports fail closed
  ---
  duration_ms: 28.7818
  type: 'test'
  ...
# Subtest: exit code zero cannot override an incomplete step set
ok 77 - exit code zero cannot override an incomplete step set
  ---
  duration_ms: 6.9787
  type: 'test'
  ...
# Subtest: a passing Playwright report cannot override a non-normal execution terminal state
ok 78 - a passing Playwright report cannot override a non-normal execution terminal state
  ---
  duration_ms: 140.1284
  type: 'test'
  ...
# Subtest: error facts distinguish missing targets, strict conflicts, unavailable values and real value mismatches
ok 79 - error facts distinguish missing targets, strict conflicts, unavailable values and real value mismatches
  ---
  duration_ms: 1.736
  type: 'test'
  ...
# Subtest: 复验驱动只等待本次task终态，不被旧历史终态提前满足
ok 80 - 复验驱动只等待本次task终态，不被旧历史终态提前满足
  ---
  duration_ms: 1729.2157
  type: 'test'
  ...
# Subtest: 原扫描任意历史卡片逻辑无法通过同一task终态等待断言
ok 81 - 原扫描任意历史卡片逻辑无法通过同一task终态等待断言
  ---
  duration_ms: 949.7211
  type: 'test'
  ...
# Subtest: 项目用例新版本不会自动继承旧版本的限定首审资产
ok 82 - 项目用例新版本不会自动继承旧版本的限定首审资产
  ---
  duration_ms: 2204.3871
  type: 'test'
  ...
# Subtest: 限定人工首审资产按精确任务、候选和用例版本登记并幂等保存原字节
ok 83 - 限定人工首审资产按精确任务、候选和用例版本登记并幂等保存原字节
  ---
  duration_ms: 128.6149
  type: 'test'
  ...
# Subtest: 缺少有效首审、候选哈希变化或项目关联错误均拒绝登记
ok 84 - 缺少有效首审、候选哈希变化或项目关联错误均拒绝登记
  ---
  duration_ms: 136.3836
  type: 'test'
  ...
# Subtest: health endpoint reports the independent workbench
ok 85 - health endpoint reports the independent workbench
  ---
  duration_ms: 68.6169
  type: 'test'
  ...
# Subtest: unknown routes fail closed
ok 86 - unknown routes fail closed
  ---
  duration_ms: 18.6468
  type: 'test'
  ...
# Subtest: asset registration is persistent and idempotent
ok 87 - asset registration is persistent and idempotent
  ---
  duration_ms: 66.7412
  type: 'test'
  ...
# Subtest: runs remain readable and active records become interrupted after restart
ok 88 - runs remain readable and active records become interrupted after restart
  ---
  duration_ms: 49.3523
  type: 'test'
  ...
# Subtest: run ids cannot escape the data root
ok 89 - run ids cannot escape the data root
  ---
  duration_ms: 17.7469
  type: 'test'
  ...
# Subtest: workspace entry is a same-origin whitelist and old workbench remains available
ok 90 - workspace entry is a same-origin whitelist and old workbench remains available
  ---
  duration_ms: 173.6236
  type: 'test'
  ...
# Subtest: UI-D2A xlsx samples preserve exact source text and classifications through real parser
ok 91 - UI-D2A xlsx samples preserve exact source text and classifications through real parser
  ---
  duration_ms: 397.0706
  type: 'test'
  ...
# Subtest: committed native sample came from supported export schema and survives official import parser
ok 92 - committed native sample came from supported export schema and survives official import parser
  ---
  duration_ms: 56.4492
  type: 'test'
  ...
# Subtest: six-case xlsx uses the supported mapping and preserves paired business expectations
ok 93 - six-case xlsx uses the supported mapping and preserves paired business expectations
  ---
  duration_ms: 240.067
  type: 'test'
  ...
# Subtest: committed six-case json is a formal backend package and reimports all six cases
ok 94 - committed six-case json is a formal backend package and reimports all six cases
  ---
  duration_ms: 171.0726
  type: 'test'
  ...
# Subtest: workbench候选使用同一Playwright运行根并真实执行正常与反例
ok 95 - workbench候选使用同一Playwright运行根并真实执行正常与反例
  ---
  duration_ms: 12036.4432
  type: 'test'
  ...
# Subtest: harness-probe默认运行根保持独立可执行
ok 96 - harness-probe默认运行根保持独立可执行
  ---
  duration_ms: 2882.5393
  type: 'test'
  ...
1..96
# tests 96
# suites 0
# pass 96
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 16901.6742
```

### Sync Record Status

```text
DRY-RUN: no derived changes for REQ-0034-e2e01-caption-step-sync; explicit implementation states retained, never inferred from verification.
```

### Check AI Context

- Exit code: `0`

```text
PASS ai-engineering-context checks
```

### Notes

六条产品结果与浏览器解码核对见 workbench/docs/E2E_01_CAPTION_SELF_TEST.md；工程测试不替代产品验收。
