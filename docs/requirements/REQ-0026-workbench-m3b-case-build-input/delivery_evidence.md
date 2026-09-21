# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-21T18:55:00+08:00`
- Record: `REQ-0026-workbench-m3b-case-build-input`
- Change fingerprint: `9e521d566f91af31696a480039b34feceace0543ce2a925d483ad76814902bea`
- Verification source: `collector-executed-v1`
- Verification state: `单元与集成回归通过`
- Command: `npm --prefix workbench test`
- Exit code: `0`
- Test count: `57`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/REQ-0026-workbench.log`
- Log SHA-256: `455fb52be26f558b39f982c43ef2d9dbe0f8639ef3bf2b57a24f17bc436d6edd`

### Git Status

```text
 M docs/modules/workbench-case-library.md
 M docs/requirements/REQ-0026-workbench-m3b-case-build-input/00_user_requirement.md
 M docs/requirements/REQ-0026-workbench-m3b-case-build-input/01_development_requirement.md
 M docs/requirements/REQ-0026-workbench-m3b-case-build-input/02_design.md
 M docs/requirements/REQ-0026-workbench-m3b-case-build-input/04_verification.md
 M docs/requirements/REQ-0026-workbench-m3b-case-build-input/05_trace.md
 M docs/requirements/REQ-0026-workbench-m3b-case-build-input/change_log.md
 M docs/requirements/REQ-0026-workbench-m3b-case-build-input/current_state.md
 M docs/requirements/REQ-0026-workbench-m3b-case-build-input/delivery_evidence.md
 M docs/requirements/REQ-0026-workbench-m3b-case-build-input/requirement.source.json
 M workbench/README.md
 M workbench/server/app.mjs
 M workbench/server/build/manager.mjs
 M workbench/tests/build-api.test.mjs
 M workbench/tests/project-case-build-input.test.mjs
?? workbench/docs/M3B1_REQUEST_IDENTITY_REVISION.md
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/modules/workbench-case-library.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0026-workbench-m3b-case-build-input/00_user_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0026-workbench-m3b-case-build-input/01_development_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0026-workbench-m3b-case-build-input/02_design.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0026-workbench-m3b-case-build-input/04_verification.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0026-workbench-m3b-case-build-input/05_trace.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0026-workbench-m3b-case-build-input/change_log.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0026-workbench-m3b-case-build-input/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0026-workbench-m3b-case-build-input/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0026-workbench-m3b-case-build-input/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/app.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/manager.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/tests/build-api.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/tests/project-case-build-input.test.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/workbench-case-library.md             |   3 +
 .../00_user_requirement.md                         |   1 +
 .../01_development_requirement.md                  |   2 +-
 .../02_design.md                                   |   4 +-
 .../04_verification.md                             |   6 +-
 .../05_trace.md                                    |   1 +
 .../change_log.md                                  |   1 +
 .../current_state.md                               |  10 +-
 .../delivery_evidence.md                           | 304 +++++++++++----------
 .../requirement.source.json                        |  21 +-
 workbench/README.md                                |   2 +-
 workbench/server/app.mjs                           |   1 +
 workbench/server/build/manager.mjs                 |  85 ++++--
 workbench/tests/build-api.test.mjs                 |   9 +-
 workbench/tests/project-case-build-input.test.mjs  | 104 +++++++
 15 files changed, 365 insertions(+), 189 deletions(-)
```

### Untracked Files

```text
workbench/docs/M3B1_REQUEST_IDENTITY_REVISION.md
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-21T18:54:44+08:00
Command: npm --prefix workbench test
Exit code: 0
Parsed test count: 57
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---

> ui-test-approved-workbench@0.1.0 test
> node --test tests/*.test.mjs

TAP version 13
# Subtest: state changes require exact local origin and JSON schema
ok 1 - state changes require exact local origin and JSON schema
  ---
  duration_ms: 56.0932
  type: 'test'
  ...
# Subtest: stop route accepts only an empty JSON object from local origin
ok 2 - stop route accepts only an empty JSON object from local origin
  ---
  duration_ms: 5.7173
  type: 'test'
  ...
# Subtest: build mutations require local origin and exact fixed schemas
ok 3 - build mutations require local origin and exact fixed schemas
  ---
  duration_ms: 132.4558
  type: 'test'
  ...
# Subtest: only registered web-visible unchanged task files are served
ok 4 - only registered web-visible unchanged task files are served
  ---
  duration_ms: 20.0233
  type: 'test'
  ...
# Subtest: failed candidate enables exactly one explicit revision and preserves both versions
ok 5 - failed candidate enables exactly one explicit revision and preserves both versions
  ---
  duration_ms: 179.3448
  type: 'test'
  ...
# {"type":"build_storage_failure","code":"EIO","operation":"append_lifecycle","at":"2026-09-21T10:54:46.203Z"}
# Subtest: 生命周期存储持续失败会降级服务并拒绝继续接纳建例
ok 6 - 生命周期存储持续失败会降级服务并拒绝继续接纳建例
  ---
  duration_ms: 36.8531
  type: 'test'
  ...
# {"type":"build_storage_failure","code":"EIO","operation":"background_completion","at":"2026-09-21T10:54:46.257Z"}
# Subtest: 后台completion最终状态持续写失败会被观察并关闭新建例入口
ok 7 - 后台completion最终状态持续写失败会被观察并关闭新建例入口
  ---
  duration_ms: 50.6272
  type: 'test'
  ...
# Subtest: duplicate start is rejected and cancel closes the owned attempt without restart
ok 8 - duplicate start is rejected and cancel closes the owned attempt without restart
  ---
  duration_ms: 49.3609
  type: 'test'
  ...
# Subtest: 单次复验授权只在Harness进程启动事件时消耗且不改旧预算
ok 9 - 单次复验授权只在Harness进程启动事件时消耗且不改旧预算
  ---
  duration_ms: 97.9365
  type: 'test'
  ...
# Subtest: 终态等待修复验证使用独立固定授权文件且不改旧授权
ok 10 - 终态等待修复验证使用独立固定授权文件且不改旧授权
  ---
  duration_ms: 30.8497
  type: 'test'
  ...
# Subtest: candidate report parser keeps normal pass and concrete assertion mismatch separate
ok 11 - candidate report parser keeps normal pass and concrete assertion mismatch separate
  ---
  duration_ms: 14.681
  type: 'test'
  ...
# Subtest: missing report and locator errors cannot become technical pass or specified mismatch
ok 12 - missing report and locator errors cannot become technical pass or specified mismatch
  ---
  duration_ms: 6.869
  type: 'test'
  ...
# Subtest: associates exact task candidate and registers the same record idempotently
ok 13 - associates exact task candidate and registers the same record idempotently
  ---
  duration_ms: 145.8246
  type: 'test'
  ...
# Subtest: rejects candidate hash mismatch and does not associate media across tasks
ok 14 - rejects candidate hash mismatch and does not associate media across tasks
  ---
  duration_ms: 115.3418
  type: 'test'
  ...
# Subtest: serves only registered unchanged media with byte ranges
ok 15 - serves only registered unchanged media with byte ranges
  ---
  duration_ms: 180.9522
  type: 'test'
  ...
# Subtest: M2-C stage budget persists across task ids and store restarts
ok 16 - M2-C stage budget persists across task ids and store restarts
  ---
  duration_ms: 39.6625
  type: 'test'
  ...
# Subtest: restart marks active build interrupted without replaying it
ok 17 - restart marks active build interrupted without replaying it
  ---
  duration_ms: 92.0632
  type: 'test'
  ...
# Subtest: task状态原子替换的短暂占用有限重试后成功
ok 18 - task状态原子替换的短暂占用有限重试后成功
  ---
  duration_ms: 115.2237
  type: 'test'
  ...
# Subtest: task状态持续写失败会显式返回错误而非静默成功
ok 19 - task状态持续写失败会显式返回错误而非静默成功
  ---
  duration_ms: 639.4938
  type: 'test'
  ...
# Subtest: 协调进程被终止后重启保留逐事件记录、标中断且不重放预算
ok 20 - 协调进程被终止后重启保留逐事件记录、标中断且不重放预算
  ---
  duration_ms: 713.9897
  type: 'test'
  ...
# Subtest: case library API requires local origin and serves only registered operations
ok 21 - case library API requires local origin and serves only registered operations
  ---
  duration_ms: 98.7441
  type: 'test'
  ...
# Subtest: real xlsx and native package round trip preserve fields, lineage and project isolation
ok 22 - real xlsx and native package round trip preserve fields, lineage and project isolation
  ---
  duration_ms: 291.4219
  type: 'test'
  ...
# Subtest: formula cells and stale or cross-project confirmations fail closed
ok 23 - formula cells and stale or cross-project confirmations fail closed
  ---
  duration_ms: 94.3329
  type: 'test'
  ...
# Subtest: real xlsx preserves numeric-looking text, physical rows and blank columns
ok 24 - real xlsx preserves numeric-looking text, physical rows and blank columns
  ---
  duration_ms: 59.5944
  type: 'test'
  ...
# Subtest: real xlsx keeps step and expected cell-line positions instead of compacting blanks
ok 25 - real xlsx keeps step and expected cell-line positions instead of compacting blanks
  ---
  duration_ms: 9.3036
  type: 'test'
  ...
# Subtest: approved run uses fixed argument arrays and a reduced environment
ok 26 - approved run uses fixed argument arrays and a reduced environment
  ---
  duration_ms: 114.2282
  type: 'test'
  ...
# Subtest: duplicate starts are rejected and stop targets only the owned process
ok 27 - duplicate starts are rejected and stop targets only the owned process
  ---
  duration_ms: 102.8876
  type: 'test'
  ...
# Subtest: unapproved, wrong-hash, traversal and illegal environment records are refused
ok 28 - unapproved, wrong-hash, traversal and illegal environment records are refused
  ---
  duration_ms: 110.6098
  type: 'test'
  ...
# Subtest: runtime-copy integrity failure preserves the raw passing report but blocks overall pass
ok 29 - runtime-copy integrity failure preserves the raw passing report but blocks overall pass
  ---
  duration_ms: 53.2841
  type: 'test'
  ...
# Subtest: only indexed media for the selected run can be read
ok 30 - only indexed media for the selected run can be read
  ---
  duration_ms: 110.7452
  type: 'test'
  ...
# Subtest: changed media bytes are not served as the registered attachment
ok 31 - changed media bytes are not served as the registered attachment
  ---
  duration_ms: 6.3969
  type: 'test'
  ...
# Subtest: 真实 Excel 用例完整冻结为既有 build task，且不启动 Harness 或消耗预算
ok 32 - 真实 Excel 用例完整冻结为既有 build task，且不启动 Harness 或消耗预算
  ---
  duration_ms: 173.2934
  type: 'test'
  ...
# Subtest: v1/v2 快照独立，精确关联校验和并发幂等均 fail closed
ok 33 - v1/v2 快照独立，精确关联校验和并发幂等均 fail closed
  ---
  duration_ms: 157.8322
  type: 'test'
  ...
# Subtest: request_id 同时绑定五项请求身份，顺序、重启幂等且身份变化明确冲突
ok 34 - request_id 同时绑定五项请求身份，顺序、重启幂等且身份变化明确冲突
  ---
  duration_ms: 100.9576
  type: 'test'
  ...
# Subtest: request_id 正在处理时只复用相同身份，不同身份立即冲突
ok 35 - request_id 正在处理时只复用相同身份，不同身份立即冲突
  ---
  duration_ms: 72.0804
  type: 'test'
  ...
# Subtest: 旧任务从 source 和 environment_ref 推导身份，身份不完整时拒绝复用
ok 36 - 旧任务从 source 和 environment_ref 推导身份，身份不完整时拒绝复用
  ---
  duration_ms: 90.0962
  type: 'test'
  ...
# Subtest: approved sorting asset is derived from the real frozen records
ok 37 - approved sorting asset is derived from the real frozen records
  ---
  duration_ms: 17.0291
  type: 'test'
  ...
# Subtest: hash mismatch is rejected instead of becoming a new approval
ok 38 - hash mismatch is rejected instead of becoming a new approval
  ---
  duration_ms: 20.3885
  type: 'test'
  ...
# Subtest: complete passing report requires all registered steps and all media kinds
ok 39 - complete passing report requires all registered steps and all media kinds
  ---
  duration_ms: 50.0461
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when all media are missing
ok 40 - raw passing result is not an overall pass when all media are missing
  ---
  duration_ms: 32.0091
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when screenshot is missing
ok 41 - raw passing result is not an overall pass when screenshot is missing
  ---
  duration_ms: 17.1825
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when video is missing
ok 42 - raw passing result is not an overall pass when video is missing
  ---
  duration_ms: 16.0896
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when trace is missing
ok 43 - raw passing result is not an overall pass when trace is missing
  ---
  duration_ms: 24.3002
  type: 'test'
  ...
# Subtest: assertion mismatch remains a failed test and later steps are not executed
ok 44 - assertion mismatch remains a failed test and later steps are not executed
  ---
  duration_ms: 17.22
  type: 'test'
  ...
# Subtest: missing, corrupt, skipped and zero-target reports fail closed
ok 45 - missing, corrupt, skipped and zero-target reports fail closed
  ---
  duration_ms: 22.9969
  type: 'test'
  ...
# Subtest: exit code zero cannot override an incomplete step set
ok 46 - exit code zero cannot override an incomplete step set
  ---
  duration_ms: 7.1591
  type: 'test'
  ...
# Subtest: a passing Playwright report cannot override a non-normal execution terminal state
ok 47 - a passing Playwright report cannot override a non-normal execution terminal state
  ---
  duration_ms: 68.3262
  type: 'test'
  ...
# Subtest: error facts distinguish missing targets, strict conflicts, unavailable values and real value mismatches
ok 48 - error facts distinguish missing targets, strict conflicts, unavailable values and real value mismatches
  ---
  duration_ms: 1.0628
  type: 'test'
  ...
# Subtest: 复验驱动只等待本次task终态，不被旧历史终态提前满足
ok 49 - 复验驱动只等待本次task终态，不被旧历史终态提前满足
  ---
  duration_ms: 905.8121
  type: 'test'
  ...
# Subtest: 原扫描任意历史卡片逻辑无法通过同一task终态等待断言
ok 50 - 原扫描任意历史卡片逻辑无法通过同一task终态等待断言
  ---
  duration_ms: 1279.8307
  type: 'test'
  ...
# Subtest: health endpoint reports the independent workbench
ok 51 - health endpoint reports the independent workbench
  ---
  duration_ms: 46.5875
  type: 'test'
  ...
# Subtest: unknown routes fail closed
ok 52 - unknown routes fail closed
  ---
  duration_ms: 9.3687
  type: 'test'
  ...
# Subtest: asset registration is persistent and idempotent
ok 53 - asset registration is persistent and idempotent
  ---
  duration_ms: 28.862
  type: 'test'
  ...
# Subtest: runs remain readable and active records become interrupted after restart
ok 54 - runs remain readable and active records become interrupted after restart
  ---
  duration_ms: 34.3732
  type: 'test'
  ...
# Subtest: run ids cannot escape the data root
ok 55 - run ids cannot escape the data root
  ---
  duration_ms: 10.4341
  type: 'test'
  ...
# Subtest: workbench候选使用同一Playwright运行根并真实执行正常与反例
ok 56 - workbench候选使用同一Playwright运行根并真实执行正常与反例
  ---
  duration_ms: 10547.4628
  type: 'test'
  ...
# Subtest: harness-probe默认运行根保持独立可执行
ok 57 - harness-probe默认运行根保持独立可执行
  ---
  duration_ms: 2991.3287
  type: 'test'
  ...
1..57
# tests 57
# suites 0
# pass 57
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 14154.3366
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

request_id五项身份校验修订；真实Chromium另以npm --prefix workbench run test:m3b1-browser验证1/1通过；Harness启动0，预算消耗0。
