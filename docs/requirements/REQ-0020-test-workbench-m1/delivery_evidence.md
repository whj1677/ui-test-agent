# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-20T23:42:47+08:00`
- Record: `REQ-0020-test-workbench-m1`
- Change fingerprint: `08bc36ba4d9b3810215b94d1bc7df43712955259e68910a391da6c19ce01cd27`
- Verification source: `collector-executed-v1`
- Verification state: `工程测试通过`
- Command: `npm --prefix workbench test`
- Exit code: `0`
- Test count: `18`
- Failure count: `0`
- Skipped count: `0`
- Log path: `docs/requirements/REQ-0020-test-workbench-m1/final-verification.log`
- Log SHA-256: `d6a47513ce046ca81580098a15db6dc2e701e165e913de858cc0ce5512a4678b`

### Git Status

```text
A  docs/modules/test-workbench.md
M  docs/requirements/REQ-0020-test-workbench-m1/02_design.md
M  docs/requirements/REQ-0020-test-workbench-m1/03_tasks.md
M  docs/requirements/REQ-0020-test-workbench-m1/04_verification.md
M  docs/requirements/REQ-0020-test-workbench-m1/05_trace.md
M  docs/requirements/REQ-0020-test-workbench-m1/change_log.md
M  docs/requirements/REQ-0020-test-workbench-m1/current_state.md
AM docs/requirements/REQ-0020-test-workbench-m1/delivery_evidence.md
AM docs/requirements/REQ-0020-test-workbench-m1/final-verification.log
M  docs/requirements/REQ-0020-test-workbench-m1/requirement.source.json
M  workbench/README.md
AM workbench/docs/ACCEPTANCE_REPORT.md
A  workbench/docs/evidence/fault-result.png
A  workbench/docs/evidence/normal-result.png
A  workbench/docs/evidence/restart-history.png
M  workbench/package.json
A  workbench/tests/real-workbench.integration.mjs
A  workbench/tests/restart-history.integration.mjs
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/requirements/REQ-0020-test-workbench-m1/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0020-test-workbench-m1/final-verification.log', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/docs/ACCEPTANCE_REPORT.md', LF will be replaced by CRLF the next time Git touches it
 docs/modules/test-workbench.md                     |  43 ++++
 .../REQ-0020-test-workbench-m1/02_design.md        |   2 +-
 .../REQ-0020-test-workbench-m1/03_tasks.md         |   2 +-
 .../REQ-0020-test-workbench-m1/04_verification.md  |  12 +-
 .../REQ-0020-test-workbench-m1/05_trace.md         |   7 +-
 .../REQ-0020-test-workbench-m1/change_log.md       |   1 +
 .../REQ-0020-test-workbench-m1/current_state.md    |  16 +-
 .../delivery_evidence.md                           | 225 +++++++++++++++++++++
 .../final-verification.log                         | 131 ++++++++++++
 .../requirement.source.json                        |  30 +--
 workbench/README.md                                |  21 ++
 workbench/docs/ACCEPTANCE_REPORT.md                |  91 +++++++++
 workbench/docs/evidence/fault-result.png           | Bin 0 -> 249734 bytes
 workbench/docs/evidence/normal-result.png          | Bin 0 -> 204578 bytes
 workbench/docs/evidence/restart-history.png        | Bin 0 -> 249745 bytes
 workbench/package.json                             |   2 +
 workbench/tests/real-workbench.integration.mjs     | 142 +++++++++++++
 workbench/tests/restart-history.integration.mjs    |  38 ++++
 18 files changed, 731 insertions(+), 32 deletions(-)
```

### Untracked Files

```text
(none)
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-20T23:42:45+08:00
Command: npm --prefix workbench test
Exit code: 0
Parsed test count: 18
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---

> ui-test-approved-workbench@0.1.0 test
> node --test tests/*.test.mjs

TAP version 13
# Subtest: state changes require exact local origin and JSON schema
ok 1 - state changes require exact local origin and JSON schema
  ---
  duration_ms: 39.9548
  type: 'test'
  ...
# Subtest: stop route accepts only an empty JSON object from local origin
ok 2 - stop route accepts only an empty JSON object from local origin
  ---
  duration_ms: 3.6931
  type: 'test'
  ...
# Subtest: approved run uses fixed argument arrays and a reduced environment
ok 3 - approved run uses fixed argument arrays and a reduced environment
  ---
  duration_ms: 71.4002
  type: 'test'
  ...
# Subtest: duplicate starts are rejected and stop targets only the owned process
ok 4 - duplicate starts are rejected and stop targets only the owned process
  ---
  duration_ms: 48.2033
  type: 'test'
  ...
# Subtest: unapproved, wrong-hash, traversal and illegal environment records are refused
ok 5 - unapproved, wrong-hash, traversal and illegal environment records are refused
  ---
  duration_ms: 57.1283
  type: 'test'
  ...
# Subtest: only indexed media for the selected run can be read
ok 6 - only indexed media for the selected run can be read
  ---
  duration_ms: 72.2952
  type: 'test'
  ...
# Subtest: changed media bytes are not served as the registered attachment
ok 7 - changed media bytes are not served as the registered attachment
  ---
  duration_ms: 7.3291
  type: 'test'
  ...
# Subtest: approved sorting asset is derived from the real frozen records
ok 8 - approved sorting asset is derived from the real frozen records
  ---
  duration_ms: 12.2668
  type: 'test'
  ...
# Subtest: hash mismatch is rejected instead of becoming a new approval
ok 9 - hash mismatch is rejected instead of becoming a new approval
  ---
  duration_ms: 7.1263
  type: 'test'
  ...
# Subtest: complete passing report requires all registered steps and all media kinds
ok 10 - complete passing report requires all registered steps and all media kinds
  ---
  duration_ms: 21.586
  type: 'test'
  ...
# Subtest: assertion mismatch remains a failed test and later steps are not executed
ok 11 - assertion mismatch remains a failed test and later steps are not executed
  ---
  duration_ms: 6.0415
  type: 'test'
  ...
# Subtest: missing, corrupt, skipped and zero-target reports fail closed
ok 12 - missing, corrupt, skipped and zero-target reports fail closed
  ---
  duration_ms: 12.3892
  type: 'test'
  ...
# Subtest: exit code zero cannot override an incomplete step set
ok 13 - exit code zero cannot override an incomplete step set
  ---
  duration_ms: 4.3733
  type: 'test'
  ...
# Subtest: health endpoint reports the independent workbench
ok 14 - health endpoint reports the independent workbench
  ---
  duration_ms: 28.8869
  type: 'test'
  ...
# Subtest: unknown routes fail closed
ok 15 - unknown routes fail closed
  ---
  duration_ms: 4.2633
  type: 'test'
  ...
# Subtest: asset registration is persistent and idempotent
ok 16 - asset registration is persistent and idempotent
  ---
  duration_ms: 19.1717
  type: 'test'
  ...
# Subtest: runs remain readable and active records become interrupted after restart
ok 17 - runs remain readable and active records become interrupted after restart
  ---
  duration_ms: 16.47
  type: 'test'
  ...
# Subtest: run ids cannot escape the data root
ok 18 - run ids cannot escape the data root
  ---
  duration_ms: 6.2781
  type: 'test'
  ...
1..18
# tests 18
# suites 0
# pass 18
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 323.6554
```

### Sync Record Status

```text
DRY-RUN: no derived changes for REQ-0020-test-workbench-m1; explicit implementation states retained, never inferred from verification.
```

### Check AI Context

- Exit code: `0`

```text
PASS ai-engineering-context checks
```

### Notes

T4收口：18项工程测试通过；真实正常/故障运行与重启历史证据见workbench/docs/ACCEPTANCE_REPORT.md。
