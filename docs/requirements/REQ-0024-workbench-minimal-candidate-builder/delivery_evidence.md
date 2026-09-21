# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-21T12:23:07+08:00`
- Record: `REQ-0024-workbench-minimal-candidate-builder`
- Change fingerprint: `507effeb62f7288c5577487e8d519b81d1c4e4205ff049a18a84fa5c0df36363`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `npm test --prefix workbench`
- Exit code: `0`
- Test count: `40`
- Failure count: `0`
- Skipped count: `0`
- Log path: `docs/requirements/REQ-0024-workbench-minimal-candidate-builder/logs/delivery-verification.log`
- Log SHA-256: `9491d4a22f3604dedfba4c94de95079702f060db3010a3cd61c661db8e644907`

### Git Status

```text
 M docs/requirements/REQ-0024-workbench-minimal-candidate-builder/00_user_requirement.md
 M docs/requirements/REQ-0024-workbench-minimal-candidate-builder/01_development_requirement.md
 M docs/requirements/REQ-0024-workbench-minimal-candidate-builder/02_design.md
 M docs/requirements/REQ-0024-workbench-minimal-candidate-builder/04_verification.md
 M docs/requirements/REQ-0024-workbench-minimal-candidate-builder/05_trace.md
 M docs/requirements/REQ-0024-workbench-minimal-candidate-builder/change_log.md
 M docs/requirements/REQ-0024-workbench-minimal-candidate-builder/current_state.md
 M docs/requirements/REQ-0024-workbench-minimal-candidate-builder/delivery_evidence.md
 M docs/requirements/REQ-0024-workbench-minimal-candidate-builder/logs/harness-probe-tests.log
 M docs/requirements/REQ-0024-workbench-minimal-candidate-builder/logs/workbench-tests.log
 M docs/requirements/REQ-0024-workbench-minimal-candidate-builder/requirement.source.json
 M harness-probe/config/playwright.config.mjs
 M harness-probe/src/verify-candidate.mjs
 M workbench/README.md
 M workbench/package.json
 M workbench/scripts/run-m2c-real.ps1
 M workbench/server/app.mjs
 M workbench/server/build/files.mjs
 M workbench/server/build/manager.mjs
 M workbench/server/build/store.mjs
 M workbench/server/index.mjs
 M workbench/tests/build-manager.test.mjs
 M workbench/tests/smoke.test.mjs
 M workbench/web/app.js
?? docs/requirements/REQ-0024-workbench-minimal-candidate-builder/logs/browser-tests.log
?? docs/requirements/REQ-0024-workbench-minimal-candidate-builder/logs/delivery-verification.log
?? workbench/docs/M2C_REVALIDATION_REPORT.md
?? workbench/docs/evidence/m2c-revalidation-cancelled.png
?? workbench/server/register-m2c-revalidation.mjs
?? workbench/tests/build-revalidation-readback.integration.mjs
?? workbench/tests/build-revalidation.integration.mjs
?? workbench/tests/revalidation-driver.test.mjs
?? workbench/tests/support/revalidation-driver.mjs
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/requirements/REQ-0024-workbench-minimal-candidate-builder/00_user_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0024-workbench-minimal-candidate-builder/01_development_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0024-workbench-minimal-candidate-builder/02_design.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0024-workbench-minimal-candidate-builder/04_verification.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0024-workbench-minimal-candidate-builder/05_trace.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0024-workbench-minimal-candidate-builder/change_log.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0024-workbench-minimal-candidate-builder/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0024-workbench-minimal-candidate-builder/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0024-workbench-minimal-candidate-builder/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'harness-probe/config/playwright.config.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'harness-probe/src/verify-candidate.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/package.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/scripts/run-m2c-real.ps1', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/app.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/files.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/manager.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/store.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/index.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/tests/build-manager.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/tests/smoke.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/web/app.js', LF will be replaced by CRLF the next time Git touches it
 .../00_user_requirement.md                         |   3 +-
 .../01_development_requirement.md                  |   2 +-
 .../02_design.md                                   |   4 +-
 .../04_verification.md                             |  10 +-
 .../05_trace.md                                    |   1 +
 .../change_log.md                                  |   1 +
 .../current_state.md                               |  12 +-
 .../delivery_evidence.md                           | 370 ++++++++++++++++++---
 .../logs/harness-probe-tests.log                   |  54 +--
 .../logs/workbench-tests.log                       | 164 ++++-----
 .../requirement.source.json                        |  25 +-
 harness-probe/config/playwright.config.mjs         |   4 +
 harness-probe/src/verify-candidate.mjs             |   1 +
 workbench/README.md                                |   2 +
 workbench/package.json                             |   3 +
 workbench/scripts/run-m2c-real.ps1                 |   4 +-
 workbench/server/app.mjs                           |   3 +
 workbench/server/build/files.mjs                   |   7 +
 workbench/server/build/manager.mjs                 |  54 ++-
 workbench/server/build/store.mjs                   |  47 +++
 workbench/server/index.mjs                         |   1 +
 workbench/tests/build-manager.test.mjs             |  36 +-
 workbench/tests/smoke.test.mjs                     |   1 +
 workbench/web/app.js                               |  11 +-
 24 files changed, 627 insertions(+), 193 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0024-workbench-minimal-candidate-builder/logs/browser-tests.log
docs/requirements/REQ-0024-workbench-minimal-candidate-builder/logs/delivery-verification.log
workbench/docs/M2C_REVALIDATION_REPORT.md
workbench/docs/evidence/m2c-revalidation-cancelled.png
workbench/server/register-m2c-revalidation.mjs
workbench/tests/build-revalidation-readback.integration.mjs
workbench/tests/build-revalidation.integration.mjs
workbench/tests/revalidation-driver.test.mjs
workbench/tests/support/revalidation-driver.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-21T12:23:04+08:00
Command: npm test --prefix workbench
Exit code: 0
Parsed test count: 40
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---

> ui-test-approved-workbench@0.1.0 test
> node --test tests/*.test.mjs

TAP version 13
# Subtest: state changes require exact local origin and JSON schema
ok 1 - state changes require exact local origin and JSON schema
  ---
  duration_ms: 44.7874
  type: 'test'
  ...
# Subtest: stop route accepts only an empty JSON object from local origin
ok 2 - stop route accepts only an empty JSON object from local origin
  ---
  duration_ms: 4.5525
  type: 'test'
  ...
# Subtest: build mutations require local origin and exact fixed schemas
ok 3 - build mutations require local origin and exact fixed schemas
  ---
  duration_ms: 81.8274
  type: 'test'
  ...
# Subtest: only registered web-visible unchanged task files are served
ok 4 - only registered web-visible unchanged task files are served
  ---
  duration_ms: 18.2581
  type: 'test'
  ...
# Subtest: failed candidate enables exactly one explicit revision and preserves both versions
ok 5 - failed candidate enables exactly one explicit revision and preserves both versions
  ---
  duration_ms: 170.2134
  type: 'test'
  ...
# {"type":"build_storage_failure","code":"EIO","operation":"append_lifecycle","at":"2026-09-21T04:23:04.945Z"}
# Subtest: 生命周期存储持续失败会降级服务并拒绝继续接纳建例
ok 6 - 生命周期存储持续失败会降级服务并拒绝继续接纳建例
  ---
  duration_ms: 36.9188
  type: 'test'
  ...
# {"type":"build_storage_failure","code":"EIO","operation":"background_completion","at":"2026-09-21T04:23:04.992Z"}
# Subtest: 后台completion最终状态持续写失败会被观察并关闭新建例入口
ok 7 - 后台completion最终状态持续写失败会被观察并关闭新建例入口
  ---
  duration_ms: 39.77
  type: 'test'
  ...
# Subtest: duplicate start is rejected and cancel closes the owned attempt without restart
ok 8 - duplicate start is rejected and cancel closes the owned attempt without restart
  ---
  duration_ms: 31.4646
  type: 'test'
  ...
# Subtest: 单次复验授权只在Harness进程启动事件时消耗且不改旧预算
ok 9 - 单次复验授权只在Harness进程启动事件时消耗且不改旧预算
  ---
  duration_ms: 44.9759
  type: 'test'
  ...
# Subtest: candidate report parser keeps normal pass and concrete assertion mismatch separate
ok 10 - candidate report parser keeps normal pass and concrete assertion mismatch separate
  ---
  duration_ms: 12.5972
  type: 'test'
  ...
# Subtest: missing report and locator errors cannot become technical pass or specified mismatch
ok 11 - missing report and locator errors cannot become technical pass or specified mismatch
  ---
  duration_ms: 6.5841
  type: 'test'
  ...
# Subtest: M2-C stage budget persists across task ids and store restarts
ok 12 - M2-C stage budget persists across task ids and store restarts
  ---
  duration_ms: 33.7021
  type: 'test'
  ...
# Subtest: restart marks active build interrupted without replaying it
ok 13 - restart marks active build interrupted without replaying it
  ---
  duration_ms: 28.4241
  type: 'test'
  ...
# Subtest: task状态原子替换的短暂占用有限重试后成功
ok 14 - task状态原子替换的短暂占用有限重试后成功
  ---
  duration_ms: 98.7485
  type: 'test'
  ...
# Subtest: task状态持续写失败会显式返回错误而非静默成功
ok 15 - task状态持续写失败会显式返回错误而非静默成功
  ---
  duration_ms: 636.3639
  type: 'test'
  ...
# Subtest: 协调进程被终止后重启保留逐事件记录、标中断且不重放预算
ok 16 - 协调进程被终止后重启保留逐事件记录、标中断且不重放预算
  ---
  duration_ms: 674.411
  type: 'test'
  ...
# Subtest: approved run uses fixed argument arrays and a reduced environment
ok 17 - approved run uses fixed argument arrays and a reduced environment
  ---
  duration_ms: 67.6204
  type: 'test'
  ...
# Subtest: duplicate starts are rejected and stop targets only the owned process
ok 18 - duplicate starts are rejected and stop targets only the owned process
  ---
  duration_ms: 51.3265
  type: 'test'
  ...
# Subtest: unapproved, wrong-hash, traversal and illegal environment records are refused
ok 19 - unapproved, wrong-hash, traversal and illegal environment records are refused
  ---
  duration_ms: 77.8452
  type: 'test'
  ...
# Subtest: runtime-copy integrity failure preserves the raw passing report but blocks overall pass
ok 20 - runtime-copy integrity failure preserves the raw passing report but blocks overall pass
  ---
  duration_ms: 33.8933
  type: 'test'
  ...
# Subtest: only indexed media for the selected run can be read
ok 21 - only indexed media for the selected run can be read
  ---
  duration_ms: 78.6148
  type: 'test'
  ...
# Subtest: changed media bytes are not served as the registered attachment
ok 22 - changed media bytes are not served as the registered attachment
  ---
  duration_ms: 6.9861
  type: 'test'
  ...
# Subtest: approved sorting asset is derived from the real frozen records
ok 23 - approved sorting asset is derived from the real frozen records
  ---
  duration_ms: 13.7068
  type: 'test'
  ...
# Subtest: hash mismatch is rejected instead of becoming a new approval
ok 24 - hash mismatch is rejected instead of becoming a new approval
  ---
  duration_ms: 6.5929
  type: 'test'
  ...
# Subtest: complete passing report requires all registered steps and all media kinds
ok 25 - complete passing report requires all registered steps and all media kinds
  ---
  duration_ms: 23.5305
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when all media are missing
ok 26 - raw passing result is not an overall pass when all media are missing
  ---
  duration_ms: 8.9221
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when screenshot is missing
ok 27 - raw passing result is not an overall pass when screenshot is missing
  ---
  duration_ms: 13.5825
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when video is missing
ok 28 - raw passing result is not an overall pass when video is missing
  ---
  duration_ms: 12.1096
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when trace is missing
ok 29 - raw passing result is not an overall pass when trace is missing
  ---
  duration_ms: 12.3314
  type: 'test'
  ...
# Subtest: assertion mismatch remains a failed test and later steps are not executed
ok 30 - assertion mismatch remains a failed test and later steps are not executed
  ---
  duration_ms: 15.0045
  type: 'test'
  ...
# Subtest: missing, corrupt, skipped and zero-target reports fail closed
ok 31 - missing, corrupt, skipped and zero-target reports fail closed
  ---
  duration_ms: 13.6651
  type: 'test'
  ...
# Subtest: exit code zero cannot override an incomplete step set
ok 32 - exit code zero cannot override an incomplete step set
  ---
  duration_ms: 4.4154
  type: 'test'
  ...
# Subtest: a passing Playwright report cannot override a non-normal execution terminal state
ok 33 - a passing Playwright report cannot override a non-normal execution terminal state
  ---
  duration_ms: 41.9121
  type: 'test'
  ...
# Subtest: error facts distinguish missing targets, strict conflicts, unavailable values and real value mismatches
ok 34 - error facts distinguish missing targets, strict conflicts, unavailable values and real value mismatches
  ---
  duration_ms: 0.9961
  type: 'test'
  ...
# Subtest: 复验驱动只等待本次task终态，不被旧历史终态提前满足
ok 35 - 复验驱动只等待本次task终态，不被旧历史终态提前满足
  ---
  duration_ms: 808.08
  type: 'test'
  ...
# Subtest: health endpoint reports the independent workbench
ok 36 - health endpoint reports the independent workbench
  ---
  duration_ms: 42.4603
  type: 'test'
  ...
# Subtest: unknown routes fail closed
ok 37 - unknown routes fail closed
  ---
  duration_ms: 5.9111
  type: 'test'
  ...
# Subtest: asset registration is persistent and idempotent
ok 38 - asset registration is persistent and idempotent
  ---
  duration_ms: 21.0696
  type: 'test'
  ...
# Subtest: runs remain readable and active records become interrupted after restart
ok 39 - runs remain readable and active records become interrupted after restart
  ---
  duration_ms: 22.6237
  type: 'test'
  ...
# Subtest: run ids cannot escape the data root
ok 40 - run ids cannot escape the data root
  ---
  duration_ms: 7.1336
  type: 'test'
  ...
1..40
# tests 40
# suites 0
# pass 40
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1677.9619
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

M2-C单次真实复验C类收口；Harness授权1/1已消耗且未重跑；harness-probe 24/24及三个浏览器读回命令另见REQ日志。
