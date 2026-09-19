# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-20T04:37:17+08:00`
- Record: `REQ-0017-controlled-react`
- Change fingerprint: `9a5a67444997ecf21cd7ea20356637e05736cea2c9d706ffc1bdfb1e1b7f08c6`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test --test-concurrency=2 tests/adaptive-review.test.mjs tests/adaptive-negative-review.execution.test.mjs`
- Exit code: `0`
- Test count: `23`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/req0017/v20-delivery.log`
- Log SHA-256: `5cf7c900e0aa69a83ff458a7714d1b3fefae2fb4d927aa650816230e750484dd`

### Git Status

```text
 M docs/modules/release_runtime.md
 M docs/requirements/README.md
 M docs/requirements/REQ-0017-controlled-react/00_user_requirement.md
 M docs/requirements/REQ-0017-controlled-react/02_design.md
 M docs/requirements/REQ-0017-controlled-react/03_tasks.md
 M docs/requirements/REQ-0017-controlled-react/04_verification.md
 M docs/requirements/REQ-0017-controlled-react/05_trace.md
 M docs/requirements/REQ-0017-controlled-react/current_state.md
 M docs/requirements/REQ-0017-controlled-react/delivery_evidence.md
 M docs/requirements/REQ-0017-controlled-react/real-model-v19-result.md
 M docs/requirements/REQ-0017-controlled-react/requirement.source.json
 M src/adaptive-review.mjs
 M tests/adaptive-review.test.mjs
?? docs/requirements/REQ-0017-controlled-react/real-model-v20-result.md
?? tests/adaptive-negative-review.execution.test.mjs
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
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/real-model-v19-result.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-review.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/adaptive-review.test.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md                    |   4 +
 docs/requirements/README.md                        |   2 +-
 .../00_user_requirement.md                         |   3 +
 .../REQ-0017-controlled-react/02_design.md         |   2 +-
 .../REQ-0017-controlled-react/03_tasks.md          |   2 +-
 .../REQ-0017-controlled-react/04_verification.md   |   2 +-
 .../REQ-0017-controlled-react/05_trace.md          |   2 +-
 .../REQ-0017-controlled-react/current_state.md     |   8 +-
 .../REQ-0017-controlled-react/delivery_evidence.md | 225 +++++++++++----------
 .../real-model-v19-result.md                       |   9 +-
 .../requirement.source.json                        |  17 +-
 src/adaptive-review.mjs                            |  35 +++-
 tests/adaptive-review.test.mjs                     |  47 +++++
 13 files changed, 230 insertions(+), 128 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0017-controlled-react/real-model-v20-result.md
tests/adaptive-negative-review.execution.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-20T04:36:37+08:00
Command: node --test --test-concurrency=2 tests/adaptive-review.test.mjs tests/adaptive-negative-review.execution.test.mjs
Exit code: 0
Parsed test count: 23
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: negative audit routes to bounded candidate repair: repair
ok 1 - negative audit routes to bounded candidate repair: repair
  ---
  duration_ms: 8106.3981
  type: 'test'
  ...
# Subtest: negative audit routes to bounded candidate repair: difference
ok 2 - negative audit routes to bounded candidate repair: difference
  ---
  duration_ms: 8781.6686
  type: 'test'
  ...
# Subtest: negative audit routes to bounded candidate repair: repeat
ok 3 - negative audit routes to bounded candidate repair: repeat
  ---
  duration_ms: 6245.2356
  type: 'test'
  ...
# Subtest: negative audit routes to bounded candidate repair: partial-repair
ok 4 - negative audit routes to bounded candidate repair: partial-repair
  ---
  duration_ms: 8144.6092
  type: 'test'
  ...
# Subtest: negative audit routes to bounded candidate repair: partial-repeat
ok 5 - negative audit routes to bounded candidate repair: partial-repeat
  ---
  duration_ms: 6354.832
  type: 'test'
  ...
# Subtest: known assertion with another obligation becomes candidate repair, not acceptance or schema exhaustion
ok 6 - known assertion with another obligation becomes candidate repair, not acceptance or schema exhaustion
  ---
  duration_ms: 10.414
  type: 'test'
  ...
# Subtest: stable audit assertion refs compile to strict same-step measured references
ok 7 - stable audit assertion refs compile to strict same-step measured references
  ---
  duration_ms: 1.0121
  type: 'test'
  ...
# Subtest: contradictory COVERED plus ASSERTION_GAP conservatively rejects candidate without format exhaustion
ok 8 - contradictory COVERED plus ASSERTION_GAP conservatively rejects candidate without format exhaustion
  ---
  duration_ms: 1.5754
  type: 'test'
  ...
# Subtest: contradictory feedback cannot hide invalid references or unrelated malformed issues
ok 9 - contradictory feedback cannot hide invalid references or unrelated malformed issues
  ---
  duration_ms: 4.0737
  type: 'test'
  ...
# Subtest: real V03 COVERED-with-empty-refs response is repaired without replanning candidate
ok 10 - real V03 COVERED-with-empty-refs response is repaired without replanning candidate
  ---
  duration_ms: 1.3186
  type: 'test'
  ...
# Subtest: persistent invalid review is bounded and is never implicitly accepted
ok 11 - persistent invalid review is bounded and is never implicitly accepted
  ---
  duration_ms: 0.7566
  type: 'test'
  ...
# Subtest: valid adverse semantic verdict is returned without retry or deletion
ok 12 - valid adverse semantic verdict is returned without retry or deletion
  ---
  duration_ms: 0.6968
  type: 'test'
  ...
# Subtest: negative coverage with a missing issue type returns strict rejection: MISSING/false
ok 13 - negative coverage with a missing issue type returns strict rejection: MISSING/false
  ---
  duration_ms: 0.8329
  type: 'test'
  ...
# Subtest: negative coverage with a missing issue type returns strict rejection: MISSING/true
ok 14 - negative coverage with a missing issue type returns strict rejection: MISSING/true
  ---
  duration_ms: 0.8481
  type: 'test'
  ...
# Subtest: negative coverage with a missing issue type returns strict rejection: UNCLEAR/false
ok 15 - negative coverage with a missing issue type returns strict rejection: UNCLEAR/false
  ---
  duration_ms: 1.1952
  type: 'test'
  ...
# Subtest: negative coverage with a missing issue type returns strict rejection: UNCLEAR/true
ok 16 - negative coverage with a missing issue type returns strict rejection: UNCLEAR/true
  ---
  duration_ms: 0.5994
  type: 'test'
  ...
# Subtest: unknown/duplicate/mixed audit refs do not silently bind to another assertion
ok 17 - unknown/duplicate/mixed audit refs do not silently bind to another assertion
  ---
  duration_ms: 1.144
  type: 'test'
  ...
# Subtest: abort/provider-budget error is not retried as audit schema failure
ok 18 - abort/provider-budget error is not retried as audit schema failure
  ---
  duration_ms: 0.4823
  type: 'test'
  ...
# Subtest: block review requires a current source-named control or explicit original route
ok 19 - block review requires a current source-named control or explicit original route
  ---
  duration_ms: 0.7754
  type: 'test'
  ...
# Subtest: format correction preserves rejected response and explicit source constraints
ok 20 - format correction preserves rejected response and explicit source constraints
  ---
  duration_ms: 0.3864
  type: 'test'
  ...
# Subtest: null check and mixed ref fields stay inside same-candidate audit correction
ok 21 - null check and mixed ref fields stay inside same-candidate audit correction
  ---
  duration_ms: 0.8073
  type: 'test'
  ...
# Subtest: invalid JSON is repaired as audit format but never escapes as a planning retry
ok 22 - invalid JSON is repaired as audit format but never escapes as a planning retry
  ---
  duration_ms: 1.1394
  type: 'test'
  ...
# Subtest: adaptive final coverage cannot replace table unchanged with a sampled fixed row count
ok 23 - adaptive final coverage cannot replace table unchanged with a sampled fixed row count
  ---
  duration_ms: 2.8565
  type: 'test'
  ...
1..23
# tests 23
# suites 0
# pass 23
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 38104.0159
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

v20负面审查保守候选修复，真实Chromium注入模型；官方V02待复验，非发布验收
