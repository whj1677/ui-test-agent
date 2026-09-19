<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0016 当前状态

- 需求标题：登录证据确认与失效页面恢复

## 元数据

- 需求状态：已确认
- 治理分级：G2
- 当前版本：2
- 最后更新：2026-09-19

## 当前有效用户需求

| UN | 状态 | 内容 |
|---|---|---|
| UN-0016-01 | 已确认 | 修复登录交接，并支持显式加密保存模型Key和自建合成站点自动登录，减少后续迭代的重复人工操作。 |

## 当前有效开发需求

| DR | 状态 | 内容 |
|---|---|---|
| DR-0016-04 | 已确认 | 本机模型配置连续性与合成登录自动化 |
| DR-0016-01 | 已确认 | 可恢复页面生命周期 |
| DR-0016-02 | 已确认 | 无自动证据的原位确认 |
| DR-0016-03 | 已确认 | 准确反馈和交接验证 |

## 当前有效设计

| DD | DR | 状态 | 内容 |
|---|---|---|---|
| DD-0016-04 | DR-0016-04 | 已确认 | 采用Windows DPAPI CurrentUser、项目数据目录内加密文件及显式remember选择；独立测试辅助函数仅进入受信本机合成页面。 |
| DD-0016-01 | DR-0016-01 | 已确认 | 区分连接与页面存活；同任务闭页可在原context恢复，context丢失重新打开；认证重新核验，准备中恢复有上限，不重放执行。 |
| DD-0016-02 | DR-0016-02 | 已确认 | 等待登录时提供受同作业阶段限制的确认入口；过滤唯一可见小范围标志、拒绝登录挑战和跨源；确认续原prepare而不另起discover。 |
| DD-0016-03 | DR-0016-03 | 已确认 | 主流程展示等待挑战、需确认、页面关闭/恢复等状态；确认错误保留表单并可重试；真实lab和反例完成自动化回归。 |

## 当前有效任务

| TK | DR/DD | 状态 | 内容 |
|---|---|---|---|
| TK-0016-04 | DR-0016-04 / DD-0016-04 | 已实现 | 实现加密模型配置保存/恢复/删除与合成登录助手，验证重启和安全反例 |
| TK-0016-01 | DR-0016-01 / DD-0016-01 | 已实现 | 可恢复页面生命周期 |
| TK-0016-02 | DR-0016-02 / DD-0016-02 | 已实现 | 无自动证据的原位确认 |
| TK-0016-03 | DR-0016-03 / DD-0016-03 | 已实现 | 准确反馈和交接验证 |

## 当前有效验证项

| VT | DR | 状态 | 内容 | 当前证据 |
|---|---|---|---|---|
| VT-0016-04 | DR-0016-04 | 集成测试通过 | 加密保存显式授权、配置重载/忘记、损坏/非Windows拒绝、API无Key及独立合成登录 | 命令：node --test --test-concurrency=2 tests/credential-store.test.mjs tests/credential-settings.integration.mjs tests/synthetic-login.test.mjs tests/autonomous-lab.test.mjs tests/autonomous-lab.integration.mjs tests/login-recovery.integration.mjs；退出码：0；测试数量：21；失败数量：0；跳过数量：0；证据：validation/req0016-v2/final-integration.log |
| VT-0016-01 | DR-0016-01 | 集成测试通过 | 区分连接与页面存活；同任务闭页可在原context恢复，context丢失重新打开；认证重新核验，准备中恢复有上限，不重放执行。 | 命令：node --test --test-reporter=tap tests/login-recovery.integration.mjs tests/auth-menu-observation.integration.mjs tests/autonomous-preparation.integration.mjs manual-lab/verify.test.mjs；退出码：0；测试数量：47；失败数量：0；跳过数量：0；证据：validation/REQ-0016-integration-final.log |
| VT-0016-02 | DR-0016-02 | 集成测试通过 | 等待登录时提供受同作业阶段限制的确认入口；过滤唯一可见小范围标志、拒绝登录挑战和跨源；确认续原prepare而不另起discover。 | 命令：node --test --test-reporter=tap tests/login-recovery.integration.mjs tests/auth-menu-observation.integration.mjs tests/autonomous-preparation.integration.mjs manual-lab/verify.test.mjs；退出码：0；测试数量：47；失败数量：0；跳过数量：0；证据：validation/REQ-0016-integration-final.log |
| VT-0016-03 | DR-0016-03 | 集成测试通过 | 主流程展示等待挑战、需确认、页面关闭/恢复等状态；确认错误保留表单并可重试；真实lab和反例完成自动化回归。 | 命令：node --test --test-reporter=tap tests/login-recovery.integration.mjs tests/auth-menu-observation.integration.mjs tests/autonomous-preparation.integration.mjs manual-lab/verify.test.mjs；退出码：0；测试数量：47；失败数量：0；跳过数量：0；证据：validation/REQ-0016-integration-final.log |

## 人工待确认项

- [ ] 版本2初次迁移已由用户本机加密保存完成，后续同账户/目录自动恢复；真实密码/扫码/验证码仍需授权操作者，本轮不会持久化真实登录会话。
- [ ] 4179已切换，原三例有界真实复验独立记账；本批不证明32条完整业务覆盖或发布验收。

## 本轮禁止实现内容

- 禁止公开菜单/标题自动作为登录证据；禁止自动重放业务动作、跨任务接管、持久化真实业务登录凭据、修改旧任务和原验收用例。版本2仅允许用户显式选择后DPAPI加密保存官方DeepSeek配置，不允许明文或从旧进程提取。
