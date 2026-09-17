# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-18T02:09:41+08:00`
- Record: `REQ-0011-recording-caption-readability`
- Change fingerprint: `3359f14742b90e008fba6175c4fcf014a14f63c7782adf8ffaefae0380a58dac`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test tests/recording-layout.test.mjs tests/recording-evidence.test.mjs`
- Exit code: `0`
- Test count: `10`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/REQ-0011-delivery-formatted.log`
- Log SHA-256: `3c600e72f79ada8837e7a8bd3672e772d26986d2eda8809c565621cf267f85ec`

### Git Status

```text
 M docs/modules/release_runtime.md
 M docs/requirements/README.md
 M src/recording-evidence.mjs
 M src/report-view.mjs
?? docs/requirements/REQ-0011-recording-caption-readability/00_user_requirement.md
?? docs/requirements/REQ-0011-recording-caption-readability/01_development_requirement.md
?? docs/requirements/REQ-0011-recording-caption-readability/02_design.md
?? docs/requirements/REQ-0011-recording-caption-readability/03_tasks.md
?? docs/requirements/REQ-0011-recording-caption-readability/04_verification.md
?? docs/requirements/REQ-0011-recording-caption-readability/05_trace.md
?? docs/requirements/REQ-0011-recording-caption-readability/browser-review.md
?? docs/requirements/REQ-0011-recording-caption-readability/change_log.md
?? docs/requirements/REQ-0011-recording-caption-readability/current_state.md
?? docs/requirements/REQ-0011-recording-caption-readability/delivery_evidence.md
?? docs/requirements/REQ-0011-recording-caption-readability/requirement.source.json
?? tests/recording-layout.test.mjs
?? tests/release-report.integration.mjs
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/modules/release_runtime.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/recording-evidence.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/report-view.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md |  2 ++
 docs/requirements/README.md     |  2 ++
 src/recording-evidence.mjs      | 35 +++++++++++++++++++++++++++--------
 src/report-view.mjs             |  6 +++++-
 4 files changed, 36 insertions(+), 9 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0011-recording-caption-readability/00_user_requirement.md
docs/requirements/REQ-0011-recording-caption-readability/01_development_requirement.md
docs/requirements/REQ-0011-recording-caption-readability/02_design.md
docs/requirements/REQ-0011-recording-caption-readability/03_tasks.md
docs/requirements/REQ-0011-recording-caption-readability/04_verification.md
docs/requirements/REQ-0011-recording-caption-readability/05_trace.md
docs/requirements/REQ-0011-recording-caption-readability/browser-review.md
docs/requirements/REQ-0011-recording-caption-readability/change_log.md
docs/requirements/REQ-0011-recording-caption-readability/current_state.md
docs/requirements/REQ-0011-recording-caption-readability/delivery_evidence.md
docs/requirements/REQ-0011-recording-caption-readability/requirement.source.json
tests/recording-layout.test.mjs
tests/release-report.integration.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-18T02:09:37+08:00
Command: node --test tests/recording-layout.test.mjs tests/recording-evidence.test.mjs
Exit code: 0
Parsed test count: 10
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: recording pages retain long Chinese text and Unicode without truncation
ok 1 - recording pages retain long Chinese text and Unicode without truncation
  ---
  duration_ms: 0.8881
  type: 'test'
  ...
# Subtest: recording captions redact secrets and treat expected markup as plain data
ok 2 - recording captions redact secrets and treat expected markup as plain data
  ---
  duration_ms: 0.2443
  type: 'test'
  ...
# Subtest: atomic actual values are not converted into four failures when their group fails
ok 3 - atomic actual values are not converted into four failures when their group fails
  ---
  duration_ms: 0.2199
  type: 'test'
  ...
# Subtest: media rendering failure preserves original business mismatch and records partial evidence
ok 4 - media rendering failure preserves original business mismatch and records partial evidence
  ---
  duration_ms: 1.4455
  type: 'test'
  ...
# Subtest: recording presentation geometry in actual Chromium (not business acceptance)
    # Subtest: short captions are readable and away from native bottom controls
    ok 1 - short captions are readable and away from native bottom controls
      ---
      duration_ms: 15.539
      type: 'test'
      ...
    # Subtest: bottom fallback avoids active target and reserves playback safe area
    ok 2 - bottom fallback avoids active target and reserves playback safe area
      ---
      duration_ms: 5.6406
      type: 'test'
      ...
    # Subtest: full Chinese field pages fit without clipping or dropping content
    ok 3 - full Chinese field pages fit without clipping or dropping content
      ---
      duration_ms: 36.991
      type: 'test'
      ...
    # Subtest: an unsupported small viewport never records clipped captions as complete
    ok 4 - an unsupported small viewport never records clipped captions as complete
      ---
      duration_ms: 1866.4981
      type: 'test'
      ...
    # Subtest: report video is not capped to 500px while screenshots retain the cap
    ok 5 - report video is not capped to 500px while screenshots retain the cap
      ---
      duration_ms: 31.1114
      type: 'test'
      ...
    1..5
ok 5 - recording presentation geometry in actual Chromium (not business acceptance)
  ---
  duration_ms: 2469.1756
  type: 'test'
  ...
1..5
# tests 10
# suites 0
# pass 10
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2897.6812
```

### Sync Record Status

```text
DRY-RUN: no derived changes for REQ-0011-recording-caption-readability; explicit implementation states retained, never inferred from verification.
```

### Check AI Context

- Exit code: `0`

```text
PASS ai-engineering-context checks
```

### Notes

格式检查后最终10项字幕/证据组合；这10项包含在同构建570程序回归中。6项报告生成、8场景录像、隔离和实际播放分别留证，非真实模型。父验证登记已独立提交615bc99，首次mixed-records失败evidence保留。file://直开拒绝未验。
