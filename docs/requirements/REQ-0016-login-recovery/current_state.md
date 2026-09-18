<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0016 当前状态

- 需求标题：登录证据确认与失效页面恢复

## 元数据

- 需求状态：集成测试通过
- 治理分级：G2
- 当前版本：1
- 最后更新：2026-09-18

## 当前有效用户需求

| UN | 状态 | 内容 |
|---|---|---|
| UN-0016-01 | 已确认 | 修复登录页面失效和无自动登录证据时卡住的交接，给出就近可操作反馈。 |

## 当前有效开发需求

| DR | 状态 | 内容 |
|---|---|---|
| DR-0016-01 | 已确认 | 可恢复页面生命周期 |
| DR-0016-02 | 已确认 | 无自动证据的原位确认 |
| DR-0016-03 | 已确认 | 准确反馈和交接验证 |

## 当前有效设计

| DD | DR | 状态 | 内容 |
|---|---|---|---|
| DD-0016-01 | DR-0016-01 | 已确认 | 区分连接与页面存活；同任务闭页可在原context恢复，context丢失重新打开；认证重新核验，准备中恢复有上限，不重放执行。 |
| DD-0016-02 | DR-0016-02 | 已确认 | 等待登录时提供受同作业阶段限制的确认入口；过滤唯一可见小范围标志、拒绝登录挑战和跨源；确认续原prepare而不另起discover。 |
| DD-0016-03 | DR-0016-03 | 已确认 | 主流程展示等待挑战、需确认、页面关闭/恢复等状态；确认错误保留表单并可重试；真实lab和反例完成自动化回归。 |

## 当前有效任务

| TK | DR/DD | 状态 | 内容 |
|---|---|---|---|
| TK-0016-01 | DR-0016-01 / DD-0016-01 | 已实现 | 可恢复页面生命周期 |
| TK-0016-02 | DR-0016-02 / DD-0016-02 | 已实现 | 无自动证据的原位确认 |
| TK-0016-03 | DR-0016-03 / DD-0016-03 | 已实现 | 准确反馈和交接验证 |

## 当前有效验证项

| VT | DR | 状态 | 内容 | 当前证据 |
|---|---|---|---|---|
| VT-0016-01 | DR-0016-01 | 集成测试通过 | 区分连接与页面存活；同任务闭页可在原context恢复，context丢失重新打开；认证重新核验，准备中恢复有上限，不重放执行。 | 命令：node --test --test-reporter=tap tests/login-recovery.integration.mjs tests/auth-menu-observation.integration.mjs tests/autonomous-preparation.integration.mjs manual-lab/verify.test.mjs；退出码：0；测试数量：47；失败数量：0；跳过数量：0；证据：validation/REQ-0016-integration-final.log |
| VT-0016-02 | DR-0016-02 | 集成测试通过 | 等待登录时提供受同作业阶段限制的确认入口；过滤唯一可见小范围标志、拒绝登录挑战和跨源；确认续原prepare而不另起discover。 | 命令：node --test --test-reporter=tap tests/login-recovery.integration.mjs tests/auth-menu-observation.integration.mjs tests/autonomous-preparation.integration.mjs manual-lab/verify.test.mjs；退出码：0；测试数量：47；失败数量：0；跳过数量：0；证据：validation/REQ-0016-integration-final.log |
| VT-0016-03 | DR-0016-03 | 集成测试通过 | 主流程展示等待挑战、需确认、页面关闭/恢复等状态；确认错误保留表单并可重试；真实lab和反例完成自动化回归。 | 命令：node --test --test-reporter=tap tests/login-recovery.integration.mjs tests/auth-menu-observation.integration.mjs tests/autonomous-preparation.integration.mjs manual-lab/verify.test.mjs；退出码：0；测试数量：47；失败数量：0；跳过数量：0；证据：validation/REQ-0016-integration-final.log |

## 人工待确认项

- [ ] 无阻塞本轮源码交付的业务待确认项；运行4179切换需正常停止/启动，真实模型和发布验收不在本轮证据内。

## 本轮禁止实现内容

- 禁止公开菜单/标题自动作为登录证据；禁止自动重放业务动作、跨任务接管、持久化凭据、修改旧任务和原验收用例。
