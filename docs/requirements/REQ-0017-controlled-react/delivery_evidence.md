# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-20T06:54:57+08:00`
- Record: `REQ-0017-controlled-react`
- Change fingerprint: `90eb3a1478cbd77ab06e253aee2b200f085e29c564c03b37b8575c6c04b59398`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test tests/selection-timing.test.mjs tests/selection-timing.execution.test.mjs`
- Exit code: `0`
- Test count: `22`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/req0017/v28-delivery.log`
- Log SHA-256: `38b8662a7297e647e1fe5bbe2120dc4dd911377d2f32ddccd6a2dd1441dc0ede`

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
 M docs/requirements/REQ-0017-controlled-react/real-model-v27-result.md
 M docs/requirements/REQ-0017-controlled-react/requirement.source.json
 M src/adaptive-plan.mjs
 M src/adaptive-recovery.mjs
 M src/adaptive-review.mjs
 M src/plan-semantics.mjs
?? docs/requirements/REQ-0017-controlled-react/real-model-v28-result.md
?? src/selection-timing.mjs
?? tests/selection-timing.execution.test.mjs
?? tests/selection-timing.test.mjs
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
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/real-model-v27-result.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-plan.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-recovery.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-review.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/plan-semantics.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md                    |   2 +
 docs/requirements/README.md                        |   2 +-
 .../00_user_requirement.md                         |   3 +
 .../REQ-0017-controlled-react/02_design.md         |   2 +-
 .../REQ-0017-controlled-react/03_tasks.md          |   2 +-
 .../REQ-0017-controlled-react/04_verification.md   |   2 +-
 .../REQ-0017-controlled-react/05_trace.md          |   4 +-
 .../REQ-0017-controlled-react/change_log.md        |   1 +
 .../REQ-0017-controlled-react/current_state.md     |   8 +-
 .../REQ-0017-controlled-react/delivery_evidence.md | 292 ++++++++-------------
 .../real-model-v27-result.md                       |   8 +-
 .../requirement.source.json                        |  27 +-
 src/adaptive-plan.mjs                              |   2 +
 src/adaptive-recovery.mjs                          |   2 +
 src/adaptive-review.mjs                            |   2 +
 src/plan-semantics.mjs                             |  10 +
 16 files changed, 166 insertions(+), 203 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0017-controlled-react/real-model-v28-result.md
src/selection-timing.mjs
tests/selection-timing.execution.test.mjs
tests/selection-timing.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-20T06:54:27+08:00
Command: node --test tests/selection-timing.test.mjs tests/selection-timing.execution.test.mjs
Exit code: 0
Parsed test count: 22
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: tab postcondition timing without business retry: repair
ok 1 - tab postcondition timing without business retry: repair
  ---
  duration_ms: 9978.1001
  type: 'test'
  ...
# Subtest: tab postcondition timing without business retry: difference-after-click
ok 2 - tab postcondition timing without business retry: difference-after-click
  ---
  duration_ms: 11756.4848
  type: 'test'
  ...
# Subtest: tab postcondition timing without business retry: persistent-premature
ok 3 - tab postcondition timing without business retry: persistent-premature
  ---
  duration_ms: 6433.1679
  type: 'test'
  ...
# Subtest: post-switch assertion cannot precede original action even in a partial candidate
ok 4 - post-switch assertion cannot precede original action even in a partial candidate
  ---
  duration_ms: 3.49
  type: 'test'
  ...
# Subtest: same-point and earlier-point exact original target click precedes assertion
ok 5 - same-point and earlier-point exact original target click precedes assertion
  ---
  duration_ms: 0.674
  type: 'test'
  ...
# Subtest: future click cannot backfill earlier assertion
ok 6 - future click cannot backfill earlier assertion
  ---
  duration_ms: 0.1503
  type: 'test'
  ...
# Subtest: other dialog cannot discharge pending switch
ok 7 - other dialog cannot discharge pending switch
  ---
  duration_ms: 0.19
  type: 'test'
  ...
# Subtest: other tab cannot discharge pending switch
ok 8 - other tab cannot discharge pending switch
  ---
  duration_ms: 0.2122
  type: 'test'
  ...
# Subtest: hover is not switch cannot discharge pending switch
ok 9 - hover is not switch cannot discharge pending switch
  ---
  duration_ms: 0.1361
  type: 'test'
  ...
# Subtest: no inferred switch: 不点击基本信息页签
ok 10 - no inferred switch: 不点击基本信息页签
  ---
  duration_ms: 0.1547
  type: 'test'
  ...
# Subtest: no inferred switch: 如果出现则点击基本信息页签
ok 11 - no inferred switch: 如果出现则点击基本信息页签
  ---
  duration_ms: 0.0584
  type: 'test'
  ...
# Subtest: no inferred switch: 例如切回基本信息页签
ok 12 - no inferred switch: 例如切回基本信息页签
  ---
  duration_ms: 0.2477
  type: 'test'
  ...
# Subtest: no inferred switch: 点击详情并核对基本信息页签
ok 13 - no inferred switch: 点击详情并核对基本信息页签
  ---
  duration_ms: 0.257
  type: 'test'
  ...
# Subtest: no inferred switch: 查看基本信息页签
ok 14 - no inferred switch: 查看基本信息页签
  ---
  duration_ms: 0.1063
  type: 'test'
  ...
# Subtest: preserve original pre-state measurement: 默认页签为基本信息
ok 15 - preserve original pre-state measurement: 默认页签为基本信息
  ---
  duration_ms: 0.0875
  type: 'test'
  ...
# Subtest: preserve original pre-state measurement: 初始基本信息页签选中
ok 16 - preserve original pre-state measurement: 初始基本信息页签选中
  ---
  duration_ms: 0.0351
  type: 'test'
  ...
# Subtest: preserve original pre-state measurement: 切换前基本信息已选中
ok 17 - preserve original pre-state measurement: 切换前基本信息已选中
  ---
  duration_ms: 0.0791
  type: 'test'
  ...
# Subtest: literal positive switch: 点击“基本信息”页签
ok 18 - literal positive switch: 点击“基本信息”页签
  ---
  duration_ms: 0.1023
  type: 'test'
  ...
# Subtest: literal positive switch: 切换到基本信息标签页
ok 19 - literal positive switch: 切换到基本信息标签页
  ---
  duration_ms: 0.0482
  type: 'test'
  ...
# Subtest: literal positive switch: 切换至基本信息页签
ok 20 - literal positive switch: 切换至基本信息页签
  ---
  duration_ms: 0.038
  type: 'test'
  ...
# Subtest: literal positive switch: 选择基本信息页签
ok 21 - literal positive switch: 选择基本信息页签
  ---
  duration_ms: 0.037
  type: 'test'
  ...
# Subtest: previous original-step click does not carry into new step; original and candidate are not edited
ok 22 - previous original-step click does not carry into new step; original and candidate are not edited
  ---
  duration_ms: 0.2761
  type: 'test'
  ...
1..22
# tests 22
# suites 0
# pass 22
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 28651.8419
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

22项重叠工程复检，不计官方模型验收；默认及后态差异不改，真实F1待复验
