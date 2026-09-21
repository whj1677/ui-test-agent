# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-21T10:02:54+08:00`
- Record: `REQ-0023-harness-isolation-feedback`
- Change fingerprint: `5ed5d7092d929a7e23c8f2cee799c1d5dac5133631f9933305fc686af0c0fb48`
- Verification source: `collector-executed-v1`
- Verification state: `人工待确认`
- Command: `npm test --prefix harness-probe`
- Exit code: `0`
- Test count: `16`
- Failure count: `0`
- Skipped count: `0`
- Log path: `artifacts/ai-context-verification-REQ-0023-harness-isolation-feedback.log`
- Log SHA-256: `3beb730da28287beb58da1f455ab849fe097ae6e18fe957b9081e294ff22a920`

### Git Status

```text
 M README.md
 M docs/requirements/README.md
 M harness-probe/README.md
 M harness-probe/package.json
?? artifacts/ai-context-verification-REQ-0023-harness-isolation-feedback.log
?? docs/requirements/REQ-0023-harness-isolation-feedback/00_user_requirement.md
?? docs/requirements/REQ-0023-harness-isolation-feedback/01_development_requirement.md
?? docs/requirements/REQ-0023-harness-isolation-feedback/02_design.md
?? docs/requirements/REQ-0023-harness-isolation-feedback/03_tasks.md
?? docs/requirements/REQ-0023-harness-isolation-feedback/04_verification.md
?? docs/requirements/REQ-0023-harness-isolation-feedback/05_trace.md
?? docs/requirements/REQ-0023-harness-isolation-feedback/change_log.md
?? docs/requirements/REQ-0023-harness-isolation-feedback/current_state.md
?? docs/requirements/REQ-0023-harness-isolation-feedback/delivery_evidence.md
?? docs/requirements/REQ-0023-harness-isolation-feedback/requirement.source.json
?? harness-probe/M2B_ISOLATION_REPORT.md
?? harness-probe/evidence/m2b-isolation-summary.json
?? harness-probe/src/isolation-audit.mjs
?? harness-probe/tests/fixtures/isolation-child.mjs
?? harness-probe/tests/isolation-audit.test.mjs
```

### Git Diff Stat

```text
warning: in the working copy of 'README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/requirements/README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'harness-probe/README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'harness-probe/package.json', LF will be replaced by CRLF the next time Git touches it
 README.md                   | 2 +-
 docs/requirements/README.md | 2 ++
 harness-probe/README.md     | 2 +-
 harness-probe/package.json  | 1 +
 4 files changed, 5 insertions(+), 2 deletions(-)
```

### Untracked Files

```text
artifacts/ai-context-verification-REQ-0023-harness-isolation-feedback.log
docs/requirements/REQ-0023-harness-isolation-feedback/00_user_requirement.md
docs/requirements/REQ-0023-harness-isolation-feedback/01_development_requirement.md
docs/requirements/REQ-0023-harness-isolation-feedback/02_design.md
docs/requirements/REQ-0023-harness-isolation-feedback/03_tasks.md
docs/requirements/REQ-0023-harness-isolation-feedback/04_verification.md
docs/requirements/REQ-0023-harness-isolation-feedback/05_trace.md
docs/requirements/REQ-0023-harness-isolation-feedback/change_log.md
docs/requirements/REQ-0023-harness-isolation-feedback/current_state.md
docs/requirements/REQ-0023-harness-isolation-feedback/delivery_evidence.md
docs/requirements/REQ-0023-harness-isolation-feedback/requirement.source.json
harness-probe/M2B_ISOLATION_REPORT.md
harness-probe/evidence/m2b-isolation-summary.json
harness-probe/src/isolation-audit.mjs
harness-probe/tests/fixtures/isolation-child.mjs
harness-probe/tests/isolation-audit.test.mjs
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-21T10:02:51+08:00
Command: npm test --prefix harness-probe
Exit code: 0
Parsed test count: 16
Parsed failure count: 0
Parsed skipped count: 0

--- command output ---

> ui-test-agent-deepseek-harness-probe@0.1.0 test
> node --test tests/*.test.mjs

TAP version 13
# Subtest: 真实通过且至少一个测试才完整
ok 1 - 真实通过且至少一个测试才完整
  ---
  duration_ms: 1.194
  type: 'test'
  ...
# Subtest: 缺失或损坏报告不能成功
ok 2 - 缺失或损坏报告不能成功
  ---
  duration_ms: 0.1403
  type: 'test'
  ...
# Subtest: 零测试、跳过和失败不能成功
ok 3 - 零测试、跳过和失败不能成功
  ---
  duration_ms: 0.1136
  type: 'test'
  ...
# Subtest: 完整终态、浏览器工具和文件同时存在才成功
ok 4 - 完整终态、浏览器工具和文件同时存在才成功
  ---
  duration_ms: 0.7225
  type: 'test'
  ...
# Subtest: 缺文件不能标记成功
ok 5 - 缺文件不能标记成功
  ---
  duration_ms: 0.1399
  type: 'test'
  ...
# Subtest: 缺浏览器工具事实不能标记成功
ok 6 - 缺浏览器工具事实不能标记成功
  ---
  duration_ms: 0.1453
  type: 'test'
  ...
# Subtest: 模型中断或不完整报告不能标记成功
ok 7 - 模型中断或不完整报告不能标记成功
  ---
  duration_ms: 0.1213
  type: 'test'
  ...
# Subtest: 取消和超时不能标记成功
ok 8 - 取消和超时不能标记成功
  ---
  duration_ms: 0.1058
  type: 'test'
  ...
# Subtest: 日志会遮蔽密钥、Bearer和敏感字段
ok 9 - 日志会遮蔽密钥、Bearer和敏感字段
  ---
  duration_ms: 0.602
  type: 'test'
  ...
# Subtest: 文件、网络和凭据禁止项都被阻断时才允许真实修订
ok 10 - 文件、网络和凭据禁止项都被阻断时才允许真实修订
  ---
  duration_ms: 1.1231
  type: 'test'
  ...
# Subtest: 工作区外读取或写入成功会关闭总门
ok 11 - 工作区外读取或写入成功会关闭总门
  ---
  duration_ms: 0.1687
  type: 'test'
  ...
# Subtest: 候选或浏览器可访问禁止端点会关闭总门
ok 12 - 候选或浏览器可访问禁止端点会关闭总门
  ---
  duration_ms: 0.0992
  type: 'test'
  ...
# Subtest: 候选携带模型凭据会关闭总门
ok 13 - 候选携带模型凭据会关闭总门
  ---
  duration_ms: 0.0721
  type: 'test'
  ...
# Subtest: 启动失败会返回错误且不等待到期
ok 14 - 启动失败会返回错误且不等待到期
  ---
  duration_ms: 5.814
  type: 'test'
  ...
# Subtest: 超时会终止本任务拥有的进程
ok 15 - 超时会终止本任务拥有的进程
  ---
  duration_ms: 823.0454
  type: 'test'
  ...
# Subtest: 用户取消会终止本任务拥有的进程且不重启
ok 16 - 用户取消会终止本任务拥有的进程且不重启
  ---
  duration_ms: 746.914
  type: 'test'
  ...
1..16
# tests 16
# suites 0
# pass 16
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1735.7897
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

工程判定逻辑16项无失败；环境审计结论和停止点以M2-B脱敏报告为准。
