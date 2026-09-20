# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-20T11:19:07+08:00`
- Record: `REQ-0017-controlled-react`
- Change fingerprint: `d9befc3be52cd10c7e8397bac8cea3fe57cdcf8f4fb766ba38178fe233f54d51`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test --test-concurrency=2 tests/completion-feedback.test.mjs tests/completion-feedback.execution.test.mjs tests/adaptive-capabilities.test.mjs`
- Exit code: `0`
- Test count: `15`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/req0017/v38-delivery.log`
- Log SHA-256: `eb8cb2a85d388e067643086f4323becef8cdb41b7ee847bd46be74986ca91448`

### Git Status

```text
 M docs/modules/release_runtime.md
 M docs/requirements/README.md
 M docs/requirements/REQ-0017-controlled-react/00_user_requirement.md
 M docs/requirements/REQ-0017-controlled-react/02_design.md
 M docs/requirements/REQ-0017-controlled-react/03_tasks.md
 M docs/requirements/REQ-0017-controlled-react/04_verification.md
 M docs/requirements/REQ-0017-controlled-react/05_trace.md
 M docs/requirements/REQ-0017-controlled-react/change_log.md
 M docs/requirements/REQ-0017-controlled-react/current_state.md
 M docs/requirements/REQ-0017-controlled-react/delivery_evidence.md
 M docs/requirements/REQ-0017-controlled-react/requirement.source.json
 M src/adaptive-candidate-feedback.mjs
 M src/plan-semantics.mjs
 M tests/adaptive-capabilities.test.mjs
?? docs/requirements/REQ-0017-controlled-react/kimi-v38-review.md
?? docs/requirements/REQ-0017-controlled-react/real-model-v38-result.md
?? src/completion-evidence.mjs
?? tests/completion-feedback.execution.test.mjs
?? tests/completion-feedback.test.mjs
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/modules/release_runtime.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/00_user_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/02_design.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/03_tasks.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/04_verification.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/05_trace.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/change_log.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-candidate-feedback.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/plan-semantics.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/adaptive-capabilities.test.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md                    |   2 +
 docs/requirements/README.md                        |   2 +-
 .../00_user_requirement.md                         |   2 +
 .../REQ-0017-controlled-react/02_design.md         |   2 +-
 .../REQ-0017-controlled-react/03_tasks.md          |   2 +-
 .../REQ-0017-controlled-react/04_verification.md   |   2 +-
 .../REQ-0017-controlled-react/05_trace.md          |   2 +-
 .../REQ-0017-controlled-react/change_log.md        |   1 +
 .../REQ-0017-controlled-react/current_state.md     |   8 +-
 .../REQ-0017-controlled-react/delivery_evidence.md | 246 +++++++--------------
 .../requirement.source.json                        |  24 +-
 src/adaptive-candidate-feedback.mjs                |  63 +++---
 src/plan-semantics.mjs                             | 143 +-----------
 tests/adaptive-capabilities.test.mjs               |   9 +-
 14 files changed, 162 insertions(+), 346 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0017-controlled-react/kimi-v38-review.md
docs/requirements/REQ-0017-controlled-react/real-model-v38-result.md
src/completion-evidence.mjs
tests/completion-feedback.execution.test.mjs
tests/completion-feedback.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-20T11:18:10+08:00
Command: node --test --test-concurrency=2 tests/completion-feedback.test.mjs tests/completion-feedback.execution.test.mjs tests/adaptive-capabilities.test.mjs
Exit code: 0
Parsed test count: 15
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: explicit source paths are visible capabilities, not menu requirements or pass evidence
ok 1 - explicit source paths are visible capabilities, not menu requirements or pass evidence
  ---
  duration_ms: 9.1068
  type: 'test'
  ...
# Subtest: negative/conditional/alternative/external routes and observed inventions never become source facts
ok 2 - negative/conditional/alternative/external routes and observed inventions never become source facts
  ---
  duration_ms: 2.1193
  type: 'test'
  ...
# Subtest: one unexecuted candidate exposes numeric source, extra total and missing absolute position together
ok 3 - one unexecuted candidate exposes numeric source, extra total and missing absolute position together
  ---
  duration_ms: 11.5386
  type: 'test'
  ...
# Subtest: diagnostic probing of malformed candidate data cannot replace primary failure or grant acceptance
ok 4 - diagnostic probing of malformed candidate data cannot replace primary failure or grant acceptance
  ---
  duration_ms: 0.9757
  type: 'test'
  ...
# Subtest: cell text cannot evade original numeric-unit source by abandoning the matrix
ok 5 - cell text cannot evade original numeric-unit source by abandoning the matrix
  ---
  duration_ms: 1.3809
  type: 'test'
  ...
# Subtest: numeric substring is rejected before measurement instead of passing 1100 for 100
ok 6 - numeric substring is rejected before measurement instead of passing 1100 for 100
  ---
  duration_ms: 0.898
  type: 'test'
  ...
# Subtest: parallel completion feedback through actual Controller: early-feedback
ok 7 - parallel completion feedback through actual Controller: early-feedback
  ---
  duration_ms: 20644.1135
  type: 'test'
  ...
# Subtest: parallel completion feedback through actual Controller: actual-page11
ok 8 - parallel completion feedback through actual Controller: actual-page11
  ---
  duration_ms: 17834.5808
  type: 'test'
  ...
# Subtest: parallel completion feedback through actual Controller: persistent-omission
ok 9 - parallel completion feedback through actual Controller: persistent-omission
  ---
  duration_ms: 16942.1958
  type: 'test'
  ...
# Subtest: first rejected extra constraint also exposes the already-known default-page gap
ok 10 - first rejected extra constraint also exposes the already-known default-page gap
  ---
  duration_ms: 11.9292
  type: 'test'
  ...
# Subtest: candidate aggregation preserves same-checkpoint sole-row proof, not flattened fragments
ok 11 - candidate aggregation preserves same-checkpoint sole-row proof, not flattened fragments
  ---
  duration_ms: 2.7228
  type: 'test'
  ...
# Subtest: future-page gap is advisory: partial navigation allowed, complete still refused
ok 12 - future-page gap is advisory: partial navigation allowed, complete still refused
  ---
  duration_ms: 1.0845
  type: 'test'
  ...
# Subtest: wrong original page or source reference does not close the structural gap
ok 13 - wrong original page or source reference does not close the structural gap
  ---
  duration_ms: 0.6594
  type: 'test'
  ...
# Subtest: malformed diagnostics are explicit unknowns and cannot mutate candidate or actual history
ok 14 - malformed diagnostics are explicit unknowns and cannot mutate candidate or actual history
  ---
  duration_ms: 0.6599
  type: 'test'
  ...
# Subtest: bounded diagnostic list declares truncation; hard completion is not truncated
ok 15 - bounded diagnostic list declares truncation; hard completion is not truncated
  ---
  duration_ms: 1.6053
  type: 'test'
  ...
1..15
# tests 15
# suites 0
# pass 15
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 55943.2551
```

### Sync Record Status

```text
DRY-RUN: no derived changes for REQ-0017-controlled-react; explicit implementation states retained, never inferred from verification.
```

### Check AI Context

- Exit code: `0`

```text
PASS ai-engineering-context checks
```

### Notes

共享既有完成证据汇总；581受影响工程及28组结构差分已核验，集合重叠不累加，官方效果另验
