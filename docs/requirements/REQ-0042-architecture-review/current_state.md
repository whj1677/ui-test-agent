<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0042 当前状态

- 需求标题：软件架构与冗余审查及全功能验证

## 元数据

- 需求状态：人工待确认
- 治理分级：G2
- 当前版本：1
- 最后更新：2026-10-29

## 当前有效用户需求

| UN | 状态 | 内容 |
|---|---|---|
| UN-0042-01 | 已确认 | 审查架构与目录职责，修复有证据的重复实现和测试入口遗漏，验证改动后的功能。 |

## 当前有效开发需求

| DR | 状态 | 内容 |
|---|---|---|
| DR-0042-01 | 已实现 | 审查架构与文件职责，并建立已推送的回退点 |
| DR-0042-02 | 已实现 | 收敛四个存储模块的原子JSON重复实现 |
| DR-0042-03 | 已实现 | 统一前端文件下载公共处理 |
| DR-0042-04 | 已实现 | 补工程测试入口并执行正式功能验证 |
| DR-0042-05 | 已实现 | 修复正式功能测试发现的明确无请求体被误判为必须请求体。 |

## 当前有效设计

| DD | DR | 状态 | 内容 |
|---|---|---|---|
| DD-0042-01 | DR-0042-01 | 已确认 | 审查架构与文件职责，并建立已推送的回退点 |
| DD-0042-02 | DR-0042-02 | 已确认 | 收敛四个存储模块的原子JSON重复实现 |
| DD-0042-03 | DR-0042-03 | 已确认 | 统一前端文件下载公共处理 |
| DD-0042-04 | DR-0042-04 | 已确认 | 补工程测试入口并执行正式功能验证 |
| DD-0042-05 | DR-0042-05 | 已确认 | 按当前接口请求区间识别明确否定，保留肯定证据。 |

## 当前有效任务

| TK | DR/DD | 状态 | 内容 |
|---|---|---|---|
| TK-0042-01 | DR-0042-01 / DD-0042-01 | 已完成 | 审查架构与文件职责，并建立已推送的回退点 |
| TK-0042-02 | DR-0042-02 / DD-0042-02 | 已完成 | 收敛四个存储模块的原子JSON重复实现 |
| TK-0042-03 | DR-0042-03 / DD-0042-03 | 已完成 | 统一前端文件下载公共处理 |
| TK-0042-04 | DR-0042-04 / DD-0042-04 | 已完成 | 补工程测试入口并执行正式功能验证 |
| TK-0042-05 | DR-0042-05 / DD-0042-05 | 已完成 | 局部请求体否定解析修复、反例回归、原合成协议正式复验。 |

## 当前有效验证项

| VT | DR | 状态 | 内容 | 当前证据 |
|---|---|---|---|---|
| VT-0042-01 | DR-0042-01 | 仅静态检查 | 列明入口/前后端/执行器/数据与历史目录，有具体代码证据和风险优先级 | 命令：git ls-remote --heads origin refs/heads/codex/archive-before-architecture-review-20261029；退出码：0；测试数量：1；失败数量：0；跳过数量：0；证据：workbench/qa/20261029-architecture-review/archive-verification.json |
| VT-0042-02 | DR-0042-02 | 单元测试通过 | 重试次数、临时文件、清理、尾部换行与既有IO注入语义保持；不改变其他存储策略 | 命令：npm test；退出码：0；测试数量：1366；失败数量：0；跳过数量：0；证据：workbench/qa/20261029-architecture-review/engineering-final.log |
| VT-0042-03 | DR-0042-03 | 单元测试通过 | 保留调用和返回契约；正确处理网络、非JSON错误、错误MIME及损坏下载文件名 | 命令：npm test；退出码：0；测试数量：1366；失败数量：0；跳过数量：0；证据：workbench/qa/20261029-architecture-review/engineering-final.log |
| VT-0042-04 | DR-0042-04 | 测试失败 | 新增明确安全的工程测试入清单；运行完整清单和4322功能测试；付费/环境受阻项明确标注 | 命令：node workbench/qa/20261029-architecture-review/page-readiness/verify-pages.mjs；退出码：1；测试数量：22；失败数量：1；跳过数量：0；证据：workbench/qa/20261029-architecture-review/page-readiness/results.json |
| VT-0042-05 | DR-0042-05 | 集成测试通过 | 无请求体、肯定请求体与相邻接口隔离回归，并用原正式输入复验。 | 命令：node --test --test-concurrency=1 workbench/tests/backend-protocol-layout.test.mjs workbench/tests/backend-preparation.test.mjs workbench/tests/backend-case-stages.test.mjs workbench/tests/backend-readonly-post-query.test.mjs；退出码：0；测试数量：34；失败数量：0；跳过数量：0；证据：workbench/qa/20261029-architecture-review/protocol-negation-final.log |

## 人工待确认项

- [ ] 报告预览内联style触发CSP控制台错误，内容和样式已加载但严格页面检查保留失败。
- [ ] 助手候选新增来源未规定的查询后控件状态及点击空白操作，保留待确认，不重复付费重跑。
- [ ] PID复用导致旧DSH锁误判本轮仅安全恢复现场，永久进程身份识别修复仍待单独实现；CSS、转义工具、忙碌状态重复列为后续。

## 本轮禁止实现内容

- 不删除旧目录和业务数据、不新起影子工作台、不换正式端口或数据目录；模型仅新建合成项目且沿用限额，不重试未知付费结果；不把工程测试称全功能验收。
