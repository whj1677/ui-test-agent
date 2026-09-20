# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-20T14:28:48+08:00`
- Record: `REQ-0017-controlled-react`
- Change fingerprint: `69706a6ba01c3127c54f93fe51427cc1c2f2f1090f77e4313f474840af59beb1`
- Verification source: `collector-executed-v1`
- Verification state: `单元测试通过`
- Command: `node --test tests/expectation-contract.test.mjs`
- Exit code: `0`
- Test count: `14`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/req0017/v40-order-doc-final.log`
- Log SHA-256: `bee490b0a62c1a8dab668131161e40d1774f3eb812de0423bf7ee16d5f818f05`

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
 M docs/requirements/REQ-0017-controlled-react/real-model-v40-result.md
 M docs/requirements/REQ-0017-controlled-react/requirement.source.json
 M src/expectation-contract.mjs
 M tests/expectation-contract.execution.test.mjs
 M tests/expectation-contract.test.mjs
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
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/real-model-v40-result.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/expectation-contract.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/expectation-contract.execution.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/expectation-contract.test.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md                    |   2 +
 docs/requirements/README.md                        |   2 +-
 .../00_user_requirement.md                         |   2 +
 .../REQ-0017-controlled-react/02_design.md         |   2 +-
 .../REQ-0017-controlled-react/03_tasks.md          |   2 +-
 .../REQ-0017-controlled-react/04_verification.md   |   2 +-
 .../REQ-0017-controlled-react/current_state.md     |   6 +-
 .../REQ-0017-controlled-react/delivery_evidence.md | 124 +++++++++++----------
 .../real-model-v40-result.md                       |   8 +-
 .../requirement.source.json                        |  12 +-
 src/expectation-contract.mjs                       |  15 ++-
 tests/expectation-contract.execution.test.mjs      |  63 ++++++++---
 tests/expectation-contract.test.mjs                |  46 ++++++++
 13 files changed, 195 insertions(+), 91 deletions(-)
```

### Untracked Files

```text
(none)
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-20T14:28:46+08:00
Command: node --test tests/expectation-contract.test.mjs
Exit code: 0
Parsed test count: 14
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: independent expression uses reviewed relation, not added source regex: 位置2为R701
ok 1 - independent expression uses reviewed relation, not added source regex: 位置2为R701
  ---
  duration_ms: 4.9715
  type: 'test'
  ...
# Subtest: independent expression uses reviewed relation, not added source regex: R701必须占据表体的第二个数据位置
ok 2 - independent expression uses reviewed relation, not added source regex: R701必须占据表体的第二个数据位置
  ---
  duration_ms: 0.6698
  type: 'test'
  ...
# Subtest: independent expression uses reviewed relation, not added source regex: R701 must occupy the second data row.
ok 3 - independent expression uses reviewed relation, not added source regex: R701 must occupy the second data row.
  ---
  duration_ms: 0.693
  type: 'test'
  ...
# Subtest: original HOLD-S2 untouched positional obligation cannot downgrade to membership
ok 4 - original HOLD-S2 untouched positional obligation cannot downgrade to membership
  ---
  duration_ms: 4.9428
  type: 'test'
  ...
# Subtest: unknown source stays unknown even when candidate claims covered: UNINTERPRETED/SUPPORTED
ok 5 - unknown source stays unknown even when candidate claims covered: UNINTERPRETED/SUPPORTED
  ---
  duration_ms: 0.3937
  type: 'test'
  ...
# Subtest: unknown source stays unknown even when candidate claims covered: INTERPRETED/UNINTERPRETED
ok 6 - unknown source stays unknown even when candidate claims covered: INTERPRETED/UNINTERPRETED
  ---
  duration_ms: 0.2065
  type: 'test'
  ...
# Subtest: cannot install serialized authority; original/hash change and concurrent step isolated
ok 7 - cannot install serialized authority; original/hash change and concurrent step isolated
  ---
  duration_ms: 11.9754
  type: 'test'
  ...
# Subtest: missing, duplicate or invented obligation cannot become an empty covered contract
ok 8 - missing, duplicate or invented obligation cannot become an empty covered contract
  ---
  duration_ms: 0.4752
  type: 'test'
  ...
# Subtest: legacy English terminal-period identity limitation remains explicit, not relaxed
ok 9 - legacy English terminal-period identity limitation remains explicit, not relaxed
  ---
  duration_ms: 0.5049
  type: 'test'
  ...
# Subtest: pre-action proof cannot discharge a post-action source obligation
ok 10 - pre-action proof cannot discharge a post-action source obligation
  ---
  duration_ms: 0.6239
  type: 'test'
  ...
# Subtest: source ordering freezes relation, not unseen DOM header or technical comparison
ok 11 - source ordering freezes relation, not unseen DOM header or technical comparison
  ---
  duration_ms: 0.3368
  type: 'test'
  ...
# Subtest: invalid or premature source ordering binding cannot become INTERPRETED: {"field":"编号","direction":"asc"}
ok 12 - invalid or premature source ordering binding cannot become INTERPRETED: {"field":"编号","direction":"asc"}
  ---
  duration_ms: 0.1924
  type: 'test'
  ...
# Subtest: invalid or premature source ordering binding cannot become INTERPRETED: {"field":"编号","column":"编号","direction":"asc","comparison":"asc"}
ok 13 - invalid or premature source ordering binding cannot become INTERPRETED: {"field":"编号","column":"编号","direction":"asc","comparison":"asc"}
  ---
  duration_ms: 0.1191
  type: 'test'
  ...
# Subtest: invalid or premature source ordering binding cannot become INTERPRETED: {"field":"编号","column":"编号","direction":"ascending","comparison":"number"}
ok 14 - invalid or premature source ordering binding cannot become INTERPRETED: {"field":"编号","column":"编号","direction":"ascending","comparison":"number"}
  ---
  duration_ms: 0.0992
  type: 'test'
  ...
1..14
# tests 14
# suites 0
# pass 14
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 153.5963
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

Design view synchronized; preceding v40-order-delivery.log has 45/45 integration tests; this collection reruns 14 overlapping units
