# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-20T06:40:52+08:00`
- Record: `REQ-0017-controlled-react`
- Change fingerprint: `5893561ef57ad09abdeebfc246b7f45efd1c60883b703ddb5c5ceaa1fa5a47ac`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test tests/expectation-visibility.test.mjs tests/expectation-visibility.execution.test.mjs`
- Exit code: `0`
- Test count: `33`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/req0017/v27-delivery.log`
- Log SHA-256: `3ae3e42f8a836e65ce9b3daa0d6a5ff4268cfc75639f9ca32961c1a7f5d9ac15`

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
 M docs/requirements/REQ-0017-controlled-react/real-model-v26-result.md
 M docs/requirements/REQ-0017-controlled-react/requirement.source.json
 M src/adaptive-plan.mjs
 M src/adaptive-recovery.mjs
 M src/adaptive-review.mjs
 M src/plan-semantics.mjs
?? docs/requirements/REQ-0017-controlled-react/real-model-v27-result.md
?? src/expectation-visibility.mjs
?? tests/expectation-visibility.execution.test.mjs
?? tests/expectation-visibility.test.mjs
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
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/real-model-v26-result.md', LF will be replaced by CRLF the next time Git touches it
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
 .../REQ-0017-controlled-react/delivery_evidence.md | 282 ++++++++++++++++-----
 .../real-model-v26-result.md                       |   8 +-
 .../requirement.source.json                        |  27 +-
 src/adaptive-plan.mjs                              |   2 +
 src/adaptive-recovery.mjs                          |   2 +
 src/adaptive-review.mjs                            |   2 +
 src/plan-semantics.mjs                             |   8 +
 16 files changed, 272 insertions(+), 85 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0017-controlled-react/real-model-v27-result.md
src/expectation-visibility.mjs
tests/expectation-visibility.execution.test.mjs
tests/expectation-visibility.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-20T06:40:08+08:00
Command: node --test tests/expectation-visibility.test.mjs tests/expectation-visibility.execution.test.mjs
Exit code: 0
Parsed test count: 33
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: closing requires same-dialog result without replay: repair
ok 1 - closing requires same-dialog result without replay: repair
  ---
  duration_ms: 13705.3945
  type: 'test'
  ...
# Subtest: closing requires same-dialog result without replay: still-open
ok 2 - closing requires same-dialog result without replay: still-open
  ---
  duration_ms: 16415.5707
  type: 'test'
  ...
# Subtest: closing requires same-dialog result without replay: persistent-missing
ok 3 - closing requires same-dialog result without replay: persistent-missing
  ---
  duration_ms: 11840.5567
  type: 'test'
  ...
# Subtest: field value with same source is not visibility; correct scoped named visibility supplies only missing witness
ok 4 - field value with same source is not visibility; correct scoped named visibility supplies only missing witness
  ---
  duration_ms: 4.1597
  type: 'test'
  ...
# Subtest: visible source witness rejects other source
ok 5 - visible source witness rejects other source
  ---
  duration_ms: 0.1689
  type: 'test'
  ...
# Subtest: visible source witness rejects other dialog
ok 6 - visible source witness rejects other dialog
  ---
  duration_ms: 0.2108
  type: 'test'
  ...
# Subtest: visible source witness rejects field instead
ok 7 - visible source witness rejects field instead
  ---
  duration_ms: 0.1152
  type: 'test'
  ...
# Subtest: visible source witness rejects text is not visibility
ok 8 - visible source witness rejects text is not visibility
  ---
  duration_ms: 0.1406
  type: 'test'
  ...
# Subtest: visible source witness rejects count is not visibility
ok 9 - visible source witness rejects count is not visibility
  ---
  duration_ms: 0.0863
  type: 'test'
  ...
# Subtest: visible source witness rejects non-exact name
ok 10 - visible source witness rejects non-exact name
  ---
  duration_ms: 0.1256
  type: 'test'
  ...
# Subtest: does not reinterpret unsupported/conditional requirement: 如果可见旧记录即使含22 kW也不作为字段
ok 11 - does not reinterpret unsupported/conditional requirement: 如果可见旧记录即使含22 kW也不作为字段
  ---
  duration_ms: 0.0827
  type: 'test'
  ...
# Subtest: does not reinterpret unsupported/conditional requirement: 不可见旧记录
ok 12 - does not reinterpret unsupported/conditional requirement: 不可见旧记录
  ---
  duration_ms: 0.2414
  type: 'test'
  ...
# Subtest: does not reinterpret unsupported/conditional requirement: 无需可见旧记录
ok 13 - does not reinterpret unsupported/conditional requirement: 无需可见旧记录
  ---
  duration_ms: 0.2517
  type: 'test'
  ...
# Subtest: does not reinterpret unsupported/conditional requirement: 旧记录即使含22 kW也不作为字段
ok 14 - does not reinterpret unsupported/conditional requirement: 旧记录即使含22 kW也不作为字段
  ---
  duration_ms: 0.102
  type: 'test'
  ...
# Subtest: does not reinterpret unsupported/conditional requirement: 备注正文必须显示22 kW
ok 15 - does not reinterpret unsupported/conditional requirement: 备注正文必须显示22 kW
  ---
  duration_ms: 0.0422
  type: 'test'
  ...
# Subtest: does not reinterpret unsupported/conditional requirement: 可见旧记录即使含22 kW也不作为字段仅为示例
ok 16 - does not reinterpret unsupported/conditional requirement: 可见旧记录即使含22 kW也不作为字段仅为示例
  ---
  duration_ms: 0.0287
  type: 'test'
  ...
# Subtest: does not reinterpret unsupported/conditional requirement: 不要求可见旧记录即使有相同值
ok 17 - does not reinterpret unsupported/conditional requirement: 不要求可见旧记录即使有相同值
  ---
  duration_ms: 0.0278
  type: 'test'
  ...
# Subtest: does not reinterpret unsupported/conditional requirement: 可见旧记录即使相同或者允许不显示
ok 18 - does not reinterpret unsupported/conditional requirement: 可见旧记录即使相同或者允许不显示
  ---
  duration_ms: 0.0261
  type: 'test'
  ...
# Subtest: an exact text locator can witness named visibility with unchanged object scope
ok 19 - an exact text locator can witness named visibility with unchanged object scope
  ---
  duration_ms: 0.1869
  type: 'test'
  ...
# Subtest: same whole dialog hidden or exact absence witnesses closure, not acceptance of other obligations
ok 20 - same whole dialog hidden or exact absence witnesses closure, not acceptance of other obligations
  ---
  duration_ms: 1.4002
  type: 'test'
  ...
# Subtest: closure does not accept wrong dialog
ok 21 - closure does not accept wrong dialog
  ---
  duration_ms: 0.2375
  type: 'test'
  ...
# Subtest: closure does not accept button only
ok 22 - closure does not accept button only
  ---
  duration_ms: 0.0751
  type: 'test'
  ...
# Subtest: closure does not accept wrong source
ok 23 - closure does not accept wrong source
  ---
  duration_ms: 0.0603
  type: 'test'
  ...
# Subtest: closure does not accept visible
ok 24 - closure does not accept visible
  ---
  duration_ms: 0.0713
  type: 'test'
  ...
# Subtest: closure does not accept nonzero count
ok 25 - closure does not accept nonzero count
  ---
  duration_ms: 0.0687
  type: 'test'
  ...
# Subtest: does not reinterpret negative/conditional/other action 不点击关闭详情
ok 26 - does not reinterpret negative/conditional/other action 不点击关闭详情
  ---
  duration_ms: 0.0543
  type: 'test'
  ...
# Subtest: does not reinterpret negative/conditional/other action 如果出现则点击关闭详情
ok 27 - does not reinterpret negative/conditional/other action 如果出现则点击关闭详情
  ---
  duration_ms: 0.0287
  type: 'test'
  ...
# Subtest: does not reinterpret negative/conditional/other action 例如点击关闭详情
ok 28 - does not reinterpret negative/conditional/other action 例如点击关闭详情
  ---
  duration_ms: 0.0302
  type: 'test'
  ...
# Subtest: does not reinterpret negative/conditional/other action 点击取消
ok 29 - does not reinterpret negative/conditional/other action 点击取消
  ---
  duration_ms: 0.0345
  type: 'test'
  ...
# Subtest: guard is adaptive complete-only; original source and candidate remain immutable
ok 30 - guard is adaptive complete-only; original source and candidate remain immutable
  ---
  duration_ms: 1.7177
  type: 'test'
  ...
# Subtest: closed-state guard does not choose conditional/example/alternative: 如果详情关闭后恢复列表
ok 31 - closed-state guard does not choose conditional/example/alternative: 如果详情关闭后恢复列表
  ---
  duration_ms: 0.0791
  type: 'test'
  ...
# Subtest: closed-state guard does not choose conditional/example/alternative: 例如详情已关闭
ok 32 - closed-state guard does not choose conditional/example/alternative: 例如详情已关闭
  ---
  duration_ms: 0.0365
  type: 'test'
  ...
# Subtest: closed-state guard does not choose conditional/example/alternative: 详情已关闭或仍可见
ok 33 - closed-state guard does not choose conditional/example/alternative: 详情已关闭或仍可见
  ---
  duration_ms: 0.0788
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
# duration_ms 42415.4355
```

### Sync Record Status

```text
DRY-RUN: no derived changes for REQ-0017-controlled-react; explicit implementation states retained, never inferred from verification.
```

### Check AI Context

- Exit code: `1`

```text
FAIL ai-engineering-context checks

1. docs\requirements\REQ-0017-controlled-react\03_tasks.md
   Problem: Potentially unstable or undefined-behavior test is recorded as implemented/passing without a guardrail.
   Fix: Do not use released resources, closed handles, dangling pointers, races, or platform-dependent side effects as stable unit tests; mark it `人工待确认` / `仅静态检查`, or redesign with a controlled mock/fake.
2. docs\requirements\REQ-0017-controlled-react\current_state.md
   Problem: Potentially unstable or undefined-behavior test is recorded as implemented/passing without a guardrail.
   Fix: Do not use released resources, closed handles, dangling pointers, races, or platform-dependent side effects as stable unit tests; mark it `人工待确认` / `仅静态检查`, or redesign with a controlled mock/fake.
```

### Notes

33项重叠工程复检，不是官方模型验收，真实F1待复测
