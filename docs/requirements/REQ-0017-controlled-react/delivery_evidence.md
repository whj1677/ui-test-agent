# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-20T02:16:58+08:00`
- Record: `REQ-0017-controlled-react`
- Change fingerprint: `09c238a941b7f62945de3626fae671380a8e1f4a98b57d42aa3cda086a78b26b`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test tests/display-number.test.mjs`
- Exit code: `0`
- Test count: `8`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/req0017/v16-delivery.log`
- Log SHA-256: `9ab378f200054a2d60e3fdbd18c3e12fb9632745ae619134e87adc4808c34ffb`

### Git Status

```text
 M docs/modules/release_runtime.md
 M docs/requirements/REQ-0017-controlled-react/00_user_requirement.md
 M docs/requirements/REQ-0017-controlled-react/02_design.md
 M docs/requirements/REQ-0017-controlled-react/03_tasks.md
 M docs/requirements/REQ-0017-controlled-react/04_verification.md
 M docs/requirements/REQ-0017-controlled-react/05_trace.md
 M docs/requirements/REQ-0017-controlled-react/current_state.md
 M docs/requirements/REQ-0017-controlled-react/delivery_evidence.md
 M docs/requirements/REQ-0017-controlled-react/real-model-v15-result.md
 M docs/requirements/REQ-0017-controlled-react/requirement.source.json
 M src/adaptive-plan.mjs
 M src/adaptive-recovery.mjs
 M src/browser.mjs
 M src/plan-semantics.mjs
 M src/plans.mjs
 M src/scope-guidance.mjs
 M src/table-assertion.mjs
?? docs/requirements/REQ-0017-controlled-react/real-model-v16-result.md
?? tests/display-number.test.mjs
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/modules/release_runtime.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/00_user_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/02_design.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/03_tasks.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/04_verification.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/05_trace.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/real-model-v15-result.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-plan.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-recovery.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/browser.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/plan-semantics.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/plans.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/scope-guidance.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/table-assertion.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md                    |   6 +
 .../00_user_requirement.md                         |   2 +
 .../REQ-0017-controlled-react/02_design.md         |   2 +-
 .../REQ-0017-controlled-react/03_tasks.md          |   2 +-
 .../REQ-0017-controlled-react/04_verification.md   |   2 +-
 .../REQ-0017-controlled-react/05_trace.md          |   2 +-
 .../REQ-0017-controlled-react/current_state.md     |   8 +-
 .../REQ-0017-controlled-react/delivery_evidence.md | 125 +++++++++++----------
 .../real-model-v15-result.md                       |   4 +-
 .../requirement.source.json                        |  16 +--
 src/adaptive-plan.mjs                              |   4 +-
 src/adaptive-recovery.mjs                          |   6 +
 src/browser.mjs                                    |  19 +++-
 src/plan-semantics.mjs                             |  19 ++++
 src/plans.mjs                                      |  31 ++++-
 src/scope-guidance.mjs                             |   2 +-
 src/table-assertion.mjs                            |  38 ++++++-
 17 files changed, 201 insertions(+), 87 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0017-controlled-react/real-model-v16-result.md
tests/display-number.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-20T02:16:24+08:00
Command: node --test tests/display-number.test.mjs
Exit code: 0
Parsed test count: 8
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: display number uses the existing strict closed numeric display grammar
ok 1 - display number uses the existing strict closed numeric display grammar
  ---
  duration_ms: 2.1507
  type: 'test'
  ...
# Subtest: projection requires a sourced finite number, scoped definition and no explicit unit
ok 2 - projection requires a sourced finite number, scoped definition and no explicit unit
  ---
  duration_ms: 1.7733
  type: 'test'
  ...
# Subtest: new adaptive unit text cannot be copied from observation; fixed text behavior stays unchanged
ok 3 - new adaptive unit text cannot be copied from observation; fixed text behavior stays unchanged
  ---
  duration_ms: 1.7942
  type: 'test'
  ...
# Subtest: actual browser projection preserves DOM evidence and does not convert or match a substring
ok 4 - actual browser projection preserves DOM evidence and does not convert or match a substring
  ---
  duration_ms: 1708.2748
  type: 'test'
  ...
# Subtest: display-number candidate repair with no business replay: repair
ok 5 - display-number candidate repair with no business replay: repair
  ---
  duration_ms: 7910.4437
  type: 'test'
  ...
# Subtest: display-number candidate repair with no business replay: difference
ok 6 - display-number candidate repair with no business replay: difference
  ---
  duration_ms: 8619.9638
  type: 'test'
  ...
# Subtest: display-number candidate repair with no business replay: repeat
ok 7 - display-number candidate repair with no business replay: repeat
  ---
  duration_ms: 6448.1441
  type: 'test'
  ...
# Subtest: display-number candidate repair with no business replay: scalar
ok 8 - display-number candidate repair with no business replay: scalar
  ---
  duration_ms: 7797.8197
  type: 'test'
  ...
1..8
# tests 8
# suites 0
# pass 8
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 32958.7903
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

版本16最终受影响376项无失败；采证8项重叠不累加，真实模型尚待冻结后复验，原失败保留。
