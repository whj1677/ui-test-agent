# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-20T00:29:30+08:00`
- Record: `REQ-0017-controlled-react`
- Change fingerprint: `2f464ed2a8adfbb1d646d0e27bd243c63d1d6082b648dd6131b2cca64fece834`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test --test-concurrency=2 tests/adaptive-binding-feedback.test.mjs tests/adaptive-review.test.mjs tests/synthetic-login.test.mjs tests/autonomous-lab.test.mjs tests/autonomous-lab.integration.mjs`
- Exit code: `0`
- Test count: `23`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/req0017/v11-recovery-final.log`
- Log SHA-256: `06a38bef47029b68b45c19580ec74ae5f654cd907dc36d621c936443edfa1bf0`

### Git Status

```text
 M docs/modules/release_runtime.md
 M docs/requirements/REQ-0017-controlled-react/00_user_requirement.md
 M docs/requirements/REQ-0017-controlled-react/02_design.md
 M docs/requirements/REQ-0017-controlled-react/03_tasks.md
 M docs/requirements/REQ-0017-controlled-react/04_verification.md
 M docs/requirements/REQ-0017-controlled-react/current_state.md
 M docs/requirements/REQ-0017-controlled-react/delivery_evidence.md
 M docs/requirements/REQ-0017-controlled-react/requirement.source.json
 M scripts/autonomous-lab.mjs
 M scripts/synthetic-login.mjs
 M src/adaptive-recovery.mjs
 M src/adaptive-review.mjs
 M tests/adaptive-review.test.mjs
 M tests/autonomous-lab.integration.mjs
 M tests/synthetic-login.test.mjs
?? docs/requirements/REQ-0017-controlled-react/real-model-v11-result.md
?? tests/adaptive-binding-feedback.test.mjs
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/modules/release_runtime.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/00_user_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/02_design.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/03_tasks.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/04_verification.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'scripts/autonomous-lab.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'scripts/synthetic-login.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-recovery.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-review.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/adaptive-review.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/autonomous-lab.integration.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/synthetic-login.test.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md                    |   6 +
 .../00_user_requirement.md                         |   4 +
 .../REQ-0017-controlled-react/02_design.md         |   2 +-
 .../REQ-0017-controlled-react/03_tasks.md          |   2 +-
 .../REQ-0017-controlled-react/04_verification.md   |   2 +-
 .../REQ-0017-controlled-react/current_state.md     |   6 +-
 .../REQ-0017-controlled-react/delivery_evidence.md | 241 +++++++++++++++------
 .../requirement.source.json                        |  14 +-
 scripts/autonomous-lab.mjs                         |  17 +-
 scripts/synthetic-login.mjs                        |  39 +++-
 src/adaptive-recovery.mjs                          |   5 +
 src/adaptive-review.mjs                            |  16 +-
 tests/adaptive-review.test.mjs                     |  15 ++
 tests/autonomous-lab.integration.mjs               |   3 +
 tests/synthetic-login.test.mjs                     |  36 +++
 15 files changed, 321 insertions(+), 87 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0017-controlled-react/real-model-v11-result.md
tests/adaptive-binding-feedback.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-20T00:29:05+08:00
Command: node --test --test-concurrency=2 tests/adaptive-binding-feedback.test.mjs tests/adaptive-review.test.mjs tests/synthetic-login.test.mjs tests/autonomous-lab.test.mjs tests/autonomous-lab.integration.mjs
Exit code: 0
Parsed test count: 23
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: source binding feedback remains advisory through execution: repair
ok 1 - source binding feedback remains advisory through execution: repair
  ---
  duration_ms: 8386.8845
  type: 'test'
  ...
# Subtest: source binding feedback remains advisory through execution: repeat
ok 2 - source binding feedback remains advisory through execution: repeat
  ---
  duration_ms: 6327.6606
  type: 'test'
  ...
# Subtest: source binding feedback remains advisory through execution: business-difference
ok 3 - source binding feedback remains advisory through execution: business-difference
  ---
  duration_ms: 8587.2445
  type: 'test'
  ...
# Subtest: known assertion with another obligation becomes candidate repair, not acceptance or schema exhaustion
ok 4 - known assertion with another obligation becomes candidate repair, not acceptance or schema exhaustion
  ---
  duration_ms: 14.3265
  type: 'test'
  ...
# Subtest: stable audit assertion refs compile to strict same-step measured references
ok 5 - stable audit assertion refs compile to strict same-step measured references
  ---
  duration_ms: 1.2093
  type: 'test'
  ...
# Subtest: contradictory COVERED plus ASSERTION_GAP conservatively rejects candidate without format exhaustion
ok 6 - contradictory COVERED plus ASSERTION_GAP conservatively rejects candidate without format exhaustion
  ---
  duration_ms: 2.6011
  type: 'test'
  ...
# Subtest: contradictory feedback cannot hide invalid references or unrelated malformed issues
ok 7 - contradictory feedback cannot hide invalid references or unrelated malformed issues
  ---
  duration_ms: 4.2696
  type: 'test'
  ...
# Subtest: real V03 COVERED-with-empty-refs response is repaired without replanning candidate
ok 8 - real V03 COVERED-with-empty-refs response is repaired without replanning candidate
  ---
  duration_ms: 1.0763
  type: 'test'
  ...
# Subtest: persistent invalid review is bounded and is never implicitly accepted
ok 9 - persistent invalid review is bounded and is never implicitly accepted
  ---
  duration_ms: 0.6583
  type: 'test'
  ...
# Subtest: valid adverse semantic verdict is returned without retry or deletion
ok 10 - valid adverse semantic verdict is returned without retry or deletion
  ---
  duration_ms: 0.638
  type: 'test'
  ...
# Subtest: unknown/duplicate/mixed audit refs do not silently bind to another assertion
ok 11 - unknown/duplicate/mixed audit refs do not silently bind to another assertion
  ---
  duration_ms: 1.4606
  type: 'test'
  ...
# Subtest: abort/provider-budget error is not retried as audit schema failure
ok 12 - abort/provider-budget error is not retried as audit schema failure
  ---
  duration_ms: 0.6614
  type: 'test'
  ...
# Subtest: block review requires a current source-named control or explicit original route
ok 13 - block review requires a current source-named control or explicit original route
  ---
  duration_ms: 1.3992
  type: 'test'
  ...
# Subtest: format correction preserves rejected response and explicit source constraints
ok 14 - format correction preserves rejected response and explicit source constraints
  ---
  duration_ms: 0.5741
  type: 'test'
  ...
# Subtest: null check and mixed ref fields stay inside same-candidate audit correction
ok 15 - null check and mixed ref fields stay inside same-candidate audit correction
  ---
  duration_ms: 0.9952
  type: 'test'
  ...
# Subtest: invalid JSON is repaired as audit format but never escapes as a planning retry
ok 16 - invalid JSON is repaired as audit format but never escapes as a planning retry
  ---
  duration_ms: 1.1822
  type: 'test'
  ...
# Subtest: adaptive final coverage cannot replace table unchanged with a sampled fixed row count
ok 17 - adaptive final coverage cannot replace table unchanged with a sampled fixed row count
  ---
  duration_ms: 2.4857
  type: 'test'
  ...
# {"group":"smoke","calls":1,"results":[{"case_id":"LAB-V01","status":"NEEDS_MAPPING","reason":null,"attempts":0},{"case_id":"LAB-V02","status":"NEEDS_MAPPING","attempts":0},{"case_id":"LAB-V03","status":"NEEDS_MAPPING","attempts":0}]}
# Subtest: autonomous runner owns login and records a bounded model-boundary failure with no external calls
ok 18 - autonomous runner owns login and records a bounded model-boundary failure with no external calls
  ---
  duration_ms: 1573.9965
  type: 'test'
  ...
# Subtest: shared round call/time budget never resets between jobs and counts failed requests
ok 19 - shared round call/time budget never resets between jobs and counts failed requests
  ---
  duration_ms: 1.1535
  type: 'test'
  ...
# Subtest: autonomous preflight checks the frozen 32 cases without creating sessions or calling a model
ok 20 - autonomous preflight checks the frozen 32 cases without creating sessions or calling a model
  ---
  duration_ms: 9.5754
  type: 'test'
  ...
# Subtest: owned synthetic fixture enters and re-verifies a fresh browser without user actions
ok 21 - owned synthetic fixture enters and re-verifies a fresh browser without user actions
  ---
  duration_ms: 2327.1986
  type: 'test'
  ...
# Subtest: reuse only byte-verified synthetic server and leave it running after fixture close
ok 22 - reuse only byte-verified synthetic server and leave it running after fixture close
  ---
  duration_ms: 1215.8699
  type: 'test'
  ...
# Subtest: occupied port with matching health but wrong page is never adopted or clicked
ok 23 - occupied port with matching health but wrong page is never adopted or clicked
  ---
  duration_ms: 11.12
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
# duration_ms 23819.77
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

来源修正/持续重复/真实差异、原端口冻结复用及错误站点拒绝；工程证据，不是产品验收。大范围执行回归另行记录。
