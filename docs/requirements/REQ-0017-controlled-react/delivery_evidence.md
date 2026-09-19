# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-20T01:00:28+08:00`
- Record: `REQ-0017-controlled-react`
- Change fingerprint: `bd0e6155afc0d4c70b6fdf38d129884088b82bc3131347d0eada5b1d97b6528f`
- Verification source: `collector-executed-v1`
- Verification state: `单元测试通过`
- Command: `node --test tests/adaptive-progress.test.mjs tests/adaptive-review.test.mjs tests/adaptive-protocol.test.mjs`
- Exit code: `0`
- Test count: `64`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/req0017/v12-protocol-confirmed.log`
- Log SHA-256: `02d715f4042575dca7d07a79bd415cceb9c6795507772ae06874bcfaef1f95ab`

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
 M docs/requirements/REQ-0017-controlled-react/real-model-v11-result.md
 M docs/requirements/REQ-0017-controlled-react/requirement.source.json
 M src/adaptive-execution.mjs
 M src/adaptive-recovery.mjs
 M tests/adaptive-execution.test.mjs
 M tests/adaptive-progress.test.mjs
?? docs/requirements/REQ-0017-controlled-react/real-model-v12-result.md
?? tests/adaptive-completion.test.mjs
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
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/real-model-v11-result.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-execution.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-recovery.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/adaptive-execution.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/adaptive-progress.test.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md                    |   6 +
 .../00_user_requirement.md                         |   5 +
 .../REQ-0017-controlled-react/02_design.md         |   2 +-
 .../REQ-0017-controlled-react/03_tasks.md          |   2 +-
 .../REQ-0017-controlled-react/04_verification.md   |   2 +-
 .../REQ-0017-controlled-react/05_trace.md          |   2 +-
 .../REQ-0017-controlled-react/current_state.md     |   8 +-
 .../REQ-0017-controlled-react/delivery_evidence.md | 457 ++++++++++++++++++---
 .../real-model-v11-result.md                       |   5 +-
 .../requirement.source.json                        |  19 +-
 src/adaptive-execution.mjs                         |  76 ++--
 src/adaptive-recovery.mjs                          |  16 +
 tests/adaptive-execution.test.mjs                  |  11 +-
 tests/adaptive-progress.test.mjs                   |  40 ++
 14 files changed, 550 insertions(+), 101 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0017-controlled-react/real-model-v12-result.md
tests/adaptive-completion.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-20T01:00:27+08:00
Command: node --test tests/adaptive-progress.test.mjs tests/adaptive-review.test.mjs tests/adaptive-protocol.test.mjs
Exit code: 0
Parsed test count: 64
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: completion eligibility requires executed coverage and a clean accepting audit, never model done alone
ok 1 - completion eligibility requires executed coverage and a clean accepting audit, never model done alone
  ---
  duration_ms: 0.7969
  type: 'test'
  ...
# Subtest: initial progress contains every original obligation without guessed coverage
ok 2 - initial progress contains every original obligation without guessed coverage
  ---
  duration_ms: 0.1761
  type: 'test'
  ...
# Subtest: same-obligation partial row count remains pending with measured reference and missing-clause reason
ok 3 - same-obligation partial row count remains pending with measured reference and missing-clause reason
  ---
  duration_ms: 0.8211
  type: 'test'
  ...
# Subtest: covered requires a successfully executed same-obligation assertion, never a proposed or cross-step reference
ok 4 - covered requires a successfully executed same-obligation assertion, never a proposed or cross-step reference
  ---
  duration_ms: 0.22
  type: 'test'
  ...
# Subtest: focused repair keeps original gaps, forbids repeating/relabeling measurements and new actions
ok 5 - focused repair keeps original gaps, forbids repeating/relabeling measurements and new actions
  ---
  duration_ms: 1.3293
  type: 'test'
  ...
# Subtest: focused no-gap completion contains no new assertions or actions and does not mutate historical evidence
ok 6 - focused no-gap completion contains no new assertions or actions and does not mutate historical evidence
  ---
  duration_ms: 0.2417
  type: 'test'
  ...
# Subtest: source correction exposes exact failed field but never automatically normalizes observed units
ok 7 - source correction exposes exact failed field but never automatically normalizes observed units
  ---
  duration_ms: 1.7731
  type: 'test'
  ...
# Subtest: directory binds refs to current observed facts, exposes only current original sources and preserves input
ok 8 - directory binds refs to current observed facts, exposes only current original sources and preserves input
  ---
  duration_ms: 3.9764
  type: 'test'
  ...
# Subtest: V01 kind:button response is invalid, whereas a ref compiles the exact observed role locator
ok 9 - V01 kind:button response is invalid, whereas a ref compiles the exact observed role locator
  ---
  duration_ms: 4.5796
  type: 'test'
  ...
# Subtest: V02 action quote is never silently fixed in legacy mode; source refs generate expectation-only quote
ok 10 - V02 action quote is never silently fixed in legacy mode; source refs generate expectation-only quote
  ---
  duration_ms: 1.7928
  type: 'test'
  ...
# Subtest: action IDs depend on step and successful segment count, not rejected proposals or observed DOM
ok 11 - action IDs depend on step and successful segment count, not rejected proposals or observed DOM
  ---
  duration_ms: 0.6525
  type: 'test'
  ...
# Subtest: generated IDs remain legal and distinct for long common-prefix step IDs
ok 12 - generated IDs remain legal and distinct for long common-prefix step IDs
  ---
  duration_ms: 1.6583
  type: 'test'
  ...
# Subtest: unknown ref and stale refs after URL/text/control changes fail without guessing
ok 13 - unknown ref and stale refs after URL/text/control changes fail without guessing
  ---
  duration_ms: 1.2659
  type: 'test'
  ...
# Subtest: compiler ignores forged exposed directories and observation hash
ok 14 - compiler ignores forged exposed directories and observation hash
  ---
  duration_ms: 0.5362
  type: 'test'
  ...
# Subtest: new/old conflict is rejected: action ref and fixed target
ok 15 - new/old conflict is rejected: action ref and fixed target
  ---
  duration_ms: 0.4598
  type: 'test'
  ...
# Subtest: new/old conflict is rejected: action ref and model ID
ok 16 - new/old conflict is rejected: action ref and model ID
  ---
  duration_ms: 0.5544
  type: 'test'
  ...
# Subtest: new/old conflict is rejected: assertion ref and fixed target
ok 17 - new/old conflict is rejected: assertion ref and fixed target
  ---
  duration_ms: 0.6255
  type: 'test'
  ...
# Subtest: new/old conflict is rejected: source refs and oracle quote
ok 18 - new/old conflict is rejected: source refs and oracle quote
  ---
  duration_ms: 0.4185
  type: 'test'
  ...
# Subtest: new/old conflict is rejected: source refs and old obligation IDs
ok 19 - new/old conflict is rejected: source refs and old obligation IDs
  ---
  duration_ms: 0.3279
  type: 'test'
  ...
# Subtest: source reference cannot escape current original step: ["S2-O1"]
ok 20 - source reference cannot escape current original step: ["S2-O1"]
  ---
  duration_ms: 0.3557
  type: 'test'
  ...
# Subtest: source reference cannot escape current original step: ["unknown"]
ok 21 - source reference cannot escape current original step: ["unknown"]
  ---
  duration_ms: 0.7851
  type: 'test'
  ...
# Subtest: source reference cannot escape current original step: [" S1-O1 "]
ok 22 - source reference cannot escape current original step: [" S1-O1 "]
  ---
  duration_ms: 0.3163
  type: 'test'
  ...
# Subtest: source_refs shape rejected: []
ok 23 - source_refs shape rejected: []
  ---
  duration_ms: 0.3424
  type: 'test'
  ...
# Subtest: source_refs shape rejected: ["S1-O1","S1-O1"]
ok 24 - source_refs shape rejected: ["S1-O1","S1-O1"]
  ---
  duration_ms: 0.3372
  type: 'test'
  ...
# Subtest: source_refs shape rejected: "S1-O1"
ok 25 - source_refs shape rejected: "S1-O1"
  ---
  duration_ms: 0.2401
  type: 'test'
  ...
# Subtest: source_refs shape rejected: [1]
ok 26 - source_refs shape rejected: [1]
  ---
  duration_ms: 0.2587
  type: 'test'
  ...
# Subtest: source_refs shape rejected: [null]
ok 27 - source_refs shape rejected: [null]
  ---
  duration_ms: 0.3578
  type: 'test'
  ...
# Subtest: illegal transport shape rejected: extra top-level field
ok 28 - illegal transport shape rejected: extra top-level field
  ---
  duration_ms: 0.299
  type: 'test'
  ...
# Subtest: illegal transport shape rejected: absent actions
ok 29 - illegal transport shape rejected: absent actions
  ---
  duration_ms: 0.2603
  type: 'test'
  ...
# Subtest: illegal transport shape rejected: actions object
ok 30 - illegal transport shape rejected: actions object
  ---
  duration_ms: 0.2012
  type: 'test'
  ...
# Subtest: illegal transport shape rejected: two actions
ok 31 - illegal transport shape rejected: two actions
  ---
  duration_ms: 0.1374
  type: 'test'
  ...
# Subtest: illegal transport shape rejected: assertions not array
ok 32 - illegal transport shape rejected: assertions not array
  ---
  duration_ms: 0.1074
  type: 'test'
  ...
# Subtest: illegal transport shape rejected: too many assertions
ok 33 - illegal transport shape rejected: too many assertions
  ---
  duration_ms: 0.1748
  type: 'test'
  ...
# Subtest: illegal transport shape rejected: nonboolean complete
ok 34 - illegal transport shape rejected: nonboolean complete
  ---
  duration_ms: 0.1168
  type: 'test'
  ...
# Subtest: illegal transport shape rejected: short timeout
ok 35 - illegal transport shape rejected: short timeout
  ---
  duration_ms: 0.1038
  type: 'test'
  ...
# Subtest: illegal transport shape rejected: fractional timeout
ok 36 - illegal transport shape rejected: fractional timeout
  ---
  duration_ms: 0.1348
  type: 'test'
  ...
# Subtest: illegal transport shape rejected: empty reason
ok 37 - illegal transport shape rejected: empty reason
  ---
  duration_ms: 0.1713
  type: 'test'
  ...
# Subtest: illegal transport shape rejected: action kind instead of op
ok 38 - illegal transport shape rejected: action kind instead of op
  ---
  duration_ms: 0.2029
  type: 'test'
  ...
# Subtest: illegal transport shape rejected: target absent for click
ok 39 - illegal transport shape rejected: target absent for click
  ---
  duration_ms: 0.1848
  type: 'test'
  ...
# Subtest: illegal transport shape rejected: assertion check type
ok 40 - illegal transport shape rejected: assertion check type
  ---
  duration_ms: 0.1875
  type: 'test'
  ...
# Subtest: blocked is preserved verbatim for the executor, never converted to success or sanitized into valid shape
ok 41 - blocked is preserved verbatim for the executor, never converted to success or sanitized into valid shape
  ---
  duration_ms: 0.6213
  type: 'test'
  ...
# Subtest: legacy fixed fragment preserves IDs, quote, values, order and optional expected omission
ok 42 - legacy fixed fragment preserves IDs, quote, values, order and optional expected omission
  ---
  duration_ms: 0.7989
  type: 'test'
  ...
# Subtest: prototype and built-in property names never resolve as target references
ok 43 - prototype and built-in property names never resolve as target references
  ---
  duration_ms: 0.7705
  type: 'test'
  ...
# Subtest: unknown new or legacy fields are rejected rather than silently stripped
ok 44 - unknown new or legacy fields are rejected rather than silently stripped
  ---
  duration_ms: 0.5101
  type: 'test'
  ...
# Subtest: compiler preserves optional expected JSON verbatim, including falsy and matrix values
ok 45 - compiler preserves optional expected JSON verbatim, including falsy and matrix values
  ---
  duration_ms: 0.8416
  type: 'test'
  ...
# Subtest: non-JSON replies and malformed observed locators produce protocol-prefixed errors
ok 46 - non-JSON replies and malformed observed locators produce protocol-prefixed errors
  ---
  duration_ms: 0.3568
  type: 'test'
  ...
# Subtest: explicit /assets navigation needs no DOM link; action-only and fixed table/scope escapes retain strict gates
ok 47 - explicit /assets navigation needs no DOM link; action-only and fixed table/scope escapes retain strict gates
  ---
  duration_ms: 2.5807
  type: 'test'
  ...
# Subtest: source-derived quotes do not waive full business obligation coverage or readonly/input restrictions
ok 48 - source-derived quotes do not waive full business obligation coverage or readonly/input restrictions
  ---
  duration_ms: 2.9475
  type: 'test'
  ...
# Subtest: input rejects changed source text and cannot use another step sources supplied by caller
ok 49 - input rejects changed source text and cannot use another step sources supplied by caller
  ---
  duration_ms: 1.398
  type: 'test'
  ...
# Subtest: reference override documents navigation, partial actions, targeted format correction and unchanged gates
ok 50 - reference override documents navigation, partial actions, targeted format correction and unchanged gates
  ---
  duration_ms: 0.1258
  type: 'test'
  ...
# Subtest: known assertion with another obligation becomes candidate repair, not acceptance or schema exhaustion
ok 51 - known assertion with another obligation becomes candidate repair, not acceptance or schema exhaustion
  ---
  duration_ms: 9.0887
  type: 'test'
  ...
# Subtest: stable audit assertion refs compile to strict same-step measured references
ok 52 - stable audit assertion refs compile to strict same-step measured references
  ---
  duration_ms: 0.9922
  type: 'test'
  ...
# Subtest: contradictory COVERED plus ASSERTION_GAP conservatively rejects candidate without format exhaustion
ok 53 - contradictory COVERED plus ASSERTION_GAP conservatively rejects candidate without format exhaustion
  ---
  duration_ms: 1.3673
  type: 'test'
  ...
# Subtest: contradictory feedback cannot hide invalid references or unrelated malformed issues
ok 54 - contradictory feedback cannot hide invalid references or unrelated malformed issues
  ---
  duration_ms: 3.6468
  type: 'test'
  ...
# Subtest: real V03 COVERED-with-empty-refs response is repaired without replanning candidate
ok 55 - real V03 COVERED-with-empty-refs response is repaired without replanning candidate
  ---
  duration_ms: 0.9945
  type: 'test'
  ...
# Subtest: persistent invalid review is bounded and is never implicitly accepted
ok 56 - persistent invalid review is bounded and is never implicitly accepted
  ---
  duration_ms: 0.6265
  type: 'test'
  ...
# Subtest: valid adverse semantic verdict is returned without retry or deletion
ok 57 - valid adverse semantic verdict is returned without retry or deletion
  ---
  duration_ms: 0.6008
  type: 'test'
  ...
# Subtest: unknown/duplicate/mixed audit refs do not silently bind to another assertion
ok 58 - unknown/duplicate/mixed audit refs do not silently bind to another assertion
  ---
  duration_ms: 1.4024
  type: 'test'
  ...
# Subtest: abort/provider-budget error is not retried as audit schema failure
ok 59 - abort/provider-budget error is not retried as audit schema failure
  ---
  duration_ms: 1.0635
  type: 'test'
  ...
# Subtest: block review requires a current source-named control or explicit original route
ok 60 - block review requires a current source-named control or explicit original route
  ---
  duration_ms: 1.7613
  type: 'test'
  ...
# Subtest: format correction preserves rejected response and explicit source constraints
ok 61 - format correction preserves rejected response and explicit source constraints
  ---
  duration_ms: 0.5538
  type: 'test'
  ...
# Subtest: null check and mixed ref fields stay inside same-candidate audit correction
ok 62 - null check and mixed ref fields stay inside same-candidate audit correction
  ---
  duration_ms: 0.839
  type: 'test'
  ...
# Subtest: invalid JSON is repaired as audit format but never escapes as a planning retry
ok 63 - invalid JSON is repaired as audit format but never escapes as a planning retry
  ---
  duration_ms: 0.7754
  type: 'test'
  ...
# Subtest: adaptive final coverage cannot replace table unchanged with a sampled fixed row count
ok 64 - adaptive final coverage cannot replace table unchanged with a sampled fixed row count
  ---
  duration_ms: 2.412
  type: 'test'
  ...
1..64
# tests 64
# suites 0
# pass 64
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 206.324
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

64项进度/审查/协议；另4项Chromium收尾/报告及8项名称选取执行回归的实际日志见事实源。未执行全量工程回归及本构建真实模型。
