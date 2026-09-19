# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-20T05:31:49+08:00`
- Record: `REQ-0017-controlled-react`
- Change fingerprint: `9f35eb85ef6131f58b9e841cb3bd06314a40654a3e9ce2027c94ab50b0f12955`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test --test-concurrency=2 tests/aria-selected.test.mjs tests/aria-selected.execution.test.mjs`
- Exit code: `0`
- Test count: `10`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/req0017/v23-delivery.log`
- Log SHA-256: `0a61cd90c8400798a8cead87d3d629d17869390e84fb3324e288579985ed7833`

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
 M docs/requirements/REQ-0017-controlled-react/requirement.source.json
 M src/adaptive-execution.mjs
 M src/adaptive-plan.mjs
 M src/adaptive-recovery.mjs
 M src/adaptive-review.mjs
 M src/browser.mjs
 M src/plans.mjs
 M src/scope-guidance.mjs
?? docs/requirements/REQ-0017-controlled-react/real-model-v23-result.md
?? tests/aria-selected.execution.test.mjs
?? tests/aria-selected.test.mjs
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
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-execution.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-plan.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-recovery.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-review.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/browser.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/plans.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/scope-guidance.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md                    |   4 +
 .../00_user_requirement.md                         |   2 +
 .../REQ-0017-controlled-react/02_design.md         |   2 +-
 .../REQ-0017-controlled-react/03_tasks.md          |   2 +-
 .../REQ-0017-controlled-react/04_verification.md   |   2 +-
 .../REQ-0017-controlled-react/05_trace.md          |   4 +-
 .../REQ-0017-controlled-react/current_state.md     |   8 +-
 .../REQ-0017-controlled-react/delivery_evidence.md | 420 ++++-----------------
 .../requirement.source.json                        |  18 +-
 src/adaptive-execution.mjs                         |  22 ++
 src/adaptive-plan.mjs                              |   9 +-
 src/adaptive-recovery.mjs                          |   2 +
 src/adaptive-review.mjs                            |   7 +-
 src/browser.mjs                                    |  15 +
 src/plans.mjs                                      |  11 +-
 src/scope-guidance.mjs                             |   1 +
 16 files changed, 167 insertions(+), 362 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0017-controlled-react/real-model-v23-result.md
tests/aria-selected.execution.test.mjs
tests/aria-selected.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-20T05:31:02+08:00
Command: node --test --test-concurrency=2 tests/aria-selected.test.mjs tests/aria-selected.execution.test.mjs
Exit code: 0
Parsed test count: 10
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: default tab typed recovery without replay: repair
ok 1 - default tab typed recovery without replay: repair
  ---
  duration_ms: 13922.0934
  type: 'test'
  ...
# Subtest: default tab typed recovery without replay: difference
ok 2 - default tab typed recovery without replay: difference
  ---
  duration_ms: 19355.5332
  type: 'test'
  ...
# Subtest: default tab typed recovery without replay: repeat
ok 3 - default tab typed recovery without replay: repeat
  ---
  duration_ms: 12241.3735
  type: 'test'
  ...
# Subtest: explicit ARIA selection is boolean, not selected text or checkbox state
ok 4 - explicit ARIA selection is boolean, not selected text or checkbox state
  ---
  duration_ms: 1.9881
  type: 'test'
  ...
# Subtest: current tab selected_label misuse is rejected before dispatch with specific feedback
ok 5 - current tab selected_label misuse is rejected before dispatch with specific feedback
  ---
  duration_ms: 805.5005
  type: 'test'
  ...
# Subtest: actual ARIA tab selection true is measured and observed
ok 6 - actual ARIA tab selection true is measured and observed
  ---
  duration_ms: 850.349
  type: 'test'
  ...
# Subtest: actual ARIA tab selection false is measured and observed
ok 7 - actual ARIA tab selection false is measured and observed
  ---
  duration_ms: 1699.1991
  type: 'test'
  ...
# Subtest: unsupported selection target is technical, never false by default: <button role="tab">基本信息</button>
ok 8 - unsupported selection target is technical, never false by default: <button role="tab">基本信息</button>
  ---
  duration_ms: 825.6223
  type: 'test'
  ...
# Subtest: unsupported selection target is technical, never false by default: <button role="tab" aria-selected="mixed">基本信息</button>
ok 9 - unsupported selection target is technical, never false by default: <button role="tab" aria-selected="mixed">基本信息</button>
  ---
  duration_ms: 859.3781
  type: 'test'
  ...
# Subtest: unsupported selection target is technical, never false by default: <button aria-selected="true">基本信息</button>
ok 10 - unsupported selection target is technical, never false by default: <button aria-selected="true">基本信息</button>
  ---
  duration_ms: 724.3924
  type: 'test'
  ...
1..10
# tests 10
# suites 0
# pass 10
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 46091.1139
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

v23主工程213项无失败；交付10项为重叠子集，官方模型未复验
