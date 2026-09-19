# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-19T22:01:13+08:00`
- Record: `REQ-0017-controlled-react`
- Change fingerprint: `0da816005a91ecc7d735a31b7515f19900a222ba0effd1211c05fc4f456b7784`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test --test-concurrency=1 expanded-lab/verify.test.mjs expanded-lab/grading.test.mjs manual-lab/verify.test.mjs`
- Exit code: `0`
- Test count: `60`
- Failure count: `0`
- Skipped count: `0`
- Log path: `validation/req0017/v9-fixture-verified.log`
- Log SHA-256: `fd87701b293952079a8787a70cb8fb164fff2ff9b1a2a7725f07116440c1c2ca`

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
?? expanded-lab/README.md
?? expanded-lab/SPEC.md
?? expanded-lab/cases.json
?? expanded-lab/check-freeze.mjs
?? expanded-lab/grade.mjs
?? expanded-lab/grading.test.mjs
?? expanded-lab/manifest.json
?? expanded-lab/oracle.json
?? expanded-lab/public/app.js
?? expanded-lab/public/index.html
?? expanded-lab/public/style.css
?? expanded-lab/serve.mjs
?? expanded-lab/verify.test.mjs
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
 docs/modules/release_runtime.md                    |   5 +
 docs/requirements/README.md                        |   2 +-
 .../00_user_requirement.md                         |   3 +
 .../REQ-0017-controlled-react/02_design.md         |   2 +-
 .../REQ-0017-controlled-react/03_tasks.md          |   2 +-
 .../REQ-0017-controlled-react/04_verification.md   |   4 +-
 .../REQ-0017-controlled-react/05_trace.md          |   2 +-
 .../REQ-0017-controlled-react/change_log.md        |   1 +
 .../REQ-0017-controlled-react/current_state.md     |   7 +-
 .../REQ-0017-controlled-react/delivery_evidence.md | 673 ++++++++-------------
 .../requirement.source.json                        |  26 +-
 11 files changed, 285 insertions(+), 442 deletions(-)
```

### Untracked Files

```text
expanded-lab/README.md
expanded-lab/SPEC.md
expanded-lab/cases.json
expanded-lab/check-freeze.mjs
expanded-lab/grade.mjs
expanded-lab/grading.test.mjs
expanded-lab/manifest.json
expanded-lab/oracle.json
expanded-lab/public/app.js
expanded-lab/public/index.html
expanded-lab/public/style.css
expanded-lab/serve.mjs
expanded-lab/verify.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-19T22:00:40+08:00
Command: node --test --test-concurrency=1 expanded-lab/verify.test.mjs expanded-lab/grading.test.mjs manual-lab/verify.test.mjs
Exit code: 0
Parsed test count: 60
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: missing cases remain in denominator, not successful skips
ok 1 - missing cases remain in denominator, not successful skips
  ---
  duration_ms: 0.6745
  type: 'test'
  ...
# Subtest: fault technical block is never defect detection
ok 2 - fault technical block is never defect detection
  ---
  duration_ms: 0.1406
  type: 'test'
  ...
# Subtest: fault returning pass is explicitly false pass
ok 3 - fault returning pass is explicitly false pass
  ---
  duration_ms: 0.09
  type: 'test'
  ...
# Subtest: real failure still requires checking the measured target
ok 4 - real failure still requires checking the measured target
  ---
  duration_ms: 0.0911
  type: 'test'
  ...
# Subtest: normal fixture assertion failure is not a business defect acceptance
ok 5 - normal fixture assertion failure is not a business defect acceptance
  ---
  duration_ms: 0.0761
  type: 'test'
  ...
# Subtest: candidate plan is not execution
ok 6 - candidate plan is not execution
  ---
  duration_ms: 0.0843
  type: 'test'
  ...
# Subtest: review label without a question is not established clarification
ok 7 - review label without a question is not established clarification
  ---
  duration_ms: 0.0637
  type: 'test'
  ...
# Subtest: ambiguous cases must not execute
ok 8 - ambiguous cases must not execute
  ---
  duration_ms: 0.0608
  type: 'test'
  ...
# Subtest: status pass alone cannot prove original step completeness
ok 9 - status pass alone cannot prove original step completeness
  ---
  duration_ms: 0.3631
  type: 'test'
  ...
# Subtest: independent truth CON-A1
ok 10 - independent truth CON-A1
  ---
  duration_ms: 1210.1663
  type: 'test'
  ...
# Subtest: independent truth CON-A2
ok 11 - independent truth CON-A2
  ---
  duration_ms: 507.3508
  type: 'test'
  ...
# Subtest: independent truth CON-B1
ok 12 - independent truth CON-B1
  ---
  duration_ms: 1025.0734
  type: 'test'
  ...
# Subtest: independent truth CON-B2
ok 13 - independent truth CON-B2
  ---
  duration_ms: 537.0213
  type: 'test'
  ...
# Subtest: independent truth CON-C1
ok 14 - independent truth CON-C1
  ---
  duration_ms: 563.212
  type: 'test'
  ...
# Subtest: independent truth CON-C2
ok 15 - independent truth CON-C2
  ---
  duration_ms: 546.6321
  type: 'test'
  ...
# Subtest: independent truth CON-D1
ok 16 - independent truth CON-D1
  ---
  duration_ms: 686.3666
  type: 'test'
  ...
# Subtest: independent truth CON-D2
ok 17 - independent truth CON-D2
  ---
  duration_ms: 623.8804
  type: 'test'
  ...
# Subtest: import eight complete cases without grading outcomes or variant hints
ok 18 - import eight complete cases without grading outcomes or variant hints
  ---
  duration_ms: 3.3191
  type: 'test'
  ...
# Subtest: server does not serve grading or repository: /oracle.json
ok 19 - server does not serve grading or repository: /oracle.json
  ---
  duration_ms: 15.0873
  type: 'test'
  ...
# Subtest: server does not serve grading or repository: /SPEC.md
ok 20 - server does not serve grading or repository: /SPEC.md
  ---
  duration_ms: 4.4983
  type: 'test'
  ...
# Subtest: server does not serve grading or repository: /cases.json
ok 21 - server does not serve grading or repository: /cases.json
  ---
  duration_ms: 2.6289
  type: 'test'
  ...
# Subtest: server does not serve grading or repository: /verify.test.mjs
ok 22 - server does not serve grading or repository: /verify.test.mjs
  ---
  duration_ms: 2.5363
  type: 'test'
  ...
# Subtest: server does not serve grading or repository: /../src/server.mjs
ok 23 - server does not serve grading or repository: /../src/server.mjs
  ---
  duration_ms: 2.3287
  type: 'test'
  ...
# Subtest: server does not serve grading or repository: /site/a1?oracle=1
ok 24 - server does not serve grading or repository: /site/a1?oracle=1
  ---
  duration_ms: 2.5687
  type: 'test'
  ...
# Subtest: server only accepts readonly methods
ok 25 - server only accepts readonly methods
  ---
  duration_ms: 2.7805
  type: 'test'
  ...
# Subtest: query empty result and reset keep row identity
ok 26 - query empty result and reset keep row identity
  ---
  duration_ms: 272.7859
  type: 'test'
  ...
# Subtest: normal nested Escape restores parent and focus
ok 27 - normal nested Escape restores parent and focus
  ---
  duration_ms: 574.9089
  type: 'test'
  ...
# Subtest: closing while pending does not resurrect stale detail
ok 28 - closing while pending does not resurrect stale detail
  ---
  duration_ms: 652.5622
  type: 'test'
  ...
# Subtest: usable layout 375
ok 29 - usable layout 375
  ---
  duration_ms: 611.3988
  type: 'test'
  ...
# Subtest: usable layout 768
ok 30 - usable layout 768
  ---
  duration_ms: 587.885
  type: 'test'
  ...
# Subtest: usable layout 1440
ok 31 - usable layout 1440
  ---
  duration_ms: 594.8931
  type: 'test'
  ...
# Subtest: broad text witness can match a wrong field/object /site/a2
ok 32 - broad text witness can match a wrong field/object /site/a2
  ---
  duration_ms: 532.3283
  type: 'test'
  ...
# Subtest: broad text witness can match a wrong field/object /site/b2
ok 33 - broad text witness can match a wrong field/object /site/b2
  ---
  duration_ms: 546.132
  type: 'test'
  ...
# Subtest: broad text witness can match a wrong field/object /site/c2
ok 34 - broad text witness can match a wrong field/object /site/c2
  ---
  duration_ms: 521.546
  type: 'test'
  ...
# Subtest: 24 native-import cases have isolated identities, fixed groups and accurate original oracle
ok 35 - 24 native-import cases have isolated identities, fixed groups and accurate original oracle
  ---
  duration_ms: 354.9889
  type: 'test'
  ...
# Subtest: server exposes only local synthetic routes, never answer files, source or write APIs
ok 36 - server exposes only local synthetic routes, never answer files, source or write APIs
  ---
  duration_ms: 52.8277
  type: 'test'
  ...
# Subtest: V01 homepage navigation exposes 12 assets and 5 first-page rows
ok 37 - V01 homepage navigation exposes 12 assets and 5 first-page rows
  ---
  duration_ms: 582.3724
  type: 'test'
  ...
# Subtest: V02 compound AND filter distinguishes the same-name south device
ok 38 - V02 compound AND filter distinguishes the same-name south device
  ---
  duration_ms: 302.891
  type: 'test'
  ...
# Subtest: V03 paginated same-name record binds D009, never D001
ok 39 - V03 paginated same-name record binds D009, never D001
  ---
  duration_ms: 1128.6393
  type: 'test'
  ...
# Subtest: V04 tabs preserve D009 identity and specified parameter values
ok 40 - V04 tabs preserve D009 identity and specified parameter values
  ---
  duration_ms: 1205.1405
  type: 'test'
  ...
# Subtest: V05 nested modal blocks background and closes only the top layer
ok 41 - V05 nested modal blocks background and closes only the top layer
  ---
  duration_ms: 1596.0215
  type: 'test'
  ...
# Subtest: V06 querying from later page and resetting restore pagination
ok 42 - V06 querying from later page and resetting restore pagination
  ---
  duration_ms: 423.6726
  type: 'test'
  ...
# Subtest: V07 descending numeric power sort and reset
ok 43 - V07 descending numeric power sort and reset
  ---
  duration_ms: 380.5656
  type: 'test'
  ...
# Subtest: V08 deterministic async read error recovers once with the correct device value
ok 44 - V08 deterministic async read error recovers once with the correct device value
  ---
  duration_ms: 2906.3883
  type: 'test'
  ...
# Subtest: V09 inclusive date range returns exactly two matching maintenance rows
ok 45 - V09 inclusive date range returns exactly two matching maintenance rows
  ---
  duration_ms: 1256.9496
  type: 'test'
  ...
# Subtest: closing a loading detail prevents its delayed contents reopening on a new route
ok 46 - closing a loading detail prevents its delayed contents reopening on a new route
  ---
  duration_ms: 1279.936
  type: 'test'
  ...
# Subtest: V10 standard tariff correct non-defect values
ok 47 - V10 standard tariff correct non-defect values
  ---
  duration_ms: 300.078
  type: 'test'
  ...
# Subtest: V11 conditional tariff help remains nested and keeps the right template
ok 48 - V11 conditional tariff help remains nested and keeps the right template
  ---
  duration_ms: 415.8719
  type: 'test'
  ...
# Subtest: V12 audit pages and result filter reset page position
ok 49 - V12 audit pages and result filter reset page position
  ---
  duration_ms: 372.7501
  type: 'test'
  ...
# Subtest: V13 wizard only creates on submit, uses dynamic id, persists all entered fields
ok 50 - V13 wizard only creates on submit, uses dynamic id, persists all entered fields
  ---
  duration_ms: 568.0175
  type: 'test'
  ...
# Subtest: V14 missing name prevents advancing and leaves seed data alone
ok 51 - V14 missing name prevents advancing and leaves seed data alone
  ---
  duration_ms: 352.1455
  type: 'test'
  ...
# Subtest: V15 step-back preserves all configured values without committing
ok 52 - V15 step-back preserves all configured values without committing
  ---
  duration_ms: 572.5873
  type: 'test'
  ...
# Subtest: V16 dirty confirmation keeps data or discards only the draft
ok 53 - V16 dirty confirmation keeps data or discards only the draft
  ---
  duration_ms: 452.7441
  type: 'test'
  ...
# Subtest: V17 duplicate name is rejected at submit with no new persisted record
ok 54 - V17 duplicate name is rejected at submit with no new persisted record
  ---
  duration_ms: 487.5097
  type: 'test'
  ...
# Subtest: wizard keyboard priority, invalid period and escaped business text do not silently submit
ok 55 - wizard keyboard priority, invalid period and escaped business text do not silently submit
  ---
  duration_ms: 485.0447
  type: 'test'
  ...
# Subtest: V18 update and cleanup bind only the newly created record
ok 56 - V18 update and cleanup bind only the newly created record
  ---
  duration_ms: 711.297
  type: 'test'
  ...
# Subtest: B01 seeded tariff defect is visible; correct 0.38 oracle is never derived from UI
ok 57 - B01 seeded tariff defect is visible; correct 0.38 oracle is never derived from UI
  ---
  duration_ms: 286.2647
  type: 'test'
  ...
# Subtest: B02 seeded frequency defect exists only on D004, not the valid D009
ok 58 - B02 seeded frequency defect exists only on D004, not the valid D009
  ---
  duration_ms: 2179.5683
  type: 'test'
  ...
# Subtest: reload, history navigation and reset preserve isolation from unrelated storage
ok 59 - reload, history navigation and reset preserve isolation from unrelated storage
  ---
  duration_ms: 754.121
  type: 'test'
  ...
# Subtest: desktop and 375px viewports have bounded layout, keyboard operation and screenshot evidence
ok 60 - desktop and 375px viewports have bounded layout, keyboard operation and screenshot evidence
  ---
  duration_ms: 963.8914
  type: 'test'
  ...
1..60
# tests 60
# suites 0
# pass 60
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 32155.1013
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

版本9扩展夹具及判分器：expanded-lab页面、cases、oracle、manifest、serve、grade和参考测试。60项是参考/单元证据，不是32例产品验收。初次正式采证50/51时序竞态已记录并修复，旧页面和用例不变，真实模型仍在执行。
