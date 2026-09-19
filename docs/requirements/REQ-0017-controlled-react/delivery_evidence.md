# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-20T07:50:53+08:00`
- Record: `REQ-0017-controlled-react`
- Change fingerprint: `bca71f0e39e754c1830d1c7f30d2587576fce9e4c48de5253257391fe5bdb3d1`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test --test-concurrency=2 tests/row-evidence.test.mjs tests/row-evidence.execution.test.mjs`
- Exit code: `0`
- Test count: `29`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/req0017/v30-delivery.log`
- Log SHA-256: `25010a0aff8c0ea09662d2867e2b729318d4689928ad5616c950b290f056efe0`

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
 M src/adaptive-execution.mjs
 M src/adaptive-plan.mjs
 M src/adaptive-recovery.mjs
 M src/adaptive-review.mjs
 M src/assertion-evidence.mjs
?? docs/requirements/REQ-0017-controlled-react/real-model-v30-result.md
?? src/row-evidence.mjs
?? tests/row-evidence.execution.test.mjs
?? tests/row-evidence.test.mjs
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
warning: in the working copy of 'src/adaptive-execution.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-plan.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-recovery.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-review.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/assertion-evidence.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md                    |   2 +
 docs/requirements/README.md                        |   2 +
 .../00_user_requirement.md                         |   2 +
 .../REQ-0017-controlled-react/02_design.md         |   2 +-
 .../REQ-0017-controlled-react/03_tasks.md          |   2 +-
 .../REQ-0017-controlled-react/04_verification.md   |   2 +-
 .../REQ-0017-controlled-react/05_trace.md          |   2 +-
 .../REQ-0017-controlled-react/change_log.md        |   1 +
 .../REQ-0017-controlled-react/current_state.md     |   8 +-
 .../REQ-0017-controlled-react/delivery_evidence.md | 347 ++++++++-------------
 .../requirement.source.json                        |  24 +-
 src/adaptive-execution.mjs                         |  19 +-
 src/adaptive-plan.mjs                              |   3 +
 src/adaptive-recovery.mjs                          |   2 +
 src/adaptive-review.mjs                            |   2 +
 src/assertion-evidence.mjs                         |   4 +
 16 files changed, 184 insertions(+), 240 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0017-controlled-react/real-model-v30-result.md
src/row-evidence.mjs
tests/row-evidence.execution.test.mjs
tests/row-evidence.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-20T07:50:16+08:00
Command: node --test --test-concurrency=2 tests/row-evidence.test.mjs tests/row-evidence.execution.test.mjs
Exit code: 0
Parsed test count: 29
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: row source boundary without normalizing fabricated oracle: repair
ok 1 - row source boundary without normalizing fabricated oracle: repair
  ---
  duration_ms: 8724.6143
  type: 'test'
  ...
# Subtest: row source boundary without normalizing fabricated oracle: actual-field-difference
ok 2 - row source boundary without normalizing fabricated oracle: actual-field-difference
  ---
  duration_ms: 9732.7105
  type: 'test'
  ...
# Subtest: row source boundary without normalizing fabricated oracle: persistent-aggregate
ok 3 - row source boundary without normalizing fabricated oracle: persistent-aggregate
  ---
  duration_ms: 7293.3739
  type: 'test'
  ...
# Subtest: row source boundary without normalizing fabricated oracle: explicit-literal-difference
ok 4 - row source boundary without normalizing fabricated oracle: explicit-literal-difference
  ---
  duration_ms: 9695.2992
  type: 'test'
  ...
# Subtest: copied whole-row text is rejected before execution: text/true
ok 5 - copied whole-row text is rejected before execution: text/true
  ---
  duration_ms: 6.721
  type: 'test'
  ...
# Subtest: copied whole-row text is rejected before execution: text/false
ok 6 - copied whole-row text is rejected before execution: text/false
  ---
  duration_ms: 0.8217
  type: 'test'
  ...
# Subtest: copied whole-row text is rejected before execution: contains/true
ok 7 - copied whole-row text is rejected before execution: contains/true
  ---
  duration_ms: 0.6473
  type: 'test'
  ...
# Subtest: whole row syntax does not bind a business field {"kind":"row","table":{"kind":"role","role":"table","name":"结果","exact":true},"key":{"column":"编号","value":"Z019"}}
ok 8 - whole row syntax does not bind a business field {"kind":"row","table":{"kind":"role","role":"table","name":"结果","exact":true},"key":{"column":"编号","value":"Z019"}}
  ---
  duration_ms: 0.3622
  type: 'test'
  ...
# Subtest: whole row syntax does not bind a business field {"kind":"role","role":"row","name":"Z019 箱体","exact":true}
ok 9 - whole row syntax does not bind a business field {"kind":"role","role":"row","name":"Z019 箱体","exact":true}
  ---
  duration_ms: 0.1179
  type: 'test'
  ...
# Subtest: whole row syntax does not bind a business field {"kind":"within","scope":{"role":"region","name":"结果","exact":true},"target":{"kind":"row","table":{"kind":"role","role":"table","name":"结果","exact":true},"key":{"column":"编号","value":"Z019"}}}
ok 10 - whole row syntax does not bind a business field {"kind":"within","scope":{"role":"region","name":"结果","exact":true},"target":{"kind":"row","table":{"kind":"role","role":"table","name":"结果","exact":true},"key":{"column":"编号","value":"Z019"}}}
  ---
  duration_ms: 0.1595
  type: 'test'
  ...
# Subtest: a field or child target is not a whole row cell
ok 11 - a field or child target is not a whole row cell
  ---
  duration_ms: 0.2165
  type: 'test'
  ...
# Subtest: a field or child target is not a whole row row
ok 12 - a field or child target is not a whole row row
  ---
  duration_ms: 0.0668
  type: 'test'
  ...
# Subtest: a field or child target is not a whole row role
ok 13 - a field or child target is not a whole row role
  ---
  duration_ms: 0.209
  type: 'test'
  ...
# Subtest: row existence is not a scalar field predicate visible
ok 14 - row existence is not a scalar field predicate visible
  ---
  duration_ms: 0.394
  type: 'test'
  ...
# Subtest: row existence is not a scalar field predicate hidden
ok 15 - row existence is not a scalar field predicate hidden
  ---
  duration_ms: 0.199
  type: 'test'
  ...
# Subtest: row existence is not a scalar field predicate count
ok 16 - row existence is not a scalar field predicate count
  ---
  duration_ms: 0.0585
  type: 'test'
  ...
# Subtest: preserve explicit original literal 整行文本为“Z019 箱体”
ok 17 - preserve explicit original literal 整行文本为“Z019 箱体”
  ---
  duration_ms: 0.2742
  type: 'test'
  ...
# Subtest: preserve explicit original literal 整行内容包含“箱体”
ok 18 - preserve explicit original literal 整行内容包含“箱体”
  ---
  duration_ms: 0.1243
  type: 'test'
  ...
# Subtest: preserve explicit original literal 整行文本必须等于“状态不通过”
ok 19 - preserve explicit original literal 整行文本必须等于“状态不通过”
  ---
  duration_ms: 0.0488
  type: 'test'
  ...
# Subtest: no inferred literal intent 如果整行文本为“Z019 箱体”
ok 20 - no inferred literal intent 如果整行文本为“Z019 箱体”
  ---
  duration_ms: 0.1939
  type: 'test'
  ...
# Subtest: no inferred literal intent 不要求整行文本为“Z019 箱体”
ok 21 - no inferred literal intent 不要求整行文本为“Z019 箱体”
  ---
  duration_ms: 0.065
  type: 'test'
  ...
# Subtest: no inferred literal intent 例如整行文本为“Z019 箱体”
ok 22 - no inferred literal intent 例如整行文本为“Z019 箱体”
  ---
  duration_ms: 0.119
  type: 'test'
  ...
# Subtest: no inferred literal intent 整行文本为“Z019 箱体”仅为示例
ok 23 - no inferred literal intent 整行文本为“Z019 箱体”仅为示例
  ---
  duration_ms: 0.0755
  type: 'test'
  ...
# Subtest: no inferred literal intent 整行文本为“Z019 箱体”或者其他内容
ok 24 - no inferred literal intent 整行文本为“Z019 箱体”或者其他内容
  ---
  duration_ms: 0.0467
  type: 'test'
  ...
# Subtest: no inferred literal intent 名称为Z019 箱体
ok 25 - no inferred literal intent 名称为Z019 箱体
  ---
  duration_ms: 0.0622
  type: 'test'
  ...
# Subtest: no inferred literal intent 整行文本为Z019 箱体
ok 26 - no inferred literal intent 整行文本为Z019 箱体
  ---
  duration_ms: 0.2072
  type: 'test'
  ...
# Subtest: literal from another obligation, another value or different predicate cannot authorize aggregate field proof
ok 27 - literal from another obligation, another value or different predicate cannot authorize aggregate field proof
  ---
  duration_ms: 0.2983
  type: 'test'
  ...
# Subtest: pure checks do not normalize the original or rewrite candidate; guidance shared
ok 28 - pure checks do not normalize the original or rewrite candidate; guidance shared
  ---
  duration_ms: 0.716
  type: 'test'
  ...
# Subtest: actual native/ARIA rows reject CSS aliases before dispatch; cells and absent future targets remain distinct
ok 29 - actual native/ARIA rows reject CSS aliases before dispatch; cells and absent future targets remain distinct
  ---
  duration_ms: 917.5551
  type: 'test'
  ...
1..29
# tests 29
# suites 0
# pass 29
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 35993.7849
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

版本30整行字段证据工程复检，实际Chromium与注入回复是可控替身；原真实误报保留，235项受影响回归另列，官方待冻结复验，不作为产品验收。
