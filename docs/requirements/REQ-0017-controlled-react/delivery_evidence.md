# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-20T08:40:00+08:00`
- Record: `REQ-0017-controlled-react`
- Change fingerprint: `645833e703d81ef1b58ad166b96afb09fadd53c75bf24dda9681f161c859debb`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test --test-concurrency=2 tests/page-index-evidence.test.mjs tests/page-index-evidence.execution.test.mjs`
- Exit code: `0`
- Test count: `38`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/req0017/v32-delivery.log`
- Log SHA-256: `dfc9d59c4a5ec738b9c054197328a5f1e01d36d992d548ba3631b4410adc38cf`

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
 M docs/requirements/REQ-0017-controlled-react/real-model-v31-result.md
 M docs/requirements/REQ-0017-controlled-react/requirement.source.json
 M src/adaptive-execution.mjs
 M src/adaptive-plan.mjs
 M src/adaptive-recovery.mjs
 M src/adaptive-review.mjs
 M src/expectation-coverage.mjs
 M src/plan-semantics.mjs
?? docs/requirements/REQ-0017-controlled-react/real-model-v32-result.md
?? src/page-index-evidence.mjs
?? tests/page-index-evidence.execution.test.mjs
?? tests/page-index-evidence.test.mjs
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
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/real-model-v31-result.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-execution.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-plan.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-recovery.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-review.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/expectation-coverage.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/plan-semantics.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md                    |   4 +-
 docs/requirements/README.md                        |   2 +
 .../00_user_requirement.md                         |   3 +
 .../REQ-0017-controlled-react/02_design.md         |   2 +-
 .../REQ-0017-controlled-react/03_tasks.md          |   2 +-
 .../REQ-0017-controlled-react/04_verification.md   |   2 +-
 .../REQ-0017-controlled-react/05_trace.md          |   2 +-
 .../REQ-0017-controlled-react/change_log.md        |   1 +
 .../REQ-0017-controlled-react/current_state.md     |   8 +-
 .../REQ-0017-controlled-react/delivery_evidence.md | 320 ++++++++++++---------
 .../real-model-v31-result.md                       |  12 +
 .../requirement.source.json                        |  25 +-
 src/adaptive-execution.mjs                         |  16 +-
 src/adaptive-plan.mjs                              |   2 +
 src/adaptive-recovery.mjs                          |   4 +
 src/adaptive-review.mjs                            |   2 +
 src/expectation-coverage.mjs                       |   2 +
 src/plan-semantics.mjs                             |   8 +
 18 files changed, 254 insertions(+), 163 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0017-controlled-react/real-model-v32-result.md
src/page-index-evidence.mjs
tests/page-index-evidence.execution.test.mjs
tests/page-index-evidence.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-20T08:39:16+08:00
Command: node --test --test-concurrency=2 tests/page-index-evidence.test.mjs tests/page-index-evidence.execution.test.mjs
Exit code: 0
Parsed test count: 38
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: current page is not inferred from IDs: correct
ok 1 - current page is not inferred from IDs: correct
  ---
  duration_ms: 9892.714
  type: 'test'
  ...
# Subtest: current page is not inferred from IDs: wrong-page
ok 2 - current page is not inferred from IDs: wrong-page
  ---
  duration_ms: 11605.6624
  type: 'test'
  ...
# Subtest: current page is not inferred from IDs: persistent-missing
ok 3 - current page is not inferred from IDs: persistent-missing
  ---
  duration_ms: 6805.6836
  type: 'test'
  ...
# Subtest: current page is not inferred from IDs: after-navigation
ok 4 - current page is not inferred from IDs: after-navigation
  ---
  duration_ms: 14097.8728
  type: 'test'
  ...
# Subtest: record identities alone do not prove original current page
ok 5 - record identities alone do not prove original current page
  ---
  duration_ms: 10.6672
  type: 'test'
  ...
# Subtest: current-page prefix does not invent a total from the observation
ok 6 - current-page prefix does not invent a total from the observation
  ---
  duration_ms: 4.8124
  type: 'test'
  ...
# Subtest: original current page does not authorize an observed total
ok 7 - original current page does not authorize an observed total
  ---
  duration_ms: 0.8024
  type: 'test'
  ...
# Subtest: positive current page 当前第1页。
ok 8 - positive current page 当前第1页。
  ---
  duration_ms: 0.2143
  type: 'test'
  ...
# Subtest: positive current page 回到第1页。
ok 9 - positive current page 回到第1页。
  ---
  duration_ms: 0.098
  type: 'test'
  ...
# Subtest: positive current page 恢复到第1页。
ok 10 - positive current page 恢复到第1页。
  ---
  duration_ms: 0.0775
  type: 'test'
  ...
# Subtest: positive current page 默认第1页显示X001至X002。
ok 11 - positive current page 默认第1页显示X001至X002。
  ---
  duration_ms: 0.0709
  type: 'test'
  ...
# Subtest: positive current page 分页显示第1页。
ok 12 - positive current page 分页显示第1页。
  ---
  duration_ms: 0.0593
  type: 'test'
  ...
# Subtest: do not manufacture current-only source 不是第1页。
ok 13 - do not manufacture current-only source 不是第1页。
  ---
  duration_ms: 0.5498
  type: 'test'
  ...
# Subtest: do not manufacture current-only source 如果当前第1页则显示。
ok 14 - do not manufacture current-only source 如果当前第1页则显示。
  ---
  duration_ms: 0.2775
  type: 'test'
  ...
# Subtest: do not manufacture current-only source 例如默认第1页。
ok 15 - do not manufacture current-only source 例如默认第1页。
  ---
  duration_ms: 0.1193
  type: 'test'
  ...
# Subtest: do not manufacture current-only source 显示第1页按钮。
ok 16 - do not manufacture current-only source 显示第1页按钮。
  ---
  duration_ms: 0.0593
  type: 'test'
  ...
# Subtest: do not manufacture current-only source 操作前显示第1页。
ok 17 - do not manufacture current-only source 操作前显示第1页。
  ---
  duration_ms: 0.045
  type: 'test'
  ...
# Subtest: do not manufacture current-only source 曾经显示第1页。
ok 18 - do not manufacture current-only source 曾经显示第1页。
  ---
  duration_ms: 0.0359
  type: 'test'
  ...
# Subtest: do not manufacture current-only source 显示第1页至第3页。
ok 19 - do not manufacture current-only source 显示第1页至第3页。
  ---
  duration_ms: 0.0369
  type: 'test'
  ...
# Subtest: do not manufacture current-only source 未要求当前第1页。
ok 20 - do not manufacture current-only source 未要求当前第1页。
  ---
  duration_ms: 0.0321
  type: 'test'
  ...
# Subtest: do not manufacture current-only source 默认第1/9页。
ok 21 - do not manufacture current-only source 默认第1/9页。
  ---
  duration_ms: 0.085
  type: 'test'
  ...
# Subtest: do not manufacture current-only source 回到第1页；分页第1/9页。
ok 22 - do not manufacture current-only source 回到第1页；分页第1/9页。
  ---
  duration_ms: 0.1104
  type: 'test'
  ...
# Subtest: weak boundary/wrong page/extra total does not prove original page: 第1
ok 23 - weak boundary/wrong page/extra total does not prove original page: 第1
  ---
  duration_ms: 0.0981
  type: 'test'
  ...
# Subtest: weak boundary/wrong page/extra total does not prove original page: 第11/
ok 24 - weak boundary/wrong page/extra total does not prove original page: 第11/
  ---
  duration_ms: 0.0419
  type: 'test'
  ...
# Subtest: weak boundary/wrong page/extra total does not prove original page: 共2条 · 第1/
ok 25 - weak boundary/wrong page/extra total does not prove original page: 共2条 · 第1/
  ---
  duration_ms: 0.035
  type: 'test'
  ...
# Subtest: weak boundary/wrong page/extra total does not prove original page: 第1/9页
ok 26 - weak boundary/wrong page/extra total does not prove original page: 第1/9页
  ---
  duration_ms: 0.0373
  type: 'test'
  ...
# Subtest: table or control is not a current-page counter label
ok 27 - table or control is not a current-page counter label
  ---
  duration_ms: 0.1029
  type: 'test'
  ...
# Subtest: table or control is not a current-page counter rolebutton
ok 28 - table or control is not a current-page counter rolebutton
  ---
  duration_ms: 0.0678
  type: 'test'
  ...
# Subtest: table or control is not a current-page counter roletable
ok 29 - table or control is not a current-page counter roletable
  ---
  duration_ms: 0.0452
  type: 'test'
  ...
# Subtest: table or control is not a current-page counter roletable
ok 30 - table or control is not a current-page counter roletable
  ---
  duration_ms: 0.0411
  type: 'test'
  ...
# Subtest: table or control is not a current-page counter cell
ok 31 - table or control is not a current-page counter cell
  ---
  duration_ms: 0.0432
  type: 'test'
  ...
# Subtest: same step obligation only; source/candidate immutable, shared guidance
ok 32 - same step obligation only; source/candidate immutable, shared guidance
  ---
  duration_ms: 0.3776
  type: 'test'
  ...
# Subtest: runtime CSS aliases still cannot use a table or interactive control as counter
ok 33 - runtime CSS aliases still cannot use a table or interactive control as counter
  ---
  duration_ms: 828.4875
  type: 'test'
  ...
# Subtest: negative/conditional/control/past/invalid full counter does not suppress current-page obligation: 不显示第1/9页
ok 34 - negative/conditional/control/past/invalid full counter does not suppress current-page obligation: 不显示第1/9页
  ---
  duration_ms: 0.2453
  type: 'test'
  ...
# Subtest: negative/conditional/control/past/invalid full counter does not suppress current-page obligation: 如果显示第1/9页
ok 35 - negative/conditional/control/past/invalid full counter does not suppress current-page obligation: 如果显示第1/9页
  ---
  duration_ms: 0.0728
  type: 'test'
  ...
# Subtest: negative/conditional/control/past/invalid full counter does not suppress current-page obligation: 按钮显示第1/9页
ok 36 - negative/conditional/control/past/invalid full counter does not suppress current-page obligation: 按钮显示第1/9页
  ---
  duration_ms: 0.0405
  type: 'test'
  ...
# Subtest: negative/conditional/control/past/invalid full counter does not suppress current-page obligation: 之前显示第1/9页
ok 37 - negative/conditional/control/past/invalid full counter does not suppress current-page obligation: 之前显示第1/9页
  ---
  duration_ms: 0.0386
  type: 'test'
  ...
# Subtest: negative/conditional/control/past/invalid full counter does not suppress current-page obligation: 分页第1/0页
ok 38 - negative/conditional/control/past/invalid full counter does not suppress current-page obligation: 分页第1/0页
  ---
  duration_ms: 0.0407
  type: 'test'
  ...
1..38
# tests 38
# suites 0
# pass 38
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 42897.1958
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

版本32当前页必要证据，38项重叠工程复检，不是官方模型验收；341项受影响回归另留证。
