# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-20T12:33:05+08:00`
- Record: `REQ-0017-controlled-react`
- Change fingerprint: `d504d89c9a15be9501495bf6c426490d1aa4e34acab6e11fec810b656c9121cc`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test tests/diagnostic-profile.test.mjs tests/completion-feedback.execution.test.mjs tests/adaptive-completion-evidence.execution.test.mjs tests/model-round-diagnosis.test.mjs tests/telemetry.test.mjs tests/model-transport.test.mjs tests/autonomous-lab.test.mjs tests/adaptive-protocol.test.mjs tests/adaptive-completion-evidence.test.mjs`
- Exit code: `0`
- Test count: `98`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/req0017/v39-regression.log`
- Log SHA-256: `e5cb957106b3c73fa85cceb9a29f9997b0df85d3e24c26735e90a94a58fca5e5`

### Git Status

```text
 M docs/modules/release_runtime.md
 M docs/requirements/REQ-0017-controlled-react/00_user_requirement.md
 M docs/requirements/REQ-0017-controlled-react/02_design.md
 M docs/requirements/REQ-0017-controlled-react/03_tasks.md
 M docs/requirements/REQ-0017-controlled-react/04_verification.md
 M docs/requirements/REQ-0017-controlled-react/05_trace.md
 M docs/requirements/REQ-0017-controlled-react/current_state.md
 M docs/requirements/REQ-0017-controlled-react/delivery_evidence.md
 M docs/requirements/REQ-0017-controlled-react/requirement.source.json
 M scripts/analyze-model-round.mjs
 M scripts/autonomous-lab.mjs
 M src/controller.mjs
 M src/deepseek.mjs
 M tests/completion-feedback.execution.test.mjs
?? scripts/model-profile-comparison.mjs
?? src/diagnostic-profile.mjs
?? tests/diagnostic-profile.test.mjs
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/modules/release_runtime.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/00_user_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/02_design.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/03_tasks.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/04_verification.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/05_trace.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'scripts/analyze-model-round.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'scripts/autonomous-lab.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/controller.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/deepseek.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/completion-feedback.execution.test.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/release_runtime.md                    |   6 +
 .../00_user_requirement.md                         |   1 +
 .../REQ-0017-controlled-react/02_design.md         |   2 +-
 .../REQ-0017-controlled-react/03_tasks.md          |   2 +-
 .../REQ-0017-controlled-react/04_verification.md   |   1 +
 .../REQ-0017-controlled-react/05_trace.md          |   3 +-
 .../REQ-0017-controlled-react/current_state.md     |   7 +-
 .../REQ-0017-controlled-react/delivery_evidence.md | 626 +++++++++++++++++++--
 .../requirement.source.json                        |  36 +-
 scripts/analyze-model-round.mjs                    |   3 +
 scripts/autonomous-lab.mjs                         |  17 +-
 src/controller.mjs                                 |   6 +
 src/deepseek.mjs                                   |   7 +-
 tests/completion-feedback.execution.test.mjs       |  10 +-
 14 files changed, 663 insertions(+), 64 deletions(-)
```

### Untracked Files

```text
scripts/model-profile-comparison.mjs
src/diagnostic-profile.mjs
tests/diagnostic-profile.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-20T12:31:15+08:00
Command: node --test tests/diagnostic-profile.test.mjs tests/completion-feedback.execution.test.mjs tests/adaptive-completion-evidence.execution.test.mjs tests/model-round-diagnosis.test.mjs tests/telemetry.test.mjs tests/model-transport.test.mjs tests/autonomous-lab.test.mjs tests/adaptive-protocol.test.mjs tests/adaptive-completion-evidence.test.mjs
Exit code: 0
Parsed test count: 98
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: a new successful measurement can request completion, not approve it: new-evidence
ok 1 - a new successful measurement can request completion, not approve it: new-evidence
  ---
  duration_ms: 16276.6171
  type: 'test'
  ...
# Subtest: a new successful measurement can request completion, not approve it: final-reject
ok 2 - a new successful measurement can request completion, not approve it: final-reject
  ---
  duration_ms: 14881.2328
  type: 'test'
  ...
# Subtest: a new successful measurement can request completion, not approve it: duplicate-only
ok 3 - a new successful measurement can request completion, not approve it: duplicate-only
  ---
  duration_ms: 10757.0456
  type: 'test'
  ...
# Subtest: a new successful measurement can request completion, not approve it: actual-difference
ok 4 - a new successful measurement can request completion, not approve it: actual-difference
  ---
  duration_ms: 14052.1186
  type: 'test'
  ...
# Subtest: a newly measured distinct assertion changes the completion evidence set
ok 5 - a newly measured distinct assertion changes the completion evidence set
  ---
  duration_ms: 2.6766
  type: 'test'
  ...
# Subtest: duplicates, order and fragment/action metadata do not unlock another probe
ok 6 - duplicates, order and fragment/action metadata do not unlock another probe
  ---
  duration_ms: 0.8686
  type: 'test'
  ...
# Subtest: new source IDs or quote alone do not count as new measured content
ok 7 - new source IDs or quote alone do not count as new measured content
  ---
  duration_ms: 0.3314
  type: 'test'
  ...
# Subtest: default visibility is normalized to its actual default true predicate
ok 8 - default visibility is normalized to its actual default true predicate
  ---
  duration_ms: 0.3621
  type: 'test'
  ...
# Subtest: changing a real target, predicate or expected value is a different declaration, not approval
ok 9 - changing a real target, predicate or expected value is a different declaration, not approval
  ---
  duration_ms: 0.8216
  type: 'test'
  ...
# Subtest: input is never mutated and property serialization order is immaterial
ok 10 - input is never mutated and property serialization order is immaterial
  ---
  duration_ms: 1.4005
  type: 'test'
  ...
# Subtest: a model cannot forge controller probe origin or an evidence epoch
ok 11 - a model cannot forge controller probe origin or an evidence epoch
  ---
  duration_ms: 7.5049
  type: 'test'
  ...
# Subtest: directory binds refs to current observed facts, exposes only current original sources and preserves input
ok 12 - directory binds refs to current observed facts, exposes only current original sources and preserves input
  ---
  duration_ms: 12.8619
  type: 'test'
  ...
# Subtest: V01 kind:button response is invalid, whereas a ref compiles the exact observed role locator
ok 13 - V01 kind:button response is invalid, whereas a ref compiles the exact observed role locator
  ---
  duration_ms: 8.9565
  type: 'test'
  ...
# Subtest: V02 action quote is never silently fixed in legacy mode; source refs generate expectation-only quote
ok 14 - V02 action quote is never silently fixed in legacy mode; source refs generate expectation-only quote
  ---
  duration_ms: 4.6363
  type: 'test'
  ...
# Subtest: action IDs depend on step and successful segment count, not rejected proposals or observed DOM
ok 15 - action IDs depend on step and successful segment count, not rejected proposals or observed DOM
  ---
  duration_ms: 1.2927
  type: 'test'
  ...
# Subtest: generated IDs remain legal and distinct for long common-prefix step IDs
ok 16 - generated IDs remain legal and distinct for long common-prefix step IDs
  ---
  duration_ms: 1.8683
  type: 'test'
  ...
# Subtest: unknown ref and stale refs after URL/text/control changes fail without guessing
ok 17 - unknown ref and stale refs after URL/text/control changes fail without guessing
  ---
  duration_ms: 3.7542
  type: 'test'
  ...
# Subtest: compiler ignores forged exposed directories and observation hash
ok 18 - compiler ignores forged exposed directories and observation hash
  ---
  duration_ms: 1.5876
  type: 'test'
  ...
# Subtest: new/old conflict is rejected: action ref and fixed target
ok 19 - new/old conflict is rejected: action ref and fixed target
  ---
  duration_ms: 1.8111
  type: 'test'
  ...
# Subtest: new/old conflict is rejected: action ref and model ID
ok 20 - new/old conflict is rejected: action ref and model ID
  ---
  duration_ms: 1.3256
  type: 'test'
  ...
# Subtest: new/old conflict is rejected: assertion ref and fixed target
ok 21 - new/old conflict is rejected: assertion ref and fixed target
  ---
  duration_ms: 1.2752
  type: 'test'
  ...
# Subtest: new/old conflict is rejected: source refs and oracle quote
ok 22 - new/old conflict is rejected: source refs and oracle quote
  ---
  duration_ms: 1.0333
  type: 'test'
  ...
# Subtest: new/old conflict is rejected: source refs and old obligation IDs
ok 23 - new/old conflict is rejected: source refs and old obligation IDs
  ---
  duration_ms: 0.8046
  type: 'test'
  ...
# Subtest: source reference cannot escape current original step: ["S2-O1"]
ok 24 - source reference cannot escape current original step: ["S2-O1"]
  ---
  duration_ms: 0.8699
  type: 'test'
  ...
# Subtest: source reference cannot escape current original step: ["unknown"]
ok 25 - source reference cannot escape current original step: ["unknown"]
  ---
  duration_ms: 0.6865
  type: 'test'
  ...
# Subtest: source reference cannot escape current original step: [" S1-O1 "]
ok 26 - source reference cannot escape current original step: [" S1-O1 "]
  ---
  duration_ms: 0.6756
  type: 'test'
  ...
# Subtest: source_refs shape rejected: []
ok 27 - source_refs shape rejected: []
  ---
  duration_ms: 0.7575
  type: 'test'
  ...
# Subtest: source_refs shape rejected: ["S1-O1","S1-O1"]
ok 28 - source_refs shape rejected: ["S1-O1","S1-O1"]
  ---
  duration_ms: 0.6208
  type: 'test'
  ...
# Subtest: source_refs shape rejected: "S1-O1"
ok 29 - source_refs shape rejected: "S1-O1"
  ---
  duration_ms: 0.6439
  type: 'test'
  ...
# Subtest: source_refs shape rejected: [1]
ok 30 - source_refs shape rejected: [1]
  ---
  duration_ms: 0.6493
  type: 'test'
  ...
# Subtest: source_refs shape rejected: [null]
ok 31 - source_refs shape rejected: [null]
  ---
  duration_ms: 1.2767
  type: 'test'
  ...
# Subtest: illegal transport shape rejected: extra top-level field
ok 32 - illegal transport shape rejected: extra top-level field
  ---
  duration_ms: 0.6704
  type: 'test'
  ...
# Subtest: illegal transport shape rejected: absent actions
ok 33 - illegal transport shape rejected: absent actions
  ---
  duration_ms: 0.3429
  type: 'test'
  ...
# Subtest: illegal transport shape rejected: actions object
ok 34 - illegal transport shape rejected: actions object
  ---
  duration_ms: 0.2918
  type: 'test'
  ...
# Subtest: illegal transport shape rejected: two actions
ok 35 - illegal transport shape rejected: two actions
  ---
  duration_ms: 0.2769
  type: 'test'
  ...
# Subtest: illegal transport shape rejected: assertions not array
ok 36 - illegal transport shape rejected: assertions not array
  ---
  duration_ms: 0.2478
  type: 'test'
  ...
# Subtest: illegal transport shape rejected: too many assertions
ok 37 - illegal transport shape rejected: too many assertions
  ---
  duration_ms: 0.2646
  type: 'test'
  ...
# Subtest: illegal transport shape rejected: nonboolean complete
ok 38 - illegal transport shape rejected: nonboolean complete
  ---
  duration_ms: 0.237
  type: 'test'
  ...
# Subtest: illegal transport shape rejected: short timeout
ok 39 - illegal transport shape rejected: short timeout
  ---
  duration_ms: 1.0729
  type: 'test'
  ...
# Subtest: illegal transport shape rejected: fractional timeout
ok 40 - illegal transport shape rejected: fractional timeout
  ---
  duration_ms: 0.5972
  type: 'test'
  ...
# Subtest: illegal transport shape rejected: empty reason
ok 41 - illegal transport shape rejected: empty reason
  ---
  duration_ms: 0.5388
  type: 'test'
  ...
# Subtest: illegal transport shape rejected: action kind instead of op
ok 42 - illegal transport shape rejected: action kind instead of op
  ---
  duration_ms: 0.4914
  type: 'test'
  ...
# Subtest: illegal transport shape rejected: target absent for click
ok 43 - illegal transport shape rejected: target absent for click
  ---
  duration_ms: 0.5725
  type: 'test'
  ...
# Subtest: illegal transport shape rejected: assertion check type
ok 44 - illegal transport shape rejected: assertion check type
  ---
  duration_ms: 0.4652
  type: 'test'
  ...
# Subtest: blocked is preserved verbatim for the executor, never converted to success or sanitized into valid shape
ok 45 - blocked is preserved verbatim for the executor, never converted to success or sanitized into valid shape
  ---
  duration_ms: 0.7138
  type: 'test'
  ...
# Subtest: legacy fixed fragment preserves IDs, quote, values, order and optional expected omission
ok 46 - legacy fixed fragment preserves IDs, quote, values, order and optional expected omission
  ---
  duration_ms: 3.1575
  type: 'test'
  ...
# Subtest: prototype and built-in property names never resolve as target references
ok 47 - prototype and built-in property names never resolve as target references
  ---
  duration_ms: 3.8829
  type: 'test'
  ...
# Subtest: unknown new or legacy fields are rejected rather than silently stripped
ok 48 - unknown new or legacy fields are rejected rather than silently stripped
  ---
  duration_ms: 2.1036
  type: 'test'
  ...
# Subtest: compiler preserves optional expected JSON verbatim, including falsy and matrix values
ok 49 - compiler preserves optional expected JSON verbatim, including falsy and matrix values
  ---
  duration_ms: 1.6226
  type: 'test'
  ...
# Subtest: non-JSON replies and malformed observed locators produce protocol-prefixed errors
ok 50 - non-JSON replies and malformed observed locators produce protocol-prefixed errors
  ---
  duration_ms: 0.4588
  type: 'test'
  ...
# Subtest: explicit /assets navigation needs no DOM link; action-only and fixed table/scope escapes retain strict gates
ok 51 - explicit /assets navigation needs no DOM link; action-only and fixed table/scope escapes retain strict gates
  ---
  duration_ms: 4.2725
  type: 'test'
  ...
# Subtest: source-derived quotes do not waive full business obligation coverage or readonly/input restrictions
ok 52 - source-derived quotes do not waive full business obligation coverage or readonly/input restrictions
  ---
  duration_ms: 7.5122
  type: 'test'
  ...
# Subtest: input rejects changed source text and cannot use another step sources supplied by caller
ok 53 - input rejects changed source text and cannot use another step sources supplied by caller
  ---
  duration_ms: 1.0508
  type: 'test'
  ...
# Subtest: reference override documents navigation, partial actions, targeted format correction and unchanged gates
ok 54 - reference override documents navigation, partial actions, targeted format correction and unchanged gates
  ---
  duration_ms: 0.1142
  type: 'test'
  ...
# Subtest: shared round call/time budget never resets between jobs and counts failed requests
ok 55 - shared round call/time budget never resets between jobs and counts failed requests
  ---
  duration_ms: 1.2614
  type: 'test'
  ...
# Subtest: autonomous preflight checks the frozen 32 cases without creating sessions or calling a model
ok 56 - autonomous preflight checks the frozen 32 cases without creating sessions or calling a model
  ---
  duration_ms: 18.5721
  type: 'test'
  ...
# Subtest: bounded selection retains original suite order and rejects missing/duplicate IDs
ok 57 - bounded selection retains original suite order and rejects missing/duplicate IDs
  ---
  duration_ms: 67.2569
  type: 'test'
  ...
# Subtest: parallel completion feedback through actual Controller: baseline/early-feedback
ok 58 - parallel completion feedback through actual Controller: baseline/early-feedback
  ---
  duration_ms: 20903.0789
  type: 'test'
  ...
# Subtest: parallel completion feedback through actual Controller: baseline/actual-page11
ok 59 - parallel completion feedback through actual Controller: baseline/actual-page11
  ---
  duration_ms: 17317.2491
  type: 'test'
  ...
# Subtest: parallel completion feedback through actual Controller: baseline/persistent-omission
ok 60 - parallel completion feedback through actual Controller: baseline/persistent-omission
  ---
  duration_ms: 16494.8917
  type: 'test'
  ...
# Subtest: parallel completion feedback through actual Controller: preflight-hints/early-feedback
ok 61 - parallel completion feedback through actual Controller: preflight-hints/early-feedback
  ---
  duration_ms: 20246.7778
  type: 'test'
  ...
# Subtest: parallel completion feedback through actual Controller: preflight-hints/actual-page11
ok 62 - parallel completion feedback through actual Controller: preflight-hints/actual-page11
  ---
  duration_ms: 17124.1465
  type: 'test'
  ...
# Subtest: parallel completion feedback through actual Controller: preflight-hints/persistent-omission
ok 63 - parallel completion feedback through actual Controller: preflight-hints/persistent-omission
  ---
  duration_ms: 16303.706
  type: 'test'
  ...
# Subtest: baseline and reasoning profiles leave planning input and prompt identical
ok 64 - baseline and reasoning profiles leave planning input and prompt identical
  ---
  duration_ms: 1.3235
  type: 'test'
  ...
# Subtest: profiles change only thinking request settings; traces match sent settings and never retain reasoning text
ok 65 - profiles change only thinking request settings; traces match sent settings and never retain reasoning text
  ---
  duration_ms: 7.76
  type: 'test'
  ...
# Subtest: preflight is current-source advisory only; missing future targets do not gate dispatch
ok 66 - preflight is current-source advisory only; missing future targets do not gate dispatch
  ---
  duration_ms: 9.9319
  type: 'test'
  ...
# Subtest: preflight preserves existing checkpoint boundaries, does not merge prior measurements or add guards
ok 67 - preflight preserves existing checkpoint boundaries, does not merge prior measurements or add guards
  ---
  duration_ms: 0.865
  type: 'test'
  ...
# Subtest: comparison budget is shared, counts failed calls, refuses time extension and extra rounds
ok 68 - comparison budget is shared, counts failed calls, refuses time extension and extra rounds
  ---
  duration_ms: 0.5839
  type: 'test'
  ...
# Subtest: classification separates proposals from measured completion, repairs and partial review
ok 69 - classification separates proposals from measured completion, repairs and partial review
  ---
  duration_ms: 4.7424
  type: 'test'
  ...
# Subtest: one logical call, two physical attempts, usage duplicated by provider is counted once
ok 70 - one logical call, two physical attempts, usage duplicated by provider is counted once
  ---
  duration_ms: 2.449
  type: 'test'
  ...
# Subtest: missing timings and usage remain explicitly unknown, never synthetic zero
ok 71 - missing timings and usage remain explicitly unknown, never synthetic zero
  ---
  duration_ms: 3.3624
  type: 'test'
  ...
# Subtest: model fetch reaches a target through the configured proxy without changing global fetch
ok 72 - model fetch reaches a target through the configured proxy without changing global fetch
  ---
  duration_ms: 53.8435
  type: 'test'
  ...
# Subtest: NO_PROXY bypasses the proxy for a matching local host
ok 73 - NO_PROXY bypasses the proxy for a matching local host
  ---
  duration_ms: 15.3554
  type: 'test'
  ...
# Subtest: model fetch remains direct when no proxy is configured
ok 74 - model fetch remains direct when no proxy is configured
  ---
  duration_ms: 13.4871
  type: 'test'
  ...
# Subtest: proxied requests retain abort deadlines and do not follow redirects
ok 75 - proxied requests retain abort deadlines and do not follow redirects
  ---
  duration_ms: 186.9314
  type: 'test'
  ...
# Subtest: network diagnostics retain only approved codes and never exception messages
ok 76 - network diagnostics retain only approved codes and never exception messages
  ---
  duration_ms: 5.3713
  type: 'test'
  ...
# Subtest: log scrub preserves useful structures and types while removing nested and echoed credentials
ok 77 - log scrub preserves useful structures and types while removing nested and echoed credentials
  ---
  duration_ms: 2.6856
  type: 'test'
  ...
# Subtest: oversized diagnostic text is visibly truncated and prototype fields cannot mutate objects
ok 78 - oversized diagnostic text is visibly truncated and prototype fields cannot mutate objects
  ---
  duration_ms: 0.2529
  type: 'test'
  ...
# Subtest: escaped and URL-encoded configured keys are also scrubbed
ok 79 - escaped and URL-encoded configured keys are also scrubbed
  ---
  duration_ms: 0.2058
  type: 'test'
  ...
# Subtest: repeated scrubbing is stable for nested keys, quoted text, bearer values and truncation markers
ok 80 - repeated scrubbing is stable for nested keys, quoted text, bearer values and truncation markers
  ---
  duration_ms: 1.4454
  type: 'test'
  ...
# Subtest: diagnostic append serializes concurrent records, masks secrets, and survives a new reader
ok 81 - diagnostic append serializes concurrent records, masks secrets, and survives a new reader
  ---
  duration_ms: 114.1478
  type: 'test'
  ...
# Subtest: diagnostic reader detects mutation in the latest entry
ok 82 - diagnostic reader detects mutation in the latest entry
  ---
  duration_ms: 14.8206
  type: 'test'
  ...
# Subtest: diagnostic reader detects a missing middle entry
ok 83 - diagnostic reader detects a missing middle entry
  ---
  duration_ms: 21.2787
  type: 'test'
  ...
# Subtest: progress reads and appends share one queue and retain every entry
ok 84 - progress reads and appends share one queue and retain every entry
  ---
  duration_ms: 256.1549
  type: 'test'
  ...
# Subtest: DeepSeek success traces model, timing, token usage and masked output without changing executable value
ok 85 - DeepSeek success traces model, timing, token usage and masked output without changing executable value
  ---
  duration_ms: 5.1256
  type: 'test'
  ...
# Subtest: DeepSeek keeps safe diagnostics for invalid envelope
ok 86 - DeepSeek keeps safe diagnostics for invalid envelope
  ---
  duration_ms: 1.3013
  type: 'test'
  ...
# Subtest: DeepSeek keeps safe diagnostics for invalid model JSON
ok 87 - DeepSeek keeps safe diagnostics for invalid model JSON
  ---
  duration_ms: 1.9785
  type: 'test'
  ...
# Subtest: DeepSeek keeps safe diagnostics for truncated completion
ok 88 - DeepSeek keeps safe diagnostics for truncated completion
  ---
  duration_ms: 1.6168
  type: 'test'
  ...
# Subtest: DeepSeek keeps safe diagnostics for empty completion
ok 89 - DeepSeek keeps safe diagnostics for empty completion
  ---
  duration_ms: 1.4195
  type: 'test'
  ...
# Subtest: DeepSeek missing usage stays unknown instead of zero
ok 90 - DeepSeek missing usage stays unknown instead of zero
  ---
  duration_ms: 2.3582
  type: 'test'
  ...
# Subtest: transport trace captures the parameters and actual adapter-expanded messages digest
ok 91 - transport trace captures the parameters and actual adapter-expanded messages digest
  ---
  duration_ms: 0.9432
  type: 'test'
  ...
# Subtest: DeepSeek 401 reco
... truncated ...
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

V39有限对照开关98项定向工程；真实比较尚未开始；V38排序漏验未修，非发布验收。
