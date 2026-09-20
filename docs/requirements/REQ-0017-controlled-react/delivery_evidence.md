# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-20T10:20:59+08:00`
- Record: `REQ-0017-controlled-react`
- Change fingerprint: `72065947b955c0160ca2ae2c53c6623948a1d2ba999a6d7dee21f74a25d2f90e`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test --test-concurrency=2 tests/negative-row-scope.test.mjs tests/negative-row-review.test.mjs`
- Exit code: `0`
- Test count: `24`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/req0017/v36-delivery.log`
- Log SHA-256: `7885e595138e2eae97bb46f3e12b521f300c4430725808e927f903a2e99fa7a7`

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
 M docs/requirements/REQ-0017-controlled-react/real-model-v35-result.md
 M docs/requirements/REQ-0017-controlled-react/requirement.source.json
 M src/adaptive-plan.mjs
 M src/adaptive-review.mjs
 M src/browser.mjs
 M src/partial-assertion-review.mjs
 M tests/partial-assertion-review.execution.test.mjs
?? docs/requirements/REQ-0017-controlled-react/kimi-v36-review.md
?? docs/requirements/REQ-0017-controlled-react/real-model-v36-result.md
?? src/negative-row-scope.mjs
?? tests/negative-row-review.test.mjs
?? tests/negative-row-scope.test.mjs
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
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/real-model-v35-result.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-plan.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-review.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/browser.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/partial-assertion-review.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/partial-assertion-review.execution.test.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md                    |   2 +
 docs/requirements/README.md                        |   2 +
 .../00_user_requirement.md                         |   3 +
 .../REQ-0017-controlled-react/02_design.md         |   2 +-
 .../REQ-0017-controlled-react/03_tasks.md          |   2 +-
 .../REQ-0017-controlled-react/04_verification.md   |   2 +-
 .../REQ-0017-controlled-react/05_trace.md          |   2 +-
 .../REQ-0017-controlled-react/change_log.md        |   3 +-
 .../REQ-0017-controlled-react/current_state.md     |   8 +-
 .../REQ-0017-controlled-react/delivery_evidence.md | 314 +++++++++------------
 .../real-model-v35-result.md                       |  10 +
 .../requirement.source.json                        |  27 +-
 src/adaptive-plan.mjs                              |   2 +
 src/adaptive-review.mjs                            |  24 +-
 src/browser.mjs                                    |  44 ++-
 src/partial-assertion-review.mjs                   |   2 +-
 tests/partial-assertion-review.execution.test.mjs  |  30 +-
 17 files changed, 252 insertions(+), 227 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0017-controlled-react/kimi-v36-review.md
docs/requirements/REQ-0017-controlled-react/real-model-v36-result.md
src/negative-row-scope.mjs
tests/negative-row-review.test.mjs
tests/negative-row-scope.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-20T10:20:39+08:00
Command: node --test --test-concurrency=2 tests/negative-row-scope.test.mjs tests/negative-row-review.test.mjs
Exit code: 0
Parsed test count: 24
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: program derived sampling groups distinguish joint evidence from separate times: false
ok 1 - program derived sampling groups distinguish joint evidence from separate times: false
  ---
  duration_ms: 2.5724
  type: 'test'
  ...
# Subtest: program derived sampling groups distinguish joint evidence from separate times: true
ok 2 - program derived sampling groups distinguish joint evidence from separate times: true
  ---
  duration_ms: 0.3839
  type: 'test'
  ...
# Subtest: same explicit negative capability reaches planner and reviewer without new predicate
ok 3 - same explicit negative capability reaches planner and reviewer without new predicate
  ---
  duration_ms: 0.2333
  type: 'test'
  ...
# Subtest: negative key assertion requires healthy parent scope: missing
ok 4 - negative key assertion requires healthy parent scope: missing
  ---
  duration_ms: 777.2261
  type: 'test'
  ...
# Subtest: negative key assertion requires healthy parent scope: hidden
ok 5 - negative key assertion requires healthy parent scope: hidden
  ---
  duration_ms: 853.7971
  type: 'test'
  ...
# Subtest: negative key assertion requires healthy parent scope: absent
ok 6 - negative key assertion requires healthy parent scope: absent
  ---
  duration_ms: 801.2757
  type: 'test'
  ...
# Subtest: negative key assertion requires healthy parent scope: present
ok 7 - negative key assertion requires healthy parent scope: present
  ---
  duration_ms: 995.9641
  type: 'test'
  ...
# Subtest: invalid parent matrix never proves keyed absence: duplicate_table
ok 8 - invalid parent matrix never proves keyed absence: duplicate_table
  ---
  duration_ms: 812.3817
  type: 'test'
  ...
# Subtest: invalid parent matrix never proves keyed absence: duplicate_keys
ok 9 - invalid parent matrix never proves keyed absence: duplicate_keys
  ---
  duration_ms: 903.1914
  type: 'test'
  ...
# Subtest: invalid parent matrix never proves keyed absence: blank_key
ok 10 - invalid parent matrix never proves keyed absence: blank_key
  ---
  duration_ms: 779.9495
  type: 'test'
  ...
# Subtest: invalid parent matrix never proves keyed absence: missing_key_column
ok 11 - invalid parent matrix never proves keyed absence: missing_key_column
  ---
  duration_ms: 809.7603
  type: 'test'
  ...
# Subtest: invalid parent matrix never proves keyed absence: duplicate_column
ok 12 - invalid parent matrix never proves keyed absence: duplicate_column
  ---
  duration_ms: 831.8628
  type: 'test'
  ...
# Subtest: invalid parent matrix never proves keyed absence: hidden_row
ok 13 - invalid parent matrix never proves keyed absence: hidden_row
  ---
  duration_ms: 796.99
  type: 'test'
  ...
# Subtest: invalid parent matrix never proves keyed absence: hidden_cell
ok 14 - invalid parent matrix never proves keyed absence: hidden_cell
  ---
  duration_ms: 785.1026
  type: 'test'
  ...
# Subtest: invalid parent matrix never proves keyed absence: merged
ok 15 - invalid parent matrix never proves keyed absence: merged
  ---
  duration_ms: 784.1248
  type: 'test'
  ...
# Subtest: invalid parent matrix never proves keyed absence: virtual
ok 16 - invalid parent matrix never proves keyed absence: virtual
  ---
  duration_ms: 777.5861
  type: 'test'
  ...
# Subtest: invalid parent matrix never proves keyed absence: nested
ok 17 - invalid parent matrix never proves keyed absence: nested
  ---
  duration_ms: 760.2756
  type: 'test'
  ...
# Subtest: invalid parent matrix never proves keyed absence: sample_limit
ok 18 - invalid parent matrix never proves keyed absence: sample_limit
  ---
  duration_ms: 882.6663
  type: 'test'
  ...
# Subtest: invalid parent matrix never proves keyed absence: busy_table
ok 19 - invalid parent matrix never proves keyed absence: busy_table
  ---
  duration_ms: 793.32
  type: 'test'
  ...
# Subtest: invalid parent matrix never proves keyed absence: busy_parent
ok 20 - invalid parent matrix never proves keyed absence: busy_parent
  ---
  duration_ms: 849.8861
  type: 'test'
  ...
# Subtest: empty healthy table is absence; missing cell column is not
ok 21 - empty healthy table is absence; missing cell column is not
  ---
  duration_ms: 831.0449
  type: 'test'
  ...
# Subtest: negative target and positive fields share one sample without scope substitution
ok 22 - negative target and positive fields share one sample without scope substitution
  ---
  duration_ms: 859.3489
  type: 'test'
  ...
# Subtest: parent/key mutation after locator collection cannot give a stale absence pass: remove-parent
ok 23 - parent/key mutation after locator collection cannot give a stale absence pass: remove-parent
  ---
  duration_ms: 1006.2504
  type: 'test'
  ...
# Subtest: parent/key mutation after locator collection cannot give a stale absence pass: insert-key
ok 24 - parent/key mutation after locator collection cannot give a stale absence pass: insert-key
  ---
  duration_ms: 1509.1008
  type: 'test'
  ...
1..24
# tests 24
# suites 0
# pass 24
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 18689.5989
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

v36父表完整矩阵负向断言及拟采样分组24项交付复检；456项受影响工程已执行，不代替真实模型验收。
