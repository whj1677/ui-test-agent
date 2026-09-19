# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-20T06:21:08+08:00`
- Record: `REQ-0017-controlled-react`
- Change fingerprint: `17ba07f5f8d9d26c651d3040eb3b5c9cb7aa567cf61ebc03876c650a77cd0e57`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test tests/assertion-evidence.test.mjs tests/assertion-evidence.execution.test.mjs`
- Exit code: `0`
- Test count: `9`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/req0017/v26-delivery.log`
- Log SHA-256: `8e18ac49860b80264e9c702e9bfd40e6f91de1c0643e002809e46e1793c859dd`

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
 M src/adaptive-plan.mjs
 M src/adaptive-review.mjs
?? docs/requirements/REQ-0017-controlled-react/real-model-v26-result.md
?? src/assertion-evidence.mjs
?? tests/assertion-evidence.execution.test.mjs
?? tests/assertion-evidence.test.mjs
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
warning: in the working copy of 'src/adaptive-plan.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-review.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md                    |   2 +
 docs/requirements/README.md                        |   2 +-
 .../00_user_requirement.md                         |   2 +
 .../REQ-0017-controlled-react/02_design.md         |   2 +-
 .../REQ-0017-controlled-react/03_tasks.md          |   2 +-
 .../REQ-0017-controlled-react/04_verification.md   |   2 +-
 .../REQ-0017-controlled-react/05_trace.md          |   2 +-
 .../REQ-0017-controlled-react/change_log.md        |   1 +
 .../REQ-0017-controlled-react/current_state.md     |   8 +-
 .../REQ-0017-controlled-react/delivery_evidence.md | 133 ++++++++++++---------
 .../requirement.source.json                        |  24 ++--
 src/adaptive-plan.mjs                              |   2 +
 src/adaptive-review.mjs                            |   3 +
 13 files changed, 111 insertions(+), 74 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0017-controlled-react/real-model-v26-result.md
src/assertion-evidence.mjs
tests/assertion-evidence.execution.test.mjs
tests/assertion-evidence.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-20T06:20:38+08:00
Command: node --test tests/assertion-evidence.test.mjs tests/assertion-evidence.execution.test.mjs
Exit code: 0
Parsed test count: 9
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: evidence-source advisory does not grant execution or substitute note values: normal
ok 1 - evidence-source advisory does not grant execution or substitute note values: normal
  ---
  duration_ms: 7968.8954
  type: 'test'
  ...
# Subtest: evidence-source advisory does not grant execution or substitute note values: field-difference
ok 2 - evidence-source advisory does not grant execution or substitute note values: field-difference
  ---
  duration_ms: 13610.8247
  type: 'test'
  ...
# Subtest: evidence-source advisory does not grant execution or substitute note values: negative-review
ok 3 - evidence-source advisory does not grant execution or substitute note values: negative-review
  ---
  duration_ms: 6620.8202
  type: 'test'
  ...
# Subtest: field evidence syntax keeps object and field separate from business values
ok 4 - field evidence syntax keeps object and field separate from business values
  ---
  duration_ms: 1.1192
  type: 'test'
  ...
# Subtest: heading, region substring and visibility cannot be tagged as a field value
ok 5 - heading, region substring and visibility cannot be tagged as a field value
  ---
  duration_ms: 0.1416
  type: 'test'
  ...
# Subtest: row field uses original identity and column, numeric projection is distinguished
ok 6 - row field uses original identity and column, numeric projection is distinguished
  ---
  duration_ms: 0.201
  type: 'test'
  ...
# Subtest: matrix descriptor lists columns without turning observed/expected values into proof
ok 7 - matrix descriptor lists columns without turning observed/expected values into proof
  ---
  duration_ms: 0.3247
  type: 'test'
  ...
# Subtest: advisory catalog does not alter candidate, source refs, original or audit status
ok 8 - advisory catalog does not alter candidate, source refs, original or audit status
  ---
  duration_ms: 0.3369
  type: 'test'
  ...
# Subtest: planner and independent adaptive reviewer share bounded conditional-source policy
ok 9 - planner and independent adaptive reviewer share bounded conditional-source policy
  ---
  duration_ms: 0.1893
  type: 'test'
  ...
1..9
# tests 9
# suites 0
# pass 9
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 28677.6253
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

v26九项重叠工程子集，不计官方模型结果，限定真实复验尚未运行
