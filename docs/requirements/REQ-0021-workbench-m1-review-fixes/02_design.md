<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0021 设计

## 设计标识

| DD | 关联 DR | 状态 | 方案摘要 | 设计理由 |
|---|---|---|---|---|
| DD-0021-01 | DR-0021-01 | 已确认 | 在现有state中增加selectedEnvironmentId，由change事件更新；render只按允许环境校准并恢复选择，启动读取状态。 | 最小改动消除DOM重建导致的选择丢失，同时保持后端允许列表为事实源。 |
| DD-0021-02 | DR-0021-02 | 已确认 | 完整通过只允许PROCESS_ENDED正常终态，并继续叠加退出码、报告统计、目标步骤和跳过条件。 | 以明确允许条件替代仅排除CANCELLED，避免新增异常终态漏网。 |
| DD-0021-03 | DR-0021-03 | 已确认 | 错误分类优先识别严格匹配、定位目标和等待期限事实，只有成对解析出Expected与Received具体值才认定ASSERTION_MISMATCH。 | 消息出现expect并不证明已取得实际值；保持确定事实与待分析归因分离。 |
| DD-0021-04 | DR-0021-04 | 已确认 | 由同一媒体索引计算evidenceComplete，并把它作为complete_pass的并列必要条件。 | 使evidence_status与整体有效通过使用同一既定三类媒体事实，避免状态自相矛盾。 |

## 接口与数据流

- Web轮询更新资产/运行事实，但selectedEnvironmentId由用户change事件拥有；POST /api/runs只发送登记asset_id与该选择。
- executor把终态传入report分析；report同时输出原始test_status/playwright_status与受整体终态约束的summary.complete_pass。
- Playwright原错误消息经确定性errorFacts解析为类型、expected、actual与PENDING_ANALYSIS，不调用模型。
- 媒体索引仍只识别截图、录像和Trace；evidenceComplete同时驱动evidence_status及整体complete_pass，原始Playwright字段不变。

## 模块文档影响

- 更新docs/modules/test-workbench.md和workbench/README.md的证据完整性必要条件；新增workbench/docs/EVIDENCE_COMPLETENESS_REVISION.md，不改原ACCEPTANCE_REPORT.md或REVIEW_FIX_REPORT.md。

## 风险与回滚

- 前端状态与资产允许环境不一致时应回退到首个允许项，禁止发送失效值。
- 错误文本格式存在版本差异；无法成对取得值时宁可保持定位/超时/TEST_ERROR与PENDING_ANALYSIS，不夸大为值不符。
- 真实Web验证只运行一组新normal/fault；若实现缺陷则集中修复后最多重做该组合，不无改动碰运气。
- 媒体缺失是工作台证据不完整，不自动归因为产品业务缺陷；原始失败错误必须保持。
