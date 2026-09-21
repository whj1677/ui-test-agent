# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-21T13:55:56+08:00`
- Record: `REQ-0024-workbench-minimal-candidate-builder`
- Change fingerprint: `075659ac21103899b65801c13e9fed16a5bfe3f8e28ed4ce4cbb6b871e0ac6c5`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `npm test --prefix workbench`
- Exit code: `0`
- Test count: `41`
- Failure count: `0`
- Skipped count: `0`
- Log path: `docs/requirements/REQ-0024-workbench-minimal-candidate-builder/logs/delivery-verification.log`
- Log SHA-256: `6e455fd85cd2d99133eb18e7b3d1fae406b539e0bd12d451330812d11946bfe8`

### Git Status

```text
 M docs/requirements/REQ-0024-workbench-minimal-candidate-builder/00_user_requirement.md
 M docs/requirements/REQ-0024-workbench-minimal-candidate-builder/02_design.md
 M docs/requirements/REQ-0024-workbench-minimal-candidate-builder/04_verification.md
 M docs/requirements/REQ-0024-workbench-minimal-candidate-builder/05_trace.md
 M docs/requirements/REQ-0024-workbench-minimal-candidate-builder/change_log.md
 M docs/requirements/REQ-0024-workbench-minimal-candidate-builder/current_state.md
 M docs/requirements/REQ-0024-workbench-minimal-candidate-builder/delivery_evidence.md
 M docs/requirements/REQ-0024-workbench-minimal-candidate-builder/logs/delivery-verification.log
 M docs/requirements/REQ-0024-workbench-minimal-candidate-builder/logs/workbench-tests.log
 M docs/requirements/REQ-0024-workbench-minimal-candidate-builder/requirement.source.json
 M workbench/README.md
 M workbench/tests/revalidation-driver.test.mjs
?? docs/requirements/REQ-0024-workbench-minimal-candidate-builder/logs/revalidation-driver-tests.log
?? workbench/docs/M2C_REVALIDATION_WAIT_TEST_REVISION.md
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/requirements/REQ-0024-workbench-minimal-candidate-builder/00_user_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0024-workbench-minimal-candidate-builder/02_design.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0024-workbench-minimal-candidate-builder/04_verification.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0024-workbench-minimal-candidate-builder/05_trace.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0024-workbench-minimal-candidate-builder/change_log.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0024-workbench-minimal-candidate-builder/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0024-workbench-minimal-candidate-builder/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0024-workbench-minimal-candidate-builder/logs/delivery-verification.log', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0024-workbench-minimal-candidate-builder/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/tests/revalidation-driver.test.mjs', LF will be replaced by CRLF the next time Git touches it
 .../00_user_requirement.md                         |   3 +-
 .../02_design.md                                   |   3 +-
 .../04_verification.md                             |   2 +-
 .../05_trace.md                                    |   1 +
 .../change_log.md                                  |   1 +
 .../current_state.md                               |   4 +-
 .../delivery_evidence.md                           | 207 ++++++++-------------
 .../logs/delivery-verification.log                 | 112 +++++------
 .../logs/workbench-tests.log                       | 108 ++++++-----
 .../requirement.source.json                        |  15 +-
 workbench/README.md                                |   2 +
 workbench/tests/revalidation-driver.test.mjs       |  49 ++++-
 12 files changed, 259 insertions(+), 248 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0024-workbench-minimal-candidate-builder/logs/revalidation-driver-tests.log
workbench/docs/M2C_REVALIDATION_WAIT_TEST_REVISION.md
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-21T13:55:52+08:00
Command: npm test --prefix workbench
Exit code: 0
Parsed test count: 41
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---

> ui-test-approved-workbench@0.1.0 test
> node --test tests/*.test.mjs

TAP version 13
# Subtest: state changes require exact local origin and JSON schema
ok 1 - state changes require exact local origin and JSON schema
  ---
  duration_ms: 62.3609
  type: 'test'
  ...
# Subtest: stop route accepts only an empty JSON object from local origin
ok 2 - stop route accepts only an empty JSON object from local origin
  ---
  duration_ms: 4.2388
  type: 'test'
  ...
# Subtest: build mutations require local origin and exact fixed schemas
ok 3 - build mutations require local origin and exact fixed schemas
  ---
  duration_ms: 111.0114
  type: 'test'
  ...
# Subtest: only registered web-visible unchanged task files are served
ok 4 - only registered web-visible unchanged task files are served
  ---
  duration_ms: 22.1451
  type: 'test'
  ...
# Subtest: failed candidate enables exactly one explicit revision and preserves both versions
ok 5 - failed candidate enables exactly one explicit revision and preserves both versions
  ---
  duration_ms: 167.4379
  type: 'test'
  ...
# {"type":"build_storage_failure","code":"EIO","operation":"append_lifecycle","at":"2026-09-21T05:55:52.990Z"}
# Subtest: 生命周期存储持续失败会降级服务并拒绝继续接纳建例
ok 6 - 生命周期存储持续失败会降级服务并拒绝继续接纳建例
  ---
  duration_ms: 37.2467
  type: 'test'
  ...
# {"type":"build_storage_failure","code":"EIO","operation":"background_completion","at":"2026-09-21T05:55:53.046Z"}
# Subtest: 后台completion最终状态持续写失败会被观察并关闭新建例入口
ok 7 - 后台completion最终状态持续写失败会被观察并关闭新建例入口
  ---
  duration_ms: 49.8912
  type: 'test'
  ...
# Subtest: duplicate start is rejected and cancel closes the owned attempt without restart
ok 8 - duplicate start is rejected and cancel closes the owned attempt without restart
  ---
  duration_ms: 35.1258
  type: 'test'
  ...
# Subtest: 单次复验授权只在Harness进程启动事件时消耗且不改旧预算
ok 9 - 单次复验授权只在Harness进程启动事件时消耗且不改旧预算
  ---
  duration_ms: 53.0867
  type: 'test'
  ...
# Subtest: candidate report parser keeps normal pass and concrete assertion mismatch separate
ok 10 - candidate report parser keeps normal pass and concrete assertion mismatch separate
  ---
  duration_ms: 14.7889
  type: 'test'
  ...
# Subtest: missing report and locator errors cannot become technical pass or specified mismatch
ok 11 - missing report and locator errors cannot become technical pass or specified mismatch
  ---
  duration_ms: 8.7561
  type: 'test'
  ...
# Subtest: M2-C stage budget persists across task ids and store restarts
ok 12 - M2-C stage budget persists across task ids and store restarts
  ---
  duration_ms: 31.7613
  type: 'test'
  ...
# Subtest: restart marks active build interrupted without replaying it
ok 13 - restart marks active build interrupted without replaying it
  ---
  duration_ms: 28.4253
  type: 'test'
  ...
# Subtest: task状态原子替换的短暂占用有限重试后成功
ok 14 - task状态原子替换的短暂占用有限重试后成功
  ---
  duration_ms: 95.1251
  type: 'test'
  ...
# Subtest: task状态持续写失败会显式返回错误而非静默成功
ok 15 - task状态持续写失败会显式返回错误而非静默成功
  ---
  duration_ms: 623.839
  type: 'test'
  ...
# Subtest: 协调进程被终止后重启保留逐事件记录、标中断且不重放预算
ok 16 - 协调进程被终止后重启保留逐事件记录、标中断且不重放预算
  ---
  duration_ms: 624.5159
  type: 'test'
  ...
# Subtest: approved run uses fixed argument arrays and a reduced environment
ok 17 - approved run uses fixed argument arrays and a reduced environment
  ---
  duration_ms: 71.2701
  type: 'test'
  ...
# Subtest: duplicate starts are rejected and stop targets only the owned process
ok 18 - duplicate starts are rejected and stop targets only the owned process
  ---
  duration_ms: 50.9233
  type: 'test'
  ...
# Subtest: unapproved, wrong-hash, traversal and illegal environment records are refused
ok 19 - unapproved, wrong-hash, traversal and illegal environment records are refused
  ---
  duration_ms: 90.9882
  type: 'test'
  ...
# Subtest: runtime-copy integrity failure preserves the raw passing report but blocks overall pass
ok 20 - runtime-copy integrity failure preserves the raw passing report but blocks overall pass
  ---
  duration_ms: 34.0133
  type: 'test'
  ...
# Subtest: only indexed media for the selected run can be read
ok 21 - only indexed media for the selected run can be read
  ---
  duration_ms: 88.681
  type: 'test'
  ...
# Subtest: changed media bytes are not served as the registered attachment
ok 22 - changed media bytes are not served as the registered attachment
  ---
  duration_ms: 10.6037
  type: 'test'
  ...
# Subtest: approved sorting asset is derived from the real frozen records
ok 23 - approved sorting asset is derived from the real frozen records
  ---
  duration_ms: 14.591
  type: 'test'
  ...
# Subtest: hash mismatch is rejected instead of becoming a new approval
ok 24 - hash mismatch is rejected instead of becoming a new approval
  ---
  duration_ms: 8.8069
  type: 'test'
  ...
# Subtest: complete passing report requires all registered steps and all media kinds
ok 25 - complete passing report requires all registered steps and all media kinds
  ---
  duration_ms: 28.028
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when all media are missing
ok 26 - raw passing result is not an overall pass when all media are missing
  ---
  duration_ms: 10.9682
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when screenshot is missing
ok 27 - raw passing result is not an overall pass when screenshot is missing
  ---
  duration_ms: 14.6171
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when video is missing
ok 28 - raw passing result is not an overall pass when video is missing
  ---
  duration_ms: 11.9868
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when trace is missing
ok 29 - raw passing result is not an overall pass when trace is missing
  ---
  duration_ms: 13.2604
  type: 'test'
  ...
# Subtest: assertion mismatch remains a failed test and later steps are not executed
ok 30 - assertion mismatch remains a failed test and later steps are not executed
  ---
  duration_ms: 13.8491
  type: 'test'
  ...
# Subtest: missing, corrupt, skipped and zero-target reports fail closed
ok 31 - missing, corrupt, skipped and zero-target reports fail closed
  ---
  duration_ms: 12.7189
  type: 'test'
  ...
# Subtest: exit code zero cannot override an incomplete step set
ok 32 - exit code zero cannot override an incomplete step set
  ---
  duration_ms: 5.7168
  type: 'test'
  ...
# Subtest: a passing Playwright report cannot override a non-normal execution terminal state
ok 33 - a passing Playwright report cannot override a non-normal execution terminal state
  ---
  duration_ms: 50.9299
  type: 'test'
  ...
# Subtest: error facts distinguish missing targets, strict conflicts, unavailable values and real value mismatches
ok 34 - error facts distinguish missing targets, strict conflicts, unavailable values and real value mismatches
  ---
  duration_ms: 0.7168
  type: 'test'
  ...
# Subtest: 复验驱动只等待本次task终态，不被旧历史终态提前满足
ok 35 - 复验驱动只等待本次task终态，不被旧历史终态提前满足
  ---
  duration_ms: 815.0727
  type: 'test'
  ...
# Subtest: 原扫描任意历史卡片逻辑无法通过同一task终态等待断言
ok 36 - 原扫描任意历史卡片逻辑无法通过同一task终态等待断言
  ---
  duration_ms: 809.6817
  type: 'test'
  ...
# Subtest: health endpoint reports the independent workbench
ok 37 - health endpoint reports the independent workbench
  ---
  duration_ms: 45.13
  type: 'test'
  ...
# Subtest: unknown routes fail closed
ok 38 - unknown routes fail closed
  ---
  duration_ms: 8.1881
  type: 'test'
  ...
# Subtest: asset registration is persistent and idempotent
ok 39 - asset registration is persistent and idempotent
  ---
  duration_ms: 24.093
  type: 'test'
  ...
# Subtest: runs remain readable and active records become interrupted after restart
ok 40 - runs remain readable and active records become interrupted after restart
  ---
  duration_ms: 29.5822
  type: 'test'
  ...
# Subtest: run ids cannot escape the data root
ok 41 - run ids cannot escape the data root
  ---
  duration_ms: 7.1312
  type: 'test'
  ...
1..41
# tests 41
# suites 0
# pass 41
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2292.1664
```

### Sync Record Status

```text
DRY-RUN: no derived changes for REQ-0024-workbench-minimal-candidate-builder; explicit implementation states retained, never inferred from verification.
```

### Check AI Context

- Exit code: `0`

```text
PASS ai-engineering-context checks
```

### Notes

终态等待回归测试补准；当前task_id实现满足pending与终态断言，原任意历史卡片扫描实现触发预期AssertionError；零模型、零Harness调用。
