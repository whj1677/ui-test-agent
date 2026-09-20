# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-20T08:15:45+08:00`
- Record: `REQ-0017-controlled-react`
- Change fingerprint: `146b31f635f37bed50b2bb595a9f3eb55ff838e8d884d5484729157a72626bdd`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test --test-concurrency=2 tests/query-result-evidence.test.mjs tests/query-result-evidence.execution.test.mjs`
- Exit code: `0`
- Test count: `33`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/req0017/v31-delivery.log`
- Log SHA-256: `6b3b9abdaf5817d5bc8c11e80b3222ad249a436946a7f2112655f8572645d377`

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
 M docs/requirements/REQ-0017-controlled-react/real-model-v30-result.md
 M docs/requirements/REQ-0017-controlled-react/requirement.source.json
 M src/adaptive-plan.mjs
 M src/adaptive-recovery.mjs
 M src/adaptive-review.mjs
?? docs/requirements/REQ-0017-controlled-react/real-model-v31-result.md
?? src/query-result-evidence.mjs
?? tests/query-result-evidence.execution.test.mjs
?? tests/query-result-evidence.test.mjs
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
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/real-model-v30-result.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-plan.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-recovery.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-review.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md                    |   4 +-
 docs/requirements/README.md                        |   2 +-
 .../00_user_requirement.md                         |   3 +
 .../REQ-0017-controlled-react/02_design.md         |   2 +-
 .../REQ-0017-controlled-react/03_tasks.md          |   2 +-
 .../REQ-0017-controlled-react/04_verification.md   |   2 +-
 .../REQ-0017-controlled-react/05_trace.md          |   2 +-
 .../REQ-0017-controlled-react/change_log.md        |   1 +
 .../REQ-0017-controlled-react/current_state.md     |   8 +-
 .../REQ-0017-controlled-react/delivery_evidence.md | 284 +++++++++++----------
 .../real-model-v30-result.md                       |   4 +-
 .../requirement.source.json                        |  25 +-
 src/adaptive-plan.mjs                              |   6 +
 src/adaptive-recovery.mjs                          |   4 +
 src/adaptive-review.mjs                            |   2 +
 15 files changed, 200 insertions(+), 151 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0017-controlled-react/real-model-v31-result.md
src/query-result-evidence.mjs
tests/query-result-evidence.execution.test.mjs
tests/query-result-evidence.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-20T08:14:23+08:00
Command: node --test --test-concurrency=2 tests/query-result-evidence.test.mjs tests/query-result-evidence.execution.test.mjs
Exit code: 0
Parsed test count: 33
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: AND result evidence without replay: correct
ok 1 - AND result evidence without replay: correct
  ---
  duration_ms: 27146.7595
  type: 'test'
  ...
# Subtest: AND result evidence without replay: wrong-result-name
ok 2 - AND result evidence without replay: wrong-result-name
  ---
  duration_ms: 28575.4361
  type: 'test'
  ...
# Subtest: AND result evidence without replay: persistent-input-only
ok 3 - AND result evidence without replay: persistent-input-only
  ---
  duration_ms: 24819.6324
  type: 'test'
  ...
# Subtest: AND result cannot complete with keyword input plus only park and state result fields
ok 4 - AND result cannot complete with keyword input plus only park and state result fields
  ---
  duration_ms: 8.1461
  type: 'test'
  ...
# Subtest: AND fields from different records cannot be assembled into one proof
ok 5 - AND fields from different records cannot be assembled into one proof
  ---
  duration_ms: 1.9644
  type: 'test'
  ...
# Subtest: complete same-record field proof remains accepted
ok 6 - complete same-record field proof remains accepted
  ---
  duration_ms: 1.7006
  type: 'test'
  ...
# Subtest: necessary field proof rejects missing
ok 7 - necessary field proof rejects missing
  ---
  duration_ms: 0.3807
  type: 'test'
  ...
# Subtest: necessary field proof rejects wrong-value
ok 8 - necessary field proof rejects wrong-value
  ---
  duration_ms: 0.2096
  type: 'test'
  ...
# Subtest: necessary field proof rejects contains-selector
ok 9 - necessary field proof rejects contains-selector
  ---
  duration_ms: 0.1414
  type: 'test'
  ...
# Subtest: necessary field proof rejects other-obligation
ok 10 - necessary field proof rejects other-obligation
  ---
  duration_ms: 0.1482
  type: 'test'
  ...
# Subtest: necessary field proof rejects other-table
ok 11 - necessary field proof rejects other-table
  ---
  duration_ms: 0.122
  type: 'test'
  ...
# Subtest: partial fragment may defer result evidence but cannot claim completion
ok 12 - partial fragment may defer result evidence but cannot claim completion
  ---
  duration_ms: 1.4855
  type: 'test'
  ...
# Subtest: same-table original matrix supports each row; one bad row cannot borrow a different row field
ok 13 - same-table original matrix supports each row; one bad row cannot borrow a different row field
  ---
  duration_ms: 2.2843
  type: 'test'
  ...
# Subtest: keyword may be measured with original substring, not weakened selector comparison
ok 14 - keyword may be measured with original substring, not weakened selector comparison
  ---
  duration_ms: 1.0185
  type: 'test'
  ...
# Subtest: no positive AND requirement manufactured: 条件不按AND生效。
ok 15 - no positive AND requirement manufactured: 条件不按AND生效。
  ---
  duration_ms: 0.4031
  type: 'test'
  ...
# Subtest: no positive AND requirement manufactured: 如果条件按AND生效则显示。
ok 16 - no positive AND requirement manufactured: 如果条件按AND生效则显示。
  ---
  duration_ms: 0.0531
  type: 'test'
  ...
# Subtest: no positive AND requirement manufactured: 例如条件按AND生效。
ok 17 - no positive AND requirement manufactured: 例如条件按AND生效。
  ---
  duration_ms: 0.0361
  type: 'test'
  ...
# Subtest: no positive AND requirement manufactured: 尚未查询，不要求条件按AND生效。
ok 18 - no positive AND requirement manufactured: 尚未查询，不要求条件按AND生效。
  ---
  duration_ms: 0.029
  type: 'test'
  ...
# Subtest: no positive AND requirement manufactured: 输入框条件已设置。
ok 19 - no positive AND requirement manufactured: 输入框条件已设置。
  ---
  duration_ms: 0.0261
  type: 'test'
  ...
# Subtest: ambiguous or interrupted input never borrowed: 点击「重置」。
ok 20 - ambiguous or interrupted input never borrowed: 点击「重置」。
  ---
  duration_ms: 1.2234
  type: 'test'
  ...
# Subtest: ambiguous or interrupted input never borrowed: 进入另一个页面。
ok 21 - ambiguous or interrupted input never borrowed: 进入另一个页面。
  ---
  duration_ms: 0.5524
  type: 'test'
  ...
# Subtest: ambiguous or interrupted input never borrowed: 如果需要，在「关键词」输入 阀门。
ok 22 - ambiguous or interrupted input never borrowed: 如果需要，在「关键词」输入 阀门。
  ---
  duration_ms: 0.6239
  type: 'test'
  ...
# Subtest: ambiguous or interrupted input never borrowed: 在关键词输入 阀门。
ok 23 - ambiguous or interrupted input never borrowed: 在关键词输入 阀门。
  ---
  duration_ms: 0.5234
  type: 'test'
  ...
# Subtest: ambiguous or interrupted input never borrowed: 在「状态」选择 在线，「状态」选择 离线。
ok 24 - ambiguous or interrupted input never borrowed: 在「状态」选择 在线，「状态」选择 离线。
  ---
  duration_ms: 0.5217
  type: 'test'
  ...
# Subtest: later expected fields cannot substitute original query inputs
ok 25 - later expected fields cannot substitute original query inputs
  ---
  duration_ms: 1.6907
  type: 'test'
  ...
# Subtest: same-step literal inputs and quoted values are supported; sorting is not a result condition
ok 26 - same-step literal inputs and quoted values are supported; sorting is not a result condition
  ---
  duration_ms: 1.3484
  type: 'test'
  ...
# Subtest: one column cannot prove two different named inputs just because their literals are equal
ok 27 - one column cannot prove two different named inputs just because their literals are equal
  ---
  duration_ms: 0.3704
  type: 'test'
  ...
# Subtest: source, candidate and shared guidance remain unchanged
ok 28 - source, candidate and shared guidance remain unchanged
  ---
  duration_ms: 0.7391
  type: 'test'
  ...
# Subtest: explicit empty results can use actual empty-table evidence, not invent a record
ok 29 - explicit empty results can use actual empty-table evidence, not invent a record
  ---
  duration_ms: 0.2729
  type: 'test'
  ...
# Subtest: unknown matching semantics or omitted clauses remain unresolved: 「名称」输入 阀门，「园区」选择 西区。
ok 30 - unknown matching semantics or omitted clauses remain unresolved: 「名称」输入 阀门，「园区」选择 西区。
  ---
  duration_ms: 0.119
  type: 'test'
  ...
# Subtest: unknown matching semantics or omitted clauses remain unresolved: 「关键词」输入 阀门，「园区」选择 全部。
ok 31 - unknown matching semantics or omitted clauses remain unresolved: 「关键词」输入 阀门，「园区」选择 全部。
  ---
  duration_ms: 0.0544
  type: 'test'
  ...
# Subtest: unknown matching semantics or omitted clauses remain unresolved: 「关键词」输入 阀门，「园区」选择 西区，然后清空条件。
ok 32 - unknown matching semantics or omitted clauses remain unresolved: 「关键词」输入 阀门，「园区」选择 西区，然后清空条件。
  ---
  duration_ms: 0.04
  type: 'test'
  ...
# Subtest: unknown matching semantics or omitted clauses remain unresolved: 「关键词」输入 阀门，「园区」选择 西区，设置第三条件。
ok 33 - unknown matching semantics or omitted clauses remain unresolved: 「关键词」输入 阀门，「园区」选择 西区，设置第三条件。
  ---
  duration_ms: 0.0888
  type: 'test'
  ...
1..33
# tests 33
# suites 0
# pass 33
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 81032.2139
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

版本31限定AND结果必要证据，33项重叠工程复检，不是官方模型验收；337项受影响回归另留证。
