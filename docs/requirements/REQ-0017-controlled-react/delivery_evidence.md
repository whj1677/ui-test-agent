# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-20T09:50:22+08:00`
- Record: `REQ-0017-controlled-react`
- Change fingerprint: `5c79b41363ca6a2aa8d9b64153651924d01bbe2bad40880bde6e0688af8a4873`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test --test-concurrency=2 tests/range-position.test.mjs tests/range-position.execution.test.mjs`
- Exit code: `0`
- Test count: `34`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/req0017/v35-delivery.log`
- Log SHA-256: `c0b2b0594b9f392f0ffe2763b416cecc13dee36b0842bf59bbf4904823c8f316`

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
 M docs/requirements/REQ-0017-controlled-react/requirement.source.json
 M src/adaptive-candidate-feedback.mjs
 M src/adaptive-capabilities.mjs
 M src/adaptive-recovery.mjs
 M src/plan-semantics.mjs
 M src/table-assertion.mjs
 M src/table-cardinality.mjs
 M src/table-position.mjs
?? docs/requirements/REQ-0017-controlled-react/real-model-v35-result.md
?? tests/range-position.execution.test.mjs
?? tests/range-position.test.mjs
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
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-candidate-feedback.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-capabilities.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/adaptive-recovery.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/plan-semantics.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/table-assertion.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/table-cardinality.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/table-position.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md                    |   2 +
 docs/requirements/README.md                        |   2 +
 .../00_user_requirement.md                         |   2 +
 .../REQ-0017-controlled-react/02_design.md         |   2 +-
 .../REQ-0017-controlled-react/03_tasks.md          |   2 +-
 .../REQ-0017-controlled-react/04_verification.md   |   2 +-
 .../REQ-0017-controlled-react/05_trace.md          |   2 +-
 .../REQ-0017-controlled-react/change_log.md        |   1 +
 .../REQ-0017-controlled-react/current_state.md     |   8 +-
 .../REQ-0017-controlled-react/delivery_evidence.md | 302 +++++++++++++--------
 .../requirement.source.json                        |  26 +-
 src/adaptive-candidate-feedback.mjs                |   7 +
 src/adaptive-capabilities.mjs                      |  11 +-
 src/adaptive-recovery.mjs                          |   2 +
 src/plan-semantics.mjs                             |   9 +-
 src/table-assertion.mjs                            |   2 +-
 src/table-cardinality.mjs                          |   4 +
 src/table-position.mjs                             |  65 ++++-
 18 files changed, 321 insertions(+), 130 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0017-controlled-react/real-model-v35-result.md
tests/range-position.execution.test.mjs
tests/range-position.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-20T09:49:07+08:00
Command: node --test --test-concurrency=2 tests/range-position.test.mjs tests/range-position.execution.test.mjs
Exit code: 0
Parsed test count: 34
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: source position interval through actual Controller: correct
ok 1 - source position interval through actual Controller: correct
  ---
  duration_ms: 14581.6862
  type: 'test'
  ...
# Subtest: source position interval through actual Controller: shifted
ok 2 - source position interval through actual Controller: shifted
  ---
  duration_ms: 15934.1419
  type: 'test'
  ...
# Subtest: source position interval through actual Controller: repeat
ok 3 - source position interval through actual Controller: repeat
  ---
  duration_ms: 12995.1601
  type: 'test'
  ...
# Subtest: source position interval through actual Controller: closed-extra
ok 4 - source position interval through actual Controller: closed-extra
  ---
  duration_ms: 14815.3129
  type: 'test'
  ...
# Subtest: source position interval through actual Controller: wrong-position
ok 5 - source position interval through actual Controller: wrong-position
  ---
  duration_ms: 14813.8057
  type: 'test'
  ...
# Subtest: range source maps each literal identity to its absolute row, not ID numeric suffix
ok 6 - range source maps each literal identity to its absolute row, not ID numeric suffix
  ---
  duration_ms: 3.7653
  type: 'test'
  ...
# Subtest: source-grounded range position is legal and a shifted prefix remains a real difference
ok 7 - source-grounded range position is legal and a shifted prefix remains a real difference
  ---
  duration_ms: 1.6321
  type: 'test'
  ...
# Subtest: relative order cannot complete explicit range positions
ok 8 - relative order cannot complete explicit range positions
  ---
  duration_ms: 4.7451
  type: 'test'
  ...
# Subtest: range endpoint is not a current-table row count or permission for exact_rows
ok 9 - range endpoint is not a current-table row count or permission for exact_rows
  ---
  duration_ms: 2.0962
  type: 'test'
  ...
# Subtest: bounded range syntax maps the same original identities: 第2到4行依次是
ok 10 - bounded range syntax maps the same original identities: 第2到4行依次是
  ---
  duration_ms: 0.4313
  type: 'test'
  ...
# Subtest: bounded range syntax maps the same original identities: 第二至第四行依次为
ok 11 - bounded range syntax maps the same original identities: 第二至第四行依次为
  ---
  duration_ms: 0.1718
  type: 'test'
  ...
# Subtest: bounded range syntax maps the same original identities: 第2-4行依次为
ok 12 - bounded range syntax maps the same original identities: 第2-4行依次为
  ---
  duration_ms: 0.2104
  type: 'test'
  ...
# Subtest: bounded range syntax maps the same original identities: 第2～4行依次为
ok 13 - bounded range syntax maps the same original identities: 第2～4行依次为
  ---
  duration_ms: 0.1357
  type: 'test'
  ...
# Subtest: recognized ambiguous interval is a completion gap, never a relative-order pass: 第0至2行依次为R301、R499、R102。
ok 14 - recognized ambiguous interval is a completion gap, never a relative-order pass: 第0至2行依次为R301、R499、R102。
  ---
  duration_ms: 0.5968
  type: 'test'
  ...
# Subtest: recognized ambiguous interval is a completion gap, never a relative-order pass: 第-1至1行依次为R301、R499、R102。
ok 15 - recognized ambiguous interval is a completion gap, never a relative-order pass: 第-1至1行依次为R301、R499、R102。
  ---
  duration_ms: 0.6273
  type: 'test'
  ...
# Subtest: recognized ambiguous interval is a completion gap, never a relative-order pass: 第1.5至3行依次为R301、R499。
ok 16 - recognized ambiguous interval is a completion gap, never a relative-order pass: 第1.5至3行依次为R301、R499。
  ---
  duration_ms: 0.5873
  type: 'test'
  ...
# Subtest: recognized ambiguous interval is a completion gap, never a relative-order pass: 第1000至1001行依次为R301、R499。
ok 17 - recognized ambiguous interval is a completion gap, never a relative-order pass: 第1000至1001行依次为R301、R499。
  ---
  duration_ms: 0.2345
  type: 'test'
  ...
# Subtest: recognized ambiguous interval is a completion gap, never a relative-order pass: 第十一至十三行依次为R301、R499、R102。
ok 18 - recognized ambiguous interval is a completion gap, never a relative-order pass: 第十一至十三行依次为R301、R499、R102。
  ---
  duration_ms: 0.18
  type: 'test'
  ...
# Subtest: recognized ambiguous interval is a completion gap, never a relative-order pass: 第4至2行依次为R301、R499、R102。
ok 19 - recognized ambiguous interval is a completion gap, never a relative-order pass: 第4至2行依次为R301、R499、R102。
  ---
  duration_ms: 0.4236
  type: 'test'
  ...
# Subtest: recognized ambiguous interval is a completion gap, never a relative-order pass: 第2至4行依次为R301、R499。
ok 20 - recognized ambiguous interval is a completion gap, never a relative-order pass: 第2至4行依次为R301、R499。
  ---
  duration_ms: 0.1622
  type: 'test'
  ...
# Subtest: recognized ambiguous interval is a completion gap, never a relative-order pass: 第2至4行依次为R301、R499、R499。
ok 21 - recognized ambiguous interval is a completion gap, never a relative-order pass: 第2至4行依次为R301、R499、R499。
  ---
  duration_ms: 0.1302
  type: 'test'
  ...
# Subtest: recognized ambiguous interval is a completion gap, never a relative-order pass: 第2至4行依次为设备甲、设备乙、设备丙。
ok 22 - recognized ambiguous interval is a completion gap, never a relative-order pass: 第2至4行依次为设备甲、设备乙、设备丙。
  ---
  duration_ms: 0.1295
  type: 'test'
  ...
# Subtest: recognized ambiguous interval is a completion gap, never a relative-order pass: 第2至4行依次为R301至R303。
ok 23 - recognized ambiguous interval is a completion gap, never a relative-order pass: 第2至4行依次为R301至R303。
  ---
  duration_ms: 0.3413
  type: 'test'
  ...
# Subtest: recognized ambiguous interval is a completion gap, never a relative-order pass: 第2至4行分别对应现场看到的设备。
ok 24 - recognized ambiguous interval is a completion gap, never a relative-order pass: 第2至4行分别对应现场看到的设备。
  ---
  duration_ms: 0.1438
  type: 'test'
  ...
# Subtest: at most 50 identities and explicit separate total remains separate
ok 25 - at most 50 identities and explicit separate total remains separate
  ---
  duration_ms: 0.5187
  type: 'test'
  ...
# Subtest: negative, conditional, historical or control text is not a positive position obligation: 不要求
ok 26 - negative, conditional, historical or control text is not a positive position obligation: 不要求
  ---
  duration_ms: 0.1374
  type: 'test'
  ...
# Subtest: negative, conditional, historical or control text is not a positive position obligation: 如果
ok 27 - negative, conditional, historical or control text is not a positive position obligation: 如果
  ---
  duration_ms: 0.0416
  type: 'test'
  ...
# Subtest: negative, conditional, historical or control text is not a positive position obligation: 例如
ok 28 - negative, conditional, historical or control text is not a positive position obligation: 例如
  ---
  duration_ms: 0.0313
  type: 'test'
  ...
# Subtest: negative, conditional, historical or control text is not a positive position obligation: 此前
ok 29 - negative, conditional, historical or control text is not a positive position obligation: 此前
  ---
  duration_ms: 0.0457
  type: 'test'
  ...
# Subtest: negative, conditional, historical or control text is not a positive position obligation: 操作前
ok 30 - negative, conditional, historical or control text is not a positive position obligation: 操作前
  ---
  duration_ms: 0.0392
  type: 'test'
  ...
# Subtest: negative, conditional, historical or control text is not a positive position obligation: 按钮显示
ok 31 - negative, conditional, historical or control text is not a positive position obligation: 按钮显示
  ---
  duration_ms: 0.0312
  type: 'test'
  ...
# Subtest: negative, conditional, historical or control text is not a positive position obligation: 标题说明
ok 32 - negative, conditional, historical or control text is not a positive position obligation: 标题说明
  ---
  duration_ms: 0.0299
  type: 'test'
  ...
# Subtest: range source grounding is immutable and cannot come from data or altered keys/ordinals
ok 33 - range source grounding is immutable and cannot come from data or altered keys/ordinals
  ---
  duration_ms: 0.6846
  type: 'test'
  ...
# Subtest: negative-looking field values do not erase a positive positional requirement
ok 34 - negative-looking field values do not erase a positive positional requirement
  ---
  duration_ms: 0.1543
  type: 'test'
  ...
1..34
# tests 34
# suites 0
# pass 34
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 73632.6954
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

v35范围绝对位置及数量边界34项交付重叠复检，301项受影响工程已执行；官方原V01尚未执行，不替代产品验收。
