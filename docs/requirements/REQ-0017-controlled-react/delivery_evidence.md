# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-19T23:36:21+08:00`
- Record: `REQ-0017-controlled-react`
- Change fingerprint: `311a7eda0d184068a771a930088267c15a1c415cd7885d104c168eda972f0059`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test tests/definition-fields.test.mjs tests/preparation.test.mjs`
- Exit code: `0`
- Test count: `15`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/v10-split-repair.log`
- Log SHA-256: `037247325c972fae0ac4d5744556c0267c5bd1282f01678d500f11dc39b01bc4`

### Git Status

```text
 M docs/modules/release_runtime.md
 M docs/requirements/REQ-0017-controlled-react/00_user_requirement.md
 M docs/requirements/REQ-0017-controlled-react/01_development_requirement.md
 M docs/requirements/REQ-0017-controlled-react/02_design.md
 M docs/requirements/REQ-0017-controlled-react/03_tasks.md
 M docs/requirements/REQ-0017-controlled-react/04_verification.md
 M docs/requirements/REQ-0017-controlled-react/05_trace.md
 M docs/requirements/REQ-0017-controlled-react/change_log.md
 M docs/requirements/REQ-0017-controlled-react/current_state.md
 M docs/requirements/REQ-0017-controlled-react/delivery_evidence.md
 M docs/requirements/REQ-0017-controlled-react/real-model-v7-result.md
 M docs/requirements/REQ-0017-controlled-react/real-model-v8-result.md
 M docs/requirements/REQ-0017-controlled-react/real-model-v9-result.md
 M docs/requirements/REQ-0017-controlled-react/requirement.source.json
 M src/browser.mjs
 M src/controller.mjs
 M src/preparation.mjs
 M tests/preparation.test.mjs
?? docs/requirements/REQ-0017-controlled-react/v10-repair-notes.md
?? tests/definition-fields.test.mjs
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/modules/release_runtime.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/00_user_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/01_development_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/02_design.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/03_tasks.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/04_verification.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/05_trace.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/change_log.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/real-model-v7-result.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/real-model-v8-result.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/real-model-v9-result.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/browser.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/controller.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/preparation.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/preparation.test.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md                    |   6 +
 .../00_user_requirement.md                         |   3 +
 .../REQ-0017-controlled-react/03_tasks.md          |   6 +-
 .../REQ-0017-controlled-react/04_verification.md   |   8 +-
 .../REQ-0017-controlled-react/change_log.md        |   1 +
 .../REQ-0017-controlled-react/current_state.md     |  17 +-
 .../REQ-0017-controlled-react/delivery_evidence.md | 181 ++++++++++++++++++---
 .../requirement.source.json                        |  42 +++--
 src/browser.mjs                                    |  29 +++-
 src/controller.mjs                                 |   1 +
 src/preparation.mjs                                |  15 ++
 tests/preparation.test.mjs                         |  31 ++++
 12 files changed, 281 insertions(+), 59 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0017-controlled-react/v10-repair-notes.md
tests/definition-fields.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-19T23:36:07+08:00
Command: node --test tests/definition-fields.test.mjs tests/preparation.test.mjs
Exit code: 0
Parsed test count: 15
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: definition values have independent scoped targets instead of whole-dialog text
ok 1 - definition values have independent scoped targets instead of whole-dialog text
  ---
  duration_ms: 1036.3781
  type: 'test'
  ...
# Subtest: a case-local malformed model reply is retained and does not cancel later cases
ok 2 - a case-local malformed model reply is retained and does not cancel later cases
  ---
  duration_ms: 283.6909
  type: 'test'
  ...
# Subtest: waiting root leaves login stage before any child discovery starts
ok 3 - waiting root leaves login stage before any child discovery starts
  ---
  duration_ms: 205.1816
  type: 'test'
  ...
# Subtest: targeted recovery distinguishes fixed values/states and retains the last permitted action evidence
ok 4 - targeted recovery distinguishes fixed values/states and retains the last permitted action evidence
  ---
  duration_ms: 243.7339
  type: 'test'
  ...
# Subtest: case budgets grow with steps/obligations and preserve a bounded wall protection
ok 5 - case budgets grow with steps/obligations and preserve a bounded wall protection
  ---
  duration_ms: 0.7517
  type: 'test'
  ...
# Subtest: first Case timeout preserves partial evidence and does not prevent the remaining 7+1 batch selection
ok 6 - first Case timeout preserves partial evidence and does not prevent the remaining 7+1 batch selection
  ---
  duration_ms: 4082.193
  type: 'test'
  ...
# Subtest: discovery and planning each receive their own time window, not a shared cumulative deadline
ok 7 - discovery and planning each receive their own time window, not a shared cumulative deadline
  ---
  duration_ms: 4641.6506
  type: 'test'
  ...
# Subtest: plan timeout retains captured pages and next invocation reuses them without resetting usage
ok 8 - plan timeout retains captured pages and next invocation reuses them without resetting usage
  ---
  duration_ms: 737.2246
  type: 'test'
  ...
# Subtest: two workers overlap but have isolated contexts, request attribution and unapproved plans
ok 9 - two workers overlap but have isolated contexts, request attribution and unapproved plans
  ---
  duration_ms: 670.3718
  type: 'test'
  ...
# Subtest: serial is default and parallel requires an explicit independent-read-only declaration
ok 10 - serial is default and parallel requires an explicit independent-read-only declaration
  ---
  duration_ms: 260.7489
  type: 'test'
  ...
# Subtest: global timeout retains queued Cases and user cancellation is not a technical failure
ok 11 - global timeout retains queued Cases and user cancellation is not a technical failure
  ---
  duration_ms: 387.7598
  type: 'test'
  ...
# Subtest: context change invalidates the discovery checkpoint instead of recycling another session
ok 12 - context change invalidates the discovery checkpoint instead of recycling another session
  ---
  duration_ms: 215.168
  type: 'test'
  ...
# Subtest: input advice is a draft: reject keeps Case; accept requires matching version and keeps original history
ok 13 - input advice is a draft: reject keeps Case; accept requires matching version and keeps original history
  ---
  duration_ms: 180.6207
  type: 'test'
  ...
# Subtest: only original input issues can yield revision suggestions; capability/time failure cannot manufacture an oracle change
ok 14 - only original input issues can yield revision suggestions; capability/time failure cannot manufacture an oracle change
  ---
  duration_ms: 0.4884
  type: 'test'
  ...
# Subtest: model permit queue is bounded and cancellation does not strand the next waiter
ok 15 - model permit queue is bounded and cancellation does not strand the next waiter
  ---
  duration_ms: 0.3372
  type: 'test'
  ...
1..15
# tests 15
# suites 0
# pass 15
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 12441.3569
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

隔离交付只含REQ-0017首批代码与测试，原完整运行时1212项另见原目录日志；不是业务验收。
