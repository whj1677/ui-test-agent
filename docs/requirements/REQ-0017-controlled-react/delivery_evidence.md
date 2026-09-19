# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-20T05:43:04+08:00`
- Record: `REQ-0017-controlled-react`
- Change fingerprint: `4d3675a7e6066484229bc0a223836e5d1a295b7a0c0a716fa23b106259396767`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test --test-concurrency=3 tests/table-order.test.mjs tests/table-order.execution.test.mjs tests/aria-selected.test.mjs tests/aria-selected.execution.test.mjs`
- Exit code: `0`
- Test count: `37`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/req0017/v24-delivery.log`
- Log SHA-256: `3957ab0eda0e690edeea7c95b30f10d6f0362ce81c8d148a4f25027f9d32aac5`

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
 M docs/requirements/REQ-0017-controlled-react/requirement.source.json
 M src/adaptive-execution.mjs
 M src/adaptive-plan.mjs
 M src/adaptive-recovery.mjs
 M src/adaptive-review.mjs
 M src/browser.mjs
 M src/plan-quality.mjs
 M src/plans.mjs
?? docs/requirements/REQ-0017-controlled-react/real-model-v24-result.md
?? src/table-order.mjs
?? tests/table-order.execution.test.mjs
?? tests/table-order.test.mjs
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
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-execution.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-plan.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-recovery.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-review.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/browser.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/plan-quality.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/plans.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md                    |   4 +
 docs/requirements/README.md                        |   2 +
 .../00_user_requirement.md                         |   2 +
 .../REQ-0017-controlled-react/02_design.md         |   2 +-
 .../REQ-0017-controlled-react/03_tasks.md          |   2 +-
 .../REQ-0017-controlled-react/04_verification.md   |   2 +-
 .../REQ-0017-controlled-react/05_trace.md          |   2 +-
 .../REQ-0017-controlled-react/current_state.md     |   8 +-
 .../REQ-0017-controlled-react/delivery_evidence.md | 268 +++++++++++++++++----
 .../requirement.source.json                        |  16 +-
 src/adaptive-execution.mjs                         |   1 +
 src/adaptive-plan.mjs                              |   4 +-
 src/adaptive-recovery.mjs                          |   2 +
 src/adaptive-review.mjs                            |   2 +
 src/browser.mjs                                    |  14 +-
 src/plan-quality.mjs                               |   2 +
 src/plans.mjs                                      |  11 +
 17 files changed, 271 insertions(+), 73 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0017-controlled-react/real-model-v24-result.md
src/table-order.mjs
tests/table-order.execution.test.mjs
tests/table-order.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-20T05:42:16+08:00
Command: node --test --test-concurrency=3 tests/table-order.test.mjs tests/table-order.execution.test.mjs tests/aria-selected.test.mjs tests/aria-selected.execution.test.mjs
Exit code: 0
Parsed test count: 37
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: default tab typed recovery without replay: repair
ok 1 - default tab typed recovery without replay: repair
  ---
  duration_ms: 14027.9169
  type: 'test'
  ...
# Subtest: default tab typed recovery without replay: difference
ok 2 - default tab typed recovery without replay: difference
  ---
  duration_ms: 19517.867
  type: 'test'
  ...
# Subtest: default tab typed recovery without replay: repeat
ok 3 - default tab typed recovery without replay: repeat
  ---
  duration_ms: 12262.5131
  type: 'test'
  ...
# Subtest: explicit ARIA selection is boolean, not selected text or checkbox state
ok 4 - explicit ARIA selection is boolean, not selected text or checkbox state
  ---
  duration_ms: 1.8028
  type: 'test'
  ...
# Subtest: current tab selected_label misuse is rejected before dispatch with specific feedback
ok 5 - current tab selected_label misuse is rejected before dispatch with specific feedback
  ---
  duration_ms: 845.7059
  type: 'test'
  ...
# Subtest: actual ARIA tab selection true is measured and observed
ok 6 - actual ARIA tab selection true is measured and observed
  ---
  duration_ms: 822.7072
  type: 'test'
  ...
# Subtest: actual ARIA tab selection false is measured and observed
ok 7 - actual ARIA tab selection false is measured and observed
  ---
  duration_ms: 1677.0839
  type: 'test'
  ...
# Subtest: unsupported selection target is technical, never false by default: <button role="tab">基本信息</button>
ok 8 - unsupported selection target is technical, never false by default: <button role="tab">基本信息</button>
  ---
  duration_ms: 842.2976
  type: 'test'
  ...
# Subtest: unsupported selection target is technical, never false by default: <button role="tab" aria-selected="mixed">基本信息</button>
ok 9 - unsupported selection target is technical, never false by default: <button role="tab" aria-selected="mixed">基本信息</button>
  ---
  duration_ms: 881.6057
  type: 'test'
  ...
# Subtest: unsupported selection target is technical, never false by default: <button aria-selected="true">基本信息</button>
ok 10 - unsupported selection target is technical, never false by default: <button aria-selected="true">基本信息</button>
  ---
  duration_ms: 747.6109
  type: 'test'
  ...
# Subtest: same-step original order source, actual difference=false
ok 11 - same-step original order source, actual difference=false
  ---
  duration_ms: 10935.3588
  type: 'test'
  ...
# Subtest: same-step original order source, actual difference=true
ok 12 - same-step original order source, actual difference=true
  ---
  duration_ms: 10246.4636
  type: 'test'
  ...
# Subtest: new relation requires current original source and strict schema
ok 13 - new relation requires current original source and strict schema
  ---
  duration_ms: 2.7053
  type: 'test'
  ...
# Subtest: reject source: different direction
ok 14 - reject source: different direction
  ---
  duration_ms: 0.1905
  type: 'test'
  ...
# Subtest: reject source: control only
ok 15 - reject source: control only
  ---
  duration_ms: 0.0838
  type: 'test'
  ...
# Subtest: reject source: cut negation
ok 16 - reject source: cut negation
  ---
  duration_ms: 0.0792
  type: 'test'
  ...
# Subtest: reject source: conditional
ok 17 - reject source: conditional
  ---
  duration_ms: 0.1224
  type: 'test'
  ...
# Subtest: reject source: alternative
ok 18 - reject source: alternative
  ---
  duration_ms: 0.1516
  type: 'test'
  ...
# Subtest: reject source: wrong field suffix
ok 19 - reject source: wrong field suffix
  ---
  duration_ms: 0.079
  type: 'test'
  ...
# Subtest: reject source: input only
ok 20 - reject source: input only
  ---
  duration_ms: 0.0684
  type: 'test'
  ...
# Subtest: reject source: no action source
ok 21 - reject source: no action source
  ---
  duration_ms: 0.2173
  type: 'test'
  ...
# Subtest: reject source: other step not source
ok 22 - reject source: other step not source
  ---
  duration_ms: 0.3307
  type: 'test'
  ...
# Subtest: full current column, ties accepted, middle inversion caught
ok 23 - full current column, ties accepted, middle inversion caught
  ---
  duration_ms: 1.2629
  type: 'test'
  ...
# Subtest: technical unsupported: mixed unit
ok 24 - technical unsupported: mixed unit
  ---
  duration_ms: 0.1378
  type: 'test'
  ...
# Subtest: technical unsupported: unparseable
ok 25 - technical unsupported: unparseable
  ---
  duration_ms: 0.1954
  type: 'test'
  ...
# Subtest: technical unsupported: unsafe precision
ok 26 - technical unsupported: unsafe precision
  ---
  duration_ms: 0.0821
  type: 'test'
  ...
# Subtest: technical unsupported: fraction precision
ok 27 - technical unsupported: fraction precision
  ---
  duration_ms: 0.0652
  type: 'test'
  ...
# Subtest: technical unsupported: underflow
ok 28 - technical unsupported: underflow
  ---
  duration_ms: 0.1505
  type: 'test'
  ...
# Subtest: technical unsupported: single
ok 29 - technical unsupported: single
  ---
  duration_ms: 0.0591
  type: 'test'
  ...
# Subtest: technical unsupported: empty
ok 30 - technical unsupported: empty
  ---
  duration_ms: 0.0451
  type: 'test'
  ...
# Subtest: technical unsupported: duplicate header
ok 31 - technical unsupported: duplicate header
  ---
  duration_ms: 0.0461
  type: 'test'
  ...
# Subtest: technical unsupported: ambiguous suffix
ok 32 - technical unsupported: ambiguous suffix
  ---
  duration_ms: 0.0435
  type: 'test'
  ...
# Subtest: technical unsupported: wrong header
ok 33 - technical unsupported: wrong header
  ---
  duration_ms: 0.0368
  type: 'test'
  ...
# Subtest: exact field header beats suffix; cannot choose another power column
ok 34 - exact field header beats suffix; cannot choose another power column
  ---
  duration_ms: 0.1195
  type: 'test'
  ...
# Subtest: fixed-width identifiers without numeric overflow, no guessed collation
ok 35 - fixed-width identifiers without numeric overflow, no guessed collation
  ---
  duration_ms: 0.2782
  type: 'test'
  ...
# Subtest: browser measures one native matrix and does not poll an inversion into a pass
ok 36 - browser measures one native matrix and does not poll an inversion into a pass
  ---
  duration_ms: 804.2217
  type: 'test'
  ...
# Subtest: merged/virtual table cannot produce ordering proof
ok 37 - merged/virtual table cannot produce ordering proof
  ---
  duration_ms: 1287.7515
  type: 'test'
  ...
1..37
# tests 37
# suites 0
# pass 37
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 46342.4537
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

v24受影响304项；交付排序27项与页签10项组合，非官方模型结果
