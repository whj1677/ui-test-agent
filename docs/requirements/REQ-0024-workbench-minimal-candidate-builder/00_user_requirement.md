<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0024 用户需求

## 原始输入

> 从13f2c411基线建立独立分支，在现有workbench增加固定合成任务的最小建例Web入口，真实启动DeepSeek Harness、收集候选、独立验证并展示分离状态；允许一次初始建例和候选失败后一次用户显式修订，完成后停在等待人工核对或候选验证失败。

## 结构化理解

| UN | 状态 | 目标 | 约束 | 成功标准 |
|---|---|---|---|---|
| UN-0024-01 | 已确认 | 在本地单用户工作台完成固定无登录合成任务的提交、真实Harness生成、独立验证、结果展示和一次显式反馈修订闭环。 | 固定dsh 0.1.6-alpha.2、deepseek-v4-pro和既有浏览器插件；独立任务目录与最小资料暴露；保留无OS级隔离事实；阶段最多2次启动、每次30工具调用/10分钟；不批准资产、不接复杂业务或自愈。 | 真实Web提交产生新的Harness候选和结构化执行报告；正常与独立错误输出反例由同一最终候选验证；任务、生成、验证、人工状态及文件索引可持久化查看；本地与远端提交一致。 |

## 已确认事实

- 基线13f2c411b56962b44550fe8fc9cc4acd4866a187已在独立worktree和codex/test-workbench-m2c-build-ui分支核对。
- M2-B已验证Harness headless JSON事件、浏览器工具、候选产出、超时/取消、30次工具上限和Playwright独立验证能力。
- 用户接受独立任务目录模式下无OS级强制文件/网络隔离的残余风险，但不授权目录外访问、任意网站、提权或安全策略变更。
- 本轮Codex主窗口系统可见模型族为GPT-5；具体产品子型号及推理档位未由运行环境暴露，记录为未知，不推断。
- 当前工程验证41项workbench测试、24项harness-probe测试及M1/M2-C Chromium页面流均通过。
- 真实Web任务build-20260921030548-a1bf1358消耗1次初始启动后，拥有进程在Harness尚未收口时消失；重启后按规则标为INTERRUPTED，未生成候选、未执行技术验证，也未自动重放。
- 收口工程复验复现Windows临时EPERM导致build task原子替换失败；已为build存储增加有限重试并连续10轮通过，但真实进程没有留下外层终止错误，不能把该复现写成真实中断的确定根因。
- 诊断批次未启动Harness或模型；旧任务没有PID、exit、close、取消或到期记录，历史原因保持UNKNOWN。新实现用真实外部假子进程验证逐事件生命周期记录、exit/close收尾、存储失败关闭和重启不重放。
- 新增独立单次初始复验授权后，真实Web任务build-20260921041411-12b52a7b观察到Harness process_spawn并消耗1/1；复验驱动误把旧INTERRUPTED卡片当作新任务终态，随后清理逻辑在50毫秒后取消新进程。任务为CANCELLED、无候选、验证未运行；没有第二次Harness启动。
- 终态等待回归已补准为直接观察Promise pending再切换新任务终态；同一断言注入原任意历史卡片扫描逻辑时产生预期AssertionError，当前按task_id实现满足该断言。补准批次未启动Harness且未改取消任务、历史报告或授权账本。
- 终态等待修复后的独立授权真实任务build-20260921060716-ae44c3f2由Web提交并只按该task_id等待。Harness完成且生成新候选，候选哈希119AC2FE622ECE98599B2D6D98B97CB9864744A5B299358DAFD9C990E6F3585A；正常与反例报告均因Playwright Test从harness-probe和workbench两个安装位置重复加载而零测试，任务为CANDIDATE_VALIDATION_FAILED。授权1/1耗尽，没有修订、重试或替补启动。
- 零模型修复使workbench候选执行显式使用本子工程的CLI、配置和Playwright依赖解析根，harness-probe默认入口保持独立。原候选同字节副本正常1条通过，反例1条取得期望PROBE-42和实际PROBE-41；两边截图、录像、Trace齐全。原任务、NOT_RUN报告、候选哈希和授权账本未改写，新结果独立留档且尚未接入Web。

## 推断与待确认

- M2-C只证明固定合成任务的最小Web集成，不推断复杂业务建例质量、多人安全或生产可用性。
