# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-20T00:07:35+08:00`
- Record: `REQ-0017-controlled-react`
- Change fingerprint: `253b38ac7d7552ede359831e88a8daa13963a8c21a36d9cb92a8fd1b1fa15d72`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test tests/definition-fields.test.mjs`
- Exit code: `0`
- Test count: `5`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/req0017/v11-fields-final.log`
- Log SHA-256: `5dcbc5d49171c1f0884d034d4f1ed4ff210ba274c91d4821ae806eb1687fecb6`

### Git Status

```text
 M docs/modules/release_runtime.md
 M docs/requirements/REQ-0017-controlled-react/00_user_requirement.md
 M docs/requirements/REQ-0017-controlled-react/02_design.md
 M docs/requirements/REQ-0017-controlled-react/03_tasks.md
 M docs/requirements/REQ-0017-controlled-react/04_verification.md
 M docs/requirements/REQ-0017-controlled-react/05_trace.md
 M docs/requirements/REQ-0017-controlled-react/change_log.md
 M docs/requirements/REQ-0017-controlled-react/current_state.md
 M docs/requirements/REQ-0017-controlled-react/delivery_evidence.md
 M docs/requirements/REQ-0017-controlled-react/requirement.source.json
 M src/adaptive-plan.mjs
 M src/adaptive-review.mjs
 M src/browser.mjs
 M src/plans.mjs
 M src/row-locator.mjs
 M src/scope-guidance.mjs
 M src/within-locator.mjs
 M tests/definition-fields.test.mjs
?? src/definition-locator.mjs
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/modules/release_runtime.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/00_user_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/02_design.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/03_tasks.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/04_verification.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/05_trace.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/change_log.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-plan.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-review.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/browser.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/plans.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/row-locator.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/scope-guidance.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/within-locator.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/definition-fields.test.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md                    |   2 +
 .../00_user_requirement.md                         |   4 +
 .../REQ-0017-controlled-react/02_design.md         |   2 +-
 .../REQ-0017-controlled-react/03_tasks.md          |   2 +-
 .../REQ-0017-controlled-react/04_verification.md   |   8 +-
 .../REQ-0017-controlled-react/05_trace.md          |   8 +-
 .../REQ-0017-controlled-react/change_log.md        |   1 +
 .../REQ-0017-controlled-react/current_state.md     |  16 +-
 .../REQ-0017-controlled-react/delivery_evidence.md | 651 ++++-----------------
 .../requirement.source.json                        |  50 +-
 src/adaptive-plan.mjs                              |   4 +-
 src/adaptive-review.mjs                            |   4 +-
 src/browser.mjs                                    |   7 +
 src/plans.mjs                                      |  27 +-
 src/row-locator.mjs                                |   1 +
 src/scope-guidance.mjs                             |   1 +
 src/within-locator.mjs                             |   6 +-
 tests/definition-fields.test.mjs                   | 125 ++++
 18 files changed, 334 insertions(+), 585 deletions(-)
```

### Untracked Files

```text
src/definition-locator.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-20T00:07:27+08:00
Command: node --test tests/definition-fields.test.mjs
Exit code: 0
Parsed test count: 5
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: definition schema stays scoped and read-only
ok 1 - definition schema stays scoped and read-only
  ---
  duration_ms: 1.9276
  type: 'test'
  ...
# Subtest: unattributed wrapped definition fields bind labels not matching values or historical decoys
ok 2 - unattributed wrapped definition fields bind labels not matching values or historical decoys
  ---
  duration_ms: 976.4383
  type: 'test'
  ...
# Subtest: ambiguous, hidden duplicate, multi-definition and nested-object fields never pick first value
ok 3 - ambiguous, hidden duplicate, multi-definition and nested-object fields never pick first value
  ---
  duration_ms: 841.9772
  type: 'test'
  ...
# Subtest: unchanged manual lab exposes D009 native fields without adding ids or attributes
ok 4 - unchanged manual lab exposes D009 native fields without adding ids or attributes
  ---
  duration_ms: 3143.0798
  type: 'test'
  ...
# Subtest: definition values have independent scoped targets instead of whole-dialog text
ok 5 - definition values have independent scoped targets instead of whole-dialog text
  ---
  duration_ms: 1037.9607
  type: 'test'
  ...
1..5
# tests 5
# suites 0
# pass 5
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 6436.9783
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

字段专项5项；之前受影响199项记录于VT事实源，非真实产品验收。设计验证追踪已同步。
