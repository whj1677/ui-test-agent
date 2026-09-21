# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-21T22:20:53+08:00`
- Record: `REQ-0028-workbench-m3c-reviewed-asset-run`
- Change fingerprint: `9ada43927ad2c394e92aafdca697a9745ecd569218e38039af261cc3ff25f3c2`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `npm --prefix workbench test`
- Exit code: `0`
- Test count: `65`
- Failure count: `0`
- Skipped count: `0`
- Log path: `docs/requirements/REQ-0028-workbench-m3c-reviewed-asset-run/final-verification.log`
- Log SHA-256: `fb9b48249c4c0da2923e9e3558b86609bfbe11a5422914a8d68f6b99da667351`

### Git Status

```text
 M docs/modules/test-workbench.md
 M docs/modules/workbench-case-library.md
 M docs/requirements/README.md
 M workbench/README.md
 M workbench/package.json
 M workbench/server/executor.mjs
 M workbench/server/index.mjs
 M workbench/server/paths.mjs
 M workbench/server/store.mjs
 M workbench/tests/executor.test.mjs
 M workbench/web/app.js
 M workbench/web/index.html
?? docs/requirements/REQ-0028-workbench-m3c-reviewed-asset-run/00_user_requirement.md
?? docs/requirements/REQ-0028-workbench-m3c-reviewed-asset-run/01_development_requirement.md
?? docs/requirements/REQ-0028-workbench-m3c-reviewed-asset-run/02_design.md
?? docs/requirements/REQ-0028-workbench-m3c-reviewed-asset-run/03_tasks.md
?? docs/requirements/REQ-0028-workbench-m3c-reviewed-asset-run/04_verification.md
?? docs/requirements/REQ-0028-workbench-m3c-reviewed-asset-run/05_trace.md
?? docs/requirements/REQ-0028-workbench-m3c-reviewed-asset-run/change_log.md
?? docs/requirements/REQ-0028-workbench-m3c-reviewed-asset-run/current_state.md
?? docs/requirements/REQ-0028-workbench-m3c-reviewed-asset-run/delivery_evidence.md
?? docs/requirements/REQ-0028-workbench-m3c-reviewed-asset-run/final-verification.log
?? docs/requirements/REQ-0028-workbench-m3c-reviewed-asset-run/logs/harness-probe-tests.log
?? docs/requirements/REQ-0028-workbench-m3c-reviewed-asset-run/logs/workbench-tests.log
?? docs/requirements/REQ-0028-workbench-m3c-reviewed-asset-run/requirement.source.json
?? workbench/docs/M3C_REVIEWED_ASSET_RUN_REPORT.md
?? workbench/docs/evidence/M3C_REVIEWED_ASSET_COUNTEREXAMPLE_WEB.png
?? workbench/docs/evidence/M3C_REVIEWED_ASSET_NORMAL_WEB.png
?? workbench/server/register-reviewed-asset.mjs
?? workbench/server/reviewed-asset.mjs
?? workbench/tests/reviewed-asset-browser.integration.test.mjs
?? workbench/tests/reviewed-asset-real.integration.mjs
?? workbench/tests/reviewed-asset.test.mjs
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/modules/test-workbench.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/modules/workbench-case-library.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/package.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/executor.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/index.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/paths.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/server/store.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/tests/executor.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/web/app.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/web/index.html', LF will be replaced by CRLF the next time Git touches it
 docs/modules/test-workbench.md         |  4 +-
 docs/modules/workbench-case-library.md |  5 ++
 docs/requirements/README.md            |  2 +
 workbench/README.md                    |  9 +++-
 workbench/package.json                 |  2 +
 workbench/server/executor.mjs          | 88 +++++++++++++++++++++++++---------
 workbench/server/index.mjs             |  2 +-
 workbench/server/paths.mjs             |  3 ++
 workbench/server/store.mjs             | 12 ++++-
 workbench/tests/executor.test.mjs      | 59 ++++++++++++++++++++++-
 workbench/web/app.js                   | 56 +++++++++++++++++++++-
 workbench/web/index.html               |  1 +
 12 files changed, 215 insertions(+), 28 deletions(-)
```

### Untracked Files

```text
docs/requirements/REQ-0028-workbench-m3c-reviewed-asset-run/00_user_requirement.md
docs/requirements/REQ-0028-workbench-m3c-reviewed-asset-run/01_development_requirement.md
docs/requirements/REQ-0028-workbench-m3c-reviewed-asset-run/02_design.md
docs/requirements/REQ-0028-workbench-m3c-reviewed-asset-run/03_tasks.md
docs/requirements/REQ-0028-workbench-m3c-reviewed-asset-run/04_verification.md
docs/requirements/REQ-0028-workbench-m3c-reviewed-asset-run/05_trace.md
docs/requirements/REQ-0028-workbench-m3c-reviewed-asset-run/change_log.md
docs/requirements/REQ-0028-workbench-m3c-reviewed-asset-run/current_state.md
docs/requirements/REQ-0028-workbench-m3c-reviewed-asset-run/delivery_evidence.md
docs/requirements/REQ-0028-workbench-m3c-reviewed-asset-run/final-verification.log
docs/requirements/REQ-0028-workbench-m3c-reviewed-asset-run/logs/harness-probe-tests.log
docs/requirements/REQ-0028-workbench-m3c-reviewed-asset-run/logs/workbench-tests.log
docs/requirements/REQ-0028-workbench-m3c-reviewed-asset-run/requirement.source.json
workbench/docs/M3C_REVIEWED_ASSET_RUN_REPORT.md
workbench/docs/evidence/M3C_REVIEWED_ASSET_COUNTEREXAMPLE_WEB.png
workbench/docs/evidence/M3C_REVIEWED_ASSET_NORMAL_WEB.png
workbench/server/register-reviewed-asset.mjs
workbench/server/reviewed-asset.mjs
workbench/tests/reviewed-asset-browser.integration.test.mjs
workbench/tests/reviewed-asset-real.integration.mjs
workbench/tests/reviewed-asset.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-21T22:20:32+08:00
Command: npm --prefix workbench test
Exit code: 0
Parsed test count: 65
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---

> ui-test-approved-workbench@0.1.0 test
> node --test tests/*.test.mjs

TAP version 13
# Subtest: state changes require exact local origin and JSON schema
ok 1 - state changes require exact local origin and JSON schema
  ---
  duration_ms: 145.4673
  type: 'test'
  ...
# Subtest: stop route accepts only an empty JSON object from local origin
ok 2 - stop route accepts only an empty JSON object from local origin
  ---
  duration_ms: 13.2667
  type: 'test'
  ...
# Subtest: build mutations require local origin and exact fixed schemas
ok 3 - build mutations require local origin and exact fixed schemas
  ---
  duration_ms: 306.9697
  type: 'test'
  ...
# Subtest: only registered web-visible unchanged task files are served
ok 4 - only registered web-visible unchanged task files are served
  ---
  duration_ms: 131.3209
  type: 'test'
  ...
# Subtest: only registered verification media are served with integrity and range checks
ok 5 - only registered verification media are served with integrity and range checks
  ---
  duration_ms: 186.9292
  type: 'test'
  ...
# Subtest: failed candidate enables exactly one explicit revision and preserves both versions
ok 6 - failed candidate enables exactly one explicit revision and preserves both versions
  ---
  duration_ms: 618.6958
  type: 'test'
  ...
# {"type":"build_storage_failure","code":"EIO","operation":"append_lifecycle","at":"2026-09-21T14:20:35.327Z"}
# Subtest: 生命周期存储持续失败会降级服务并拒绝继续接纳建例
ok 7 - 生命周期存储持续失败会降级服务并拒绝继续接纳建例
  ---
  duration_ms: 93.5216
  type: 'test'
  ...
# {"type":"build_storage_failure","code":"EIO","operation":"background_completion","at":"2026-09-21T14:20:35.453Z"}
# Subtest: 后台completion最终状态持续写失败会被观察并关闭新建例入口
ok 8 - 后台completion最终状态持续写失败会被观察并关闭新建例入口
  ---
  duration_ms: 119.0834
  type: 'test'
  ...
# Subtest: duplicate start is rejected and cancel closes the owned attempt without restart
ok 9 - duplicate start is rejected and cancel closes the owned attempt without restart
  ---
  duration_ms: 105.9883
  type: 'test'
  ...
# Subtest: 单次复验授权只在Harness进程启动事件时消耗且不改旧预算
ok 10 - 单次复验授权只在Harness进程启动事件时消耗且不改旧预算
  ---
  duration_ms: 171.8418
  type: 'test'
  ...
# Subtest: 终态等待修复验证使用独立固定授权文件且不改旧授权
ok 11 - 终态等待修复验证使用独立固定授权文件且不改旧授权
  ---
  duration_ms: 48.7649
  type: 'test'
  ...
# Subtest: candidate report parser keeps normal pass and concrete assertion mismatch separate
ok 12 - candidate report parser keeps normal pass and concrete assertion mismatch separate
  ---
  duration_ms: 29.1447
  type: 'test'
  ...
# Subtest: missing report and locator errors cannot become technical pass or specified mismatch
ok 13 - missing report and locator errors cannot become technical pass or specified mismatch
  ---
  duration_ms: 109.403
  type: 'test'
  ...
# Subtest: associates exact task candidate and registers the same record idempotently
ok 14 - associates exact task candidate and registers the same record idempotently
  ---
  duration_ms: 672.5169
  type: 'test'
  ...
# Subtest: rejects candidate hash mismatch and does not associate media across tasks
ok 15 - rejects candidate hash mismatch and does not associate media across tasks
  ---
  duration_ms: 208.6034
  type: 'test'
  ...
# Subtest: serves only registered unchanged media with byte ranges
ok 16 - serves only registered unchanged media with byte ranges
  ---
  duration_ms: 398.5475
  type: 'test'
  ...
# Subtest: M2-C stage budget persists across task ids and store restarts
ok 17 - M2-C stage budget persists across task ids and store restarts
  ---
  duration_ms: 197.6774
  type: 'test'
  ...
# Subtest: restart marks active build interrupted without replaying it
ok 18 - restart marks active build interrupted without replaying it
  ---
  duration_ms: 299.9213
  type: 'test'
  ...
# Subtest: task状态原子替换的短暂占用有限重试后成功
ok 19 - task状态原子替换的短暂占用有限重试后成功
  ---
  duration_ms: 211.9745
  type: 'test'
  ...
# Subtest: task状态持续写失败会显式返回错误而非静默成功
ok 20 - task状态持续写失败会显式返回错误而非静默成功
  ---
  duration_ms: 724.0407
  type: 'test'
  ...
# Subtest: 协调进程被终止后重启保留逐事件记录、标中断且不重放预算
ok 21 - 协调进程被终止后重启保留逐事件记录、标中断且不重放预算
  ---
  duration_ms: 1148.0482
  type: 'test'
  ...
# Subtest: case library API requires local origin and serves only registered operations
ok 22 - case library API requires local origin and serves only registered operations
  ---
  duration_ms: 304.9666
  type: 'test'
  ...
# Subtest: real xlsx and native package round trip preserve fields, lineage and project isolation
ok 23 - real xlsx and native package round trip preserve fields, lineage and project isolation
  ---
  duration_ms: 754.9308
  type: 'test'
  ...
# Subtest: formula cells and stale or cross-project confirmations fail closed
ok 24 - formula cells and stale or cross-project confirmations fail closed
  ---
  duration_ms: 190.6205
  type: 'test'
  ...
# Subtest: real xlsx preserves numeric-looking text, physical rows and blank columns
ok 25 - real xlsx preserves numeric-looking text, physical rows and blank columns
  ---
  duration_ms: 187.5576
  type: 'test'
  ...
# Subtest: real xlsx keeps step and expected cell-line positions instead of compacting blanks
ok 26 - real xlsx keeps step and expected cell-line positions instead of compacting blanks
  ---
  duration_ms: 26.2939
  type: 'test'
  ...
# Subtest: approved run uses fixed argument arrays and a reduced environment
ok 27 - approved run uses fixed argument arrays and a reduced environment
  ---
  duration_ms: 240.1116
  type: 'test'
  ...
# Subtest: duplicate starts are rejected and stop targets only the owned process
ok 28 - duplicate starts are rejected and stop targets only the owned process
  ---
  duration_ms: 254.4976
  type: 'test'
  ...
# Subtest: unapproved, wrong-hash, traversal and illegal environment records are refused
ok 29 - unapproved, wrong-hash, traversal and illegal environment records are refused
  ---
  duration_ms: 209.0083
  type: 'test'
  ...
# Subtest: runtime-copy integrity failure preserves the raw passing report but blocks overall pass
ok 30 - runtime-copy integrity failure preserves the raw passing report but blocks overall pass
  ---
  duration_ms: 401.2237
  type: 'test'
  ...
# Subtest: 限定首审资产使用PROBE_URL且正常入口不能越权运行受控反例
ok 31 - 限定首审资产使用PROBE_URL且正常入口不能越权运行受控反例
  ---
  duration_ms: 242.843
  type: 'test'
  ...
# Subtest: only indexed media for the selected run can be read
ok 32 - only indexed media for the selected run can be read
  ---
  duration_ms: 339.3862
  type: 'test'
  ...
# Subtest: changed media bytes are not served as the registered attachment
ok 33 - changed media bytes are not served as the registered attachment
  ---
  duration_ms: 12.4334
  type: 'test'
  ...
# Subtest: 真实 Excel 用例完整冻结为既有 build task，且不启动 Harness 或消耗预算
ok 34 - 真实 Excel 用例完整冻结为既有 build task，且不启动 Harness 或消耗预算
  ---
  duration_ms: 441.4655
  type: 'test'
  ...
# Subtest: v1/v2 快照独立，精确关联校验和并发幂等均 fail closed
ok 35 - v1/v2 快照独立，精确关联校验和并发幂等均 fail closed
  ---
  duration_ms: 344.7106
  type: 'test'
  ...
# Subtest: request_id 同时绑定五项请求身份，顺序、重启幂等且身份变化明确冲突
ok 36 - request_id 同时绑定五项请求身份，顺序、重启幂等且身份变化明确冲突
  ---
  duration_ms: 191.1342
  type: 'test'
  ...
# Subtest: request_id 正在处理时只复用相同身份，不同身份立即冲突
ok 37 - request_id 正在处理时只复用相同身份，不同身份立即冲突
  ---
  duration_ms: 197.6776
  type: 'test'
  ...
# Subtest: 旧任务从 source 和 environment_ref 推导身份，身份不完整时拒绝复用
ok 38 - 旧任务从 source 和 environment_ref 推导身份，身份不完整时拒绝复用
  ---
  duration_ms: 223.2127
  type: 'test'
  ...
# Subtest: M3-B2生产接线把冻结输入和渲染指令送入attempt并按作用域只消费一次授权
ok 39 - M3-B2生产接线把冻结输入和渲染指令送入attempt并按作用域只消费一次授权
  ---
  duration_ms: 980.5777
  type: 'test'
  ...
# Subtest: 两个验证侧哨兵仅进入控制器契约且合法业务原文不被字符串清洗
ok 40 - 两个验证侧哨兵仅进入控制器契约且合法业务原文不被字符串清洗
  ---
  duration_ms: 2.4824
  type: 'test'
  ...
# Subtest: M3-B2作用域冲突不创建第二任务且历史INPUT_ONLY仍不可启动
ok 41 - M3-B2作用域冲突不创建第二任务且历史INPUT_ONLY仍不可启动
  ---
  duration_ms: 231.0999
  type: 'test'
  ...
# Subtest: approved sorting asset is derived from the real frozen records
ok 42 - approved sorting asset is derived from the real frozen records
  ---
  duration_ms: 47.9161
  type: 'test'
  ...
# Subtest: hash mismatch is rejected instead of becoming a new approval
ok 43 - hash mismatch is rejected instead of becoming a new approval
  ---
  duration_ms: 38.4426
  type: 'test'
  ...
# Subtest: complete passing report requires all registered steps and all media kinds
ok 44 - complete passing report requires all registered steps and all media kinds
  ---
  duration_ms: 91.7384
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when all media are missing
ok 45 - raw passing result is not an overall pass when all media are missing
  ---
  duration_ms: 43.9426
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when screenshot is missing
ok 46 - raw passing result is not an overall pass when screenshot is missing
  ---
  duration_ms: 37.5704
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when video is missing
ok 47 - raw passing result is not an overall pass when video is missing
  ---
  duration_ms: 89.7433
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when trace is missing
ok 48 - raw passing result is not an overall pass when trace is missing
  ---
  duration_ms: 48.2119
  type: 'test'
  ...
# Subtest: assertion mismatch remains a failed test and later steps are not executed
ok 49 - assertion mismatch remains a failed test and later steps are not executed
  ---
  duration_ms: 57.3907
  type: 'test'
  ...
# Subtest: missing, corrupt, skipped and zero-target reports fail closed
ok 50 - missing, corrupt, skipped and zero-target reports fail closed
  ---
  duration_ms: 46.5184
  type: 'test'
  ...
# Subtest: exit code zero cannot override an incomplete step set
ok 51 - exit code zero cannot override an incomplete step set
  ---
  duration_ms: 5.5665
  type: 'test'
  ...
# Subtest: a passing Playwright report cannot override a non-normal execution terminal state
ok 52 - a passing Playwright report cannot override a non-normal execution terminal state
  ---
  duration_ms: 329.6663
  type: 'test'
  ...
# Subtest: error facts distinguish missing targets, strict conflicts, unavailable values and real value mismatches
ok 53 - error facts distinguish missing targets, strict conflicts, unavailable values and real value mismatches
  ---
  duration_ms: 1.7459
  type: 'test'
  ...
# Subtest: 复验驱动只等待本次task终态，不被旧历史终态提前满足
ok 54 - 复验驱动只等待本次task终态，不被旧历史终态提前满足
  ---
  duration_ms: 1830.8498
  type: 'test'
  ...
# Subtest: 原扫描任意历史卡片逻辑无法通过同一task终态等待断言
ok 55 - 原扫描任意历史卡片逻辑无法通过同一task终态等待断言
  ---
  duration_ms: 1198.5236
  type: 'test'
  ...
# Subtest: 项目用例新版本不会自动继承旧版本的限定首审资产
ok 56 - 项目用例新版本不会自动继承旧版本的限定首审资产
  ---
  duration_ms: 2666.8555
  type: 'test'
  ...
# Subtest: 限定人工首审资产按精确任务、候选和用例版本登记并幂等保存原字节
ok 57 - 限定人工首审资产按精确任务、候选和用例版本登记并幂等保存原字节
  ---
  duration_ms: 349.4236
  type: 'test'
  ...
# Subtest: 缺少有效首审、候选哈希变化或项目关联错误均拒绝登记
ok 58 - 缺少有效首审、候选哈希变化或项目关联错误均拒绝登记
  ---
  duration_ms: 248.2822
  type: 'test'
  ...
# Subtest: health endpoint reports the independent workbench
ok 59 - health endpoint reports the independent workbench
  ---
  duration_ms: 121.2532
  type: 'test'
  ...
# Subtest: unknown routes fail closed
ok 60 - unknown routes fail closed
  ---
  duration_ms: 22.4348
  type: 'test'
  ...
# Subtest: asset registration is persistent and idempotent
ok 61 - asset registration is persistent and idempotent
  ---
  duration_ms: 98.2096
  type: 'test'
  ...
# Subtest: runs remain readable and active records become interrupted after restart
ok 62 - runs remain readable and active records become interrupted after restart
  ---
  duration_ms: 128.0751
  type: 'test'
  ...
# Subtest: run ids cannot escape the data root
ok 63 - run ids cannot escape the data root
  ---
  duration_ms: 66.9245
  type: 'test'
  ...
# Subtest: workbench候选使用同一Playwright运行根并真实执行正常与反例
ok 64 - workbench候选使用同一Playwright运行根并真实执行正常与反例
  ---
  duration_ms: 13334.1655
  type: 'test'
  ...
# Subtest: harness-probe默认运行根保持独立可执行
ok 65 - harness-probe默认运行根保持独立可执行
  ---
  duration_ms: 3352.4726
  type: 'test'
  ...
1..65
# tests 65
# suites 0
# pass 65
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 18645.622
```

### Sync Record Status

```text
DRY-RUN: no derived changes for REQ-0028-workbench-m3c-reviewed-asset-run; explicit implementation states retained, never inferred from verification.
```

### Check AI Context

- Exit code: `0`

```text
PASS ai-engineering-context checks
```

### Notes

M3-C真实Web验收另见workbench/docs/M3C_REVIEWED_ASSET_RUN_REPORT.md；Harness与模型调用均为0。
