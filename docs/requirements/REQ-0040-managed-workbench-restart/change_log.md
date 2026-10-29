<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0040 变更记录

| 日期 | 版本 | 类型 | 变更内容 | 影响 | 确认人 |
|---|---:|---|---|---|---|
| 2026-09-27 | 1 | 新建 | 按用户授权确定托管重启架构并进入有限实现。 | 原launcher、生命周期、工作台入口 | 用户授权，主管设计 |
| 2026-09-27 | 2 | 实现与工程验证 | 托管后端、受控入口、UI有界等待及兼容处理完成；315项工程测试成功，真实转换待验证。 | 启动与重启、工程runner并发控制 | 主管独立代码审查和执行 |
| 2026-09-27 | 3 | 正式4322托管空闲重启主路径验收 | 补录真实4322空闲主路径成功、随后一次重启未恢复且根因未定、wrapper恢复后同一supervisor连续两次CLI重启成功；不把恢复后成功外推为稳定性或整体验收通过。 | REQ-0040空闲主路径从工程实现进入正式工作台实测；不宣称全矩阵产品验收通过。 | workbench/qa/20260927-kimi-remediation/managed-restart-supervisor-review.json与managed-restart-restored.png。 |
| 2026-09-27 | 4 | 配置污染根因修复与正式验证待执行 | 根因证据确认启动注册表数组共享引用被install阶段push污染；代码以structuredClone隔离并接入，工程回归4/4。自动审批阻止正式4322转接，未绕过；修复后正式加载与重启验证NOT_RUN。 | 启动身份配置隔离；正式工作台验证仍待执行，忙碌/并发仍只有工程证据。 | workbench/qa/20260927-kimi-remediation/managed-config-root-cause-evidence.json、config-isolation-root-test.log及主管代码审查；正式实例状态由主管观察 |
| 2026-09-27 | 4 | 最终工程回归结果补录 | 补记配置隔离修复后319项全量工程回归成功及REQ-0040专项21项成功（为319子集，不相加）；治理collector整体因历史/混合记录门禁exit 1。正式4322仍未加载修复，正式重启NOT_RUN。 | 仅工程证据更新；产品验证与最终验收状态不变。 | workbench/qa/20260927-kimi-remediation/config-isolation-final-engineering.log、config-isolation-restart-engineering.log及主管collector结果 |
| 2026-09-27 | 5 | 正式配置隔离复验及UI刷新缺口记录 | 记录正式4322在隔离修复后新增第二目标并重启成功、原配置数据和grant保持；同时记录零模型未批准批次期间health不可用及重启按钮禁用。app.js自动刷新修复通过322项工程回归，但尚未加载正式4322，同页复验NOT_RUN。 | 配置隔离主路径已有正式证据；页面自动刷新恢复行为仍未正式验证，产品整体验收未完成。 | 主管真实界面观察、实例/source/config标识及workbench/qa/20260927-kimi-remediation/health-refresh-final-engineering.log |
| 2026-09-27 | 5 | 正式加载边界更新 | 补记新实例0e80c9c1已加载health刷新source f17，config489/data bf51保持且工作台恢复。具体弹窗确认动作无法归因；busy→idle按钮自动恢复同页复验仍待终态。 | 代码正式加载已确认，特定交互稳定性及整体验收未确认。 | workbench/qa/20260927-kimi-remediation/health-refresh-loaded-health.json及主管只读浏览器观察 |
| 2026-09-27 | 5 | 正式同页健康刷新复验 | 同一4322页面不手动刷新/切路由，真实复验busy期间health unavailable、按钮disabled，自动转终态结果页后health available、按钮enabled。零模型候选未批准且ASSERTION_UNRESOLVED，不据此宣称业务语义通过。 | 确认加载后的UI健康刷新与按钮恢复行为；业务候选及产品整体验收仍未批准。 | health-refresh-final-busy/idle证据及batch/run JSON |

历史记录只保留在本文件；已撤销或已替换内容不得继续出现在当前任务、验证和当前 trace 中。
