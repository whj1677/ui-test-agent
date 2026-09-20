# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-20T09:25:39+08:00`
- Record: `REQ-0017-controlled-react`
- Change fingerprint: `6860e9a14d619573a31756cc6258df8717cf7cc0201ab081ae753bbfc234a1c7`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test --test-concurrency=2 tests/partial-assertion-review.test.mjs tests/partial-assertion-review.execution.test.mjs`
- Exit code: `0`
- Test count: `21`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/req0017/v34-delivery.log`
- Log SHA-256: `9cb2ca876736e6489e005068a347913be521a89a56b73b49d3187a8bb098ac0e`

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
 M docs/requirements/REQ-0017-controlled-react/real-model-v33-result.md
 M docs/requirements/REQ-0017-controlled-react/requirement.source.json
 M src/adaptive-review.mjs
?? docs/requirements/REQ-0017-controlled-react/kimi-v34-review.md
?? docs/requirements/REQ-0017-controlled-react/real-model-v34-result.md
?? src/partial-assertion-review.mjs
?? tests/partial-assertion-review.execution.test.mjs
?? tests/partial-assertion-review.test.mjs
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
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/real-model-v33-result.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-review.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md                    |   2 +
 docs/requirements/README.md                        |   2 +
 .../00_user_requirement.md                         |   4 +
 .../REQ-0017-controlled-react/02_design.md         |   2 +-
 .../REQ-0017-controlled-react/03_tasks.md          |   4 +-
 .../REQ-0017-controlled-react/04_verification.md   |   2 +-
 .../REQ-0017-controlled-react/05_trace.md          |   4 +-
 .../REQ-0017-controlled-react/change_log.md        |   1 +
 .../REQ-0017-controlled-react/current_state.md     |  10 +-
 .../REQ-0017-controlled-react/delivery_evidence.md | 223 +++++++++++++--------
 .../real-model-v33-result.md                       |  12 ++
 .../requirement.source.json                        |  33 ++-
 src/adaptive-review.mjs                            |  11 +-
 13 files changed, 201 insertions(+), 109 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0017-controlled-react/kimi-v34-review.md
docs/requirements/REQ-0017-controlled-react/real-model-v34-result.md
src/partial-assertion-review.mjs
tests/partial-assertion-review.execution.test.mjs
tests/partial-assertion-review.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-20T09:24:08+08:00
Command: node --test --test-concurrency=2 tests/partial-assertion-review.test.mjs tests/partial-assertion-review.execution.test.mjs
Exit code: 0
Parsed test count: 21
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: partial semantic review with actual Controller and browser: inverted
ok 1 - partial semantic review with actual Controller and browser: inverted
  ---
  duration_ms: 14500.8007
  type: 'test'
  ...
# Subtest: partial semantic review with actual Controller and browser: real-defect
ok 2 - partial semantic review with actual Controller and browser: real-defect
  ---
  duration_ms: 16718.1351
  type: 'test'
  ...
# Subtest: partial semantic review with actual Controller and browser: valid-part
ok 3 - partial semantic review with actual Controller and browser: valid-part
  ---
  duration_ms: 17784.1085
  type: 'test'
  ...
# Subtest: partial semantic review with actual Controller and browser: unresolved
ok 4 - partial semantic review with actual Controller and browser: unresolved
  ---
  duration_ms: 14107.3377
  type: 'test'
  ...
# Subtest: partial semantic review with actual Controller and browser: malformed
ok 5 - partial semantic review with actual Controller and browser: malformed
  ---
  duration_ms: 13925.2915
  type: 'test'
  ...
# Subtest: partial semantic review with actual Controller and browser: persistent
ok 6 - partial semantic review with actual Controller and browser: persistent
  ---
  duration_ms: 12074.4953
  type: 'test'
  ...
# Subtest: partial assertion semantic verdict remains separate from coverage: SUPPORTED
ok 7 - partial assertion semantic verdict remains separate from coverage: SUPPORTED
  ---
  duration_ms: 3.5618
  type: 'test'
  ...
# Subtest: partial assertion semantic verdict remains separate from coverage: CONTRADICTS
ok 8 - partial assertion semantic verdict remains separate from coverage: CONTRADICTS
  ---
  duration_ms: 0.6584
  type: 'test'
  ...
# Subtest: partial assertion semantic verdict remains separate from coverage: UNRESOLVED
ok 9 - partial assertion semantic verdict remains separate from coverage: UNRESOLVED
  ---
  duration_ms: 0.4431
  type: 'test'
  ...
# Subtest: missing or forged assertion verdict cannot authorize a partial candidate: {}
ok 10 - missing or forged assertion verdict cannot authorize a partial candidate: {}
  ---
  duration_ms: 0.4705
  type: 'test'
  ...
# Subtest: missing or forged assertion verdict cannot authorize a partial candidate: {"assertion_checks":[]}
ok 11 - missing or forged assertion verdict cannot authorize a partial candidate: {"assertion_checks":[]}
  ---
  duration_ms: 0.4109
  type: 'test'
  ...
# Subtest: missing or forged assertion verdict cannot authorize a partial candidate: {"assertion_checks":[{"assertion_ref":"A1","status":"SUPPORTED","reason":"按原断言逐项复核的测试判定"},{"assertion_ref":"A1","status":"SUPPORTED","reason":"按原断言逐项复核的测试判定"}]}
ok 12 - missing or forged assertion verdict cannot authorize a partial candidate: {"assertion_checks":[{"assertion_ref":"A1","status":"SUPPORTED","reason":"按原断言逐项复核的测试判定"},{"assertion_ref":"A1","status":"SUPPORTED","reason":"按原断言逐项复核的测试判定"}]}
  ---
  duration_ms: 0.1901
  type: 'test'
  ...
# Subtest: missing or forged assertion verdict cannot authorize a partial candidate: {"assertion_checks":[{"assertion_ref":"A9","status":"SUPPORTED","reason":"按原断言逐项复核的测试判定"}]}
ok 13 - missing or forged assertion verdict cannot authorize a partial candidate: {"assertion_checks":[{"assertion_ref":"A9","status":"SUPPORTED","reason":"按原断言逐项复核的测试判定"}]}
  ---
  duration_ms: 0.3242
  type: 'test'
  ...
# Subtest: missing or forged assertion verdict cannot authorize a partial candidate: {"assertion_checks":[{"assertion_ref":"A1","status":"ACCEPT","reason":"按原断言逐项复核的测试判定"}]}
ok 14 - missing or forged assertion verdict cannot authorize a partial candidate: {"assertion_checks":[{"assertion_ref":"A1","status":"ACCEPT","reason":"按原断言逐项复核的测试判定"}]}
  ---
  duration_ms: 0.5597
  type: 'test'
  ...
# Subtest: missing or forged assertion verdict cannot authorize a partial candidate: {"assertion_checks":[{"assertion_ref":"A1","status":"SUPPORTED","reason":""}]}
ok 15 - missing or forged assertion verdict cannot authorize a partial candidate: {"assertion_checks":[{"assertion_ref":"A1","status":"SUPPORTED","reason":""}]}
  ---
  duration_ms: 1.4457
  type: 'test'
  ...
# Subtest: missing or forged assertion verdict cannot authorize a partial candidate: {"assertion_checks":[{"assertion_ref":"A1","status":"SUPPORTED","reason":"按原断言逐项复核的测试判定"}],"complete":true}
ok 16 - missing or forged assertion verdict cannot authorize a partial candidate: {"assertion_checks":[{"assertion_ref":"A1","status":"SUPPORTED","reason":"按原断言逐项复核的测试判定"}],"complete":true}
  ---
  duration_ms: 0.8552
  type: 'test'
  ...
# Subtest: missing or forged assertion verdict cannot authorize a partial candidate: {"assertion_checks":[{"assertion_ref":"A1","status":"SUPPORTED","reason":"按原断言逐项复核的测试判定","expected":"替换原预期"}]}
ok 17 - missing or forged assertion verdict cannot authorize a partial candidate: {"assertion_checks":[{"assertion_ref":"A1","status":"SUPPORTED","reason":"按原断言逐项复核的测试判定","expected":"替换原预期"}]}
  ---
  duration_ms: 0.3503
  type: 'test'
  ...
# Subtest: complete, already-rejected, action-only and supported current assertions add no request
ok 18 - complete, already-rejected, action-only and supported current assertions add no request
  ---
  duration_ms: 0.4321
  type: 'test'
  ...
# Subtest: one covered source cannot hide a second unreviewed or negative binding
ok 19 - one covered source cannot hide a second unreviewed or negative binding
  ---
  duration_ms: 0.3203
  type: 'test'
  ...
# Subtest: executed prefix is not reviewed again and tail mismatch is rejected without asking
ok 20 - executed prefix is not reviewed again and tail mismatch is rejected without asking
  ---
  duration_ms: 0.3743
  type: 'test'
  ...
# Subtest: invalid JSON denies execution once; cancellation and provider failures propagate
ok 21 - invalid JSON denies execution once; cancellation and provider failures propagate
  ---
  duration_ms: 0.9437
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
# duration_ms 89643.6705
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

版本34当前部分断言语义许可与义务覆盖分离；真实Chromium注入工程，不计官方模型效果，原预算/权限不变。
