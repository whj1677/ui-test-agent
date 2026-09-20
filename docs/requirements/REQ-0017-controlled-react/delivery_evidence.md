# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-20T08:55:01+08:00`
- Record: `REQ-0017-controlled-react`
- Change fingerprint: `c4f0b33040af5aa05ab5efa345e6959159b5c19af9061b0658c9bb813054753d`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test --test-concurrency=2 tests/adaptive-completion-evidence.test.mjs tests/adaptive-completion-evidence.execution.test.mjs`
- Exit code: `0`
- Test count: `11`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/req0017/v33-delivery.log`
- Log SHA-256: `efd23f567ac7e0660cbf276d37728351b1e524269977b85a90bfbeb98a132698`

### Git Status

```text
 M docs/requirements/README.md
 M docs/requirements/REQ-0017-controlled-react/00_user_requirement.md
 M docs/requirements/REQ-0017-controlled-react/02_design.md
 M docs/requirements/REQ-0017-controlled-react/03_tasks.md
 M docs/requirements/REQ-0017-controlled-react/04_verification.md
 M docs/requirements/REQ-0017-controlled-react/05_trace.md
 M docs/requirements/REQ-0017-controlled-react/change_log.md
 M docs/requirements/REQ-0017-controlled-react/current_state.md
 M docs/requirements/REQ-0017-controlled-react/delivery_evidence.md
 M docs/requirements/REQ-0017-controlled-react/real-model-v32-result.md
 M docs/requirements/REQ-0017-controlled-react/requirement.source.json
 M src/adaptive-execution.mjs
 M src/adaptive-recovery.mjs
?? docs/requirements/REQ-0017-controlled-react/real-model-v33-result.md
?? tests/adaptive-completion-evidence.execution.test.mjs
?? tests/adaptive-completion-evidence.test.mjs
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/requirements/README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/00_user_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/02_design.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/03_tasks.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/04_verification.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/05_trace.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/change_log.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/real-model-v32-result.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-execution.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-recovery.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/requirements/README.md                        |   2 +
 .../00_user_requirement.md                         |   3 +
 .../REQ-0017-controlled-react/02_design.md         |   2 +-
 .../REQ-0017-controlled-react/03_tasks.md          |   4 +-
 .../REQ-0017-controlled-react/04_verification.md   |   2 +-
 .../REQ-0017-controlled-react/05_trace.md          |   4 +-
 .../REQ-0017-controlled-react/change_log.md        |   1 +
 .../REQ-0017-controlled-react/current_state.md     |  10 +-
 .../REQ-0017-controlled-react/delivery_evidence.md | 320 +++++----------------
 .../real-model-v32-result.md                       |   6 +
 .../requirement.source.json                        |  29 +-
 src/adaptive-execution.mjs                         |  22 +-
 src/adaptive-recovery.mjs                          |  17 ++
 13 files changed, 145 insertions(+), 277 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0017-controlled-react/real-model-v33-result.md
tests/adaptive-completion-evidence.execution.test.mjs
tests/adaptive-completion-evidence.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-20T08:54:03+08:00
Command: node --test --test-concurrency=2 tests/adaptive-completion-evidence.test.mjs tests/adaptive-completion-evidence.execution.test.mjs
Exit code: 0
Parsed test count: 11
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: a new successful measurement can request completion, not approve it: new-evidence
ok 1 - a new successful measurement can request completion, not approve it: new-evidence
  ---
  duration_ms: 16341.1744
  type: 'test'
  ...
# Subtest: a new successful measurement can request completion, not approve it: final-reject
ok 2 - a new successful measurement can request completion, not approve it: final-reject
  ---
  duration_ms: 14723.5376
  type: 'test'
  ...
# Subtest: a new successful measurement can request completion, not approve it: duplicate-only
ok 3 - a new successful measurement can request completion, not approve it: duplicate-only
  ---
  duration_ms: 11186.2722
  type: 'test'
  ...
# Subtest: a new successful measurement can request completion, not approve it: actual-difference
ok 4 - a new successful measurement can request completion, not approve it: actual-difference
  ---
  duration_ms: 13824.6618
  type: 'test'
  ...
# Subtest: a newly measured distinct assertion changes the completion evidence set
ok 5 - a newly measured distinct assertion changes the completion evidence set
  ---
  duration_ms: 1.4139
  type: 'test'
  ...
# Subtest: duplicates, order and fragment/action metadata do not unlock another probe
ok 6 - duplicates, order and fragment/action metadata do not unlock another probe
  ---
  duration_ms: 0.4543
  type: 'test'
  ...
# Subtest: new source IDs or quote alone do not count as new measured content
ok 7 - new source IDs or quote alone do not count as new measured content
  ---
  duration_ms: 0.1556
  type: 'test'
  ...
# Subtest: default visibility is normalized to its actual default true predicate
ok 8 - default visibility is normalized to its actual default true predicate
  ---
  duration_ms: 0.1537
  type: 'test'
  ...
# Subtest: changing a real target, predicate or expected value is a different declaration, not approval
ok 9 - changing a real target, predicate or expected value is a different declaration, not approval
  ---
  duration_ms: 0.3416
  type: 'test'
  ...
# Subtest: input is never mutated and property serialization order is immaterial
ok 10 - input is never mutated and property serialization order is immaterial
  ---
  duration_ms: 1.2942
  type: 'test'
  ...
# Subtest: a model cannot forge controller probe origin or an evidence epoch
ok 11 - a model cannot forge controller probe origin or an evidence epoch
  ---
  duration_ms: 4.0749
  type: 'test'
  ...
1..11
# tests 11
# suites 0
# pass 11
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 56608.6373
```

### Sync Record Status

```text
DRY-RUN: no derived changes for REQ-0017-controlled-react; explicit implementation states retained, never inferred from verification.
```

### Check AI Context

- Exit code: `1`

```text
FAIL ai-engineering-context checks

1. docs\modules
   Problem: Code/test/config changed but no concrete module document was updated, and no explicit no-module-doc-change reason was recorded in the changed requirement design.
   Fix: Create or update the affected `docs/modules/<module>.md` file. If the change truly has no module impact, add `本次无需模块文档变更，原因：...` to the changed requirement `02_design.md`.
```

### Notes

版本33成功新证据后的完整收尾重核，11项专项；原预算和最终审查保持，不计官方模型效果。

### Module documentation follow-up

首次 collector 的上述失败仅为模块说明未更新，保留原始结果。补齐 `docs/modules/release_runtime.md` 后实际重新运行 `python scripts/check_ai_context.py` 返回 exit 0 / `PASS ai-engineering-context checks`；代码未变化，不重复运行已成功的11项专项。随后四个变更源码/测试文件 Prettier 检查和 `git diff --check` 均无问题。
