# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-20T14:15:18+08:00`
- Record: `REQ-0017-controlled-react`
- Change fingerprint: `bbcb2e2b2ce8eb1cbc2716b7014640f2c72a559dccb69858ce44edc98e863bcc`
- Verification source: `collector-executed-v1`
- Verification state: `单元测试通过`
- Command: `node --test tests/expectation-contract.test.mjs`
- Exit code: `0`
- Test count: `10`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/req0017/v40-doc-finalization.log`
- Log SHA-256: `deb8edb5f359f03e1f7212cae12c595b3cfa9993899e77902d46cc88cf7651e0`

### Git Status

```text
 M docs/modules/release_runtime.md
 M docs/requirements/README.md
 M docs/requirements/REQ-0017-controlled-react/00_user_requirement.md
 M docs/requirements/REQ-0017-controlled-react/02_design.md
 M docs/requirements/REQ-0017-controlled-react/03_tasks.md
 M docs/requirements/REQ-0017-controlled-react/04_verification.md
 M docs/requirements/REQ-0017-controlled-react/current_state.md
 M docs/requirements/REQ-0017-controlled-react/delivery_evidence.md
 M docs/requirements/REQ-0017-controlled-react/requirement.source.json
 M src/adaptive-execution.mjs
 M src/browser.mjs
 M src/completion-evidence.mjs
 M src/controller.mjs
 M src/table-position.mjs
 M tests/adaptive-position-recovery.test.mjs
 M tests/range-position.execution.test.mjs
?? docs/requirements/REQ-0017-controlled-react/real-model-v40-result.md
?? src/expectation-contract.mjs
?? tests/expectation-contract.execution.test.mjs
?? tests/expectation-contract.test.mjs
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/modules/release_runtime.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/00_user_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/02_design.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/03_tasks.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/04_verification.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-execution.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/browser.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/completion-evidence.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/controller.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/table-position.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/adaptive-position-recovery.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/range-position.execution.test.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md                    |   8 ++
 docs/requirements/README.md                        |   2 +-
 .../00_user_requirement.md                         |   3 +
 .../REQ-0017-controlled-react/02_design.md         |   2 +-
 .../REQ-0017-controlled-react/03_tasks.md          |   2 +-
 .../REQ-0017-controlled-react/04_verification.md   |   2 +-
 .../REQ-0017-controlled-react/current_state.md     |   8 +-
 .../REQ-0017-controlled-react/delivery_evidence.md | 144 ++++++++++++++++-----
 .../requirement.source.json                        |  17 ++-
 src/adaptive-execution.mjs                         |  98 +++++++++++++-
 src/browser.mjs                                    |   2 +
 src/completion-evidence.mjs                        |   3 +
 src/controller.mjs                                 |  32 +++++
 src/table-position.mjs                             |   8 +-
 tests/adaptive-position-recovery.test.mjs          |  39 +++++-
 tests/range-position.execution.test.mjs            |  37 +++++-
 16 files changed, 350 insertions(+), 57 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0017-controlled-react/real-model-v40-result.md
src/expectation-contract.mjs
tests/expectation-contract.execution.test.mjs
tests/expectation-contract.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-20T14:15:17+08:00
Command: node --test tests/expectation-contract.test.mjs
Exit code: 0
Parsed test count: 10
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: independent expression uses reviewed relation, not added source regex: 位置2为R701
ok 1 - independent expression uses reviewed relation, not added source regex: 位置2为R701
  ---
  duration_ms: 5.4298
  type: 'test'
  ...
# Subtest: independent expression uses reviewed relation, not added source regex: R701必须占据表体的第二个数据位置
ok 2 - independent expression uses reviewed relation, not added source regex: R701必须占据表体的第二个数据位置
  ---
  duration_ms: 0.731
  type: 'test'
  ...
# Subtest: independent expression uses reviewed relation, not added source regex: R701 must occupy the second data row.
ok 3 - independent expression uses reviewed relation, not added source regex: R701 must occupy the second data row.
  ---
  duration_ms: 0.7226
  type: 'test'
  ...
# Subtest: original HOLD-S2 untouched positional obligation cannot downgrade to membership
ok 4 - original HOLD-S2 untouched positional obligation cannot downgrade to membership
  ---
  duration_ms: 5.8364
  type: 'test'
  ...
# Subtest: unknown source stays unknown even when candidate claims covered: UNINTERPRETED/SUPPORTED
ok 5 - unknown source stays unknown even when candidate claims covered: UNINTERPRETED/SUPPORTED
  ---
  duration_ms: 0.4323
  type: 'test'
  ...
# Subtest: unknown source stays unknown even when candidate claims covered: INTERPRETED/UNINTERPRETED
ok 6 - unknown source stays unknown even when candidate claims covered: INTERPRETED/UNINTERPRETED
  ---
  duration_ms: 0.2203
  type: 'test'
  ...
# Subtest: cannot install serialized authority; original/hash change and concurrent step isolated
ok 7 - cannot install serialized authority; original/hash change and concurrent step isolated
  ---
  duration_ms: 10.9031
  type: 'test'
  ...
# Subtest: missing, duplicate or invented obligation cannot become an empty covered contract
ok 8 - missing, duplicate or invented obligation cannot become an empty covered contract
  ---
  duration_ms: 0.4645
  type: 'test'
  ...
# Subtest: legacy English terminal-period identity limitation remains explicit, not relaxed
ok 9 - legacy English terminal-period identity limitation remains explicit, not relaxed
  ---
  duration_ms: 0.487
  type: 'test'
  ...
# Subtest: pre-action proof cannot discharge a post-action source obligation
ok 10 - pre-action proof cannot discharge a post-action source obligation
  ---
  duration_ms: 0.6592
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
# duration_ms 163.9269
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

10 overlapping final source golden/timing unit cases; 257 integration cases separately v40-delivery-final.log. Newly added result document captured; no runtime change since integration.
