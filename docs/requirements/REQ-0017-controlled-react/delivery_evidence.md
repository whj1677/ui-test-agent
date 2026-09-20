# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-20T10:42:41+08:00`
- Record: `REQ-0017-controlled-react`
- Change fingerprint: `76d4721b9b316639986b583da7c397702b473caabadd8230ba8b54a3b4f9bf29`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test --test-concurrency=2 tests/unique-row-evidence.test.mjs tests/unique-row-evidence.execution.test.mjs tests/negative-row-review.test.mjs`
- Exit code: `0`
- Test count: `28`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/req0017/v37-delivery.log`
- Log SHA-256: `bae19b0fcae4858c29eebb486c2f54c1beba3ac3d9aa14eb7ed858253a26dbd2`

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
 M src/adaptive-capabilities.mjs
 M src/adaptive-plan.mjs
 M src/adaptive-recovery.mjs
 M src/adaptive-review.mjs
 M src/plan-semantics.mjs
 M src/table-cardinality.mjs
?? docs/requirements/REQ-0017-controlled-react/real-model-v37-result.md
?? src/unique-row-evidence.mjs
?? tests/unique-row-evidence.execution.test.mjs
?? tests/unique-row-evidence.test.mjs
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
warning: in the working copy of 'src/adaptive-capabilities.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-plan.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-recovery.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-review.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/plan-semantics.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/table-cardinality.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md                    |   2 +
 docs/requirements/README.md                        |   2 +-
 .../00_user_requirement.md                         |   2 +
 .../REQ-0017-controlled-react/02_design.md         |   2 +-
 .../REQ-0017-controlled-react/03_tasks.md          |   2 +-
 .../REQ-0017-controlled-react/04_verification.md   |   2 +-
 .../REQ-0017-controlled-react/05_trace.md          |   2 +-
 .../REQ-0017-controlled-react/change_log.md        |   1 +
 .../REQ-0017-controlled-react/current_state.md     |   8 +-
 .../REQ-0017-controlled-react/delivery_evidence.md | 257 +++++++++++----------
 .../requirement.source.json                        |  24 +-
 src/adaptive-capabilities.mjs                      |   4 +
 src/adaptive-plan.mjs                              |   2 +
 src/adaptive-recovery.mjs                          |   2 +
 src/adaptive-review.mjs                            |   2 +
 src/plan-semantics.mjs                             |   8 +
 src/table-cardinality.mjs                          |  31 +++
 17 files changed, 218 insertions(+), 135 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0017-controlled-react/real-model-v37-result.md
src/unique-row-evidence.mjs
tests/unique-row-evidence.execution.test.mjs
tests/unique-row-evidence.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-20T10:41:28+08:00
Command: node --test --test-concurrency=2 tests/unique-row-evidence.test.mjs tests/unique-row-evidence.execution.test.mjs tests/negative-row-review.test.mjs
Exit code: 0
Parsed test count: 28
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: program derived sampling groups distinguish joint evidence from separate times: false
ok 1 - program derived sampling groups distinguish joint evidence from separate times: false
  ---
  duration_ms: 2.9395
  type: 'test'
  ...
# Subtest: program derived sampling groups distinguish joint evidence from separate times: true
ok 2 - program derived sampling groups distinguish joint evidence from separate times: true
  ---
  duration_ms: 0.4018
  type: 'test'
  ...
# Subtest: same explicit negative capability reaches planner and reviewer without new predicate
ok 3 - same explicit negative capability reaches planner and reviewer without new predicate
  ---
  duration_ms: 0.2346
  type: 'test'
  ...
# Subtest: sole-record proof through actual Controller: joint
ok 4 - sole-record proof through actual Controller: joint
  ---
  duration_ms: 14310.3749
  type: 'test'
  ...
# Subtest: sole-record proof through actual Controller: extra
ok 5 - sole-record proof through actual Controller: extra
  ---
  duration_ms: 15576.389
  type: 'test'
  ...
# Subtest: sole-record proof through actual Controller: closed
ok 6 - sole-record proof through actual Controller: closed
  ---
  duration_ms: 13993.0265
  type: 'test'
  ...
# Subtest: sole-record proof through actual Controller: closed-extra
ok 7 - sole-record proof through actual Controller: closed-extra
  ---
  duration_ms: 15243.1373
  type: 'test'
  ...
# Subtest: sole-record proof through actual Controller: persistent
ok 8 - sole-record proof through actual Controller: persistent
  ---
  duration_ms: 12130.6774
  type: 'test'
  ...
# Subtest: literal sole record is a source quantity of one, not an observed default
ok 9 - literal sole record is a source quantity of one, not an observed default
  ---
  duration_ms: 3.4389
  type: 'test'
  ...
# Subtest: identity plus exclusion of another key cannot prove sole record
ok 10 - identity plus exclusion of another key cannot prove sole record
  ---
  duration_ms: 2.3166
  type: 'test'
  ...
# Subtest: sole record needs same-group same-table identity and total
ok 11 - sole record needs same-group same-table identity and total
  ---
  duration_ms: 7.2525
  type: 'test'
  ...
# Subtest: one closed matrix proves sole identity, open membership does not
ok 12 - one closed matrix proves sole identity, open membership does not
  ---
  duration_ms: 1.0626
  type: 'test'
  ...
# Subtest: unique source is shared by capabilities and count authorization
ok 13 - unique source is shared by capabilities and count authorization
  ---
  duration_ms: 1.0253
  type: 'test'
  ...
# Subtest: not an affirmative sole-table record source: 不要求唯一行是R009
ok 14 - not an affirmative sole-table record source: 不要求唯一行是R009
  ---
  duration_ms: 0.1222
  type: 'test'
  ...
# Subtest: not an affirmative sole-table record source: 如果唯一行是R009
ok 15 - not an affirmative sole-table record source: 如果唯一行是R009
  ---
  duration_ms: 0.1261
  type: 'test'
  ...
# Subtest: not an affirmative sole-table record source: 此前唯一行是R009
ok 16 - not an affirmative sole-table record source: 此前唯一行是R009
  ---
  duration_ms: 0.0818
  type: 'test'
  ...
# Subtest: not an affirmative sole-table record source: 例如唯一行是R009
ok 17 - not an affirmative sole-table record source: 例如唯一行是R009
  ---
  duration_ms: 0.2332
  type: 'test'
  ...
# Subtest: not an affirmative sole-table record source: 标题说明唯一行是R009
ok 18 - not an affirmative sole-table record source: 标题说明唯一行是R009
  ---
  duration_ms: 0.2691
  type: 'test'
  ...
# Subtest: not an affirmative sole-table record source: 唯一行是R009或R010
ok 19 - not an affirmative sole-table record source: 唯一行是R009或R010
  ---
  duration_ms: 0.1059
  type: 'test'
  ...
# Subtest: not an affirmative sole-table record source: 唯一行是R009的说法不成立
ok 20 - not an affirmative sole-table record source: 唯一行是R009的说法不成立
  ---
  duration_ms: 0.0528
  type: 'test'
  ...
# Subtest: not an affirmative sole-table record source: 编号唯一，记录R009可见
ok 21 - not an affirmative sole-table record source: 编号唯一，记录R009可见
  ---
  duration_ms: 0.0551
  type: 'test'
  ...
# Subtest: not an affirmative sole-table record source: 第一行是R009
ok 22 - not an affirmative sole-table record source: 第一行是R009
  ---
  duration_ms: 0.0397
  type: 'test'
  ...
# Subtest: not an affirmative sole-table record source: 前一行是R009
ok 23 - not an affirmative sole-table record source: 前一行是R009
  ---
  duration_ms: 0.0423
  type: 'test'
  ...
# Subtest: not an affirmative sole-table record source: 唯一行
ok 24 - not an affirmative sole-table record source: 唯一行
  ---
  duration_ms: 0.0338
  type: 'test'
  ...
# Subtest: not an affirmative sole-table record source: 点击唯一行按钮
ok 25 - not an affirmative sole-table record source: 点击唯一行按钮
  ---
  duration_ms: 0.0362
  type: 'test'
  ...
# Subtest: a rejected sole-row phrase cannot mask a separate explicit quantity
ok 26 - a rejected sole-row phrase cannot mask a separate explicit quantity
  ---
  duration_ms: 0.3468
  type: 'test'
  ...
# Subtest: different source, identity, key-only count, unbound text and count alone remain gaps
ok 27 - different source, identity, key-only count, unbound text and count alone remain gaps
  ---
  duration_ms: 0.2868
  type: 'test'
  ...
# Subtest: no new closed-population obligation for ordinary membership and no input mutation
ok 28 - no new closed-population obligation for ordinary membership and no input mutation
  ---
  duration_ms: 1.164
  type: 'test'
  ...
1..28
# tests 28
# suites 0
# pass 28
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 71776.0873
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

唯一记录同次数量与身份；385受影响工程无失败，交付集合重叠不累加，真实模型另验
