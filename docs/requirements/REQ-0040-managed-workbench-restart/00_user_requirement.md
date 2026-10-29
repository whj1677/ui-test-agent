<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0040 用户需求

## 原始输入

> 重启了，你也解决一下这个问题，别老要我给你重启。继续。

## 结构化理解

| UN | 状态 | 目标 | 约束 | 成功标准 |
|---|---|---|---|---|
| UN-0040-01 | 已确认 | 由原启动器托管正式工作台，空闲时自主或通过界面加载代码更新，避免反复要求用户手工重启。 | 唯一4322，原数据配置和预算不变，不接管未知进程，不绕过环境自动审批拒绝。 | 托管实例可受控重启；忙碌/并发/旧身份拒绝；新实例身份与原数据配置可核验；失败不重放任务。 |

## 已确认事实

- 任务状态卡：当前实现阶段；唯一目标为同实例配置的托管重启；输入是原launcher与既有shutdown；交付限supervisor、入口、必要工程与正式4322验收；不做热替换、自动崩溃重试、升级安装、第二工作台、提交发布。
- 2026-09-27用户手动重启已加载REQ0038修复，readonly证据restarted-dsh-config-official.json；原进程由launcher直接启动，无法安全被新supervisor追认。
- 历史自动审批两次拒绝停止/重启命令，仅返回blocked by policy；不得通过新端点或其他工具绕过。当前未托管实例转换保留为外部启动条件。
- 主管负责架构和独立验收；本轮新派gpt-6-sol/medium实现托管后端，gpt-6-luna/medium实现界面。没有用户数字硬预算，费用未知；不重复做已充分的验证。
- 2026-09-27原4322正式托管主路径实测：用户经原配置包装器启动后，托管实例service-dafc2dbb-edac-46b7-9861-bc2225474f46经真实浏览器空闲重启切换为service-22f6c1c3-bed3-4210-960e-d6528d57eb65；数据根与配置摘要相同，12项目摘要逐一未变，ready=true且无运行任务。证据workbench/qa/20260927-kimi-remediation/managed-restart-supervisor-review.json及managed-restart-restored.png。忙碌和并发拒绝反例仍只有工程测试证据。
- 2026-09-27一次复跑后通过-Restart请求未恢复，service-22f6c1c3-bed3-4210-960e-d6528d57eb65及父子进程消失；原stdout不可用，根因未定。主管在确认4322无listener后经原wrapper隐藏恢复同一数据根并捕获日志，不要求用户再次操作。
- 2026-09-27恢复实例service-53ab02d5-b5fa-4b62-bf28-772e9a780303在同一supervisor下连续两次CLI重启成功，实例链service-53ab02d5-b5fa-4b62-bf28-772e9a780303 → service-82b1fddc-fc9e-4db5-b6f9-56f12c136b77 → service-fafd6841-33d5-4b00-97e9-9e7dc0dc2522；日志managed-recovery.stdout.log，最终健康快照managed-after-run-restart-health.json。中间运行了UI零模型复跑批次，health.available=false期间的重启结果已等待实例确认；这两次CLI成功不抹除此前service-22f6...退出后重启未恢复这一真实异常，也未证明UI复跑后重启稳定性。
- 跨wrapper恢复前后配置摘要从e5f25db8d0217d35fb8a342555e2874a9facad572a77e91c1d355b6434316b0d变为39d733d602da1b8ab1fffb862eba552b2666088e3576954988f5cb5a5df5a1a7；同一恢复后的supervisor内连续重启身份检查显示配置保持。跨恢复变化原因未在本次收口说明中判断。
- 2026-09-27根因复核证据workbench/qa/20260927-kimi-remediation/managed-config-root-cause-evidence.json精确复算跨wrapper摘要e5f25db8...→39d733d6...与污染配置相符：index将trialConfig.authorizations和developmentEnvironments原数组传入manager；ProjectTrialAuthorization.install及TargetAccess.install随后push，启动身份因此被持久授权/目标污染。
- managed_restart修复service-identity.mjs：新增isolateStartupRegistries并以structuredClone隔离启动注册表，再由index接入。主管读代码；工程回归project-trial-authorization 4/4，日志workbench/qa/20260927-kimi-remediation/config-isolation-root-test.log。
- 历史状态（health刷新补丁加载前）：实例service-fafd6841/source e41，转接命令曾被自动审批拒绝，未绕过；当时修复后正式重启为NOT_RUN。随后已由service-0e80c9c1加载source f17，详见后续正式加载事实。此前service-22f6...重启未恢复及恢复后同supervisor两次CLI成功均保留为历史。
- 2026-09-27正式4322首次配置隔离修复加载及第二目标恢复验证：用户转接实例service-9edc3d10，source e189/config 489，原12项目保全；主管在真实界面新增第二目标b5da6df4后重启成功至service-d252，source/config/data摘要保持，两目标恢复且原grant current=true。相关详细证据由主管QA归档。此结果独立证明当次正式配置隔离与多目标保留路径成功。
- 随后原授权零模型批次batch-1f4b4e8b（run trial-76e08...）真实状态FAILED、model_calls=0、NOT_APPROVED，原bundle不变；运行期间health不可用且UI重启按钮disabled。
- 磁盘后续app.js健康刷新修复版本source f17cb79a70741505494d607fd36a6443553be03dfed37cc147b157fc58c7c684，统一4秒health刷新、请求单飞与4秒abort、重启pause及generation丢弃旧响应。此修复尚未加载正式实例：正式仍service-d252/source e189/config489；原生重启确认框控制工具超时，尚未提交POST。修复后同页自动刷新真实复验NOT_RUN。
- 后续readonly边界核验确认新实例service-0e80c9c1-d2e4-4407-9bda-ec6c26008f95已加载source f17cb79a70741505494d607fd36a6443553be03dfed37cc147b157fc58c7c684，config489/data bf51保持，浏览器工作台显示恢复；证据workbench/qa/20260927-kimi-remediation/health-refresh-loaded-health.json。无法精确归因此前原生确认框由哪次键入/人工操作完成确认。busy→idle后按钮自动恢复的最后同页复验仍未取得终态，暂记NOT_RUN。
- 2026-09-27正式浏览器同页busy→idle复验完成：新页同一4322提交原候选零模型batch-705b40ec-4f24-4912-b58f-da4abcfbe81b/trial-a8c18dc365f36bd2ac487b44252a890890b1eb35；提交后重启按钮disabled且health.available=false，页面不手动刷新不切路由，应用自动转结果页后终态FINISHED/FAILED，按钮自行enabled且health.available=true。model_calls=0、原bundle不变、未批准。证据health-refresh-final-busy.txt/png、busy-health.json、health-refresh-final-idle.txt/png、idle-health.json、batch.json、run.json。UI报告ASSERTION_UNRESOLVED且两步未单采实际值，不据此宣称业务语义已完整证明。

## 推断与待确认

- 配置隔离修复的正式第二目标重启及后续health刷新修复加载均有正式4322证据，source/config/data保全情况分别按记录保留。
- health刷新修复的正式同页busy→idle行为已验证：health unavailable与按钮disabled自动恢复至available/enabled，过程中没有手动刷新或路由切换。候选未批准、model_calls=0，且UI报告ASSERTION_UNRESOLVED、两步未单采实际值，因此本次运行不证明业务断言语义。
- 忙碌/并发拒绝反例仍只有工程证据；产品整体验收仍人工待确认。
