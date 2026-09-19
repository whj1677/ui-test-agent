# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-20T03:24:12+08:00`
- Record: `REQ-0017-controlled-react`
- Change fingerprint: `e5d5b459352a35ede4e6926f39594393ec7b514eb30feadbb26f36e9df49f66f`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test --test-concurrency=2 tests/adaptive-position-reset.test.mjs tests/adaptive-position-recovery.test.mjs tests/autonomous-lab.test.mjs`
- Exit code: `0`
- Test count: `21`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/req0017/v17-delivery-final.log`
- Log SHA-256: `3be07635ddbd5adec82789691f23f11b173f23c82650bd50d7ffe21c0b41cf54`

### Git Status

```text
 M .gitattributes
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
 M docs/requirements/REQ-0017-controlled-react/real-model-v16-result.md
 M docs/requirements/REQ-0017-controlled-react/requirement.source.json
 M scripts/autonomous-lab.mjs
 M src/adaptive-execution.mjs
 M src/adaptive-plan.mjs
 M src/adaptive-recovery.mjs
 M src/adaptive-review.mjs
 M src/browser.mjs
 M src/plan-semantics.mjs
 M src/query-forms.mjs
 M src/table-assertion.mjs
 M tests/autonomous-lab.test.mjs
?? docs/requirements/REQ-0017-controlled-react/diagnostic-v16-matrix.md
?? docs/requirements/REQ-0017-controlled-react/kimi-v16-review.md
?? docs/requirements/REQ-0017-controlled-react/real-model-v17-result.md
?? src/adaptive-query-reset.mjs
?? src/table-position.mjs
?? tests/adaptive-position-recovery.test.mjs
?? tests/adaptive-position-reset.test.mjs
```

### Git Diff Stat

```text
warning: in the working copy of '.gitattributes', LF will be replaced by CRLF the next time Git touches it
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
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/real-model-v16-result.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'scripts/autonomous-lab.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-execution.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-plan.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-recovery.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-review.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/browser.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/plan-semantics.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/query-forms.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/table-assertion.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/autonomous-lab.test.mjs', LF will be replaced by CRLF the next time Git touches it
 .gitattributes                                     |  12 ++
 docs/modules/release_runtime.md                    |   8 +
 docs/requirements/README.md                        |   2 +-
 .../00_user_requirement.md                         |   7 +
 .../REQ-0017-controlled-react/02_design.md         |   2 +-
 .../REQ-0017-controlled-react/03_tasks.md          |   2 +-
 .../REQ-0017-controlled-react/04_verification.md   |   2 +-
 .../REQ-0017-controlled-react/05_trace.md          |   4 +-
 .../REQ-0017-controlled-react/change_log.md        |   1 +
 .../REQ-0017-controlled-react/current_state.md     |   8 +-
 .../REQ-0017-controlled-react/delivery_evidence.md | 228 +++++++++++++++------
 .../real-model-v16-result.md                       |  19 +-
 .../requirement.source.json                        |  39 +++-
 scripts/autonomous-lab.mjs                         |  33 ++-
 src/adaptive-execution.mjs                         |  36 ++--
 src/adaptive-plan.mjs                              |   4 +-
 src/adaptive-recovery.mjs                          |   6 +
 src/adaptive-review.mjs                            |   3 +-
 src/browser.mjs                                    |   2 +-
 src/plan-semantics.mjs                             |  22 ++
 src/query-forms.mjs                                |   7 +-
 src/table-assertion.mjs                            |  28 ++-
 tests/autonomous-lab.test.mjs                      |  15 ++
 23 files changed, 386 insertions(+), 104 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0017-controlled-react/diagnostic-v16-matrix.md
docs/requirements/REQ-0017-controlled-react/kimi-v16-review.md
docs/requirements/REQ-0017-controlled-react/real-model-v17-result.md
src/adaptive-query-reset.mjs
src/table-position.mjs
tests/adaptive-position-recovery.test.mjs
tests/adaptive-position-reset.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-20T03:23:38+08:00
Command: node --test --test-concurrency=2 tests/adaptive-position-reset.test.mjs tests/adaptive-position-recovery.test.mjs tests/autonomous-lab.test.mjs
Exit code: 0
Parsed test count: 21
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: position proof repair without navigation or replay: membership
ok 1 - position proof repair without navigation or replay: membership
  ---
  duration_ms: 8496.3064
  type: 'test'
  ...
# Subtest: position proof repair without navigation or replay: ungrounded
ok 2 - position proof repair without navigation or replay: ungrounded
  ---
  duration_ms: 8259.0213
  type: 'test'
  ...
# Subtest: position proof repair without navigation or replay: difference
ok 3 - position proof repair without navigation or replay: difference
  ---
  duration_ms: 9009.5325
  type: 'test'
  ...
# Subtest: position proof repair without navigation or replay: repeat
ok 4 - position proof repair without navigation or replay: repeat
  ---
  duration_ms: 6632.8327
  type: 'test'
  ...
# Subtest: position grammar binds original identity and ordinal, not incidental numeric values
ok 5 - position grammar binds original identity and ordinal, not incidental numeric values
  ---
  duration_ms: 3.8462
  type: 'test'
  ...
# Subtest: absolute position allows trailing rows but fails shifted prefixes and swapped rows
ok 6 - absolute position allows trailing rows but fails shifted prefixes and swapped rows
  ---
  duration_ms: 1.3977
  type: 'test'
  ...
# Subtest: malformed positions and duplicate identities cannot pass
ok 7 - malformed positions and duplicate identities cannot pass
  ---
  duration_ms: 1.0387
  type: 'test'
  ...
# Subtest: complete adaptive proof cannot substitute membership or relative order for position
ok 8 - complete adaptive proof cannot substitute membership or relative order for position
  ---
  duration_ms: 2.1083
  type: 'test'
  ...
# Subtest: browser measures absolute positions from the same table sample, not source-selected nth
ok 9 - browser measures absolute positions from the same table sample, not source-selected nth
  ---
  duration_ms: 946.2611
  type: 'test'
  ...
# Subtest: short reset action is grounded in this original step, not blanket reset permission
ok 10 - short reset action is grounded in this original step, not blanket reset permission
  ---
  duration_ms: 5.0106
  type: 'test'
  ...
# Subtest: real dispatch query reset checks original and current form: button
ok 11 - real dispatch query reset checks original and current form: button
  ---
  duration_ms: 847.7685
  type: 'test'
  ...
# Subtest: real dispatch query reset checks original and current form: native
ok 12 - real dispatch query reset checks original and current form: native
  ---
  duration_ms: 872.303
  type: 'test'
  ...
# Subtest: real dispatch query reset checks original and current form: outside-form
ok 13 - real dispatch query reset checks original and current form: outside-form
  ---
  duration_ms: 766.3539
  type: 'test'
  ...
# Subtest: real dispatch query reset checks original and current form: post
ok 14 - real dispatch query reset checks original and current form: post
  ---
  duration_ms: 854.4957
  type: 'test'
  ...
# Subtest: real dispatch query reset checks original and current form: business
ok 15 - real dispatch query reset checks original and current form: business
  ---
  duration_ms: 733.5259
  type: 'test'
  ...
# Subtest: real dispatch query reset checks original and current form: late-post
ok 16 - real dispatch query reset checks original and current form: late-post
  ---
  duration_ms: 847.6475
  type: 'test'
  ...
# Subtest: real dispatch query reset checks original and current form: late-name
ok 17 - real dispatch query reset checks original and current form: late-name
  ---
  duration_ms: 810.9025
  type: 'test'
  ...
# Subtest: real dispatch query reset checks original and current form: native-input
ok 18 - real dispatch query reset checks original and current form: native-input
  ---
  duration_ms: 920.556
  type: 'test'
  ...
# Subtest: shared round call/time budget never resets between jobs and counts failed requests
ok 19 - shared round call/time budget never resets between jobs and counts failed requests
  ---
  duration_ms: 2.1253
  type: 'test'
  ...
# Subtest: autonomous preflight checks the frozen 32 cases without creating sessions or calling a model
ok 20 - autonomous preflight checks the frozen 32 cases without creating sessions or calling a model
  ---
  duration_ms: 16.0606
  type: 'test'
  ...
# Subtest: bounded selection retains original suite order and rejects missing/duplicate IDs
ok 21 - bounded selection retains original suite order and rejects missing/duplicate IDs
  ---
  duration_ms: 53.5652
  type: 'test'
  ...
1..21
# tests 21
# suites 0
# pass 21
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 32894.6611
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

补齐v17模块/追踪视图后复检；最终受影响488项另有实际日志。本采集器21项工程子集，不相加，不代表真实DeepSeek验收；原输入和历史失败保持。
