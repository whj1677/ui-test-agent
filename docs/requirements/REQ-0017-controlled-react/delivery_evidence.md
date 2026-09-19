# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-20T06:07:33+08:00`
- Record: `REQ-0017-controlled-react`
- Change fingerprint: `bac95415d5cdb9e0636cdf584f584c2c8260fde54013578f4f321a155d4809c6`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test --test-concurrency=2 tests/invariant-caption-window.test.mjs tests/invariant-caption-window.execution.test.mjs`
- Exit code: `0`
- Test count: `7`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/req0017/v25-delivery.log`
- Log SHA-256: `7c7e34302b54650b02c3d3865538da483d69d4eeb16a27735d522748f03ad911`

### Git Status

```text
 M docs/modules/release_runtime.md
 M docs/requirements/README.md
 M docs/requirements/REQ-0017-controlled-react/00_user_requirement.md
 M docs/requirements/REQ-0017-controlled-react/02_design.md
 M docs/requirements/REQ-0017-controlled-react/03_tasks.md
 M docs/requirements/REQ-0017-controlled-react/04_verification.md
 M docs/requirements/REQ-0017-controlled-react/05_trace.md
 M docs/requirements/REQ-0017-controlled-react/current_state.md
 M docs/requirements/REQ-0017-controlled-react/delivery_evidence.md
 M docs/requirements/REQ-0017-controlled-react/requirement.source.json
 M src/browser.mjs
?? docs/requirements/REQ-0017-controlled-react/real-model-v25-result.md
?? tests/invariant-caption-window.execution.test.mjs
?? tests/invariant-caption-window.test.mjs
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
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/browser.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md                    |   2 +
 docs/requirements/README.md                        |   2 +
 .../00_user_requirement.md                         |   1 +
 .../REQ-0017-controlled-react/02_design.md         |   2 +-
 .../REQ-0017-controlled-react/03_tasks.md          |   2 +-
 .../REQ-0017-controlled-react/04_verification.md   |   2 +-
 .../REQ-0017-controlled-react/05_trace.md          |   2 +-
 .../REQ-0017-controlled-react/current_state.md     |   8 +-
 .../REQ-0017-controlled-react/delivery_evidence.md | 309 ++++-----------------
 .../requirement.source.json                        |  15 +-
 src/browser.mjs                                    |  27 +-
 11 files changed, 99 insertions(+), 273 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0017-controlled-react/real-model-v25-result.md
tests/invariant-caption-window.execution.test.mjs
tests/invariant-caption-window.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-20T06:07:10+08:00
Command: node --test --test-concurrency=2 tests/invariant-caption-window.test.mjs tests/invariant-caption-window.execution.test.mjs
Exit code: 0
Parsed test count: 7
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: caption holds must follow checkpoint sampling, difference=false
ok 1 - caption holds must follow checkpoint sampling, difference=false
  ---
  duration_ms: 11435.2879
  type: 'test'
  ...
# Subtest: caption holds must follow checkpoint sampling, difference=true
ok 2 - caption holds must follow checkpoint sampling, difference=true
  ---
  duration_ms: 9540.2345
  type: 'test'
  ...
# Subtest: checkpoint-owned invariant presentation: normal
ok 3 - checkpoint-owned invariant presentation: normal
  ---
  duration_ms: 2871.1677
  type: 'test'
  ...
# Subtest: checkpoint-owned invariant presentation: difference
ok 4 - checkpoint-owned invariant presentation: difference
  ---
  duration_ms: 921.339
  type: 'test'
  ...
# Subtest: checkpoint-owned invariant presentation: late-measurement
ok 5 - checkpoint-owned invariant presentation: late-measurement
  ---
  duration_ms: 3048.5264
  type: 'test'
  ...
# Subtest: checkpoint-owned invariant presentation: presentation-fails
ok 6 - checkpoint-owned invariant presentation: presentation-fails
  ---
  duration_ms: 203.1957
  type: 'test'
  ...
# Subtest: checkpoint-owned invariant presentation: action-only
ok 7 - checkpoint-owned invariant presentation: action-only
  ---
  duration_ms: 2391.2711
  type: 'test'
  ...
1..7
# tests 7
# suites 0
# pass 7
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 21463.7389
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

主工程113项无失败；交付7项为子集，官方模型未复验
