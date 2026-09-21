# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-21T08:44:04+08:00`
- Record: `REQ-0021-workbench-m1-review-fixes`
- Change fingerprint: `2774bae57230f9b4d0e030effa86ccbfb60ff121dcfc7463e10b7c5fd09ce7b4`
- Verification source: `collector-executed-v1`
- Verification state: `工程测试通过`
- Command: `npm --prefix workbench test`
- Exit code: `0`
- Test count: `21`
- Failure count: `0`
- Skipped count: `0`
- Log path: `docs/requirements/REQ-0021-workbench-m1-review-fixes/final-verification.log`
- Log SHA-256: `06ce54b98492b0e0e2aa34ac5085aea66025747e61b3a03c3ca29c415c8ad9b9`

### Git Status

```text
 M docs/modules/test-workbench.md
 M docs/requirements/README.md
 M workbench/README.md
 M workbench/server/report.mjs
 M workbench/tests/browser.integration.mjs
 M workbench/tests/executor.test.mjs
 M workbench/tests/real-workbench.integration.mjs
 M workbench/tests/report.test.mjs
 M workbench/web/app.js
?? docs/requirements/REQ-0021-workbench-m1-review-fixes/00_user_requirement.md
?? docs/requirements/REQ-0021-workbench-m1-review-fixes/01_development_requirement.md
?? docs/requirements/REQ-0021-workbench-m1-review-fixes/02_design.md
?? docs/requirements/REQ-0021-workbench-m1-review-fixes/03_tasks.md
?? docs/requirements/REQ-0021-workbench-m1-review-fixes/04_verification.md
?? docs/requirements/REQ-0021-workbench-m1-review-fixes/05_trace.md
?? docs/requirements/REQ-0021-workbench-m1-review-fixes/change_log.md
?? docs/requirements/REQ-0021-workbench-m1-review-fixes/current_state.md
?? docs/requirements/REQ-0021-workbench-m1-review-fixes/delivery_evidence.md
?? docs/requirements/REQ-0021-workbench-m1-review-fixes/final-verification.log
?? docs/requirements/REQ-0021-workbench-m1-review-fixes/requirement.source.json
?? workbench/docs/REVIEW_FIX_REPORT.md
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/modules/test-workbench.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/report.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/tests/browser.integration.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/tests/executor.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/tests/real-workbench.integration.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/tests/report.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/web/app.js', LF will be replaced by CRLF the next time Git touches it
 docs/modules/test-workbench.md                 |  6 ++--
 docs/requirements/README.md                    |  2 ++
 workbench/README.md                            | 12 ++++---
 workbench/server/report.mjs                    | 10 +++---
 workbench/tests/browser.integration.mjs        | 15 +++++++-
 workbench/tests/executor.test.mjs              | 23 ++++++++++++
 workbench/tests/real-workbench.integration.mjs |  6 ++++
 workbench/tests/report.test.mjs                | 48 +++++++++++++++++++++++++-
 workbench/web/app.js                           | 26 +++++++++++---
 9 files changed, 130 insertions(+), 18 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0021-workbench-m1-review-fixes/00_user_requirement.md
docs/requirements/REQ-0021-workbench-m1-review-fixes/01_development_requirement.md
docs/requirements/REQ-0021-workbench-m1-review-fixes/02_design.md
docs/requirements/REQ-0021-workbench-m1-review-fixes/03_tasks.md
docs/requirements/REQ-0021-workbench-m1-review-fixes/04_verification.md
docs/requirements/REQ-0021-workbench-m1-review-fixes/05_trace.md
docs/requirements/REQ-0021-workbench-m1-review-fixes/change_log.md
docs/requirements/REQ-0021-workbench-m1-review-fixes/current_state.md
docs/requirements/REQ-0021-workbench-m1-review-fixes/delivery_evidence.md
docs/requirements/REQ-0021-workbench-m1-review-fixes/final-verification.log
docs/requirements/REQ-0021-workbench-m1-review-fixes/requirement.source.json
workbench/docs/REVIEW_FIX_REPORT.md
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-21T08:44:02+08:00
Command: npm --prefix workbench test
Exit code: 0
Parsed test count: 21
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---

> ui-test-approved-workbench@0.1.0 test
> node --test tests/*.test.mjs

TAP version 13
# Subtest: state changes require exact local origin and JSON schema
ok 1 - state changes require exact local origin and JSON schema
  ---
  duration_ms: 37.617
  type: 'test'
  ...
# Subtest: stop route accepts only an empty JSON object from local origin
ok 2 - stop route accepts only an empty JSON object from local origin
  ---
  duration_ms: 2.6442
  type: 'test'
  ...
# Subtest: approved run uses fixed argument arrays and a reduced environment
ok 3 - approved run uses fixed argument arrays and a reduced environment
  ---
  duration_ms: 71.9532
  type: 'test'
  ...
# Subtest: duplicate starts are rejected and stop targets only the owned process
ok 4 - duplicate starts are rejected and stop targets only the owned process
  ---
  duration_ms: 49.3224
  type: 'test'
  ...
# Subtest: unapproved, wrong-hash, traversal and illegal environment records are refused
ok 5 - unapproved, wrong-hash, traversal and illegal environment records are refused
  ---
  duration_ms: 53.053
  type: 'test'
  ...
# Subtest: runtime-copy integrity failure preserves the raw passing report but blocks overall pass
ok 6 - runtime-copy integrity failure preserves the raw passing report but blocks overall pass
  ---
  duration_ms: 23.6031
  type: 'test'
  ...
# Subtest: only indexed media for the selected run can be read
ok 7 - only indexed media for the selected run can be read
  ---
  duration_ms: 75.5862
  type: 'test'
  ...
# Subtest: changed media bytes are not served as the registered attachment
ok 8 - changed media bytes are not served as the registered attachment
  ---
  duration_ms: 7.1903
  type: 'test'
  ...
# Subtest: approved sorting asset is derived from the real frozen records
ok 9 - approved sorting asset is derived from the real frozen records
  ---
  duration_ms: 11.9085
  type: 'test'
  ...
# Subtest: hash mismatch is rejected instead of becoming a new approval
ok 10 - hash mismatch is rejected instead of becoming a new approval
  ---
  duration_ms: 6.3919
  type: 'test'
  ...
# Subtest: complete passing report requires all registered steps and all media kinds
ok 11 - complete passing report requires all registered steps and all media kinds
  ---
  duration_ms: 20.6205
  type: 'test'
  ...
# Subtest: assertion mismatch remains a failed test and later steps are not executed
ok 12 - assertion mismatch remains a failed test and later steps are not executed
  ---
  duration_ms: 4.6097
  type: 'test'
  ...
# Subtest: missing, corrupt, skipped and zero-target reports fail closed
ok 13 - missing, corrupt, skipped and zero-target reports fail closed
  ---
  duration_ms: 12.2569
  type: 'test'
  ...
# Subtest: exit code zero cannot override an incomplete step set
ok 14 - exit code zero cannot override an incomplete step set
  ---
  duration_ms: 4.5971
  type: 'test'
  ...
# Subtest: a passing Playwright report cannot override a non-normal execution terminal state
ok 15 - a passing Playwright report cannot override a non-normal execution terminal state
  ---
  duration_ms: 18.7792
  type: 'test'
  ...
# Subtest: error facts distinguish missing targets, strict conflicts, unavailable values and real value mismatches
ok 16 - error facts distinguish missing targets, strict conflicts, unavailable values and real value mismatches
  ---
  duration_ms: 1.2442
  type: 'test'
  ...
# Subtest: health endpoint reports the independent workbench
ok 17 - health endpoint reports the independent workbench
  ---
  duration_ms: 37.979
  type: 'test'
  ...
# Subtest: unknown routes fail closed
ok 18 - unknown routes fail closed
  ---
  duration_ms: 4.6158
  type: 'test'
  ...
# Subtest: asset registration is persistent and idempotent
ok 19 - asset registration is persistent and idempotent
  ---
  duration_ms: 22.4744
  type: 'test'
  ...
# Subtest: runs remain readable and active records become interrupted after restart
ok 20 - runs remain readable and active records become interrupted after restart
  ---
  duration_ms: 22.9575
  type: 'test'
  ...
# Subtest: run ids cannot escape the data root
ok 21 - run ids cannot escape the data root
  ---
  duration_ms: 6.5699
  type: 'test'
  ...
1..21
# tests 21
# suites 0
# pass 21
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 335.321
```

### Sync Record Status

```text
DRY-RUN: no derived changes for REQ-0021-workbench-m1-review-fixes; explicit implementation states retained, never inferred from verification.
```

### Check AI Context

- Exit code: `0`

```text
PASS ai-engineering-context checks
```

### Notes

M1三项复审修复：修前失败证据、新Chromium流及新真实normal/fault组合见workbench/docs/REVIEW_FIX_REPORT.md。
