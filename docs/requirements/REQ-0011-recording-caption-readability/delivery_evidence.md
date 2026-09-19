# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-19T17:00:18+08:00`
- Record: `REQ-0011-recording-caption-readability`
- Change fingerprint: `505d09ea2844eaab0435b1a1e29ccecfbd55e5b4576c6f1beb3fb2fc98e74f36`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test --test-concurrency=4 tests/evidence-results.test.mjs tests/adaptive-report.test.mjs tests/adaptive-console.test.mjs tests/repair-presentation.test.mjs tests/checkpoints.test.mjs tests/recording-layout.test.mjs tests/recording-evidence.test.mjs`
- Exit code: `0`
- Test count: `72`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/req0011/v2-visual-final.log`
- Log SHA-256: `2c9cdc3586b4bf69af8387824353cc01ebdfb51226db11a03d3958c25a3abfe7`

### Git Status

```text
 M docs/modules/release_runtime.md
 M docs/requirements/README.md
 M docs/requirements/REQ-0011-recording-caption-readability/00_user_requirement.md
 M docs/requirements/REQ-0011-recording-caption-readability/01_development_requirement.md
 M docs/requirements/REQ-0011-recording-caption-readability/02_design.md
 M docs/requirements/REQ-0011-recording-caption-readability/03_tasks.md
 M docs/requirements/REQ-0011-recording-caption-readability/04_verification.md
 M docs/requirements/REQ-0011-recording-caption-readability/05_trace.md
 M docs/requirements/REQ-0011-recording-caption-readability/change_log.md
 M docs/requirements/REQ-0011-recording-caption-readability/current_state.md
 M docs/requirements/REQ-0011-recording-caption-readability/delivery_evidence.md
 M docs/requirements/REQ-0011-recording-caption-readability/requirement.source.json
 M public/app.js
 M public/index.html
 M src/report-view.mjs
 M src/server.mjs
 M tests/adaptive-console.test.mjs
 M tests/case-named.test.mjs
 M tests/checkpoints.test.mjs
 M tests/controlled-react.test.mjs
 M tests/release-candidate-runtime.integration.mjs
 M tests/repair-presentation.test.mjs
?? public/evidence-view.js
?? public/evidence.css
?? tests/evidence-results.test.mjs
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/modules/release_runtime.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0011-recording-caption-readability/00_user_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0011-recording-caption-readability/01_development_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0011-recording-caption-readability/02_design.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0011-recording-caption-readability/03_tasks.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0011-recording-caption-readability/04_verification.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0011-recording-caption-readability/05_trace.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0011-recording-caption-readability/change_log.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0011-recording-caption-readability/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0011-recording-caption-readability/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0011-recording-caption-readability/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'public/app.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'public/index.html', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/report-view.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/server.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/adaptive-console.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/case-named.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/checkpoints.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/controlled-react.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/release-candidate-runtime.integration.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/repair-presentation.test.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md                    |   6 +
 docs/requirements/README.md                        |   2 +-
 .../00_user_requirement.md                         |   7 +-
 .../01_development_requirement.md                  |   1 +
 .../02_design.md                                   |   1 +
 .../03_tasks.md                                    |   1 +
 .../04_verification.md                             |   1 +
 .../05_trace.md                                    |   1 +
 .../change_log.md                                  |   2 +
 .../current_state.md                               |  10 +-
 .../delivery_evidence.md                           | 532 ++++++++++++++++++---
 .../requirement.source.json                        |  86 +++-
 public/app.js                                      |  30 +-
 public/index.html                                  |   1 +
 src/report-view.mjs                                |  48 +-
 src/server.mjs                                     |   5 +-
 tests/adaptive-console.test.mjs                    |  68 ++-
 tests/case-named.test.mjs                          |   5 +-
 tests/checkpoints.test.mjs                         |   2 +
 tests/controlled-react.test.mjs                    |   5 +-
 tests/release-candidate-runtime.integration.mjs    |   2 +
 tests/repair-presentation.test.mjs                 |   4 +-
 22 files changed, 710 insertions(+), 110 deletions(-)
```

### Untracked Files

```text
public/evidence-view.js
public/evidence.css
tests/evidence-results.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-19T17:00:08+08:00
Command: node --test --test-concurrency=4 tests/evidence-results.test.mjs tests/adaptive-report.test.mjs tests/adaptive-console.test.mjs tests/repair-presentation.test.mjs tests/checkpoints.test.mjs tests/recording-layout.test.mjs tests/recording-evidence.test.mjs
Exit code: 0
Parsed test count: 72
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: evidence modal shows original-step outcomes without video and survives refresh on desktop and narrow screen
ok 1 - evidence modal shows original-step outcomes without video and survives refresh on desktop and narrow screen
  ---
  duration_ms: 1281.3415
  type: 'test'
  ...
# Subtest: direct testing has three stages, one primary action and no pre-emptive login gate
ok 2 - direct testing has three stages, one primary action and no pre-emptive login gate
  ---
  duration_ms: 337.8075
  type: 'test'
  ...
# Subtest: keyboard start sends test with original prepare options; duplicate submission is locked
ok 3 - keyboard start sends test with original prepare options; duplicate submission is locked
  ---
  duration_ms: 325.8987
  type: 'test'
  ...
# Subtest: confirming the original case directly starts test, even without autonomous preparation support
ok 4 - confirming the original case directly starts test, even without autonomous preparation support
  ---
  duration_ms: 450.4843
  type: 'test'
  ...
# Subtest: pending adaptive contracts can re-enter test, with business goals shown and no approval
ok 5 - pending adaptive contracts can re-enter test, with business goals shown and no approval
  ---
  duration_ms: 300.9938
  type: 'test'
  ...
# Subtest: direct flag absent retains the five-stage workflow and never offers direct test
ok 6 - direct flag absent retains the five-stage workflow and never offers direct test
  ---
  duration_ms: 246.5611
  type: 'test'
  ...
# Subtest: fixed planning mode retains the five-stage workflow and never offers direct test
ok 7 - fixed planning mode retains the five-stage workflow and never offers direct test
  ---
  duration_ms: 285.0449
  type: 'test'
  ...
# Subtest: write authorization retains the five-stage workflow and never offers direct test
ok 8 - write authorization retains the five-stage workflow and never offers direct test
  ---
  duration_ms: 257.8863
  type: 'test'
  ...
# Subtest: old fixed plan retains the five-stage workflow and never offers direct test
ok 9 - old fixed plan retains the five-stage workflow and never offers direct test
  ---
  duration_ms: 248.6901
  type: 'test'
  ...
# Subtest: mixed pending selection retains the five-stage workflow and never offers direct test
ok 10 - mixed pending selection retains the five-stage workflow and never offers direct test
  ---
  duration_ms: 266.1487
  type: 'test'
  ...
# Subtest: fixed and adaptive contracts cannot be approved together through the legacy helper
ok 11 - fixed and adaptive contracts cannot be approved together through the legacy helper
  ---
  duration_ms: 325.7029
  type: 'test'
  ...
# Subtest: legacy prepare and approved fixed run still submit their original job kinds
ok 12 - legacy prepare and approved fixed run still submit their original job kinds
  ---
  duration_ms: 607.8034
  type: 'test'
  ...
# Subtest: authorization or fixed-plan changes in fresh state block a stale direct start
ok 13 - authorization or fixed-plan changes in fresh state block a stale direct start
  ---
  duration_ms: 328.065
  type: 'test'
  ...
# Subtest: active test login waits reuse the existing confirmation controls without restarting the job
ok 14 - active test login waits reuse the existing confirmation controls without restarting the job
  ---
  duration_ms: 446.9456
  type: 'test'
  ...
# Subtest: changing selection to a fixed plan does not hide the active test login recovery control
ok 15 - changing selection to a fixed plan does not hide the active test login recovery control
  ---
  duration_ms: 270.004
  type: 'test'
  ...
# Subtest: missing nonproduction authorization routes to environment settings, not a test job
ok 16 - missing nonproduction authorization routes to environment settings, not a test job
  ---
  duration_ms: 253.3261
  type: 'test'
  ...
# Subtest: each adaptive runtime event has a Chinese user-facing label
ok 17 - each adaptive runtime event has a Chinese user-facing label
  ---
  duration_ms: 274.6795
  type: 'test'
  ...
# Subtest: adaptive errors explain blocked execution in Chinese without relaxing write scope
ok 18 - adaptive errors explain blocked execution in Chinese without relaxing write scope
  ---
  duration_ms: 262.9597
  type: 'test'
  ...
# Subtest: completed attempts show results without implying all expectations passed
ok 19 - completed attempts show results without implying all expectations passed
  ---
  duration_ms: 258.034
  type: 'test'
  ...
# Subtest: null plans and adaptive source text render safely without fixed locator fields
ok 20 - null plans and adaptive source text render safely without fixed locator fields
  ---
  duration_ms: 250.9767
  type: 'test'
  ...
# Subtest: 375px layout preserves disclosure focus and scroll across progress refreshes
ok 21 - 375px layout preserves disclosure focus and scroll across progress refreshes
  ---
  duration_ms: 313.2688
  type: 'test'
  ...
# Subtest: after-action table invariant failure is visible without inventing planned assertions
ok 22 - after-action table invariant failure is visible without inventing planned assertions
  ---
  duration_ms: 6.6147
  type: 'test'
  ...
# Subtest: partial matched evidence followed by segment exhaustion is not a passed step or case
ok 23 - partial matched evidence followed by segment exhaustion is not a passed step or case
  ---
  duration_ms: 1.0393
  type: 'test'
  ...
# Subtest: adaptive_segments alone (including empty array) requires matching COMPLETE
ok 24 - adaptive_segments alone (including empty array) requires matching COMPLETE
  ---
  duration_ms: 0.9226
  type: 'test'
  ...
# Subtest: adaptive_steps alone (including empty array) requires matching COMPLETE
ok 25 - adaptive_steps alone (including empty array) requires matching COMPLETE
  ---
  duration_ms: 0.5752
  type: 'test'
  ...
# Subtest: matching COMPLETE plus all passing fields and checkpoints is green
ok 26 - matching COMPLETE plus all passing fields and checkpoints is green
  ---
  duration_ms: 0.7948
  type: 'test'
  ...
# Subtest: failed table field remains a mismatch with COMPLETE=false
ok 27 - failed table field remains a mismatch with COMPLETE=false
  ---
  duration_ms: 0.4278
  type: 'test'
  ...
# Subtest: failed table field remains a mismatch with COMPLETE=true
ok 28 - failed table field remains a mismatch with COMPLETE=true
  ---
  duration_ms: 0.3258
  type: 'test'
  ...
# Subtest: another step COMPLETE and this step pending cannot establish completion
ok 29 - another step COMPLETE and this step pending cannot establish completion
  ---
  duration_ms: 0.2968
  type: 'test'
  ...
# Subtest: COMPLETE does not override group failure, unfinished checkpoint or absent assertions
ok 30 - COMPLETE does not override group failure, unfinished checkpoint or absent assertions
  ---
  duration_ms: 3.5764
  type: 'test'
  ...
# Subtest: current step failure reason is preferred and escaped; case timeout is the fallback
ok 31 - current step failure reason is preferred and escaped; case timeout is the fallback
  ---
  duration_ms: 1.4953
  type: 'test'
  ...
# Subtest: dynamic step without observations stays incomplete with its reason
ok 32 - dynamic step without observations stays incomplete with its reason
  ---
  duration_ms: 0.4506
  type: 'test'
  ...
# Subtest: legacy facts without adaptive markers retain passing, failed and unexecuted behavior
ok 33 - legacy facts without adaptive markers retain passing, failed and unexecuted behavior
  ---
  duration_ms: 0.5334
  type: 'test'
  ...
# Subtest: v3 preserves original steps and covers obligations across distinct checkpoints
ok 34 - v3 preserves original steps and covers obligations across distinct checkpoints
  ---
  duration_ms: 11.3142
  type: 'test'
  ...
# Subtest: checkpoint plan rejects missing obligation
ok 35 - checkpoint plan rejects missing obligation
  ---
  duration_ms: 4.4855
  type: 'test'
  ...
# Subtest: checkpoint plan rejects duplicate checkpoint
ok 36 - checkpoint plan rejects duplicate checkpoint
  ---
  duration_ms: 1.4209
  type: 'test'
  ...
# Subtest: checkpoint plan rejects unbounded step clock
ok 37 - checkpoint plan rejects unbounded step clock
  ---
  duration_ms: 0.8869
  type: 'test'
  ...
# Subtest: checkpoint plan rejects empty checkpoint
ok 38 - checkpoint plan rejects empty checkpoint
  ---
  duration_ms: 0.7167
  type: 'test'
  ...
# Subtest: checkpoint plan rejects false simultaneous declaration
ok 39 - checkpoint plan rejects false simultaneous declaration
  ---
  duration_ms: 0.3682
  type: 'test'
  ...
# Subtest: checkpoint plan rejects extra executable code
ok 40 - checkpoint plan rejects extra executable code
  ---
  duration_ms: 0.4197
  type: 'test'
  ...
# Subtest: checkpoint plan rejects v2 silent migration
ok 41 - checkpoint plan rejects v2 silent migration
  ---
  duration_ms: 0.3835
  type: 'test'
  ...
# Subtest: checkpoint plan rejects unknown version
ok 42 - checkpoint plan rejects unknown version
  ---
  duration_ms: 0.53
  type: 'test'
  ...
# Subtest: original-step capacity cannot be multiplied by splitting checkpoints
ok 43 - original-step capacity cannot be multiplied by splitting checkpoints
  ---
  duration_ms: 1.0828
  type: 'test'
  ...
# Subtest: audit indices span checkpoints and reject an index from the wrong obligation
ok 44 - audit indices span checkpoints and reject an index from the wrong obligation
  ---
  duration_ms: 4.5911
  type: 'test'
  ...
# Subtest: approved read-only locator recovery still finds actions inside checkpoints
ok 45 - approved read-only locator recovery still finds actions inside checkpoints
  ---
  duration_ms: 2.4719
  type: 'test'
  ...
# Subtest: cleanup observation routes are versioned, same-origin and part of approval
ok 46 - cleanup observation routes are versioned, same-origin and part of approval
  ---
  duration_ms: 1.9916
  type: 'test'
  ...
# Subtest: step budget cannot be reset by later checkpoints and v2 keeps its observation window
ok 47 - step budget cannot be reset by later checkpoints and v2 keeps its observation window
  ---
  duration_ms: 0.2957
  type: 'test'
  ...
# Subtest: console shows original expectation, each checkpoint, time meaning and cleanup path
ok 48 - console shows original expectation, each checkpoint, time meaning and cleanup path
  ---
  duration_ms: 15.1316
  type: 'test'
  ...
# Subtest: report retains matching earlier observations without claiming the unfinished step passed
ok 49 - report retains matching earlier observations without claiming the unfinished step passed
  ---
  duration_ms: 3.2476
  type: 'test'
  ...
# Subtest: partial success is incomplete, later untouched steps are not failed, facts remain unchanged
ok 50 - partial success is incomplete, later untouched steps are not failed, facts remain unchanged
  ---
  duration_ms: 2.7037
  type: 'test'
  ...
# Subtest: explicit mismatch wins over completion; group mismatch does not count as passing
ok 51 - explicit mismatch wins over completion; group mismatch does not count as passing
  ---
  duration_ms: 0.1961
  type: 'test'
  ...
# Subtest: complete without observations, unfinished checkpoint and unknown measurements cannot pass
ok 52 - complete without observations, unfinished checkpoint and unknown measurements cannot pass
  ---
  duration_ms: 0.2702
  type: 'test'
  ...
# Subtest: frozen executed case wins over later edits and unsafe strings are escaped
ok 53 - frozen executed case wins over later edits and unsafe strings are escaped
  ---
  duration_ms: 0.2555
  type: 'test'
  ...
# Subtest: legacy evidence remains compatible and missing media does not hide step outcomes
ok 54 - legacy evidence remains compatible and missing media does not hide step outcomes
  ---
  duration_ms: 0.2362
  type: 'test'
  ...
# Subtest: console HTTP serves shared presentation assets with JavaScript/CSS MIME without broadening file access
ok 55 - console HTTP serves shared presentation assets with JavaScript/CSS MIME without broadening file access
  ---
  duration_ms: 148.3419
  type: 'test'
  ...
# Subtest: desktop and narrow recording panels render all result labels and work with keyboard
ok 56 - desktop and narrow recording panels render all result labels and work with keyboard
  ---
  duration_ms: 1384.6972
  type: 'test'
  ...
# Subtest: recording pages retain long Chinese text and Unicode without truncation
ok 57 - recording pages retain long Chinese text and Unicode without truncation
  ---
  duration_ms: 2.093
  type: 'test'
  ...
# Subtest: recording captions redact secrets and treat expected markup as plain data
ok 58 - recording captions redact secrets and treat expected markup as plain data
  ---
  duration_ms: 0.4823
  type: 'test'
  ...
# Subtest: atomic actual values are not converted into four failures when their group fails
ok 59 - atomic actual values are not converted into four failures when their group fails
  ---
  duration_ms: 0.4323
  type: 'test'
  ...
# Subtest: media rendering failure preserves original business mismatch and records partial evidence
ok 60 - media rendering failure preserves original business mismatch and records partial evidence
  ---
  duration_ms: 2.7084
  type: 'test'
  ...
# Subtest: recording presentation geometry in actual Chromium (not business acceptance)
    # Subtest: short captions are readable and away from native bottom controls
    ok 1 - short captions are readable and away from native bottom controls
      ---
      duration_ms: 28.5076
      type: 'test'
      ...
    # Subtest: bottom fallback avoids active target and reserves playback safe area
    ok 2 - bottom fallback avoids active target and reserves playback safe area
      ---
      duration_ms: 14.9709
      type: 'test'
      ...
    # Subtest: full Chinese field pages fit without clipping or dropping content
    ok 3 - full Chinese field pages fit without clipping or dropping content
      ---
      duration_ms: 114.2325
      type: 'test'
      ...
    # Subtest: an unsupported small viewport never records clipped captions as complete
    ok 4 - an unsupported small viewport never records clipped captions as complete
      ---
      duration_ms: 1878.2259
      type: 'test'
      ...
    # Subtest: report video is not capped to 500px while screenshots retain the cap
    ok 5 - report video is not capped to 500px while screenshots retain the cap
      ---
      duration_ms: 48.1167
      type: 'test'
      ...
    1..5
ok 61 - recording presentation geometry in actual Chromium (not business acceptance)
  ---
  duration_ms: 2969.4469
  type: 'test'
  ...
# Subtest: unified report shows self repair without manufacturing execution or passing results
ok 62 - unified report shows self repair without manufacturing execution or passing results
  ---
  duration_ms: 83.0518
  type: 'test'
  ...
# Subtest: clarification issues and originals are visible while legacy records remain compatible
ok 63 - clarification issues and originals are visible while legacy records remain compatible
  ---
  duration_ms: 46.3483
  type: 'test'
  ...
# Subtest: discovery failure shows only this job blocked request with escaped actionable guidance
ok 64 - discovery failure shows only this job blocked request with escaped actionable guidance
  ---
  duration_ms: 7.2706
  type: 'test'
  ...
# Subtest: console presents bounded repair progress and marks accepted candidate as still awaiting review
ok 65 - console presents bounded repair progress and marks accepted candidate as still awaiting review
  ---
  duration_ms: 4.0976
  type: 'test'
  ...
# Subtest: data corrections omit untouched or blank values and submit only changed existing keys
ok 66 - data corrections omit untouched or blank values and submit only changed existing keys
  ---
  duration_ms: 6.3757
  type: 'test'
  ...
# Subtest: data corrections reject malformed JSON, unknown keys and nested keys
ok 67 - data corrections reject malformed JSON, unknown keys and nested keys
  ---
  duration_ms: 5.6647
  type: 'test'
  ...
1..67
# tests 72
# suites 0
# pass 72
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 8459.7435
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

真实界面发现的弹窗滚动与过长明细已收紧，复验受影响呈现/录制；此前122项执行回归另留v2-final.log，不累加为用例数
