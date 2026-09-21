# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-21T09:07:29+08:00`
- Record: `REQ-0021-workbench-m1-review-fixes`
- Change fingerprint: `2a6c686a0215a41bc185722764b0df0bcc97710cf01217bf0dea8f174930304f`
- Verification source: `collector-executed-v1`
- Verification state: `工程测试通过`
- Command: `npm --prefix workbench test`
- Exit code: `0`
- Test count: `25`
- Failure count: `0`
- Skipped count: `0`
- Log path: `docs/requirements/REQ-0021-workbench-m1-review-fixes/final-verification.log`
- Log SHA-256: `764d32866694711fb71f63e1f20ab1c9ed3308a5cf1e2683dbde7e163cb78acd`

### Git Status

```text
 M docs/modules/test-workbench.md
 M docs/requirements/REQ-0021-workbench-m1-review-fixes/00_user_requirement.md
 M docs/requirements/REQ-0021-workbench-m1-review-fixes/01_development_requirement.md
 M docs/requirements/REQ-0021-workbench-m1-review-fixes/02_design.md
 M docs/requirements/REQ-0021-workbench-m1-review-fixes/03_tasks.md
 M docs/requirements/REQ-0021-workbench-m1-review-fixes/04_verification.md
 M docs/requirements/REQ-0021-workbench-m1-review-fixes/05_trace.md
 M docs/requirements/REQ-0021-workbench-m1-review-fixes/change_log.md
 M docs/requirements/REQ-0021-workbench-m1-review-fixes/current_state.md
 M docs/requirements/REQ-0021-workbench-m1-review-fixes/delivery_evidence.md
 M docs/requirements/REQ-0021-workbench-m1-review-fixes/final-verification.log
 M docs/requirements/REQ-0021-workbench-m1-review-fixes/requirement.source.json
 M workbench/README.md
 M workbench/server/report.mjs
 M workbench/tests/report.test.mjs
?? workbench/docs/EVIDENCE_COMPLETENESS_REVISION.md
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/modules/test-workbench.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0021-workbench-m1-review-fixes/00_user_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0021-workbench-m1-review-fixes/01_development_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0021-workbench-m1-review-fixes/02_design.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0021-workbench-m1-review-fixes/03_tasks.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0021-workbench-m1-review-fixes/04_verification.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0021-workbench-m1-review-fixes/05_trace.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0021-workbench-m1-review-fixes/change_log.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0021-workbench-m1-review-fixes/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0021-workbench-m1-review-fixes/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0021-workbench-m1-review-fixes/final-verification.log', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0021-workbench-m1-review-fixes/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/report.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/tests/report.test.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/test-workbench.md                     |   4 +-
 .../00_user_requirement.md                         |   4 +-
 .../01_development_requirement.md                  |   1 +
 .../02_design.md                                   |   5 +-
 .../REQ-0021-workbench-m1-review-fixes/03_tasks.md |   1 +
 .../04_verification.md                             |   7 +-
 .../REQ-0021-workbench-m1-review-fixes/05_trace.md |   1 +
 .../change_log.md                                  |   1 +
 .../current_state.md                               |  11 +-
 .../delivery_evidence.md                           | 191 +++++++++++----------
 .../final-verification.log                         |  98 +++++++----
 .../requirement.source.json                        |  44 +++--
 workbench/README.md                                |   8 +-
 workbench/server/report.mjs                        |   6 +-
 workbench/tests/report.test.mjs                    |  41 ++++-
 15 files changed, 260 insertions(+), 163 deletions(-)
```

### Untracked Files

```text
workbench/docs/EVIDENCE_COMPLETENESS_REVISION.md
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-21T09:07:27+08:00
Command: npm --prefix workbench test
Exit code: 0
Parsed test count: 25
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---

> ui-test-approved-workbench@0.1.0 test
> node --test tests/*.test.mjs

TAP version 13
# Subtest: state changes require exact local origin and JSON schema
ok 1 - state changes require exact local origin and JSON schema
  ---
  duration_ms: 44.0854
  type: 'test'
  ...
# Subtest: stop route accepts only an empty JSON object from local origin
ok 2 - stop route accepts only an empty JSON object from local origin
  ---
  duration_ms: 3.3915
  type: 'test'
  ...
# Subtest: approved run uses fixed argument arrays and a reduced environment
ok 3 - approved run uses fixed argument arrays and a reduced environment
  ---
  duration_ms: 70.6186
  type: 'test'
  ...
# Subtest: duplicate starts are rejected and stop targets only the owned process
ok 4 - duplicate starts are rejected and stop targets only the owned process
  ---
  duration_ms: 49.6133
  type: 'test'
  ...
# Subtest: unapproved, wrong-hash, traversal and illegal environment records are refused
ok 5 - unapproved, wrong-hash, traversal and illegal environment records are refused
  ---
  duration_ms: 67.0392
  type: 'test'
  ...
# Subtest: runtime-copy integrity failure preserves the raw passing report but blocks overall pass
ok 6 - runtime-copy integrity failure preserves the raw passing report but blocks overall pass
  ---
  duration_ms: 28.1951
  type: 'test'
  ...
# Subtest: only indexed media for the selected run can be read
ok 7 - only indexed media for the selected run can be read
  ---
  duration_ms: 72.0114
  type: 'test'
  ...
# Subtest: changed media bytes are not served as the registered attachment
ok 8 - changed media bytes are not served as the registered attachment
  ---
  duration_ms: 6.9197
  type: 'test'
  ...
# Subtest: approved sorting asset is derived from the real frozen records
ok 9 - approved sorting asset is derived from the real frozen records
  ---
  duration_ms: 10.1784
  type: 'test'
  ...
# Subtest: hash mismatch is rejected instead of becoming a new approval
ok 10 - hash mismatch is rejected instead of becoming a new approval
  ---
  duration_ms: 5.9207
  type: 'test'
  ...
# Subtest: complete passing report requires all registered steps and all media kinds
ok 11 - complete passing report requires all registered steps and all media kinds
  ---
  duration_ms: 22.0027
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when all media are missing
ok 12 - raw passing result is not an overall pass when all media are missing
  ---
  duration_ms: 7.4
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when screenshot is missing
ok 13 - raw passing result is not an overall pass when screenshot is missing
  ---
  duration_ms: 13.1267
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when video is missing
ok 14 - raw passing result is not an overall pass when video is missing
  ---
  duration_ms: 12.6527
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when trace is missing
ok 15 - raw passing result is not an overall pass when trace is missing
  ---
  duration_ms: 12.2858
  type: 'test'
  ...
# Subtest: assertion mismatch remains a failed test and later steps are not executed
ok 16 - assertion mismatch remains a failed test and later steps are not executed
  ---
  duration_ms: 12.1854
  type: 'test'
  ...
# Subtest: missing, corrupt, skipped and zero-target reports fail closed
ok 17 - missing, corrupt, skipped and zero-target reports fail closed
  ---
  duration_ms: 13.7708
  type: 'test'
  ...
# Subtest: exit code zero cannot override an incomplete step set
ok 18 - exit code zero cannot override an incomplete step set
  ---
  duration_ms: 3.6233
  type: 'test'
  ...
# Subtest: a passing Playwright report cannot override a non-normal execution terminal state
ok 19 - a passing Playwright report cannot override a non-normal execution terminal state
  ---
  duration_ms: 30.9009
  type: 'test'
  ...
# Subtest: error facts distinguish missing targets, strict conflicts, unavailable values and real value mismatches
ok 20 - error facts distinguish missing targets, strict conflicts, unavailable values and real value mismatches
  ---
  duration_ms: 0.822
  type: 'test'
  ...
# Subtest: health endpoint reports the independent workbench
ok 21 - health endpoint reports the independent workbench
  ---
  duration_ms: 33.5251
  type: 'test'
  ...
# Subtest: unknown routes fail closed
ok 22 - unknown routes fail closed
  ---
  duration_ms: 7.3669
  type: 'test'
  ...
# Subtest: asset registration is persistent and idempotent
ok 23 - asset registration is persistent and idempotent
  ---
  duration_ms: 21.1933
  type: 'test'
  ...
# Subtest: runs remain readable and active records become interrupted after restart
ok 24 - runs remain readable and active records become interrupted after restart
  ---
  duration_ms: 20.2037
  type: 'test'
  ...
# Subtest: run ids cannot escape the data root
ok 25 - run ids cannot escape the data root
  ---
  duration_ms: 6.7144
  type: 'test'
  ...
1..25
# tests 25
# suites 0
# pass 25
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 361.8454
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

M1证据完整性关联修订：媒体组合修前/修后与既有真实运行离线重算见workbench/docs/EVIDENCE_COMPLETENESS_REVISION.md；未重跑业务组合。
