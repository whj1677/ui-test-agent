# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-18T01:31:24+08:00`
- Record: `REQ-0010-candidate-file-integrity`
- Change fingerprint: `8391385fdb2b82302a83fa47c3dc05a32be3fad44cc0414ed21b7291553d8a6f`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test tests/release-integrity.test.mjs tests/installation.test.mjs`
- Exit code: `0`
- Test count: `53`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/REQ-0010-delivery.log`
- Log SHA-256: `afe0d71f01b446ce443994b5a1b52a1cf72c286661d0efb41fb03a09c0a0da29`

### Git Status

```text
 M docs/modules/release_runtime.md
 M docs/requirements/README.md
 M src/distribution.mjs
 M src/installation.mjs
?? docs/requirements/REQ-0010-candidate-file-integrity/00_user_requirement.md
?? docs/requirements/REQ-0010-candidate-file-integrity/01_development_requirement.md
?? docs/requirements/REQ-0010-candidate-file-integrity/02_design.md
?? docs/requirements/REQ-0010-candidate-file-integrity/03_tasks.md
?? docs/requirements/REQ-0010-candidate-file-integrity/04_verification.md
?? docs/requirements/REQ-0010-candidate-file-integrity/05_trace.md
?? docs/requirements/REQ-0010-candidate-file-integrity/change_log.md
?? docs/requirements/REQ-0010-candidate-file-integrity/current_state.md
?? docs/requirements/REQ-0010-candidate-file-integrity/delivery_evidence.md
?? docs/requirements/REQ-0010-candidate-file-integrity/requirement.source.json
?? tests/release-integrity.test.mjs
?? tests/release-package.integration.mjs
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/modules/release_runtime.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/distribution.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/installation.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md |  2 ++
 docs/requirements/README.md     |  2 ++
 src/distribution.mjs            | 58 ++++++++++++++++++++++++++++++++++++++++-
 src/installation.mjs            |  9 +++++--
 4 files changed, 68 insertions(+), 3 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0010-candidate-file-integrity/00_user_requirement.md
docs/requirements/REQ-0010-candidate-file-integrity/01_development_requirement.md
docs/requirements/REQ-0010-candidate-file-integrity/02_design.md
docs/requirements/REQ-0010-candidate-file-integrity/03_tasks.md
docs/requirements/REQ-0010-candidate-file-integrity/04_verification.md
docs/requirements/REQ-0010-candidate-file-integrity/05_trace.md
docs/requirements/REQ-0010-candidate-file-integrity/change_log.md
docs/requirements/REQ-0010-candidate-file-integrity/current_state.md
docs/requirements/REQ-0010-candidate-file-integrity/delivery_evidence.md
docs/requirements/REQ-0010-candidate-file-integrity/requirement.source.json
tests/release-integrity.test.mjs
tests/release-package.integration.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-18T01:31:18+08:00
Command: node --test tests/release-integrity.test.mjs tests/installation.test.mjs
Exit code: 0
Parsed test count: 53
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: explicit recovery refuses a live writer and preserves its lock
ok 1 - explicit recovery refuses a live writer and preserves its lock
  ---
  duration_ms: 26.1146
  type: 'test'
  ...
# Subtest: actual crashed process requires explicit recovery; restarted store retains cross-task hold
ok 2 - actual crashed process requires explicit recovery; restarted store retains cross-task hold
  ---
  duration_ms: 168.477
  type: 'test'
  ...
# Subtest: unverifiable lock and incomplete maintenance refuse startup or recovery
ok 3 - unverifiable lock and incomplete maintenance refuse startup or recovery
  ---
  duration_ms: 13.445
  type: 'test'
  ...
# Subtest: stopped backup preserves content hashes and cleanup history; active or nested backup is refused
ok 4 - stopped backup preserves content hashes and cleanup history; active or nested backup is refused
  ---
  duration_ms: 38.1409
  type: 'test'
  ...
# Subtest: candidate is allowlisted, has the same build, and excludes private data and paused optimization
ok 5 - candidate is allowlisted, has the same build, and excludes private data and paused optimization
  ---
  duration_ms: 482.5029
  type: 'test'
  ...
# Subtest: complete real candidate verifies every delivered file, including the handbook
ok 6 - complete real candidate verifies every delivered file, including the handbook
  ---
  duration_ms: 897.3263
  type: 'test'
  ...
# Subtest: handbook changes do not change runtime identity but must fail candidate inspection
ok 7 - handbook changes do not change runtime identity but must fail candidate inspection
  ---
  duration_ms: 573.7741
  type: 'test'
  ...
# Subtest: a missing listed handbook is not silently treated as a source checkout
ok 8 - a missing listed handbook is not silently treated as a source checkout
  ---
  duration_ms: 536.8637
  type: 'test'
  ...
# Subtest: source checkout without a release manifest retains the non-candidate path
ok 9 - source checkout without a release manifest retains the non-candidate path
  ---
  duration_ms: 507.4833
  type: 'test'
  ...
# Subtest: runtime mutation or added runtime file cannot keep the old candidate identity
    # Subtest: src/nested/runtime.mjs
    ok 1 - src/nested/runtime.mjs
      ---
      duration_ms: 30.4031
      type: 'test'
      ...
    # Subtest: src/extra.mjs
    ok 2 - src/extra.mjs
      ---
      duration_ms: 24.4483
      type: 'test'
      ...
    1..2
ok 10 - runtime mutation or added runtime file cannot keep the old candidate identity
  ---
  duration_ms: 55.4624
  type: 'test'
  ...
# Subtest: manifest metadata and exact inventory are checked before reading listed paths
    # Subtest: null manifest
    ok 1 - null manifest
      ---
      duration_ms: 0.5191
      type: 'test'
      ...
    # Subtest: array manifest
    ok 2 - array manifest
      ---
      duration_ms: 0.1831
      type: 'test'
      ...
    # Subtest: wrong schema
    ok 3 - wrong schema
      ---
      duration_ms: 0.166
      type: 'test'
      ...
    # Subtest: wrong application
    ok 4 - wrong application
      ---
      duration_ms: 0.1127
      type: 'test'
      ...
    # Subtest: wrong version
    ok 5 - wrong version
      ---
      duration_ms: 0.2442
      type: 'test'
      ...
    # Subtest: wrong build
    ok 6 - wrong build
      ---
      duration_ms: 0.1272
      type: 'test'
      ...
    # Subtest: wrong release status
    ok 7 - wrong release status
      ---
      duration_ms: 0.0973
      type: 'test'
      ...
    # Subtest: missing files
    ok 8 - missing files
      ---
      duration_ms: 0.0893
      type: 'test'
      ...
    # Subtest: files object
    ok 9 - files object
      ---
      duration_ms: 0.1764
      type: 'test'
      ...
    # Subtest: missing entry
    ok 10 - missing entry
      ---
      duration_ms: 0.1136
      type: 'test'
      ...
    # Subtest: extra entry
    ok 11 - extra entry
      ---
      duration_ms: 0.0909
      type: 'test'
      ...
    # Subtest: duplicate replaces required entry
    ok 12 - duplicate replaces required entry
      ---
      duration_ms: 0.0948
      type: 'test'
      ...
    # Subtest: null entry
    ok 13 - null entry
      ---
      duration_ms: 0.076
      type: 'test'
      ...
    # Subtest: non-string path
    ok 14 - non-string path
      ---
      duration_ms: 0.0716
      type: 'test'
      ...
    # Subtest: missing hash
    ok 15 - missing hash
      ---
      duration_ms: 0.0749
      type: 'test'
      ...
    # Subtest: non-string hash
    ok 16 - non-string hash
      ---
      duration_ms: 0.0701
      type: 'test'
      ...
    # Subtest: invalid hash
    ok 17 - invalid hash
      ---
      duration_ms: 0.066
      type: 'test'
      ...
    # Subtest: unsafe or unlisted path "../outside.txt"
    ok 18 - unsafe or unlisted path "../outside.txt"
      ---
      duration_ms: 0.0733
      type: 'test'
      ...
    # Subtest: unsafe or unlisted path "/outside.txt"
    ok 19 - unsafe or unlisted path "/outside.txt"
      ---
      duration_ms: 0.0632
      type: 'test'
      ...
    # Subtest: unsafe or unlisted path "C:/outside.txt"
    ok 20 - unsafe or unlisted path "C:/outside.txt"
      ---
      duration_ms: 0.0569
      type: 'test'
      ...
    # Subtest: unsafe or unlisted path "C:outside.txt"
    ok 21 - unsafe or unlisted path "C:outside.txt"
      ---
      duration_ms: 0.0723
      type: 'test'
      ...
    # Subtest: unsafe or unlisted path "\\\\\\\\server\\\\outside.txt"
    ok 22 - unsafe or unlisted path "\\\\\\\\server\\\\outside.txt"
      ---
      duration_ms: 0.0575
      type: 'test'
      ...
    # Subtest: unsafe or unlisted path "src\\\\nested\\\\runtime.mjs"
    ok 23 - unsafe or unlisted path "src\\\\nested\\\\runtime.mjs"
      ---
      duration_ms: 0.1065
      type: 'test'
      ...
    # Subtest: unsafe or unlisted path "./package.json"
    ok 24 - unsafe or unlisted path "./package.json"
      ---
      duration_ms: 0.0699
      type: 'test'
      ...
    # Subtest: unsafe or unlisted path "src/../package.json"
    ok 25 - unsafe or unlisted path "src/../package.json"
      ---
      duration_ms: 0.0603
      type: 'test'
      ...
    # Subtest: unsafe or unlisted path "src//nested/runtime.mjs"
    ok 26 - unsafe or unlisted path "src//nested/runtime.mjs"
      ---
      duration_ms: 0.0586
      type: 'test'
      ...
    # Subtest: unsafe or unlisted path "package.json/"
    ok 27 - unsafe or unlisted path "package.json/"
      ---
      duration_ms: 0.0535
      type: 'test'
      ...
    # Subtest: unsafe or unlisted path "package.json:stream"
    ok 28 - unsafe or unlisted path "package.json:stream"
      ---
      duration_ms: 0.0594
      type: 'test'
      ...
    # Subtest: unsafe or unlisted path "data/private.json"
    ok 29 - unsafe or unlisted path "data/private.json"
      ---
      duration_ms: 0.0979
      type: 'test'
      ...
    # Subtest: unsafe or unlisted path "package.json\\u0000"
    ok 30 - unsafe or unlisted path "package.json\\u0000"
      ---
      duration_ms: 0.0585
      type: 'test'
      ...
    1..30
ok 11 - manifest metadata and exact inventory are checked before reading listed paths
  ---
  duration_ms: 29.3381
  type: 'test'
  ...
# Subtest: well-formed but incorrect manifest digest is compared to actual bytes
ok 12 - well-formed but incorrect manifest digest is compared to actual bytes
  ---
  duration_ms: 20.2111
  type: 'test'
  ...
# Subtest: inventory order is irrelevant and unshipped private files are not inspected
ok 13 - inventory order is irrelevant and unshipped private files are not inspected
  ---
  duration_ms: 24.827
  type: 'test'
  ...
# Subtest: non-file and linked delivered paths are rejected even when content would match
    # Subtest: directory handbook
    ok 1 - directory handbook
      ---
      duration_ms: 20.0823
      type: 'test'
      ...
    # Subtest: linked handbook
    ok 2 - linked handbook
      ---
      duration_ms: 18.2314
      type: 'test'
      ...
    # Subtest: linked runtime directory
    ok 3 - linked runtime directory
      ---
      duration_ms: 18.0371
      type: 'test'
      ...
    1..3
ok 14 - non-file and linked delivered paths are rejected even when content would match
  ---
  duration_ms: 56.8906
  type: 'test'
  ...
# Subtest: malformed, directory or linked manifest is not a source checkout
    # Subtest: malformed
    ok 1 - malformed
      ---
      duration_ms: 486.9605
      type: 'test'
      ...
    # Subtest: directory
    ok 2 - directory
      ---
      duration_ms: 508.8696
      type: 'test'
      ...
    # Subtest: linked
    ok 3 - linked
      ---
      duration_ms: 529.2032
      type: 'test'
      ...
    1..3
ok 15 - malformed, directory or linked manifest is not a source checkout
  ---
  duration_ms: 1525.5407
  type: 'test'
  ...
1..15
# tests 53
# suites 0
# pass 53
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 4359.3254
```

### Sync Record Status

```text
DRY-RUN: no derived changes for REQ-0010-candidate-file-integrity; explicit implementation states retained, never inferred from verification.
```

### Check AI Context

- Exit code: `0`

```text
PASS ai-engineering-context checks
```

### Notes

53项包含于564项程序回归；同版候选本机独立目录安装和包内5次命令已执行，非干净Windows/真实模型/最终发布。旧服务和冻结资产未改。
