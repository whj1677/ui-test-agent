# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-20T04:12:54+08:00`
- Record: `REQ-0017-controlled-react`
- Change fingerprint: `d93ce64aa492d5c820865899d5021cc879eb9d92952660d2b8a37f75e9451419`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test --test-concurrency=2 tests/adaptive-prefix-cardinality.test.mjs tests/adaptive-position-recovery.test.mjs`
- Exit code: `0`
- Test count: `20`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/req0017/v19-delivery.log`
- Log SHA-256: `8943a2ad208b869d2ff76d66eac6309c0c888668033d7dde5cead14dfc182ec3`

### Git Status

```text
 M docs/modules/release_runtime.md
 M docs/requirements/README.md
 M docs/requirements/REQ-0017-controlled-react/00_user_requirement.md
 M docs/requirements/REQ-0017-controlled-react/02_design.md
 M docs/requirements/REQ-0017-controlled-react/03_tasks.md
 M docs/requirements/REQ-0017-controlled-react/04_verification.md
 M docs/requirements/REQ-0017-controlled-react/05_trace.md
 M docs/requirements/REQ-0017-controlled-react/change_log.md
 M docs/requirements/REQ-0017-controlled-react/current_state.md
 M docs/requirements/REQ-0017-controlled-react/delivery_evidence.md
 M docs/requirements/REQ-0017-controlled-react/real-model-v18-result.md
 M docs/requirements/REQ-0017-controlled-react/requirement.source.json
 M src/plan-semantics.mjs
 M src/scope-guidance.mjs
 M tests/adaptive-position-recovery.test.mjs
?? docs/requirements/REQ-0017-controlled-react/real-model-v19-result.md
?? src/table-cardinality.mjs
?? tests/adaptive-prefix-cardinality.test.mjs
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
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/change_log.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/real-model-v18-result.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/plan-semantics.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/scope-guidance.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/adaptive-position-recovery.test.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md                    |   6 +
 docs/requirements/README.md                        |   2 +-
 .../00_user_requirement.md                         |   4 +
 .../REQ-0017-controlled-react/02_design.md         |   2 +-
 .../REQ-0017-controlled-react/03_tasks.md          |   2 +-
 .../REQ-0017-controlled-react/04_verification.md   |   2 +-
 .../REQ-0017-controlled-react/05_trace.md          |   2 +-
 .../REQ-0017-controlled-react/change_log.md        |   1 +
 .../REQ-0017-controlled-react/current_state.md     |   8 +-
 .../REQ-0017-controlled-react/delivery_evidence.md | 217 +++++++++++++--------
 .../real-model-v18-result.md                       |  14 +-
 .../requirement.source.json                        |  26 ++-
 src/plan-semantics.mjs                             |  21 +-
 src/scope-guidance.mjs                             |   2 +-
 tests/adaptive-position-recovery.test.mjs          |  65 +++---
 15 files changed, 239 insertions(+), 135 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0017-controlled-react/real-model-v19-result.md
src/table-cardinality.mjs
tests/adaptive-prefix-cardinality.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-20T04:11:57+08:00
Command: node --test --test-concurrency=2 tests/adaptive-prefix-cardinality.test.mjs tests/adaptive-position-recovery.test.mjs
Exit code: 0
Parsed test count: 20
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: position proof repair without navigation or replay: membership
ok 1 - position proof repair without navigation or replay: membership
  ---
  duration_ms: 8288.2805
  type: 'test'
  ...
# Subtest: position proof repair without navigation or replay: ungrounded
ok 2 - position proof repair without navigation or replay: ungrounded
  ---
  duration_ms: 8108.2357
  type: 'test'
  ...
# Subtest: position proof repair without navigation or replay: difference
ok 3 - position proof repair without navigation or replay: difference
  ---
  duration_ms: 8836.7703
  type: 'test'
  ...
# Subtest: position proof repair without navigation or replay: repeat
ok 4 - position proof repair without navigation or replay: repeat
  ---
  duration_ms: 6512.1424
  type: 'test'
  ...
# Subtest: position proof repair without navigation or replay: prefix-extra
ok 5 - position proof repair without navigation or replay: prefix-extra
  ---
  duration_ms: 8211.3188
  type: 'test'
  ...
# Subtest: position proof repair without navigation or replay: prefix-difference
ok 6 - position proof repair without navigation or replay: prefix-difference
  ---
  duration_ms: 8952.5392
  type: 'test'
  ...
# Subtest: position proof repair without navigation or replay: prefix-repeat
ok 7 - position proof repair without navigation or replay: prefix-repeat
  ---
  duration_ms: 6612.987
  type: 'test'
  ...
# Subtest: ordinal/prefix/incidental/conditional text is not a table count: 第一行是 R012；第二行是 R007。
ok 8 - ordinal/prefix/incidental/conditional text is not a table count: 第一行是 R012；第二行是 R007。
  ---
  duration_ms: 3.97
  type: 'test'
  ...
# Subtest: ordinal/prefix/incidental/conditional text is not a table count: 前两行是 R012 和 R007。
ok 9 - ordinal/prefix/incidental/conditional text is not a table count: 前两行是 R012 和 R007。
  ---
  duration_ms: 0.2885
  type: 'test'
  ...
# Subtest: ordinal/prefix/incidental/conditional text is not a table count: 第12行是R012。
ok 10 - ordinal/prefix/incidental/conditional text is not a table count: 第12行是R012。
  ---
  duration_ms: 0.1894
  type: 'test'
  ...
# Subtest: ordinal/prefix/incidental/conditional text is not a table count: 最后两行可见。
ok 11 - ordinal/prefix/incidental/conditional text is not a table count: 最后两行可见。
  ---
  duration_ms: 0.1197
  type: 'test'
  ...
# Subtest: ordinal/prefix/incidental/conditional text is not a table count: first 2 rows are R012 and R007
ok 12 - ordinal/prefix/incidental/conditional text is not a table count: first 2 rows are R012 and R007
  ---
  duration_ms: 0.349
  type: 'test'
  ...
# Subtest: ordinal/prefix/incidental/conditional text is not a table count: 参数有2个，功率200 kW，刷新2秒。
ok 13 - ordinal/prefix/incidental/conditional text is not a table count: 参数有2个，功率200 kW，刷新2秒。
  ---
  duration_ms: 0.1189
  type: 'test'
  ...
# Subtest: ordinal/prefix/incidental/conditional text is not a table count: 不要求只有2行。
ok 14 - ordinal/prefix/incidental/conditional text is not a table count: 不要求只有2行。
  ---
  duration_ms: 0.1393
  type: 'test'
  ...
# Subtest: ordinal/prefix/incidental/conditional text is not a table count: 至少2行。
ok 15 - ordinal/prefix/incidental/conditional text is not a table count: 至少2行。
  ---
  duration_ms: 0.1
  type: 'test'
  ...
# Subtest: ordinal/prefix/incidental/conditional text is not a table count: 如果有2行则显示。
ok 16 - ordinal/prefix/incidental/conditional text is not a table count: 如果有2行则显示。
  ---
  duration_ms: 0.3749
  type: 'test'
  ...
# Subtest: prefix matrix cannot silently require a closed two-row population
ok 17 - prefix matrix cannot silently require a closed two-row population
  ---
  duration_ms: 1.0528
  type: 'test'
  ...
# Subtest: an explicitly requested row count remains enforceable with its original value
ok 18 - an explicitly requested row count remains enforceable with its original value
  ---
  duration_ms: 1.6706
  type: 'test'
  ...
# Subtest: empty fields and ambiguous Chinese numerals do not define a row count
ok 19 - empty fields and ambiguous Chinese numerals do not define a row count
  ---
  duration_ms: 0.412
  type: 'test'
  ...
# Subtest: legal trailing rows do not erase absolute position or explicit full-count failures
ok 20 - legal trailing rows do not erase absolute position or explicit full-count failures
  ---
  duration_ms: 0.8659
  type: 'test'
  ...
1..20
# tests 20
# suites 0
# pass 20
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 55997.3773
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

版本19数量来源与前缀总体分离；受影响327项与本次20项重叠不相加。注入模型与真实Chromium是工程验证，官方模型另列，V07覆盖缺口未修。
