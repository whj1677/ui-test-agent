# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-20T01:58:59+08:00`
- Record: `REQ-0017-controlled-react`
- Change fingerprint: `adc41de1c754a3ae6ace58f65c8f9663eaa73e4155fd79f461232ca551c2d1b0`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test tests/adaptive-extra-constraints.test.mjs`
- Exit code: `0`
- Test count: `8`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/req0017/v15-final-constraints.log`
- Log SHA-256: `801912423edddcd705b2f21c18caceea3f983e4650455c31aba0b13b544de45b`

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
 M docs/requirements/REQ-0017-controlled-react/real-model-v14-result.md
 M docs/requirements/REQ-0017-controlled-react/requirement.source.json
 M src/adaptive-plan.mjs
 M src/adaptive-recovery.mjs
 M src/adaptive-review.mjs
 M src/plan-semantics.mjs
 M src/scope-guidance.mjs
?? docs/requirements/REQ-0017-controlled-react/real-model-v15-result.md
?? tests/adaptive-extra-constraints.execution.test.mjs
?? tests/adaptive-extra-constraints.test.mjs
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
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/real-model-v14-result.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-plan.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-recovery.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-review.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/plan-semantics.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/scope-guidance.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md                    |   6 +
 .../00_user_requirement.md                         |   3 +
 .../REQ-0017-controlled-react/02_design.md         |   2 +-
 .../REQ-0017-controlled-react/03_tasks.md          |   2 +-
 .../REQ-0017-controlled-react/04_verification.md   |   2 +-
 .../REQ-0017-controlled-react/05_trace.md          |   2 +-
 .../REQ-0017-controlled-react/current_state.md     |   8 +-
 .../REQ-0017-controlled-react/delivery_evidence.md | 475 +++------------------
 .../real-model-v14-result.md                       |   8 +-
 .../requirement.source.json                        |  17 +-
 src/adaptive-plan.mjs                              |   3 +-
 src/adaptive-recovery.mjs                          |   2 +
 src/adaptive-review.mjs                            |   3 +-
 src/plan-semantics.mjs                             |  41 ++
 src/scope-guidance.mjs                             |   1 +
 15 files changed, 152 insertions(+), 423 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0017-controlled-react/real-model-v15-result.md
tests/adaptive-extra-constraints.execution.test.mjs
tests/adaptive-extra-constraints.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-20T01:58:57+08:00
Command: node --test tests/adaptive-extra-constraints.test.mjs
Exit code: 0
Parsed test count: 8
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: planner and reviewer receive the same constraint-scope contract
ok 1 - planner and reviewer receive the same constraint-scope contract
  ---
  duration_ms: 0.6944
  type: 'test'
  ...
# Subtest: visible range does not authorize extra matrix constraints: {"ordered":true}
ok 2 - visible range does not authorize extra matrix constraints: {"ordered":true}
  ---
  duration_ms: 1.956
  type: 'test'
  ...
# Subtest: visible range does not authorize extra matrix constraints: {"exact_rows":true}
ok 3 - visible range does not authorize extra matrix constraints: {"exact_rows":true}
  ---
  duration_ms: 0.7176
  type: 'test'
  ...
# Subtest: visible range does not authorize extra matrix constraints: {"ordered":true,"exact_rows":true}
ok 4 - visible range does not authorize extra matrix constraints: {"ordered":true,"exact_rows":true}
  ---
  duration_ms: 0.5273
  type: 'test'
  ...
# Subtest: explicit count and order remain required rather than removed by repair
ok 5 - explicit count and order remain required rather than removed by repair
  ---
  duration_ms: 0.8613
  type: 'test'
  ...
# Subtest: a legal extra row or alternative ordering proves why the proposed extras are not neutral
ok 6 - a legal extra row or alternative ordering proves why the proposed extras are not neutral
  ---
  duration_ms: 0.9852
  type: 'test'
  ...
# Subtest: page text cannot smuggle a copied record total: text
ok 7 - page text cannot smuggle a copied record total: text
  ---
  duration_ms: 0.6489
  type: 'test'
  ...
# Subtest: page text cannot smuggle a copied record total: contains
ok 8 - page text cannot smuggle a copied record total: contains
  ---
  duration_ms: 0.2223
  type: 'test'
  ...
1..8
# tests 8
# suites 0
# pass 8
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 136.733
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

本版主证据是v15-regression.log的267项受影响回归；本命令8项为重叠复检，不相加，不继承旧1242全量，不代表真实模型通过。
