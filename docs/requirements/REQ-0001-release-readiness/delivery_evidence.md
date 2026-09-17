# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-18T01:42:00+08:00`
- Record: `REQ-0001-release-readiness`
- Change fingerprint: `a0fe9b0671b0afc734bd4687bde957b6900233ba841fa6d5dec1e4de54d537bf`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test tests/release-upgrade.integration.mjs`
- Exit code: `0`
- Test count: `14`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/REQ-0001-upgrade-final.log`
- Log SHA-256: `807f80b5cff9f86b4a6ff37a0f9ea30223f03ce9db0b4fa9510fcf68b3f9fa26`

### Git Status

```text
 M docs/requirements/REQ-0001-release-readiness/00_user_requirement.md
 M docs/requirements/REQ-0001-release-readiness/02_design.md
 M docs/requirements/REQ-0001-release-readiness/03_tasks.md
 M docs/requirements/REQ-0001-release-readiness/04_verification.md
 M docs/requirements/REQ-0001-release-readiness/05_trace.md
 M docs/requirements/REQ-0001-release-readiness/change_log.md
 M docs/requirements/REQ-0001-release-readiness/current_state.md
 M docs/requirements/REQ-0001-release-readiness/delivery_evidence.md
 M docs/requirements/REQ-0001-release-readiness/requirement.source.json
?? tests/release-upgrade.integration.mjs
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/requirements/REQ-0001-release-readiness/00_user_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0001-release-readiness/02_design.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0001-release-readiness/03_tasks.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0001-release-readiness/04_verification.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0001-release-readiness/05_trace.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0001-release-readiness/change_log.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0001-release-readiness/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0001-release-readiness/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0001-release-readiness/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
 .../00_user_requirement.md                         |   5 +
 .../REQ-0001-release-readiness/02_design.md        |   2 +
 .../REQ-0001-release-readiness/03_tasks.md         |   2 +-
 .../REQ-0001-release-readiness/04_verification.md  |   4 +-
 .../REQ-0001-release-readiness/05_trace.md         |   2 +
 .../REQ-0001-release-readiness/change_log.md       |   2 +
 .../REQ-0001-release-readiness/current_state.md    |   4 +-
 .../delivery_evidence.md                           | 143 ++++++++++++++++-----
 .../requirement.source.json                        |  51 +++++++-
 9 files changed, 171 insertions(+), 44 deletions(-)
```

### Untracked Files

```text
tests/release-upgrade.integration.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-18T01:41:58+08:00
Command: node --test tests/release-upgrade.integration.mjs
Exit code: 0
Parsed test count: 14
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: real 0.3.0 8101158 backup, upgrade and rollback
    # Subtest: live source cannot be backed up; stopped backup matches every original byte
    ok 1 - live source cannot be backed up; stopped backup matches every original byte
      ---
      duration_ms: 103.1136
      type: 'test'
      ...
    # Subtest: new runtime preserves original cases, confirmations, approval hashes and sealed history
    ok 2 - new runtime preserves original cases, confirmations, approval hashes and sealed history
      ---
      duration_ms: 61.7245
      type: 'test'
      ...
    # Subtest: interrupted mutation stays pending, cannot be replayed and adds only recovery state
    ok 3 - interrupted mutation stays pending, cannot be replayed and adds only recovery state
      ---
      duration_ms: 4.727
      type: 'test'
      ...
    # Subtest: upgrade does not restore authentication or bypass same-site cleanup holds
    ok 4 - upgrade does not restore authentication or bypass same-site cleanup holds
      ---
      duration_ms: 35.2301
      type: 'test'
      ...
    # Subtest: new-version output is archived separately and never merged into old source
    ok 5 - new-version output is archived separately and never merged into old source
      ---
      duration_ms: 86.8964
      type: 'test'
      ...
    # Subtest: actual old runtime reopens its pre-upgrade backup, not the newer data structure
    ok 6 - actual old runtime reopens its pre-upgrade backup, not the newer data structure
      ---
      duration_ms: 44.9605
      type: 'test'
      ...
# {"directory":"D:\\\\01_AI工程\\\\01_工程项目\\\\ui-test-agent\\\\validation\\\\upgrade-Ca9izp","ref":"8101158a6b015feaf1c599a0a8c7a7d8681cdf38","checks":["stopped backup and no-merge copy","legacy state, approvals and sealed history preserved","interruption recovered once without replay or history changes","authentication required and persistent same-site hold enforced","new output archived separately; rollback uses pre-upgrade data","old runtime restored without rewriting original or upgraded records"],"current_build":"14c2bda0aa6a35ad84495c36ae9ebc46faa8c5a931238b1528a3178b5748843e","preserved_source_files":14}
    1..6
ok 1 - real 0.3.0 8101158 backup, upgrade and rollback
  ---
  duration_ms: 656.987
  type: 'test'
  ...
# Subtest: real 0.4.0-beta.1 d1e6fbb backup, upgrade and rollback
    # Subtest: live source cannot be backed up; stopped backup matches every original byte
    ok 1 - live source cannot be backed up; stopped backup matches every original byte
      ---
      duration_ms: 90.544
      type: 'test'
      ...
    # Subtest: new runtime preserves original cases, confirmations, approval hashes and sealed history
    ok 2 - new runtime preserves original cases, confirmations, approval hashes and sealed history
      ---
      duration_ms: 36.6856
      type: 'test'
      ...
    # Subtest: interrupted mutation stays pending, cannot be replayed and adds only recovery state
    ok 3 - interrupted mutation stays pending, cannot be replayed and adds only recovery state
      ---
      duration_ms: 5.351
      type: 'test'
      ...
    # Subtest: upgrade does not restore authentication or bypass same-site cleanup holds
    ok 4 - upgrade does not restore authentication or bypass same-site cleanup holds
      ---
      duration_ms: 29.8952
      type: 'test'
      ...
    # Subtest: new-version output is archived separately and never merged into old source
    ok 5 - new-version output is archived separately and never merged into old source
      ---
      duration_ms: 83.2795
      type: 'test'
      ...
    # Subtest: actual old runtime reopens its pre-upgrade backup, not the newer data structure
    ok 6 - actual old runtime reopens its pre-upgrade backup, not the newer data structure
      ---
      duration_ms: 57.8932
      type: 'test'
      ...
# {"directory":"D:\\\\01_AI工程\\\\01_工程项目\\\\ui-test-agent\\\\validation\\\\upgrade-BHbx6I","ref":"d1e6fbb9d252f2d3b2ab5f7daa87f2a66783dfb3","checks":["stopped backup and no-merge copy","legacy state, approvals and sealed history preserved","interruption recovered once without replay or history changes","authentication required and persistent same-site hold enforced","new output archived separately; rollback uses pre-upgrade data","old runtime restored without rewriting original or upgraded records"],"current_build":"14c2bda0aa6a35ad84495c36ae9ebc46faa8c5a931238b1528a3178b5748843e","preserved_source_files":14}
    1..6
ok 2 - real 0.4.0-beta.1 d1e6fbb backup, upgrade and rollback
  ---
  duration_ms: 644.1931
  type: 'test'
  ...
1..2
# tests 14
# suites 0
# pass 14
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1831.5877
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

最终核验含未核对/未批准Case不被升级或回退自动提升。两固定旧Git运行时各6场景和父项共14TAP；只有合成存储服务兼容证据，不是模型、干净Windows或独立人员验收。
