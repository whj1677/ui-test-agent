# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-23T09:59:28+08:00`
- Record: `REQ-0033-e2e-01-six-case-workbench`
- Change fingerprint: `99902f4bc3448a72de7912a199b02b2a005a5923c8cdc6c3914b124ab0cef6cb`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `npm --prefix workbench test`
- Exit code: `0`
- Test count: `83`
- Failure count: `0`
- Skipped count: `0`
- Log path: `workbench/.local/six-case-e2e/delivery-evidence.log`
- Log SHA-256: `4106b3bbb6d72115d47368609bf6353c4cf22599755ea7e06e9ea8b18bdf5928`

### Git Status

```text
 M workbench/server/app.mjs
 M workbench/server/build/files.mjs
 M workbench/server/build/manager.mjs
 M workbench/server/build/store.mjs
 M workbench/server/build/template.mjs
 M workbench/server/index.mjs
 M workbench/web-v2/app.js
 M workbench/web-v2/index.html
?? docs/requirements/REQ-0033-e2e-01-six-case-workbench/00_user_requirement.md
?? docs/requirements/REQ-0033-e2e-01-six-case-workbench/01_development_requirement.md
?? docs/requirements/REQ-0033-e2e-01-six-case-workbench/02_design.md
?? docs/requirements/REQ-0033-e2e-01-six-case-workbench/03_tasks.md
?? docs/requirements/REQ-0033-e2e-01-six-case-workbench/04_verification.md
?? docs/requirements/REQ-0033-e2e-01-six-case-workbench/05_trace.md
?? docs/requirements/REQ-0033-e2e-01-six-case-workbench/change_log.md
?? docs/requirements/REQ-0033-e2e-01-six-case-workbench/current_state.md
?? docs/requirements/REQ-0033-e2e-01-six-case-workbench/delivery_evidence.md
?? docs/requirements/REQ-0033-e2e-01-six-case-workbench/requirement.source.json
?? workbench/docs/E2E_01_ACCEPTANCE_REPORT.md
?? workbench/docs/E2E_01_USER_GUIDE.md
?? workbench/tests/e2e01-preflight.integration.mjs
```

### Git Diff Stat

```text
warning: in the working copy of 'workbench/server/app.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/files.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/manager.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/store.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/template.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/index.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/web-v2/app.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/web-v2/index.html', LF will be replaced by CRLF the next time Git touches it
 workbench/server/app.mjs            |  29 +++++
 workbench/server/build/files.mjs    |  21 ++--
 workbench/server/build/manager.mjs  | 219 ++++++++++++++++++++++++++++++++++--
 workbench/server/build/store.mjs    |  42 ++++++-
 workbench/server/build/template.mjs |  57 ++++++++++
 workbench/server/index.mjs          |  15 +++
 workbench/web-v2/app.js             |  88 ++++++++++++++-
 workbench/web-v2/index.html         |   4 +-
 8 files changed, 451 insertions(+), 24 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0033-e2e-01-six-case-workbench/00_user_requirement.md
docs/requirements/REQ-0033-e2e-01-six-case-workbench/01_development_requirement.md
docs/requirements/REQ-0033-e2e-01-six-case-workbench/02_design.md
docs/requirements/REQ-0033-e2e-01-six-case-workbench/03_tasks.md
docs/requirements/REQ-0033-e2e-01-six-case-workbench/04_verification.md
docs/requirements/REQ-0033-e2e-01-six-case-workbench/05_trace.md
docs/requirements/REQ-0033-e2e-01-six-case-workbench/change_log.md
docs/requirements/REQ-0033-e2e-01-six-case-workbench/current_state.md
docs/requirements/REQ-0033-e2e-01-six-case-workbench/delivery_evidence.md
docs/requirements/REQ-0033-e2e-01-six-case-workbench/requirement.source.json
workbench/docs/E2E_01_ACCEPTANCE_REPORT.md
workbench/docs/E2E_01_USER_GUIDE.md
workbench/tests/e2e01-preflight.integration.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-23T09:59:10+08:00
Command: npm --prefix workbench test
Exit code: 0
Parsed test count: 83
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---

> ui-test-approved-workbench@0.1.0 test
> node --test tests/*.test.mjs

TAP version 13
# Subtest: state changes require exact local origin and JSON schema
ok 1 - state changes require exact local origin and JSON schema
  ---
  duration_ms: 62.3897
  type: 'test'
  ...
# Subtest: stop route accepts only an empty JSON object from local origin
ok 2 - stop route accepts only an empty JSON object from local origin
  ---
  duration_ms: 5.5114
  type: 'test'
  ...
# Subtest: build mutations require local origin and exact fixed schemas
ok 3 - build mutations require local origin and exact fixed schemas
  ---
  duration_ms: 133.7663
  type: 'test'
  ...
# Subtest: only registered web-visible unchanged task files are served
ok 4 - only registered web-visible unchanged task files are served
  ---
  duration_ms: 34.474
  type: 'test'
  ...
# Subtest: only registered verification media are served with integrity and range checks
ok 5 - only registered verification media are served with integrity and range checks
  ---
  duration_ms: 28.9997
  type: 'test'
  ...
# Subtest: registers an idempotent derived assessment without rewriting the original task
ok 6 - registers an idempotent derived assessment without rewriting the original task
  ---
  duration_ms: 224.3953
  type: 'test'
  ...
# Subtest: rejects changed candidate or report identity and keeps a business gap out of human review
ok 7 - rejects changed candidate or report identity and keeps a business gap out of human review
  ---
  duration_ms: 176.6595
  type: 'test'
  ...
# Subtest: serves supplemental assessment beside the unchanged original failure
ok 8 - serves supplemental assessment beside the unchanged original failure
  ---
  duration_ms: 306.5877
  type: 'test'
  ...
# Subtest: failed candidate enables exactly one explicit revision and preserves both versions
ok 9 - failed candidate enables exactly one explicit revision and preserves both versions
  ---
  duration_ms: 644.0173
  type: 'test'
  ...
# {"type":"build_storage_failure","code":"EIO","operation":"append_lifecycle","at":"2026-09-23T01:59:12.635Z"}
# Subtest: 生命周期存储持续失败会降级服务并拒绝继续接纳建例
ok 10 - 生命周期存储持续失败会降级服务并拒绝继续接纳建例
  ---
  duration_ms: 84.6972
  type: 'test'
  ...
# {"type":"build_storage_failure","code":"EIO","operation":"background_completion","at":"2026-09-23T01:59:12.757Z"}
# Subtest: 后台completion最终状态持续写失败会被观察并关闭新建例入口
ok 11 - 后台completion最终状态持续写失败会被观察并关闭新建例入口
  ---
  duration_ms: 109.8856
  type: 'test'
  ...
# Subtest: duplicate start is rejected and cancel closes the owned attempt without restart
ok 12 - duplicate start is rejected and cancel closes the owned attempt without restart
  ---
  duration_ms: 104.3256
  type: 'test'
  ...
# Subtest: 单次复验授权只在Harness进程启动事件时消耗且不改旧预算
ok 13 - 单次复验授权只在Harness进程启动事件时消耗且不改旧预算
  ---
  duration_ms: 253.6965
  type: 'test'
  ...
# Subtest: 终态等待修复验证使用独立固定授权文件且不改旧授权
ok 14 - 终态等待修复验证使用独立固定授权文件且不改旧授权
  ---
  duration_ms: 108.6806
  type: 'test'
  ...
# Subtest: candidate report parser keeps normal pass and concrete assertion mismatch separate
ok 15 - candidate report parser keeps normal pass and concrete assertion mismatch separate
  ---
  duration_ms: 20.3943
  type: 'test'
  ...
# Subtest: missing report and locator errors cannot become technical pass or specified mismatch
ok 16 - missing report and locator errors cannot become technical pass or specified mismatch
  ---
  duration_ms: 23.306
  type: 'test'
  ...
# Subtest: versioned step title rule accepts only bare or explicitly separated leading markers
ok 17 - versioned step title rule accepts only bare or explicitly separated leading markers
  ---
  duration_ms: 1.7263
  type: 'test'
  ...
# Subtest: step mapping distinguishes 1 from 10 and rejects duplicate missing malformed and out-of-order markers
ok 18 - step mapping distinguishes 1 from 10 and rejects duplicate missing malformed and out-of-order markers
  ---
  duration_ms: 3.9876
  type: 'test'
  ...
# Subtest: nested assertion error is attributed to its business step and another step cannot satisfy the counterexample
ok 19 - nested assertion error is attributed to its business step and another step cannot satisfy the counterexample
  ---
  duration_ms: 1.6549
  type: 'test'
  ...
# Subtest: steps after the attributed failure remain not executed without hiding the specified mismatch
ok 20 - steps after the attributed failure remain not executed without hiding the specified mismatch
  ---
  duration_ms: 0.5691
  type: 'test'
  ...
# Subtest: parser preserves raw title hierarchy raw error and expected actual facts
ok 21 - parser preserves raw title hierarchy raw error and expected actual facts
  ---
  duration_ms: 14.5968
  type: 'test'
  ...
# Subtest: associates exact task candidate and registers the same record idempotently
ok 22 - associates exact task candidate and registers the same record idempotently
  ---
  duration_ms: 252.2058
  type: 'test'
  ...
# Subtest: rejects candidate hash mismatch and does not associate media across tasks
ok 23 - rejects candidate hash mismatch and does not associate media across tasks
  ---
  duration_ms: 270.6384
  type: 'test'
  ...
# Subtest: serves only registered unchanged media with byte ranges
ok 24 - serves only registered unchanged media with byte ranges
  ---
  duration_ms: 452.0692
  type: 'test'
  ...
# Subtest: M2-C stage budget persists across task ids and store restarts
ok 25 - M2-C stage budget persists across task ids and store restarts
  ---
  duration_ms: 120.4271
  type: 'test'
  ...
# Subtest: restart marks active build interrupted without replaying it
ok 26 - restart marks active build interrupted without replaying it
  ---
  duration_ms: 109.5596
  type: 'test'
  ...
# Subtest: task状态原子替换的短暂占用有限重试后成功
ok 27 - task状态原子替换的短暂占用有限重试后成功
  ---
  duration_ms: 157.7663
  type: 'test'
  ...
# Subtest: task状态持续写失败会显式返回错误而非静默成功
ok 28 - task状态持续写失败会显式返回错误而非静默成功
  ---
  duration_ms: 707.7168
  type: 'test'
  ...
# Subtest: 协调进程被终止后重启保留逐事件记录、标中断且不重放预算
ok 29 - 协调进程被终止后重启保留逐事件记录、标中断且不重放预算
  ---
  duration_ms: 1041.2252
  type: 'test'
  ...
# Subtest: case library API requires local origin and serves only registered operations
ok 30 - case library API requires local origin and serves only registered operations
  ---
  duration_ms: 268.8872
  type: 'test'
  ...
# Subtest: real xlsx and native package round trip preserve fields, lineage and project isolation
ok 31 - real xlsx and native package round trip preserve fields, lineage and project isolation
  ---
  duration_ms: 682.2967
  type: 'test'
  ...
# Subtest: formula cells and stale or cross-project confirmations fail closed
ok 32 - formula cells and stale or cross-project confirmations fail closed
  ---
  duration_ms: 136.2596
  type: 'test'
  ...
# Subtest: real xlsx preserves numeric-looking text, physical rows and blank columns
ok 33 - real xlsx preserves numeric-looking text, physical rows and blank columns
  ---
  duration_ms: 111.5833
  type: 'test'
  ...
# Subtest: real xlsx keeps step and expected cell-line positions instead of compacting blanks
ok 34 - real xlsx keeps step and expected cell-line positions instead of compacting blanks
  ---
  duration_ms: 51.4196
  type: 'test'
  ...
# Subtest: approved run uses fixed argument arrays and a reduced environment
ok 35 - approved run uses fixed argument arrays and a reduced environment
  ---
  duration_ms: 225.6032
  type: 'test'
  ...
# Subtest: duplicate starts are rejected and stop targets only the owned process
ok 36 - duplicate starts are rejected and stop targets only the owned process
  ---
  duration_ms: 198.9142
  type: 'test'
  ...
# Subtest: unapproved, wrong-hash, traversal and illegal environment records are refused
ok 37 - unapproved, wrong-hash, traversal and illegal environment records are refused
  ---
  duration_ms: 427.6013
  type: 'test'
  ...
# Subtest: runtime-copy integrity failure preserves the raw passing report but blocks overall pass
ok 38 - runtime-copy integrity failure preserves the raw passing report but blocks overall pass
  ---
  duration_ms: 88.3106
  type: 'test'
  ...
# Subtest: 限定首审资产使用PROBE_URL且正常入口不能越权运行受控反例
ok 39 - 限定首审资产使用PROBE_URL且正常入口不能越权运行受控反例
  ---
  duration_ms: 243.946
  type: 'test'
  ...
# Subtest: HOLD-Q1 原生包可逆保留完整原用例并通过真实导入预览确认
ok 40 - HOLD-Q1 原生包可逆保留完整原用例并通过真实导入预览确认
  ---
  duration_ms: 245.9995
  type: 'test'
  ...
# Subtest: M4-A flash复验使用独立单次授权和显式已登录DSH运行配置
ok 41 - M4-A flash复验使用独立单次授权和显式已登录DSH运行配置
  ---
  duration_ms: 387.5875
  type: 'test'
  ...
# Subtest: M4-A生产组装仅向Harness传递正常输入并由控制器执行冻结q1/q2
ok 42 - M4-A生产组装仅向Harness传递正常输入并由控制器执行冻结q1/q2
  ---
  duration_ms: 255.1627
  type: 'test'
  ...
# Subtest: HOLD-Q1环境拒绝内容哈希不匹配且不创建任务或消耗授权
ok 43 - HOLD-Q1环境拒绝内容哈希不匹配且不创建任务或消耗授权
  ---
  duration_ms: 125.5767
  type: 'test'
  ...
# Subtest: M4-A仅在正常页失败时允许一次定向修订并在两次启动后耗尽
ok 44 - M4-A仅在正常页失败时允许一次定向修订并在两次启动后耗尽
  ---
  duration_ms: 712.0362
  type: 'test'
  ...
# Subtest: only indexed media for the selected run can be read
ok 45 - only indexed media for the selected run can be read
  ---
  duration_ms: 157.2262
  type: 'test'
  ...
# Subtest: changed media bytes are not served as the registered attachment
ok 46 - changed media bytes are not served as the registered attachment
  ---
  duration_ms: 27.5741
  type: 'test'
  ...
# Subtest: 真实 Excel 用例完整冻结为既有 build task，且不启动 Harness 或消耗预算
ok 47 - 真实 Excel 用例完整冻结为既有 build task，且不启动 Harness 或消耗预算
  ---
  duration_ms: 376.8705
  type: 'test'
  ...
# Subtest: v1/v2 快照独立，精确关联校验和并发幂等均 fail closed
ok 48 - v1/v2 快照独立，精确关联校验和并发幂等均 fail closed
  ---
  duration_ms: 267.5151
  type: 'test'
  ...
# Subtest: request_id 同时绑定五项请求身份，顺序、重启幂等且身份变化明确冲突
ok 49 - request_id 同时绑定五项请求身份，顺序、重启幂等且身份变化明确冲突
  ---
  duration_ms: 172.4871
  type: 'test'
  ...
# Subtest: request_id 正在处理时只复用相同身份，不同身份立即冲突
ok 50 - request_id 正在处理时只复用相同身份，不同身份立即冲突
  ---
  duration_ms: 143.7079
  type: 'test'
  ...
# Subtest: 旧任务从 source 和 environment_ref 推导身份，身份不完整时拒绝复用
ok 51 - 旧任务从 source 和 environment_ref 推导身份，身份不完整时拒绝复用
  ---
  duration_ms: 414.0502
  type: 'test'
  ...
# Subtest: M3-B2生产接线把冻结输入和渲染指令送入attempt并按作用域只消费一次授权
ok 52 - M3-B2生产接线把冻结输入和渲染指令送入attempt并按作用域只消费一次授权
  ---
  duration_ms: 1160.2712
  type: 'test'
  ...
# Subtest: 两个验证侧哨兵仅进入控制器契约且合法业务原文不被字符串清洗
ok 53 - 两个验证侧哨兵仅进入控制器契约且合法业务原文不被字符串清洗
  ---
  duration_ms: 3.2607
  type: 'test'
  ...
# Subtest: M3-B2作用域冲突不创建第二任务且历史INPUT_ONLY仍不可启动
ok 54 - M3-B2作用域冲突不创建第二任务且历史INPUT_ONLY仍不可启动
  ---
  duration_ms: 342.22
  type: 'test'
  ...
# Subtest: approved sorting asset is derived from the real frozen records
ok 55 - approved sorting asset is derived from the real frozen records
  ---
  duration_ms: 29.9871
  type: 'test'
  ...
# Subtest: hash mismatch is rejected instead of becoming a new approval
ok 56 - hash mismatch is rejected instead of becoming a new approval
  ---
  duration_ms: 31.5308
  type: 'test'
  ...
# Subtest: complete passing report requires all registered steps and all media kinds
ok 57 - complete passing report requires all registered steps and all media kinds
  ---
  duration_ms: 92.2989
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when all media are missing
ok 58 - raw passing result is not an overall pass when all media are missing
  ---
  duration_ms: 15.8247
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when screenshot is missing
ok 59 - raw passing result is not an overall pass when screenshot is missing
  ---
  duration_ms: 25.5045
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when video is missing
ok 60 - raw passing result is not an overall pass when video is missing
  ---
  duration_ms: 62.2079
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when trace is missing
ok 61 - raw passing result is not an overall pass when trace is missing
  ---
  duration_ms: 58.4493
  type: 'test'
  ...
# Subtest: assertion mismatch remains a failed test and later steps are not executed
ok 62 - assertion mismatch remains a failed test and later steps are not executed
  ---
  duration_ms: 81.1203
  type: 'test'
  ...
# Subtest: missing, corrupt, skipped and zero-target reports fail closed
ok 63 - missing, corrupt, skipped and zero-target reports fail closed
  ---
  duration_ms: 30.9976
  type: 'test'
  ...
# Subtest: exit code zero cannot override an incomplete step set
ok 64 - exit code zero cannot override an incomplete step set
  ---
  duration_ms: 7.4149
  type: 'test'
  ...
# Subtest: a passing Playwright report cannot override a non-normal execution terminal state
ok 65 - a passing Playwright report cannot override a non-normal execution terminal state
  ---
  duration_ms: 107.108
  type: 'test'
  ...
# Subtest: error facts distinguish missing targets, strict conflicts, unavailable values and real value mismatches
ok 66 - error facts distinguish missing targets, strict conflicts, unavailable values and real value mismatches
  ---
  duration_ms: 1.5573
  type: 'test'
  ...
# Subtest: 复验驱动只等待本次task终态，不被旧历史终态提前满足
ok 67 - 复验驱动只等待本次task终态，不被旧历史终态提前满足
  ---
  duration_ms: 1873.7505
  type: 'test'
  ...
# Subtest: 原扫描任意历史卡片逻辑无法通过同一task终态等待断言
ok 68 - 原扫描任意历史卡片逻辑无法通过同一task终态等待断言
  ---
  duration_ms: 908.4068
  type: 'test'
  ...
# Subtest: 项目用例新版本不会自动继承旧版本的限定首审资产
ok 69 - 项目用例新版本不会自动继承旧版本的限定首审资产
  ---
  duration_ms: 2220.968
  type: 'test'
  ...
# Subtest: 限定人工首审资产按精确任务、候选和用例版本登记并幂等保存原字节
ok 70 - 限定人工首审资产按精确任务、候选和用例版本登记并幂等保存原字节
  ---
  duration_ms: 257.3268
  type: 'test'
  ...
# Subtest: 缺少有效首审、候选哈希变化或项目关联错误均拒绝登记
ok 71 - 缺少有效首审、候选哈希变化或项目关联错误均拒绝登记
  ---
  duration_ms: 224.8181
  type: 'test'
  ...
# Subtest: health endpoint reports the independent workbench
ok 72 - health endpoint reports the independent workbench
  ---
  duration_ms: 53.0066
  type: 'test'
  ...
# Subtest: unknown routes fail closed
ok 73 - unknown routes fail closed
  ---
  duration_ms: 14.4749
  type: 'test'
  ...
# Subtest: asset registration is persistent and idempotent
ok 74 - asset registration is persistent and idempotent
  ---
  duration_ms: 84.1385
  type: 'test'
  ...
# Subtest: runs remain readable and active records become interrupted after restart
ok 75 - runs remain readable and active records become interrupted after restart
  ---
  duration_ms: 58.0138
  type: 'test'
  ...
# Subtest: run ids cannot escape the data root
ok 76 - run ids cannot escape the data root
  ---
  duration_ms: 17.536
  type: 'test'
  ...
# Subtest: workspace entry is a same-origin whitelist and old workbench remains available
ok 77 - workspace entry is a same-origin whitelist and old workbench remains available
  ---
  duration_ms: 205.2158
  type: 'test'
  ...
# Subtest: UI-D2A xlsx samples preserve exact source text and classifications through real parser
ok 78 - UI-D2A xlsx samples preserve exact source text and classifications through real parser
  ---
  duration_ms: 311.9896
  type: 'test'
  ...
# Subtest: committed native sample came from supported export schema and survives official import parser
ok 79 - committed native sample came from supported export schema and survives official import parser
  ---
  duration_ms: 44.8284
  type: 'test'
  ...
# Subtest: six-case xlsx uses the supported mapping and preserves paired business expectations
ok 80 - six-case xlsx uses the supported mapping and preserves paired business expectations
  ---
  duration_ms: 357.5071
  type: 'test'
  ...
# Subtest: committed six-case json is a formal backend package and reimports all six cases
ok 81 - committed six-case json is a formal backend package and reimports all six cases
  ---
  duration_ms: 86.0209
  type: 'test'
  ...
# Subtest: workbench候选使用同一Playwright运行根并真实执行正常与反例
ok 82 - workbench候选使用同一Playwright运行根并真实执行正常与反例
  ---
  duration_ms: 12123.358
  type: 'test'
  ...
# Subtest: harness-probe默认运行根保持独立可执行
ok 83 - harness-probe默认运行根保持独立可执行
  ---
  duration_ms: 2657.7424
  type: 'test'
  ...
1..83
# tests 83
# suites 0
# pass 83
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 16391.2693
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

工程自动化回归；不含产品Harness建例或六条产品执行。真实产品Harness连通检查单独失败记录于workbench/docs/E2E_01_ACCEPTANCE_REPORT.md。
