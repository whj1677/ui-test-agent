# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-20T04:50:17+08:00`
- Record: `REQ-0017-controlled-react`
- Change fingerprint: `5f39f785143d9f2e50ef19f2f571d5148d708bf928493ba2d0781116e04b4e89`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test --test-concurrency=2 tests/heldout-lab.test.mjs tests/autonomous-lab.test.mjs heldout-lab/reference.test.mjs`
- Exit code: `0`
- Test count: `25`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/req0017/v21-delivery.log`
- Log SHA-256: `1b6c00ac1b9d7f32ea45ea713b0080482ab83f17ea6c1559002c4f2dde271bfe`

### Git Status

```text
 M .gitattributes
 M docs/modules/release_runtime.md
 M docs/requirements/REQ-0017-controlled-react/00_user_requirement.md
 M docs/requirements/REQ-0017-controlled-react/02_design.md
 M docs/requirements/REQ-0017-controlled-react/03_tasks.md
 M docs/requirements/REQ-0017-controlled-react/04_verification.md
 M docs/requirements/REQ-0017-controlled-react/05_trace.md
 M docs/requirements/REQ-0017-controlled-react/current_state.md
 M docs/requirements/REQ-0017-controlled-react/delivery_evidence.md
 M docs/requirements/REQ-0017-controlled-react/real-model-v20-result.md
 M docs/requirements/REQ-0017-controlled-react/requirement.source.json
 M scripts/autonomous-lab.mjs
?? docs/requirements/REQ-0017-controlled-react/real-model-v21-heldout.md
?? heldout-lab/README.md
?? heldout-lab/cases.json
?? heldout-lab/index.html
?? heldout-lab/manifest.json
?? heldout-lab/oracle.json
?? heldout-lab/reference.test.mjs
?? heldout-lab/serve.mjs
?? scripts/heldout-fixture.mjs
?? tests/heldout-lab.test.mjs
```

### Git Diff Stat

```text
warning: in the working copy of '.gitattributes', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/modules/release_runtime.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/00_user_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/02_design.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/03_tasks.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/04_verification.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/05_trace.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/real-model-v20-result.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'scripts/autonomous-lab.mjs', LF will be replaced by CRLF the next time Git touches it
 .gitattributes                                     |   1 +
 docs/modules/release_runtime.md                    |   4 +
 .../00_user_requirement.md                         |   2 +
 .../REQ-0017-controlled-react/02_design.md         |   2 +-
 .../REQ-0017-controlled-react/03_tasks.md          |   2 +-
 .../REQ-0017-controlled-react/04_verification.md   |   2 +-
 .../REQ-0017-controlled-react/05_trace.md          |   2 +-
 .../REQ-0017-controlled-react/current_state.md     |   8 +-
 .../REQ-0017-controlled-react/delivery_evidence.md | 235 +++++++++++----------
 .../real-model-v20-result.md                       |   8 +-
 .../requirement.source.json                        |  16 +-
 scripts/autonomous-lab.mjs                         | 102 ++++++---
 12 files changed, 228 insertions(+), 156 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0017-controlled-react/real-model-v21-heldout.md
heldout-lab/README.md
heldout-lab/cases.json
heldout-lab/index.html
heldout-lab/manifest.json
heldout-lab/oracle.json
heldout-lab/reference.test.mjs
heldout-lab/serve.mjs
scripts/heldout-fixture.mjs
tests/heldout-lab.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-20T04:49:55+08:00
Command: node --test --test-concurrency=2 tests/heldout-lab.test.mjs tests/autonomous-lab.test.mjs heldout-lab/reference.test.mjs
Exit code: 0
Parsed test count: 25
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: complete seed identity, power total, duplicate names and fresh-context isolation
ok 1 - complete seed identity, power total, duplicate names and fresh-context isolation
  ---
  duration_ms: 1552.7101
  type: 'test'
  ...
# Subtest: browser back/forward recomputes route-specific defects without stale view state
ok 2 - browser back/forward recomputes route-specific defects without stale view state
  ---
  duration_ms: 696.1342
  type: 'test'
  ...
# Subtest: direct q1: verify independent normative data and intended contrast
ok 3 - direct q1: verify independent normative data and intended contrast
  ---
  duration_ms: 616.9618
  type: 'test'
  ...
# Subtest: direct q2: verify independent normative data and intended contrast
ok 4 - direct q2: verify independent normative data and intended contrast
  ---
  duration_ms: 613.853
  type: 'test'
  ...
# Subtest: direct f1: verify independent normative data and intended contrast
ok 5 - direct f1: verify independent normative data and intended contrast
  ---
  duration_ms: 1510.7299
  type: 'test'
  ...
# Subtest: direct f2: verify independent normative data and intended contrast
ok 6 - direct f2: verify independent normative data and intended contrast
  ---
  duration_ms: 1515.1633
  type: 'test'
  ...
# Subtest: direct m1: verify independent normative data and intended contrast
ok 7 - direct m1: verify independent normative data and intended contrast
  ---
  duration_ms: 1551.5998
  type: 'test'
  ...
# Subtest: direct m2: verify independent normative data and intended contrast
ok 8 - direct m2: verify independent normative data and intended contrast
  ---
  duration_ms: 1558.7382
  type: 'test'
  ...
# Subtest: direct s1: verify independent normative data and intended contrast
ok 9 - direct s1: verify independent normative data and intended contrast
  ---
  duration_ms: 620.8178
  type: 'test'
  ...
# Subtest: direct s2: verify independent normative data and intended contrast
ok 10 - direct s2: verify independent normative data and intended contrast
  ---
  duration_ms: 631.9991
  type: 'test'
  ...
# Subtest: menu q1: verify independent normative data and intended contrast
ok 11 - menu q1: verify independent normative data and intended contrast
  ---
  duration_ms: 693.9374
  type: 'test'
  ...
# Subtest: menu q2: verify independent normative data and intended contrast
ok 12 - menu q2: verify independent normative data and intended contrast
  ---
  duration_ms: 667.6951
  type: 'test'
  ...
# Subtest: menu f1: verify independent normative data and intended contrast
ok 13 - menu f1: verify independent normative data and intended contrast
  ---
  duration_ms: 1522.5783
  type: 'test'
  ...
# Subtest: menu f2: verify independent normative data and intended contrast
ok 14 - menu f2: verify independent normative data and intended contrast
  ---
  duration_ms: 1500.6805
  type: 'test'
  ...
# Subtest: menu m1: verify independent normative data and intended contrast
ok 15 - menu m1: verify independent normative data and intended contrast
  ---
  duration_ms: 2084.9406
  type: 'test'
  ...
# Subtest: menu m2: verify independent normative data and intended contrast
ok 16 - menu m2: verify independent normative data and intended contrast
  ---
  duration_ms: 1537.1154
  type: 'test'
  ...
# Subtest: menu s1: verify independent normative data and intended contrast
ok 17 - menu s1: verify independent normative data and intended contrast
  ---
  duration_ms: 591.3294
  type: 'test'
  ...
# Subtest: menu s2: verify independent normative data and intended contrast
ok 18 - menu s2: verify independent normative data and intended contrast
  ---
  duration_ms: 600.1085
  type: 'test'
  ...
# Subtest: shared round call/time budget never resets between jobs and counts failed requests
ok 19 - shared round call/time budget never resets between jobs and counts failed requests
  ---
  duration_ms: 1.8502
  type: 'test'
  ...
# Subtest: autonomous preflight checks the frozen 32 cases without creating sessions or calling a model
ok 20 - autonomous preflight checks the frozen 32 cases without creating sessions or calling a model
  ---
  duration_ms: 19.4668
  type: 'test'
  ...
# Subtest: bounded selection retains original suite order and rejects missing/duplicate IDs
ok 21 - bounded selection retains original suite order and rejects missing/duplicate IDs
  ---
  duration_ms: 55.8283
  type: 'test'
  ...
# {"group":"heldout","calls":1,"results":[{"case_id":"HOLD-F1","status":"NEEDS_MAPPING","reason":null,"attempts":0}]}
# Subtest: isolated heldout harness authenticates without credentials and never passes offline oracle
ok 22 - isolated heldout harness authenticates without credentials and never passes offline oracle
  ---
  duration_ms: 1524.708
  type: 'test'
  ...
# Subtest: independent frozen cases import unchanged and stay separate from original32
ok 23 - independent frozen cases import unchanged and stay separate from original32
  ---
  duration_ms: 32.7029
  type: 'test'
  ...
# Subtest: served fixture permits HTML only, blocks oracle/source/writes, and verifies reuse
ok 24 - served fixture permits HTML only, blocks oracle/source/writes, and verifies reuse
  ---
  duration_ms: 66.8717
  type: 'test'
  ...
# Subtest: unrelated service on selected port cannot be accepted as synthetic fixture
ok 25 - unrelated service on selected port cannot be accepted as synthetic fixture
  ---
  duration_ms: 11.5104
  type: 'test'
  ...
1..25
# tests 25
# suites 0
# pass 25
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 21020.3811
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

独立留出冻结及维护编排参考/工程验证，真实模型待验；不改产品运行源码或原32流程
