<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0024 当前状态

- 需求标题：M2-C 工作台最小候选建例入口

## 元数据

- 需求状态：部分实现-既有候选复验已接入Web
- 治理分级：G2
- 当前版本：8
- 最后更新：2026-09-21

## 当前有效用户需求

| UN | 状态 | 内容 |
|---|---|---|
| UN-0024-01 | 已确认 | 在本地单用户工作台完成固定无登录合成任务的提交、真实Harness生成、独立验证、结果展示和一次显式反馈修订闭环。 |

## 当前有效开发需求

| DR | 状态 | 内容 |
|---|---|---|
| DR-0024-01 | 已确认 | Web只允许冻结的synthetic-probe-v1结构化任务，提交时保存输入版本、摘要和入口策略。 |
| DR-0024-02 | 已确认 | 通过可复用适配层启动真实Harness并持久化任务、候选、验证、人工核对四类独立状态。 |
| DR-0024-03 | 已确认 | 候选用锁定Playwright配置分别执行正常页面和未暴露给Harness的错误输出反例，依据结构化报告判定。 |
| DR-0024-04 | 已确认 | 候选失败后只允许用户显式发起一次反馈修订，并保留全部版本和错误。 |
| DR-0024-05 | 已确认 | 建例进程在中途退出或协调服务消失时，按事件保存最小脱敏生命周期事实并有界收尾。 |
| DR-0024-06 | 已确认 | 把已有候选复验按机读关联字段挂到原任务，并在Web分开展示原历史、复验结果和三类媒体。 |

## 当前有效设计

| DD | DR | 状态 | 内容 |
|---|---|---|---|
| DD-0024-01 | DR-0024-01 | 已确认 | 新增固定任务模板API和独立build task存储，不复用批准资产run语义。 |
| DD-0024-02 | DR-0024-02 / DR-0024-04 | 已确认 | 使用持久化阶段预算账本、单活动BuildManager及显式start/revise/stop路由；本次复验另用固定ID的单次初始授权账本，并只在Harness process_spawn时消耗。 |
| DD-0024-03 | DR-0024-02 / DR-0024-03 | 已确认 | workbench适配层复用harness-probe的进程、事件和验证原语，业务层只负责编排与记账。 |
| DD-0024-04 | DR-0024-03 / DR-0024-04 | 已确认 | 工具证据、候选和测试报告分类登记；页面只显示登记摘要与候选代码，原始工具文件默认不公开。 |
| DD-0024-05 | DR-0024-02 / DR-0024-05 | 已确认 | attempt使用追加式脱敏生命周期记录；子进程区分exit/close并有界等待流收尾，重启将活动任务和RUNNING attempt收口为INTERRUPTED。 |
| DD-0024-06 | DR-0024-06 | 已确认 | 使用Git忽略的派生索引保存精确关联与媒体登记，API按任务/复验/媒体ID读取并在每次请求核对边界、大小和哈希；前端只在选项或数据变化时重建媒体节点。 |

## 当前有效任务

| TK | DR/DD | 状态 | 内容 |
|---|---|---|---|
| TK-0024-01 | DR-0024-01 / DR-0024-02 / DD-0024-01 / DD-0024-02 / DD-0024-05 | 已完成 | 实现固定任务、持久化账本、生命周期、预算和恢复。 |
| TK-0024-02 | DR-0024-02 / DR-0024-03 / DR-0024-04 / DD-0024-03 / DD-0024-04 | 已完成 | 实现Harness适配、候选执行、文件索引和一次显式修订。 |
| TK-0024-03 | DR-0024-01 / DR-0024-02 / DR-0024-03 / DR-0024-04 / DD-0024-01 / DD-0024-02 / DD-0024-03 / DD-0024-04 | 已完成 | 实现最小中文Web并完成工程测试。 |
| TK-0024-04 | DR-0024-01 / DR-0024-02 / DR-0024-03 / DR-0024-04 / DD-0024-01 / DD-0024-02 / DD-0024-03 / DD-0024-04 | 受阻 | 从真实Web完成一次集成、脱敏报告与GitHub同步。 |
| TK-0024-05 | DR-0024-05 / DD-0024-05 | 已完成 | 补齐中断生命周期、进程流收尾、存储失败关闭和零模型故障注入。 |
| TK-0024-06 | DR-0024-03 / DD-0024-03 / DD-0024-04 | 已完成 | 统一workbench候选执行的Playwright运行根，并对原候选做零模型正常/反例复验和独立留档。 |
| TK-0024-07 | DR-0024-06 / DD-0024-06 | 已完成 | 将既有复验及截图、视频和Trace受控接入原任务Web详情。 |

## 当前有效验证项

| VT | DR | 状态 | 内容 | 当前证据 |
|---|---|---|---|---|
| VT-0024-01 | DR-0024-01 / DR-0024-02 | 集成测试通过 | 存储、跨任务阶段预算、重复启动、取消和重启恢复。 | 命令：npm test --prefix workbench；退出码：0；测试数量：44；失败数量：0；跳过数量：0；证据：docs/requirements/REQ-0024-workbench-minimal-candidate-builder/logs/runtime-fix-revalidation-tests.log |
| VT-0024-02 | DR-0024-02 / DR-0024-03 / DR-0024-04 | 集成测试通过 | Harness终态、候选/工具/报告登记、通用报告解析和显式修订。 | 命令：npm test --prefix harness-probe；退出码：0；测试数量：24；失败数量：0；跳过数量：0；证据：docs/requirements/REQ-0024-workbench-minimal-candidate-builder/logs/wait-fix-validation-tests.log |
| VT-0024-03 | DR-0024-01 / DR-0024-02 / DR-0024-03 / DR-0024-04 | 人工待确认 | 真实浏览器中的固定任务提交、状态、候选、错误、文件和按钮行为。 | npm run test:browser与npm run test:build-browser均退出0；零模型重启读回显示新任务CANCELLED、授权1/1和无候选，公开截图见workbench/docs/evidence/m2c-revalidation-cancelled.png。 |
| VT-0024-04 | DR-0024-01 / DR-0024-02 / DR-0024-03 / DR-0024-04 | 无法运行 | 真实Web-Harness-候选-正常/反例集成、资产不变和远端SHA。 | 终态等待修复后的任务build-20260921060716-ae44c3f2经真实Web启动，Harness以7次工具调用生成候选；正常与反例报告均完整但目标测试数为0，原始报告显示harness-probe与workbench的Playwright Test实例重复加载。此处无法运行仅指两次目标测试均未被Playwright执行；授权1/1耗尽，无修订或替补启动。见workbench/docs/M2C_WAIT_FIX_VALIDATION_REPORT.md。 |
| VT-0024-05 | DR-0024-05 | 集成测试通过 | 真实外部假子进程的逐事件记录、异常退出、无换行与截断末行、取消/到期/额度、存储故障和协调进程终止后恢复。 | harness-probe 24/24、workbench 38/38，均退出0；未运行build-real.integration.mjs。 |
| VT-0024-06 | DR-0024-03 | 集成测试通过 | 统一Playwright运行根后，真实CLI发现1条测试并以同一原候选完成正常通过和独立反例断言差异验证。 | npm run revalidate:m2c-runtime-fix退出0；正常1条PASSED，反例1条FAILED且Expected PROBE-42/Received PROBE-41；候选哈希前后相同，两边截图/录像/Trace各1。原始记录在Git忽略目录，脱敏事实见workbench/docs/M2C_PLAYWRIGHT_RUNTIME_FIX_REVALIDATION.md。 |
| VT-0024-07 | DR-0024-06 | 集成测试通过 | 已有复验精确关联、受控媒体访问、原历史并列显示、轮询状态保持和重启读回。 | 命令：npm test --prefix workbench；退出码：0；测试数量：47；失败数量：0；跳过数量：0；证据：docs/requirements/REQ-0024-workbench-minimal-candidate-builder/logs/existing-revalidation-web-media-tests.log |

## 人工待确认项

- [ ] 原真实初始任务为何在Harness生成期消失仍不可唯一确定；旧实现未持久化PID、exit、close或终止请求，EPERM只是一条已修复线索。新的工程条件可提升下一次受权真实验证的可诊断性，但剩余一次预算仍是显式修订额度。

## 本轮禁止实现内容

- 不得修改M1批准脚本、旧报告、M2原候选和历史结果。
- 不得开放任意上传代码/文件/URL立即执行或任意磁盘读取。
- 不得超过阶段2次Harness启动、单次30工具/600秒，或以新task ID重置预算。
- 不得自动批准、自动修订循环、接入复杂业务、自愈、多人服务或生产部署。
- 不得把独立目录、路径校验和环境白名单描述为操作系统沙箱。
