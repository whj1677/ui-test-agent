# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-23T11:17:17+08:00`
- Record: `REQ-0033-e2e-01-six-case-workbench`
- Change fingerprint: `944a0868b29d358ad23e4dde03fdc45906d4069eacce5df86ce85992bf8602fe`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `npm --prefix workbench test`
- Exit code: `0`
- Test count: `89`
- Failure count: `0`
- Skipped count: `0`
- Log path: `artifacts/e2e01-final-workbench-tests.log`
- Log SHA-256: `c51a8011ebf8f727657fd457b039eb2809db61d7a3004633e8ed2f48699adcf6`

### Git Status

```text
 M docs/requirements/REQ-0033-e2e-01-six-case-workbench/00_user_requirement.md
 M docs/requirements/REQ-0033-e2e-01-six-case-workbench/01_development_requirement.md
 M docs/requirements/REQ-0033-e2e-01-six-case-workbench/02_design.md
 M docs/requirements/REQ-0033-e2e-01-six-case-workbench/03_tasks.md
 M docs/requirements/REQ-0033-e2e-01-six-case-workbench/04_verification.md
 M docs/requirements/REQ-0033-e2e-01-six-case-workbench/05_trace.md
 M docs/requirements/REQ-0033-e2e-01-six-case-workbench/change_log.md
 M docs/requirements/REQ-0033-e2e-01-six-case-workbench/current_state.md
 M docs/requirements/REQ-0033-e2e-01-six-case-workbench/delivery_evidence.md
 M docs/requirements/REQ-0033-e2e-01-six-case-workbench/requirement.source.json
 M workbench/docs/E2E_01_ACCEPTANCE_REPORT.md
 M workbench/docs/E2E_01_USER_GUIDE.md
 M workbench/server/build/manager.mjs
 M workbench/server/build/store.mjs
 M workbench/server/report.mjs
 M workbench/tests/build-manager.test.mjs
 M workbench/tests/build-report.test.mjs
?? artifacts/e2e01-final-workbench-tests.log
?? workbench/server/build/diagnostic.mjs
?? workbench/tests/build-diagnostic.test.mjs
?? workbench/tests/e2e01-authorization-recovery.test.mjs
?? workbench/tests/e2e01-trial-readiness.test.mjs
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/requirements/REQ-0033-e2e-01-six-case-workbench/00_user_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0033-e2e-01-six-case-workbench/01_development_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0033-e2e-01-six-case-workbench/02_design.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0033-e2e-01-six-case-workbench/03_tasks.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0033-e2e-01-six-case-workbench/04_verification.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0033-e2e-01-six-case-workbench/05_trace.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0033-e2e-01-six-case-workbench/change_log.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0033-e2e-01-six-case-workbench/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0033-e2e-01-six-case-workbench/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0033-e2e-01-six-case-workbench/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/docs/E2E_01_ACCEPTANCE_REPORT.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/docs/E2E_01_USER_GUIDE.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/manager.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/store.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/report.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/tests/build-manager.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/tests/build-report.test.mjs', LF will be replaced by CRLF the next time Git touches it
 .../00_user_requirement.md                         |  13 +-
 .../01_development_requirement.md                  |   2 +-
 .../02_design.md                                   |   2 +-
 .../REQ-0033-e2e-01-six-case-workbench/03_tasks.md |   2 +-
 .../04_verification.md                             |   4 +-
 .../REQ-0033-e2e-01-six-case-workbench/05_trace.md |   3 +-
 .../change_log.md                                  |   1 +
 .../current_state.md                               |  12 +-
 .../delivery_evidence.md                           | 487 +++++++++++----------
 .../requirement.source.json                        |  39 +-
 workbench/docs/E2E_01_ACCEPTANCE_REPORT.md         |  58 +--
 workbench/docs/E2E_01_USER_GUIDE.md                |  62 +--
 workbench/server/build/manager.mjs                 |  52 ++-
 workbench/server/build/store.mjs                   |  26 +-
 workbench/server/report.mjs                        |  31 +-
 workbench/tests/build-manager.test.mjs             |  22 +-
 workbench/tests/build-report.test.mjs              |  28 ++
 17 files changed, 511 insertions(+), 333 deletions(-)
```

### Untracked Files

```text
artifacts/e2e01-final-workbench-tests.log
workbench/server/build/diagnostic.mjs
workbench/tests/build-diagnostic.test.mjs
workbench/tests/e2e01-authorization-recovery.test.mjs
workbench/tests/e2e01-trial-readiness.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-23T11:17:00+08:00
Command: npm --prefix workbench test
Exit code: 0
Parsed test count: 89
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---

> ui-test-approved-workbench@0.1.0 test
> node --test tests/*.test.mjs

TAP version 13
# Subtest: state changes require exact local origin and JSON schema
ok 1 - state changes require exact local origin and JSON schema
  ---
  duration_ms: 56.2313
  type: 'test'
  ...
# Subtest: stop route accepts only an empty JSON object from local origin
ok 2 - stop route accepts only an empty JSON object from local origin
  ---
  duration_ms: 5.8262
  type: 'test'
  ...
# Subtest: build mutations require local origin and exact fixed schemas
ok 3 - build mutations require local origin and exact fixed schemas
  ---
  duration_ms: 129.7445
  type: 'test'
  ...
# Subtest: only registered web-visible unchanged task files are served
ok 4 - only registered web-visible unchanged task files are served
  ---
  duration_ms: 28.4817
  type: 'test'
  ...
# Subtest: only registered verification media are served with integrity and range checks
ok 5 - only registered verification media are served with integrity and range checks
  ---
  duration_ms: 35.8389
  type: 'test'
  ...
# Subtest: registers an idempotent derived assessment without rewriting the original task
ok 6 - registers an idempotent derived assessment without rewriting the original task
  ---
  duration_ms: 132.8999
  type: 'test'
  ...
# Subtest: rejects changed candidate or report identity and keeps a business gap out of human review
ok 7 - rejects changed candidate or report identity and keeps a business gap out of human review
  ---
  duration_ms: 151.2223
  type: 'test'
  ...
# Subtest: serves supplemental assessment beside the unchanged original failure
ok 8 - serves supplemental assessment beside the unchanged original failure
  ---
  duration_ms: 227.1015
  type: 'test'
  ...
# Subtest: Harness stderr diagnostic keeps error context and redacts credentials
ok 9 - Harness stderr diagnostic keeps error context and redacts credentials
  ---
  duration_ms: 2.4516
  type: 'test'
  ...
# Subtest: stored DSH credential is redacted even without a sk prefix
ok 10 - stored DSH credential is redacted even without a sk prefix
  ---
  duration_ms: 12.4251
  type: 'test'
  ...
# Subtest: failed candidate enables exactly one explicit revision and preserves both versions
ok 11 - failed candidate enables exactly one explicit revision and preserves both versions
  ---
  duration_ms: 567.8877
  type: 'test'
  ...
# Subtest: relative Harness patch resolves before task workspace changes
ok 12 - relative Harness patch resolves before task workspace changes
  ---
  duration_ms: 149.4425
  type: 'test'
  ...
# {"type":"build_storage_failure","code":"EIO","operation":"append_lifecycle","at":"2026-09-23T03:17:02.591Z"}
# Subtest: 生命周期存储持续失败会降级服务并拒绝继续接纳建例
ok 13 - 生命周期存储持续失败会降级服务并拒绝继续接纳建例
  ---
  duration_ms: 57.3924
  type: 'test'
  ...
# {"type":"build_storage_failure","code":"EIO","operation":"background_completion","at":"2026-09-23T03:17:02.670Z"}
# Subtest: 后台completion最终状态持续写失败会被观察并关闭新建例入口
ok 14 - 后台completion最终状态持续写失败会被观察并关闭新建例入口
  ---
  duration_ms: 74.8533
  type: 'test'
  ...
# Subtest: duplicate start is rejected and cancel closes the owned attempt without restart
ok 15 - duplicate start is rejected and cancel closes the owned attempt without restart
  ---
  duration_ms: 56.4871
  type: 'test'
  ...
# Subtest: 单次复验授权只在Harness进程启动事件时消耗且不改旧预算
ok 16 - 单次复验授权只在Harness进程启动事件时消耗且不改旧预算
  ---
  duration_ms: 113.127
  type: 'test'
  ...
# Subtest: 终态等待修复验证使用独立固定授权文件且不改旧授权
ok 17 - 终态等待修复验证使用独立固定授权文件且不改旧授权
  ---
  duration_ms: 39.2608
  type: 'test'
  ...
# Subtest: candidate report parser keeps normal pass and concrete assertion mismatch separate
ok 18 - candidate report parser keeps normal pass and concrete assertion mismatch separate
  ---
  duration_ms: 16.6047
  type: 'test'
  ...
# Subtest: missing report and locator errors cannot become technical pass or specified mismatch
ok 19 - missing report and locator errors cannot become technical pass or specified mismatch
  ---
  duration_ms: 10.8852
  type: 'test'
  ...
# Subtest: Playwright array text diff preserves the expected and actual row order at the failed step
ok 20 - Playwright array text diff preserves the expected and actual row order at the failed step
  ---
  duration_ms: 7.9298
  type: 'test'
  ...
# Subtest: versioned step title rule accepts only bare or explicitly separated leading markers
ok 21 - versioned step title rule accepts only bare or explicitly separated leading markers
  ---
  duration_ms: 0.6627
  type: 'test'
  ...
# Subtest: step mapping distinguishes 1 from 10 and rejects duplicate missing malformed and out-of-order markers
ok 22 - step mapping distinguishes 1 from 10 and rejects duplicate missing malformed and out-of-order markers
  ---
  duration_ms: 1.0947
  type: 'test'
  ...
# Subtest: nested assertion error is attributed to its business step and another step cannot satisfy the counterexample
ok 23 - nested assertion error is attributed to its business step and another step cannot satisfy the counterexample
  ---
  duration_ms: 0.6689
  type: 'test'
  ...
# Subtest: steps after the attributed failure remain not executed without hiding the specified mismatch
ok 24 - steps after the attributed failure remain not executed without hiding the specified mismatch
  ---
  duration_ms: 0.4003
  type: 'test'
  ...
# Subtest: parser preserves raw title hierarchy raw error and expected actual facts
ok 25 - parser preserves raw title hierarchy raw error and expected actual facts
  ---
  duration_ms: 9.732
  type: 'test'
  ...
# Subtest: associates exact task candidate and registers the same record idempotently
ok 26 - associates exact task candidate and registers the same record idempotently
  ---
  duration_ms: 108.8808
  type: 'test'
  ...
# Subtest: rejects candidate hash mismatch and does not associate media across tasks
ok 27 - rejects candidate hash mismatch and does not associate media across tasks
  ---
  duration_ms: 108.6607
  type: 'test'
  ...
# Subtest: serves only registered unchanged media with byte ranges
ok 28 - serves only registered unchanged media with byte ranges
  ---
  duration_ms: 259.5406
  type: 'test'
  ...
# Subtest: M2-C stage budget persists across task ids and store restarts
ok 29 - M2-C stage budget persists across task ids and store restarts
  ---
  duration_ms: 38.342
  type: 'test'
  ...
# Subtest: restart marks active build interrupted without replaying it
ok 30 - restart marks active build interrupted without replaying it
  ---
  duration_ms: 71.5705
  type: 'test'
  ...
# Subtest: task状态原子替换的短暂占用有限重试后成功
ok 31 - task状态原子替换的短暂占用有限重试后成功
  ---
  duration_ms: 111.0564
  type: 'test'
  ...
# Subtest: task状态持续写失败会显式返回错误而非静默成功
ok 32 - task状态持续写失败会显式返回错误而非静默成功
  ---
  duration_ms: 692.2384
  type: 'test'
  ...
# Subtest: 协调进程被终止后重启保留逐事件记录、标中断且不重放预算
ok 33 - 协调进程被终止后重启保留逐事件记录、标中断且不重放预算
  ---
  duration_ms: 1061.0404
  type: 'test'
  ...
# Subtest: case library API requires local origin and serves only registered operations
ok 34 - case library API requires local origin and serves only registered operations
  ---
  duration_ms: 141.4094
  type: 'test'
  ...
# Subtest: real xlsx and native package round trip preserve fields, lineage and project isolation
ok 35 - real xlsx and native package round trip preserve fields, lineage and project isolation
  ---
  duration_ms: 590.7474
  type: 'test'
  ...
# Subtest: formula cells and stale or cross-project confirmations fail closed
ok 36 - formula cells and stale or cross-project confirmations fail closed
  ---
  duration_ms: 151.7153
  type: 'test'
  ...
# Subtest: E2E-01 recovery adds one start while retaining all six original claims
ok 37 - E2E-01 recovery adds one start while retaining all six original claims
  ---
  duration_ms: 123.2418
  type: 'test'
  ...
# Subtest: E2E-01 reaches human review only after a passing normal run and the specified raw failure
ok 38 - E2E-01 reaches human review only after a passing normal run and the specified raw failure
  ---
  duration_ms: 1.5387
  type: 'test'
  ...
# Subtest: real xlsx preserves numeric-looking text, physical rows and blank columns
ok 39 - real xlsx preserves numeric-looking text, physical rows and blank columns
  ---
  duration_ms: 99.98
  type: 'test'
  ...
# Subtest: real xlsx keeps step and expected cell-line positions instead of compacting blanks
ok 40 - real xlsx keeps step and expected cell-line positions instead of compacting blanks
  ---
  duration_ms: 32.6044
  type: 'test'
  ...
# Subtest: approved run uses fixed argument arrays and a reduced environment
ok 41 - approved run uses fixed argument arrays and a reduced environment
  ---
  duration_ms: 189.4247
  type: 'test'
  ...
# Subtest: duplicate starts are rejected and stop targets only the owned process
ok 42 - duplicate starts are rejected and stop targets only the owned process
  ---
  duration_ms: 154.5967
  type: 'test'
  ...
# Subtest: unapproved, wrong-hash, traversal and illegal environment records are refused
ok 43 - unapproved, wrong-hash, traversal and illegal environment records are refused
  ---
  duration_ms: 271.1974
  type: 'test'
  ...
# Subtest: runtime-copy integrity failure preserves the raw passing report but blocks overall pass
ok 44 - runtime-copy integrity failure preserves the raw passing report but blocks overall pass
  ---
  duration_ms: 182.8543
  type: 'test'
  ...
# Subtest: 限定首审资产使用PROBE_URL且正常入口不能越权运行受控反例
ok 45 - 限定首审资产使用PROBE_URL且正常入口不能越权运行受控反例
  ---
  duration_ms: 295.7447
  type: 'test'
  ...
# Subtest: HOLD-Q1 原生包可逆保留完整原用例并通过真实导入预览确认
ok 46 - HOLD-Q1 原生包可逆保留完整原用例并通过真实导入预览确认
  ---
  duration_ms: 105.185
  type: 'test'
  ...
# Subtest: M4-A flash复验使用独立单次授权和显式已登录DSH运行配置
ok 47 - M4-A flash复验使用独立单次授权和显式已登录DSH运行配置
  ---
  duration_ms: 396.3732
  type: 'test'
  ...
# Subtest: M4-A生产组装仅向Harness传递正常输入并由控制器执行冻结q1/q2
ok 48 - M4-A生产组装仅向Harness传递正常输入并由控制器执行冻结q1/q2
  ---
  duration_ms: 200.5151
  type: 'test'
  ...
# Subtest: HOLD-Q1环境拒绝内容哈希不匹配且不创建任务或消耗授权
ok 49 - HOLD-Q1环境拒绝内容哈希不匹配且不创建任务或消耗授权
  ---
  duration_ms: 61.8734
  type: 'test'
  ...
# Subtest: M4-A仅在正常页失败时允许一次定向修订并在两次启动后耗尽
ok 50 - M4-A仅在正常页失败时允许一次定向修订并在两次启动后耗尽
  ---
  duration_ms: 451.2936
  type: 'test'
  ...
# Subtest: only indexed media for the selected run can be read
ok 51 - only indexed media for the selected run can be read
  ---
  duration_ms: 155.0027
  type: 'test'
  ...
# Subtest: changed media bytes are not served as the registered attachment
ok 52 - changed media bytes are not served as the registered attachment
  ---
  duration_ms: 14.8818
  type: 'test'
  ...
# Subtest: 真实 Excel 用例完整冻结为既有 build task，且不启动 Harness 或消耗预算
ok 53 - 真实 Excel 用例完整冻结为既有 build task，且不启动 Harness 或消耗预算
  ---
  duration_ms: 360.7226
  type: 'test'
  ...
# Subtest: v1/v2 快照独立，精确关联校验和并发幂等均 fail closed
ok 54 - v1/v2 快照独立，精确关联校验和并发幂等均 fail closed
  ---
  duration_ms: 227.8546
  type: 'test'
  ...
# Subtest: request_id 同时绑定五项请求身份，顺序、重启幂等且身份变化明确冲突
ok 55 - request_id 同时绑定五项请求身份，顺序、重启幂等且身份变化明确冲突
  ---
  duration_ms: 122.0641
  type: 'test'
  ...
# Subtest: request_id 正在处理时只复用相同身份，不同身份立即冲突
ok 56 - request_id 正在处理时只复用相同身份，不同身份立即冲突
  ---
  duration_ms: 101.6184
  type: 'test'
  ...
# Subtest: 旧任务从 source 和 environment_ref 推导身份，身份不完整时拒绝复用
ok 57 - 旧任务从 source 和 environment_ref 推导身份，身份不完整时拒绝复用
  ---
  duration_ms: 140.4957
  type: 'test'
  ...
# Subtest: M3-B2生产接线把冻结输入和渲染指令送入attempt并按作用域只消费一次授权
ok 58 - M3-B2生产接线把冻结输入和渲染指令送入attempt并按作用域只消费一次授权
  ---
  duration_ms: 720.809
  type: 'test'
  ...
# Subtest: 两个验证侧哨兵仅进入控制器契约且合法业务原文不被字符串清洗
ok 59 - 两个验证侧哨兵仅进入控制器契约且合法业务原文不被字符串清洗
  ---
  duration_ms: 1.8506
  type: 'test'
  ...
# Subtest: M3-B2作用域冲突不创建第二任务且历史INPUT_ONLY仍不可启动
ok 60 - M3-B2作用域冲突不创建第二任务且历史INPUT_ONLY仍不可启动
  ---
  duration_ms: 187.8533
  type: 'test'
  ...
# Subtest: approved sorting asset is derived from the real frozen records
ok 61 - approved sorting asset is derived from the real frozen records
  ---
  duration_ms: 18.5873
  type: 'test'
  ...
# Subtest: hash mismatch is rejected instead of becoming a new approval
ok 62 - hash mismatch is rejected instead of becoming a new approval
  ---
  duration_ms: 41.389
  type: 'test'
  ...
# Subtest: complete passing report requires all registered steps and all media kinds
ok 63 - complete passing report requires all registered steps and all media kinds
  ---
  duration_ms: 62.0977
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when all media are missing
ok 64 - raw passing result is not an overall pass when all media are missing
  ---
  duration_ms: 22.4311
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when screenshot is missing
ok 65 - raw passing result is not an overall pass when screenshot is missing
  ---
  duration_ms: 22.0685
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when video is missing
ok 66 - raw passing result is not an overall pass when video is missing
  ---
  duration_ms: 42.3999
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when trace is missing
ok 67 - raw passing result is not an overall pass when trace is missing
  ---
  duration_ms: 29.9037
  type: 'test'
  ...
# Subtest: assertion mismatch remains a failed test and later steps are not executed
ok 68 - assertion mismatch remains a failed test and later steps are not executed
  ---
  duration_ms: 48.0954
  type: 'test'
  ...
# Subtest: missing, corrupt, skipped and zero-target reports fail closed
ok 69 - missing, corrupt, skipped and zero-target reports fail closed
  ---
  duration_ms: 44.5828
  type: 'test'
  ...
# Subtest: exit code zero cannot override an incomplete step set
ok 70 - exit code zero cannot override an incomplete step set
  ---
  duration_ms: 10.0056
  type: 'test'
  ...
# Subtest: a passing Playwright report cannot override a non-normal execution terminal state
ok 71 - a passing Playwright report cannot override a non-normal execution terminal state
  ---
  duration_ms: 161.8277
  type: 'test'
  ...
# Subtest: error facts distinguish missing targets, strict conflicts, unavailable values and real value mismatches
ok 72 - error facts distinguish missing targets, strict conflicts, unavailable values and real value mismatches
  ---
  duration_ms: 1.4122
  type: 'test'
  ...
# Subtest: 复验驱动只等待本次task终态，不被旧历史终态提前满足
ok 73 - 复验驱动只等待本次task终态，不被旧历史终态提前满足
  ---
  duration_ms: 1386.1199
  type: 'test'
  ...
# Subtest: 原扫描任意历史卡片逻辑无法通过同一task终态等待断言
ok 74 - 原扫描任意历史卡片逻辑无法通过同一task终态等待断言
  ---
  duration_ms: 931.3683
  type: 'test'
  ...
# Subtest: 项目用例新版本不会自动继承旧版本的限定首审资产
ok 75 - 项目用例新版本不会自动继承旧版本的限定首审资产
  ---
  duration_ms: 2034.7695
  type: 'test'
  ...
# Subtest: 限定人工首审资产按精确任务、候选和用例版本登记并幂等保存原字节
ok 76 - 限定人工首审资产按精确任务、候选和用例版本登记并幂等保存原字节
  ---
  duration_ms: 201.6002
  type: 'test'
  ...
# Subtest: 缺少有效首审、候选哈希变化或项目关联错误均拒绝登记
ok 77 - 缺少有效首审、候选哈希变化或项目关联错误均拒绝登记
  ---
  duration_ms: 238.401
  type: 'test'
  ...
# Subtest: health endpoint reports the independent workbench
ok 78 - health endpoint reports the independent workbench
  ---
  duration_ms: 64.6629
  type: 'test'
  ...
# Subtest: unknown routes fail closed
ok 79 - unknown routes fail closed
  ---
  duration_ms: 10.0351
  type: 'test'
  ...
# Subtest: asset registration is persistent and idempotent
ok 80 - asset registration is persistent and idempotent
  ---
  duration_ms: 59.5807
  type: 'test'
  ...
# Subtest: runs remain readable and active records become interrupted after restart
ok 81 - runs remain readable and active records become interrupted after restart
  ---
  duration_ms: 77.5041
  type: 'test'
  ...
# Subtest: run ids cannot escape the data root
ok 82 - run ids cannot escape the data root
  ---
  duration_ms: 16.186
  type: 'test'
  ...
# Subtest: workspace entry is a same-origin whitelist and old workbench remains available
ok 83 - workspace entry is a same-origin whitelist and old workbench remains available
  ---
  duration_ms: 148.3078
  type: 'test'
  ...
# Subtest: UI-D2A xlsx samples preserve exact source text and classifications through real parser
ok 84 - UI-D2A xlsx samples preserve exact source text and classifications through real parser
  ---
  duration_ms: 338.3847
  type: 'test'
  ...
# Subtest: committed native sample came from supported export schema and survives official import parser
ok 85 - committed native sample came from supported export schema and survives official import parser
  ---
  duration_ms: 34.7832
  type: 'test'
  ...
# Subtest: six-case xlsx uses the supported mapping and preserves paired business expectations
ok 86 - six-case xlsx uses the supported mapping and preserves paired business expectations
  ---
  duration_ms: 206.7602
  type: 'test'
  ...
# Subtest: committed six-case json is a formal backend package and reimports all six cases
ok 87 - committed six-case json is a formal backend package and reimports all six cases
  ---
  duration_ms: 207.7218
  type: 'test'
  ...
# Subtest: workbench候选使用同一Playwright运行根并真实执行正常与反例
ok 88 - workbench候选使用同一Playwright运行根并真实执行正常与反例
  ---
  duration_ms: 11471.5394
  type: 'test'
  ...
# Subtest: harness-probe默认运行根保持独立可执行
ok 89 - harness-probe默认运行根保持独立可执行
  ---
  duration_ms: 2627.8976
  type: 'test'
  ...
1..89
# tests 89
# suites 0
# pass 89
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 15661.9222
```

### Sync Record Status

```text
DRY-RUN: no derived changes for REQ-0033-e2e-01-six-case-workbench; explicit implementation states retained, never inferred from verification.
```

### Check AI Context

- Exit code: `0`

```text
PASS ai-engineering-context checks
```

### Notes

三份真实Harness候选及六条产品运行详见 workbench/docs/E2E_01_ACCEPTANCE_REPORT.md；工程测试不代替人工候选审批
