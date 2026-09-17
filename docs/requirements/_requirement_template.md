# 需求包模板

复制 `REQ-0000-template/` 并改名为 `REQ-xxxx-short-title/`。

本模板用于 G2 Standard 和 G3 Critical。符合全部资格的 G1 Quick Fix 使用 `docs/changes/_quick_fix_template.md`；存在任何不确定或高风险影响时不得使用 G1。

必需文件：

- `current_state.md`
- `change_log.md`
- `00_user_requirement.md`
- `01_development_requirement.md`
- `02_design.md`
- `03_tasks.md`
- `04_verification.md`
- `05_trace.md`

命名建议：

- `REQ-0001-login-session`
- `REQ-0002-report-export`

维护要求：

- 保留原始需求和变更记录。
- 当前有效范围与历史撤销范围分开。
- 当前有效内容只写入 `current_state.md` 和对应当前章节。
- 历史变更写入 `change_log.md`，不得污染当前有效状态。
- 每条开发需求至少关联一个设计、任务和验证项。
- 涉及代码、测试、配置、接口、日志、文案、业务行为或验收标准变更时，必须在 `02_design.md` 记录模块文档影响，并创建或更新对应 `docs/modules/<module>.md`；确实无影响时写明 `本次无需模块文档变更，原因：...`。
- `05_trace.md` 必须区分当前有效链路和历史链路。
- `05_trace.md` 映射到某 VT 的每个 DR，必须同时出现在 `04_verification.md` 及当前状态中该 VT 的 `DR` 列；验证项内容必须实际覆盖相应验收点。
- 验证结论必须有真实证据。
- G3 必须在设计中完整记录风险、回滚和人工确认。
