# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-20T05:15:45+08:00`
- Record: `REQ-0017-controlled-react`
- Change fingerprint: `1583d808f125aa4279cf08312fff285994167b23f7b8e8b2def059475fafabd5`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test --test-concurrency=2 tests/table-invariant-source.test.mjs tests/table-invariant-source.execution.test.mjs tests/table-invariant.test.mjs`
- Exit code: `0`
- Test count: `55`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/req0017/v22-delivery.log`
- Log SHA-256: `36dfe0eb920204fa637bcb5cb9d5bee5b9da456e0571d32b49e39f531479a9d5`

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
 M docs/requirements/REQ-0017-controlled-react/real-model-v21-heldout.md
 M docs/requirements/REQ-0017-controlled-react/requirement.source.json
 M src/table-invariant.mjs
?? docs/requirements/REQ-0017-controlled-react/real-model-v22-result.md
?? tests/table-invariant-source.execution.test.mjs
?? tests/table-invariant-source.test.mjs
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
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/real-model-v21-heldout.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/table-invariant.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md                    |   4 +
 .../00_user_requirement.md                         |   3 +
 .../REQ-0017-controlled-react/02_design.md         |   2 +-
 .../REQ-0017-controlled-react/03_tasks.md          |   2 +-
 .../REQ-0017-controlled-react/04_verification.md   |   2 +-
 .../REQ-0017-controlled-react/05_trace.md          |   2 +-
 .../REQ-0017-controlled-react/current_state.md     |   8 +-
 .../REQ-0017-controlled-react/delivery_evidence.md | 423 ++++++++++++++-------
 .../real-model-v21-heldout.md                      |  15 +-
 .../requirement.source.json                        |  17 +-
 src/table-invariant.mjs                            |  15 +-
 11 files changed, 344 insertions(+), 149 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0017-controlled-react/real-model-v22-result.md
tests/table-invariant-source.execution.test.mjs
tests/table-invariant-source.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-20T05:15:22+08:00
Command: node --test --test-concurrency=2 tests/table-invariant-source.test.mjs tests/table-invariant-source.execution.test.mjs tests/table-invariant.test.mjs
Exit code: 0
Parsed test count: 55
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: pre-action baseline for same-step equality prose, difference=false
ok 1 - pre-action baseline for same-step equality prose, difference=false
  ---
  duration_ms: 11540.8258
  type: 'test'
  ...
# Subtest: pre-action baseline for same-step equality prose, difference=true
ok 2 - pre-action baseline for same-step equality prose, difference=true
  ---
  duration_ms: 9673.8623
  type: 'test'
  ...
# Subtest: same-step pre-action table relation: 表格内容与操作前完全一致
ok 3 - same-step pre-action table relation: 表格内容与操作前完全一致
  ---
  duration_ms: 2.4953
  type: 'test'
  ...
# Subtest: same-step pre-action table relation: 列表数据与本步骤操作前相同
ok 4 - same-step pre-action table relation: 列表数据与本步骤操作前相同
  ---
  duration_ms: 0.1861
  type: 'test'
  ...
# Subtest: same-step pre-action table relation: 表格与当前步骤操作前保持一致
ok 5 - same-step pre-action table relation: 表格与当前步骤操作前保持一致
  ---
  duration_ms: 0.0909
  type: 'test'
  ...
# Subtest: same-step pre-action table relation: 列表仍未应用条件
ok 6 - same-step pre-action table relation: 列表仍未应用条件
  ---
  duration_ms: 0.9071
  type: 'test'
  ...
# Subtest: same-step pre-action table relation: 表格内容和操作前完全相同
ok 7 - same-step pre-action table relation: 表格内容和操作前完全相同
  ---
  duration_ms: 0.1407
  type: 'test'
  ...
# Subtest: not a current-step table invariant: 表格不要求与操作前完全一致
ok 8 - not a current-step table invariant: 表格不要求与操作前完全一致
  ---
  duration_ms: 0.1135
  type: 'test'
  ...
# Subtest: not a current-step table invariant: 表格无需与操作前完全一致
ok 9 - not a current-step table invariant: 表格无需与操作前完全一致
  ---
  duration_ms: 0.064
  type: 'test'
  ...
# Subtest: not a current-step table invariant: 如果表格内容与操作前完全一致则继续
ok 10 - not a current-step table invariant: 如果表格内容与操作前完全一致则继续
  ---
  duration_ms: 0.062
  type: 'test'
  ...
# Subtest: not a current-step table invariant: 表格内容与操作前完全一致或已更新
ok 11 - not a current-step table invariant: 表格内容与操作前完全一致或已更新
  ---
  duration_ms: 0.2859
  type: 'test'
  ...
# Subtest: not a current-step table invariant: 表格内容与操作前完全一致不成立
ok 12 - not a current-step table invariant: 表格内容与操作前完全一致不成立
  ---
  duration_ms: 0.3003
  type: 'test'
  ...
# Subtest: not a current-step table invariant: 表格与上一步操作前完全一致
ok 13 - not a current-step table invariant: 表格与上一步操作前完全一致
  ---
  duration_ms: 0.1188
  type: 'test'
  ...
# Subtest: not a current-step table invariant: 表格与历史操作前完全一致
ok 14 - not a current-step table invariant: 表格与历史操作前完全一致
  ---
  duration_ms: 0.0572
  type: 'test'
  ...
# Subtest: not a current-step table invariant: 字段内容与操作前完全一致
ok 15 - not a current-step table invariant: 字段内容与操作前完全一致
  ---
  duration_ms: 0.0415
  type: 'test'
  ...
# Subtest: not a current-step table invariant: 表格与基准文件完全一致
ok 16 - not a current-step table invariant: 表格与基准文件完全一致
  ---
  duration_ms: 0.0407
  type: 'test'
  ...
# Subtest: not a current-step table invariant: 表格与操作前不一致
ok 17 - not a current-step table invariant: 表格与操作前不一致
  ---
  duration_ms: 0.0319
  type: 'test'
  ...
# Subtest: not a current-step table invariant: 表格与操作后完全一致
ok 18 - not a current-step table invariant: 表格与操作后完全一致
  ---
  duration_ms: 0.0296
  type: 'test'
  ...
# Subtest: not a current-step table invariant: 例如表格内容与操作前完全一致
ok 19 - not a current-step table invariant: 例如表格内容与操作前完全一致
  ---
  duration_ms: 0.0289
  type: 'test'
  ...
# Subtest: not a current-step table invariant: 表格与操作前完全一致或继续刷新
ok 20 - not a current-step table invariant: 表格与操作前完全一致或继续刷新
  ---
  duration_ms: 0.029
  type: 'test'
  ...
# Subtest: not a current-step table invariant: 列表未应用条件或数据已更新
ok 21 - not a current-step table invariant: 列表未应用条件或数据已更新
  ---
  duration_ms: 0.0293
  type: 'test'
  ...
# Subtest: not a current-step table invariant: 表格记录数与操作前完全一致
ok 22 - not a current-step table invariant: 表格记录数与操作前完全一致
  ---
  duration_ms: 0.0287
  type: 'test'
  ...
# Subtest: relation matcher authorizes only explicit table/list invariance, not fixed-reference equality or its negation
ok 23 - relation matcher authorizes only explicit table/list invariance, not fixed-reference equality or its negation
  ---
  duration_ms: 312.4739
  type: 'test'
  ...
# Subtest: assertion schema needs sourced relationship and accepts only omitted/true expected
ok 24 - assertion schema needs sourced relationship and accepts only omitted/true expected
  ---
  duration_ms: 2.7728
  type: 'test'
  ...
# Subtest: unchanged 5x5 passes, observed locator duplicates deduplicate, raw baseline and full URL are not serializable
ok 25 - unchanged 5x5 passes, observed locator duplicates deduplicate, raw baseline and full URL are not serializable
  ---
  duration_ms: 297.2034
  type: 'test'
  ...
# Subtest: same-count replacement is a reported business difference, never an eventual-match retry
ok 26 - same-count replacement is a reported business difference, never an eventual-match retry
  ---
  duration_ms: 197.6476
  type: 'test'
  ...
# Subtest: middle field is a reported business difference, never an eventual-match retry
ok 27 - middle field is a reported business difference, never an eventual-match retry
  ---
  duration_ms: 245.8171
  type: 'test'
  ...
# Subtest: row order is a reported business difference, never an eventual-match retry
ok 28 - row order is a reported business difference, never an eventual-match retry
  ---
  duration_ms: 173.9692
  type: 'test'
  ...
# Subtest: column order is a reported business difference, never an eventual-match retry
ok 29 - column order is a reported business difference, never an eventual-match retry
  ---
  duration_ms: 178.2271
  type: 'test'
  ...
# Subtest: additional column is a reported business difference, never an eventual-match retry
ok 30 - additional column is a reported business difference, never an eventual-match retry
  ---
  duration_ms: 170.1521
  type: 'test'
  ...
# Subtest: removed column is a reported business difference, never an eventual-match retry
ok 31 - removed column is a reported business difference, never an eventual-match retry
  ---
  duration_ms: 176.9072
  type: 'test'
  ...
# Subtest: removed row is a reported business difference, never an eventual-match retry
ok 32 - removed row is a reported business difference, never an eventual-match retry
  ---
  duration_ms: 165.7143
  type: 'test'
  ...
# Subtest: numeric display differs is a reported business difference, never an eventual-match retry
ok 33 - numeric display differs is a reported business difference, never an eventual-match retry
  ---
  duration_ms: 173.9894
  type: 'test'
  ...
# Subtest: hidden row is technical invalid both at capture and comparison
ok 34 - hidden row is technical invalid both at capture and comparison
  ---
  duration_ms: 159.156
  type: 'test'
  ...
# Subtest: hidden field is technical invalid both at capture and comparison
ok 35 - hidden field is technical invalid both at capture and comparison
  ---
  duration_ms: 159.3325
  type: 'test'
  ...
# Subtest: aria-hidden row is technical invalid both at capture and comparison
ok 36 - aria-hidden row is technical invalid both at capture and comparison
  ---
  duration_ms: 166.9831
  type: 'test'
  ...
# Subtest: inert row is technical invalid both at capture and comparison
ok 37 - inert row is technical invalid both at capture and comparison
  ---
  duration_ms: 163.4973
  type: 'test'
  ...
# Subtest: transparent table is technical invalid both at capture and comparison
ok 38 - transparent table is technical invalid both at capture and comparison
  ---
  duration_ms: 163.5496
  type: 'test'
  ...
# Subtest: virtual rows is technical invalid both at capture and comparison
ok 39 - virtual rows is technical invalid both at capture and comparison
  ---
  duration_ms: 168.1536
  type: 'test'
  ...
# Subtest: virtual columns is technical invalid both at capture and comparison
ok 40 - virtual columns is technical invalid both at capture and comparison
  ---
  duration_ms: 160.7917
  type: 'test'
  ...
# Subtest: merged cells is technical invalid both at capture and comparison
ok 41 - merged cells is technical invalid both at capture and comparison
  ---
  duration_ms: 215.4268
  type: 'test'
  ...
# Subtest: nested table is technical invalid both at capture and comparison
ok 42 - nested table is technical invalid both at capture and comparison
  ---
  duration_ms: 182.1393
  type: 'test'
  ...
# Subtest: missing cell is technical invalid both at capture and comparison
ok 43 - missing cell is technical invalid both at capture and comparison
  ---
  duration_ms: 177.7742
  type: 'test'
  ...
# Subtest: duplicate columns and oversized full matrices are rejected without truncation
ok 44 - duplicate columns and oversized full matrices are rejected without truncation
  ---
  duration_ms: 170.1413
  type: 'test'
  ...
# Subtest: capture requires exactly one observed native table with a unique locator
ok 45 - capture requires exactly one observed native table with a unique locator
  ---
  duration_ms: 157.5915
  type: 'test'
  ...
# Subtest: missing/forged baseline, wrong run/step/page/locator or missing context cannot pass
ok 46 - missing/forged baseline, wrong run/step/page/locator or missing context cannot pass
  ---
  duration_ms: 286.3178
  type: 'test'
  ...
# Subtest: full URL mismatch ?view=two\#results is technical invalid
ok 47 - full URL mismatch ?view=two\#results is technical invalid
  ---
  duration_ms: 151.7425
  type: 'test'
  ...
# Subtest: full URL mismatch ?view=one\#other is technical invalid
ok 48 - full URL mismatch ?view=one\#other is technical invalid
  ---
  duration_ms: 153.876
  type: 'test'
  ...
# Subtest: an empty native table can remain empty, adding a row fails
ok 49 - an empty native table can remain empty, adding a row fails
  ---
  duration_ms: 173.3868
  type: 'test'
  ...
# Subtest: comparison is raw but evidence matrices/differences are redacted
ok 50 - comparison is raw but evidence matrices/differences are redacted
  ---
  duration_ms: 159.1552
  type: 'test'
  ...
# Subtest: real fill/select actions each record sourced invariant evidence without changing the baseline
ok 51 - real fill/select actions each record sourced invariant evidence without changing the baseline
  ---
  duration_ms: 237.32
  type: 'test'
  ...
# Subtest: executeStep stops on first changed action; the second action that would restore the table is never dispatched
ok 52 - executeStep stops on first changed action; the second action that would restore the table is never dispatched
  ---
  duration_ms: 185.8934
  type: 'test'
  ...
# Subtest: executeStep rejects a baseline from another original step before any interaction
ok 53 - executeStep rejects a baseline from another original step before any interaction
  ---
  duration_ms: 156.2284
  type: 'test'
  ...
# Subtest: executeStep rejects a missing baseline before dispatch of a declared relation assertion
ok 54 - executeStep rejects a missing baseline before dispatch of a declared relation assertion
  ---
  duration_ms: 133.4413
  type: 'test'
  ...
# Subtest: executionProjection preserves independent relational failure without counting it as a planned assertion or technical error
ok 55 - executionProjection preserves independent relational failure without counting it as a planned assertion or technical error
  ---
  duration_ms: 1.1457
  type: 'test'
  ...
1..55
# tests 55
# suites 0
# pass 55
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 21735.3985
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

版本22受限同一步表格关系来源，工程/注入验证，不是官方模型验收；页签隔离实现未合入
