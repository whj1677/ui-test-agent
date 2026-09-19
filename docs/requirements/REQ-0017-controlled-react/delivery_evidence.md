# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-20T07:39:20+08:00`
- Record: `REQ-0017-controlled-react`
- Change fingerprint: `47f2188d625623344686a68b4316a6d2585d1e5c8acbe1e218e256da4589a8c2`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test --test-concurrency=2 tests/order-evidence.test.mjs tests/order-evidence.execution.test.mjs`
- Exit code: `0`
- Test count: `43`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/req0017/v29-delivery.log`
- Log SHA-256: `8ef3ec8987350c35a6aacb097a3ca632b09910f1325c28398b20d3852d333269`

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
 M docs/requirements/REQ-0017-controlled-react/real-model-v28-result.md
 M docs/requirements/REQ-0017-controlled-react/requirement.source.json
 M src/adaptive-plan.mjs
 M src/adaptive-recovery.mjs
 M src/adaptive-review.mjs
 M src/plan-semantics.mjs
?? docs/requirements/REQ-0017-controlled-react/real-model-v29-result.md
?? src/order-evidence.mjs
?? tests/order-evidence.execution.test.mjs
?? tests/order-evidence.test.mjs
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
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/real-model-v28-result.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-plan.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-recovery.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-review.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/plan-semantics.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md                    |   2 +
 docs/requirements/README.md                        |   2 +
 .../00_user_requirement.md                         |   4 +
 .../REQ-0017-controlled-react/02_design.md         |   2 +-
 .../REQ-0017-controlled-react/03_tasks.md          |   2 +-
 .../REQ-0017-controlled-react/04_verification.md   |   2 +-
 .../REQ-0017-controlled-react/05_trace.md          |   2 +-
 .../REQ-0017-controlled-react/change_log.md        |   1 +
 .../REQ-0017-controlled-react/current_state.md     |   8 +-
 .../REQ-0017-controlled-react/delivery_evidence.md | 344 ++++++++++++++-------
 .../real-model-v28-result.md                       |  14 +
 .../requirement.source.json                        |  26 +-
 src/adaptive-plan.mjs                              |   2 +
 src/adaptive-recovery.mjs                          |   2 +
 src/adaptive-review.mjs                            |   2 +
 src/plan-semantics.mjs                             |   8 +
 16 files changed, 296 insertions(+), 127 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0017-controlled-react/real-model-v29-result.md
src/order-evidence.mjs
tests/order-evidence.execution.test.mjs
tests/order-evidence.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-20T07:38:56+08:00
Command: node --test --test-concurrency=2 tests/order-evidence.test.mjs tests/order-evidence.execution.test.mjs
Exit code: 0
Parsed test count: 43
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: actual order, not control state: correct
ok 1 - actual order, not control state: correct
  ---
  duration_ms: 8245.6514
  type: 'test'
  ...
# Subtest: actual order, not control state: wrong-table-order
ok 2 - actual order, not control state: wrong-table-order
  ---
  duration_ms: 8322.8015
  type: 'test'
  ...
# Subtest: actual order, not control state: persistent-control-only
ok 3 - actual order, not control state: persistent-control-only
  ---
  duration_ms: 6219.1563
  type: 'test'
  ...
# Subtest: sort control cannot complete an original actual order obligation
ok 4 - sort control cannot complete an original actual order obligation
  ---
  duration_ms: 5.4168
  type: 'test'
  ...
# Subtest: missing order witness is not complete either
ok 5 - missing order witness is not complete either
  ---
  duration_ms: 0.3377
  type: 'test'
  ...
# Subtest: partial may still gather order evidence; fixed path is unchanged
ok 6 - partial may still gather order evidence; fixed path is unchanged
  ---
  duration_ms: 0.5871
  type: 'test'
  ...
# Subtest: literal supported source 排序为编号升序
ok 7 - literal supported source 排序为编号升序
  ---
  duration_ms: 0.2025
  type: 'test'
  ...
# Subtest: literal supported source 默认排序是编号升序
ok 8 - literal supported source 默认排序是编号升序
  ---
  duration_ms: 0.118
  type: 'test'
  ...
# Subtest: literal supported source 表格按编号升序排列
ok 9 - literal supported source 表格按编号升序排列
  ---
  duration_ms: 0.1714
  type: 'test'
  ...
# Subtest: literal supported source 列表以编号升序排序
ok 10 - literal supported source 列表以编号升序排序
  ---
  duration_ms: 0.1151
  type: 'test'
  ...
# Subtest: literal supported source 默认计数器为3，排序为编号升序，表体3行
ok 11 - literal supported source 默认计数器为3，排序为编号升序，表体3行
  ---
  duration_ms: 0.0778
  type: 'test'
  ...
# Subtest: does not invent ordering for 排序控件显示编号升序
ok 12 - does not invent ordering for 排序控件显示编号升序
  ---
  duration_ms: 0.4855
  type: 'test'
  ...
# Subtest: does not invent ordering for 排序下拉框排序为编号升序
ok 13 - does not invent ordering for 排序下拉框排序为编号升序
  ---
  duration_ms: 0.2591
  type: 'test'
  ...
# Subtest: does not invent ordering for 不要求排序为编号升序
ok 14 - does not invent ordering for 不要求排序为编号升序
  ---
  duration_ms: 0.1041
  type: 'test'
  ...
# Subtest: does not invent ordering for 如果排序为编号升序才检查
ok 15 - does not invent ordering for 如果排序为编号升序才检查
  ---
  duration_ms: 0.0491
  type: 'test'
  ...
# Subtest: does not invent ordering for 例如排序为编号升序
ok 16 - does not invent ordering for 例如排序为编号升序
  ---
  duration_ms: 0.0356
  type: 'test'
  ...
# Subtest: does not invent ordering for 排序为编号升序或名称降序
ok 17 - does not invent ordering for 排序为编号升序或名称降序
  ---
  duration_ms: 0.1165
  type: 'test'
  ...
# Subtest: does not invent ordering for 尚未应用，排序为编号升序
ok 18 - does not invent ordering for 尚未应用，排序为编号升序
  ---
  duration_ms: 0.0542
  type: 'test'
  ...
# Subtest: does not invent ordering for 操作前排序为编号升序
ok 19 - does not invent ordering for 操作前排序为编号升序
  ---
  duration_ms: 0.035
  type: 'test'
  ...
# Subtest: does not invent ordering for 排序为编号升序仅为示例
ok 20 - does not invent ordering for 排序为编号升序仅为示例
  ---
  duration_ms: 0.0274
  type: 'test'
  ...
# Subtest: does not invent ordering for 表格不按编号升序
ok 21 - does not invent ordering for 表格不按编号升序
  ---
  duration_ms: 0.0834
  type: 'test'
  ...
# Subtest: does not invent ordering for 只核对行数
ok 22 - does not invent ordering for 只核对行数
  ---
  duration_ms: 0.0306
  type: 'test'
  ...
# Subtest: does not invent ordering for 标题包含排序为编号升序
ok 23 - does not invent ordering for 标题包含排序为编号升序
  ---
  duration_ms: 0.0378
  type: 'test'
  ...
# Subtest: same original relation witness accepted, no source or candidate mutation
ok 24 - same original relation witness accepted, no source or candidate mutation
  ---
  duration_ms: 0.2851
  type: 'test'
  ...
# Subtest: relation witness rejects wrong obligation
ok 25 - relation witness rejects wrong obligation
  ---
  duration_ms: 0.1148
  type: 'test'
  ...
# Subtest: relation witness rejects wrong field
ok 26 - relation witness rejects wrong field
  ---
  duration_ms: 0.2032
  type: 'test'
  ...
# Subtest: relation witness rejects wrong direction
ok 27 - relation witness rejects wrong direction
  ---
  duration_ms: 0.1928
  type: 'test'
  ...
# Subtest: relation witness rejects invented quote
ok 28 - relation witness rejects invented quote
  ---
  duration_ms: 0.1574
  type: 'test'
  ...
# Subtest: relation witness rejects control only
ok 29 - relation witness rejects control only
  ---
  duration_ms: 0.0835
  type: 'test'
  ...
# Subtest: complete original identity matrix can prove identifier order without a redundant check
ok 30 - complete original identity matrix can prove identifier order without a redundant check
  ---
  duration_ms: 0.4503
  type: 'test'
  ...
# Subtest: matrix cannot prove whole order: subset
ok 31 - matrix cannot prove whole order: subset
  ---
  duration_ms: 0.1269
  type: 'test'
  ...
# Subtest: matrix cannot prove whole order: unordered
ok 32 - matrix cannot prove whole order: unordered
  ---
  duration_ms: 0.0859
  type: 'test'
  ...
# Subtest: matrix cannot prove whole order: reverse
ok 33 - matrix cannot prove whole order: reverse
  ---
  duration_ms: 0.4645
  type: 'test'
  ...
# Subtest: matrix cannot prove whole order: single
ok 34 - matrix cannot prove whole order: single
  ---
  duration_ms: 0.5721
  type: 'test'
  ...
# Subtest: matrix cannot prove whole order: wrong field
ok 35 - matrix cannot prove whole order: wrong field
  ---
  duration_ms: 0.129
  type: 'test'
  ...
# Subtest: matrix cannot prove whole order: wrong source
ok 36 - matrix cannot prove whole order: wrong source
  ---
  duration_ms: 0.0803
  type: 'test'
  ...
# Subtest: projected matrix cannot establish actual suffix uniqueness or absence of exact header
ok 37 - projected matrix cannot establish actual suffix uniqueness or absence of exact header
  ---
  duration_ms: 0.0834
  type: 'test'
  ...
# Subtest: complete exact-value same-unit matrix supports the original numeric order
ok 38 - complete exact-value same-unit matrix supports the original numeric order
  ---
  duration_ms: 0.4264
  type: 'test'
  ...
# Subtest: matrix relation does not infer unsupported values: mixed units
ok 39 - matrix relation does not infer unsupported values: mixed units
  ---
  duration_ms: 0.1738
  type: 'test'
  ...
# Subtest: matrix relation does not infer unsupported values: wrong column
ok 40 - matrix relation does not infer unsupported values: wrong column
  ---
  duration_ms: 0.0922
  type: 'test'
  ...
# Subtest: matrix relation does not infer unsupported values: numeric projection
ok 41 - matrix relation does not infer unsupported values: numeric projection
  ---
  duration_ms: 0.0861
  type: 'test'
  ...
# Subtest: matrix relation does not infer unsupported values: duplicate column
ok 42 - matrix relation does not infer unsupported values: duplicate column
  ---
  duration_ms: 0.1222
  type: 'test'
  ...
# Subtest: original short field still needs actual header inventory, not an expected-column projection
ok 43 - original short field still needs actual header inventory, not an expected-column projection
  ---
  duration_ms: 0.2193
  type: 'test'
  ...
1..43
# tests 43
# suites 0
# pass 43
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 23276.5752
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

版本29排序必要证据守卫工程复检；真实浏览器与注入模型为可控替身，不是官方模型；最终317项受影响回归日志另列，既有真实整行摘要误报未解决，整体目标未达。
