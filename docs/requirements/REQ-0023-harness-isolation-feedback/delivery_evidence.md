# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-21T10:24:54+08:00`
- Record: `REQ-0023-harness-isolation-feedback`
- Change fingerprint: `1ade49186eed3af3918b9a345bfea4fdada2015da958dc015d7156e3e6ac01f5`
- Verification source: `collector-executed-v1`
- Verification state: `人工待确认`
- Command: `npm test --prefix harness-probe`
- Exit code: `0`
- Test count: `19`
- Failure count: `0`
- Skipped count: `0`
- Log path: `artifacts/ai-context-verification-REQ-0023-harness-isolation-feedback.log`
- Log SHA-256: `38fc56c0f23c33cb52c7f8cee5bfbd0a09ac0bce003e8030b58f8c411771e2c8`

### Git Status

```text
 M README.md
 M artifacts/ai-context-verification-REQ-0023-harness-isolation-feedback.log
 M docs/requirements/REQ-0023-harness-isolation-feedback/00_user_requirement.md
 M docs/requirements/REQ-0023-harness-isolation-feedback/02_design.md
 M docs/requirements/REQ-0023-harness-isolation-feedback/03_tasks.md
 M docs/requirements/REQ-0023-harness-isolation-feedback/04_verification.md
 M docs/requirements/REQ-0023-harness-isolation-feedback/05_trace.md
 M docs/requirements/REQ-0023-harness-isolation-feedback/change_log.md
 M docs/requirements/REQ-0023-harness-isolation-feedback/current_state.md
 M docs/requirements/REQ-0023-harness-isolation-feedback/delivery_evidence.md
 M docs/requirements/REQ-0023-harness-isolation-feedback/requirement.source.json
 M harness-probe/README.md
 M harness-probe/package.json
 M harness-probe/src/harness-runner.mjs
 M harness-probe/src/process-control.mjs
 M harness-probe/tests/harness-result.test.mjs
?? harness-probe/M2B_FEEDBACK_REVISION_REPORT.md
?? harness-probe/M2B_RUN_POLICY.md
?? harness-probe/evidence/m2b-feedback-revision-summary.json
?? harness-probe/evidence/m2b-revised-candidate.spec.mjs
?? harness-probe/fixture/wrong-output.html
?? harness-probe/src/feedback-policy.mjs
?? harness-probe/src/run-feedback-revision.mjs
?? harness-probe/src/verify-feedback-candidate.mjs
?? harness-probe/tests/feedback-policy.test.mjs
```

### Git Diff Stat

```text
warning: in the working copy of 'README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'artifacts/ai-context-verification-REQ-0023-harness-isolation-feedback.log', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0023-harness-isolation-feedback/00_user_requirement.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0023-harness-isolation-feedback/02_design.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0023-harness-isolation-feedback/03_tasks.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0023-harness-isolation-feedback/04_verification.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0023-harness-isolation-feedback/05_trace.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0023-harness-isolation-feedback/change_log.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0023-harness-isolation-feedback/current_state.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0023-harness-isolation-feedback/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/REQ-0023-harness-isolation-feedback/requirement.source.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'harness-probe/README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'harness-probe/package.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'harness-probe/src/harness-runner.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'harness-probe/src/process-control.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'harness-probe/tests/harness-result.test.mjs', LF will be replaced by CRLF the next time Git touches it
 README.md                                          |   2 +-
 ...ication-REQ-0023-harness-isolation-feedback.log |  88 +++++----
 .../00_user_requirement.md                         |   3 +
 .../02_design.md                                   |   1 +
 .../03_tasks.md                                    |   4 +-
 .../04_verification.md                             |  12 +-
 .../05_trace.md                                    |   7 +-
 .../change_log.md                                  |   2 +
 .../current_state.md                               |  15 +-
 .../delivery_evidence.md                           | 197 ++++++++++++---------
 .../requirement.source.json                        |  33 ++--
 harness-probe/README.md                            |   2 +-
 harness-probe/package.json                         |   1 +
 harness-probe/src/harness-runner.mjs               |  34 +++-
 harness-probe/src/process-control.mjs              |   2 +-
 harness-probe/tests/harness-result.test.mjs        |  14 +-
 16 files changed, 265 insertions(+), 152 deletions(-)
```

### Untracked Files

```text
harness-probe/M2B_FEEDBACK_REVISION_REPORT.md
harness-probe/M2B_RUN_POLICY.md
harness-probe/evidence/m2b-feedback-revision-summary.json
harness-probe/evidence/m2b-revised-candidate.spec.mjs
harness-probe/fixture/wrong-output.html
harness-probe/src/feedback-policy.mjs
harness-probe/src/run-feedback-revision.mjs
harness-probe/src/verify-feedback-candidate.mjs
harness-probe/tests/feedback-policy.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-21T10:24:51+08:00
Command: npm test --prefix harness-probe
Exit code: 0
Parsed test count: 19
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---

> ui-test-agent-deepseek-harness-probe@0.1.0 test
> node --test tests/*.test.mjs

TAP version 13
# Subtest: 真实通过且至少一个测试才完整
ok 1 - 真实通过且至少一个测试才完整
  ---
  duration_ms: 1.2357
  type: 'test'
  ...
# Subtest: 缺失或损坏报告不能成功
ok 2 - 缺失或损坏报告不能成功
  ---
  duration_ms: 0.1279
  type: 'test'
  ...
# Subtest: 零测试、跳过和失败不能成功
ok 3 - 零测试、跳过和失败不能成功
  ---
  duration_ms: 0.1158
  type: 'test'
  ...
# Subtest: 浏览器插件证据单独登记且不冒充候选输出
ok 4 - 浏览器插件证据单独登记且不冒充候选输出
  ---
  duration_ms: 1.1228
  type: 'test'
  ...
# Subtest: 任务目录内其他未登记文件仍被拒绝
ok 5 - 任务目录内其他未登记文件仍被拒绝
  ---
  duration_ms: 0.183
  type: 'test'
  ...
# Subtest: 完整终态、浏览器工具和文件同时存在才成功
ok 6 - 完整终态、浏览器工具和文件同时存在才成功
  ---
  duration_ms: 0.7082
  type: 'test'
  ...
# Subtest: 缺文件不能标记成功
ok 7 - 缺文件不能标记成功
  ---
  duration_ms: 0.1423
  type: 'test'
  ...
# Subtest: 缺浏览器工具事实不能标记成功
ok 8 - 缺浏览器工具事实不能标记成功
  ---
  duration_ms: 0.1491
  type: 'test'
  ...
# Subtest: 模型中断或不完整报告不能标记成功
ok 9 - 模型中断或不完整报告不能标记成功
  ---
  duration_ms: 0.1287
  type: 'test'
  ...
# Subtest: 取消和超时不能标记成功
ok 10 - 取消和超时不能标记成功
  ---
  duration_ms: 0.1157
  type: 'test'
  ...
# Subtest: 日志会遮蔽密钥、Bearer和敏感字段
ok 11 - 日志会遮蔽密钥、Bearer和敏感字段
  ---
  duration_ms: 0.7894
  type: 'test'
  ...
# Subtest: 工具调用达到上限时触发外层停止且不会超过上限
ok 12 - 工具调用达到上限时触发外层停止且不会超过上限
  ---
  duration_ms: 0.6796
  type: 'test'
  ...
# Subtest: 文件、网络和凭据禁止项都被阻断时才允许真实修订
ok 13 - 文件、网络和凭据禁止项都被阻断时才允许真实修订
  ---
  duration_ms: 1.0857
  type: 'test'
  ...
# Subtest: 工作区外读取或写入成功会关闭总门
ok 14 - 工作区外读取或写入成功会关闭总门
  ---
  duration_ms: 0.1583
  type: 'test'
  ...
# Subtest: 候选或浏览器可访问禁止端点会关闭总门
ok 15 - 候选或浏览器可访问禁止端点会关闭总门
  ---
  duration_ms: 0.1074
  type: 'test'
  ...
# Subtest: 候选携带模型凭据会关闭总门
ok 16 - 候选携带模型凭据会关闭总门
  ---
  duration_ms: 0.082
  type: 'test'
  ...
# Subtest: 启动失败会返回错误且不等待到期
ok 17 - 启动失败会返回错误且不等待到期
  ---
  duration_ms: 6.6216
  type: 'test'
  ...
# Subtest: 超时会终止本任务拥有的进程
ok 18 - 超时会终止本任务拥有的进程
  ---
  duration_ms: 803.9253
  type: 'test'
  ...
# Subtest: 用户取消会终止本任务拥有的进程且不重启
ok 19 - 用户取消会终止本任务拥有的进程且不重启
  ---
  duration_ms: 729.1469
  type: 'test'
  ...
1..19
# tests 19
# suites 0
# pass 19
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1708.9451
```

### Sync Record Status

```text
DRY-RUN: no derived changes for REQ-0023-harness-isolation-feedback; explicit implementation states retained, never inferred from verification.
```

### Check AI Context

- Exit code: `0`

```text
PASS ai-engineering-context checks
```

### Notes

Harness仅启动1次；同一候选正常1/1通过、独立反例1/1产生预期断言不符；原隔离失败与首次适配误拒记录均保留。
