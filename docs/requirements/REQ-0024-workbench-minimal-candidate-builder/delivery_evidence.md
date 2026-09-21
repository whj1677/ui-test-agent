# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-21T11:23:06+08:00`
- Record: `REQ-0024-workbench-minimal-candidate-builder`
- Change fingerprint: `e0148ed88d36f64c7433650a7493f4634236fabe157eb9b1d5dbeece367b5225`
- Verification source: `collector-executed-v1`
- Verification state: `人工待确认`
- Command: `npm test --prefix workbench`
- Exit code: `0`
- Test count: `33`
- Failure count: `0`
- Skipped count: `0`
- Log path: `docs/requirements/REQ-0024-workbench-minimal-candidate-builder/logs/workbench-tests.log`
- Log SHA-256: `57db3d77977bc28d810f811006550deddee791975e2f165b17233e8d8cb921ed`

### Git Status

```text
 M docs/requirements/REQ-0024-workbench-minimal-candidate-builder/00_user_requirement.md
 M docs/requirements/REQ-0024-workbench-minimal-candidate-builder/02_design.md
 M docs/requirements/REQ-0024-workbench-minimal-candidate-builder/03_tasks.md
 M docs/requirements/REQ-0024-workbench-minimal-candidate-builder/04_verification.md
 M docs/requirements/REQ-0024-workbench-minimal-candidate-builder/05_trace.md
 M docs/requirements/REQ-0024-workbench-minimal-candidate-builder/change_log.md
 M docs/requirements/REQ-0024-workbench-minimal-candidate-builder/current_state.md
 M docs/requirements/REQ-0024-workbench-minimal-candidate-builder/requirement.source.json
 M workbench/README.md
 M workbench/package.json
 M workbench/server/build/manager.mjs
 M workbench/server/build/store.mjs
 M workbench/tests/build-manager.test.mjs
 M workbench/tests/build-store.test.mjs
?? docs/requirements/REQ-0024-workbench-minimal-candidate-builder/delivery_evidence.md
?? docs/requirements/REQ-0024-workbench-minimal-candidate-builder/logs/harness-probe-tests.log
?? docs/requirements/REQ-0024-workbench-minimal-candidate-builder/logs/workbench-tests.log
?? workbench/docs/M2C_ACCEPTANCE_REPORT.md
?? workbench/docs/evidence/m2c-build-interrupted.png
?? workbench/docs/evidence/m2c-build-summary.json
?? workbench/scripts/run-m2c-real.ps1
?? workbench/tests/build-real.integration.mjs
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/requirements/REQ-0024-workbench-minimal-candidate-builder/00_user_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0024-workbench-minimal-candidate-builder/02_design.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0024-workbench-minimal-candidate-builder/03_tasks.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0024-workbench-minimal-candidate-builder/04_verification.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0024-workbench-minimal-candidate-builder/05_trace.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0024-workbench-minimal-candidate-builder/change_log.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0024-workbench-minimal-candidate-builder/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0024-workbench-minimal-candidate-builder/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/package.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/manager.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/build/store.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/tests/build-manager.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/tests/build-store.test.mjs', LF will be replaced by CRLF the next time Git touches it
 .../00_user_requirement.md                         |  3 ++
 .../02_design.md                                   |  2 +
 .../03_tasks.md                                    |  8 ++--
 .../04_verification.md                             | 11 ++---
 .../05_trace.md                                    | 12 +++---
 .../change_log.md                                  |  1 +
 .../current_state.md                               | 23 ++++++-----
 .../requirement.source.json                        | 47 ++++++++++++----------
 workbench/README.md                                |  2 +
 workbench/package.json                             |  1 +
 workbench/server/build/manager.mjs                 |  5 +++
 workbench/server/build/store.mjs                   | 21 +++++++++-
 workbench/tests/build-manager.test.mjs             |  4 +-
 workbench/tests/build-store.test.mjs               | 11 ++++-
 14 files changed, 100 insertions(+), 51 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0024-workbench-minimal-candidate-builder/delivery_evidence.md
docs/requirements/REQ-0024-workbench-minimal-candidate-builder/logs/harness-probe-tests.log
docs/requirements/REQ-0024-workbench-minimal-candidate-builder/logs/workbench-tests.log
workbench/docs/M2C_ACCEPTANCE_REPORT.md
workbench/docs/evidence/m2c-build-interrupted.png
workbench/docs/evidence/m2c-build-summary.json
workbench/scripts/run-m2c-real.ps1
workbench/tests/build-real.integration.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-21T11:23:04+08:00
Command: npm test --prefix workbench
Exit code: 0
Parsed test count: 33
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---

> ui-test-approved-workbench@0.1.0 test
> node --test tests/*.test.mjs

TAP version 13
# Subtest: state changes require exact local origin and JSON schema
ok 1 - state changes require exact local origin and JSON schema
  ---
  duration_ms: 58.7704
  type: 'test'
  ...
# Subtest: stop route accepts only an empty JSON object from local origin
ok 2 - stop route accepts only an empty JSON object from local origin
  ---
  duration_ms: 5.6888
  type: 'test'
  ...
# Subtest: build mutations require local origin and exact fixed schemas
ok 3 - build mutations require local origin and exact fixed schemas
  ---
  duration_ms: 103.8749
  type: 'test'
  ...
# Subtest: only registered web-visible unchanged task files are served
ok 4 - only registered web-visible unchanged task files are served
  ---
  duration_ms: 20.2646
  type: 'test'
  ...
# Subtest: failed candidate enables exactly one explicit revision and preserves both versions
ok 5 - failed candidate enables exactly one explicit revision and preserves both versions
  ---
  duration_ms: 139.9531
  type: 'test'
  ...
# Subtest: duplicate start is rejected and cancel closes the owned attempt without restart
ok 6 - duplicate start is rejected and cancel closes the owned attempt without restart
  ---
  duration_ms: 68.6753
  type: 'test'
  ...
# Subtest: candidate report parser keeps normal pass and concrete assertion mismatch separate
ok 7 - candidate report parser keeps normal pass and concrete assertion mismatch separate
  ---
  duration_ms: 14.9753
  type: 'test'
  ...
# Subtest: missing report and locator errors cannot become technical pass or specified mismatch
ok 8 - missing report and locator errors cannot become technical pass or specified mismatch
  ---
  duration_ms: 5.6572
  type: 'test'
  ...
# Subtest: M2-C stage budget persists across task ids and store restarts
ok 9 - M2-C stage budget persists across task ids and store restarts
  ---
  duration_ms: 31.3515
  type: 'test'
  ...
# Subtest: restart marks active build interrupted without replaying it
ok 10 - restart marks active build interrupted without replaying it
  ---
  duration_ms: 21.9962
  type: 'test'
  ...
# Subtest: approved run uses fixed argument arrays and a reduced environment
ok 11 - approved run uses fixed argument arrays and a reduced environment
  ---
  duration_ms: 69.0433
  type: 'test'
  ...
# Subtest: duplicate starts are rejected and stop targets only the owned process
ok 12 - duplicate starts are rejected and stop targets only the owned process
  ---
  duration_ms: 54.154
  type: 'test'
  ...
# Subtest: unapproved, wrong-hash, traversal and illegal environment records are refused
ok 13 - unapproved, wrong-hash, traversal and illegal environment records are refused
  ---
  duration_ms: 79.3159
  type: 'test'
  ...
# Subtest: runtime-copy integrity failure preserves the raw passing report but blocks overall pass
ok 14 - runtime-copy integrity failure preserves the raw passing report but blocks overall pass
  ---
  duration_ms: 31.5761
  type: 'test'
  ...
# Subtest: only indexed media for the selected run can be read
ok 15 - only indexed media for the selected run can be read
  ---
  duration_ms: 94.3228
  type: 'test'
  ...
# Subtest: changed media bytes are not served as the registered attachment
ok 16 - changed media bytes are not served as the registered attachment
  ---
  duration_ms: 6.4323
  type: 'test'
  ...
# Subtest: approved sorting asset is derived from the real frozen records
ok 17 - approved sorting asset is derived from the real frozen records
  ---
  duration_ms: 13.3349
  type: 'test'
  ...
# Subtest: hash mismatch is rejected instead of becoming a new approval
ok 18 - hash mismatch is rejected instead of becoming a new approval
  ---
  duration_ms: 7.5203
  type: 'test'
  ...
# Subtest: complete passing report requires all registered steps and all media kinds
ok 19 - complete passing report requires all registered steps and all media kinds
  ---
  duration_ms: 30.2707
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when all media are missing
ok 20 - raw passing result is not an overall pass when all media are missing
  ---
  duration_ms: 11.0084
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when screenshot is missing
ok 21 - raw passing result is not an overall pass when screenshot is missing
  ---
  duration_ms: 12.9592
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when video is missing
ok 22 - raw passing result is not an overall pass when video is missing
  ---
  duration_ms: 11.9035
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when trace is missing
ok 23 - raw passing result is not an overall pass when trace is missing
  ---
  duration_ms: 12.0911
  type: 'test'
  ...
# Subtest: assertion mismatch remains a failed test and later steps are not executed
ok 24 - assertion mismatch remains a failed test and later steps are not executed
  ---
  duration_ms: 13.1324
  type: 'test'
  ...
# Subtest: missing, corrupt, skipped and zero-target reports fail closed
ok 25 - missing, corrupt, skipped and zero-target reports fail closed
  ---
  duration_ms: 12.5903
  type: 'test'
  ...
# Subtest: exit code zero cannot override an incomplete step set
ok 26 - exit code zero cannot override an incomplete step set
  ---
  duration_ms: 4.7718
  type: 'test'
  ...
# Subtest: a passing Playwright report cannot override a non-normal execution terminal state
ok 27 - a passing Playwright report cannot override a non-normal execution terminal state
  ---
  duration_ms: 39.2135
  type: 'test'
  ...
# Subtest: error facts distinguish missing targets, strict conflicts, unavailable values and real value mismatches
ok 28 - error facts distinguish missing targets, strict conflicts, unavailable values and real value mismatches
  ---
  duration_ms: 0.7618
  type: 'test'
  ...
# Subtest: health endpoint reports the independent workbench
ok 29 - health endpoint reports the independent workbench
  ---
  duration_ms: 43.5866
  type: 'test'
  ...
# Subtest: unknown routes fail closed
ok 30 - unknown routes fail closed
  ---
  duration_ms: 5.9944
  type: 'test'
  ...
# Subtest: asset registration is persistent and idempotent
ok 31 - asset registration is persistent and idempotent
  ---
  duration_ms: 25.1946
  type: 'test'
  ...
# Subtest: runs remain readable and active records become interrupted after restart
ok 32 - runs remain readable and active records become interrupted after restart
  ---
  duration_ms: 21.8189
  type: 'test'
  ...
# Subtest: run ids cannot escape the data root
ok 33 - run ids cannot escape the data root
  ---
  duration_ms: 5.7592
  type: 'test'
  ...
1..33
# tests 33
# suites 0
# pass 33
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 470.579
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

workbench工程回归记录；M2-C整体结论以验收报告的真实中断事实为准。
