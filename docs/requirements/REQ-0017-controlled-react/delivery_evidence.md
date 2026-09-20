# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-20T14:33:35+08:00`
- Record: `REQ-0017-controlled-react`
- Change fingerprint: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
- Verification source: `collector-executed-v1`
- Verification state: `单元测试通过`
- Command: `node --test tests/expectation-contract.test.mjs`
- Exit code: `0`
- Test count: `14`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/req0017/v40-result-doc-check.log`
- Log SHA-256: `68cbbaeb32043e2a58952158205185a1587b520aa9ac085369b48be8c3931c25`

### Git Status

```text
 M docs/requirements/README.md
 M docs/requirements/REQ-0017-controlled-react/00_user_requirement.md
 M docs/requirements/REQ-0017-controlled-react/03_tasks.md
 M docs/requirements/REQ-0017-controlled-react/current_state.md
 M docs/requirements/REQ-0017-controlled-react/delivery_evidence.md
 M docs/requirements/REQ-0017-controlled-react/real-model-v40-result.md
 M docs/requirements/REQ-0017-controlled-react/requirement.source.json
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/requirements/README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/00_user_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/03_tasks.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/real-model-v40-result.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
 docs/requirements/README.md                        |  2 +-
 .../00_user_requirement.md                         |  1 +
 .../REQ-0017-controlled-react/03_tasks.md          |  2 +-
 .../REQ-0017-controlled-react/current_state.md     |  2 +-
 .../REQ-0017-controlled-react/delivery_evidence.md | 79 ++++++++--------------
 .../real-model-v40-result.md                       | 35 +++++++++-
 .../requirement.source.json                        |  3 +-
 7 files changed, 69 insertions(+), 55 deletions(-)
```

### Untracked Files

```text
(none)
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-20T14:33:34+08:00
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
  duration_ms: 4.6817
  type: 'test'
  ...
# Subtest: independent expression uses reviewed relation, not added source regex: R701必须占据表体的第二个数据位置
ok 2 - independent expression uses reviewed relation, not added source regex: R701必须占据表体的第二个数据位置
  ---
  duration_ms: 0.7354
  type: 'test'
  ...
# Subtest: independent expression uses reviewed relation, not added source regex: R701 must occupy the second data row.
ok 3 - independent expression uses reviewed relation, not added source regex: R701 must occupy the second data row.
  ---
  duration_ms: 0.7139
  type: 'test'
  ...
# Subtest: original HOLD-S2 untouched positional obligation cannot downgrade to membership
ok 4 - original HOLD-S2 untouched positional obligation cannot downgrade to membership
  ---
  duration_ms: 5.798
  type: 'test'
  ...
# Subtest: unknown source stays unknown even when candidate claims covered: UNINTERPRETED/SUPPORTED
ok 5 - unknown source stays unknown even when candidate claims covered: UNINTERPRETED/SUPPORTED
  ---
  duration_ms: 0.4218
  type: 'test'
  ...
# Subtest: unknown source stays unknown even when candidate claims covered: INTERPRETED/UNINTERPRETED
ok 6 - unknown source stays unknown even when candidate claims covered: INTERPRETED/UNINTERPRETED
  ---
  duration_ms: 0.2245
  type: 'test'
  ...
# Subtest: cannot install serialized authority; original/hash change and concurrent step isolated
ok 7 - cannot install serialized authority; original/hash change and concurrent step isolated
  ---
  duration_ms: 11.2317
  type: 'test'
  ...
# Subtest: missing, duplicate or invented obligation cannot become an empty covered contract
ok 8 - missing, duplicate or invented obligation cannot become an empty covered contract
  ---
  duration_ms: 0.4774
  type: 'test'
  ...
# Subtest: legacy English terminal-period identity limitation remains explicit, not relaxed
ok 9 - legacy English terminal-period identity limitation remains explicit, not relaxed
  ---
  duration_ms: 0.5378
  type: 'test'
  ...
# Subtest: pre-action proof cannot discharge a post-action source obligation
ok 10 - pre-action proof cannot discharge a post-action source obligation
  ---
  duration_ms: 0.7293
  type: 'test'
  ...
# Subtest: source ordering freezes relation, not unseen DOM header or technical comparison
ok 11 - source ordering freezes relation, not unseen DOM header or technical comparison
  ---
  duration_ms: 0.3367
  type: 'test'
  ...
# Subtest: invalid or premature source ordering binding cannot become INTERPRETED: {"field":"编号","direction":"asc"}
ok 12 - invalid or premature source ordering binding cannot become INTERPRETED: {"field":"编号","direction":"asc"}
  ---
  duration_ms: 0.1908
  type: 'test'
  ...
# Subtest: invalid or premature source ordering binding cannot become INTERPRETED: {"field":"编号","column":"编号","direction":"asc","comparison":"asc"}
ok 13 - invalid or premature source ordering binding cannot become INTERPRETED: {"field":"编号","column":"编号","direction":"asc","comparison":"asc"}
  ---
  duration_ms: 0.1089
  type: 'test'
  ...
# Subtest: invalid or premature source ordering binding cannot become INTERPRETED: {"field":"编号","column":"编号","direction":"ascending","comparison":"number"}
ok 14 - invalid or premature source ordering binding cannot become INTERPRETED: {"field":"编号","column":"编号","direction":"ascending","comparison":"number"}
  ---
  duration_ms: 0.0898
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
# duration_ms 154.5494
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

Result archival only. Official repeat failed both cases before designated defect. Recording unchanged. 14 overlapping unit checks are not product acceptance.
