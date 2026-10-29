<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0040 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0040-01 | DR-0040-01 | 已确认 | 人工待确认 | 不同实例ID且数据/配置摘要相同；仅旧子进程真正退出后启动新子进程。 | 工程测试独立留痕；正式功能仅使用原4322，记录新旧实例及数据配置摘要；不以fake child替代正式验收。 | 命令：npm test；退出码：0；测试数量：322；失败数量：0；跳过数量：0；证据：workbench/qa/20260927-kimi-remediation/health-refresh-final-engineering.log | npm test | 0 | 322 | 0 | 0 | workbench/qa/20260927-kimi-remediation/health-refresh-final-engineering.log |
| VT-0040-02 | DR-0040-02 | 已确认 | 人工待确认 | 活动任务、准备期、旧身份、异源、无握手均拒绝且不改变任务；在途请求与重启无竞态。 | 工程测试独立留痕；正式功能仅使用原4322，记录新旧实例及数据配置摘要；不以fake child替代正式验收。 | 命令：npm test；退出码：0；测试数量：322；失败数量：0；跳过数量：0；证据：workbench/qa/20260927-kimi-remediation/health-refresh-final-engineering.log | npm test | 0 | 322 | 0 | 0 | workbench/qa/20260927-kimi-remediation/health-refresh-final-engineering.log |
| VT-0040-03 | DR-0040-03 | 已确认 | 人工待确认 | 仅新身份、同配置数据且ready才报成功；不自动重发POST、不重放任务。 | 工程测试独立留痕；正式功能仅使用原4322，记录新旧实例及数据配置摘要；不以fake child替代正式验收。 | 命令：npm test；退出码：0；测试数量：322；失败数量：0；跳过数量：0；证据：workbench/qa/20260927-kimi-remediation/health-refresh-final-engineering.log | npm test | 0 | 322 | 0 | 0 | workbench/qa/20260927-kimi-remediation/health-refresh-final-engineering.log |
| VT-0040-04 | DR-0040-04 | 已确认 | 人工待确认 | Ctrl+C退出不重启；drain失败/子进程未退出/启动失败不宣称完成，不终止未知进程。 | 工程测试独立留痕；正式功能仅使用原4322，记录新旧实例及数据配置摘要；不以fake child替代正式验收。 | 命令：npm test；退出码：0；测试数量：322；失败数量：0；跳过数量：0；证据：workbench/qa/20260927-kimi-remediation/health-refresh-final-engineering.log | npm test | 0 | 322 | 0 | 0 | workbench/qa/20260927-kimi-remediation/health-refresh-final-engineering.log |

## 本轮命令与环境

- 工作目录：D:/01_AI工程/01_工程项目/ui-test-agent
- 命令：npm test（工程runner文件并发4）
- 环境：Windows PowerShell，原fresh-b数据及release-20260925/start.local.json配置。

## 结论

- 315项工程测试、0失败、0跳过，SHA A1A24A57D7347D342F8A31B01337DBC00ED6C14AABD34E13CC653548A6EA9862。
- 真实fake-child延迟IPC监听、相同配置重启、失败清理及防忙等工程边界已验证；不代表正式4322重启产品验收。
- 此前未限制并发的两轮分别有异步等待超时，未改oracle和等待期限；限制文件并发为4后的结果支持调度竞争解释，不证明唯一根因。
- 正式4322主管真实浏览器验证空闲托管重启成功：实例service-dafc2dbb-edac-46b7-9861-bc2225474f46切换为service-22f6c1c3-bed3-4210-960e-d6528d57eb65，data/config摘要一致、12项目文件摘要逐一不变，恢复ready且无活动任务。忙碌/并发反例仍仅有工程证据。
- 随后真实观察：UI零模型复跑结束后的-Restart未恢复且父子进程消失；原stdout不可用，不判断根因。主管经原wrapper恢复原数据/配置后CLI重启一次成功，第二次重启正在复现。
- 后续根因复核精确关联跨wrapper配置摘要变化与启动注册表共享引用污染；index传入原数组，install阶段push改变原配置。根因证据managed-config-root-cause-evidence.json。
- 代码已用structuredClone隔离启动注册表并在index接入；主管读代码，project-trial-authorization工程回归4/4（config-isolation-root-test.log）。修复尚未加载正式4322；当前service-fafd6841.../source e41...，转接命令被自动审批拒绝，未绕过。修复后正式工作台重启NOT_RUN。
- 先前service-22f6...后一次-Restart未恢复为历史失败，恢复后同一supervisor的两次CLI重启成功亦为历史事实；忙碌/并发拒绝仍仅工程证据。正式产品稳定性/整体验收未判通过。
- 修复后的最终工程回归由主管实际collector执行：npm test exit 0，用时17.493s，319 tests/pass，fail 0、skipped 0、cancelled 0；日志workbench/qa/20260927-kimi-remediation/config-isolation-final-engineering.log。
- REQ-0040托管重启专项工程日志config-isolation-restart-engineering.log为21 tests/pass，fail 0、skipped 0、cancelled 0；属于上述319项全量结果的子集，不重复相加。
- collector整体exit 1由历史REQ-0015两处文本状态问题及REQ-0038/0039/0040混合记录门禁引起；不影响npm test exit 0，但治理门禁未通过。正式4322仍运行e41源码，修复代码未加载，修复后正式重启NOT_RUN；产品验收仍人工待确认。
- 正式4322配置隔离修复路径实测：service-9edc3d10/source e189/config489，原12项目保全；新增目标b5da6df4后重启至service-d252，source/config/data一致，两目标恢复、原grant current=true。
- 同页零模型批次batch-1f4b4e8b/run trial-76e08...失败且未批准，model_calls=0、bundle不变；执行中health不可用、UI重启按钮disabled。
- app.js自动刷新修复source SHA f17cb79a...工程collector 322/322成功。正式实例service-0e80c9c1已加载source f17，config489/data bf51保持且工作台恢复。正式同页busy→idle复验batch-705b40ec/trial-a8c18...期间health unavailable/按钮disabled，页面自动转结果页后health available/按钮enabled；无手动刷新/路由切换。model_calls=0、候选未批准、bundle不变；UI ASSERTION_UNRESOLVED且两步未单采实际值，不证明业务语义完整。证据health-refresh-final-{busy,idle}文件及batch/run JSON。
- 最终全量工程回归为322/322成功，日志health-refresh-final-engineering.log；属于工程证据，不将各VT视为分别完成正式产品验收。正式主路径配置隔离重启和health刷新busy→idle交互已分别有正式4322实测。忙碌/并发拒绝仍仅工程反例；零模型候选未批准且ASSERTION_UNRESOLVED，REQ整体仍人工待确认。
