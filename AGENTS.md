<!-- ai-engineering-context:start version=2026-09-04.6 -->
# AI Engineering Context

本工程使用 ai-engineering-context；默认轻量，按影响升级。规则版本：2026-09-04.6。

- 收到任务后按实际影响静默分流；不输出分类表，不另启 Agent，不加载完整 Skill，也不先扫描整库。
- 只读咨询、注释/错字/无业务含义的展示与排版、外部行为不变的内部重构、补充已有行为测试，以及期望明确且影响局部的低风险修复，直接执行并做相应验证，不建 FIX/REQ。
- 新增或改变业务规则/验收、公开接口或配置语义、跨模块契约、权限安全、金额审批、数据迁移或删除、依赖构建部署、关键并发，或用户明确要求正式交付/完整闭环时，自动创建或复用与当前任务直接相关的真实 REQ，再读取正式流程。
- 修改行数或文件数多、缺少自动化测试、项目存在历史 REQ/FIX/治理脚本/正式门禁，均不能单独触发正式流程；不能把无关的已有需求追加为当前任务记录。
- 只有未知信息会阻塞当前请求阶段时才询问用户。正式设计/任务拆分可把未决业务语义写成互斥待确认分支并继续建包；进入代码实现或确定测试判定前，影响允许/拒绝、成功/失败或业务验收的未知项必须确认。
- 执行中首次发现实际影响扩大到正式条件时，允许重新分流一次；否则不重复判断、不追加治理步骤。
- 轻量任务只修改目标代码和必要测试；仅当用户或项目明确要求留档、或问题确需后续追踪时才更新 docs/changes/daily.md。项目事实未变化时不更新模块/环境文档。
- 轻量任务不运行状态同步、证据收集或全项目交付检查。正式交付才依次运行 scripts/sync_requirement_status.py、scripts/collect_delivery_evidence.py、scripts/check_ai_context.py。
- 正式入口先只读 `docs/requirements/README.md`，再用一次限定在 `docs/requirements/REQ-*/current_state.md` 的关键词检索寻找直接相关活动 REQ；分类阶段禁止搜索其他 docs、历史 REQ 全文、legacy、archive 或交付证据。找到即复用，找不到才新建。
- 新建 REQ 时，只有 `scripts/create_requirement.py`、`scripts/requirement_source.py` 和 `REQ-0000-template/requirement.source.json` 都存在，才执行创建器、只编辑新包内 `requirement.source.json`，再运行一次 `python scripts/requirement_source.py render --package <REQ目录名>` 生成 8 份兼容视图；禁止直接编辑生成视图。现有包没有事实源时继续按原 8 文件维护，不自动转换或覆盖。缺少任一新组件时沿用当前旧创建器，或使用一次整目录复制和一次批量替换的回退流程。
- 不展开、不修复、不在最终答复中汇报与当前任务无关的历史问题；仅在其会阻塞当前任务时简短说明。正式阶段达到用户要求的设计、实现或交付边界后立即停止。
- 用户只要求设计/任务拆分时，默认发现预算为：1 次需求索引读取、1 次仅限 `REQ-*/current_state.md` 的检索、最多 6 个直接相关代码/测试/配置文件；禁止读取生成器、模板、无关 REQ、模块索引、构建文档和交付脚本，除非缺失事实直接阻塞本阶段。
- 设计包保持最小充分：默认不超过 1 个 UN、5 个 DR、5 个设计决策、5 个任务和 5 个 VT；待确认项使用互斥分支。设计阶段不运行测试、sync、collector 或 checker，不研究门禁失败；写完当前 REQ 和索引即停止。
- 开始最多一句行动说明；轻量任务结束只简述修改、实际验证和必要限制。验证如实区分未运行、静态检查、编译、单元、集成和人工确认。
- 不自动 commit、push、tag 或发布。已选择的正式 FIX/REQ 不得为绕过门禁改成轻量；用户明确的团队安全与发布约束继续有效。

按需入口：正式实现/验证/交付才读取 docs/ai_engineering/08_ai_workflow.md、相关模块、docs/ai_engineering/04_build_test.md 和当前 REQ；只做设计/任务拆分及轻量任务无需加载全套文档。
<!-- ai-engineering-context:end version=2026-09-04.6 -->
