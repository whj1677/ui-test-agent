# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-21T17:39:53+08:00`
- Record: `REQ-0026-workbench-m3b-case-build-input`
- Change fingerprint: `3a2b220218c09093ca9632874823aebcd970a6b5fd3869c4ad1b939548e87b21`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `npm --prefix workbench test`
- Exit code: `0`
- Test count: `54`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/REQ-0026-workbench.log`
- Log SHA-256: `f19389cc959654542686b54686e4cf37051cb9f916275c6a31fd4437e64a2606`

### Git Status

```text
M  docs/modules/workbench-case-library.md
M  docs/requirements/README.md
A  docs/requirements/REQ-0026-workbench-m3b-case-build-input/00_user_requirement.md
A  docs/requirements/REQ-0026-workbench-m3b-case-build-input/01_development_requirement.md
A  docs/requirements/REQ-0026-workbench-m3b-case-build-input/02_design.md
A  docs/requirements/REQ-0026-workbench-m3b-case-build-input/03_tasks.md
A  docs/requirements/REQ-0026-workbench-m3b-case-build-input/04_verification.md
A  docs/requirements/REQ-0026-workbench-m3b-case-build-input/05_trace.md
A  docs/requirements/REQ-0026-workbench-m3b-case-build-input/change_log.md
A  docs/requirements/REQ-0026-workbench-m3b-case-build-input/current_state.md
AM docs/requirements/REQ-0026-workbench-m3b-case-build-input/delivery_evidence.md
A  docs/requirements/REQ-0026-workbench-m3b-case-build-input/requirement.source.json
M  workbench/README.md
AM workbench/docs/M3B1_CASE_BUILD_INPUT_REPORT.md
A  workbench/docs/evidence/M3B1_PROJECT_CASE_BUILD_INPUT_WEB.png
M  workbench/package.json
M  workbench/server/app.mjs
M  workbench/server/build/manager.mjs
A  workbench/server/build/project-case.mjs
M  workbench/server/build/store.mjs
M  workbench/server/build/template.mjs
M  workbench/server/index.mjs
M  workbench/tests/build-api.test.mjs
A  workbench/tests/project-case-build-browser.integration.mjs
A  workbench/tests/project-case-build-input.test.mjs
M  workbench/web/app.js
M  workbench/web/index.html
M  workbench/web/styles.css
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/requirements/REQ-0026-workbench-m3b-case-build-input/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/docs/M3B1_CASE_BUILD_INPUT_REPORT.md', LF will be replaced by CRLF the next time Git touches it
 docs/modules/workbench-case-library.md             |  10 +-
 docs/requirements/README.md                        |   2 +
 .../00_user_requirement.md                         |  23 +
 .../01_development_requirement.md                  |  18 +
 .../02_design.md                                   |  28 ++
 .../03_tasks.md                                    |  12 +
 .../04_verification.md                             |  26 ++
 .../05_trace.md                                    |  21 +
 .../change_log.md                                  |   9 +
 .../current_state.md                               |  67 +++
 .../delivery_evidence.md                           | 462 +++++++++++++++++++++
 .../requirement.source.json                        |  72 ++++
 workbench/README.md                                |   7 +-
 workbench/docs/M3B1_CASE_BUILD_INPUT_REPORT.md     |  43 ++
 .../evidence/M3B1_PROJECT_CASE_BUILD_INPUT_WEB.png | Bin 0 -> 353038 bytes
 workbench/package.json                             |   1 +
 workbench/server/app.mjs                           |  11 +
 workbench/server/build/manager.mjs                 |  83 +++-
 workbench/server/build/project-case.mjs            | 132 ++++++
 workbench/server/build/store.mjs                   |  21 +-
 workbench/server/build/template.mjs                |   4 +-
 workbench/server/index.mjs                         |   1 +
 workbench/tests/build-api.test.mjs                 |  10 +
 .../project-case-build-browser.integration.mjs     |  94 +++++
 workbench/tests/project-case-build-input.test.mjs  | 132 ++++++
 workbench/web/app.js                               | 104 ++++-
 workbench/web/index.html                           |  22 +-
 workbench/web/styles.css                           |   7 +
 28 files changed, 1408 insertions(+), 14 deletions(-)
```

### Untracked Files

```text
(none)
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-21T17:39:38+08:00
Command: npm --prefix workbench test
Exit code: 0
Parsed test count: 54
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---

> ui-test-approved-workbench@0.1.0 test
> node --test tests/*.test.mjs

TAP version 13
# Subtest: state changes require exact local origin and JSON schema
ok 1 - state changes require exact local origin and JSON schema
  ---
  duration_ms: 58.0645
  type: 'test'
  ...
# Subtest: stop route accepts only an empty JSON object from local origin
ok 2 - stop route accepts only an empty JSON object from local origin
  ---
  duration_ms: 5.0191
  type: 'test'
  ...
# Subtest: build mutations require local origin and exact fixed schemas
ok 3 - build mutations require local origin and exact fixed schemas
  ---
  duration_ms: 121.6231
  type: 'test'
  ...
# Subtest: only registered web-visible unchanged task files are served
ok 4 - only registered web-visible unchanged task files are served
  ---
  duration_ms: 42.446
  type: 'test'
  ...
# Subtest: failed candidate enables exactly one explicit revision and preserves both versions
ok 5 - failed candidate enables exactly one explicit revision and preserves both versions
  ---
  duration_ms: 170.6878
  type: 'test'
  ...
# {"type":"build_storage_failure","code":"EIO","operation":"append_lifecycle","at":"2026-09-21T09:39:40.207Z"}
# Subtest: 生命周期存储持续失败会降级服务并拒绝继续接纳建例
ok 6 - 生命周期存储持续失败会降级服务并拒绝继续接纳建例
  ---
  duration_ms: 40.6238
  type: 'test'
  ...
# {"type":"build_storage_failure","code":"EIO","operation":"background_completion","at":"2026-09-21T09:39:40.261Z"}
# Subtest: 后台completion最终状态持续写失败会被观察并关闭新建例入口
ok 7 - 后台completion最终状态持续写失败会被观察并关闭新建例入口
  ---
  duration_ms: 49.9385
  type: 'test'
  ...
# Subtest: duplicate start is rejected and cancel closes the owned attempt without restart
ok 8 - duplicate start is rejected and cancel closes the owned attempt without restart
  ---
  duration_ms: 47.599
  type: 'test'
  ...
# Subtest: 单次复验授权只在Harness进程启动事件时消耗且不改旧预算
ok 9 - 单次复验授权只在Harness进程启动事件时消耗且不改旧预算
  ---
  duration_ms: 93.583
  type: 'test'
  ...
# Subtest: 终态等待修复验证使用独立固定授权文件且不改旧授权
ok 10 - 终态等待修复验证使用独立固定授权文件且不改旧授权
  ---
  duration_ms: 26.0115
  type: 'test'
  ...
# Subtest: candidate report parser keeps normal pass and concrete assertion mismatch separate
ok 11 - candidate report parser keeps normal pass and concrete assertion mismatch separate
  ---
  duration_ms: 14.6458
  type: 'test'
  ...
# Subtest: missing report and locator errors cannot become technical pass or specified mismatch
ok 12 - missing report and locator errors cannot become technical pass or specified mismatch
  ---
  duration_ms: 5.8091
  type: 'test'
  ...
# Subtest: associates exact task candidate and registers the same record idempotently
ok 13 - associates exact task candidate and registers the same record idempotently
  ---
  duration_ms: 166.4743
  type: 'test'
  ...
# Subtest: rejects candidate hash mismatch and does not associate media across tasks
ok 14 - rejects candidate hash mismatch and does not associate media across tasks
  ---
  duration_ms: 61.7431
  type: 'test'
  ...
# Subtest: serves only registered unchanged media with byte ranges
ok 15 - serves only registered unchanged media with byte ranges
  ---
  duration_ms: 167.9752
  type: 'test'
  ...
# Subtest: M2-C stage budget persists across task ids and store restarts
ok 16 - M2-C stage budget persists across task ids and store restarts
  ---
  duration_ms: 30.5396
  type: 'test'
  ...
# Subtest: restart marks active build interrupted without replaying it
ok 17 - restart marks active build interrupted without replaying it
  ---
  duration_ms: 50.695
  type: 'test'
  ...
# Subtest: task状态原子替换的短暂占用有限重试后成功
ok 18 - task状态原子替换的短暂占用有限重试后成功
  ---
  duration_ms: 99.3985
  type: 'test'
  ...
# Subtest: task状态持续写失败会显式返回错误而非静默成功
ok 19 - task状态持续写失败会显式返回错误而非静默成功
  ---
  duration_ms: 641.7304
  type: 'test'
  ...
# Subtest: 协调进程被终止后重启保留逐事件记录、标中断且不重放预算
ok 20 - 协调进程被终止后重启保留逐事件记录、标中断且不重放预算
  ---
  duration_ms: 681.7383
  type: 'test'
  ...
# Subtest: case library API requires local origin and serves only registered operations
ok 21 - case library API requires local origin and serves only registered operations
  ---
  duration_ms: 82.2156
  type: 'test'
  ...
# Subtest: real xlsx and native package round trip preserve fields, lineage and project isolation
ok 22 - real xlsx and native package round trip preserve fields, lineage and project isolation
  ---
  duration_ms: 273.4582
  type: 'test'
  ...
# Subtest: formula cells and stale or cross-project confirmations fail closed
ok 23 - formula cells and stale or cross-project confirmations fail closed
  ---
  duration_ms: 84.94
  type: 'test'
  ...
# Subtest: real xlsx preserves numeric-looking text, physical rows and blank columns
ok 24 - real xlsx preserves numeric-looking text, physical rows and blank columns
  ---
  duration_ms: 61.3586
  type: 'test'
  ...
# Subtest: real xlsx keeps step and expected cell-line positions instead of compacting blanks
ok 25 - real xlsx keeps step and expected cell-line positions instead of compacting blanks
  ---
  duration_ms: 10.9478
  type: 'test'
  ...
# Subtest: approved run uses fixed argument arrays and a reduced environment
ok 26 - approved run uses fixed argument arrays and a reduced environment
  ---
  duration_ms: 113.322
  type: 'test'
  ...
# Subtest: duplicate starts are rejected and stop targets only the owned process
ok 27 - duplicate starts are rejected and stop targets only the owned process
  ---
  duration_ms: 70.6782
  type: 'test'
  ...
# Subtest: unapproved, wrong-hash, traversal and illegal environment records are refused
ok 28 - unapproved, wrong-hash, traversal and illegal environment records are refused
  ---
  duration_ms: 121.2245
  type: 'test'
  ...
# Subtest: runtime-copy integrity failure preserves the raw passing report but blocks overall pass
ok 29 - runtime-copy integrity failure preserves the raw passing report but blocks overall pass
  ---
  duration_ms: 50.0672
  type: 'test'
  ...
# Subtest: only indexed media for the selected run can be read
ok 30 - only indexed media for the selected run can be read
  ---
  duration_ms: 111.2949
  type: 'test'
  ...
# Subtest: changed media bytes are not served as the registered attachment
ok 31 - changed media bytes are not served as the registered attachment
  ---
  duration_ms: 10.9833
  type: 'test'
  ...
# Subtest: 真实 Excel 用例完整冻结为既有 build task，且不启动 Harness 或消耗预算
ok 32 - 真实 Excel 用例完整冻结为既有 build task，且不启动 Harness 或消耗预算
  ---
  duration_ms: 159.4555
  type: 'test'
  ...
# Subtest: v1/v2 快照独立，精确关联校验和并发幂等均 fail closed
ok 33 - v1/v2 快照独立，精确关联校验和并发幂等均 fail closed
  ---
  duration_ms: 149.4747
  type: 'test'
  ...
# Subtest: approved sorting asset is derived from the real frozen records
ok 34 - approved sorting asset is derived from the real frozen records
  ---
  duration_ms: 18.9727
  type: 'test'
  ...
# Subtest: hash mismatch is rejected instead of becoming a new approval
ok 35 - hash mismatch is rejected instead of becoming a new approval
  ---
  duration_ms: 7.2419
  type: 'test'
  ...
# Subtest: complete passing report requires all registered steps and all media kinds
ok 36 - complete passing report requires all registered steps and all media kinds
  ---
  duration_ms: 33.1762
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when all media are missing
ok 37 - raw passing result is not an overall pass when all media are missing
  ---
  duration_ms: 12.3397
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when screenshot is missing
ok 38 - raw passing result is not an overall pass when screenshot is missing
  ---
  duration_ms: 13.9695
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when video is missing
ok 39 - raw passing result is not an overall pass when video is missing
  ---
  duration_ms: 14.5939
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when trace is missing
ok 40 - raw passing result is not an overall pass when trace is missing
  ---
  duration_ms: 18.5908
  type: 'test'
  ...
# Subtest: assertion mismatch remains a failed test and later steps are not executed
ok 41 - assertion mismatch remains a failed test and later steps are not executed
  ---
  duration_ms: 27.1331
  type: 'test'
  ...
# Subtest: missing, corrupt, skipped and zero-target reports fail closed
ok 42 - missing, corrupt, skipped and zero-target reports fail closed
  ---
  duration_ms: 15.2751
  type: 'test'
  ...
# Subtest: exit code zero cannot override an incomplete step set
ok 43 - exit code zero cannot override an incomplete step set
  ---
  duration_ms: 5.1408
  type: 'test'
  ...
# Subtest: a passing Playwright report cannot override a non-normal execution terminal state
ok 44 - a passing Playwright report cannot override a non-normal execution terminal state
  ---
  duration_ms: 57.2849
  type: 'test'
  ...
# Subtest: error facts distinguish missing targets, strict conflicts, unavailable values and real value mismatches
ok 45 - error facts distinguish missing targets, strict conflicts, unavailable values and real value mismatches
  ---
  duration_ms: 1.0123
  type: 'test'
  ...
# Subtest: 复验驱动只等待本次task终态，不被旧历史终态提前满足
ok 46 - 复验驱动只等待本次task终态，不被旧历史终态提前满足
  ---
  duration_ms: 785.6356
  type: 'test'
  ...
# Subtest: 原扫描任意历史卡片逻辑无法通过同一task终态等待断言
ok 47 - 原扫描任意历史卡片逻辑无法通过同一task终态等待断言
  ---
  duration_ms: 817.5313
  type: 'test'
  ...
# Subtest: health endpoint reports the independent workbench
ok 48 - health endpoint reports the independent workbench
  ---
  duration_ms: 51.364
  type: 'test'
  ...
# Subtest: unknown routes fail closed
ok 49 - unknown routes fail closed
  ---
  duration_ms: 8.8047
  type: 'test'
  ...
# Subtest: asset registration is persistent and idempotent
ok 50 - asset registration is persistent and idempotent
  ---
  duration_ms: 26.9832
  type: 'test'
  ...
# Subtest: runs remain readable and active records become interrupted after restart
ok 51 - runs remain readable and active records become interrupted after restart
  ---
  duration_ms: 51.4769
  type: 'test'
  ...
# Subtest: run ids cannot escape the data root
ok 52 - run ids cannot escape the data root
  ---
  duration_ms: 13.9831
  type: 'test'
  ...
# Subtest: workbench候选使用同一Playwright运行根并真实执行正常与反例
ok 53 - workbench候选使用同一Playwright运行根并真实执行正常与反例
  ---
  duration_ms: 10332.3816
  type: 'test'
  ...
# Subtest: harness-probe默认运行根保持独立可执行
ok 54 - harness-probe默认运行根保持独立可执行
  ---
  duration_ms: 2471.0563
  type: 'test'
  ...
1..54
# tests 54
# suites 0
# pass 54
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 13406.443
```

### Sync Record Status

```text
DRY-RUN: no derived changes for REQ-0026-workbench-m3b-case-build-input; explicit implementation states retained, never inferred from verification.
```

### Check AI Context

- Exit code: `0`

```text
PASS ai-engineering-context checks
```

### Notes

M3-B1完整workbench零模型工程集合；真实Chromium日志另见validation/REQ-0026-browser.log；Harness启动0次。
