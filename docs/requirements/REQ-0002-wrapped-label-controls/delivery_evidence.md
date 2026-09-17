# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-17T22:19:55+08:00`
- Record: `REQ-0002-wrapped-label-controls`
- Change fingerprint: `2338c67233c13140f6f013f286c87f01e6990b52123bb6a4312bf4623f6f61c3`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test tests/label-observation.test.mjs tests/query-capability.test.mjs`
- Exit code: `0`
- Test count: `13`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/REQ-0002-delivery.log`
- Log SHA-256: `61f046fecc5a2c432357ec6b052e3048b444bbd7060a8ad07b8b480e891d19fc`

### Git Status

```text
 M docs/modules/release_runtime.md
 M docs/requirements/README.md
 M src/browser.mjs
 M tests/query-capability.test.mjs
?? docs/requirements/REQ-0002-wrapped-label-controls/00_user_requirement.md
?? docs/requirements/REQ-0002-wrapped-label-controls/01_development_requirement.md
?? docs/requirements/REQ-0002-wrapped-label-controls/02_design.md
?? docs/requirements/REQ-0002-wrapped-label-controls/03_tasks.md
?? docs/requirements/REQ-0002-wrapped-label-controls/04_verification.md
?? docs/requirements/REQ-0002-wrapped-label-controls/05_trace.md
?? docs/requirements/REQ-0002-wrapped-label-controls/change_log.md
?? docs/requirements/REQ-0002-wrapped-label-controls/current_state.md
?? docs/requirements/REQ-0002-wrapped-label-controls/delivery_evidence.md
?? docs/requirements/REQ-0002-wrapped-label-controls/requirement.source.json
?? tests/label-observation.test.mjs
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/modules/release_runtime.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/browser.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/query-capability.test.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md |  2 ++
 docs/requirements/README.md     |  2 ++
 src/browser.mjs                 | 49 ++++++++++++++++++++++++++++++++++++-----
 tests/query-capability.test.mjs | 18 +++++++++++++--
 4 files changed, 63 insertions(+), 8 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0002-wrapped-label-controls/00_user_requirement.md
docs/requirements/REQ-0002-wrapped-label-controls/01_development_requirement.md
docs/requirements/REQ-0002-wrapped-label-controls/02_design.md
docs/requirements/REQ-0002-wrapped-label-controls/03_tasks.md
docs/requirements/REQ-0002-wrapped-label-controls/04_verification.md
docs/requirements/REQ-0002-wrapped-label-controls/05_trace.md
docs/requirements/REQ-0002-wrapped-label-controls/change_log.md
docs/requirements/REQ-0002-wrapped-label-controls/current_state.md
docs/requirements/REQ-0002-wrapped-label-controls/delivery_evidence.md
docs/requirements/REQ-0002-wrapped-label-controls/requirement.source.json
tests/label-observation.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-17T22:19:40+08:00
Command: node --test tests/label-observation.test.mjs tests/query-capability.test.mjs
Exit code: 0
Parsed test count: 13
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: id-free wrapped select exposes a stable field name and same-node locator
ok 1 - id-free wrapped select exposes a stable field name and same-node locator
  ---
  duration_ms: 882.3835
  type: 'test'
  ...
# {"labelText":"园区\\n全部\\n梧桐园","labelCount":0,"roleCount":1,"aria":"- combobox \\"园区\\":\\n  - option \\"全部\\" [selected]\\n  - option \\"梧桐园\\""}
# Subtest: unmapped and duplicate native fields report gaps instead of silently disappearing
ok 2 - unmapped and duplicate native fields report gaps instead of silently disappearing
  ---
  duration_ms: 747.1052
  type: 'test'
  ...
# Subtest: field hints cover explicit, ARIA, multiple-label, decoration and native listbox layouts
ok 3 - field hints cover explicit, ARIA, multiple-label, decoration and native listbox layouts
  ---
  duration_ms: 832.8415
  type: 'test'
  ...
# Subtest: custom adapters cannot rebind a field to another uniquely named native control
ok 4 - custom adapters cannot rebind a field to another uniquely named native control
  ---
  duration_ms: 757.1585
  type: 'test'
  ...
# Subtest: repair gaps do not expose sensitive input values or invite sensitive-field mapping
ok 5 - repair gaps do not expose sensitive input values or invite sensitive-field mapping
  ---
  duration_ms: 825.9356
  type: 'test'
  ...
# Subtest: query literals bind to the specific field and original action, never expected/page/model values
ok 6 - query literals bind to the specific field and original action, never expected/page/model values
  ---
  duration_ms: 3.4
  type: 'test'
  ...
# Subtest: Chromium provides field-bound query/select candidates without manual contracts and invalidates changed case
ok 7 - Chromium provides field-bound query/select candidates without manual contracts and invalidates changed case
  ---
  duration_ms: 3865.4598
  type: 'test'
  ...
# Subtest: query inference rejects save forms, sensitive fields, unapproved environments and scope changes
ok 8 - query inference rejects save forms, sensitive fields, unapproved environments and scope changes
  ---
  duration_ms: 3501.9553
  type: 'test'
  ...
# Subtest: wrapped native select offers and executes only the original field-bound query value
ok 9 - wrapped native select offers and executes only the original field-bound query value
  ---
  duration_ms: 2263.8842
  type: 'test'
  ...
# Subtest: query input cannot send autosave POST or trigger form submission
    # Subtest: network write
    ok 1 - network write
      ---
      duration_ms: 1652.652
      type: 'test'
      ...
    # Subtest: form submit
    ok 2 - form submit
      ---
      duration_ms: 1679.7095
      type: 'test'
      ...
    1..2
ok 10 - query input cannot send autosave POST or trigger form submission
  ---
  duration_ms: 3333.1871
  type: 'test'
  ...
# Subtest: dynamic row evidence contains observed schema/pattern, not invented future rows or success
ok 11 - dynamic row evidence contains observed schema/pattern, not invented future rows or success
  ---
  duration_ms: 1.2342
  type: 'test'
  ...
1..11
# tests 13
# suites 0
# pass 13
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 13552.1372
```

### Sync Record Status

```text
DRY-RUN: no derived changes for REQ-0002-wrapped-label-controls; explicit implementation states retained, never inferred from verification.
```

### Check AI Context

- Exit code: `0`

```text
PASS ai-engineering-context checks
```

### Notes

限定控件绑定验证；另有383项全量中的存储EPERM失败待后续包修复，见REQ-0002-runtime.log，不是发布通过。
