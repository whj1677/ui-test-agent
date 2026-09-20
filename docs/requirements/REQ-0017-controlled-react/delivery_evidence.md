# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-20T12:48:38+08:00`
- Record: `REQ-0017-controlled-react`
- Change fingerprint: `364be08f07ebc45ee7edc396c9ab02658f790edb964695c5ce7cddc061cb1dbd`
- Verification source: `collector-executed-v1`
- Verification state: `单元测试通过`
- Command: `node --test tests/model-round-diagnosis.test.mjs`
- Exit code: `0`
- Test count: `4`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/req0017/v39-no-run-diagnosis.log`
- Log SHA-256: `ea95dc673ea3ebec8c92052c23df60eac486aaf8265b9c155e4cd5dc0bfa986e`

### Git Status

```text
 M docs/requirements/REQ-0017-controlled-react/00_user_requirement.md
 M docs/requirements/REQ-0017-controlled-react/04_verification.md
 M docs/requirements/REQ-0017-controlled-react/05_trace.md
 M docs/requirements/REQ-0017-controlled-react/current_state.md
 M docs/requirements/REQ-0017-controlled-react/delivery_evidence.md
 M docs/requirements/REQ-0017-controlled-react/requirement.source.json
 M scripts/analyze-model-round.mjs
 M tests/model-round-diagnosis.test.mjs
?? docs/requirements/REQ-0017-controlled-react/real-model-v39-comparison.md
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/00_user_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/04_verification.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/05_trace.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'scripts/analyze-model-round.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/model-round-diagnosis.test.mjs', LF will be replaced by CRLF the next time Git touches it
 .../00_user_requirement.md                         |   1 +
 .../REQ-0017-controlled-react/04_verification.md   |   2 +-
 .../REQ-0017-controlled-react/05_trace.md          |   2 +-
 .../REQ-0017-controlled-react/current_state.md     |   2 +-
 .../REQ-0017-controlled-react/delivery_evidence.md | 624 ++-------------------
 .../requirement.source.json                        |   7 +-
 scripts/analyze-model-round.mjs                    |  15 +-
 tests/model-round-diagnosis.test.mjs               |  22 +-
 8 files changed, 83 insertions(+), 592 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0017-controlled-react/real-model-v39-comparison.md
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-20T12:48:37+08:00
Command: node --test tests/model-round-diagnosis.test.mjs
Exit code: 0
Parsed test count: 4
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: classification separates proposals from measured completion, repairs and partial review
ok 1 - classification separates proposals from measured completion, repairs and partial review
  ---
  duration_ms: 1.5528
  type: 'test'
  ...
# Subtest: one logical call, two physical attempts, usage duplicated by provider is counted once
ok 2 - one logical call, two physical attempts, usage duplicated by provider is counted once
  ---
  duration_ms: 0.9078
  type: 'test'
  ...
# Subtest: missing timings and usage remain explicitly unknown, never synthetic zero
ok 3 - missing timings and usage remain explicitly unknown, never synthetic zero
  ---
  duration_ms: 0.2527
  type: 'test'
  ...
# Subtest: a pre-execution failure has no recordings, but a missing attempted run is not hidden
ok 4 - a pre-execution failure has no recordings, but a missing attempted run is not hidden
  ---
  duration_ms: 12.0869
  type: 'test'
  ...
1..4
# tests 4
# suites 0
# pass 4
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 120.1129
```

### Sync Record Status

```text
DRY-RUN: no derived changes for REQ-0017-controlled-react; explicit implementation states retained, never inferred from verification.
```

### Check AI Context

- Exit code: `1`

```text
FAIL ai-engineering-context checks

1. docs\requirements\REQ-0017-controlled-react\02_design.md
   Problem: Code/test/config changed but `02_design.md` was not updated and has no explicit no-design-change reason.
   Fix: Update `02_design.md`, or add `本次无需设计变更，原因：...` when the change truly does not affect design.
2. docs\modules
   Problem: Code/test/config changed but no concrete module document was updated, and no explicit no-module-doc-change reason was recorded in the changed requirement design.
   Fix: Create or update the affected `docs/modules/<module>.md` file. If the change truly has no module impact, add `本次无需模块文档变更，原因：...` to the changed requirement `02_design.md`.
```

### Notes

只读统计允许明确零attempts的输入阶段中止；有attempts缺目录仍报错，产品运行构建冻结不变。
