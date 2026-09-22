# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-22T10:03:30+08:00`
- Record: `REQ-0029-m4a-query-case`
- Change fingerprint: `dbd8f0db3fd481ccb76683512c479bc288a6c62bfa5066d2ad4bbdb28bad9db1`
- Verification source: `collector-executed-v1`
- Verification state: `集成测试通过`
- Command: `npm --prefix workbench test`
- Exit code: `0`
- Test count: `69`
- Failure count: `0`
- Skipped count: `0`
- Log path: `artifacts/ai-context-verification-REQ-0029-m4a-query-case.log`
- Log SHA-256: `0cf30348a182220e2b3618402f55ec7a50a55c18d82ab640f2e2dab5fe098aaa`

### Git Status

```text
 M docs/requirements/REQ-0029-m4a-query-case/02_design.md
 M docs/requirements/REQ-0029-m4a-query-case/03_tasks.md
 M docs/requirements/REQ-0029-m4a-query-case/04_verification.md
 M docs/requirements/REQ-0029-m4a-query-case/05_trace.md
 M docs/requirements/REQ-0029-m4a-query-case/current_state.md
 M docs/requirements/REQ-0029-m4a-query-case/requirement.source.json
 M workbench/README.md
 M workbench/scripts/run-m4a-real.ps1
?? artifacts/ai-context-verification-REQ-0029-m4a-query-case.log
?? docs/requirements/REQ-0029-m4a-query-case/delivery_evidence.md
?? workbench/docs/M4A_QUERY_CASE_MIGRATION_REPORT.md
?? workbench/docs/evidence/M4A_QUERY_CASE_REAL_WEB.png
?? workbench/scripts/save-deepseek-credential.ps1
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/requirements/REQ-0029-m4a-query-case/02_design.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0029-m4a-query-case/03_tasks.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0029-m4a-query-case/04_verification.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0029-m4a-query-case/05_trace.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0029-m4a-query-case/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0029-m4a-query-case/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'workbench/scripts/run-m4a-real.ps1', LF will be replaced by CRLF the next time Git touches it
 .../REQ-0029-m4a-query-case/02_design.md           |  2 +
 .../REQ-0029-m4a-query-case/03_tasks.md            |  4 +-
 .../REQ-0029-m4a-query-case/04_verification.md     |  8 ++--
 .../REQ-0029-m4a-query-case/05_trace.md            |  8 ++--
 .../REQ-0029-m4a-query-case/current_state.md       | 15 +++----
 .../requirement.source.json                        | 46 +++++++++++++---------
 workbench/README.md                                |  4 ++
 workbench/scripts/run-m4a-real.ps1                 | 31 +++++++++++----
 8 files changed, 76 insertions(+), 42 deletions(-)
```

### Untracked Files

```text
artifacts/ai-context-verification-REQ-0029-m4a-query-case.log
docs/requirements/REQ-0029-m4a-query-case/delivery_evidence.md
workbench/docs/M4A_QUERY_CASE_MIGRATION_REPORT.md
workbench/docs/evidence/M4A_QUERY_CASE_REAL_WEB.png
workbench/scripts/save-deepseek-credential.ps1
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-22T10:03:13+08:00
Command: npm --prefix workbench test
Exit code: 0
Parsed test count: 69
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---

> ui-test-approved-workbench@0.1.0 test
> node --test tests/*.test.mjs

TAP version 13
# Subtest: state changes require exact local origin and JSON schema
ok 1 - state changes require exact local origin and JSON schema
  ---
  duration_ms: 59.5428
  type: 'test'
  ...
# Subtest: stop route accepts only an empty JSON object from local origin
ok 2 - stop route accepts only an empty JSON object from local origin
  ---
  duration_ms: 4.4695
  type: 'test'
  ...
# Subtest: build mutations require local origin and exact fixed schemas
ok 3 - build mutations require local origin and exact fixed schemas
  ---
  duration_ms: 147.3771
  type: 'test'
  ...
# Subtest: only registered web-visible unchanged task files are served
ok 4 - only registered web-visible unchanged task files are served
  ---
  duration_ms: 23.8125
  type: 'test'
  ...
# Subtest: only registered verification media are served with integrity and range checks
ok 5 - only registered verification media are served with integrity and range checks
  ---
  duration_ms: 61.0548
  type: 'test'
  ...
# Subtest: failed candidate enables exactly one explicit revision and preserves both versions
ok 6 - failed candidate enables exactly one explicit revision and preserves both versions
  ---
  duration_ms: 355.666
  type: 'test'
  ...
# {"type":"build_storage_failure","code":"EIO","operation":"append_lifecycle","at":"2026-09-22T02:03:15.514Z"}
# Subtest: 生命周期存储持续失败会降级服务并拒绝继续接纳建例
ok 7 - 生命周期存储持续失败会降级服务并拒绝继续接纳建例
  ---
  duration_ms: 43.6169
  type: 'test'
  ...
# {"type":"build_storage_failure","code":"EIO","operation":"background_completion","at":"2026-09-22T02:03:15.585Z"}
# Subtest: 后台completion最终状态持续写失败会被观察并关闭新建例入口
ok 8 - 后台completion最终状态持续写失败会被观察并关闭新建例入口
  ---
  duration_ms: 65.8285
  type: 'test'
  ...
# Subtest: duplicate start is rejected and cancel closes the owned attempt without restart
ok 9 - duplicate start is rejected and cancel closes the owned attempt without restart
  ---
  duration_ms: 59.0356
  type: 'test'
  ...
# Subtest: 单次复验授权只在Harness进程启动事件时消耗且不改旧预算
ok 10 - 单次复验授权只在Harness进程启动事件时消耗且不改旧预算
  ---
  duration_ms: 104.0603
  type: 'test'
  ...
# Subtest: 终态等待修复验证使用独立固定授权文件且不改旧授权
ok 11 - 终态等待修复验证使用独立固定授权文件且不改旧授权
  ---
  duration_ms: 30.0899
  type: 'test'
  ...
# Subtest: candidate report parser keeps normal pass and concrete assertion mismatch separate
ok 12 - candidate report parser keeps normal pass and concrete assertion mismatch separate
  ---
  duration_ms: 14.7744
  type: 'test'
  ...
# Subtest: missing report and locator errors cannot become technical pass or specified mismatch
ok 13 - missing report and locator errors cannot become technical pass or specified mismatch
  ---
  duration_ms: 9.3333
  type: 'test'
  ...
# Subtest: associates exact task candidate and registers the same record idempotently
ok 14 - associates exact task candidate and registers the same record idempotently
  ---
  duration_ms: 123.2955
  type: 'test'
  ...
# Subtest: rejects candidate hash mismatch and does not associate media across tasks
ok 15 - rejects candidate hash mismatch and does not associate media across tasks
  ---
  duration_ms: 133.8382
  type: 'test'
  ...
# Subtest: serves only registered unchanged media with byte ranges
ok 16 - serves only registered unchanged media with byte ranges
  ---
  duration_ms: 232.4338
  type: 'test'
  ...
# Subtest: M2-C stage budget persists across task ids and store restarts
ok 17 - M2-C stage budget persists across task ids and store restarts
  ---
  duration_ms: 122.0933
  type: 'test'
  ...
# Subtest: restart marks active build interrupted without replaying it
ok 18 - restart marks active build interrupted without replaying it
  ---
  duration_ms: 157.8789
  type: 'test'
  ...
# Subtest: task状态原子替换的短暂占用有限重试后成功
ok 19 - task状态原子替换的短暂占用有限重试后成功
  ---
  duration_ms: 134.0749
  type: 'test'
  ...
# Subtest: task状态持续写失败会显式返回错误而非静默成功
ok 20 - task状态持续写失败会显式返回错误而非静默成功
  ---
  duration_ms: 661.976
  type: 'test'
  ...
# Subtest: 协调进程被终止后重启保留逐事件记录、标中断且不重放预算
ok 21 - 协调进程被终止后重启保留逐事件记录、标中断且不重放预算
  ---
  duration_ms: 799.6083
  type: 'test'
  ...
# Subtest: case library API requires local origin and serves only registered operations
ok 22 - case library API requires local origin and serves only registered operations
  ---
  duration_ms: 129.4775
  type: 'test'
  ...
# Subtest: real xlsx and native package round trip preserve fields, lineage and project isolation
ok 23 - real xlsx and native package round trip preserve fields, lineage and project isolation
  ---
  duration_ms: 408.559
  type: 'test'
  ...
# Subtest: formula cells and stale or cross-project confirmations fail closed
ok 24 - formula cells and stale or cross-project confirmations fail closed
  ---
  duration_ms: 117.5047
  type: 'test'
  ...
# Subtest: real xlsx preserves numeric-looking text, physical rows and blank columns
ok 25 - real xlsx preserves numeric-looking text, physical rows and blank columns
  ---
  duration_ms: 93.5879
  type: 'test'
  ...
# Subtest: real xlsx keeps step and expected cell-line positions instead of compacting blanks
ok 26 - real xlsx keeps step and expected cell-line positions instead of compacting blanks
  ---
  duration_ms: 28.2774
  type: 'test'
  ...
# Subtest: approved run uses fixed argument arrays and a reduced environment
ok 27 - approved run uses fixed argument arrays and a reduced environment
  ---
  duration_ms: 234.3195
  type: 'test'
  ...
# Subtest: duplicate starts are rejected and stop targets only the owned process
ok 28 - duplicate starts are rejected and stop targets only the owned process
  ---
  duration_ms: 142.8498
  type: 'test'
  ...
# Subtest: unapproved, wrong-hash, traversal and illegal environment records are refused
ok 29 - unapproved, wrong-hash, traversal and illegal environment records are refused
  ---
  duration_ms: 193.2113
  type: 'test'
  ...
# Subtest: runtime-copy integrity failure preserves the raw passing report but blocks overall pass
ok 30 - runtime-copy integrity failure preserves the raw passing report but blocks overall pass
  ---
  duration_ms: 131.0003
  type: 'test'
  ...
# Subtest: 限定首审资产使用PROBE_URL且正常入口不能越权运行受控反例
ok 31 - 限定首审资产使用PROBE_URL且正常入口不能越权运行受控反例
  ---
  duration_ms: 105.637
  type: 'test'
  ...
# Subtest: HOLD-Q1 原生包可逆保留完整原用例并通过真实导入预览确认
ok 32 - HOLD-Q1 原生包可逆保留完整原用例并通过真实导入预览确认
  ---
  duration_ms: 89.4712
  type: 'test'
  ...
# Subtest: M4-A生产组装仅向Harness传递正常输入并由控制器执行冻结q1/q2
ok 33 - M4-A生产组装仅向Harness传递正常输入并由控制器执行冻结q1/q2
  ---
  duration_ms: 196.8765
  type: 'test'
  ...
# Subtest: HOLD-Q1环境拒绝内容哈希不匹配且不创建任务或消耗授权
ok 34 - HOLD-Q1环境拒绝内容哈希不匹配且不创建任务或消耗授权
  ---
  duration_ms: 69.6988
  type: 'test'
  ...
# Subtest: M4-A仅在正常页失败时允许一次定向修订并在两次启动后耗尽
ok 35 - M4-A仅在正常页失败时允许一次定向修订并在两次启动后耗尽
  ---
  duration_ms: 258.4645
  type: 'test'
  ...
# Subtest: only indexed media for the selected run can be read
ok 36 - only indexed media for the selected run can be read
  ---
  duration_ms: 121.9068
  type: 'test'
  ...
# Subtest: changed media bytes are not served as the registered attachment
ok 37 - changed media bytes are not served as the registered attachment
  ---
  duration_ms: 8.8335
  type: 'test'
  ...
# Subtest: 真实 Excel 用例完整冻结为既有 build task，且不启动 Harness 或消耗预算
ok 38 - 真实 Excel 用例完整冻结为既有 build task，且不启动 Harness 或消耗预算
  ---
  duration_ms: 229.9093
  type: 'test'
  ...
# Subtest: v1/v2 快照独立，精确关联校验和并发幂等均 fail closed
ok 39 - v1/v2 快照独立，精确关联校验和并发幂等均 fail closed
  ---
  duration_ms: 189.8562
  type: 'test'
  ...
# Subtest: request_id 同时绑定五项请求身份，顺序、重启幂等且身份变化明确冲突
ok 40 - request_id 同时绑定五项请求身份，顺序、重启幂等且身份变化明确冲突
  ---
  duration_ms: 107.6395
  type: 'test'
  ...
# Subtest: request_id 正在处理时只复用相同身份，不同身份立即冲突
ok 41 - request_id 正在处理时只复用相同身份，不同身份立即冲突
  ---
  duration_ms: 129.3792
  type: 'test'
  ...
# Subtest: 旧任务从 source 和 environment_ref 推导身份，身份不完整时拒绝复用
ok 42 - 旧任务从 source 和 environment_ref 推导身份，身份不完整时拒绝复用
  ---
  duration_ms: 118.0325
  type: 'test'
  ...
# Subtest: M3-B2生产接线把冻结输入和渲染指令送入attempt并按作用域只消费一次授权
ok 43 - M3-B2生产接线把冻结输入和渲染指令送入attempt并按作用域只消费一次授权
  ---
  duration_ms: 542.3312
  type: 'test'
  ...
# Subtest: 两个验证侧哨兵仅进入控制器契约且合法业务原文不被字符串清洗
ok 44 - 两个验证侧哨兵仅进入控制器契约且合法业务原文不被字符串清洗
  ---
  duration_ms: 1.3375
  type: 'test'
  ...
# Subtest: M3-B2作用域冲突不创建第二任务且历史INPUT_ONLY仍不可启动
ok 45 - M3-B2作用域冲突不创建第二任务且历史INPUT_ONLY仍不可启动
  ---
  duration_ms: 145.8873
  type: 'test'
  ...
# Subtest: approved sorting asset is derived from the real frozen records
ok 46 - approved sorting asset is derived from the real frozen records
  ---
  duration_ms: 17.9998
  type: 'test'
  ...
# Subtest: hash mismatch is rejected instead of becoming a new approval
ok 47 - hash mismatch is rejected instead of becoming a new approval
  ---
  duration_ms: 8.8878
  type: 'test'
  ...
# Subtest: complete passing report requires all registered steps and all media kinds
ok 48 - complete passing report requires all registered steps and all media kinds
  ---
  duration_ms: 90.309
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when all media are missing
ok 49 - raw passing result is not an overall pass when all media are missing
  ---
  duration_ms: 20.5165
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when screenshot is missing
ok 50 - raw passing result is not an overall pass when screenshot is missing
  ---
  duration_ms: 28.4714
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when video is missing
ok 51 - raw passing result is not an overall pass when video is missing
  ---
  duration_ms: 35.4549
  type: 'test'
  ...
# Subtest: raw passing result is not an overall pass when trace is missing
ok 52 - raw passing result is not an overall pass when trace is missing
  ---
  duration_ms: 29.2235
  type: 'test'
  ...
# Subtest: assertion mismatch remains a failed test and later steps are not executed
ok 53 - assertion mismatch remains a failed test and later steps are not executed
  ---
  duration_ms: 40.5363
  type: 'test'
  ...
# Subtest: missing, corrupt, skipped and zero-target reports fail closed
ok 54 - missing, corrupt, skipped and zero-target reports fail closed
  ---
  duration_ms: 34.395
  type: 'test'
  ...
# Subtest: exit code zero cannot override an incomplete step set
ok 55 - exit code zero cannot override an incomplete step set
  ---
  duration_ms: 17.3538
  type: 'test'
  ...
# Subtest: a passing Playwright report cannot override a non-normal execution terminal state
ok 56 - a passing Playwright report cannot override a non-normal execution terminal state
  ---
  duration_ms: 83.2831
  type: 'test'
  ...
# Subtest: error facts distinguish missing targets, strict conflicts, unavailable values and real value mismatches
ok 57 - error facts distinguish missing targets, strict conflicts, unavailable values and real value mismatches
  ---
  duration_ms: 1.0275
  type: 'test'
  ...
# Subtest: 复验驱动只等待本次task终态，不被旧历史终态提前满足
ok 58 - 复验驱动只等待本次task终态，不被旧历史终态提前满足
  ---
  duration_ms: 1207.8852
  type: 'test'
  ...
# Subtest: 原扫描任意历史卡片逻辑无法通过同一task终态等待断言
ok 59 - 原扫描任意历史卡片逻辑无法通过同一task终态等待断言
  ---
  duration_ms: 864.45
  type: 'test'
  ...
# Subtest: 项目用例新版本不会自动继承旧版本的限定首审资产
ok 60 - 项目用例新版本不会自动继承旧版本的限定首审资产
  ---
  duration_ms: 1808.9541
  type: 'test'
  ...
# Subtest: 限定人工首审资产按精确任务、候选和用例版本登记并幂等保存原字节
ok 61 - 限定人工首审资产按精确任务、候选和用例版本登记并幂等保存原字节
  ---
  duration_ms: 174.151
  type: 'test'
  ...
# Subtest: 缺少有效首审、候选哈希变化或项目关联错误均拒绝登记
ok 62 - 缺少有效首审、候选哈希变化或项目关联错误均拒绝登记
  ---
  duration_ms: 166.3973
  type: 'test'
  ...
# Subtest: health endpoint reports the independent workbench
ok 63 - health endpoint reports the independent workbench
  ---
  duration_ms: 76.8922
  type: 'test'
  ...
# Subtest: unknown routes fail closed
ok 64 - unknown routes fail closed
  ---
  duration_ms: 9.7012
  type: 'test'
  ...
# Subtest: asset registration is persistent and idempotent
ok 65 - asset registration is persistent and idempotent
  ---
  duration_ms: 46.4089
  type: 'test'
  ...
# Subtest: runs remain readable and active records become interrupted after restart
ok 66 - runs remain readable and active records become interrupted after restart
  ---
  duration_ms: 53.5825
  type: 'test'
  ...
# Subtest: run ids cannot escape the data root
ok 67 - run ids cannot escape the data root
  ---
  duration_ms: 13.6548
  type: 'test'
  ...
# Subtest: workbench候选使用同一Playwright运行根并真实执行正常与反例
ok 68 - workbench候选使用同一Playwright运行根并真实执行正常与反例
  ---
  duration_ms: 10956.189
  type: 'test'
  ...
# Subtest: harness-probe默认运行根保持独立可执行
ok 69 - harness-probe默认运行根保持独立可执行
  ---
  duration_ms: 2538.5955
  type: 'test'
  ...
1..69
# tests 69
# suites 0
# pass 69
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 14645.6943
```

### Sync Record Status

```text
DRY-RUN: no derived changes for REQ-0029-m4a-query-case; explicit implementation states retained, never inferred from verification.
```

### Check AI Context

- Exit code: `0`

```text
PASS ai-engineering-context checks
```

### Notes

workbench 69/69；harness-probe 24/24另行执行通过；真实Harness 1次在首次模型请求HTTP 404，候选与业务验证未运行。
