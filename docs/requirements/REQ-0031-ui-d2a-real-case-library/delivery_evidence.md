# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-22T16:30:37+08:00`
- Record: `REQ-0031-ui-d2a-real-case-library`
- Change fingerprint: `6f016ccd0cd703f43ffe6fcd458323103156936b07c7700b978e65ac8c6405e0`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `node --test workbench/tests/ui-d2a.test.mjs`
- Exit code: `0`
- Test count: `3`
- Failure count: `0`
- Skipped count: `0`
- Log path: `docs/requirements/REQ-0031-ui-d2a-real-case-library/ui-d2a-verification.log`
- Log SHA-256: `08e6068635c4748645173c2293ba466208624a26efcfbaab50458e214b8d27e4`

### Git Status

```text
 M docs/modules/workbench-case-library.md
 M docs/requirements/README.md
 M workbench/README.md
 M workbench/package.json
 M workbench/server/app.mjs
?? docs/requirements/REQ-0031-ui-d2a-real-case-library/00_user_requirement.md
?? docs/requirements/REQ-0031-ui-d2a-real-case-library/01_development_requirement.md
?? docs/requirements/REQ-0031-ui-d2a-real-case-library/02_design.md
?? docs/requirements/REQ-0031-ui-d2a-real-case-library/03_tasks.md
?? docs/requirements/REQ-0031-ui-d2a-real-case-library/04_verification.md
?? docs/requirements/REQ-0031-ui-d2a-real-case-library/05_trace.md
?? docs/requirements/REQ-0031-ui-d2a-real-case-library/change_log.md
?? docs/requirements/REQ-0031-ui-d2a-real-case-library/current_state.md
?? docs/requirements/REQ-0031-ui-d2a-real-case-library/delivery_evidence.md
?? docs/requirements/REQ-0031-ui-d2a-real-case-library/requirement.source.json
?? docs/requirements/REQ-0031-ui-d2a-real-case-library/ui-d2a-verification.log
?? workbench/docs/UI_D2A_ACCEPTANCE_REPORT.md
?? workbench/docs/UI_D2A_API_MAPPING.md
?? workbench/docs/UI_D2A_USER_TRIAL_GUIDE.md
?? workbench/docs/evidence/ui-d2a/01-real-import-preview-1440x900.png
?? workbench/docs/evidence/ui-d2a/02-cross-project-library-1440x900.png
?? workbench/docs/evidence/ui-d2a/03-version-detail-1920x1080.png
?? workbench/docs/evidence/ui-d2a/04-projects-1280x800.png
?? workbench/docs/evidence/ui-d2a/05-restart-readback-1920x1080.png
?? workbench/examples/ui-d2a/UI_D2A_CASES_A.xlsx
?? workbench/examples/ui-d2a/UI_D2A_CASES_B.xlsx
?? workbench/examples/ui-d2a/UI_D2A_NATIVE_SAMPLE.json
?? workbench/scripts/generate-ui-d2a-native-sample.mjs
?? workbench/scripts/generate-ui-d2a-samples.mjs
?? workbench/tests/ui-d2a-browser.integration.mjs
?? workbench/tests/ui-d2a.test.mjs
?? workbench/web-v2/api.js
?? workbench/web-v2/app.js
?? workbench/web-v2/index.html
?? workbench/web-v2/styles.css
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/modules/workbench-case-library.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/package.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/app.mjs', LF will be replaced by CRLF the next time Git touches it
 docs/modules/workbench-case-library.md | 11 +++++++++++
 docs/requirements/README.md            |  2 ++
 workbench/README.md                    |  4 +++-
 workbench/package.json                 |  5 ++++-
 workbench/server/app.mjs               | 17 +++++++++++++----
 5 files changed, 33 insertions(+), 6 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0031-ui-d2a-real-case-library/00_user_requirement.md
docs/requirements/REQ-0031-ui-d2a-real-case-library/01_development_requirement.md
docs/requirements/REQ-0031-ui-d2a-real-case-library/02_design.md
docs/requirements/REQ-0031-ui-d2a-real-case-library/03_tasks.md
docs/requirements/REQ-0031-ui-d2a-real-case-library/04_verification.md
docs/requirements/REQ-0031-ui-d2a-real-case-library/05_trace.md
docs/requirements/REQ-0031-ui-d2a-real-case-library/change_log.md
docs/requirements/REQ-0031-ui-d2a-real-case-library/current_state.md
docs/requirements/REQ-0031-ui-d2a-real-case-library/delivery_evidence.md
docs/requirements/REQ-0031-ui-d2a-real-case-library/requirement.source.json
docs/requirements/REQ-0031-ui-d2a-real-case-library/ui-d2a-verification.log
workbench/docs/UI_D2A_ACCEPTANCE_REPORT.md
workbench/docs/UI_D2A_API_MAPPING.md
workbench/docs/UI_D2A_USER_TRIAL_GUIDE.md
workbench/docs/evidence/ui-d2a/01-real-import-preview-1440x900.png
workbench/docs/evidence/ui-d2a/02-cross-project-library-1440x900.png
workbench/docs/evidence/ui-d2a/03-version-detail-1920x1080.png
workbench/docs/evidence/ui-d2a/04-projects-1280x800.png
workbench/docs/evidence/ui-d2a/05-restart-readback-1920x1080.png
workbench/examples/ui-d2a/UI_D2A_CASES_A.xlsx
workbench/examples/ui-d2a/UI_D2A_CASES_B.xlsx
workbench/examples/ui-d2a/UI_D2A_NATIVE_SAMPLE.json
workbench/scripts/generate-ui-d2a-native-sample.mjs
workbench/scripts/generate-ui-d2a-samples.mjs
workbench/tests/ui-d2a-browser.integration.mjs
workbench/tests/ui-d2a.test.mjs
workbench/web-v2/api.js
workbench/web-v2/app.js
workbench/web-v2/index.html
workbench/web-v2/styles.css
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-22T16:30:35+08:00
Command: node --test workbench/tests/ui-d2a.test.mjs
Exit code: 0
Parsed test count: 3
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: workspace entry is a same-origin whitelist and old workbench remains available
ok 1 - workspace entry is a same-origin whitelist and old workbench remains available
  ---
  duration_ms: 59.8892
  type: 'test'
  ...
# Subtest: UI-D2A xlsx samples preserve exact source text and classifications through real parser
ok 2 - UI-D2A xlsx samples preserve exact source text and classifications through real parser
  ---
  duration_ms: 109.6447
  type: 'test'
  ...
# Subtest: committed native sample came from supported export schema and survives official import parser
ok 3 - committed native sample came from supported export schema and survives official import parser
  ---
  duration_ms: 17.5076
  type: 'test'
  ...
1..3
# tests 3
# suites 0
# pass 3
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 629.294
```

### Sync Record Status

```text
DRY-RUN: no derived changes for REQ-0031-ui-d2a-real-case-library; explicit implementation states retained, never inferred from verification.
```

### Check AI Context

- Exit code: `0`

```text
PASS ai-engineering-context checks
```

### Notes

专项入口、真实样例与正式包解析；完整真实浏览器闭环另见 workbench/docs/UI_D2A_ACCEPTANCE_REPORT.md。
