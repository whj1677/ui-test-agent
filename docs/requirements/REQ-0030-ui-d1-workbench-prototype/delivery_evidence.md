# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-22T14:31:02+08:00`
- Record: `REQ-0030-ui-d1-workbench-prototype`
- Change fingerprint: `b573b612078a121ffb934982b384667ea138bc4723cd289180f6b264b0bd87ee`
- Verification source: `collector-executed-v1`
- Verification state: `单元测试通过`
- Command: `node --test workbench/ui-prototype/prototype.test.mjs`
- Exit code: `0`
- Test count: `6`
- Failure count: `0`
- Skipped count: `0`
- Log path: `docs/requirements/REQ-0030-ui-d1-workbench-prototype/evidence/ui-d1-sandstone-tests.log`
- Log SHA-256: `9312585743c5643b975211d2d5026dac52e61efffdc5070520543611de3d0cad`

### Git Status

```text
 M docs/requirements/REQ-0030-ui-d1-workbench-prototype/00_user_requirement.md
 M docs/requirements/REQ-0030-ui-d1-workbench-prototype/01_development_requirement.md
 M docs/requirements/REQ-0030-ui-d1-workbench-prototype/02_design.md
 M docs/requirements/REQ-0030-ui-d1-workbench-prototype/03_tasks.md
 M docs/requirements/REQ-0030-ui-d1-workbench-prototype/04_verification.md
 M docs/requirements/REQ-0030-ui-d1-workbench-prototype/05_trace.md
 M docs/requirements/REQ-0030-ui-d1-workbench-prototype/change_log.md
 M docs/requirements/REQ-0030-ui-d1-workbench-prototype/current_state.md
 M docs/requirements/REQ-0030-ui-d1-workbench-prototype/delivery_evidence.md
 M docs/requirements/REQ-0030-ui-d1-workbench-prototype/requirement.source.json
 M workbench/ui-prototype/DESIGN_NOTES.md
 M workbench/ui-prototype/README.md
 M workbench/ui-prototype/UI_D1_ACCEPTANCE_REPORT.md
 M workbench/ui-prototype/app.js
 M workbench/ui-prototype/assets/result-failed.svg
 M workbench/ui-prototype/assets/result-normal.svg
 M workbench/ui-prototype/prototype.test.mjs
 M workbench/ui-prototype/styles.css
?? docs/requirements/REQ-0030-ui-d1-workbench-prototype/evidence/ui-d1-sandstone-tests.log
?? workbench/ui-prototype/API_MAPPING.md
?? workbench/ui-prototype/demo-data.js
?? workbench/ui-prototype/screenshots/01-projects.png
?? workbench/ui-prototype/screenshots/02-project-cases.png
?? workbench/ui-prototype/screenshots/03-import-preview.png
?? workbench/ui-prototype/screenshots/04-case-detail.png
?? workbench/ui-prototype/screenshots/05-build-task-detail.png
?? workbench/ui-prototype/screenshots/06-run-result-detail.png
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/requirements/REQ-0030-ui-d1-workbench-prototype/00_user_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0030-ui-d1-workbench-prototype/01_development_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0030-ui-d1-workbench-prototype/02_design.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0030-ui-d1-workbench-prototype/03_tasks.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0030-ui-d1-workbench-prototype/04_verification.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0030-ui-d1-workbench-prototype/05_trace.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0030-ui-d1-workbench-prototype/change_log.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0030-ui-d1-workbench-prototype/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0030-ui-d1-workbench-prototype/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0030-ui-d1-workbench-prototype/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/ui-prototype/DESIGN_NOTES.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/ui-prototype/README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/ui-prototype/UI_D1_ACCEPTANCE_REPORT.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/ui-prototype/app.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/ui-prototype/assets/result-failed.svg', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/ui-prototype/assets/result-normal.svg', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/ui-prototype/prototype.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/ui-prototype/styles.css', LF will be replaced by CRLF the next time Git touches it
 .../00_user_requirement.md                         |   6 +-
 .../01_development_requirement.md                  |  10 +-
 .../02_design.md                                   |   8 +-
 .../REQ-0030-ui-d1-workbench-prototype/03_tasks.md |   2 +-
 .../04_verification.md                             |  14 +-
 .../REQ-0030-ui-d1-workbench-prototype/05_trace.md |   3 +-
 .../change_log.md                                  |   1 +
 .../current_state.md                               |  18 +-
 .../delivery_evidence.md                           | 190 +++---
 .../requirement.source.json                        |  63 +-
 workbench/ui-prototype/DESIGN_NOTES.md             |  66 +-
 workbench/ui-prototype/README.md                   |  42 +-
 workbench/ui-prototype/UI_D1_ACCEPTANCE_REPORT.md  |  71 +-
 workbench/ui-prototype/app.js                      | 750 ++++++++++-----------
 workbench/ui-prototype/assets/result-failed.svg    |  28 +-
 workbench/ui-prototype/assets/result-normal.svg    |  30 +-
 workbench/ui-prototype/prototype.test.mjs          |  59 +-
 workbench/ui-prototype/styles.css                  | 407 +++++------
 18 files changed, 877 insertions(+), 891 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0030-ui-d1-workbench-prototype/evidence/ui-d1-sandstone-tests.log
workbench/ui-prototype/API_MAPPING.md
workbench/ui-prototype/demo-data.js
workbench/ui-prototype/screenshots/01-projects.png
workbench/ui-prototype/screenshots/02-project-cases.png
workbench/ui-prototype/screenshots/03-import-preview.png
workbench/ui-prototype/screenshots/04-case-detail.png
workbench/ui-prototype/screenshots/05-build-task-detail.png
workbench/ui-prototype/screenshots/06-run-result-detail.png
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-22T14:31:00+08:00
Command: node --test workbench/ui-prototype/prototype.test.mjs
Exit code: 0
Parsed test count: 6
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---
TAP version 13
# Subtest: 演示边界明确且不调用正式API
ok 1 - 演示边界明确且不调用正式API
  ---
  duration_ms: 0.8106
  type: 'test'
  ...
# Subtest: 六个核心界面都有独立路由和业务内容
ok 2 - 六个核心界面都有独立路由和业务内容
  ---
  duration_ms: 0.4985
  type: 'test'
  ...
# Subtest: 演示数据覆盖高密度、空项目、跨项目同编号和分层状态
ok 3 - 演示数据覆盖高密度、空项目、跨项目同编号和分层状态
  ---
  duration_ms: 4.341
  type: 'test'
  ...
# Subtest: 导入预览、幂等与明确冲突选择均有确定性交互
ok 4 - 导入预览、幂等与明确冲突选择均有确定性交互
  ---
  duration_ms: 0.2349
  type: 'test'
  ...
# Subtest: 结果页保留原始事实且步骤切换不重建视频
ok 5 - 结果页保留原始事实且步骤切换不重建视频
  ---
  duration_ms: 0.1582
  type: 'test'
  ...
# Subtest: 砂岩陶土主题使用附件指定关键色值且能力映射不伪装缺失项
ok 6 - 砂岩陶土主题使用附件指定关键色值且能力映射不伪装缺失项
  ---
  duration_ms: 0.2476
  type: 'test'
  ...
1..6
# tests 6
# suites 0
# pass 6
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 120.7015
```

### Sync Record Status

```text
DRY-RUN: no derived changes for REQ-0030-ui-d1-workbench-prototype; explicit implementation states retained, never inferred from verification.
```

### Check AI Context

- Exit code: `0`

```text
PASS ai-engineering-context checks
```

### Notes

砂岩陶土六屏静态契约与数据边界测试；浏览器A/B/C流程、录像播放暂停拖动及18组三尺寸布局另见UI_D1_ACCEPTANCE_REPORT.md。
