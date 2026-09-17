# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-18T02:24:18+08:00`
- Record: `REQ-0001-release-readiness`
- Change fingerprint: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test tests/release-integrity.test.mjs`
- Exit code: `0`
- Test count: `48`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/REQ-0001-candidate-integrity.log`
- Log SHA-256: `ae0b734a44c3a5ddf5cc0d05532ee497369bc34f9a59cfefd35321e92be38ba5`

### Git Status

```text
 M docs/requirements/REQ-0001-release-readiness/00_user_requirement.md
 M docs/requirements/REQ-0001-release-readiness/02_design.md
 M docs/requirements/REQ-0001-release-readiness/03_tasks.md
 M docs/requirements/REQ-0001-release-readiness/04_verification.md
 M docs/requirements/REQ-0001-release-readiness/05_trace.md
 M docs/requirements/REQ-0001-release-readiness/current_state.md
 M docs/requirements/REQ-0001-release-readiness/delivery_evidence.md
 M docs/requirements/REQ-0001-release-readiness/requirement.source.json
?? docs/requirements/REQ-0001-release-readiness/candidate-check.md
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/requirements/REQ-0001-release-readiness/00_user_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0001-release-readiness/02_design.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0001-release-readiness/03_tasks.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0001-release-readiness/04_verification.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0001-release-readiness/05_trace.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0001-release-readiness/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0001-release-readiness/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0001-release-readiness/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
 .../00_user_requirement.md                         |   5 +
 .../REQ-0001-release-readiness/02_design.md        |   2 +
 .../REQ-0001-release-readiness/03_tasks.md         |   2 +-
 .../REQ-0001-release-readiness/04_verification.md  |   5 +-
 .../REQ-0001-release-readiness/05_trace.md         |   4 +-
 .../REQ-0001-release-readiness/current_state.md    |   4 +-
 .../delivery_evidence.md                           | 347 +++++++++++++++++----
 .../requirement.source.json                        |  38 ++-
 8 files changed, 333 insertions(+), 74 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0001-release-readiness/candidate-check.md
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-18T02:24:12+08:00
Command: node --test tests/release-integrity.test.mjs
Exit code: 0
Parsed test count: 48
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: complete real candidate verifies every delivered file, including the handbook
ok 1 - complete real candidate verifies every delivered file, including the handbook
  ---
  duration_ms: 786.4959
  type: 'test'
  ...
# Subtest: handbook changes do not change runtime identity but must fail candidate inspection
ok 2 - handbook changes do not change runtime identity but must fail candidate inspection
  ---
  duration_ms: 528.2365
  type: 'test'
  ...
# Subtest: a missing listed handbook is not silently treated as a source checkout
ok 3 - a missing listed handbook is not silently treated as a source checkout
  ---
  duration_ms: 541.6248
  type: 'test'
  ...
# Subtest: source checkout without a release manifest retains the non-candidate path
ok 4 - source checkout without a release manifest retains the non-candidate path
  ---
  duration_ms: 518.0317
  type: 'test'
  ...
# Subtest: runtime mutation or added runtime file cannot keep the old candidate identity
    # Subtest: src/nested/runtime.mjs
    ok 1 - src/nested/runtime.mjs
      ---
      duration_ms: 36.5357
      type: 'test'
      ...
    # Subtest: src/extra.mjs
    ok 2 - src/extra.mjs
      ---
      duration_ms: 31.0691
      type: 'test'
      ...
    1..2
ok 5 - runtime mutation or added runtime file cannot keep the old candidate identity
  ---
  duration_ms: 68.2497
  type: 'test'
  ...
# Subtest: manifest metadata and exact inventory are checked before reading listed paths
    # Subtest: null manifest
    ok 1 - null manifest
      ---
      duration_ms: 0.5824
      type: 'test'
      ...
    # Subtest: array manifest
    ok 2 - array manifest
      ---
      duration_ms: 0.1881
      type: 'test'
      ...
    # Subtest: wrong schema
    ok 3 - wrong schema
      ---
      duration_ms: 0.1513
      type: 'test'
      ...
    # Subtest: wrong application
    ok 4 - wrong application
      ---
      duration_ms: 0.1244
      type: 'test'
      ...
    # Subtest: wrong version
    ok 5 - wrong version
      ---
      duration_ms: 0.2486
      type: 'test'
      ...
    # Subtest: wrong build
    ok 6 - wrong build
      ---
      duration_ms: 0.1132
      type: 'test'
      ...
    # Subtest: wrong release status
    ok 7 - wrong release status
      ---
      duration_ms: 0.0963
      type: 'test'
      ...
    # Subtest: missing files
    ok 8 - missing files
      ---
      duration_ms: 0.0896
      type: 'test'
      ...
    # Subtest: files object
    ok 9 - files object
      ---
      duration_ms: 0.1812
      type: 'test'
      ...
    # Subtest: missing entry
    ok 10 - missing entry
      ---
      duration_ms: 0.1139
      type: 'test'
      ...
    # Subtest: extra entry
    ok 11 - extra entry
      ---
      duration_ms: 0.1007
      type: 'test'
      ...
    # Subtest: duplicate replaces required entry
    ok 12 - duplicate replaces required entry
      ---
      duration_ms: 0.1039
      type: 'test'
      ...
    # Subtest: null entry
    ok 13 - null entry
      ---
      duration_ms: 0.0885
      type: 'test'
      ...
    # Subtest: non-string path
    ok 14 - non-string path
      ---
      duration_ms: 0.0799
      type: 'test'
      ...
    # Subtest: missing hash
    ok 15 - missing hash
      ---
      duration_ms: 0.0865
      type: 'test'
      ...
    # Subtest: non-string hash
    ok 16 - non-string hash
      ---
      duration_ms: 0.0834
      type: 'test'
      ...
    # Subtest: invalid hash
    ok 17 - invalid hash
      ---
      duration_ms: 0.0702
      type: 'test'
      ...
    # Subtest: unsafe or unlisted path "../outside.txt"
    ok 18 - unsafe or unlisted path "../outside.txt"
      ---
      duration_ms: 0.0755
      type: 'test'
      ...
    # Subtest: unsafe or unlisted path "/outside.txt"
    ok 19 - unsafe or unlisted path "/outside.txt"
      ---
      duration_ms: 0.0697
      type: 'test'
      ...
    # Subtest: unsafe or unlisted path "C:/outside.txt"
    ok 20 - unsafe or unlisted path "C:/outside.txt"
      ---
      duration_ms: 0.0638
      type: 'test'
      ...
    # Subtest: unsafe or unlisted path "C:outside.txt"
    ok 21 - unsafe or unlisted path "C:outside.txt"
      ---
      duration_ms: 0.0517
      type: 'test'
      ...
    # Subtest: unsafe or unlisted path "\\\\\\\\server\\\\outside.txt"
    ok 22 - unsafe or unlisted path "\\\\\\\\server\\\\outside.txt"
      ---
      duration_ms: 0.0574
      type: 'test'
      ...
    # Subtest: unsafe or unlisted path "src\\\\nested\\\\runtime.mjs"
    ok 23 - unsafe or unlisted path "src\\\\nested\\\\runtime.mjs"
      ---
      duration_ms: 0.1074
      type: 'test'
      ...
    # Subtest: unsafe or unlisted path "./package.json"
    ok 24 - unsafe or unlisted path "./package.json"
      ---
      duration_ms: 0.0695
      type: 'test'
      ...
    # Subtest: unsafe or unlisted path "src/../package.json"
    ok 25 - unsafe or unlisted path "src/../package.json"
      ---
      duration_ms: 0.0564
      type: 'test'
      ...
    # Subtest: unsafe or unlisted path "src//nested/runtime.mjs"
    ok 26 - unsafe or unlisted path "src//nested/runtime.mjs"
      ---
      duration_ms: 0.0555
      type: 'test'
      ...
    # Subtest: unsafe or unlisted path "package.json/"
    ok 27 - unsafe or unlisted path "package.json/"
      ---
      duration_ms: 0.0547
      type: 'test'
      ...
    # Subtest: unsafe or unlisted path "package.json:stream"
    ok 28 - unsafe or unlisted path "package.json:stream"
      ---
      duration_ms: 0.0745
      type: 'test'
      ...
    # Subtest: unsafe or unlisted path "data/private.json"
    ok 29 - unsafe or unlisted path "data/private.json"
      ---
      duration_ms: 0.1838
      type: 'test'
      ...
    # Subtest: unsafe or unlisted path "package.json\\u0000"
    ok 30 - unsafe or unlisted path "package.json\\u0000"
      ---
      duration_ms: 0.0666
      type: 'test'
      ...
    1..30
ok 6 - manifest metadata and exact inventory are checked before reading listed paths
  ---
  duration_ms: 33.6614
  type: 'test'
  ...
# Subtest: well-formed but incorrect manifest digest is compared to actual bytes
ok 7 - well-formed but incorrect manifest digest is compared to actual bytes
  ---
  duration_ms: 23.0768
  type: 'test'
  ...
# Subtest: inventory order is irrelevant and unshipped private files are not inspected
ok 8 - inventory order is irrelevant and unshipped private files are not inspected
  ---
  duration_ms: 25.5702
  type: 'test'
  ...
# Subtest: non-file and linked delivered paths are rejected even when content would match
    # Subtest: directory handbook
    ok 1 - directory handbook
      ---
      duration_ms: 22.3041
      type: 'test'
      ...
    # Subtest: linked handbook
    ok 2 - linked handbook
      ---
      duration_ms: 22.1431
      type: 'test'
      ...
    # Subtest: linked runtime directory
    ok 3 - linked runtime directory
      ---
      duration_ms: 23.9847
      type: 'test'
      ...
    1..3
ok 9 - non-file and linked delivered paths are rejected even when content would match
  ---
  duration_ms: 68.9677
  type: 'test'
  ...
# Subtest: malformed, directory or linked manifest is not a source checkout
    # Subtest: malformed
    ok 1 - malformed
      ---
      duration_ms: 573.7753
      type: 'test'
      ...
    # Subtest: directory
    ok 2 - directory
      ---
      duration_ms: 543.1917
      type: 'test'
      ...
    # Subtest: linked
    ok 3 - linked
      ---
      duration_ms: 549.725
      type: 'test'
      ...
    1..3
ok 10 - malformed, directory or linked manifest is not a source checkout
  ---
  duration_ms: 1667.3113
  type: 'test'
  ...
1..10
# tests 48
# suites 0
# pass 48
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 4369.3842
```

### Sync Record Status

```text
DRY-RUN: no derived changes for REQ-0001-release-readiness; explicit implementation states retained, never inferred from verification.
```

### Check AI Context

- Exit code: `0`

```text
PASS ai-engineering-context checks
```

### Notes

Only candidate integrity regression and current 9b7f package evidence; full runtime unchanged, no real model, shared dependencies, overall release gates pending.
